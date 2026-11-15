"""Read-only, deterministic analysis of the configured fictional demo portfolio."""

import json
import math
import os
from decimal import Decimal
from pathlib import Path
from typing import Any

import boto3
from fastapi import HTTPException

from investoros_api.demo_contexts import PersonaId, context_for
from .models import ScenarioAnalysisInput


def _local_fictional_portfolio(persona: PersonaId) -> dict[str, Any]:
    fixture_path = Path(__file__).resolve().parents[1] / "demo_personas.json"
    try:
        fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
        selected = fixtures[persona]
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as error:
        raise HTTPException(status_code=503, detail="Local demo portfolio is not available") from error

    positions = selected.get("positions")
    if not isinstance(positions, list) or not positions:
        raise HTTPException(status_code=503, detail="Local demo portfolio is invalid")
    return {
        "display_name": selected["portfolio_name"],
        "currency": "CAD",
        "as_of": "fixture",
        "total_value": sum(position["value"] for position in positions),
        "data_source": "local_fictional_fixture",
        "profile_id": selected["profile_id"],
        "positions": positions,
    }


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


def load_demo_portfolio(client=None, persona: PersonaId = "mateo") -> dict[str, Any]:
    """Load a local fixture in dev or fetch the deployment's fixed DynamoDB portfolio."""
    mode = os.getenv("DEMO_PORTFOLIO_MODE", "dynamodb")
    if mode == "local_fixture":
        if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
            raise HTTPException(status_code=503, detail="Local demo data is disabled in AWS")
        return _local_fictional_portfolio(persona)
    if mode != "dynamodb":
        raise HTTPException(status_code=503, detail="Demo portfolio mode is invalid")

    context = context_for(persona)
    account_id = context["account_id"]
    profile_id = context["profile_id"]
    portfolio_id = context["portfolio_id"]
    table_name = os.getenv("PORTFOLIOS_TABLE_NAME", "")
    if not table_name:
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
        "lookThroughAvailable": False,
        "namedAssetFitAssessment": {
            "status": "insufficient_data_for_named_asset_fit",
            "diversificationChangeComputable": False,
            "requiredInputs": ["instrument-level holdings", "proposed weight", "funding source"],
            "interpretation": "Broad demo position labels do not prove that a named asset is held or that adding it improves or worsens diversification.",
        },
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
            "source": (
                "Local fictional persona fixture"
                if portfolio.get("data_source") == "local_fictional_fixture"
                else "Configured fictional DynamoDB demo portfolio"
            ),
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
                "Position labels are broad demo categories; no constituent look-through proves that a named asset is held.",
                (
                    "This is the single portfolio configured for the deployment and may not "
                    "match the selected chat persona."
                ),
            ],
            "moduleUrl": "/app/portfolios",
        },
    }


def analyze_configured_portfolio(client=None, persona: PersonaId = "mateo") -> dict[str, Any]:
    result = summarize_portfolio(load_demo_portfolio(client=client, persona=persona))
    result["persona"] = persona
    result["provenance"]["moduleUrl"] = f"/app/portfolios?persona={persona}"
    return result


def calculate_portfolio_scenario(
    portfolio: dict[str, Any], scenario: ScenarioAnalysisInput
) -> dict[str, Any]:
    """Apply user-supplied percentage shocks to named fixture positions; this is not a forecast."""
    summary = summarize_portfolio(portfolio)
    positions = portfolio["positions"]
    by_id = {position.get("id"): position for position in positions if isinstance(position, dict)}
    shocks = {item.positionId: item.shockPct for item in scenario.shocks}
    unknown = set(shocks) - set(by_id)
    if unknown:
        raise ValueError("Le scénario contient une position absente du portefeuille.")

    results = []
    total_change = 0.0
    for position in positions:
        position_id = position.get("id")
        if not isinstance(position_id, str) or not position_id:
            raise ValueError("Une position du portefeuille n’a pas d’identifiant stable.")
        baseline = position["value"]
        shock_pct = shocks.get(position_id, 0.0)
        change = baseline * shock_pct / 100
        scenario_value = baseline + change
        total_change += change
        results.append({
            "positionId": position_id,
            "label": position["label"],
            "baselineValue": round(float(baseline), 2),
            "shockPct": round(float(shock_pct), 2),
            "changeValue": round(float(change), 2),
            "scenarioValue": round(float(scenario_value), 2),
        })

    baseline_total = summary["totalValue"]
    scenario_total = baseline_total + total_change
    return {
        "name": scenario.name,
        "currency": summary["currency"],
        "baselineValue": round(baseline_total, 2),
        "scenarioValue": round(scenario_total, 2),
        "changeValue": round(total_change, 2),
        "changePct": round(total_change / baseline_total * 100, 2),
        "positions": results,
        "provenance": {
            "portfolio": "fictional_fixture",
            "assumptions": "user_supplied_conditional_shocks",
            "limitations": [
                "Conditional arithmetic only; not a price forecast, return estimate, or investment recommendation.",
                "Positions without a supplied shock are held unchanged.",
                "Does not model correlations, liquidity, fees, taxes, distributions, or rebalancing.",
            ],
        },
    }


def analyze_configured_scenario(
    scenario: ScenarioAnalysisInput, persona: PersonaId = "mateo", client=None
) -> dict[str, Any]:
    portfolio = load_demo_portfolio(client=client, persona=persona)
    result = calculate_portfolio_scenario(portfolio, scenario)
    result["persona"] = persona
    result["provenance"]["moduleUrl"] = f"/app/scenarios?persona={persona}"
    return result
