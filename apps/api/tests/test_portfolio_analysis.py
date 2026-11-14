"""Portfolio tool tests: deterministic calculations and fixed demo data boundary."""

import json
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from investoros_api.profiles.models import ScenarioAnalysisInput
from investoros_api.profiles.portfolio import (
    calculate_portfolio_scenario,
    load_demo_portfolio,
    summarize_portfolio,
)


class DynamoStub:
    def __init__(self, item):
        self.item = item
        self.request = None

    def get_item(self, **kwargs):
        self.request = kwargs
        return {"Item": self.item}


class PortfolioAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.portfolio = {
            "display_name": "Portefeuille fictif",
            "currency": "CAD",
            "as_of": "fixture",
            "total_value": 100_000,
            "data_source": "fictional_fixture",
            "positions": [
                {"id": "stocks", "label": "Actions", "weight_pct": 40, "value": 40_000},
                {"id": "bonds", "label": "Obligations", "weight_pct": 25, "value": 25_000},
                {"id": "cash", "label": "Liquidités", "weight_pct": 35, "value": 35_000},
            ],
        }

    def test_summary_calculates_exposure_and_discloses_missing_price_history(self):
        result = summarize_portfolio(self.portfolio)
        self.assertEqual(result["weightTotalPct"], 100)
        self.assertEqual(result["largestPositionPct"], 40)
        self.assertEqual(result["topThreeWeightPct"], 100)
        self.assertEqual(result["concentrationIndex"], 0.345)
        self.assertIn(
            "return, volatility and drawdown are not calculated.",
            result["provenance"]["limitations"][0],
        )

    def test_summary_rejects_incomplete_weight_totals(self):
        self.portfolio["positions"][0]["weight_pct"] = 20
        with self.assertRaisesRegex(ValueError, "proche de 100"):
            summarize_portfolio(self.portfolio)

    def test_scenario_applies_only_explicit_shocks_and_discloses_assumptions(self):
        scenario = ScenarioAnalysisInput.model_validate({
            "name": "Repli des actions",
            "shocks": [{"positionId": "stocks", "shockPct": -25}],
        })

        result = calculate_portfolio_scenario(self.portfolio, scenario)

        self.assertEqual(result["baselineValue"], 100_000)
        self.assertEqual(result["scenarioValue"], 90_000)
        self.assertEqual(result["changeValue"], -10_000)
        self.assertEqual(result["positions"][0]["scenarioValue"], 30_000)
        self.assertEqual(result["positions"][1]["scenarioValue"], 25_000)
        self.assertEqual(result["provenance"]["assumptions"], "user_supplied_conditional_shocks")

    def test_scenario_rejects_positions_outside_the_configured_portfolio(self):
        scenario = ScenarioAnalysisInput.model_validate({
            "name": "Inconnu",
            "shocks": [{"positionId": "not-a-position", "shockPct": -25}],
        })
        with self.assertRaisesRegex(ValueError, "position absente"):
            calculate_portfolio_scenario(self.portfolio, scenario)

    def test_scenario_validation_rejects_duplicate_positions_and_out_of_range_shocks(self):
        with self.assertRaisesRegex(ValueError, "une seule fois"):
            ScenarioAnalysisInput.model_validate({
                "name": "Doublon",
                "shocks": [
                    {"positionId": "stocks", "shockPct": -10},
                    {"positionId": "stocks", "shockPct": 10},
                ],
            })
        with self.assertRaises(ValueError):
            ScenarioAnalysisInput.model_validate({
                "name": "Hors limites",
                "shocks": [{"positionId": "stocks", "shockPct": -101}],
            })

    @patch.dict(
        os.environ,
        {
            "DEMO_ACCOUNT_ID": "demo-account",
            "DEMO_PROFILE_ID": "demo-profile",
            "DEMO_PORTFOLIO_ID": "demo-portfolio",
            "PORTFOLIOS_TABLE_NAME": "portfolios-table",
        },
    )
    def test_loader_uses_only_server_configured_demo_keys(self):
        item = {
            "account_id": {"S": "demo-account"},
            "payload": {"S": json.dumps({**self.portfolio, "profile_id": "demo-profile"})},
        }
        client = DynamoStub(item)
        loaded = load_demo_portfolio(client=client)
        self.assertEqual(loaded["display_name"], "Portefeuille fictif")
        self.assertEqual(
            client.request["Key"],
            {"account_id": {"S": "demo-account"}, "portfolio_id": {"S": "demo-portfolio"}},
        )

    @patch.dict(os.environ, {"DEMO_PORTFOLIO_MODE": "local_fixture"}, clear=True)
    def test_local_fixture_mode_loads_the_selected_persona_and_marks_its_source(self):
        portfolio = load_demo_portfolio(persona="amira")
        result = summarize_portfolio(portfolio)

        self.assertEqual(portfolio["display_name"], "Portefeuille croissance diversifié (démo)")
        self.assertEqual(result["weightTotalPct"], 100)
        self.assertEqual(result["topThreeWeightPct"], 80)
        self.assertEqual(result["provenance"]["classification"], "local_fictional_fixture")
        self.assertEqual(result["provenance"]["source"], "Local fictional persona fixture")

    @patch.dict(
        os.environ,
        {"DEMO_PORTFOLIO_MODE": "local_fixture", "AWS_LAMBDA_FUNCTION_NAME": "investoros-api"},
        clear=True,
    )
    def test_local_fixtures_are_rejected_in_lambda(self):
        with self.assertRaises(HTTPException) as raised:
            load_demo_portfolio(persona="mateo")
        self.assertEqual(raised.exception.status_code, 503)

    @patch.dict(
        os.environ,
        {
            "DEMO_ACCOUNT_ID": "demo-account",
            "DEMO_PROFILE_ID": "demo-profile",
            "DEMO_PORTFOLIO_ID": "demo-portfolio",
            "PORTFOLIOS_TABLE_NAME": "portfolios-table",
        },
    )
    def test_loader_rejects_portfolio_linked_to_another_profile(self):
        item = {
            "account_id": {"S": "demo-account"},
            "payload": {"S": json.dumps({**self.portfolio, "profile_id": "different-profile"})},
        }
        with self.assertRaises(HTTPException) as raised:
            load_demo_portfolio(client=DynamoStub(item))
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
