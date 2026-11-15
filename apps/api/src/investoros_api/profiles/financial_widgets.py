"""Deterministic inline views of the server-selected fictional portfolio.

Optional attributed valuations use ``valuation_history`` (or ``history``):
``{currency, source, cash_flows: 'none'|'unknown', points: [{date, value}]}``.
A list of rows with explicit currency/source is also accepted. Missing tickers,
sectors, valuations, cash-flow declarations or FX are never inferred from labels.
"""

import calendar
import json
import math
import re
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import HTTPException

from investoros_api import simulation
from investoros_api.demo_contexts import PERSONAS, PersonaId
from .portfolio import load_demo_portfolio, summarize_portfolio


VIEWS = ('portfolio', 'heatmap', 'allocation', 'contributions', 'sectors')
PERIODS = ('1D', '1W', '1M', '1Y')
_TITLES = {'portfolio': 'Mon portefeuille', 'heatmap': 'Carte du portefeuille', 'allocation': 'Répartition du portefeuille',
           'contributions': 'Contributions à la variation', 'sectors': 'Exposition sectorielle'}


def widget_caption(widget: dict) -> str:
    """Keep display-only narration tied to the rendered values, including direction."""
    view = widget.get('view')
    period = widget.get('periods', {}).get(widget.get('period'), {})
    if view == 'allocation':
        return 'Sélectionnez une ligne pour examiner sa part du portefeuille.'
    if view == 'portfolio':
        if not period.get('points'):
            return 'La valeur et la répartition sont disponibles. L’historique nécessaire à cette période n’est pas fourni.'
        return 'La courbe montre la valeur du portefeuille sur la période sélectionnée. Sélectionnez une position pour voir son détail.'
    if view == 'heatmap':
        if not any(row.get('changePct') is not None for row in period.get('positions', [])):
            return 'La taille des tuiles indique les montants. Les variations restent indisponibles pour cette période.'
        return 'La taille des tuiles indique les montants, leur couleur la variation. Sélectionnez une tuile pour l’examiner.'
    if view == 'contributions':
        if not any(row.get('contributionPct') is not None for row in period.get('positions', [])):
            return 'Les gains et pertes par position ne sont pas calculables avec les historiques actuellement fournis.'
        return 'Les barres montrent l’apport de chaque position à la variation du portefeuille. Les gains apparaissent en vert, les pertes en rouge.'
    labels = {row['id']: row['label'] for row in widget.get('sectors', [])}
    measured = [row for row in period.get('sectors', []) if _number(row.get('changePct'))]
    if not measured:
        return 'Aucune variation sectorielle n’est disponible. Les secteurs manquants restent indiqués comme non renseignés.'
    losses = [labels.get(row['id'], 'Secteur') for row in measured if row['changePct'] < 0]
    gains = [labels.get(row['id'], 'Secteur') for row in measured if row['changePct'] > 0]
    parts = []
    if losses:
        parts.append('En baisse : ' + ', '.join(losses) + '.')
    if gains:
        parts.append('En hausse : ' + ', '.join(gains) + '.')
    if not parts:
        parts.append('Les secteurs couverts sont stables sur cette période.')
    if len(measured) < len(labels):
        parts.append('Les autres secteurs ne sont pas couverts.')
    return ' '.join(parts)


def _number(value) -> bool:
    return type(value) in {int, float} and math.isfinite(value)


def _day(value) -> date | None:
    try:
        if not isinstance(value, str):
            return None
        return datetime.fromisoformat(value.replace('Z', '+00:00')).date() if 'T' in value else date.fromisoformat(value)
    except ValueError:
        return None


def _valuation(owner: dict, currency: str, current_value: float, cap: date | None) -> tuple[dict | None, str | None]:
    history = owner.get('valuation_history', owner.get('history'))
    if history is None:
        return None, 'Aucun historique de valorisation attribué n’est fourni.'
    metadata = history if isinstance(history, dict) else {}
    rows = metadata.get('points') if metadata else history
    if not isinstance(rows, list) or not 2 <= len(rows) <= 10000:
        return None, 'L’historique de valorisation est incomplet ou trop volumineux.'
    values, sources = {}, set()
    for row in rows:
        if not isinstance(row, dict):
            return None, 'Une observation de valorisation est invalide.'
        observed, value = _day(row.get('date')), row.get('value')
        source = row.get('source', metadata.get('source', owner.get('history_source')))
        unit = row.get('currency', metadata.get('currency', owner.get('history_currency')))
        if not observed or not _number(value) or value < 0 or not isinstance(source, str) or not source.strip() or len(source) > 256:
            return None, 'Chaque valorisation exige une date, un montant fini et une source explicite.'
        if unit != currency:
            return None, 'Devise de valorisation absente ou différente; aucune conversion implicite.'
        if cap and observed > cap:
            continue
        if observed in values:
            return None, 'L’historique contient des dates de valorisation dupliquées.'
        values[observed] = float(value)
        sources.add(source.strip())
    if len(values) < 2:
        return None, 'Moins de deux valorisations sont disponibles à la date du portefeuille.'
    if not math.isclose(values[max(values)], current_value, rel_tol=.005, abs_tol=.01):
        return None, 'La dernière valorisation ne correspond pas à la valeur déclarée de la position ou du portefeuille.'
    return {'values': values, 'source': ' · '.join(sorted(sources)),
            'noFlows': metadata.get('cash_flows', owner.get('history_cash_flows')) == 'none'}, None


