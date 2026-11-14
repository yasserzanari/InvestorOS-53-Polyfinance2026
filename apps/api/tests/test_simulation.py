import csv
import json
import os
from datetime import date, timedelta
from io import BytesIO
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from investoros_api import simulation
from investoros_api.simulation import ScenarioBranch, ScenarioProjectionRequest


class SimulationHistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = self.temp.name
        self.write_csv("assets_universe.csv", [
            {"asset_id": "A1", "ticker": "ABC", "name": "Example Corp", "asset_class": "equity", "market": "NYSE", "currency": "USD", "sector": "Technology"},
        ])
        self.write_csv("prices_daily.csv", [
            {"date": f"2025-01-0{day}", "ticker": "ABC", "adj_close": str(price), "volume": "100", "currency": "USD"}
            for day, price in enumerate((100, 110, 99, 121), 1)
        ])
        self.write_csv("corporate_actions.csv", [
            {"ex_date": "2025-01-02", "ticker": "ABC", "action": "dividend", "value": "0.5", "unit": "USD per share"},
        ])
        self.patcher = patch.dict(os.environ, {"SIMULATION_DATA_DIR": self.directory})
        self.patcher.start()
        simulation._assets.cache_clear()
        simulation._SEC_CACHE.clear()

    def tearDown(self):
        self.patcher.stop()
        simulation._assets.cache_clear()
        simulation._SEC_CACHE.clear()
        self.temp.cleanup()

    def write_csv(self, filename, rows):
        with open(os.path.join(self.directory, filename), "w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    def test_history_returns_adjusted_prices_and_observed_event_windows(self):
        result = simulation.history("abc", start=None, end=None)
        self.assertEqual([point["adjustedClose"] for point in result["prices"]], [100, 110, 99, 121])
        self.assertEqual(result["events"][0]["observedPriceDate"], "2025-01-02")
        self.assertEqual(result["events"][0]["observedReturnsPct"]["1observations"], -10.0)
        self.assertIsNone(result["events"][0]["observedReturnsPct"]["5observations"])
        self.assertIn("ne démontre pas", result["limitations"][0])

    def test_unknown_ticker_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            simulation.history("unknown")
        self.assertEqual(raised.exception.status_code, 404)

    def test_invalid_date_order_is_rejected(self):
        from datetime import date

        with self.assertRaises(HTTPException) as raised:
            simulation.history("ABC", start=date(2025, 2, 1), end=date(2025, 1, 1))
        self.assertEqual(raised.exception.status_code, 422)

    @patch("investoros_api.simulation.urlopen")
    def test_regulation_search_returns_dated_primary_links_and_excludes_future(self, open_url):
        open_url.return_value = BytesIO(json.dumps({"results": [
            {"document_number": "2025-1", "title": "Trade rule", "type": "Rule", "publication_date": "2025-02-01", "html_url": "https://www.federalregister.gov/documents/2025-1", "pdf_url": "https://www.govinfo.gov/documents/2025-1", "abstract": "Published rule", "agencies": [{"name": "Commerce"}]},
            {"document_number": "future", "title": "Scheduled rule", "publication_date": "2999-01-01", "html_url": "https://www.federalregister.gov/documents/future"},
        ]}).encode())

        result = simulation.regulations("tariff")

        self.assertEqual([item["id"] for item in result["documents"]], ["2025-1"])
        self.assertEqual(result["documents"][0]["agencies"], ["Commerce"])
        self.assertEqual(result["documents"][0]["officialPdfUrl"], "https://www.govinfo.gov/documents/2025-1")
        self.assertIn("informatif", result["legalStatus"])
        self.assertIn("Federal Register API", result["source"])

    def test_regulation_search_only_accepts_supported_topics(self):
        with self.assertRaises(HTTPException) as raised:
            simulation.regulations("anything")
        self.assertEqual(raised.exception.status_code, 422)

    def test_projection_applies_only_explicit_shocks_to_empirical_quantiles(self):
        self.write_csv("prices_daily.csv", [
            {"date": observed.isoformat(), "ticker": "ABC", "adj_close": str(100 + i), "volume": "100", "currency": "USD"}
            for i in range(151)
            for observed in [date(2025, 1, 1) + timedelta(days=i)]
        ])
        request = ScenarioProjectionRequest(
            ticker="ABC",
            horizonObservations=20,
            branches=[
                ScenarioBranch(id="down", title="Baisse", event="Tarif", shockPct=-10, eventAfterObservations=0),
                ScenarioBranch(id="base", title="Stable", event="Tarif", shockPct=0, eventAfterObservations=10),
            ],
        )

        result = simulation.project_scenarios(request)

        self.assertEqual(result["asOf"], "2025-05-31")
        self.assertEqual(result["branches"][0]["path"][0]["medianPrice"], 225.0)
        base_path = result["branches"][1]["path"]
        self.assertFalse(base_path[0]["eventApplied"])
        self.assertTrue(any(point["eventApplied"] for point in base_path))
        self.assertIn("pas une prévision", " ".join(result["limitations"]))

    def test_projection_rejects_duplicate_branch_ids_and_offsets_after_horizon(self):
        with self.assertRaises(ValueError):
            ScenarioProjectionRequest(
                ticker="ABC", horizonObservations=20,
                branches=[
                    ScenarioBranch(id="same", title="A", event="E", shockPct=0, eventAfterObservations=0),
                    ScenarioBranch(id="same", title="B", event="E", shockPct=1, eventAfterObservations=0),
                ],
            )
        with self.assertRaises(ValueError):
            ScenarioProjectionRequest(
                ticker="ABC", horizonObservations=20,
                branches=[
                    ScenarioBranch(id="a", title="A", event="E", shockPct=0, eventAfterObservations=21),
                    ScenarioBranch(id="b", title="B", event="E", shockPct=1, eventAfterObservations=0),
                ],
            )

    @patch.dict(os.environ, {"SEC_USER_AGENT": "InvestorOS test contact test@example.com"})
    @patch.object(simulation, "_fetch_json")
    def test_sec_filings_use_official_cik_mapping_and_primary_document_links(self, fetch):
        fetch.side_effect = [
            {"0": {"ticker": "ABC", "cik_str": 123, "title": "Example Corp"}},
            {"filings": {"recent": {
                "accessionNumber": ["0000000123-25-000001", "0000000123-25-000002"],
                "form": ["8-K", "4"],
                "filingDate": ["2025-01-15", "2025-01-14"],
                "reportDate": ["2025-01-14", ""],
                "acceptanceDateTime": ["2025-01-15T12:00:00.000Z", ""],
                "primaryDocument": ["report.htm", "form4.xml"],
                "primaryDocDescription": ["Current report", ""],
            }}}
        ]

        result = simulation.issuer_filings("abc")

        self.assertTrue(result["available"])
        self.assertEqual(len(result["filings"]), 1)
        self.assertEqual(result["filings"][0]["form"], "8-K")
        self.assertEqual(result["filings"][0]["url"], "https://www.sec.gov/Archives/edgar/data/123/000000012325000001/report.htm")
        self.assertEqual(fetch.call_count, 2)

    def test_sec_filings_report_server_contact_configuration_requirement(self):
        with patch.dict(os.environ, {"SEC_USER_AGENT": ""}):
            result = simulation.issuer_filings("ABC")
        self.assertFalse(result["available"])
        self.assertIn("SEC_USER_AGENT", result["reason"])
