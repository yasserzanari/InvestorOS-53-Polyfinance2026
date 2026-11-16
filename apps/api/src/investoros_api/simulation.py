"""Read-only historical market data and dated corporate actions for Simulation."""

import csv
import json
import math
from bisect import bisect_left
import os
import re
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from investoros_api.research.sources import DEFAULT_SOURCES

router = APIRouter(prefix="/v1/simulation", tags=["simulation"])
REGULATION_TERMS = {
    "tariff": "tariff",
    "supply-chain": "supply chain",
    "export-controls": "export controls",
    "energy": "energy",
}
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_DOCS_URL = "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/"
X_RECENT_SEARCH_URL = "https://api.x.com/2/tweets/search/recent"
X_SEARCH_DOCS_URL = "https://docs.x.com/x-api/posts/search/introduction"


class ScenarioBranch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=40, pattern=r"^[a-zA-Z0-9_-]+$")
    title: str = Field(min_length=1, max_length=80)
    event: str = Field(min_length=1, max_length=160)
    sourceUrl: str | None = Field(default=None, max_length=1000)
    shockPct: float = Field(ge=-80, le=100, allow_inf_nan=False, strict=True)
    eventAfterObservations: int | None = Field(default=None, ge=0, le=120, strict=True)
    eventAfterDays: int | None = Field(default=None, ge=0, le=120, strict=True)

    @model_validator(mode="after")
    def exactly_one_offset_unit(self):
        if (self.eventAfterDays is None) == (self.eventAfterObservations is None) or {"eventAfterDays", "eventAfterObservations"} <= self.model_fields_set:
            raise ValueError("Indiquez exactement un décalage : eventAfterDays ou eventAfterObservations.")
        return self

    @field_validator("sourceUrl")
    @classmethod
    def secure_source_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        parsed = urlsplit(value.strip())
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Source URLs must use HTTPS and cannot contain credentials")
        return value.strip()


class ScenarioProjectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    ticker: str = Field(min_length=1, max_length=16, pattern=r"^[A-Za-z0-9.^=-]+$")
    horizonObservations: int | None = Field(default=None, ge=1, le=120, strict=True)
    horizonDays: int | None = Field(default=None, ge=1, le=120, strict=True)
    branches: list[ScenarioBranch] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def unique_branch_ids_and_valid_offsets(self):
        if (self.horizonDays is None) == (self.horizonObservations is None) or {"horizonDays", "horizonObservations"} <= self.model_fields_set:
            raise ValueError("Indiquez exactement un horizon : horizonDays ou horizonObservations.")
        calendar = self.horizonDays is not None
        horizon = self.horizonDays if calendar else self.horizonObservations
        ids = [branch.id for branch in self.branches]
        if len(ids) != len(set(ids)):
            raise ValueError("Branch ids must be unique")
        for branch in self.branches:
            offset = branch.eventAfterDays if calendar else branch.eventAfterObservations
            if offset is None:
                raise ValueError("L’unité du décalage doit correspondre à celle de l’horizon.")
            if offset > horizon:
                raise ValueError("An event cannot occur after the selected horizon")
        return self


_SEC_CACHE: dict[str, tuple[float, Any]] = {}
_NEWS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_NEWS_CACHE_TABLE = None
_NEWS_CACHE_TABLE_NAME = ""
_X_POSTS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_X_SECRET_CACHE: tuple[float, str] | None = None


def _news_cache_table():
    """Use the TTL-enabled monitor table as a shared cache across Lambda workers."""
    global _NEWS_CACHE_TABLE, _NEWS_CACHE_TABLE_NAME
    table_name = os.getenv("PORTFOLIO_MONITOR_TABLE_NAME", "")
    if not table_name:
        return None
    if _NEWS_CACHE_TABLE is None or _NEWS_CACHE_TABLE_NAME != table_name:
        _NEWS_CACHE_TABLE = boto3.resource(
            "dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1")
        ).Table(table_name)
        _NEWS_CACHE_TABLE_NAME = table_name
    return _NEWS_CACHE_TABLE


def _news_cache_item_key(ticker: str) -> dict[str, str]:
    return {"account_id": "shared#market-news", "record_id": f"news#{ticker}"}


def _read_shared_news_cache(ticker: str, now: float) -> tuple[float, dict[str, Any]] | None:
    table = _news_cache_table()
    if table is None:
        return None
    try:
        response = table.get_item(Key=_news_cache_item_key(ticker), ConsistentRead=True)
        item = response.get("Item")
        if not item or float(item.get("expiresAt", 0)) <= now:
            return None
        payload = json.loads(item.get("payload", ""))
        if not isinstance(payload, dict) or payload.get("ticker") != ticker:
            return None
        expires_at = float(item["expiresAt"])
        _NEWS_CACHE[ticker] = (expires_at, payload)
        return expires_at, payload
    except (BotoCoreError, ClientError, TypeError, ValueError, json.JSONDecodeError):
        # News should remain available when optional cache storage is degraded.
        return None


def _write_shared_news_cache(ticker: str, result: dict[str, Any], expires_at: float) -> None:
    table = _news_cache_table()
    if table is None:
        return
    try:
        table.put_item(Item={
            **_news_cache_item_key(ticker),
            "payload": json.dumps(result, ensure_ascii=False),
            "expiresAt": int(expires_at),
        })
    except (BotoCoreError, ClientError, TypeError, ValueError):
        # Keep the in-process cache even if DynamoDB is temporarily unavailable.
        return


