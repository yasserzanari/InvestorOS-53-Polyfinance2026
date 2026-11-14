"""Read-only historical market data and dated corporate actions for Simulation."""

import csv
import json
import os
from datetime import date, datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator

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


class ScenarioBranch(BaseModel):
    id: str = Field(min_length=1, max_length=40, pattern=r"^[a-zA-Z0-9_-]+$")
    title: str = Field(min_length=1, max_length=80)
    event: str = Field(min_length=1, max_length=160)
    shockPct: float = Field(ge=-80, le=100)
    eventAfterObservations: int = Field(ge=0, le=120)


class ScenarioProjectionRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=16)
    horizonObservations: int = Field(ge=20, le=120)
    branches: list[ScenarioBranch] = Field(min_length=2, max_length=4)

    @field_validator("horizonObservations")
    @classmethod
    def supported_horizon(cls, value: int) -> int:
        if value not in (20, 60, 120):
            raise ValueError("Horizon must be 20, 60 or 120 observations")
        return value

    @model_validator(mode="after")
    def unique_branch_ids_and_valid_offsets(self):
        ids = [branch.id for branch in self.branches]
        if len(ids) != len(set(ids)):
            raise ValueError("Branch ids must be unique")
        if any(branch.eventAfterObservations > self.horizonObservations for branch in self.branches):
            raise ValueError("An event cannot occur after the selected horizon")
        return self


_SEC_CACHE: dict[str, tuple[float, Any]] = {}
_NEWS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


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


def _quantile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


