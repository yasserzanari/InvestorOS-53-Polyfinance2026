import json
import os
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException

from investoros_api.admin_guardrails import (
    GuardrailBinding,
    GuardrailTest,
    set_guardrail_binding,
    test_guardrail as apply_guardrail_test,
)
from investoros_api.admin_console import require_admin
from investoros_api.bedrock_guardrails import active_guardrail
from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat
from investoros_api.profiles.skill_agent import run_skill_agent


class RuntimeStub:
    def __init__(self, stop_reason="end_turn", text="La réponse reste disponible."):
        self.stop_reason = stop_reason
        self.text = text
        self.calls = []

    def converse_stream(self, **kwargs):
        self.calls.append(kwargs)
        events = []
        if self.stop_reason != "guardrail_intervened":
            events.append({"contentBlockDelta": {"contentBlockIndex": 0, "delta": {"text": self.text}}})
        events.extend([
            {"messageStop": {"stopReason": self.stop_reason}},
            {"metadata": {"usage": {"inputTokens": 4, "outputTokens": 3}}},
        ])
        return {"stream": events}


class ConverseStub:
    def __init__(self):
        self.calls = []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        return {"stopReason": "end_turn", "usage": {"inputTokens": 2, "outputTokens": 2},
                "output": {"message": {"content": [{"text": "Réponse de spécialiste."}]}}}


