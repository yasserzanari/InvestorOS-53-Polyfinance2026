"""Deterministic close-to-close movements with publication-time document context."""
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import date, datetime, time, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo


NEW_YORK = ZoneInfo("America/New_York")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_READ_METHOD = re.compile(r"read|browser|agentcore|api_anything|http", re.I)


def _record(value: Any) -> dict:
    for _ in range(5):
        if not isinstance(value, str):
            break
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return {}
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _number(value: Any) -> float | None:
    if isinstance(value, (bool, str)):
        return None
    try:
        number = float(value)
    except (ValueError, TypeError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def _day(value: Any) -> date | None:
    if not isinstance(value, str) or not _DATE.fullmatch(value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _url(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) > 4000:
        return None
    try:
        parsed = urlsplit(value.strip())
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in {None, 443}:
            return None
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ""))
    except ValueError:
        return None


def _publication(value: Any) -> tuple[datetime | None, date | None, str] | None:
    """An offset-free clock never acquires an invented timezone."""
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    exact_day = _day(raw)
    if exact_day:
        return None, exact_day, "date"
    try:
        stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        try:
            stamp = parsedate_to_datetime(raw)
        except (ValueError, TypeError, OverflowError):
            return None
    if stamp.tzinfo is None or stamp.utcoffset() is None:
        return None, stamp.date(), "date"
    return stamp.astimezone(timezone.utc), None, "timestamp"


def _category(title: str, excerpt: str) -> str:
    content = f"{title} {excerpt}".lower()
    if re.search(r"chief executive|\bceo\b|resign|governance|board|transition|directeur|démission|gouvernance", title, re.I) or re.search(r"resign|démission|appointed.{0,70}(?:chief executive|\bceo\b)", excerpt, re.I):
        return "governance"
    if re.search(r"earnings|financial results|quarter|résultats|trimestr", content):
        return "earnings"
    if re.search(r"export control|sanction|regulat|investigation|antitrust|réglement|enquête", content):
        return "regulation"
    return "other"


def _context_excerpt(title: str, text: str) -> str:
    if re.fullmatch(r"(?:8-K|10-[KQ]|6-K)", title.strip(), re.I):
        match = re.search(r"Item\s+5\.02|departure.{0,70}(?:director|officer)|resign|appointed.{0,70}(?:chief executive|CEO)", text, re.I)
        if match and match.start() > 180:
            start = max(0, text.rfind("\n", 0, match.start()))
            return "[…]\n" + text[start:start + 1395].strip()
    return text[:1400]


def _same_asset(content: dict, ticker: str) -> bool:
    named = _text(content.get("ticker")).strip().upper()
    if named and named != ticker:
        return False
    tickers = content.get("tickers")
    if isinstance(tickers, list) and tickers:
        valid = [_text(value).strip().upper() for value in tickers if isinstance(value, str)]
        if valid and ticker not in valid:
            return False
    return True


def _calendar_page(source_id: str, url: str, content: dict, item: dict) -> bool:
    path = urlsplit(url).path.lower()
    # Reading a calendar page does not read the future economic release itself.
    if source_id in {"bls-calendar", "fed-calendar"}:
        return bool(content.get("calendar_checked")) or "/schedule/" in path or bool(re.search(r"/newsevents/\d{4}-[a-z]+\.htm", path))
    return bool(item.get("date_basis")) or "/rss/" in path