def _data_dir() -> Path:
    configured = os.getenv("SIMULATION_DATA_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    # Lambda packages carry the authorized CSV subset alongside this module.
    packaged = Path(__file__).resolve().parent / "data"
    if packaged.is_dir():
        return packaged
    # The optional datathon data pack is deliberately kept out of Git.
    parents = Path(__file__).resolve().parents
    if len(parents) > 4:
        return parents[4] / "docs/prep/sources/Datathon2026/alphaforge_starter"
    return packaged


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
        except (KeyError, ValueError, OverflowError):
            continue
        if not math.isfinite(adjusted) or adjusted <= 0 or (start and observed < start) or (end and observed > end):
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
        "sourceAsOf": prices[-1]["date"],
        **_source_provenance(),
        "method": "Comparaison du cours ajusté à la première clôture disponible à la date ex ou après, puis aux clôtures 1, 5 et 20 observations ensuite; les horizons comptent des séances, pas des jours civils.",
        "limitations": [
            "Une coïncidence de date ne démontre pas que l’événement a causé le mouvement du cours.",
            "Les rendements postérieurs peuvent intégrer d’autres nouvelles et conditions de marché.",
            "Les cours ajustés sont révisables par leur fournisseur et restent dans la devise de cotation.",
        ],
    }


@router.get("/event-study/{ticker}")
def event_study(ticker: str, event_date: date = Query(...)) -> dict[str, Any]:
    """Describe post-date returns against a same-currency equity benchmark.

    This is a date-aligned comparison, not an event attribution or a causal study.
    The benchmark is deliberately fixed by the configured asset currency.
    """
    normalized_ticker = ticker.upper()
    asset = _assets().get(normalized_ticker)
    if not asset:
        raise HTTPException(status_code=404, detail="Titre absent de l’univers historique configuré.")

    asset_class = asset.get("asset_class", "")
    currency = asset.get("currency", "")
    benchmark_ticker = (
        "SPY" if currency == "USD" else "XIU.TO" if currency == "CAD" else None
    ) if asset_class in {"equity", "etf_equity"} else None

    def load_prices(symbol: str) -> list[dict[str, Any]]:
        points: list[dict[str, Any]] = []
        for row in _read_csv("prices_daily.csv"):
            if row.get("ticker") != symbol:
                continue
            try:
                observed = date.fromisoformat(row["date"])
                adjusted = float(row["adj_close"])
            except (KeyError, ValueError):
                continue
            if adjusted > 0:
                points.append({"date": observed, "adjustedClose": adjusted})
        return sorted(points, key=lambda point: point["date"])

    stock = load_prices(normalized_ticker)
    if not stock:
        raise HTTPException(status_code=404, detail="Aucun prix disponible pour ce titre.")
    stock_base_index = next(
        (index for index, point in enumerate(stock) if point["date"] >= event_date), None
    )
    benchmark = load_prices(benchmark_ticker) if benchmark_ticker else []
    benchmark_base_index = next(
        (index for index, point in enumerate(benchmark) if point["date"] >= event_date), None
    )

    points = []
    for horizon in (1, 5, 20):
        stock_end_index = stock_base_index + horizon if stock_base_index is not None else None
        stock_end = stock[stock_end_index] if stock_end_index is not None and stock_end_index < len(stock) else None
        stock_base = stock[stock_base_index] if stock_base_index is not None else None
        stock_return = (
            (stock_end["adjustedClose"] / stock_base["adjustedClose"] - 1) * 100
            if stock_end and stock_base else None
        )

        benchmark_base = benchmark[benchmark_base_index] if benchmark_base_index is not None else None
        benchmark_end = None
        if benchmark_base and stock_end:
            benchmark_end = next(
                (point for point in benchmark[benchmark_base_index + 1:] if point["date"] >= stock_end["date"]),
                None,
            )
        benchmark_return = (
            (benchmark_end["adjustedClose"] / benchmark_base["adjustedClose"] - 1) * 100
            if benchmark_base and benchmark_end else None
        )
        points.append({
            "horizonObservations": horizon,
            "stockStartDate": stock_base["date"].isoformat() if stock_base else None,
            "stockEndDate": stock_end["date"].isoformat() if stock_end else None,
            "stockReturnPct": round(stock_return, 4) if stock_return is not None else None,
            "benchmarkStartDate": benchmark_base["date"].isoformat() if benchmark_base else None,
            "benchmarkEndDate": benchmark_end["date"].isoformat() if benchmark_end else None,
            "benchmarkReturnPct": round(benchmark_return, 4) if benchmark_return is not None else None,
            "excessReturnPct": round(stock_return - benchmark_return, 4)
            if stock_return is not None and benchmark_return is not None else None,
        })

    return {
        "ticker": normalized_ticker,
        "benchmarkTicker": benchmark_ticker,
        "eventDate": event_date.isoformat(),
        "sourceAsOf": stock[-1]["date"].isoformat(),
        "points": points,
        "source": "prices_daily.csv · adj_close",
        "method": "Pour chaque horizon, rendement ajusté du titre entre la première clôture à la date indiquée ou après et la clôture après N observations. Le benchmark de même devise est mesuré entre sa première clôture à cette date ou après et la première clôture à la date de fin du titre ou après; l’excédent est la différence en points de pourcentage.",
        "limitations": [
            "Une fenêtre descriptive autour d’une date ne démontre ni causalité, ni exposition de l’émetteur, ni réaction à l’événement.",
            "Les rendements peuvent intégrer d’autres nouvelles; les jours fériés et calendriers boursiers peuvent décaler les dates du benchmark.",
            "Le benchmark est un indice proxy à devise identique (SPY en USD, XIU.TO en CAD) et non un portefeuille apparié au titre.",
            "Le jeu historique de démonstration s’arrête au dernier cours empaqueté; les horizons incomplets restent indisponibles.",
        ],
    }