def _price_history(ticker: str, currency: str, cap: date | None) -> tuple[dict | None, str | None]:
    try:
        historical = simulation.history(ticker, start=None, end=cap)
    except (HTTPException, ValueError, OSError):
        return None, 'Le titre explicite ne dispose pas d’un historique configuré exploitable.'
    if historical.get('currency') != currency:
        return None, 'La devise des prix diffère de celle du portefeuille; aucun rendement en devise convertie n’est calculé.'
    classification = historical.get('sourceClassification')
    source = historical.get('source')
    if classification not in {'observations', 'illustrative'} or not isinstance(source, str) or not source or len(source) > 256:
        return None, 'La provenance du paquet de prix n’est pas suffisamment documentée.'
    values = {}
    for point in historical.get('prices', []):
        if not isinstance(point, dict):
            return None, 'Historique de prix invalide.'
        observed, value = _day(point.get('date')), point.get('adjustedClose')
        if not observed or not _number(value) or value <= 0 or observed in values:
            return None, 'Historique de prix invalide ou dupliqué.'
        if not cap or observed <= cap:
            values[observed] = float(value)
    if len(values) < 2:
        return None, 'Moins de deux cours ajustés sont disponibles.'
    return {'values': values, 'source': source, 'classification': classification,
            'sourceUrl': historical.get('sourceUrl'), 'noFlows': False}, None


def _window(series: dict, period: str, end: date) -> list[tuple[date, float]]:
    days = sorted(day for day in series['values'] if day <= end)
    if len(days) < 2:
        return []
    observed_end = days[-1]
    if period == '1D':
        start = days[-2]
    else:
        if period == '1W':
            cutoff = observed_end - timedelta(days=7)
        else:
            year, month = (observed_end.year - 1, observed_end.month) if period == '1Y' else (
                observed_end.year - (observed_end.month == 1), 12 if observed_end.month == 1 else observed_end.month - 1)
            cutoff = date(year, month, min(observed_end.day, calendar.monthrange(year, month)[1]))
        preceding = [day for day in days if day <= cutoff]
        if not preceding:
            return []
        start = preceding[-1]
    return [(day, series['values'][day]) for day in days if day >= start]


def _bucket(identifier: str, label: str, positions: list[dict]) -> dict:
    return {'id': identifier, 'label': label, 'value': round(sum(item['value'] for item in positions), 2),
            'weightPct': round(sum(item['weightPct'] for item in positions), 4)}