def _documents(snapshot: dict, ticker: str) -> tuple[list[dict], dict]:
    eligible: dict[str, dict] = {}
    excluded = {"indexedLeadsExcluded": 0, "unreadDocumentsExcluded": 0, "undatedDocumentsExcluded": 0, "calendarDocumentsExcluded": 0, "otherAssetDocumentsExcluded": 0}
    proofs = snapshot.get("evidence") if isinstance(snapshot.get("evidence"), list) else []
    for proof in proofs:
        if not isinstance(proof, dict):
            continue
        content = _record(proof.get("content"))
        if not _same_asset(content, ticker):
            excluded["otherAssetDocumentsExcluded"] += 1
            continue
        items = content.get("documents")
        documents = [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []
        # Some registered readers store the article as the evidence content itself.
        if not documents and any(key in content for key in ("excerpt", "text")):
            documents = [content]
        for field in ("articles", "news"):
            leads = content.get(field)
            if isinstance(leads, list):
                excluded["indexedLeadsExcluded"] += sum(isinstance(item, dict) for item in leads)
        for item in documents:
            url = _url(item.get("url") or item.get("document_url") or proof.get("url"))
            excerpt = _text(item.get("excerpt") or item.get("text")).strip()
            method = _text(item.get("method") or proof.get("method"))
            read = _number(item.get("characters_read") or item.get("charactersRead"))
            source_id = _text(proof.get("source_id"))
            if not _same_asset(item, ticker):
                excluded["otherAssetDocumentsExcluded"] += 1
                continue
            if not url or not excerpt or len(excerpt) < 40 or not ((read is not None and read > 0) or _READ_METHOD.search(method)):
                if item.get("indexedAt") or item.get("indexed_at") or item.get("seendate"):
                    excluded["indexedLeadsExcluded"] += 1
                else:
                    excluded["unreadDocumentsExcluded"] += 1
                continue
            if _calendar_page(source_id, url, content, item):
                excluded["calendarDocumentsExcluded"] += 1
                continue
            published = item.get("published_at") or item.get("publishedAt") or item.get("acceptanceDateTime") or item.get("publicationDate") or item.get("filingDate")
            parsed = _publication(published)
            if parsed is None:
                if item.get("indexedAt") or item.get("indexed_at") or item.get("seendate"):
                    excluded["indexedLeadsExcluded"] += 1
                else:
                    excluded["undatedDocumentsExcluded"] += 1
                continue
            title = _text(item.get("title")) or _text(item.get("form")) or _text(proof.get("source_name")) or "Document lu"
            evidence_id = _text(proof.get("evidence_id"))
            candidate = {
                "id": "document:" + hashlib.sha256(url.encode()).hexdigest()[:20],
                "title": title, "url": url,
                "sourceName": _text(proof.get("source_name")) or urlsplit(url).hostname,
                "sourceId": source_id, "evidenceId": evidence_id,
                "publishedAt": _text(published), "publicationPrecision": parsed[2],
                "excerpt": _context_excerpt(title, excerpt), "charactersRead": int(read) if read is not None and read > 0 else len(excerpt),
                "category": _category(title, excerpt),
                "collectedAt": _text(proof.get("collected_at")),
                "method": method,
                "_stamp": parsed[0], "_day": parsed[1],
            }
            current = eligible.get(url)
            if current is None or (candidate["publicationPrecision"] == "timestamp", candidate["charactersRead"]) > (current["publicationPrecision"] == "timestamp", current["charactersRead"]):
                eligible[url] = candidate
    return list(eligible.values()), {"documentsRead": len(eligible), **excluded}


def build_movement_report(history: dict, snapshot: dict, threshold_pct: float = 5,
                          start_date: str | None = None, end_date: str | None = None) -> dict:
    """Describe all qualifying intervals, including those without document context."""
    threshold = _number(threshold_pct)
    if threshold is None or not 0 < threshold <= 1000:
        raise ValueError("Le seuil doit être un nombre positif inférieur ou égal à 1 000 %.")
    asset = history.get("asset") if isinstance(history.get("asset"), dict) else {}
    ticker = _text(asset.get("ticker") or history.get("ticker")).strip().upper()
    if not ticker:
        raise ValueError("Le titre de l’historique n’est pas fourni.")
    currency = _text(history.get("currency"))
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("La devise de l’historique n’est pas fournie ou n’est pas valide.")
    if not isinstance(history.get("prices"), list):
        raise ValueError("La série de cours n’est pas disponible.")
    prices: dict[date, float] = {}
    invalid_prices = 0
    for item in history["prices"]:
        day = _day(item.get("date")) if isinstance(item, dict) else None
        price = _number(item.get("adjustedClose")) if isinstance(item, dict) else None
        if day is None or price is None or price <= 0:
            invalid_prices += 1
            continue
        if day in prices and prices[day] != price:
            raise ValueError("Plusieurs clôtures ajustées contradictoires existent pour une même date.")
        prices[day] = price
    ordered = sorted(prices.items())
    if len(ordered) < 2:
        raise ValueError("Deux clôtures ajustées valides sont nécessaires pour calculer une variation.")
    requested_start = _day(start_date) if start_date is not None else ordered[0][0]
    requested_end = _day(end_date) if end_date is not None else ordered[-1][0]
    if requested_start is None or requested_end is None or requested_start > requested_end:
        raise ValueError("La période doit comporter deux dates ISO valides, dans l’ordre chronologique.")
    selected = [(day, price) for day, price in ordered if requested_start <= day <= requested_end]
    documents, coverage = _documents(snapshot, ticker)
    market = _text(asset.get("market")).strip().upper()
    asset_class = _text(asset.get("asset_class")).strip().lower()
    us_equity_clock = bool(re.match(r"^(?:NASDAQ|NYSE)(?:$|[\s_.-])", market)) and (asset_class == "equity" or asset_class.startswith("etf"))
    coverage["timestampDocumentsExcludedUnsupportedClock"] = sum(document["_stamp"] is not None for document in documents) if not us_equity_clock else 0
    movements = []
    gap_count = 0
    for (previous_day, previous_price), (day, price) in zip(ordered, ordered[1:]):
        if not requested_start <= day <= requested_end:
            continue
        change = (price / previous_price - 1) * 100
        if not math.isfinite(change):
            raise ValueError("La série contient un rapport de cours hors de la plage numérique prise en charge.")
        if abs(change) + 1e-10 < threshold:
            continue
        previous_close = datetime.combine(previous_day, time(16), NEW_YORK).astimezone(timezone.utc) if us_equity_clock else None
        close = datetime.combine(day, time(16), NEW_YORK).astimezone(timezone.utc) if us_equity_clock else None
        candidates = []
        for document in documents:
            stamp, published_day = document["_stamp"], document["_day"]
            if stamp is not None:
                if not us_equity_clock:
                    continue
                matches = previous_close < stamp <= close
                timing = "interval"
            else:
                matches = published_day == day
                timing = "date_only"
            if matches:
                candidates.append({key: value for key, value in document.items() if not key.startswith("_")} | {"timing": timing})
        candidates.sort(key=lambda candidate: (candidate["publicationPrecision"] != "timestamp", candidate["publishedAt"], candidate["url"]))
        gap = (day - previous_day).days
        if gap > 7:
            gap_count += 1
        status = "context_found" if candidates else "unexplained"
        explanation = (f"{len(candidates)} document(s) lu(s) ont une publication dans cet intervalle ou une date compatible. Ce contexte ne démontre pas la cause de la variation."
                       if candidates else "Aucun document effectivement lu et daté ne permet de rapprocher cette variation d’une annonce dans cet intervalle. La raison n’est pas établie.")
        if candidates and all(item["timing"] == "date_only" for item in candidates):
            explanation += " L’heure de publication manque : l’ordre entre l’annonce et le mouvement reste inconnu."
        if not us_equity_clock:
            explanation += " L’horaire de clôture de cette place ou de cette classe d’actifs n’est pas pris en charge; les publications horodatées ne sont pas rapprochées d’une clôture à New York."
        if gap > 7:
            explanation += f" Les deux observations sont distantes de {gap} jours; cette variation ne représente pas une seule séance."
        movements.append({
            "id": f"movement:{ticker}:{previous_day.isoformat()}:{day.isoformat()}",
            "date": day.isoformat(), "previousDate": previous_day.isoformat(),
            "price": price, "previousPrice": previous_price, "changePct": round(change, 6),
            "direction": "up" if change > 0 else "down", "status": status,
            "explanation": explanation, "candidates": candidates, "gapDays": gap,
        })
    source_classification = history.get("sourceClassification")
    if not isinstance(source_classification, str) or source_classification not in {"illustrative", "observations", "unknown"}:
        source_classification = "unknown"
    limits = [
        "Le rapprochement chronologique fournit du contexte, pas une attribution causale. Aucune variation n’est automatiquement déclarée expliquée.",
        "Une date sans heure ni fuseau n’est rapprochée que d’une observation de la même date; l’antériorité de la publication reste inconnue.",
        "Les titres indexés sans contenu lu, les calendriers d’événements futurs et les documents sans date de publication sont exclus de ce rapprochement.",
        "Les sources fournies ne couvrent pas nécessairement toutes les annonces, facteurs macroéconomiques ou mécanismes de marché de la période.",
    ]
    if us_equity_clock:
        limits.extend([
            "Pour les actions et ETF explicitement rattachés au NASDAQ ou au NYSE, la clôture de référence est fixée à 16 h à New York. Les échanges intrajournaliers, demi-séances et autres horaires particuliers ne sont pas modélisés.",
            "Une publication après cette clôture est rapprochée de la prochaine observation disponible, jamais de la clôture précédente.",
        ])
        timing_method = "Les publications horodatées sont rapprochées de l’intervalle ouvert après la clôture précédente et fermé à la clôture observée, selon la référence de 16 h America/New_York applicable aux actions et ETF du NASDAQ ou du NYSE."
    else:
        limits.append(f"L’horaire de clôture n’est pas pris en charge pour la place {market or 'non renseignée'} et la classe {asset_class or 'non renseignée'}. Les publications horodatées sont exclues du rapprochement; aucune clôture à 16 h New York n’est supposée pour ces actifs.")
        timing_method = "Aucun horaire de clôture pris en charge n’est connu pour cet actif. Les publications horodatées sont exclues du rapprochement; seules les publications avec une date sans horaire peuvent former un contexte incertain de la même date."
    if source_classification == "illustrative":
        limits.append("La série est déclarée illustrative : ses variations ne prouvent pas une réaction réelle du marché aux documents publics.")
    elif source_classification == "unknown":
        limits.append("La classification de la série n’est pas fournie; vérifier la provenance du jeu avant de l’interpréter comme des observations de marché.")
    if invalid_prices:
        limits.append(f"{invalid_prices} observation(s) invalide(s) exclue(s); les variations utilisent les clôtures valides restantes.")
    if gap_count:
        limits.append(f"{gap_count} variation(s) retenue(s) séparent des observations distantes de plus de sept jours.")
    if not selected:
        limits.append("Aucune clôture du jeu ne se situe dans la période demandée; un résultat vide ne signifie pas une absence de variation du marché.")
    return {
        "analysisId": _text(snapshot.get("analysis_id")), "ticker": ticker,
        "asOf": ordered[-1][0].isoformat(), "currency": currency,
        "thresholdPct": threshold,
        "window": {"start": selected[0][0].isoformat() if selected else requested_start.isoformat(),
                   "end": selected[-1][0].isoformat() if selected else requested_end.isoformat()},
        "source": {"title": _text(history.get("source")), "url": _url(history.get("sourceUrl")), "classification": source_classification},
        "marketClock": {"supported": us_equity_clock, "market": market, "assetClass": asset_class, "reference": "16:00 America/New_York" if us_equity_clock else None},
        "observationCount": len(selected), "totalMoves": len(movements), "movements": movements, "evidenceCoverage": coverage,
        "method": "Variations de clôture ajustée à clôture ajustée : 100 × (cours / clôture précédente − 1), seuil appliqué à la valeur absolue avant arrondi. La clôture précédente peut précéder le début de la période choisie. " + timing_method + " Les dates seules restent incertaines. Tous les mouvements au seuil sont conservés, y compris sans contexte documentaire.",
        "limitations": limits,
    }
