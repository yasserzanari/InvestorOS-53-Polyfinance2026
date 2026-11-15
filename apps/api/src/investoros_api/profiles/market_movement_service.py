"""Account-scoped movement context and bounded reads of an approved issuer feed."""
import hashlib
import json
import math
import re
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from threading import Lock
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from ..research.documents import excerpts, page_text
from ..simulation import history as simulation_history
from .research_bridge import _call, research_snapshot

_SOURCE_ID = 'nvidia-investor-relations'
_SOURCE_NAME = 'NVIDIA · communiqués officiels'
_HOST = 'investor.nvidia.com'
_FEED = 'https://investor.nvidia.com/rss/pressrelease.aspx?LanguageId=1'
_CACHE_TTL = 600
_CACHE_LIMIT = 48
_CACHE: dict[tuple, tuple[float, dict]] = {}
_CACHE_LOCK = Lock()


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _content(value):
    for _ in range(5):
        if not isinstance(value, str):
            break
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return {}
    return value if isinstance(value, dict) else {}


def _article_url(value):
    if not isinstance(value, str) or len(value) > 2048:
        return None
    try:
        parsed = urlsplit(value)
        if (parsed.scheme == 'https' and parsed.hostname == _HOST and
                parsed.port in {None, 443} and not parsed.username and not parsed.password and
                not parsed.query and not parsed.fragment and
                parsed.path.startswith('/news/press-release-details/')):
            return value
    except ValueError:
        pass
    return None


def _read_registered(url, deadline):
    if url != _FEED and not _article_url(url):
        raise ValueError('Destination hors du contrat de source.')
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError('Budget de lecture épuisé.')
    request = Request(url, headers={
        'User-Agent': 'InvestorOS/1.0 public financial research',
        'Accept': 'text/html,application/xml,text/xml,application/rss+xml',
    })
    with build_opener(_NoRedirect()).open(request, timeout=min(3.0, remaining)) as response:
        data = bytearray()
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError('Budget de lecture épuisé.')
            block = response.read1(65536)
            if not block:
                break
            data.extend(block)
            if len(data) > 2_000_000:
                raise ValueError('Document trop volumineux pour cette lecture.')
        return data.decode('utf-8', errors='replace')


