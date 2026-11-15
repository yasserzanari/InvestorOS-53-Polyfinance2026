"""Read the optional AlphaForge starter pack and calculate auditable asset facts."""

from __future__ import annotations

import csv
import math
import os
import tempfile
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

FILES = (
    "assets_universe.csv",
    "prices_daily.csv",
    "corporate_actions.csv",
    "fx_usdcad_daily.csv",
    "macro_rates.csv",
    "sources_metadata.csv",
)
REQUIRED = {
    "assets_universe.csv": {"ticker", "name", "asset_class", "currency"},
    "prices_daily.csv": {"date", "ticker", "adj_close", "volume", "currency"},
    "corporate_actions.csv": {"ex_date", "ticker", "action", "value", "unit"},
    "fx_usdcad_daily.csv": {"date", "usdcad", "cadusd"},
    "macro_rates.csv": {"date", "series_id", "value", "unit", "frequency", "source"},
    "sources_metadata.csv": {"file", "source", "source_url", "retrieved_on", "processing", "limitations", "terms_of_use"},
}
def _default_local_dir() -> Path:
    """Find the checkout's local fixture without assuming the Lambda path depth."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / "local" / "alphaforge_starter"
        if candidate.is_dir():
            return candidate
    return Path(tempfile.gettempdir()) / "investoros-alphaforge-starter"


_LOCAL_DIR = _default_local_dir()


class DatasetUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class AssetSeries:
    ticker: str
    asset_class: str
    currency: str
    rows: tuple[tuple[str, float], ...]
    metadata: dict[str, str]


def _dataset_dir() -> Path:
    configured = os.getenv("STARTER_DATASET_DIR", "").strip()
    if configured:
        return Path(configured).expanduser()
    return _LOCAL_DIR


def _load_from_s3(bucket: str, prefix: str) -> Path:
    """Download the fixed six-file pack into Lambda /tmp; never accept keys from prompts."""
    import boto3

    root = Path(tempfile.gettempdir()) / "investoros-alphaforge-starter"
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    client = boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-1"))
    base = prefix.strip("/")
    for filename in FILES:
        destination = root / filename
        client.download_file(bucket, f"{base}/{filename}" if base else filename, str(destination))
    return root


@lru_cache(maxsize=1)
def _resolve_dir() -> Path:
    bucket = os.getenv("STARTER_DATASET_BUCKET", "").strip()
    if bucket:
        return _load_from_s3(bucket, os.getenv("STARTER_DATASET_PREFIX", "alphaforge_starter"))
    return _dataset_dir()


def _read_csv(directory: Path, filename: str) -> list[dict[str, str]]:
    path = directory / filename
    if not path.is_file():
        raise DatasetUnavailable(f"Paquet AlphaForge absent: {filename}.")
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        missing = REQUIRED[filename] - set(reader.fieldnames or ())
        if missing:
            raise DatasetUnavailable(f"Colonnes manquantes dans {filename}: {', '.join(sorted(missing))}.")
        return list(reader)


@lru_cache(maxsize=1)
def _dataset() -> tuple[dict[str, dict[str, str]], dict[str, tuple[tuple[str, float, float], ...]], dict[str, dict[str, str]]]:
    directory = _resolve_dir()
    assets = {row["ticker"].strip().upper(): row for row in _read_csv(directory, "assets_universe.csv")}
    metadata = {row["file"].strip(): row for row in _read_csv(directory, "sources_metadata.csv")}
    price_rows: dict[str, list[tuple[str, float, float]]] = {}
    seen: set[tuple[str, str]] = set()
    for row_number, row in enumerate(_read_csv(directory, "prices_daily.csv"), start=2):
        ticker = row["ticker"].strip().upper()
        date = row["date"].strip()
        try:
            value = float(row["adj_close"])
            volume = float(row["volume"] or 0)
        except (TypeError, ValueError) as error:
            raise DatasetUnavailable(f"Prix invalide à la ligne {row_number} de prices_daily.csv.") from error
        if not date or not math.isfinite(value) or value <= 0 or not math.isfinite(volume):
            raise DatasetUnavailable(f"Observation invalide à la ligne {row_number} de prices_daily.csv.")
        key = (ticker, date)
        if key in seen:
            raise DatasetUnavailable(f"Observation dupliquée pour {ticker} le {date}.")
        seen.add(key)
        price_rows.setdefault(ticker, []).append((date, value, volume))
    prices = {ticker: tuple(sorted(rows)) for ticker, rows in price_rows.items()}
    if not assets or not prices:
        raise DatasetUnavailable("Le paquet AlphaForge ne contient aucun actif exploitable.")
    return assets, prices, metadata


def available_tickers() -> set[str]:
    assets, _, _ = _dataset()
    return set(assets)


def calculate_asset_history(ticker: str) -> dict[str, Any]:
    assets, prices, metadata = _dataset()
    normalized = ticker.strip().upper()
    if normalized not in assets or normalized not in prices:
        raise DatasetUnavailable(f"{normalized} n'est pas présent dans l'univers AlphaForge.")
    asset = assets[normalized]
    series = prices[normalized]
    returns = [current[1] / prior[1] - 1 for prior, current in zip(series, series[1:])]
    mean = sum(returns) / len(returns) if returns else 0.0
    variance = sum((value - mean) ** 2 for value in returns) / len(returns) if returns else 0.0
    annualization = 365 if asset.get("asset_class", "").strip().lower() in {"crypto", "cryptocurrency", "cryptoasset"} else 252
    peak = series[0][1]
    max_drawdown = 0.0
    for _, price, _ in series:
        peak = max(peak, price)
        max_drawdown = min(max_drawdown, price / peak - 1)
    source_metadata = metadata.get("prices_daily.csv", {})
    actions = _read_csv(_resolve_dir(), "corporate_actions.csv")
    cnq_warning = normalized == "CNQ.TO" and any(
        row.get("ticker", "").strip().upper() == normalized
        and row.get("ex_date", "").strip() == "2022-08-22"
        for row in actions
    )
    zero_volume_dates = [date for date, _, volume in series if volume == 0]
    cautions = [
        "L’univers AlphaForge a été sélectionné en 2026; un backtest comporte un biais du survivant.",
        "adj_close reflète la méthode Yahoo Finance et peut être révisé lors d’une nouvelle extraction.",
        "Le rendement historique décrit la période observée et ne prédit pas les rendements futurs.",
    ]
    if cnq_warning:
        cautions.append("L’action CNQ.TO du 22 août 2022 est signalée comme anomalie à vérifier auprès de l’émetteur.")
    if zero_volume_dates:
        cautions.append(f"Volume nul observé le {', '.join(zero_volume_dates[:5])}; vérifier son traitement.")
    return {
        "ticker": normalized,
        "name": asset.get("name", normalized),
        "asset_class": asset.get("asset_class", "unknown"),
        "currency": asset.get("currency", "unknown"),
        "period": {"start": series[0][0], "end": series[-1][0]},
        "observations": len(series),
        "adjusted_close_start": series[0][1],
        "adjusted_close_end": series[-1][1],
        "historical_total_return_pct": (series[-1][1] / series[0][1] - 1) * 100,
        "annualized_volatility_pct": math.sqrt(variance * annualization) * 100,
        "maximum_drawdown_pct": max_drawdown * 100,
        "annualization_observations_per_year": annualization,
        "method": "Rendement calculé à partir des variations adj_close observées; volatilité annualisée à partir des rendements observés; repli maximal calculé depuis les sommets séquentiels.",
        "dataset_source": source_metadata.get("source", "AlphaForge starter dataset"),
        "dataset_source_url": source_metadata.get("source_url", ""),
        "retrieved_on": source_metadata.get("retrieved_on", ""),
        "processing": source_metadata.get("processing", ""),
        "source_limitations": source_metadata.get("limitations", ""),
        "terms_of_use": source_metadata.get("terms_of_use", ""),
        "cautions": cautions,
        "simulation_material": True,
    }
