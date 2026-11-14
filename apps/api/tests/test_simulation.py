import csv
import json
import os
from datetime import date, timedelta
from io import BytesIO
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

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
        simulation._NEWS_CACHE.clear()
        simulation._X_POSTS_CACHE.clear()
        simulation._X_SECRET_CACHE = None

    def tearDown(self):
        self.patcher.stop()
        simulation._assets.cache_clear()
        simulation._SEC_CACHE.clear()
        simulation._NEWS_CACHE.clear()
        simulation._X_POSTS_CACHE.clear()
        simulation._X_SECRET_CACHE = None
        self.temp.cleanup()

    def write_csv(self, filename, rows):
        with open(os.path.join(self.directory, filename), "w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    def test_data_dir_prefers_dataset_bundled_with_lambda_module(self):
        from pathlib import Path

        package_root = os.path.join(self.directory, "lambda", "investoros_api")
        data_dir = os.path.join(package_root, "data")
        os.makedirs(data_dir)
        with patch.dict(os.environ, {}, clear=True), patch.object(
            simulation, "__file__", os.path.join(package_root, "simulation.py")
        ):
            self.assertEqual(simulation._data_dir(), Path(data_dir))

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

    @patch.dict(os.environ, {"SEC_USER_AGENT": "InvestorOS test contact test@example.com"})
    @patch.object(simulation, "_fetch_json")
    def test_sec_filings_include_matching_historical_submission_archives(self, fetch):
        fetch.side_effect = [
            {"0": {"ticker": "ABC", "cik_str": 123, "title": "Example Corp"}},
            {"filings": {
                "recent": {"accessionNumber": [], "form": [], "filingDate": []},
                "files": [{"name": "CIK0000000123-submissions-001.json", "filingFrom": "2020-01-01", "filingTo": "2023-12-31"}],
            }},
            {"filings": {"recent": {
                "accessionNumber": ["0000000123-22-000001"],
                "form": ["10-Q"],
                "filingDate": ["2022-04-28"],
                "reportDate": ["2022-03-31"],
                "primaryDocument": ["quarterly.htm"],
                "primaryDocDescription": ["Quarterly report"],
            }}}
        ]

        result = simulation.issuer_filings("ABC", start_date=date(2021, 1, 1))

        self.assertTrue(result["available"])
        self.assertEqual(result["startDate"], "2021-01-01")
        self.assertEqual(result["filings"][0]["filedAt"], "2022-04-28")
        self.assertEqual(result["filings"][0]["url"], "https://www.sec.gov/Archives/edgar/data/123/000000012322000001/quarterly.htm")
        self.assertEqual(fetch.call_args_list[-1].args[0], "https://data.sec.gov/submissions/CIK0000000123-submissions-001.json")
        self.assertEqual(fetch.call_count, 3)

    def test_sec_filings_report_server_contact_configuration_requirement(self):
        with patch.dict(os.environ, {"SEC_USER_AGENT": ""}):
            result = simulation.issuer_filings("ABC")
        self.assertFalse(result["available"])
        self.assertIn("SEC_USER_AGENT", result["reason"])

    @patch("investoros_api.simulation.urlopen")
    def test_news_returns_secondary_links_with_indexed_dates(self, open_url):
        open_url.return_value = BytesIO(json.dumps({"articles": [{
            "url": "https://news.example/story",
            "title": "Example Corp market coverage",
            "domain": "news.example",
            "seendate": "20251114T153000Z",
            "socialimage": "https://cdn.news.example/story-preview.jpg",
        }, {
            "url": "javascript:alert(1)",
            "title": "Unsafe URL",
            "seendate": "20251114T153000Z",
            "socialimage": "javascript:alert(1)",
        }, {
            "url": "https://news.example/without-safe-image",
            "title": "Image URL is not HTTPS",
            "domain": "news.example",
            "seendate": "20251114T143000Z",
            "socialimage": "http://cdn.news.example/preview.jpg",
        }]}).encode())

        result = simulation.issuer_news("abc")

        self.assertTrue(result["available"])
        self.assertEqual(len(result["articles"]), 2)
        self.assertEqual(result["articles"][0]["publishedAt"], "2025-11-14T15:30:00+00:00")
        self.assertEqual(result["articles"][0]["imageUrl"], "https://cdn.news.example/story-preview.jpg")
        self.assertNotIn("imageUrl", result["articles"][1])
        self.assertIn("secondaire", result["source"])
        self.assertIn("pas des faits vérifiés", " ".join(result["limitations"]))

    @patch("investoros_api.simulation.urlopen", side_effect=HTTPError("https://example", 429, "rate limited", {}, None))
    def test_news_rate_limit_is_visible_and_cached(self, open_url):
        first = simulation.issuer_news("ABC")
        second = simulation.issuer_news("ABC")
        self.assertFalse(first["available"])
        self.assertIn("limitée", first["reason"])
        self.assertEqual(second, first)
        self.assertEqual(open_url.call_count, 1)

    @patch("investoros_api.simulation.urlopen")
    def test_x_search_is_disabled_by_default_without_spending(self, open_url):
        with patch.dict(os.environ, {"SIMULATION_X_SEARCH_ENABLED": "", "X_API_BEARER_TOKEN": ""}):
            result = simulation.issuer_social_posts("ABC")
        self.assertFalse(result["available"])
        self.assertIn("désactivée", result["reason"])
        open_url.assert_not_called()

    @patch("investoros_api.simulation.urlopen")
    def test_x_search_returns_linked_public_posts_and_safe_image(self, open_url):
        open_url.return_value = BytesIO(json.dumps({
            "data": [{"id": "123456789", "text": "Example Corp announced a shipment update.", "author_id": "u1", "created_at": "2026-11-14T15:30:00.000Z", "attachments": {"media_keys": ["m1"]}}],
            "includes": {
                "users": [{"id": "u1", "name": "Example CEO", "username": "example_ceo"}],
                "media": [{"media_key": "m1", "type": "photo", "preview_image_url": "https://pbs.twimg.com/media/example.jpg"}],
            },
        }).encode())
        with patch.dict(os.environ, {"SIMULATION_X_SEARCH_ENABLED": "true", "X_API_BEARER_TOKEN": "server-only-token"}):
            result = simulation.issuer_social_posts("ABC")

        self.assertTrue(result["available"])
        self.assertEqual(result["posts"][0]["url"], "https://x.com/example_ceo/status/123456789")
        self.assertEqual(result["posts"][0]["publishedAt"], "2026-11-14T15:30:00+00:00")
        self.assertEqual(result["posts"][0]["imageUrl"], "https://pbs.twimg.com/media/example.jpg")
        request = open_url.call_args.args[0]
        self.assertIn("Bearer server-only-token", request.get_header("Authorization"))
        self.assertIn("sept derniers jours", " ".join(result["limitations"]))

    @patch("investoros_api.simulation.boto3.client")
    @patch("investoros_api.simulation.urlopen")
    def test_x_search_can_read_token_from_secrets_manager(self, open_url, client):
        open_url.return_value = BytesIO(json.dumps({"data": []}).encode())
        client.return_value.get_secret_value.return_value = {"SecretString": "secret-manager-token"}
        with patch.dict(os.environ, {
            "SIMULATION_X_SEARCH_ENABLED": "true",
            "X_API_BEARER_TOKEN": "",
            "X_API_BEARER_TOKEN_SECRET_ARN": "arn:aws:secretsmanager:us-east-1:123456789012:secret:x-token",
        }):
            result = simulation.issuer_social_posts("ABC")

        self.assertTrue(result["available"])
        client.assert_called_once_with("secretsmanager", region_name=os.getenv("AWS_REGION", "us-east-1"))
        self.assertEqual(open_url.call_args.args[0].get_header("Authorization"), "Bearer secret-manager-token")

    @patch("investoros_api.simulation.urlopen", side_effect=HTTPError("https://api.x.com", 429, "rate limited", {}, None))
    def test_x_search_rate_limit_is_reported_and_cached(self, open_url):
        with patch.dict(os.environ, {"SIMULATION_X_SEARCH_ENABLED": "true", "X_API_BEARER_TOKEN": "server-only-token"}):
            first = simulation.issuer_social_posts("ABC")
            second = simulation.issuer_social_posts("ABC")
        self.assertFalse(first["available"])
        self.assertIn("quota", first["reason"])
        self.assertEqual(first, second)
        self.assertEqual(open_url.call_count, 1)
