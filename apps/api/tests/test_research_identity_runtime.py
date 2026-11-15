"""Authority identity collection and planning stay within explicit source scope."""

import json
import unittest
from unittest.mock import MagicMock, patch

from investoros_api.research import runtime
from investoros_api.research.identity import identity_claims
from investoros_api.research.sources import DEFAULT_SOURCES


class IdentityCollectionTest(unittest.TestCase):
    def setUp(self):
        self.source = dict(DEFAULT_SOURCES["whitehouse-account-identity"])
        self.table = MagicMock()
        self._patch("_get_policy", side_effect=lambda _: dict(self.source))
        self._patch("_table", return_value=self.table)
        self.emit = self._patch("emit")
        self.api = self._patch("_api_anything_fetch")
        self.browser = self._patch("_browser_read", return_value={
            "url": self.source["url"], "title": "The White House",
            "links": ["https://x.com/whitehouse"], "captured_at": "2026-11-15T00:00:00Z",
        })
        self.event = {"analysis_id": "identity-analysis-test", "task": {
            "source_id": self.source["id"], "value": "whitehouse", "question": "Quel compte est lié par la Maison-Blanche ?",
            "room_id": "identity", "agent_id": "research-whitehouse-account-identity",
        }}

    def _patch(self, name, **kwargs):
        patcher = patch.object(runtime, name, **kwargs)
        mocked = patcher.start()
        self.addCleanup(patcher.stop)
        return mocked

    def test_current_authority_link_is_persisted_without_api_anything(self):
        result = runtime.research_task(self.event)

        self.browser.assert_called_once_with(self.source["url"], self.source["domain"])
        self.api.assert_not_called()
        self.assertEqual((result["status"], result["method"]), ("done", "agentcore_browser_identity"))
        proof = json.loads(result["content"])
        self.assertEqual(proof["identity_status"], "linked_by_authority")
        self.assertTrue(proof["identity_verified"])
        self.assertEqual(proof["profile_url"], "https://x.com/whitehouse")
        saved = self.table.put_item.call_args.kwargs["Item"]
        self.assertEqual(saved["evidence_id"], result["evidence_id"])
        self.assertEqual(json.loads(saved["content"]), proof)
        self.assertEqual(identity_claims(result)[0]["confidence"], "supported")

    def test_absent_anchor_is_an_honest_unverified_result(self):
        self.browser.return_value["links"] = ["https://x.com/OtherAccount", "@whitehouse"]

        result = runtime.research_task(self.event)

        self.assertEqual(result["status"], "done")
        proof = json.loads(result["content"])
        self.assertEqual(proof["identity_status"], "not_linked")
        self.assertFalse(proof["identity_verified"])
        self.assertEqual(identity_claims(result)[0]["confidence"], "unverified")
        self.api.assert_not_called()

    def test_archive_link_remains_historical_and_partial(self):
        self.source = dict(DEFAULT_SOURCES["trump-account-archive"])
        self.event["task"].update(source_id=self.source["id"], value="realdonaldtrump")
        self.browser.return_value.update(url=self.source["url"], links=["https://twitter.com/realDonaldTrump"])

        result = runtime.research_task(self.event)

        proof = json.loads(result["content"])
        self.assertEqual(proof["identity_status"], "historical_crosslink")
        self.assertFalse(proof["identity_verified"])
        self.assertEqual(identity_claims(result)[0]["confidence"], "partial")
        self.api.assert_not_called()

    def test_browser_failure_does_not_create_an_identity_proof(self):
        self.browser.side_effect = ValueError("Authority page unavailable")

        result = runtime.research_task(self.event)

        self.assertEqual(result["status"], "failed")
        self.assertNotIn("evidence_id", result)
        self.table.put_item.assert_not_called()
        self.table.update_item.assert_not_called()
        self.api.assert_not_called()


class IdentityPlanScopeTest(unittest.TestCase):
    def plan(self, source_ids):
        with patch.object(runtime, "_get_policy", side_effect=lambda key: dict(DEFAULT_SOURCES[key])), \
             patch.object(runtime, "_set_run"), patch.object(runtime, "emit"), \
             patch.object(runtime, "_known_tickers", return_value=set()), \
             patch.object(runtime, "_bedrock_json", return_value={"thesis": "Attribution", "tasks": []}):
            return runtime.plan({"analysis_id": "plan-identity-test", "account_id": "demo-account-test",
                                 "question": "Attribue le post fourni sans rechercher d'autres informations.",
                                 "x_url": "https://x.com/OpenAI/status/123456789", "source_ids": source_ids})

    def test_openai_identity_task_is_added_when_authority_is_allowed(self):
        for source_ids in (None, ["x-oembed", "openai-account-identity"]):
            with self.subTest(source_ids=source_ids):
                tasks = self.plan(source_ids)["tasks"]
                self.assertEqual({task["source_id"] for task in tasks}, {"x-oembed", "openai-account-identity"})
                identity_task = next(task for task in tasks if task["source_id"] == "openai-account-identity")
                self.assertEqual((identity_task["value"], identity_task["room_id"]), ("openai", "identity"))

    def test_explicit_x_only_scope_does_not_add_identity_task(self):
        tasks = self.plan(["x-oembed"])["tasks"]
        self.assertEqual([task["source_id"] for task in tasks], ["x-oembed"])

    def test_social_and_identity_tasks_do_not_trigger_unrelated_document_retrieval(self):
        with patch.object(runtime, "retrieve_knowledge_evidence") as retrieve:
            result = runtime._collect_knowledge_evidence({
                "analysis_id": "social-no-rag-test", "question": "Attribue un post concernant Apple.",
                "source_ids": None,
                "tasks": [{"source_id": "x-oembed"}, {"source_id": "openai-account-identity"}],
            })

            self.assertIsNone(result)
            retrieve.assert_not_called()


if __name__ == "__main__":
    unittest.main()
