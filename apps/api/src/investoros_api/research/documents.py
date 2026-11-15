"""Bounded reads of registered primary documents; no model-supplied destinations."""
import re
import xml.etree.ElementTree as ET
from datetime import date
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_public(url: str, host: str) -> str:
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.hostname != host or parts.port not in {None, 443} or parts.username or parts.password:
        raise ValueError('Destination hors du contrat de source.')
    request = Request(url, headers={'User-Agent': 'InvestorOS/1.0 financial research (public primary documents)',
                                   'Accept': 'text/html,application/xml,application/json,text/plain'})
    with build_opener(NoRedirect()).open(request, timeout=18) as response:
        raw = response.read(3_000_001)
        if len(raw) > 3_000_000:
            raise ValueError('Document trop volumineux pour cette collecte.')
        return raw.decode('utf-8', errors='replace')


class PageText(HTMLParser):
    def __init__(self, article=False):
        super().__init__()
        self.skip = 0
        self.lines = []
        self.article, self.depth, self.body_depth = article, 0, None
    def handle_starttag(self, tag, attrs):
        if tag == 'div':
            self.depth += 1
            if 'module_body' in dict(attrs).get('class', '').split():
                self.body_depth = self.depth
        if tag in {'script', 'style', 'noscript'}:
            self.skip += 1
    def handle_endtag(self, tag):
        if tag == 'div':
            if self.depth == self.body_depth:
                self.body_depth = None
            self.depth = max(0, self.depth-1)
        if tag in {'script', 'style', 'noscript'}:
            self.skip = max(0, self.skip - 1)
    def handle_data(self, text):
        text = re.sub(r'\s+', ' ', text).strip()
        if text and not self.skip and (not self.article or self.body_depth is not None):
            self.lines.append(text)


def page_text(html: str, article=False) -> str:
    parser = PageText(article)
    parser.feed(html)
    return '\n'.join(parser.lines)


def excerpts(text: str, limit: int = 9000) -> str:
    # Read the whole bounded document before selecting useful passages.
    chunks = [text[:2500]]
    for match in list(re.finditer(r'risk factors|export control|outlook|guidance|chief executive|transition|resign|revenue|conference call', text, re.I))[:12]:
        chunks.append(text[max(0, match.start()-100):match.start()+650])
    return '\n[…]\n'.join(dict.fromkeys(chunks))[:limit]


class FedRows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack, self.rows, self.row = [], [], None
    def handle_starttag(self, tag, attrs):
        if tag == 'div':
            classes = dict(attrs).get('class', '').split()
            self.stack.append(classes)
            if 'panel-body' in classes:
                self.row = {'title': [], 'time': [], 'days': []}
    def handle_data(self, text):
        if self.row is None or not text.strip():
            return
        for classes in reversed(self.stack):
            field = 'title' if 'col-xs-7' in classes else 'time' if 'col-xs-2' in classes else 'days' if 'col-xs-3' in classes else None
            if field:
                self.row[field].append(text.strip())
                break
    def handle_endtag(self, tag):
        if tag == 'div' and self.stack:
            classes = self.stack.pop()
            if 'panel-body' in classes and self.row is not None:
                self.rows.append({key: ' '.join(value) for key, value in self.row.items()})
                self.row = None


def nvidia_documents(window: dict) -> dict:
    host = 'investor.nvidia.com'
    base = 'https://' + host
    calendar_url = base + '/rss/Event.aspx?LanguageId=1'
    news_url = base + '/rss/pressrelease.aspx?LanguageId=1'
    events = ET.fromstring(read_public(calendar_url, host))
    news = ET.fromstring(read_public(news_url, host))
    dated, documents, errors = [], [], []
    for item in events.findall('./channel/item')[:25]:
        title = item.findtext('title', '')
        match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', title)
        if not match:
            continue
        month, day, year = map(int, match.groups())
        event_date = date(year, month, day).isoformat()
        dated.append({'date': event_date, 'title': title, 'url': item.findtext('link', ''),
                      'published_at': item.findtext('pubDate', ''), 'date_basis': 'Date du titre du calendrier, pas pubDate.'})
    # Actual links from the official feed, including recent governance news and the scheduled call.
    items = news.findall('./channel/item')[:20]
    chosen = items[:2]
    call = next((item for item in items if re.search('conference call', item.findtext('title', ''), re.I)), None)
    if call is not None and call not in chosen:
        chosen.append(call)
    for item in chosen[:3]:
        url = item.findtext('link', '')
        if not urlsplit(url).path.startswith('/news/press-release-details/'):
            continue
        try:
            text = page_text(read_public(url, host), article=True)
            if not text:
                raise ValueError('Le corps du communiqué est absent.')
            documents.append({'url': url, 'title': item.findtext('title', ''),
                              'published_at': item.findtext('pubDate', ''), 'excerpt': excerpts(text),
                              'characters_read': len(text)})
            if re.search('conference call', item.findtext('title', ''), re.I):
                call = re.search(r'at\s+(\d{1,2})(?::(\d{2}))?\s+p\.m\.\s*PT', text, re.I)
                release = re.search(r'approximately\s+(\d{1,2})(?::(\d{2}))?\s+p\.m\.\s*PT', text, re.I)
                for event in dated:
                    event_day = date.fromisoformat(event['date'])
                    date_phrase = event_day.strftime('%B') + r'\s+' + str(event_day.day) + r'\b'
                    if not re.search(date_phrase, text, re.I):
                        continue
                    for match, key in [(call,'call_time_pt'),(release,'release_time_pt')]:
                        if match:
                            event[key] = f"{int(match[1])%12+12:02d}:{match[2] or '00'}"
        except Exception as error:
            errors.append({'url': url, 'reason': type(error).__name__})
    return {'calendar_checked': True, 'calendar_url': calendar_url, 'window': window,
            'dated_events': dated, 'documents': documents, 'document_errors': errors,
            'scope': 'Calendrier annoncé et extraits de communiqués effectivement lus; déclarations de l’émetteur, sans prévision.'}


