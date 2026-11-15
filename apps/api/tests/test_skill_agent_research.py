"""Research procedure discovery is real, ordered, and bounded before generation."""

import copy
import json
import unittest
from unittest.mock import MagicMock, patch

from investoros_api.profiles import skill_agent
from investoros_api.profiles.skills import catalog_summary, load_skill, search_skills


REQUIRED = "research-planning"
QUESTION = "Vérifie seulement les comptes officiels demandés; ne collecte aucune série macro."


class ProcedureClient:
    """Model response fixtures retain optional tool calls after runtime bootstrap."""

    def __init__(self, *, optional_load=None, bad_search=False, on_converse=None):
        self.requests = []
        self.optional_load = optional_load
        self.bad_search = bad_search
        self.on_converse = on_converse

    def converse(self, **kwargs):
        if self.on_converse:
            self.on_converse()
        self.requests.append(copy.deepcopy(kwargs))
        if self.optional_load and len(self.requests) == 1:
            name, args = "load_skill", {"skill_id": self.optional_load}
        elif self.bad_search:
            name, args = "search_skills", {"query": "zzzz_unrelated_query", "limit": 8}
        else:
            return {"output": {"message": {"role": "assistant", "content": [{"text": '{"tasks": [], "thesis": "Périmètre respecté"}'}]}},
                    "stopReason": "end_turn", "usage": {"inputTokens": 2, "outputTokens": 1}}
        return {"output": {"message": {"role": "assistant", "content": [
            {"toolUse": {"toolUseId": f"procedure-{len(self.requests)}", "name": name, "input": args}}
        ]}}, "stopReason": "tool_use", "usage": {"inputTokens": 2, "outputTokens": 1}}


def context_strings(value):
    if isinstance(value, str):
        yield value
        try:
            decoded = json.loads(value)
        except ValueError:
            return
        if isinstance(decoded, (dict, list)):
            yield from context_strings(decoded)
    elif isinstance(value, dict):
        for item in value.values():
            yield from context_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from context_strings(item)


class ResearchSkillAgentTest(unittest.TestCase):
    def run_agent(self, client):
        return skill_agent.run_skill_agent(client, model_id="test-nova-model", system="Retourne le contrat JSON demandé.",
                                          prompt=QUESTION, required_skills=(REQUIRED,), role="research-planner")

    def test_runtime_searches_and_loads_required_procedure_before_first_model_call(self):
        operations = []
        client = ProcedureClient(on_converse=lambda: operations.append("converse"))

        def search(*args, **kwargs):
            operations.append("search_skills")
            return search_skills(*args, **kwargs)

        def load(*args, **kwargs):
            operations.append("load_skill")
            return load_skill(*args, **kwargs)

        with patch.object(skill_agent, "search_skills", side_effect=search), \
             patch.object(skill_agent, "load_skill", side_effect=load):
            result = self.run_agent(client)

        self.assertEqual(operations[:3], ["search_skills", "load_skill", "converse"])
        successful = [entry["tool"] for entry in result["skill_trace"] if entry["status"] == "done"]
        self.assertEqual(successful, ["search_skills", "load_skill"])
        self.assertEqual([entry["actor"] for entry in result["skill_trace"]], ["runtime-bootstrap", "runtime-bootstrap"])
        self.assertLessEqual(len(client.requests), 8)
        approved = load_skill(REQUIRED)
        self.assertEqual(result["skills"], [{key: approved[key] for key in ("id", "version", "sha256")}])
        self.assertEqual(result["role"], "research-planner")
        self.assertEqual(json.loads(result["text"])["tasks"], [])
        final_context = list(context_strings(client.requests[0]))
        self.assertTrue(any(QUESTION in text for text in final_context))
        self.assertTrue(any(approved["content"] in block["text"] for block in client.requests[0]["system"]))
        self.assertEqual(result["usage"], {"inputTokens": 2 * len(client.requests), "outputTokens": len(client.requests)})

    def test_optional_model_load_cannot_read_an_undiscovered_different_procedure(self):
        discovered = {item["id"] for item in search_skills(REQUIRED, 8)["skills"]}
        optional = next(item["id"] for item in catalog_summary() if item["id"] not in discovered)
        client = ProcedureClient(optional_load=optional)
        original_load = skill_agent.load_skill
        with patch.object(skill_agent, "load_skill", wraps=original_load) as actual_load:
            result = self.run_agent(client)

        first_trace = next(entry for entry in result["skill_trace"] if entry["actor"] == "model")
        self.assertEqual((first_trace["tool"], first_trace["status"]), ("load_skill", "failed"))
        actual_load.assert_called_once_with(REQUIRED)
        successful = [entry["tool"] for entry in result["skill_trace"] if entry["status"] == "done"]
        self.assertEqual(successful, ["search_skills", "load_skill"])
        self.assertEqual([item["id"] for item in result["skills"]], [REQUIRED])
        tool_errors = [block["toolResult"] for request in client.requests for message in request["messages"]
                       for block in message.get("content", []) if "toolResult" in block and block["toolResult"].get("status") == "error"]
        self.assertTrue(tool_errors)
        self.assertLessEqual(len(client.requests), 8)

    def test_repeated_irrelevant_optional_search_is_bounded_and_never_loads_another_procedure(self):
        client = ProcedureClient(bad_search=True)
        with patch.object(skill_agent, "load_skill", wraps=skill_agent.load_skill) as actual_load:
            with self.assertRaises(RuntimeError):
                self.run_agent(client)

        self.assertGreater(len(client.requests), 0)
        self.assertLessEqual(len(client.requests), 8)
        actual_load.assert_called_once_with(REQUIRED)

    def test_unknown_or_empty_role_contract_fails_before_any_model_call(self):
        for required_skills in (("not-reviewed-procedure",), ()):
            with self.subTest(required_skills=required_skills):
                client = MagicMock()
                with self.assertRaises(ValueError):
                    skill_agent.run_skill_agent(client, model_id="test-nova-model", system="JSON", prompt=QUESTION,
                                               required_skills=required_skills)
                client.converse.assert_not_called()


if __name__ == "__main__":
    unittest.main()