def _quantile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def _source_provenance() -> dict[str, str]:
    """Report the configured pack's declared origin without inferring a live feed."""
    classification = "unknown"
    description = "Paquet historique fourni; provenance non documentée dans les métadonnées locales."
    try:
        records = _read_csv("sources_metadata.csv")
    except HTTPException:
        records = []
    metadata = next((row for row in records if row.get("file") == "prices_daily.csv"), {})
    declared = " ".join(str(metadata.get(key, "")) for key in ("source", "content", "processing", "limitations")).casefold()
    if any(word in declared for word in ("synthetic", "synthétique", "illustrative", "fixture", "fictif", "simulated")):
        classification = "illustrative"
        description = "Séries illustratives déclarées dans les métadonnées du paquet fourni."
    elif any(word in declared for word in ("yahoo", "yfinance", "historical observations", "observations historiques")):
        classification = "observations"
        description = "Observations historiques déclarées par les métadonnées du paquet fourni; pas un cours en direct."
    provenance = {"sourceClassification": classification, "sourceDescription": description}
    declared_url = str(metadata.get("source_url", "")).strip()
    if classification == "observations" and len(declared_url) <= 2000:
        try:
            parsed = urlsplit(declared_url)
            if parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password:
                provenance["sourceUrl"] = declared_url
        except ValueError:
            pass
    return provenance


@router.get("/capabilities")
def simulation_capabilities() -> dict[str, Any]:
    """Inspect local readiness and bounds before an agent promises a calculation."""
    required = {
        "assets_universe.csv": {"ticker", "name", "currency"},
        "prices_daily.csv": {"ticker", "date", "adj_close"},
        "corporate_actions.csv": {"ticker", "ex_date", "action", "value", "unit"},
    }
    files = []
    rows_by_file: dict[str, list[dict[str, str]]] = {}
    failures = []
    for name, columns in required.items():
        path = _data_dir() / name
        exists = path.is_file()
        valid = False
        code = "missing_file"
        if exists:
            try:
                with path.open(newline="", encoding="utf-8-sig") as stream:
                    reader = csv.DictReader(stream)
                    valid = columns <= set(reader.fieldnames or ())
                    if valid:
                        rows_by_file[name] = list(reader)
                    else:
                        code = "invalid_columns"
            except (OSError, UnicodeError, csv.Error):
                code = "unreadable_file"
        files.append({"name": name, "available": exists, "valid": valid})
        if not valid:
            failures.append({"code": code, "file": name, "message": "Fichier requis absent ou illisible; configurer le paquet historique autorisé."})
    assets = {row["ticker"].strip().upper() for row in rows_by_file.get("assets_universe.csv", []) if row.get("ticker", "").strip()}
    dates_by_ticker: dict[str, set[date]] = {}
    for row in rows_by_file.get("prices_daily.csv", []):
        try:
            observed = date.fromisoformat(row["date"])
            price = float(row["adj_close"])
            ticker = row["ticker"].strip().upper()
            if ticker in assets and math.isfinite(price) and price > 0:
                dates_by_ticker.setdefault(ticker, set()).add(observed)
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
    tickers = []
    for ticker, observed_dates in sorted(dates_by_ticker.items()):
        dates = sorted(observed_dates)
        if len(dates) < 22:
            continue
        # A calendar target has an available endpoint iff it is no later than
        # the last historical quote. The twentieth start date bounds 20 windows.
        max_days = min(120, (dates[-1] - dates[19]).days)
        tickers.append({"ticker": ticker, "observations": len(dates), "asOf": dates[-1].isoformat(), "maxHorizonObservations": min(120, len(dates) - 20), "maxHorizonDays": max_days})
    if not tickers and all(item["valid"] for item in files):
        failures.append({"code": "insufficient_history", "message": "Aucun titre ne dispose de 22 observations valides pour calculer une référence historique."})
    ready = not failures and bool(tickers)
    return {
        "ready": ready,
        "available": ready,
        "requiredFiles": files,
        "supportedTickers": [item["ticker"] for item in tickers],
        "tickerCapabilities": tickers,
        "timeUnits": ["calendar_days", "observations"],
        "limits": {"calendar_days": {"min": 1, "max": 120}, "observations": {"min": 1, "max": 120}, "branches": {"min": 1, "max": 4}},
        **_source_provenance(),
        "failures": failures,
        "limitations": ["Paquet historique fourni; aucun cours en temps réel n’est interrogé.", "Chaque horizon requiert au moins 20 fenêtres historiques; les limites effectives par titre sont indiquées.", "En jours civils, chaque fenêtre utilise la première clôture disponible à la date cible ou après, y compris après un week-end ou un jour férié."],
    }


