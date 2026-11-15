"""Portfolio monitoring stays scoped, deduplicated, and evidence-gated."""

import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from investoros_api.portfolio_monitor import handler, request_scan, scan_persona


class PortfolioMonitorTests(unittest.TestCase):
    @patch.dict("os.environ", {"PORTFOLIO_MONITOR_FUNCTION_NAME": "monitor-worker"})
    @patch("investoros_api.portfolio_monitor._lambda_client")
    @patch("investoros_api.portfolio_monitor._table")
    @patch("investoros_api.portfolio_monitor.context_for", return_value={"account_id": "demo-account-001"})
    def test_manual_refresh_is_queued_and_returns_pending(self, _context, table, lambda_client):
        lambda_client.invoke.return_value = {"StatusCode": 202}

        result = request_scan("mateo")

        self.assertEqual(result["status"], "pending")
        self.assertEqual(table.return_value.put_item.call_args.kwargs["Item"]["record_id"], f"scan#{result['id']}")
        event = lambda_client.invoke.call_args.kwargs["Payload"]
        self.assertIn(b'"detail-type": "Manual portfolio news scan"', event)

    @patch("investoros_api.portfolio_monitor.scan_persona", return_value={"persona": "mateo", "checkedArticles": 2, "newCases": 1})
    @patch("investoros_api.portfolio_monitor._table")
    @patch("investoros_api.portfolio_monitor.context_for", return_value={"account_id": "demo-account-001"})
    def test_manual_worker_marks_scan_complete(self, _context, table, scan):
        event = {
            "source": "investoros.portfolio-monitor",
            "detail-type": "Manual portfolio news scan",
            "persona": "mateo",
            "scanId": "a" * 24,
            "createdAt": "2026-11-15T12:00:00+00:00",
        }

        result = handler(event, None)

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["result"]["newCases"], 1)
        self.assertEqual(table.return_value.put_item.call_count, 2)
        scan.assert_called_once_with("mateo")

    @patch("investoros_api.portfolio_monitor.context_for", return_value={"account_id": "demo-account-001", "profile_id": "profile", "portfolio_id": "portfolio"})
    @patch("investoros_api.portfolio_monitor._query", return_value=[])
    @patch("investoros_api.portfolio_monitor.load_demo_portfolio")
    @patch("investoros_api.portfolio_monitor.issuer_news")
    def test_category_only_portfolio_does_not_infer_tickers(self, news, portfolio, _query, _context):
        portfolio.return_value = {"positions": [{"id": "line-1", "label": "Actions mondiales (fixture)"}]}
        result = scan_persona("mateo", datetime(2026, 11, 15, tzinfo=timezone.utc))
        self.assertEqual(result, {"persona": "mateo", "checkedArticles": 0, "newCases": 0})
        news.assert_not_called()

    @patch("investoros_api.portfolio_monitor.context_for", return_value={"account_id": "demo-account-001", "profile_id": "profile", "portfolio_id": "portfolio"})
    @patch("investoros_api.portfolio_monitor._save_case", return_value=True)
    @patch("investoros_api.portfolio_monitor._validated_signal", return_value={
        "eventType": "earnings", "summary": "Résultats trimestriels annoncés.",
        "nextAction": "Lire le communiqué complet.", "evidenceQuote": "The company reported quarterly earnings above expectations.", "confidence": 0.94,
    })
    @patch("investoros_api.portfolio_monitor._article_text", return_value="The company reported quarterly earnings above expectations.")
    @patch("investoros_api.portfolio_monitor._table")
    @patch("investoros_api.portfolio_monitor.issuer_news")
    @patch("investoros_api.portfolio_monitor._assets", return_value={"AAPL": {"name": "Apple Inc."}})
    @patch("investoros_api.portfolio_monitor._query", return_value=[{
        "ticker": "AAPL", "positionId": "line-1", "positionLabel": "Actions mondiales",
    }])
    @patch("investoros_api.portfolio_monitor.load_demo_portfolio")
    def test_recent_article_is_persisted_as_a_review_case(self, portfolio, _query, _assets, news, table, article, validate, save, _context):
        portfolio.return_value = {"positions": []}
        table.return_value.get_item.return_value = {}
        now = datetime(2026, 11, 15, 12, tzinfo=timezone.utc)
        news.return_value = {"available": True, "company": "Apple Inc.", "articles": [{
            "url": "https://news.example/apple-earnings", "title": "Apple earnings report", "domain": "news.example",
            "indexedAt": "2026-11-15T11:00:00+00:00",
        }]}

        result = scan_persona("mateo", now)

        self.assertEqual(result, {"persona": "mateo", "checkedArticles": 1, "newCases": 1})
        validate.assert_called_once()
        case = save.call_args.args[1]
        self.assertEqual(case["status"], "new")
        self.assertEqual(case["ticker"], "AAPL")
        self.assertEqual(case["positionId"], "line-1")
        self.assertEqual(case["nextAction"], "Lire le communiqué complet.")

    @patch("investoros_api.portfolio_monitor.context_for", return_value={"account_id": "demo-account-001", "profile_id": "profile", "portfolio_id": "portfolio"})
    @patch("investoros_api.portfolio_monitor._query", return_value=[{
        "ticker": "AAPL", "positionId": "line-1", "positionLabel": "Actions mondiales",
    }])
    @patch("investoros_api.portfolio_monitor.load_demo_portfolio", return_value={"positions": []})
    @patch("investoros_api.portfolio_monitor._assets", return_value={"AAPL": {"name": "Apple Inc."}})
    @patch("investoros_api.portfolio_monitor.issuer_news")
    def test_stale_articles_do_not_create_cases(self, news, _assets, _portfolio, _query, _context):
        news.return_value = {"available": True, "company": "Apple Inc.", "articles": [{
            "url": "https://news.example/apple-earnings", "title": "Apple earnings report", "domain": "news.example",
            "indexedAt": "2026-11-13T11:00:00+00:00",
        }]}
        result = scan_persona("mateo", datetime(2026, 11, 15, 12, tzinfo=timezone.utc))
        self.assertEqual(result, {"persona": "mateo", "checkedArticles": 0, "newCases": 0})
