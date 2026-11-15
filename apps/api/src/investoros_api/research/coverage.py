"""Resolve relative horizons and audit collected coverage independently of the model."""
import json
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def research_window(question: str, now: datetime | None = None) -> dict | None:
    if not re.search(r"semaine\s+(?:prochaine|suivante)|next\s+week", question, re.I):
        return None
    instant = now or datetime.now(timezone.utc)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    today = instant.astimezone(ZoneInfo('America/New_York')).date()
    start = today + timedelta(days=7 - today.weekday())
    return {'start': start.isoformat(), 'end': (start + timedelta(days=6)).isoformat(),
            'trading_end': (start + timedelta(days=4)).isoformat(), 'timezone': 'America/New_York',
            'resolved_at': today.isoformat(), 'rule': 'Prochaine semaine civile, du lundi au dimanche.'}


def evidence_content(item: dict) -> dict:
    content = item.get('content', {})
    for _ in range(5):
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (ValueError, TypeError):
                return {}
        elif isinstance(content, dict) and isinstance(content.get('text'), str):
            content = content['text']
        else:
            break
    return content if isinstance(content, dict) else {}


def audit_coverage(question: str, evidence: list[dict], claims: list[dict], *, synthesis_ok: bool, sections: list[dict] | None = None) -> dict:
    window = research_window(question)
    checks = []
    def check(identifier, label, items, satisfied=None):
        checks.append({'id': identifier, 'label': label,
                       'status': 'covered' if (bool(items) if satisfied is None else satisfied) else 'missing',
                       'evidence_ids': [item['evidence_id'] for item in items]})
    if window:
        calendars = [e for e in evidence if evidence_content(e).get('calendar_checked')]
        issuer = [e for e in calendars if e.get('source_id') == 'nvidia-investor-relations']
        macro = [e for e in calendars if e.get('source_id') in {'bls-calendar', 'fed-calendar'}]
        check('issuer-calendar', 'Calendrier officiel de l’entreprise consulté', issuer)
        check('macro-calendar', 'Calendrier macroéconomique officiel consulté', macro)
        dated = [e for e in calendars if any(window['start'] <= event.get('date', '') <= window['end']
                 for event in evidence_content(e).get('dated_events', []))]
        check('dated-catalysts', 'Événements datés dans la semaine demandée', dated)
        documents = [e for e in evidence if evidence_content(e).get('documents')]
        check('documents', 'Contenu des annonces ou rapports effectivement lu', documents)
        financials = [e for e in evidence if e.get('source_id') == 'sec-companyfacts' and
                      (evidence_content(e).get('annual_financials') or evidence_content(e).get('quarterly_financials'))]
        check('fundamentals', 'Fondamentaux publiés avec période et unité', financials)
        risk_claims = [c for c in claims if c.get('confidence') != 'unverified'
                       and re.search(r'risqu|risk|incertitude|volatilit', c.get('text', ''), re.I)]
        valid = {item['evidence_id'] for item in evidence}
        risk_sections = [s for s in sections or [] if re.search(r'risqu|surveill|vigilance',s.get('title',''),re.I)
                         and re.search(r'peut|peuvent|pourrait|susceptible|potentiel|condition',s.get('text',''),re.I)
                         and len(s.get('text','')) >= 80 and valid.intersection(s.get('evidence_ids',[]))]
        supporting = [item for item in evidence if any(item['evidence_id'] in s['evidence_ids'] for s in risk_sections)]
        check('risks', 'Risques conditionnels explicités et reliés aux preuves', supporting, bool(risk_sections))
    check('synthesis', 'Synthèse structurée et référencée disponible', [], synthesis_ok and bool(claims))
    missing = [item['label'] for item in checks if item['status'] == 'missing']
    return {'status': 'sufficient' if not missing else 'partial', 'window': window,
            'checks': checks, 'missing': missing,
            'scope': 'Contrôle de couverture des preuves collectées, pas garantie de vérité ni de performance.'}