@router.post("/scenarios")
def project_scenarios(request: ScenarioProjectionRequest) -> dict[str, Any]:
    """Apply precisely the supplied shocks using one explicit calendar/observation unit."""
    ticker = request.ticker.upper()
    if ticker not in _assets():
        raise HTTPException(status_code=404, detail="Titre absent de l’univers historique configuré.")
    historical = history(ticker, start=None, end=None)
    prices = historical["prices"]
    starting_price = prices[-1]["adjustedClose"]
    as_of = prices[-1]["date"]
    if len(prices) < 22:
        raise HTTPException(status_code=422, detail="Il faut au moins 22 observations historiques pour calculer une référence.")
    calendar = request.horizonDays is not None
    horizon = request.horizonDays if calendar else request.horizonObservations
    time_key = "days" if calendar else "observations"
    event_key = "eventAfterDays" if calendar else "eventAfterObservations"
    horizon_key = "horizonDays" if calendar else "horizonObservations"
    offsets = [branch.eventAfterDays if calendar else branch.eventAfterObservations for branch in request.branches]
    dates = [date.fromisoformat(point["date"]) for point in prices]
    horizons = sorted(set([0, horizon, *(round(horizon * i / 6) for i in range(1, 6)), *offsets]))
    baseline = []
    for step in horizons:
        if step == 0:
            baseline.append({time_key: 0, "p10Pct": 0.0, "p50Pct": 0.0, "p90Pct": 0.0})
            continue
        returns = []
        if calendar:
            for index, observed in enumerate(dates):
                target_index = bisect_left(dates, observed + timedelta(days=step), lo=index + 1)
                if target_index < len(prices):
                    returns.append(prices[target_index]["adjustedClose"] / prices[index]["adjustedClose"] - 1)
        else:
            returns = [prices[index + step]["adjustedClose"] / prices[index]["adjustedClose"] - 1 for index in range(len(prices) - step)]
        if len(returns) < 20:
            raise HTTPException(status_code=422, detail="Pas assez de fenêtres historiques pour cet horizon; conservez les paramètres demandés et consultez les capacités disponibles.")
        baseline.append({time_key: step, "p10Pct": round(_quantile(returns, .10) * 100, 4), "p50Pct": round(_quantile(returns, .50) * 100, 4), "p90Pct": round(_quantile(returns, .90) * 100, 4)})
    branches = []
    for branch in request.branches:
        event_time = branch.eventAfterDays if calendar else branch.eventAfterObservations
        path = []
        for point in baseline:
            step = point[time_key]
            event_applied = step >= event_time
            factor = 1 + branch.shockPct / 100 if event_applied else 1.0
            path.append({time_key: step, "eventApplied": event_applied,
                **({"targetDate": (date.fromisoformat(as_of) + timedelta(days=step)).isoformat(), "dateKind": "scenario_target"} if calendar else {}),
                "lowerPrice": round(starting_price * (1 + point["p10Pct"] / 100) * factor, 4),
                "medianPrice": round(starting_price * (1 + point["p50Pct"] / 100) * factor, 4),
                "upperPrice": round(starting_price * (1 + point["p90Pct"] / 100) * factor, 4)})
        branches.append({"id": branch.id, "title": branch.title, "event": branch.event,
            **({"sourceUrl": branch.sourceUrl} if branch.sourceUrl else {}), "shockPct": branch.shockPct, event_key: event_time, "path": path})
    calendar_method = " Les fenêtres en jours civils cherchent la première clôture historique disponible à la date cible ou après; week-ends et jours fériés peuvent allonger la durée observée. Les dates cibles du scénario sont des dates modélisées, jamais des cours futurs observés." if calendar else " Les horizons comptent des observations de marché, pas des jours civils."
    return {"ticker": ticker, horizon_key: horizon, "timeUnit": "calendar_days" if calendar else "observations",
        "asOf": as_of, "startingPrice": starting_price, "currency": historical["currency"], "source": historical["source"],
        **_source_provenance(), "branches": branches,
        "method": "À chaque jalon, les percentiles 10/50/90 sont calculés sur toutes les fenêtres historiques du même titre et de même durée disponibles dans le jeu. Le choc indiqué par l’utilisateur est appliqué au jalon choisi, puis multiplié aux percentiles historiques suivants. Les points intermédiaires sont des quantiles marginaux, pas des trajectoires individuelles cohérentes." + calendar_method,
        "limitations": ["Les pourcentages de choc sont des hypothèses saisies par l’utilisateur; ils ne sont pas estimés par le modèle.",
            "Les liens de branche proviennent de l’utilisateur ou de l’événement sélectionné; leur contenu n’est pas vérifié par le calcul.",
            "Cette projection conditionnelle n’est pas une prévision et n’établit ni probabilité de scénario ni causalité événement-cours.",
            "Le cours de départ est le dernier cours du paquet historique fourni; aucun cours en direct n’est chargé et il peut être différé par rapport au marché actuel.",
            "Les quantiles historiques ne tiennent pas compte d’un changement de régime, de volatilité future, d’impôts ou des positions d’un portefeuille.",
            *(["Les fenêtres historiques en jours civils utilisent une approximation par la première clôture disponible à la date cible ou après, même après un week-end ou un jour férié."] if calendar else [])]}


