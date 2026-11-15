"""Bound source payloads without losing dates or misrepresenting HTTP failures."""

import json
from urllib.parse import parse_qs, urlparse
from investoros_api.research.financials import financial_snapshot
from investoros_api.research.social import normalize_oembed
from investoros_api.research.macro import bank_of_canada_snapshot, fred_snapshot


def compact_source_payload(payload, url: str):
    """Reduce SEC arrays together, preserving each filing's matching fields."""
    parsed = urlparse(url)
    if parsed.hostname == 'publish.x.com' and parsed.path == '/oembed':
        requested = parse_qs(parsed.query).get('url', [''])[0]
        for _ in range(4):
            if isinstance(payload, str):
                payload = json.loads(payload)
            elif isinstance(payload, dict) and payload.get('kind') != 'x_oembed' and 'text' in payload:
                payload = payload['text']
            else:
                break
        if not isinstance(payload, dict):
            raise ValueError('La publication X ne contient pas un objet oEmbed exploitable.')
        return normalize_oembed(payload, requested)
    if '/api/xbrl/companyfacts/' in url and isinstance(payload, dict) and 'annual_financials' not in payload and ('facts' in payload or 'net_income' in payload):
        return financial_snapshot(payload)
    if parsed.hostname == 'www.bankofcanada.ca' and '/valet/observations/' in parsed.path:
        return bank_of_canada_snapshot(payload, parsed.path.split('/observations/', 1)[1].split('/')[0])
    if parsed.hostname == 'fred.stlouisfed.org' and parsed.path == '/graph/fredgraph.csv':
        return fred_snapshot(payload, parse_qs(parsed.query).get('id', [''])[0])
    if "data.sec.gov/submissions/CIK" not in url or not isinstance(payload, dict):
        return payload
    if not isinstance(payload.get("filings"), dict) or "recent" not in payload["filings"]:
        return payload
    recent = payload.get("filings", {}).get("recent", {})
    if not isinstance(recent, dict):
        return payload
    keys = ("accessionNumber", "filingDate", "reportDate", "acceptanceDateTime", "form", "primaryDocument")
    forms = recent.get("form", [])
    if not isinstance(forms, list):
        return payload
    filings = []
    for index, form in enumerate(forms):
        if form not in {"10-K", "10-Q", "8-K", "20-F", "6-K"}:
            continue
        row = {key: recent[key][index] for key in keys
               if isinstance(recent.get(key), list) and index < len(recent[key])}
        accession = str(row.get("accessionNumber", "")).replace("-", "")
        document = str(row.get("primaryDocument", ""))
        cik = str(payload.get("cik", "")).lstrip("0")
        if cik.isdigit() and accession.isdigit() and document and "/" not in document:
            row["document_url"] = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{document}"
        filings.append(row)
        if len(filings) >= 12:
            break
    return {
        **{key: payload.get(key) for key in ("cik", "name", "tickers", "exchanges", "category", "fiscalYearEnd")},
        "recent_filings": filings,
        "scope": "Index of filing metadata; filing document contents have not been read.",
    }


def browser_text_payload(text: str, url: str) -> str:
    try:
        payload = json.loads(text)
    except (ValueError, TypeError):
        if urlparse(url).hostname == 'publish.x.com':
            raise ValueError('La source X n’a pas renvoyé un post oEmbed JSON exploitable.')
        return text[:12000]
    return json.dumps(compact_source_payload(payload, url), ensure_ascii=False)[:12000]


def sec_filing_claims(evidence: dict) -> list[dict]:
    """Render filing facts from source fields instead of asking a model to copy dates."""
    content = evidence.get('content')
    for _ in range(3):
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except ValueError:
                return []
        elif isinstance(content, dict) and 'text' in content:
            content = content['text']
        else:
            break
    if not isinstance(content, dict):
        return []
    claims = []
    for filing in content.get('recent_filings', [])[:12]:
        if not all(filing.get(key) for key in ('form', 'filingDate', 'accessionNumber')):
            continue
        claims.append({
            'text': f"Dépôt {filing['form']} du {filing['filingDate']} · accession {filing['accessionNumber']}.",
            'claim_type': 'filing', 'evidence_ids': [evidence['evidence_id']],
            'confidence': 'supported', 'url': filing.get('document_url'),
        })
    return claims