def render_portfolio_widget(persona: PersonaId, view: str = 'portfolio', period: str = '1M') -> dict[str, Any]:
    """Load one configured persona and return every selectable period in one read."""
    if persona not in PERSONAS or view not in VIEWS or period not in PERIODS:
        raise ValueError('Compte, vue ou période de portefeuille non pris en charge.')
    portfolio = load_demo_portfolio(persona=persona)
    summary = summarize_portfolio(portfolio)
    currency = summary['currency']
    if not isinstance(currency, str) or not re.fullmatch(r'[A-Z]{3}', currency):
        raise ValueError('La devise du portefeuille doit être explicite.')
    raw_positions = portfolio['positions']
    if len(raw_positions) > 100:
        raise ValueError('Le portefeuille dépasse le nombre de positions pris en charge par ce widget.')
    cap = _day(portfolio.get('as_of'))
    if len(str(summary['portfolioName'])) > 160 or len(str(summary['asOf'])) > 80:
        raise ValueError('Les métadonnées du portefeuille sont trop longues.')
    positions, valuations, prices, reasons, provenance_sources = [], {}, {}, {}, []
    seen = set()
    quote_cache = {}
    for index, raw in enumerate(raw_positions):
        identifier = raw.get('id') or f'position-{index + 1}'
        if not isinstance(identifier, str) or len(identifier) > 80 or identifier in seen:
            raise ValueError('Les identifiants de positions doivent être uniques.')
        seen.add(identifier)
        if abs(raw['weight_pct'] - raw['value'] / summary['totalValue'] * 100) > .5:
            raise ValueError('Les pondérations ne correspondent pas aux valeurs déclarées.')
        if len(raw['label']) > 160 or len(str(raw.get('sector') or '')) > 100:
            raise ValueError('Le libellé ou secteur de la position est trop long.')
        declared = raw.get('ticker') or raw.get('symbol')
        ticker = declared.strip().upper() if isinstance(declared, str) and re.fullmatch(r'[A-Za-z0-9.^=-]{1,16}', declared.strip()) else None
        sector = raw.get('sector')
        sector = sector.strip() if isinstance(sector, str) and sector.strip() else None
        position = {'id': identifier, 'label': raw['label'], 'ticker': ticker, 'sector': sector,
                    'value': float(raw['value']), 'weightPct': float(raw['weight_pct'])}
        positions.append(position)
        valuations[identifier], reasons[identifier] = _valuation(raw, currency, position['value'], cap)
        if valuations[identifier]:
            provenance_sources.append(valuations[identifier]['source'])
        if ticker and not valuations[identifier]:
            if ticker not in quote_cache:
                quote_cache[ticker] = _price_history(ticker, currency, cap)
            prices[identifier], reason = quote_cache[ticker]
            if reason:
                reasons[identifier] = reason
            if prices[identifier]:
                provenance_sources.append(prices[identifier]['source'])
        elif not ticker and not valuations[identifier]:
            reasons[identifier] = 'La position ne déclare aucun ticker ni historique de valorisation; son libellé ne définit pas ses titres sous-jacents.'
    portfolio_history, portfolio_reason = _valuation(portfolio, currency, summary['totalValue'], cap)
    if not portfolio_history and all(valuations.values()):
        common = set.intersection(*(set(series['values']) for series in valuations.values()))
        if len(common) >= 2 and all(max(series['values']) == max(common) for series in valuations.values()):
            portfolio_history = {'values': {day: sum(series['values'][day] for series in valuations.values()) for day in common},
                                 'source': 'Somme des valorisations attribuées de toutes les positions, sur dates communes.',
                                 'noFlows': all(series['noFlows'] for series in valuations.values())}
    if portfolio_history:
        provenance_sources.append(portfolio_history['source'])
    grouped = {}
    for position in positions:
        grouped.setdefault(position['sector'] or 'Non renseigné', []).append(position)
    sectors = [_bucket(f'sector-{index + 1}', label, members) for index, (label, members) in enumerate(grouped.items())]
    all_series = ([portfolio_history] if portfolio_history else []) + [series for series in [*valuations.values(), *prices.values()] if series]
    anchor = min(max(series['values']) for series in all_series) if all_series else None
    limitations = [
        'Portefeuille fictif configuré côté serveur; aucune transaction ni connexion à un courtier.',
        'Les catégories sans ticker explicite ne sont jamais remplacées par des titres supposés; aucune composition interne de FNB n’est inférée.',
        '1D compare les deux dernières clôtures disponibles, sans donnée intrajournalière. 1W, 1M et 1Y sont des horizons calendaires terminant à la dernière observation commune couverte.',
        'Une variation de cours ajusté n’est ni un gain monétaire de position ni une contribution au portefeuille. Les cours ajustés peuvent incorporer des distributions selon le fournisseur; aucun dividende n’est ajouté une seconde fois.',
        'Une variation de valorisation non corrigée des flux n’est pas un rendement de placement. Les contributions exigent des valorisations sur les mêmes dates et une absence de flux explicitement déclarée.',
    ]
    if any(position['sector'] is None for position in positions):
        limitations.append('La poche « Non renseigné » regroupe les positions sans secteur explicite; leur exposition sectorielle réelle reste inconnue.')
    periods = {}
    for selected_period in PERIODS:
        total_points = _window(portfolio_history, selected_period, anchor) if portfolio_history and anchor else []
        start = total_points[0][0] if total_points else None
        end = total_points[-1][0] if total_points else anchor
        base = total_points[0][1] if total_points else None
        entry = {'status': 'unavailable', 'reason': portfolio_reason or 'Historique insuffisant pour cet horizon.',
                 'start': start.isoformat() if start else None, 'end': end.isoformat() if end else None,
                 'points': [{'date': day.isoformat(), 'value': round(value, 2)} for day, value in total_points],
                 'changeValue': round(total_points[-1][1] - base, 2) if total_points else None,
                 'changePct': round((total_points[-1][1] / base - 1) * 100, 4) if base else None,
                 'changeBasis': 'valuation_history' if total_points else 'unavailable',
                 'cashFlowsKnownAbsent': bool(portfolio_history and portfolio_history['noFlows']),
                 'positions': [], 'sectors': []}
        reconciled = True
        if total_points and all(valuations.values()):
            for day, value in total_points:
                if any(day not in series['values'] for series in valuations.values()) or not math.isclose(
                        sum(series['values'][day] for series in valuations.values()), value, rel_tol=1e-6, abs_tol=.01):
                    reconciled = False
                    break
        entry['valuationsReconciled'] = reconciled if total_points and all(valuations.values()) else None
        for position in positions:
            identifier = position['id']
            series = valuations.get(identifier) or prices.get(identifier)
            window = _window(series, selected_period, end) if series and end else []
            item = {'id': identifier, 'changePct': None, 'changeValue': None, 'contributionPct': None,
                    'changeBasis': 'unavailable', 'reason': reasons.get(identifier), 'source': series['source'] if series else None}
            if window:
                before, after = window[0][1], window[-1][1]
                item.update(changePct=round((after / before - 1) * 100, 4) if before else None,
                            changeBasis='valuation_history' if valuations[identifier] else 'adjusted_price_history', reason=None,
                            start=window[0][0].isoformat(), end=window[-1][0].isoformat())
                if valuations[identifier]:
                    item['changeValue'] = round(after - before, 2)
                    if base and reconciled and start == window[0][0] and end == window[-1][0] and portfolio_history['noFlows'] and series['noFlows']:
                        item.update(contributionPct=round((after - before) / base * 100, 4),
                                    startValue=before, endValue=after, startWeightPct=round(before / base * 100, 4))
                    elif not reconciled:
                        item['reason'] = 'Les valorisations des positions ne se rapprochent pas du total déclaré sur les dates de la période.'
            elif series:
                item['reason'] = 'Historique insuffisant pour couvrir cet horizon sans extrapolation.'
            entry['positions'].append(item)
        for sector in sectors:
            members = [item for item in entry['positions'] if any(position['id'] == item['id'] and (position['sector'] or 'Non renseigné') == sector['label'] for position in positions)]
            valid = all(item.get('contributionPct') is not None for item in members)
            before = sum(item.get('startValue', 0) for item in members)
            after = sum(item.get('endValue', 0) for item in members)
            entry['sectors'].append({'id': sector['id'], 'changeValue': round(after - before, 2) if valid else None,
                                     'changePct': round((after / before - 1) * 100, 4) if valid and before else None})
        measured = sum(item['changePct'] is not None for item in entry['positions'])
        contributions = sum(item['contributionPct'] is not None for item in entry['positions'])
        if view == 'allocation':
            entry.update(status='ready', reason=None)
        elif view == 'portfolio':
            entry.update(status='ready' if total_points else 'partial', reason=None if total_points else entry['reason'])
        elif view == 'heatmap':
            entry.update(status='ready' if measured == len(positions) else 'partial' if measured else 'unavailable',
                         reason=None if measured == len(positions) else 'La variation n’est pas couverte pour toutes les positions; leurs poids restent disponibles.')
        elif view == 'contributions':
            entry.update(status='ready' if contributions == len(positions) else 'partial' if contributions else 'unavailable',
                         reason=None if contributions == len(positions) else 'Contributions indisponibles sans valorisations rapprochables et absence de flux déclarée.')
        else:
            known = all(position['sector'] for position in positions)
            variations = all(item['changePct'] is not None for item in entry['sectors'])
            entry.update(status='ready' if known and variations else 'partial',
                         reason=None if known and variations else 'Exposition déclarée disponible; variations sectorielles non entièrement couvertes.' if known else 'Les secteurs non déclarés ne sont pas inférés.')
        periods[selected_period] = entry
    result = {'kind': 'portfolio_widget', 'schemaVersion': 1, 'view': view, 'period': period,
            'title': _TITLES[view], 'portfolioName': summary['portfolioName'], 'persona': persona,
            'currency': currency, 'asOf': summary['asOf'], 'status': periods[period]['status'],
            'totalValue': summary['totalValue'], 'positions': positions, 'sectors': sectors, 'periods': periods,
            'provenance': {'source': str(portfolio.get('source') or summary['provenance']['source'])[:200], 'classification': portfolio.get('data_source', 'fictional_portfolio'),
                           'historySources': list(dict.fromkeys(provenance_sources)),
                           'method': 'Valeurs et poids déclarés du portefeuille; historiques attribués seulement. Contributions = variation monétaire de position / valeur totale au début, sans flux déclarés.',
                           'limitations': limitations}, 'limitations': limitations}
    if len(json.dumps(result, ensure_ascii=False).encode('utf-8')) > 120000:
        raise ValueError('Le widget dépasse la taille maximale; aucune série tronquée n’est retournée.')
    return result
