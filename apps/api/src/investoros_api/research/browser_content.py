"""Read browser page bodies and source downloads through the same remote session."""

import json
from urllib.parse import parse_qs, urlparse
from typing import Callable

from investoros_api.research.extract import browser_text_payload
from investoros_api.research.macro import fred_snapshot


def read_browser_content(page, url: str, allowed: Callable[[str, str], bool]) -> dict:
    if urlparse(url).hostname == 'publish.x.com' and urlparse(url).path == '/oembed':
        response = page.goto('https://publish.x.com/', wait_until='domcontentloaded', timeout=35_000)
        if not allowed(page.url, 'GET') or response is None or not 200 <= response.status < 300:
            raise ValueError('La page officielle d’intégration X est inaccessible.')
        text = page.evaluate("""async url => {
            const response = await fetch(url);
            if (!response.ok) throw new Error('X oEmbed HTTP ' + response.status);
            return await response.text();
        }""", url)
        if len(text.encode('utf-8')) > 100_000:
            raise ValueError('La publication X dépasse la taille autorisée.')
        return {'title': 'X · publication publique oEmbed', 'text': browser_text_payload(text, url),
                'url': url, 'status_code': 200, 'method': 'agentcore_browser_download'}
    if '/valet/observations/' in url:
        response = page.goto('https://www.bankofcanada.ca/valet/', wait_until='domcontentloaded', timeout=35_000)
        if not allowed(page.url, 'GET') or response is None or not 200 <= response.status < 300:
            raise ValueError('La page des séries de la Banque du Canada est inaccessible.')
        text = page.evaluate("""async url => {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Banque du Canada HTTP ' + response.status);
            return await response.text();
        }""", url)
        if len(text.encode('utf-8')) > 5_000_000:
            raise ValueError('La série de change dépasse la taille autorisée.')
        return {'title': 'Banque du Canada · observations', 'text': browser_text_payload(text, url),
                'url': url, 'status_code': 200, 'method': 'agentcore_browser_download'}
    if '/graph/fredgraph.csv?' in url:
        series = parse_qs(urlparse(url).query).get('id', [''])[0]
        if not series or not series.replace('_', '').isalnum():
            raise ValueError('Identifiant de série FRED invalide.')
        # CDP-managed browser downloads have remote paths. Read the CSV with
        # fetch in the actual browser page instead of copying a remote file.
        landing = f'https://fred.stlouisfed.org/series/{series}'
        response = page.goto(landing, wait_until='domcontentloaded', timeout=35_000)
        if not allowed(page.url, 'GET') or response is None or not 200 <= response.status < 300:
            raise ValueError('La page de la série FRED est inaccessible.')
        text = page.evaluate("""async url => {
            const response = await fetch(url);
            if (!response.ok) throw new Error('FRED HTTP ' + response.status);
            return await response.text();
        }""", url)
        if len(text.encode('utf-8')) > 5_000_000:
            raise ValueError('Le téléchargement FRED dépasse la taille autorisée.')
        content = fred_snapshot(text, series)
        return {'title': f'Série FRED · {series}', 'text': json.dumps(content, ensure_ascii=False),
                'url': url, 'status_code': 200, 'method': 'agentcore_browser_download'}
    response = page.goto(url, wait_until='domcontentloaded', timeout=35_000)
    if not allowed(page.url, 'GET'):
        raise ValueError('La page a redirigé hors du domaine autorisé.')
    if response is None or not 200 <= response.status < 300:
        raise ValueError(f"La source a répondu HTTP {response.status if response else 'inconnu'}; aucune preuve utilisable.")
    links = page.locator('a[href]').evaluate_all("""anchors => anchors.map(a => a.href).filter(href => {
        try { const u = new URL(href); return u.protocol === 'https:' && ['x.com','www.x.com','twitter.com','www.twitter.com'].includes(u.hostname); }
        catch { return false; }
    }).slice(0, 100)""") if urlparse(url).hostname in {'help.openai.com', 'www.whitehouse.gov', 'trumpwhitehouse.archives.gov'} else []
    return {'title': page.title()[:300], 'links': links,
            'text': browser_text_payload(page.locator('body').inner_text(timeout=8_000), page.url),
            'url': page.url, 'status_code': response.status, 'method': 'agentcore_browser_playwright'}
