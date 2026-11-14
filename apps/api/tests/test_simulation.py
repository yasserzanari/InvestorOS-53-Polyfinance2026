import csv
import json
import os
from io import BytesIO
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from investoros_api import simulation


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

    def tearDown(self):
        self.patcher.stop()
        simulation._assets.cache_clear()
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
