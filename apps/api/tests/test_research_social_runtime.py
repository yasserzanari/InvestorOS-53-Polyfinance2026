"""Exercise browser-first and API-fallback routing without external services."""

import json
import unittest
from unittest.mock import MagicMock, patch

from investoros_api.research import runtime
from investoros_api.research.api_anything import ApiAnythingError
from investoros_api.research.browser_content import read_browser_content
from investoros_api.research.social import normalize_oembed, oembed_url
from investoros_api.research.sources import DEFAULT_SOURCES


POST = "https://x.com/ExampleAgency/status/123456789"
RAW_POST = {
    "type": "rich", "url": POST, "author_name": "Example Agency",
    "author_url": "https://x.com/ExampleAgency",
    "html": '<blockquote><p>Publication de test.</p>Example Agency <a href="https://x.com/ExampleAgency/status/123456789">15 novembre 2026</a></blockquote>',
    "cache_age": "3600",
}


class SocialRuntimeTest(unittest.TestCase):
    def setUp(self):
        self.source = {**DEFAULT_SOURCES["x-oembed"], "first_browser_completed": False}
        self.post = normalize_oembed(RAW_POST, POST)
        self.table = MagicMock()
        self.calls = MagicMock()
        self.policy = self._patch("_get_policy", side_effect=lambda _: dict(self.source))
        self._patch("_table", return_value=self.table)
        self.emit = self._patch("emit")
        self.browser = self._patch("_browser_read", return_value={
            "title": "X public oEmbed", "text": json.dumps(self.post), "status_code": 200,
            "url": oembed_url(POST), "captured_at": "2026-11-15T00:00:00Z",
            "method": "agentcore_browser_playwright",
        })
        self.api = self._patch("_api_anything_fetch", return_value={"data": self.post})
        self.calls.attach_mock(self.browser, "browser")
        self.calls.attach_mock(self.api, "api")
        self.calls.attach_mock(self.table.update_item, "mark_browser_complete")
        self.event = {
            "analysis_id": "analysis-x-test",
            "task": {"source_id": "x-oembed", "value": POST, "question": "Que dit cette publication ?",
                     "room_id": "statements", "agent_id": "research-x-oembed"},
        }

    def _patch(self, name, **kwargs):
        patcher = patch.object(runtime, name, **kwargs)
        value = patcher.start()
        self.addCleanup(patcher.stop)
        return value

    def test_first_visit_reads_browser_and_records_success_before_api_learning(self):
        result = runtime.research_task(self.event)

        self.assertEqual([call[0] for call in self.calls.mock_calls], ["browser", "mark_browser_complete", "api"])
        self.browser.assert_called_once_with(oembed_url(POST), "publish.x.com")
        self.api.assert_called_once_with(self.source, POST)
        self.table.update_item.assert_called_once_with(
            Key={"source_id": "x-oembed"}, UpdateExpression="SET first_browser_completed = :true",
            ExpressionAttributeValues={":true": True},
        )
        self.assertEqual((result["status"], result["method"]), ("done", "api_anything_after_browser"))
        self.assertEqual(json.loads(result["content"])["kind"], "x_oembed")
        saved = [call.kwargs["Item"] for call in self.table.put_item.call_args_list]
        self.assertTrue(any(item["evidence_id"] == result["evidence_id"] for item in saved))

    def test_learned_operation_failure_falls_back_to_real_browser_adapter(self):
        self.source["first_browser_completed"] = True
        self.api.side_effect = ApiAnythingError("Operation unavailable", "schema")

        result = runtime.research_task(self.event)

        self.assertEqual([call[0] for call in self.calls.mock_calls], ["api", "browser"])
        self.assertEqual((result["status"], result["method"]), ("done", "agentcore_browser_fallback"))
        self.assertEqual(json.loads(result["content"])["text"], "Publication de test.")
        self.assertTrue(any(call.args[1] == "browser_fallback_started" for call in self.emit.call_args_list))
        self.table.update_item.assert_not_called()

    def test_failed_first_browser_visit_never_calls_api_anything(self):
        self.browser.side_effect = ValueError("Browser cannot read the public post")

        result = runtime.research_task(self.event)

        self.assertEqual(result["status"], "failed")
        self.browser.assert_called_once()
        self.api.assert_not_called()
        self.table.update_item.assert_not_called()
        self.table.put_item.assert_not_called()

    def test_disabled_source_performs_no_collection(self):
        self.source["enabled"] = False

        result = runtime.research_task(self.event)

        self.assertEqual(result["status"], "skipped")
        self.api.assert_not_called()
        self.browser.assert_not_called()
        self.table.put_item.assert_not_called()

    def test_successful_learned_operation_does_not_reopen_browser(self):
        self.source["first_browser_completed"] = True

        result = runtime.research_task(self.event)

        self.assertEqual((result["status"], result["method"]), ("done", "api_anything"))
        self.api.assert_called_once()
        self.browser.assert_not_called()

    def test_explicit_source_scope_rejects_model_tasks_and_automatic_history(self):
        self.policy.side_effect = lambda source_id: dict(DEFAULT_SOURCES[source_id])
        self._patch("_set_run")
        self._patch("_known_tickers", return_value={"AAPL"})
        model = self._patch("_bedrock_json", return_value={"thesis": "Test du périmètre", "tasks": [
            {"source_id": "bank-of-canada", "value": "FXUSDCAD"},
            {"source_id": "alphaforge-starter", "value": "AAPL"},
        ]})

        planned = runtime.plan({"analysis_id": "scoped-analysis", "account_id": "demo-account-test",
                                "question": "AAPL : attribue uniquement ce post public.",
                                "source_ids": ["x-oembed"], "x_url": POST})

        self.assertEqual([task["source_id"] for task in planned["tasks"]], ["x-oembed"])
        self.assertEqual(planned["tasks"][0]["value"], POST)
        # X collection is derived from the supplied URL, never from a model task.
        self.assertEqual(json.loads(model.call_args.args[1])["sources"], [])