MONTHS = {name.lower(): index for index, name in enumerate(
    ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']) if name}


def macro_calendar(source_id: str, window: dict, browser_read=None) -> tuple[str, dict]:
    start, end = date.fromisoformat(window['start']), date.fromisoformat(window['end'])
    pages, events = [], []
    months = sorted({(start.year, start.month), (end.year, end.month)})
    for year, month in months:
        url = (f'https://www.bls.gov/schedule/{year}/{month:02d}_sched_list.htm' if source_id == 'bls-calendar'
               else f'https://www.federalreserve.gov/newsevents/{year}-{list(MONTHS)[month-1]}.htm')
        try:
            html = read_public(url, urlsplit(url).hostname)
            text = page_text(html)
            method = 'official_http_read'
        except (OSError, ValueError):
            if browser_read is None:
                raise
            captured = browser_read(url, urlsplit(url).hostname)
            text, html = captured['text'], ''
            method = captured.get('method', 'agentcore_browser_playwright')
        pages.append({'url': url, 'excerpt': text[:16000], 'characters_read': len(text), 'method': method})
        if source_id == 'fed-calendar' and html:
            parser = FedRows()
            parser.feed(html)
            for row in parser.rows:
                if not re.fullmatch(r'\d{1,2}(?:,\s*\d{1,2})*', row['days']):
                    continue
                for day in map(int, re.findall(r'\d+', row['days'])):
                    dated = date(year, month, day).isoformat()
                    if window['start'] <= dated <= window['end']:
                        events.append({'date': dated, 'time': row['time'], 'title': row['title'], 'url': url})
            continue
        pattern = r'(' + '|'.join(MONTHS) + r')\s+(\d{1,2}),?\s+(20\d{2})'
        matches = list(re.finditer(pattern, text, re.I))
        for index, match in enumerate(matches):
            try:
                dated = date(int(match[3]), MONTHS[match[1].lower()], int(match[2])).isoformat()
            except ValueError:
                continue
            if window['start'] <= dated <= window['end']:
                stop = min(matches[index+1].start() if index+1 < len(matches) else match.end()+450, match.end()+450)
                title = text[match.end():stop].strip()
                title = re.sub(r'\n(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*$','',title)
                time=re.match(r'\d{1,2}:\d{2}\s*[AP]M',title,re.I)
                events.append({'date': dated, 'title': title[time.end():].strip() if time else title,
                               'time':time[0] if time else '', 'url': url})
    return pages[0]['url'], {'calendar_checked': True, 'window': window, 'dated_events': events[:25],
                              'documents': pages, 'timezone': 'America/New_York',
                              'scope': 'Calendrier officiel consulté; aucune causalité ni variation de cours prédite.'}


def sec_documents(index: dict, browser_read=None) -> dict:
    documents, errors = [], []
    filings = index.get('recent_filings', [])
    chosen = []
    for forms in ({'8-K'}, {'10-Q', '10-K', '20-F'}):
        item = next((f for f in filings if f.get('form') in forms and f.get('document_url')), None)
        if item:
            chosen.append(item)
    for filing in chosen:
        url = filing['document_url']
        if not re.fullmatch(r'/Archives/edgar/data/\d+/\d+/[\w.\-]+', urlsplit(url).path):
            continue
        try:
            try:
                text = page_text(read_public(url, 'www.sec.gov'))
                method = 'official_http_read'
            except (OSError, ValueError):
                if browser_read is None:
                    raise
                captured = browser_read(url, 'www.sec.gov')
                text = captured['text']
                method = captured.get('method', 'agentcore_browser_playwright')
            documents.append({**filing, 'url': url, 'excerpt': excerpts(text), 'characters_read': len(text), 'method': method})
        except Exception as error:
            errors.append({'url': url, 'reason': type(error).__name__})
    return {**index, 'documents': documents, 'document_errors': errors,
            'scope': 'Métadonnées des dépôts et passages effectivement lus dans documents; les erreurs de lecture restent explicites.'}
