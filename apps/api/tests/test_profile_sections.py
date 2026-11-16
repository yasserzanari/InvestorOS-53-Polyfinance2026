"""Profile tools, persistence contracts and bounded response-policy regression tests."""

import json
import os
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.memory import MemoryWrite
from investoros_api.profiles.profile_sections import (
    ControlsPatch,
    CONTROL_OPTIONS,
    apply_goals,
    apply_controls,
    sync_general,
    snapshot,
)
from investoros_api.profiles.response_policy import validate_response_policy
from investoros_api.profiles.service import run_chat
from test_profile_service import RuntimeStub, stream_tool

GOAL = {
    "id": "growth",
    "title": "Capital",
    "description": "Croissance diversifiée",
    "horizonYears": 10,
    "role": "Principal",
}


class ProfileSectionTests(unittest.TestCase):
    def test_all_control_keys_validated_and_invalid_experience_rejected(self):
        for key, options in CONTROL_OPTIONS.items():
            value = options[-1] if options else "Déclaration explicite"
            self.assertEqual(
                ControlsPatch.model_validate({key: value}).model_dump(exclude_unset=True),
                {key: value},
            )
        for invalid in [
            {"experience-Actions": "Expert garanti"},
            {"esg": "Certifié AMF"},
            {"unknown": "x"},
            {"learning": None},
        ]:
            with self.assertRaises(ValidationError):
                ControlsPatch.model_validate(invalid)

    def test_all_bedrock_schema_property_names_are_model_compatible(self):
        import re
        from investoros_api.profiles.tools import TOOLS, RESEARCH_TOOLS

        def check(node):
            if isinstance(node, dict):
                for key in node.get("properties", {}):
                    self.assertRegex(key, r"^[a-zA-Z0-9_.-]{1,64}$")
                for value in node.values():
                    check(value)
            elif isinstance(node, list):
                for value in node:
                    check(value)

        for tool in TOOLS + RESEARCH_TOOLS:
            check(tool["toolSpec"]["inputSchema"]["json"])
        from investoros_api.profiles.profile_sections import control_tool_changes

        self.assertEqual(
            control_tool_changes({"experience-fonds-opc": "Régulière", "years-etf": "5–10 ans"}),
            {"experience-Fonds (OPC)": "Régulière", "years-ETF (trackers)": "5–10 ans"},
        )

    def test_goals_sync_summary_and_horizon_without_losing_secondary(self):
        profile = {}
        tabs = []
        apply_goals(
            profile,
            tabs,
            [GOAL, {**GOAL, "id": "reserve", "role": "Secondaire", "horizonYears": 2}],
            "mateo",
        )
        self.assertEqual(profile, {"objective": "Croissance diversifiée", "horizon": "10 ans"})
        sync_general(profile, tabs, {"horizon": "12 ans", "objective": "Autre projet"})
        goals = json.loads(tabs[0]["content"])["goals"]
        self.assertEqual(
            (goals[0]["horizonYears"], goals[0]["description"], goals[1]["horizonYears"]),
            (12, "Autre projet", 2),
        )
        self.assertIn("anchorYear", goals[0])
        sync_general(profile, tabs, {"horizon": "5 à 10 ans"})
        ranged = json.loads(tabs[0]["content"])["goals"][0]
        self.assertIsNone(ranged["horizonYears"])
        self.assertEqual(ranged["horizonLabel"], "5 à 10 ans")

    def test_control_aliases_have_single_owner_and_esg_preserves_notes(self):
        profile = {"preferences": "Exclure le tabac, garder la diversification."}
        tabs = []
        situation = {}
        apply_controls(
            profile,
            tabs,
            situation,
            {
                "esg": "Impact",
                "withdrawals": "Retraits réguliers",
                "income": "Variable",
                "debt": "Modérés",
            },
        )
        state = snapshot(profile, tabs, situation)
        self.assertEqual(profile["preferences"], "Exclure le tabac, garder la diversification.")
        self.assertEqual(profile["liquidity"], "Retraits réguliers")
        self.assertEqual(situation, {"incomeRange": "Variable", "obligations": "Modérés"})
        self.assertEqual(state["controls"], {"esg": "Impact"})

    def test_memory_rejects_malformed_reserved_documents(self):
        for content in ["not-json", json.dumps({"esg": "garantie"}), json.dumps({"admin": True})]:
            with self.assertRaises((ValueError, ValidationError)):
                MemoryWrite(
                    expectedRevision=0,
                    profile={},
                    tabs=[
                        {
                            "id": "profile-controls",
                            "title": "Contrôles",
                            "kind": "profile",
                            "content": content,
                        }
                    ],
                )
        for goals in [
            [{**GOAL, "horizonYears": -1}],
            [GOAL, GOAL],
            [GOAL, {**GOAL, "id": "other"}],
        ]:
            with self.assertRaises((ValueError, ValidationError)):
                MemoryWrite(
                    expectedRevision=0,
                    profile={},
                    tabs=[
                        {
                            "id": "profile-objectives",
                            "title": "Objectifs",
                            "kind": "profile",
                            "content": json.dumps({"goals": goals}),
                        }
                    ],
                )

    @patch.dict(os.environ, {"BEDROCK_MODEL_ID": "test-model"})
    def test_typed_tools_return_actual_workspace_and_context(self):
        for tool, args in [
            ("update_profile_situation", {"incomeRange": "Revenu fictif stable"}),
            (
                "update_profile_controls",
                {
                    "esg": "Exclusions",
                    "experience-Actions": "Limitée",
                    "favoured": "Technologie|Santé",
                },
            ),
            ("update_profile_goals", {"goals": [GOAL]}),
        ]:
            runtime = RuntimeStub(stream_tool(tool, args))
            request = ChatRequest(
                message="Voici mes déclarations fictives explicites.",
                workspaceMode="profiles",
                profile={"preferences": "Notes à conserver"},
            )
            events = list(run_chat(request, runtime))
            self.assertTrue(
                any(
                    e["type"] == "tool" and e.get("name") == tool and e["status"] == "done"
                    for e in events
                ),
                events,
            )
            self.assertTrue(any(e["type"] == "workspace" and "situation" in e for e in events))
            self.assertEqual(events[-1]["type"], "done")
            state = [e for e in events if e["type"] == "workspace" and "situation" in e][-1]
            MemoryWrite(
                expectedRevision=0,
                profile={**state["profile"], "situation": state["situation"]},
                tabs=state["tabs"],
            )
            self.assertEqual(state["profile"]["preferences"], "Notes à conserver")

    @patch.dict(os.environ, {"BEDROCK_MODEL_ID": "test-model"})
    def test_raw_upsert_cannot_bypass_validated_profile_tools(self):
        runtime = RuntimeStub(
            stream_tool(
                "upsert_tab",
                {"id": "profile-controls", "title": "Bad", "kind": "profile", "content": "{}"},
            )
        )
        events = list(
            run_chat(
                ChatRequest(message="Modifier mes préférences", workspaceMode="profiles"), runtime
            )
        )
        self.assertTrue(any(e["type"] == "tool" and e.get("status") == "failed" for e in events))
        self.assertFalse(
            any(
                e["type"] == "workspace" and any(t["id"] == "profile-controls" for t in e["tabs"])
                for e in events
            )
        )

    @patch.dict(os.environ, {"BEDROCK_MODEL_ID": "test-model"})
    def test_successful_section_update_always_has_a_visible_confirmation(self):
        class EmptyFinal(RuntimeStub):
            def converse_stream(self, **kwargs):
                if not self.calls:
                    return super().converse_stream(**kwargs)
                self.calls.append(kwargs)
                return {"stream": [{"messageStop": {"stopReason": "end_turn"}}]}

        events = list(
            run_chat(
                ChatRequest(message="Revenu fictif stable", workspaceMode="profiles"),
                EmptyFinal(
                    stream_tool("update_profile_situation", {"incomeRange": "Stable, fictif"})
                ),
            )
        )
        text = "".join(e.get("delta", "") for e in events if e["type"] == "text")
        self.assertIn("mise à jour effectuée", text)
        self.assertIn("Vérifiez", text)

    def test_regulatory_certification_answer_is_bounded_and_explicit(self):
        from investoros_api.profiles.response_policy import regulatory_profile_answer

        answer = regulatory_profile_answer(
            "Peux-tu certifier que ce profil est approuvé par l’AMF ?"
        )
        self.assertLess(len(answer), 800)
        self.assertIn("ne fournit ni certification AMF", answer)
        self.assertIsNone(regulatory_profile_answer("Voici mes objectifs."))
        validate_response_policy(
            "Le profil n’a pas été enregistré car la validation a échoué.", True
        )

    def test_policy_blocks_positive_guarantees_but_allows_limits(self):
        for statement in [
            "Votre capital est garanti.",
            "Notre produit est conforme à toutes les lois.",
            "Votre profil est enregistré.",
        ]:
            with self.assertRaises(ValueError):
                validate_response_policy(statement, True)
        validate_response_policy(
            "Aucun rendement garanti. Ce questionnaire ne certifie pas la convenance."
        )
        validate_response_policy("Votre capacité déclarée est qualitative, elle n’est pas nulle.")