def _fetch_json(url: str, user_agent: str, timeout: float = 7) -> Any:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": user_agent})
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read(5_000_001))
    except HTTPError as error:
        if error.code == 404:
            raise HTTPException(status_code=404, detail="Le document SEC demandé est introuvable.") from error
        raise HTTPException(status_code=502, detail="La SEC a refusé la recherche de dépôts.") from error
    except (URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
        raise HTTPException(status_code=503, detail="Les dépôts SEC sont temporairement indisponibles.") from error


def _cached_sec_json(key: str, url: str, user_agent: str, ttl_seconds: int) -> Any:
    now = datetime.now(timezone.utc).timestamp()
    cached = _SEC_CACHE.get(key)
    if cached and now - cached[0] < ttl_seconds:
        return cached[1]
    payload = _fetch_json(url, user_agent)
    _SEC_CACHE[key] = (now, payload)
    return payload


@router.get("/filings/{ticker}")
def issuer_filings(ticker: str, limit: int = 50, start_date: date | None = None) -> dict[str, Any]:
    """Return primary-source SEC filings across the requested price-history window."""
    normalized = ticker.upper()
    if limit < 1 or limit > 50:
        raise HTTPException(status_code=422, detail="La limite doit être comprise entre 1 et 50.")
    asset = _assets().get(normalized)
    if not asset:
        raise HTTPException(status_code=404, detail="Titre absent de l’univers historique configuré.")
    user_agent = os.getenv("SEC_USER_AGENT", "").strip()
    if not user_agent:
        return {
            "ticker": normalized,
            "available": False,
            "reason": "Configurez SEC_USER_AGENT avec le nom de l’application et un contact valide.",
            "source": "SEC EDGAR Submissions API",
            "sourceUrl": "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
            "filings": [],
        }

    try:
        ticker_index = _cached_sec_json("tickers", SEC_TICKERS_URL, user_agent, 24 * 60 * 60)
    except HTTPException:
        return {"ticker": normalized, "available": False, "reason": "Impossible de lire l’index public des émetteurs SEC.", "source": "SEC EDGAR Submissions API", "sourceUrl": SEC_TICKERS_URL, "filings": []}
    values = list(ticker_index.values()) if isinstance(ticker_index, dict) else ticker_index if isinstance(ticker_index, list) else []
    issuer = next((item for item in values if isinstance(item, dict) and str(item.get("ticker", "")).upper() == normalized), None)
    if not issuer:
        return {"ticker": normalized, "available": False, "reason": "Aucun CIK SEC associé à ce symbole dans l’index public.", "source": "SEC EDGAR Submissions API", "sourceUrl": "https://www.sec.gov/search-filings/edgar-application-programming-interfaces", "filings": []}

    cik = str(issuer.get("cik_str", "")).zfill(10)
    company = str(issuer.get("title") or asset["name"])
    try:
        submissions = _cached_sec_json(f"submissions:{cik}", SEC_SUBMISSIONS_URL.format(cik=cik), user_agent, 15 * 60)
    except HTTPException:
        return {"ticker": normalized, "company": company, "available": False, "reason": "L’historique des dépôts est temporairement indisponible.", "source": "SEC EDGAR Submissions API", "sourceUrl": "https://www.sec.gov/search-filings/edgar-application-programming-interfaces", "filings": []}

    filing_history = submissions.get("filings", {}) if isinstance(submissions, dict) else {}
    recent = filing_history.get("recent", {}) if isinstance(filing_history, dict) else {}
    window_start = start_date or (date.today() - timedelta(days=365 * 5))
    window_start_text = window_start.isoformat()
    filing_groups = [recent] if isinstance(recent, dict) else []
    archives_incomplete = False
    archive_files = filing_history.get("files", []) if isinstance(filing_history, dict) else []
    for archive in archive_files if isinstance(archive_files, list) else []:
        if not isinstance(archive, dict):
            continue
        if str(archive.get("filingTo", "")) < window_start_text:
            continue
        filename = archive.get("name")
        if not isinstance(filename, str) or not re.fullmatch(r"[A-Za-z0-9._-]+\.json", filename):
            archives_incomplete = True
            continue
        try:
            archived_submissions = _cached_sec_json(
                f"submissions:{cik}:{filename}",
                f"https://data.sec.gov/submissions/{filename}",
                user_agent,
                24 * 60 * 60,
            )
        except HTTPException:
            archives_incomplete = True
            continue
        archived_recent = archived_submissions.get("filings", {}).get("recent", {}) if isinstance(archived_submissions, dict) else {}
        if isinstance(archived_recent, dict):
            filing_groups.append(archived_recent)

    filings = []
    seen_accessions: set[str] = set()
    for group in filing_groups:
        accessions = group.get("accessionNumber", [])
        for index, accession in enumerate(accessions if isinstance(accessions, list) else []):
            if not isinstance(accession, str) or accession in seen_accessions:
                continue
            seen_accessions.add(accession)

            def field(name: str, default: Any = "") -> Any:
                values = group.get(name, [])
                return values[index] if isinstance(values, list) and index < len(values) else default

            form = field("form")
            filing_date = field("filingDate")
            if form not in {"8-K", "10-K", "10-Q", "6-K", "20-F", "40-F"} or not isinstance(filing_date, str) or filing_date < window_start_text:
                continue
            accession_path = accession.replace("-", "")
            primary_document = field("primaryDocument")
            document_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession_path}/{primary_document}" if primary_document else f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession_path}/"
            filings.append({
                "id": f"sec:{accession}",
                "form": form,
                "filedAt": filing_date,
                "reportedAt": field("reportDate") or None,
                "acceptedAt": field("acceptanceDateTime") or None,
                "title": field("primaryDocDescription") or f"Dépôt {form}",
                "url": document_url,
                "accessionNumber": accession,
            })
    filings.sort(key=lambda filing: (filing["filedAt"], filing.get("acceptedAt") or ""), reverse=True)
    truncated = len(filings) > limit
    filings = filings[:limit]
    limitations = ["Les dépôts sont les déclarations de l’émetteur, pas une vérification indépendante.", "Un formulaire, une date de dépôt et son cours postérieur ne prouvent pas que le dépôt a causé ce mouvement."]
    if archives_incomplete:
        limitations.append("Certaines archives EDGAR n’ont pas pu être chargées; la liste historique peut être partielle.")
    if truncated:
        limitations.append(f"La liste est limitée aux {limit} dépôts les plus récents de la période; certains dépôts plus anciens ne sont pas affichés.")
    return {
        "ticker": normalized,
        "company": company,
        "cik": cik,
        "available": True,
        "source": "SEC EDGAR Submissions API",
        "sourceUrl": "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
        "asOf": datetime.now(timezone.utc).isoformat(),
        "startDate": window_start_text,
        "truncated": truncated,
        "filings": filings,
        "limitations": limitations,
    }


