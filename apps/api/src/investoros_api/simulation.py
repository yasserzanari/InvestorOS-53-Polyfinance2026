"""Read-only historical market data and dated corporate actions for Simulation."""

import csv
import json
import os
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/v1/simulation", tags=["simulation"])
REGULATION_TERMS = {
    "tariff": "tariff",
    "supply-chain": "supply chain",
    "export-controls": "export controls",
    "energy": "energy",
}


def _data_dir() -> Path:
    configured = os.getenv("SIMULATION_DATA_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    # The optional datathon data pack is deliberately kept out of Git.
    root = Path(__file__).resolve().parents[4]
    return root / "docs/prep/sources/Datathon2026/alphaforge_starter"


def _read_csv(name: str) -> list[dict[str, str]]:
    path = _data_dir() / name
    if not path.is_file():
        raise HTTPException(
            status_code=503,
            detail="Les séries de Simulation ne sont pas configurées sur ce serveur.",
        )
    try:
        with path.open(newline="", encoding="utf-8-sig") as stream:
            return list(csv.DictReader(stream))
    except (OSError, UnicodeError, csv.Error) as error:
        raise HTTPException(status_code=502, detail="Le fichier de données de marché est illisible.") from error


@lru_cache(maxsize=1)
def _assets() -> dict[str, dict[str, str]]:
    rows = _read_csv("assets_universe.csv")
    return {row["ticker"]: row for row in rows if row.get("ticker")}


@router.get("/assets")
def assets() -> dict[str, Any]:
    universe = sorted(_assets().values(), key=lambda row: (row.get("asset_class", ""), row.get("name", "")))
    return {
        "assets": universe,
        "source": "Jeu de données AlphaForge AI fourni localement",
        "sourceAsOf": "2026-11-12",
        "limitations": [
            "Jeu historique de démonstration; ce n’est pas un flux de marché en temps réel.",
            "Les prix sont des cours ajustés Yahoo Finance dans la devise de cotation.",
            "L’univers a un biais de survivant et ne contient ni nouvelles, ni fondamentaux, ni ESG.",
        ],
    }


@router.get("/history/{ticker}")
def history(
    ticker: str,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
) -> dict[str, Any]:
    normalized_ticker = ticker.upper()
    asset = _assets().get(normalized_ticker)
    if not asset:
        raise HTTPException(status_code=404, detail="Titre absent de l’univers historique configuré.")
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="La date de début doit précéder la date de fin.")

    prices = []
    for row in _read_csv("prices_daily.csv"):
        if row.get("ticker") != normalized_ticker:
            continue
        try:
            observed = date.fromisoformat(row["date"])
            adjusted = float(row["adj_close"])
            volume = int(float(row.get("volume") or 0))
        except (KeyError, ValueError):
            continue
        if adjusted <= 0 or (start and observed < start) or (end and observed > end):
            continue
        prices.append({"date": observed.isoformat(), "adjustedClose": adjusted, "volume": volume})
    prices.sort(key=lambda point: point["date"])
    if not prices:
        raise HTTPException(status_code=404, detail="Aucun prix disponible pour cette période.")

    actions = []
    price_dates = [point["date"] for point in prices]
    for row in _read_csv("corporate_actions.csv"):
        if row.get("ticker") != normalized_ticker:
            continue
        event_date = row.get("ex_date", "")
        if (start and event_date < start.isoformat()) or (end and event_date > end.isoformat()):
            continue
        try:
            value = float(row["value"])
        except (KeyError, ValueError):
            value = None
        index = next((i for i, observed in enumerate(price_dates) if observed >= event_date), None)
        reactions = {}
        if index is not None:
            base = prices[index]["adjustedClose"]
            for horizon in (1, 5, 20):
                future_index = index + horizon
                reactions[f"{horizon}observations"] = (
                    round((prices[future_index]["adjustedClose"] / base - 1) * 100, 4)
                    if future_index < len(prices)
                    else None
                )
        actions.append({
            "id": f"{normalized_ticker}:{event_date}:{row.get('action', 'action')}:{len(actions)}",
            "date": event_date,
            "kind": row.get("action", "corporate_action"),
            "value": value,
            "unit": row.get("unit"),
            "observedPriceDate": price_dates[index] if index is not None else None,
            "observedReturnsPct": reactions,
        })

    return {
        "asset": asset,
        "prices": prices,
        "events": actions,
        "currency": asset.get("currency"),
        "source": "prices_daily.csv · adj_close; corporate_actions.csv",
        "sourceAsOf": "2026-11-12",
        "method": "Comparaison du cours ajusté à la première clôture disponible à la date ex ou après, puis aux clôtures 1, 5 et 20 observations ensuite; les horizons comptent des séances, pas des jours civils.",
        "limitations": [
            "Une coïncidence de date ne démontre pas que l’événement a causé le mouvement du cours.",
            "Les rendements postérieurs peuvent intégrer d’autres nouvelles et conditions de marché.",
            "Les cours ajustés sont révisables par leur fournisseur et restent dans la devise de cotation.",
        ],
    }


@router.get("/regulations")
def regulations(topic: str = Query(default="tariff")) -> dict[str, Any]:
    """Find current Federal Register documents; they are leads, not issuer impact claims."""
    term = REGULATION_TERMS.get(topic)
    if not term:
        raise HTTPException(status_code=422, detail="Thème réglementaire non pris en charge.")
    today = date.today().isoformat()
    query = urlencode({
        "per_page": 20,
        "order": "newest",
        "conditions[term]": term,
        "conditions[publication_date][lte]": today,
    })
    request = Request(
        f"https://www.federalregister.gov/api/v1/documents.json?{query}",
        headers={"Accept": "application/json", "User-Agent": "InvestorOS Simulation/1.0"},
    )
    try:
        with urlopen(request, timeout=7) as response:
            payload = json.loads(response.read(2_000_001))
    except HTTPError as error:
        raise HTTPException(status_code=502, detail="La source du Federal Register a refusé la recherche.") from error
    except (URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
        raise HTTPException(status_code=503, detail="La recherche réglementaire est temporairement indisponible.") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise HTTPException(status_code=502, detail="La source réglementaire a renvoyé un format inattendu.")

    documents = []
    for item in payload["results"]:
        if not isinstance(item, dict) or not item.get("document_number") or not item.get("html_url"):
            continue
        published = item.get("publication_date")
        # The API may expose documents scheduled for publication. Keep those out of "recent".
        if not isinstance(published, str) or published > today:
            continue
        agencies = item.get("agencies") if isinstance(item.get("agencies"), list) else []
        documents.append({
            "id": str(item["document_number"]),
            "title": str(item.get("title") or "Document réglementaire"),
            "type": str(item.get("type") or "Document"),
            "publishedAt": published,
            "effectiveOn": item.get("effective_on") if isinstance(item.get("effective_on"), str) else None,
            "summary": str(item.get("abstract") or item.get("excerpts") or "Résumé non fourni par la source.")[:1200],
            "agencies": [str(agency.get("name") or agency.get("raw_name")) for agency in agencies if isinstance(agency, dict) and (agency.get("name") or agency.get("raw_name"))],
            "url": str(item["html_url"]),
            "officialPdfUrl": item.get("pdf_url") if isinstance(item.get("pdf_url"), str) else None,
        })
    return {
        "topic": topic,
        "query": term,
        "source": "Federal Register API",
        "sourceUrl": "https://www.federalregister.gov/developers/documentation/api/v1",
        "legalStatus": "La version XML du site est un service informatif; vérifier l’édition officielle liée avant toute interprétation juridique.",
        "documents": documents,
    }