class BedrockGuardrailTests(unittest.TestCase):
    @patch.dict(os.environ, {}, clear=True)
    def test_runtime_without_guardrail_setting_preserves_existing_path(self):
        with patch("investoros_api.bedrock_guardrails.boto3.client") as client:
            self.assertIsNone(active_guardrail())
            client.assert_not_called()

    @patch.dict(os.environ, {"BEDROCK_GUARDRAIL_CONFIG_PARAMETER": "/test/guardrail"})
    def test_runtime_reads_enabled_published_guardrail_from_parameter_store(self):
        ssm = Mock()
        ssm.get_parameter.return_value = {"Parameter": {"Value": json.dumps({
            "enabled": True, "guardrailId": "gr-test", "guardrailVersion": "2",
        })}}
        with patch("investoros_api.bedrock_guardrails.boto3.client", return_value=ssm):
            self.assertEqual(active_guardrail(), {"guardrailIdentifier": "gr-test", "guardrailVersion": "2"})

    @patch.dict(os.environ, {"BEDROCK_GUARDRAIL_CONFIG_PARAMETER": "/test/guardrail"})
    def test_missing_declared_guardrail_parameter_fails_closed(self):
        from botocore.exceptions import ClientError

        ssm = Mock()
        ssm.get_parameter.side_effect = ClientError({"Error": {"Code": "ParameterNotFound"}}, "GetParameter")
        with patch("investoros_api.bedrock_guardrails.boto3.client", return_value=ssm):
            with self.assertRaisesRegex(RuntimeError, "absente du Parameter Store"):
                active_guardrail()

    @patch.dict(os.environ, {"BEDROCK_MODEL_ID": "test-model"})
    def test_disabled_guardrail_keeps_normal_chat_streaming(self):
        runtime = RuntimeStub()
        with patch("investoros_api.profiles.service.active_guardrail", return_value=None):
            events = list(run_chat(ChatRequest(message="Bonjour, explique la diversification."), runtime))
        self.assertNotIn("guardrailConfig", runtime.calls[0])
        self.assertTrue(any(event.get("type") == "text" and "réponse reste disponible" in event["delta"] for event in events))
        self.assertEqual(events[-1]["type"], "done")

    @patch.dict(os.environ, {"BEDROCK_MODEL_ID": "test-model"})
    def test_enabled_guardrail_uses_synchronous_filtering_without_trace(self):
        runtime = RuntimeStub()
        with patch("investoros_api.profiles.service.active_guardrail", return_value={
            "guardrailIdentifier": "gr-test", "guardrailVersion": "2",
        }):
            events = list(run_chat(ChatRequest(message="Bonjour, explique la diversification."), runtime))
        self.assertEqual(runtime.calls[0]["guardrailConfig"], {
            "guardrailIdentifier": "gr-test", "guardrailVersion": "2",
            "trace": "disabled", "streamProcessingMode": "sync",
        })
        self.assertTrue(any(event.get("type") == "text" and "réponse reste disponible" in event["delta"] for event in events))
        self.assertEqual(events[-1]["type"], "done")

    def test_skill_specialist_also_uses_selected_guardrail(self):
        client = ConverseStub()
        with patch("investoros_api.profiles.skill_agent.active_guardrail", return_value={
            "guardrailIdentifier": "gr-test", "guardrailVersion": "2",
        }):
            result = run_skill_agent(client, model_id="test-model", system="Reste factuel.", prompt="Résume.",
                                     required_skills=("investor-profile",), max_tokens=100)
        self.assertEqual(result["text"], "Réponse de spécialiste.")
        self.assertEqual(client.calls[0]["guardrailConfig"], {
            "guardrailIdentifier": "gr-test", "guardrailVersion": "2", "trace": "disabled",
        })

    @patch.dict(os.environ, {"BEDROCK_MODEL_ID": "test-model"})
    def test_guardrail_intervention_is_reported_as_block_not_normal_answer(self):
        runtime = RuntimeStub(stop_reason="guardrail_intervened", text="Texte retenu")
        with patch("investoros_api.profiles.service.active_guardrail", return_value={
            "guardrailIdentifier": "gr-test", "guardrailVersion": "2",
        }):
            events = list(run_chat(ChatRequest(message="Traite cette demande."), runtime))
        self.assertFalse(any(event.get("type") == "text" and "Texte retenu" in event.get("delta", "") for event in events))
        self.assertEqual(events[-1]["code"], "guardrail_intervened")

    @patch.dict(os.environ, {"BEDROCK_GUARDRAIL_CONFIG_PARAMETER": "/test/guardrail", "BEDROCK_GUARDRAIL_ID": "gr-test"})
    def test_admin_refuses_mutable_draft_as_runtime_version(self):
        with self.assertRaises(HTTPException) as raised:
            set_guardrail_binding(GuardrailBinding(enabled=True, guardrailId="gr-test", guardrailVersion="DRAFT"))
        self.assertEqual(raised.exception.status_code, 422)

    @patch.dict(os.environ, {"REQUIRE_ADMIN_AUTH": "true"})
    def test_guardrail_management_endpoint_rejects_non_admin_request(self):
        with self.assertRaises(HTTPException) as raised:
            require_admin()
        self.assertEqual(raised.exception.status_code, 403)

    @patch.dict(os.environ, {"BEDROCK_GUARDRAIL_ID": "gr-test"})
    def test_admin_test_uses_apply_guardrail_and_returns_safe_evaluation(self):
        runtime = Mock()
        runtime.apply_guardrail.return_value = {
            "action": "GUARDRAIL_INTERVENED", "outputs": [{"text": "Texte anonymisé"}],
            "assessments": [{"sensitiveInformationPolicy": {"piiEntities": [{"type": "EMAIL"}]}}],
        }
        with patch("investoros_api.admin_guardrails._runtime_client", return_value=runtime):
            result = apply_guardrail_test(GuardrailTest(
                guardrailId="gr-test", guardrailVersion="1", source="INPUT", text="Contact test@example.com",
            ))
        self.assertTrue(result["blocked"])
        self.assertEqual(result["output"], "Texte anonymisé")
        self.assertEqual(result["filtersTriggered"], ["sensitiveInformationPolicy"])
        runtime.apply_guardrail.assert_called_once()

    @patch.dict(os.environ, {"BEDROCK_GUARDRAIL_CONFIG_PARAMETER": "/test/guardrail", "BEDROCK_GUARDRAIL_ID": "gr-test"})
    def test_admin_persists_only_validated_published_guardrail_configuration(self):
        bedrock = Mock()
        bedrock.get_guardrail.return_value = {"status": "READY"}
        ssm = Mock()
        with patch("investoros_api.admin_guardrails._guardrail_client", return_value=bedrock), \
             patch("investoros_api.admin_guardrails._client", return_value=ssm):
            result = set_guardrail_binding(GuardrailBinding(
                enabled=True, guardrailId="gr-test", guardrailVersion="1",
            ))
        stored = json.loads(ssm.put_parameter.call_args.kwargs["Value"])
        self.assertTrue(result["enabled"])
        self.assertEqual(stored, {"enabled": True, "guardrailId": "gr-test", "guardrailVersion": "1"})


if __name__ == "__main__":
    unittest.main()
