"""Read-only, deterministic analysis of the configured fictional demo portfolio."""

import json
import math
import os
from decimal import Decimal
from typing import Any

import boto3
from fastapi import HTTPException


def _plain_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _plain_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_plain_value(item) for item in value]
    return value


def _portfolio_payload(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not item:
        return None
    raw = item.get("payload", {}).get("S")
    if not isinstance(raw, str):
        raise HTTPException(status_code=502, detail="Demo portfolio payload is invalid")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="Demo portfolio payload is invalid") from error
    return payload if isinstance(payload, dict) else None


def load_demo_portfolio(client=None) -> dict[str, Any]:
    """Fetch the fixed portfolio configured for this deployment, never a client-selected key."""
    account_id = os.getenv("DEMO_ACCOUNT_ID", "")
    profile_id = os.getenv("DEMO_PROFILE_ID", "")
    portfolio_id = os.getenv("DEMO_PORTFOLIO_ID", "")
    table_name = os.getenv("PORTFOLIOS_TABLE_NAME", "")
    if not all((account_id, profile_id, portfolio_id, table_name)):
        raise HTTPException(status_code=503, detail="Demo portfolio is not configured")

    dynamodb = client or boto3.client("dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1"))
    response = dynamodb.get_item(
        TableName=table_name,
        Key={"account_id": {"S": account_id}, "portfolio_id": {"S": portfolio_id}},
        ConsistentRead=True,
    )
    item = response.get("Item")
    portfolio = _portfolio_payload(item)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Demo portfolio was not found")
    if (
        item.get("account_id", {}).get("S") != account_id
        or portfolio.get("profile_id") != profile_id
    ):
        raise HTTPException(
            status_code=403, detail="Demo portfolio is outside the configured context"
        )
    return _plain_value(portfolio)


def summarize_portfolio(portfolio: dict[str, Any]) -> dict[str, Any]:
    """Calculate exposure and concentration from stated positions; do not infer returns."""
    positions = portfolio.get("positions")
    if not isinstance(positions, list) or not positions:
        raise ValueError("Le portefeuille ne contient aucune position exploitable.")

    normalized = []
    for position in positions:
        if not isinstance(position, dict):
            raise ValueError("Une position du portefeuille est invalide.")
        label = position.get("label")
        weight = position.get("weight_pct")
        value = position.get("value")
        if (
            not isinstance(label, str)
            or not label.strip()
            or isinstance(weight, bool)
            or not isinstance(weight, (int, float))
            or isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(weight)
            or not math.isfinite(value)
            or weight < 0
            or value < 0
        ):
            raise ValueError("Une position du portefeuille contient des valeurs invalides.")
        normalized.append({"label": label, "weightPct": float(weight), "value": float(value)})

    total_weight = sum(position["weightPct"] for position in normalized)
    if not math.isclose(total_weight, 100.0, abs_tol=0.5):
        raise ValueError("La somme des pondérations doit être proche de 100 %.")
    total_value = portfolio.get("total_value")
    if (
        isinstance(total_value, bool)
        or not isinstance(total_value, (int, float))
        or not math.isfinite(total_value)
        or total_value <= 0
    ):
        raise ValueError("La valeur totale du portefeuille est invalide.")
    positions_value = sum(position["value"] for position in normalized)
    if not math.isclose(positions_value, total_value, rel_tol=0.005):
        raise ValueError("La valeur des positions ne correspond pas au total déclaré.")

    sorted_positions = sorted(normalized, key=lambda position: position["weightPct"], reverse=True)
    return {
        "portfolioName": portfolio.get("display_name", "Portefeuille de démonstration"),
        "currency": portfolio.get("currency"),
        "asOf": portfolio.get("as_of"),
        "totalValue": float(total_value),
        "positionCount": len(normalized),
        "weightTotalPct": round(total_weight, 2),
        "largestPositionPct": round(sorted_positions[0]["weightPct"], 2),
        "topThreeWeightPct": round(
            sum(position["weightPct"] for position in sorted_positions[:3]), 2
        ),
        "concentrationIndex": round(
            sum((position["weightPct"] / 100) ** 2 for position in normalized), 4
        ),
        "positions": sorted_positions,
        "provenance": {
            "classification": portfolio.get("data_source", "unknown"),
            "source": "Configured fictional DynamoDB demo portfolio",
            "method": (
                "Sum of stated position weights; concentration index is the sum of squared "
                "portfolio weights."
            ),
            "limitations": [
                (
                    "No price history is available, so return, volatility and drawdown are not "
                    "calculated."
                ),
                "Positions and weights come from a fictional fixture, not a brokerage account.",
                (
                    "This is the single portfolio configured for the deployment and may not "
                    "match the selected chat persona."
                ),
            ],
            "moduleUrl": "/app/portfolios",
        },
    }


def analyze_configured_portfolio(client=None) -> dict[str, Any]:
    return summarize_portfolio(load_demo_portfolio(client))
