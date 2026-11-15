"""Fixed-origin adapter to DEV2's research API. Persona always comes from ChatRequest."""
import json
import os
import re
from functools import lru_cache
from contextlib import contextmanager
from contextvars import ContextVar

from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from uuid import UUID
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

_authorization = ContextVar('research_authorization', default='')


@contextmanager
def forward_research_authorization(value: str):
    token = _authorization.set(value if value.startswith('Bearer ') else '')
    try:
        yield
    finally:
        _authorization.reset(token)



class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def research_configured() -> bool:
    return bool(os.getenv('RESEARCH_API_URL', '').strip() or os.getenv('RESEARCH_LAMBDA_FUNCTION', '').strip())


@lru_cache(maxsize=1)
def _lambda_client():
    return boto3.client('lambda', region_name=os.getenv('AWS_REGION', 'us-east-1'),
                        config=Config(connect_timeout=3, read_timeout=25, retries={'total_max_attempts': 1}))


def _invoke_research(method: str, path: str, persona: str, body: dict | None) -> dict:
    """Server-to-server transport authorized by IAM, with no browser credentials."""
    function = os.getenv('RESEARCH_LAMBDA_FUNCTION', '').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', function):
        raise ValueError('Nom de fonction de recherche invalide.')
    parsed = urlsplit('/v1/research' + path)
    query = parsed.query
    if method == 'GET' or path.endswith('/cancel'):
        query += ('&' if query else '') + urlencode({'persona': persona})
    event = {'version': '2.0', 'routeKey': '$default', 'rawPath': parsed.path, 'rawQueryString': query,
             'headers': {'content-type': 'application/json', 'host': 'local-development'},
             'requestContext': {'http': {'method': method, 'path': parsed.path,
                 'sourceIp': '127.0.0.1', 'protocol': 'HTTP/1.1'}, 'requestId': 'local-iam-research'},
             'body': json.dumps(body) if body is not None else None, 'isBase64Encoded': False}
    try:
        response = _lambda_client().invoke(FunctionName=function, InvocationType='RequestResponse',
                                           Payload=json.dumps({'source':'investoros.research-iam','request':event}).encode())
        raw = response['Payload'].read(262145)
        if response.get('FunctionError') or len(raw) > 262144:
            raise ValueError('Réponse du moteur de recherche indisponible ou trop volumineuse.')
        envelope = json.loads(raw)
        if int(envelope.get('statusCode', 502)) >= 400:
            raise ValueError(f"Le moteur de recherche a refusé la requête (HTTP {envelope.get('statusCode', 502)}).")
        data = json.loads(envelope.get('body', '{}'))
        if not isinstance(data, dict):
            raise ValueError('Réponse de recherche invalide.')
        return data
    except (BotoCoreError, ClientError, json.JSONDecodeError) as error:
        raise ValueError('La liaison IAM vers le moteur de recherche est indisponible; vérifier les droits du serveur.') from error


def _call(method: str, path: str, persona: str, body: dict | None = None) -> dict:
    if os.getenv('RESEARCH_LAMBDA_FUNCTION', '').strip():
        return _invoke_research(method, path, persona, body)

    origin = os.getenv('RESEARCH_API_URL', '').strip().rstrip('/')
    parts = urlsplit(origin)
    if parts.scheme != 'https' or not parts.netloc or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError('Recherche indisponible : configurer RESEARCH_API_URL avec l’URL HTTPS du backend DEV2.')
    url = origin + '/v1/research' + path
    if method == 'GET' or path.endswith('/cancel'):
        url += ('&' if '?' in url else '?') + urlencode({'persona': persona})
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if _authorization.get():
        headers['Authorization'] = _authorization.get()
    request = Request(url, data=json.dumps(body).encode() if body is not None else None,
                      headers=headers, method=method)

    try:
        with build_opener(_NoRedirect()).open(request, timeout=15) as response:
            raw = response.read(262145)
        if len(raw) > 262144:
            raise ValueError('Résultat de recherche trop volumineux; consulter le module de recherche.')
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ValueError('Réponse de recherche invalide.')
        return result
    except HTTPError as error:
        raise ValueError(f'Le moteur de recherche a refusé la requête (HTTP {error.code}).') from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise ValueError('Le moteur de recherche ne répond pas. Aucun lancement ne doit être annoncé sans identifiant confirmé; vérifier avant de réessayer.') from error


def research_tool(name: str, args: dict, persona: str) -> dict:
    if name == 'start_analysis':
        if set(args) != {'question'} or not isinstance(args['question'], str) or not 12 <= len(args['question']) <= 2400:
            raise ValueError('La question de recherche doit contenir de 12 à 2400 caractères.')
        return _call('POST', '/analyses', persona, {'question': args['question'], 'persona': persona})
    if set(args) != {'analysis_id'} or not isinstance(args['analysis_id'], str):
        raise ValueError('Identifiant d’analyse requis.')
    try:
        identifier = str(UUID(args['analysis_id']))
    except ValueError as error:
        raise ValueError('Identifiant d’analyse invalide.') from error
    path = '/analyses/' + identifier
    if name == 'cancel_analysis':
        return _call('POST', path + '/cancel', persona)
    if name == 'get_evidence':
        return _call('GET', path + '/evidence', persona)
    result = _call('GET', path, persona)
    if name == 'get_analysis_status':
        return {key: result.get(key) for key in ('analysis_id', 'status', 'created_at', 'completed_at', 'error')}
    return result


def research_snapshot(analysis_id: str, persona: str) -> dict:
    """Read existing work only; this route never starts another analysis."""
    try:
        identifier = str(UUID(analysis_id))
    except ValueError as error:
        raise ValueError('Identifiant d’analyse invalide.') from error
    result = _call('GET', '/analyses/' + identifier, persona)
    events = _call('GET', '/analyses/' + identifier + '/events?limit=150', persona)
    items = events.get('events', [])
    cursor = events.get('next_after')
    if cursor:
        page = _call('GET', '/analyses/' + identifier + '/events?' + urlencode({'limit': 150, 'after': cursor}), persona)
        items += page.get('events', [])
        cursor = page.get('next_after')
    evidence = _call('GET', '/analyses/' + identifier + '/evidence', persona)
    return {**result, 'events': items, 'events_truncated': bool(cursor), 'evidence': evidence.get('evidence', [])}


def research_history(persona: str, limit: int = 30) -> dict:
    """List existing research runs through the configured IAM or HTTPS bridge."""
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 60:
        raise ValueError('La limite d’historique doit être comprise entre 1 et 60.')
    return _call('GET', '/analyses?' + urlencode({'limit': limit}), persona)