def _published(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(ZoneInfo('America/New_York')).date()
    except (ValueError, TypeError, OverflowError):
        return None


def _collection(status, message, documents=None, **extra):
    return {
        'documents': documents or [],
        'collection': {
            'status': status, 'documentsRead': len(documents or []),
            'sourceName': _SOURCE_NAME, 'sourceUrl': _FEED,
            'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'message': message, **extra,
        },
    }


def _collect_registered_news(window, moves, existing_urls):
    deadline = time.monotonic() + 11
    try:
        feed = ET.fromstring(_read_registered(_FEED, deadline))
    except Exception:
        return _collection('unavailable', 'Le flux officiel NVIDIA n’a pas pu être lu; les preuves déjà reçues restent utilisées.')
    wanted = [date.fromisoformat(move['date']) for move in moves]
    candidates = []
    seen = set(existing_urls)
    for item in feed.findall('./channel/item')[:40]:
        url = _article_url(item.findtext('link', ''))
        published_at = item.findtext('pubDate', '')
        published_day = _published(published_at)
        if not url or url in seen or published_day is None:
            continue
        if not window['start'] <= published_day.isoformat() <= window['end']:
            continue
        seen.add(url)
        distance = min((abs((published_day - day).days) for day in wanted), default=0)
        candidates.append((distance, published_day, {
            'url': url, 'title': item.findtext('title', 'Communiqué NVIDIA')[:500],
            'published_at': published_at,
        }))
    candidates.sort(key=lambda item: (item[0], -item[1].toordinal(), item[2]['url']))
    selected = [item[2] for item in candidates[:6]]
    if not selected:
        return _collection('complete', 'Flux officiel consulté : aucun document supplémentaire dans cette période parmi les 40 entrées récentes. Ce flux n’est pas une archive exhaustive.')

    def read_article(item):
        text = page_text(_read_registered(item['url'], deadline), article=True)
        if len(text.strip()) < 80:
            raise ValueError('Corps du communiqué absent ou insuffisant.')
        return {**item, 'excerpt': excerpts(text, 6000), 'characters_read': len(text),
                'method': 'authorized_official_http_read'}

    documents, failed = [], 0
    with ThreadPoolExecutor(max_workers=3) as executor:
        tasks = [executor.submit(read_article, item) for item in selected]
        for task in as_completed(tasks):
            try:
                documents.append(task.result())
            except Exception:
                failed += 1
    documents.sort(key=lambda item: item['url'])
    status = 'partial' if failed else 'complete'
    if not documents:
        status = 'unavailable'
    return _collection(status,
        f'{len(documents)} communiqué(s) effectivement lu(s) sur {len(selected)} tentative(s), dans le flux officiel récent. '
        'Lecture limitée à six documents; ce flux n’est pas une archive exhaustive.',
        documents, attempted=len(selected), failed=failed, availableInFeed=len(candidates))


def _validate(analysis_id, persona, ticker, start_date, end_date, threshold_pct, refresh):
    try:
        identifier = str(UUID(analysis_id))
    except (ValueError, TypeError, AttributeError) as error:
        raise HTTPException(422, 'Identifiant d’analyse invalide.') from error
    if persona not in {'amira', 'mateo', 'robert'}:
        raise HTTPException(422, 'Compte de démonstration invalide.')
    if not isinstance(ticker, str) or not re.fullmatch(r'[A-Za-z0-9.^=-]{1,16}', ticker):
        raise HTTPException(422, 'Symbole de titre invalide.')
    if isinstance(threshold_pct, bool) or not isinstance(threshold_pct, (int, float)) or not math.isfinite(threshold_pct) or not .5 <= threshold_pct <= 30:
        raise HTTPException(422, 'Le seuil doit être compris entre 0,5 et 30 %.')
    if not isinstance(refresh, bool):
        raise HTTPException(422, 'Paramètre de rafraîchissement invalide.')
    for value in (start_date, end_date):
        if value is not None:
            try:
                if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
                    raise ValueError()
                date.fromisoformat(value)
            except ValueError as error:
                raise HTTPException(422, 'Date invalide, utiliser AAAA-MM-JJ.') from error
    if start_date and end_date and start_date > end_date:
        raise HTTPException(422, 'La date de début suit la date de fin.')
    return identifier, ticker.upper()


def movement_report(analysis_id, persona, ticker, start_date=None, end_date=None, threshold_pct=5, refresh=False):
    from .market_movement_evidence import build_movement_report

    analysis_id, ticker = _validate(analysis_id, persona, ticker, start_date, end_date, threshold_pct, refresh)
    # Always check the account through the research service, even for cached document reads.
    snapshot = research_snapshot(analysis_id, persona)
    if snapshot.get('analysis_id') != analysis_id:
        raise HTTPException(502, 'L’identité du dossier reçu est incohérente.')
    tickers = set()
    for proof in snapshot.get('evidence', []):
        content = _content(proof.get('content'))
        if isinstance(content.get('ticker'), str):
            tickers.add(content['ticker'].upper())
        if isinstance(content.get('tickers'), list):
            tickers.update(value.upper() for value in content['tickers'] if isinstance(value, str))
    if ticker not in tickers:
        raise HTTPException(422, 'Ce titre n’est pas confirmé par les preuves de cette analyse.')
    historical = simulation_history(ticker, start=None, end=None)
    policy, policy_available = None, False
    try:
        catalog = _call('GET', '/sources', persona)
        sources = catalog.get('sources')
        if not isinstance(sources, list):
            raise ValueError('Catalogue invalide.')
        policies = {item['id']: item for item in sources if isinstance(item, dict) and isinstance(item.get('id'), str)}
        allowed = {key for key, item in policies.items() if item.get('enabled') is True and item.get('trust_level') != 'blocked'}
        snapshot = {**snapshot, 'evidence': [proof for proof in snapshot.get('evidence', []) if proof.get('source_id') in allowed]}
        policy, policy_available = policies.get(_SOURCE_ID), True
    except (ValueError, OSError):
        pass
    report = build_movement_report(historical, snapshot, threshold_pct, start_date, end_date)
    if not report['movements']:
        collected = _collection('not_requested', 'Aucune variation au-dessus du seuil dans la période; aucune nouvelle lecture nécessaire.')
    elif ticker != 'NVDA':
        collected = _collection('unsupported', 'Aucun flux d’actualités validé n’est configuré pour ce titre dans ce lecteur. Seuls les documents déjà reçus sont rapprochés des cours.')
    elif not policy_available:
        collected = _collection('unavailable', 'Politique des sources indisponible : aucune nouvelle lecture externe. Le contexte utilise seulement les preuves déjà reçues.')
    elif not policy or policy.get('enabled') is not True or policy.get('trust_level') == 'blocked' or policy.get('automation_allowed', True) is not True:
        collected = _collection('disabled', 'La lecture automatique de cette source est désactivée par sa politique. Aucun communiqué supplémentaire n’a été lu.')
    elif not refresh and all(move['status'] == 'context_found' for move in report['movements']):
        collected = _collection('not_requested', 'Des documents lus sont déjà présents dans chaque intervalle. Ce rapprochement n’établit pas une causalité.')
    else:
        window = report['window']
        feed_window = {**window, 'start': min(window['start'], *(move['previousDate'] for move in report['movements']))}
        policy_digest = hashlib.sha256(json.dumps(policy, sort_keys=True, default=str).encode()).hexdigest()
        key = (persona, analysis_id, ticker, feed_window['start'], window['end'], policy_digest,
               tuple(move['date'] for move in report['movements']))
        now = time.monotonic()
        with _CACHE_LOCK:
            cached = _CACHE.get(key)
            if cached and now - cached[0] < _CACHE_TTL and not refresh:
                collected = {**cached[1], 'collection': {**cached[1]['collection'], 'cached': True}}
            else:
                collected = None
        if collected is None:
            existing_urls = {
                doc.get('url') for proof in snapshot.get('evidence', [])
                for doc in _content(proof.get('content')).get('documents', [])
                if isinstance(doc, dict) and isinstance(doc.get('excerpt'), str) and doc.get('characters_read', 0)
            }
            collected = _collect_registered_news(feed_window, report['movements'], existing_urls)
            if collected['collection']['status'] in {'complete', 'partial'}:
                with _CACHE_LOCK:
                    for stale in [item for item, value in _CACHE.items() if now - value[0] >= _CACHE_TTL]:
                        _CACHE.pop(stale, None)
                    while len(_CACHE) >= _CACHE_LIMIT:
                        _CACHE.pop(next(iter(_CACHE)))
                    _CACHE[key] = (time.monotonic(), collected)
        if collected['documents']:
            identity = hashlib.sha256(json.dumps(collected['documents'], sort_keys=True).encode()).hexdigest()[:24]
            additional = {'evidence_id': f'movement-read-{identity}', 'source_id': _SOURCE_ID,
                'source_name': _SOURCE_NAME, 'url': _FEED, 'method': 'authorized_official_http_read',
                'collected_at': collected['collection']['checkedAt'],
                'content': {'ticker': ticker, 'documents': collected['documents']}}
            report = build_movement_report(historical, {**snapshot, 'evidence': [*snapshot.get('evidence', []), additional]}, threshold_pct, start_date, end_date)
    return {**report, 'collection': collected['collection']}
