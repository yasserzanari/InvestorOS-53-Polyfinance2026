"""Validate dated macro observations without guessing units or exchange conventions."""

import csv
import io
import json
import math
import re
from datetime import date


def _body(payload):
    for _ in range(4):
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except ValueError:
                return payload
        elif isinstance(payload, dict) and "text" in payload and "observations" not in payload:
            payload = payload["text"]
        else:
            break
    return payload


def _day(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Date d’observation invalide.")
    date.fromisoformat(value)
    return value


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError("Valeur d’observation invalide.")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Valeur d’observation non finie.")
    return number


def bank_of_canada_snapshot(payload, series: str):
    if not re.fullmatch(r"FX[A-Z]{6}", series):
        raise ValueError("Identifiant de série de change invalide.")
    payload = _body(payload)
    if not isinstance(payload, dict):
        raise ValueError("La série de change n’est pas un objet JSON.")
    details = payload.get("seriesDetail")
    rows = payload.get("observations")
    if not isinstance(details, dict) or set(details) != {series} or not isinstance(details[series], dict):
        raise ValueError("Les métadonnées ne correspondent pas à la série demandée.")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Aucune observation de change disponible.")
    seen = set()
    normalized = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"d", series} or not isinstance(row[series], dict):
            raise ValueError("Une observation appartient à une autre série.")
        day = _day(row.get("d"))
        if day in seen:
            raise ValueError("Date de change dupliquée.")
        seen.add(day)
        raw = row[series].get("v")
        if _number(raw) <= 0:
            raise ValueError("Le taux de change doit être strictement positif.")
        normalized.append({"d": day, series: {"v": raw}})
    normalized.sort(key=lambda row: row["d"])
    return {"kind": "bank_of_canada_observations", "series_id": series,
            **{key: payload[key] for key in ("terms", "seriesDetail") if key in payload},
            "observations": normalized[-24:],
            "total_observations": max(len(rows), int(payload.get("total_observations", len(rows)))),
            "scope": "24 dernières observations au maximum; moyenne quotidienne publiée, pas une cotation en temps réel."}


def fred_snapshot(payload, series: str):
    if not re.fullmatch(r"[A-Z0-9_]{2,24}", series):
        raise ValueError("Identifiant de série FRED invalide.")
    payload = _body(payload)
    if isinstance(payload, str):
        reader = csv.DictReader(io.StringIO(payload.lstrip("\ufeff")))
        rows = list(reader)
        columns = reader.fieldnames
        total = len(rows)
    elif isinstance(payload, dict):
        rows, columns = payload.get("observations"), payload.get("columns")
        total = payload.get("total_observations", len(rows) if isinstance(rows, list) else 0)
    else:
        raise ValueError("La source FRED ne contient pas une série tabulaire.")
    if (not isinstance(columns, list) or len(columns) != 2
            or columns[0].lower() not in {"date", "observation_date"} or columns[1] != series):
        raise ValueError("Les colonnes FRED ne correspondent pas à la série demandée.")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Aucune observation FRED disponible.")
    seen, normalized = set(), []
    for row in rows:
        if not isinstance(row, dict) or set(row) != set(columns):
            raise ValueError("Ligne FRED invalide.")
        day = _day(row.get(columns[0]))
        if day in seen:
            raise ValueError("Date FRED dupliquée.")
        seen.add(day)
        raw = row[series]
        if raw not in (".", "", None):
            _number(raw)
        normalized.append({columns[0]: day, series: raw})
    normalized.sort(key=lambda row: row[columns[0]])
    return {"kind": "fred_observations", "series_id": series, "columns": columns,
            "observations": normalized[-24:], "total_observations": max(len(rows), int(total)),
            "scope": "24 dernières lignes au maximum; valeurs manquantes conservées. Unités et origine à vérifier dans la fiche FRED; données révisables."}


def macro_claims(evidence: dict) -> list[dict]:
    content = _body(evidence.get('content'))
    if not isinstance(content, dict) or not evidence.get('evidence_id'):
        return []
    series = content.get('series_id', '')
    if evidence.get('source_id') == 'bank-of-canada':
        snapshot = bank_of_canada_snapshot(content, series)
        row = snapshot['observations'][-1]
        unit = snapshot['seriesDetail'][series].get('metadata', {}).get('unit')
        value = row[series]['v']
        text = f"{series} : dernière observation conservée du {row['d']}, valeur publiée {value}."
        text += f" Unité publiée : {unit}." if isinstance(unit, str) and unit else " Unité absente des métadonnées conservées."
        text += " Moyenne quotidienne publiée, pas une cotation en temps réel."
        return [{'text': text, 'claim_type': 'foreign_exchange', 'confidence': 'supported',
                 'evidence_ids': [evidence['evidence_id']],
                 'reported_fact': {'series_id': series, 'observation_date': row['d'], 'value': value, 'unit': unit}}]
    if evidence.get('source_id') != 'fred':
        return []
    snapshot = fred_snapshot(content, series)
    rows = snapshot['observations']
    numeric = [row for row in rows if row[series] not in ('.', '', None)]
    missing = len(rows) - len(numeric)
    column = snapshot['columns'][0]
    if numeric:
        latest = numeric[-1]
        text = f"{series} : dernière valeur numérique parmi les {len(rows)} lignes conservées : {latest[series]}, observation du {latest[column]}."
        fact = {'series_id': series, 'observation_date': latest[column], 'value': latest[series], 'unit': None}
    else:
        text = f"{series} : aucune valeur numérique dans les {len(rows)} lignes conservées."
        fact = {'series_id': series, 'observation_date': None, 'value': None, 'unit': None}
    text += " L’unité n’est pas fournie par ce CSV; consulter la fiche officielle FRED."
    return [{'text': text, 'claim_type': 'macro', 'confidence': 'supported',
             'evidence_ids': [evidence['evidence_id']], 'reported_fact': fact},
            {'text': f"{series} : {missing} valeur(s) manquante(s) sur les {len(rows)} lignes conservées, du {rows[0][column]} au {rows[-1][column]}. Ces dates sont celles des observations, pas nécessairement celles de publication. Les données peuvent être révisées.",
             'claim_type': 'macro', 'confidence': 'supported', 'evidence_ids': [evidence['evidence_id']],
             'reported_fact': {'missing_count': missing, 'window_size': len(rows),
                               'window_start': rows[0][column], 'window_end': rows[-1][column]}}]
