"""Portfolio tool tests: deterministic calculations and fixed demo data boundary."""

import json
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from investoros_api.profiles.portfolio import load_demo_portfolio, summarize_portfolio


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
                {"label": "Actions", "weight_pct": 40, "value": 40_000},
                {"label": "Obligations", "weight_pct": 25, "value": 25_000},
                {"label": "Liquidités", "weight_pct": 35, "value": 35_000},
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
        loaded = load_demo_portfolio(client)
        self.assertEqual(loaded["display_name"], "Portefeuille fictif")
        self.assertEqual(
            client.request["Key"],
            {"account_id": {"S": "demo-account"}, "portfolio_id": {"S": "demo-portfolio"}},
        )

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
            load_demo_portfolio(DynamoStub(item))
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
