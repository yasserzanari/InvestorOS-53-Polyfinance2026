"""Select reported annual SEC XBRL facts, with their units and filing provenance."""
from datetime import date

CONCEPTS = (
    ('revenue', 'Revenus', ('RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet')),
    ('net_income', 'Résultat net', ('NetIncomeLoss',)),
    ('assets', 'Actifs', ('Assets',)),
)
ALIASES = {'RevenueFromContractWithCustomerExcludingAssessedTax': 'modern_revenue', 'Revenues': 'legacy_revenue',
           'SalesRevenueNet': 'sales_revenue', 'NetIncomeLoss': 'net_income', 'Assets': 'assets'}


def financial_snapshot(payload: dict) -> dict:
    taxonomy = payload.get('facts', {}).get('us-gaap', {})
    result, quarterly = [], []
    for metric, label, names in CONCEPTS:
        candidates, quarter_candidates = [], []
        for name in names:
            concept = taxonomy.get(name) or payload.get(ALIASES[name]) or {}
            if not isinstance(concept, dict):
                continue
            for unit, rows in concept.get('units', {}).items():
                if unit != 'USD' or not isinstance(rows, list):
                    continue
                for row in rows:
                    if isinstance(row, dict) and row.get('form') in {'10-Q', '10-Q/A'} and all(row.get(k) for k in ('end', 'filed', 'accn')) and type(row.get('val')) in {int, float}:
                        try:
                            duration = (date.fromisoformat(row['end']) - date.fromisoformat(row['start'])).days if row.get('start') else None
                        except (ValueError, TypeError):
                            duration = -1
                        if (metric == 'assets' and duration is None) or (metric != 'assets' and duration is not None and 60 <= duration <= 120):
                            quarter_candidates.append({**row, 'concept': name, 'unit': unit})
                    if not isinstance(row, dict) or row.get('form') not in {'10-K', '10-K/A'} or row.get('fp') != 'FY':
                        continue
                    if not all(row.get(key) for key in ('end', 'filed', 'accn')) or type(row.get('val')) not in {int, float}:
                        continue
                    if metric != 'assets':
                        try:
                            duration = (date.fromisoformat(row['end']) - date.fromisoformat(row['start'])).days
                        except (KeyError, ValueError, TypeError):
                            continue
                        if not 300 <= duration <= 400:
                            continue
                    elif row.get('start'):
                        continue
                    candidates.append({**row, 'concept': name, 'unit': unit})
        if candidates:
            chosen = max(candidates, key=lambda row: (row['end'], row['filed'], row.get('form') == '10-K/A'))
            result.append({'metric': metric, 'label': label, 'value': chosen['val'], 'unit': chosen['unit'],
                           'period_start': chosen.get('start'), 'period_end': chosen['end'], 'filed': chosen['filed'],
                           'form': chosen['form'], 'accession': chosen['accn'], 'concept': chosen['concept']})
        if quarter_candidates:
            chosen = max(quarter_candidates, key=lambda row: (row['end'], row['filed'], row.get('form') == '10-Q/A'))
            quarterly.append({'metric': metric, 'label': label, 'value': chosen['val'], 'unit': chosen['unit'],
                              'period_start': chosen.get('start'), 'period_end': chosen['end'], 'filed': chosen['filed'],
                              'form': chosen['form'], 'accession': chosen['accn'], 'concept': chosen['concept']})
    return {'cik': payload.get('cik'), 'entity': payload.get('entityName'), 'annual_financials': result,
            'quarterly_financials': quarterly,
            'scope': 'Faits annuels et trimestriels US-GAAP publiés, en USD. Chaque mesure conserve sa période et son dépôt. Aucun chiffre futur ni calcul TTM.',
            'limits': 'Standard entity-wide concepts only. Custom tags, notes, restatements and financial-statement context require further document review.'}


def financial_claims(evidence: dict) -> list[dict]:
    import json
    content = evidence.get('content')
    for _ in range(5):
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
    return [{'text': f"{row['label']} déclaré : {row['value']:,} {row['unit']} · période se terminant le {row['period_end']} · {row['form']} déposé le {row['filed']} · accession {row['accession']}.",
             'claim_type': 'issuer_financials', 'evidence_ids': [evidence['evidence_id']], 'confidence': 'supported',
             'reported_fact': row} for row in content.get('annual_financials', []) + content.get('quarterly_financials', [])]