@router.get("/news/{ticker}")
def issuer_news(ticker: str, limit: int = 15) -> dict[str, Any]:
    """Return recent secondary news coverage as leads, never as verified issuer facts."""
    normalized = ticker.upper()
    if limit < 1 or limit > 25:
        raise HTTPException(status_code=422, detail="La limite doit être comprise entre 1 et 25.")
    asset = _assets().get(normalized)
    if not asset:
        raise HTTPException(status_code=404, detail="Titre absent de l’univers historique configuré.")

    # Keep one canonical result per ticker, independent of the caller's page size.
    cache_key = normalized
    now = datetime.now(timezone.utc).timestamp()
    cached = _NEWS_CACHE.get(cache_key)
    if cached and now < cached[0]:
        return {**cached[1], "articles": cached[1].get("articles", [])[:limit]}
    cached = _read_shared_news_cache(normalized, now)
    if cached:
        return {**cached[1], "articles": cached[1].get("articles", [])[:limit]}

    # GDELT is discovery coverage, not a primary source or an issuer-identity check.
    # Keep the query bounded and escape user-visible company text through urlencode.
    query = f'"{asset["name"]}" OR {normalized}'
    params = urlencode({
        "query": query,
        "mode": "ArtList",
        "format": "json",
        "sort": "DateDesc",
        # Query once for the maximum supported result set, then slice per caller.
        "maxrecords": 25,
        "timespan": "30d",
    })
    request = Request(
        f"{GDELT_DOC_URL}?{params}",
        headers={"Accept": "application/json", "User-Agent": "InvestorOS Simulation/1.0"},
    )
    reason = "La couverture médiatique est temporairement indisponible."
    documents: list[dict[str, str]] = []
    try:
        with urlopen(request, timeout=7) as response:
            payload = json.loads(response.read(2_000_001))
        articles = payload.get("articles", []) if isinstance(payload, dict) else []
        for item in articles:
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            title = item.get("title")
            seen = item.get("seendate")
            if not isinstance(url, str) or not url.startswith("https://") or not isinstance(title, str) or not title.strip():
                continue
            if not isinstance(seen, str) or len(seen) < 8:
                continue
            try:
                published_at = datetime.strptime(seen[:15], "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc).isoformat()
            except ValueError:
                continue
            article = {
                "id": url,
                "title": title.strip()[:400],
                "url": url,
                "domain": str(item.get("domain") or "Source externe")[:200],
                "indexedAt": published_at,
            }
            # GDELT may return the article's social-sharing image. It can be an
            # outlet logo or an unrelated preview, so keep it optional and
            # never present it as a verified photograph of the event.
            image_url = item.get("socialimage")
            if isinstance(image_url, str) and len(image_url) <= 2048:
                try:
                    parsed_image = urlsplit(image_url)
                    if parsed_image.scheme == "https" and parsed_image.hostname and not parsed_image.username and not parsed_image.password:
                        article["imageUrl"] = image_url
                except ValueError:
                    pass
            documents.append(article)
        result = {
            "ticker": normalized,
            "company": asset["name"],
            "available": True,
            "source": "GDELT DOC 2.0 · index de couverture secondaire",
            "sourceUrl": GDELT_DOCS_URL,
            "asOf": datetime.now(timezone.utc).isoformat(),
            "articles": documents,
            "limitations": [
                "Les résultats sont des pistes de couverture, pas des faits vérifiés ni des sources primaires.",
                "La correspondance nom/ticker peut inclure des homonymes ou des mentions indirectes.",
                "Une date d’indexation ne prouve ni l’heure exacte de publication ni un effet sur le cours.",
            ],
        }
    except HTTPError as error:
        reason = "La source de couverture limite ou refuse temporairement la recherche."
        if error.code == 429:
            reason = "La source de couverture est temporairement limitée; réessayez plus tard."
        result = {"ticker": normalized, "company": asset["name"], "available": False, "reason": reason, "source": "GDELT DOC 2.0", "sourceUrl": GDELT_DOCS_URL, "articles": []}
    except (URLError, TimeoutError, json.JSONDecodeError, OSError, AttributeError):
        result = {"ticker": normalized, "company": asset["name"], "available": False, "reason": reason, "source": "GDELT DOC 2.0", "sourceUrl": GDELT_DOCS_URL, "articles": []}
    # Cache successful empty results too: an empty but available response is a
    # meaningful observation and should not cause repeat calls every refresh.
    if result["available"]:
        ttl = 600
    elif "limitée" in result.get("reason", ""):
        ttl = 300
    else:
        ttl = 120
    expires_at = now + ttl
    _NEWS_CACHE[cache_key] = (expires_at, result)
    _write_shared_news_cache(normalized, result, expires_at)
    return {**result, "articles": result.get("articles", [])[:limit]}


@router.get("/social/{ticker}")
def issuer_social_posts(
    ticker: str,
    limit: int = 15,
    accounts: str | None = None,
) -> dict[str, Any]:
    """Return recent public X posts as leads; optional author handles are user-supplied."""
    normalized = ticker.upper()
    if limit < 1 or limit > 25:
        raise HTTPException(status_code=422, detail="La limite doit être comprise entre 1 et 25.")
    requested_accounts = [part.strip().removeprefix("@").strip() for part in re.split(r"[,\s]+", accounts or "") if part.strip()]
    if any(not re.fullmatch(r"[A-Za-z0-9_]{1,15}", item) for item in requested_accounts):
        raise HTTPException(status_code=422, detail="Indiquez des comptes X valides, séparés par des virgules ou des espaces.")
    normalized_accounts = list(dict.fromkeys(requested_accounts))
    if len(normalized_accounts) > 5:
        results = [issuer_social_posts(ticker, limit, ','.join(normalized_accounts[index:index + 5])) for index in range(0, len(normalized_accounts), 5)]
        posts = {post['id']: post for result in results for post in result.get('posts', [])}
        return {**results[0], 'accounts': normalized_accounts,
                'available': any(result.get('available') for result in results),
                'posts': sorted(posts.values(), key=lambda post: post.get('publishedAt', ''), reverse=True)[:limit],
                'limitations': list(dict.fromkeys([*results[0].get('limitations', []), *[result['reason'] for result in results if not result.get('available') and result.get('reason')]]))}
    asset = _assets().get(normalized)
    if not asset:
        raise HTTPException(status_code=404, detail="Titre absent de l’univers historique configuré.")

    enabled = os.getenv("SIMULATION_X_SEARCH_ENABLED", "").strip().lower() == "true"
    base = {
        "ticker": normalized,
        "company": asset["name"],
        "source": "X API v2 · Recent Search",
        "sourceUrl": X_SEARCH_DOCS_URL,
        "accounts": normalized_accounts,
        "posts": [],
        "limitations": [
            "La recherche récente couvre uniquement les sept derniers jours et n’est pas une archive historique.",
            "Les publications publiques sont des pistes à vérifier; elles ne prouvent pas l’exposition de l’émetteur ni un effet sur le cours.",
            "Les images sont des médias joints par les auteurs; leur contenu ou leur lien avec l’événement n’est pas vérifié.",
        ],
    }
    if not enabled:
        return {**base, "available": False, "reason": "La recherche X est désactivée pour éviter les appels facturables. Elle nécessite une activation serveur explicite."}
    bearer_token = _x_api_bearer_token()
    if not bearer_token:
        return {**base, "available": False, "reason": "La recherche X est activée mais le jeton API serveur n’est pas configuré."}

    cache_key = f"{normalized}:{limit}:{','.join(normalized_accounts)}"
    now = datetime.now(timezone.utc).timestamp()
    cached = _X_POSTS_CACHE.get(cache_key)
    if cached and now - cached[0] < (300 if cached[1]["available"] else 120):
        return cached[1]

    company = asset["name"].replace('"', "").strip()
    safe_ticker = re.sub(r"[^A-Za-z0-9]", "", normalized)
    search_terms = [f'"{company}"']
    if safe_ticker and safe_ticker.isalpha() and len(safe_ticker) <= 6:
        search_terms.append(f"${safe_ticker}")
    else:
        search_terms.append(f'"{normalized}"')
    issuer_query = f'({" OR ".join(search_terms)})'
    author_query = f'({" OR ".join(f"from:{account}" for account in normalized_accounts)})'
    query = f'{author_query} {issuer_query} -is:retweet' if normalized_accounts else f'{" OR ".join(search_terms)} -is:retweet'
    params = urlencode({
        "query": query,
        "max_results": min(limit, 100),
        "tweet.fields": "created_at,author_id,attachments",
        "expansions": "author_id,attachments.media_keys",
        "user.fields": "name,username",
        "media.fields": "type,url,preview_image_url,alt_text",
    })
    request = Request(
        f"{X_RECENT_SEARCH_URL}?{params}",
        headers={"Accept": "application/json", "Authorization": f"Bearer {bearer_token}"},
    )
    reason = "La recherche X est temporairement indisponible."
    result: dict[str, Any]
    try:
        with urlopen(request, timeout=7) as response:
            payload = json.loads(response.read(1_000_001))
        includes = payload.get("includes", {}) if isinstance(payload, dict) else {}
        included_users = includes.get("users", []) if isinstance(includes, dict) else []
        included_media = includes.get("media", []) if isinstance(includes, dict) else []
        authors = {
            item.get("id"): item
            for item in included_users if isinstance(included_users, list)
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
        media = {
            item.get("media_key"): item
            for item in included_media if isinstance(included_media, list)
            if isinstance(item, dict) and isinstance(item.get("media_key"), str)
        }
        posts: list[dict[str, Any]] = []
        post_rows = payload.get("data", []) if isinstance(payload, dict) else []
        for item in post_rows if isinstance(post_rows, list) else []:
            if not isinstance(item, dict):
                continue
            post_id = item.get("id")
            text = item.get("text")
            created_at = item.get("created_at")
            if not isinstance(post_id, str) or not post_id.isdigit() or not isinstance(text, str) or not text.strip():
                continue
            try:
                published_at = datetime.fromisoformat(created_at.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
            except (AttributeError, ValueError):
                continue
            author = authors.get(item.get("author_id"), {})
            username = author.get("username") if isinstance(author, dict) else None
            username = username if isinstance(username, str) and re.fullmatch(r"[A-Za-z0-9_]{1,15}", username) else None
            attached_media = item.get("attachments", {}).get("media_keys", []) if isinstance(item.get("attachments"), dict) else []
            image_url = None
            for media_key in attached_media:
                media_item = media.get(media_key)
                if not isinstance(media_item, dict) or media_item.get("type") != "photo":
                    continue
                candidate = media_item.get("preview_image_url") or media_item.get("url")
                if isinstance(candidate, str) and len(candidate) <= 2048:
                    try:
                        parsed = urlsplit(candidate)
                        if parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password:
                            image_url = candidate
                            break
                    except ValueError:
                        pass
            post = {
                "id": post_id,
                "text": text[:5000],
                "url": f"https://x.com/{username}/status/{post_id}" if username else f"https://x.com/i/web/status/{post_id}",
                "author": author.get("name", username or "Compte X public") if isinstance(author, dict) else (username or "Compte X public"),
                "username": username,
                "publishedAt": published_at,
            }
            if image_url:
                post["imageUrl"] = image_url
            posts.append(post)
            if len(posts) >= limit:
                break
        result = {**base, "available": True, "asOf": datetime.now(timezone.utc).isoformat(), "posts": posts}
    except HTTPError as error:
        reason = "La source X limite ou refuse temporairement la recherche."
        if error.code == 429:
            reason = "La limite d’appels X est atteinte; réessayez après le renouvellement du quota."
        result = {**base, "available": False, "reason": reason}
    except (URLError, TimeoutError, json.JSONDecodeError, OSError, AttributeError):
        result = {**base, "available": False, "reason": reason}
    _X_POSTS_CACHE[cache_key] = (now, result)
    return result


def _x_api_bearer_token() -> str:
    """Read local development credentials or a short-lived cached Secrets Manager value."""
    global _X_SECRET_CACHE
    local_token = os.getenv("X_API_BEARER_TOKEN", "").strip()
    if local_token:
        return local_token
    secret_arn = os.getenv("X_API_BEARER_TOKEN_SECRET_ARN", "").strip()
    if not secret_arn:
        return ""
    now = datetime.now(timezone.utc).timestamp()
    if _X_SECRET_CACHE and now - _X_SECRET_CACHE[0] < 300:
        return _X_SECRET_CACHE[1]
    try:
        response = boto3.client("secretsmanager", region_name=os.getenv("AWS_REGION", "us-east-1")).get_secret_value(SecretId=secret_arn)
        token = response.get("SecretString", "").strip()
    except Exception:
        token = ""
    _X_SECRET_CACHE = (now, token)
    return token


@router.get("/regulations")
def regulations(
    topic: str = Query(default="tariff"),
    page: int = 1,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    """Find dated Federal Register documents; they are leads, not issuer impact claims."""
    term = REGULATION_TERMS.get(topic)
    if not term:
        raise HTTPException(status_code=422, detail="Thème réglementaire non pris en charge.")
    if page < 1 or page > 500:
        raise HTTPException(status_code=422, detail="La page doit être comprise entre 1 et 500.")
    today = date.today().isoformat()
    window_start = start_date or (date.today() - timedelta(days=365 * 5))
    window_end = min(end_date or date.today(), date.today())
    if window_start > window_end:
        raise HTTPException(status_code=422, detail="La date de début doit précéder la date de fin.")
    query = urlencode({
        "per_page": 20,
        "page": page,
        "order": "newest",
        "conditions[term]": term,
        "conditions[publication_date][gte]": window_start.isoformat(),
        "conditions[publication_date][lte]": window_end.isoformat(),
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
        "page": page,
        "startDate": window_start.isoformat(),
        "endDate": window_end.isoformat(),
        "totalDocuments": payload.get("count") if isinstance(payload.get("count"), int) else None,
        "totalPages": payload.get("total_pages") if isinstance(payload.get("total_pages"), int) else None,
        "pageLimit": 500,
        "source": "Federal Register API",
        "sourceUrl": "https://www.federalregister.gov/developers/documentation/api/v1",
        "legalStatus": "La version XML du site est un service informatif; vérifier l’édition officielle liée avant toute interprétation juridique.",
        "documents": documents,
    }


@router.get("/source-catalog")
def source_catalog():
    """Return the explicitly enabled InvestorOS research sources without runtime tools."""
    sites = [{
        "name": source_id,
        "description": source["description"],
        "operations": 1,
        "baseUrl": source.get("url") or f"https://{source['domain']}/",
    } for source_id, source in DEFAULT_SOURCES.items() if source.get("enabled") is True]
    sites.append({
        "name": "x",
        "description": "Lecture de profils publics et de publications récentes X; les publications restent des déclarations attribuées.",
        "operations": 2,
        "baseUrl": "https://x.com/",
    })
    return {"sites": sorted(sites, key=lambda site: (site["name"] != "x", site["name"])), "provider": "InvestorOS · registre des sources autorisées"}


@router.get("/source-operations/{site}")
def source_operations(site: str):
    if not re.fullmatch(r"[a-z0-9-]{1,50}", site):
        raise HTTPException(status_code=422, detail="Source invalide.")
    if site == "x":
        return {
            "baseUrl": "https://x.com/",
            "notes": "Lecture publique uniquement. Les publications X sont des déclarations attribuées; elles ne constituent pas une corroboration indépendante. La visibilité dépend des limites du profil public.",
            "operations": [
                {"name": "getUser", "description": "Lire les informations visibles d’un profil public X.", "readOnly": True, "params": ["username"], "returns": ["nom", "biographie", "abonnés", "date d’inscription"]},
                {"name": "getRecentPosts", "description": "Lire les publications récentes visibles d’un profil public X.", "readOnly": True, "params": ["username"], "returns": ["texte", "date", "lien", "métriques disponibles"]},
            ],
        }
    source = DEFAULT_SOURCES.get(site)
    if not source or source.get("enabled") is not True:
        raise HTTPException(404, "Cette source n’est pas autorisée dans InvestorOS.")
    param = source.get("param")
    operation = source.get("api_operation") or source.get("collection") or "readOfficialSource"
    return {
        "baseUrl": source.get("url") or f"https://{source['domain']}/",
        "notes": source.get("notes", "Lecture documentaire; la portée dépend des données publiées par la source."),
        "operations": [{
            "name": operation,
            "description": source["description"],
            "readOnly": True,
            "params": [param] if param else [],
            "returns": source.get("allowed_claims", []),
        }],
    }


@router.get("/x-profile/{username}")
def public_x_profile(username: str):
    username = username.removeprefix("@")
    if not re.fullmatch(r"[A-Za-z0-9_]{1,15}", username):
        raise HTTPException(status_code=422, detail="Saisissez un nom d’utilisateur X valide (sans URL).")
    recent = _read_public_x_posts(username)
    posts = recent['posts']
    profile = next((post.get('profile') for post in posts if isinstance(post.get('profile'), dict)), None)
    if not profile:
        raise HTTPException(502, recent.get('reason') or 'Le profil X ne fournit aucune publication publique exploitable.')
    return {
        **profile,
        'detailsVersion': 1,
        'username': username,
        'source': recent['source'],
        'latestPost': {
            **{key: posts[0][key] for key in ('id', 'text', 'url') if key in posts[0]},
            'created_at': posts[0].get('created_at') or posts[0].get('publishedAt'),
        } if posts else None,
        'recentPosts': [{
            **{key: post[key] for key in ('id', 'text', 'metrics', 'url', 'images') if key in post},
            'created_at': post.get('created_at') or post.get('publishedAt'),
        } for post in posts],
        'postsObservedAt': recent['observedAt'],
        'postsSource': recent['source'],
        'latestPostReason': None if posts else 'Aucune publication visible sur ce profil public.',
    }


@router.get('/x-posts/{username}')
def public_x_posts(username: str):
    username = username.removeprefix('@')
    if not re.fullmatch(r'[A-Za-z0-9_]{1,15}', username):
        raise HTTPException(422, 'Nom d’utilisateur X invalide.')
    try:
        result = _read_public_x_posts(username)
        return {key: result[key] for key in ('available', 'posts', 'reason', 'source', 'observedAt') if key in result}
    except (OSError, ValueError, KeyError, TypeError):
        return {'available':False, 'posts':[], 'reason':'La lecture publique du fil X est temporairement indisponible.'}


def _read_public_x_posts(username: str) -> dict[str, Any]:
    """Read the versioned public timeline recipe without repository-only Node paths.

    The API Lambda ZIP contains Python application code, not the repository's Node
    scripts or workspace package. Calling those scripts via ``parents[4]`` crashes
    in Lambda because its shallow ``/var/task`` layout has no such parent.
    """
    from .profiles.x_evidence import read_public_posts

    source_posts = read_public_posts(username)
    posts = [{
        **post,
        'author': post.get('author') or username,
        'created_at': post.get('publishedAt') or post.get('created_at'),
    } for post in source_posts]
    return {
        'available': True,
        'posts': posts,
        'source': 'X · fil public (recette versionnée)',
        'observedAt': datetime.now(timezone.utc).isoformat(),
        **({'reason': 'Aucune publication visible sur ce profil public.'} if not posts else {}),
    }
