"""Fixed-origin adapter to DEV2's research API. Persona always comes from ChatRequest."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from uuid import UUID


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def research_configured() -> bool:
    return bool(os.getenv('RESEARCH_API_URL', '').strip())


def _call(method: str, path: str, persona: str, body: dict | None = None) -> dict:
    origin = os.getenv('RESEARCH_API_URL', '').strip().rstrip('/')
    parts = urlsplit(origin)
    if parts.scheme != 'https' or not parts.netloc or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError('Recherche indisponible : configurer RESEARCH_API_URL avec l’URL HTTPS du backend DEV2.')
    url = origin + '/v1/research' + path
    if method == 'GET' or path.endswith('/cancel'):
        url += '?' + urlencode({'persona': persona})
    request = Request(url, data=json.dumps(body).encode() if body is not None else None,
                      headers={'Content-Type': 'application/json', 'Accept': 'application/json'}, method=method)
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