@router.post("/scenarios")
def project_scenarios(request: ScenarioProjectionRequest) -> dict[str, Any]:
    """Calculate user-specified event shocks against empirical historical return ranges."""
    ticker = request.ticker.upper()
    if ticker not in _assets():
        raise HTTPException(status_code=404, detail="Titre absent de l’univers historique configuré.")
    historical = history(ticker, start=None, end=None)
    prices = historical["prices"]
    starting_price = prices[-1]["adjustedClose"]
    as_of = prices[-1]["date"]
    if len(prices) < 22:
        raise HTTPException(status_code=422, detail="Il faut au moins 22 observations historiques pour calculer une référence.")

    horizons = sorted(set([0, request.horizonObservations, *(round(request.horizonObservations * i / 6) for i in range(1, 6))] + [branch.eventAfterObservations for branch in request.branches]))
    baseline = []
    for horizon in horizons:
        if horizon == 0:
            baseline.append({"observations": 0, "p10Pct": 0.0, "p50Pct": 0.0, "p90Pct": 0.0})
            continue
        returns = [
            prices[index + horizon]["adjustedClose"] / prices[index]["adjustedClose"] - 1
            for index in range(len(prices) - horizon)
        ]
        if len(returns) < 20:
            raise HTTPException(status_code=422, detail="Pas assez de fenêtres historiques pour cet horizon.")
        baseline.append({
            "observations": horizon,
            "p10Pct": round(_quantile(returns, 0.10) * 100, 4),
            "p50Pct": round(_quantile(returns, 0.50) * 100, 4),
            "p90Pct": round(_quantile(returns, 0.90) * 100, 4),
        })

    branches = []
    for branch in request.branches:
        event_factor = 1 + branch.shockPct / 100
        event_time = branch.eventAfterObservations
        path = []
        for point in baseline:
            event_applied = point["observations"] >= event_time
            factor = event_factor if event_applied else 1.0
            path.append({
                "observations": point["observations"],
                "eventApplied": event_applied,
                "lowerPrice": round(starting_price * (1 + point["p10Pct"] / 100) * factor, 4),
                "medianPrice": round(starting_price * (1 + point["p50Pct"] / 100) * factor, 4),
                "upperPrice": round(starting_price * (1 + point["p90Pct"] / 100) * factor, 4),
            })
        branches.append({
            "id": branch.id,
            "title": branch.title,
            "event": branch.event,
            "shockPct": branch.shockPct,
            "eventAfterObservations": event_time,
            "path": path,
        })

    return {
        "ticker": ticker,
        "horizonObservations": request.horizonObservations,
        "asOf": as_of,
        "startingPrice": starting_price,
        "currency": historical["currency"],
        "source": historical["source"],
        "branches": branches,
        "method": "À chaque jalon, les percentiles 10/50/90 sont calculés sur toutes les fenêtres historiques du même titre et de même durée disponibles dans le jeu. Le choc indiqué par l’utilisateur est appliqué au jalon choisi, puis multiplié aux percentiles historiques suivants. Les points intermédiaires sont des quantiles marginaux, pas des trajectoires individuelles cohérentes.",
        "limitations": [
            "Les pourcentages de choc sont des hypothèses saisies par l’utilisateur; ils ne sont pas estimés par le modèle.",
        "Cette projection conditionnelle n’est pas une prévision et n’établit ni probabilité de scénario ni causalité événement-cours.",
            "Le cours de départ est le dernier cours du paquet configuré; il peut être différé par rapport au marché actuel.",
            "Les quantiles historiques ne tiennent pas compte d’un changement de régime, de volatilité future, d’impôts ou des positions d’un portefeuille.",
        ],
    }


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
def issuer_filings(ticker: str, limit: int = 30) -> dict[str, Any]:
    """Return recent primary-source SEC filings; never infer their market impact."""
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

    recent = submissions.get("filings", {}).get("recent", {}) if isinstance(submissions, dict) else {}
    accessions = recent.get("accessionNumber", []) if isinstance(recent, dict) else []

    def field(name: str, index: int, default: Any = "") -> Any:
        values = recent.get(name, []) if isinstance(recent, dict) else []
        return values[index] if isinstance(values, list) and index < len(values) else default

    filings = []
    for index, accession in enumerate(accessions):
        form = field("form", index)
        if form not in {"8-K", "10-K", "10-Q", "6-K", "20-F", "40-F"}:
            continue
        filing_date = field("filingDate", index)
        if not filing_date:
            continue
        accession_path = accession.replace("-", "")
        primary_document = field("primaryDocument", index)
        document_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession_path}/{primary_document}" if primary_document else f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession_path}/"
        filings.append({
            "id": f"sec:{accession}",
            "form": form,
            "filedAt": filing_date,
            "reportedAt": field("reportDate", index) or None,
            "acceptedAt": field("acceptanceDateTime", index) or None,
            "title": field("primaryDocDescription", index) or f"Dépôt {form}",
            "url": document_url,
            "accessionNumber": accession,
        })
        if len(filings) >= limit:
            break
    return {
        "ticker": normalized,
        "company": company,
        "cik": cik,
        "available": True,
        "source": "SEC EDGAR Submissions API",
        "sourceUrl": "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
        "asOf": datetime.now(timezone.utc).isoformat(),
        "filings": filings,
        "limitations": ["Les dépôts sont les déclarations de l’émetteur, pas une vérification indépendante.", "Un formulaire, une date de dépôt et son cours postérieur ne prouvent pas que le dépôt a causé ce mouvement."],
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

    cache_key = f"{normalized}:{limit}"
    now = datetime.now(timezone.utc).timestamp()
    cached = _NEWS_CACHE.get(cache_key)
    if cached and now - cached[0] < (600 if cached[1]["available"] else 120):
        return cached[1]

    # GDELT is discovery coverage, not a primary source or an issuer-identity check.
    # Keep the query bounded and escape user-visible company text through urlencode.
    query = f'"{asset["name"]}" OR {normalized}'
    params = urlencode({
        "query": query,
        "mode": "ArtList",
        "format": "json",
        "sort": "DateDesc",
        "maxrecords": limit,
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
                "publishedAt": published_at,
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
    _NEWS_CACHE[cache_key] = (now, result)
    return result


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