class OembedApiResultTest(unittest.TestCase):
    def test_learned_operation_decodes_json_string_and_normalizes_post(self):
        source = DEFAULT_SOURCES["x-oembed"]
        with patch.object(runtime, "ApiAnythingClient") as client_type, patch.object(runtime, "_table"):
            client = client_type.return_value
            client.get_site.return_value = {"operations": [{"name": "publicPost"}]}
            client.call.return_value = {"ok": True, "tier": 1, "data": json.dumps(RAW_POST)}

            result = runtime._api_anything_fetch(source, POST)

            self.assertEqual((result["data"]["kind"], result["data"]["post_url"]), ("x_oembed", POST))
            self.assertEqual(result["data"]["text"], "Publication de test.")
            self.assertEqual(result["tier"], 1)
            client.call.assert_called_once_with(source, POST)
            client.learn.assert_not_called()

    def test_json_string_for_different_post_is_a_schema_failure(self):
        with patch.object(runtime, "ApiAnythingClient") as client_type, patch.object(runtime, "_table"):
            client = client_type.return_value
            client.get_site.return_value = {"operations": [{"name": "publicPost"}]}
            client.call.return_value = {"ok": True, "tier": 1,
                                        "data": json.dumps({**RAW_POST, "url": POST.replace("123456789", "987654321")})}

            with self.assertRaises(ApiAnythingError) as caught:
                runtime._api_anything_fetch(DEFAULT_SOURCES["x-oembed"], POST)

            self.assertEqual(caught.exception.failure_class, "schema")
            client.learn.assert_not_called()


class OembedBrowserAdapterTest(unittest.TestCase):
    def page(self, body):
        page = MagicMock()
        page.url = "https://publish.x.com/"
        page.goto.return_value.status = 200
        page.evaluate.return_value = body
        return page

    def test_download_occurs_in_same_browser_after_official_landing_visit(self):
        page = self.page(json.dumps(RAW_POST))
        allowed = MagicMock(return_value=True)

        result = read_browser_content(page, oembed_url(POST), allowed)

        page.goto.assert_called_once_with("https://publish.x.com/", wait_until="domcontentloaded", timeout=35_000)
        allowed.assert_called_once_with("https://publish.x.com/", "GET")
        self.assertIn("await fetch(url)", page.evaluate.call_args.args[0])
        self.assertEqual(page.evaluate.call_args.args[1], oembed_url(POST))
        self.assertEqual(result["method"], "agentcore_browser_download")
        self.assertEqual(result["url"], oembed_url(POST))
        normalized = json.loads(result["text"])
        self.assertEqual((normalized["kind"], normalized["post_url"]), ("x_oembed", POST))
        self.assertEqual(normalized["text"], "Publication de test.")

    def test_non_json_and_error_payloads_never_count_as_successful_browser_reads(self):
        for body in ["<html><h1>Unavailable</h1></html>", "invalid JSON", json.dumps({"error": "Not found"})]:
            with self.subTest(body=body), self.assertRaises(ValueError):
                read_browser_content(self.page(body), oembed_url(POST), lambda url, method: True)


if __name__ == "__main__":
    unittest.main()
