"""Contract tests for tool validation and real stream event handling (no AWS calls)."""
import os
from copy import deepcopy
import unittest
from unittest.mock import patch

from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat, VisibleText


def stream_tool(name, args):
    import json
    return {'stream': [
        {'contentBlockStart': {'contentBlockIndex': 0, 'start': {'toolUse': {'toolUseId': 'call-1', 'name': name}}}},
        {'contentBlockDelta': {'contentBlockIndex': 0, 'delta': {'toolUse': {'input': json.dumps(args)}}}},
        {'messageStop': {'stopReason': 'tool_use'}},
    ]}


class RuntimeStub:
    def __init__(self, first):
        self.first = first
        self.calls = []

    def converse_stream(self, **kwargs):
        self.calls.append(deepcopy(kwargs))
        if len(self.calls) == 1:
            return self.first
        return {'stream': [
            {'contentBlockDelta': {'contentBlockIndex': 0, 'delta': {'text': 'Profil mis à jour.'}}},
            {'messageStop': {'stopReason': 'end_turn'}},
            {'metadata': {'usage': {'inputTokens': 10, 'outputTokens': 5}}},
        ]}


class ProfileServiceTests(unittest.TestCase):
    def test_private_tag_content_is_never_streamed(self):
        visible = VisibleText()
        chunks = ['<th', 'inking>private', ' reasoning</thin', 'king>Public', ' response.']
        self.assertEqual(''.join(visible.push(chunk) for chunk in chunks) + visible.push('', final=True), 'Public response.')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_tool_update_is_applied_and_returned_to_bedrock(self):
        runtime = RuntimeStub(stream_tool('update_profile', {'fields': {'horizon': '15 ans'}}))
        events = list(run_chat(ChatRequest(message='Dans 15 ans'), runtime))
        workspace = [event for event in events if event['type'] == 'workspace'][-1]
        self.assertEqual(workspace['profile']['horizon'], '15 ans')
        self.assertEqual(events[-1]['type'], 'done')
        self.assertEqual(runtime.calls[1]['messages'][-1]['content'][0]['toolResult']['status'], 'success')
        self.assertEqual(runtime.calls[0]['inferenceConfig']['maxTokens'], 1800)

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    @patch('investoros_api.profiles.service.analyze_configured_portfolio')
    def test_portfolio_tool_returns_deterministic_result_to_chat(self, analyze):
        summary = {'positionCount': 4, 'largestPositionPct': 40, 'provenance': {'classification': 'fictional_fixture'}}
        analyze.return_value = summary
        runtime = RuntimeStub(stream_tool('analyze_demo_portfolio', {}))
        events = list(run_chat(ChatRequest(accountId='robert', message='Analyse la répartition de mon portefeuille'), runtime))
        tool_event = [event for event in events if event['type'] == 'tool' and event['name'] == 'analyze_demo_portfolio'][-1]
        self.assertEqual(tool_event['status'], 'done')
        self.assertEqual(tool_event['output'], summary)
        result = runtime.calls[1]['messages'][-1]['content'][0]['toolResult']
        self.assertEqual(result['content'][0]['json'], summary)
        analyze.assert_called_once_with(persona='robert')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_untrusted_tool_fields_are_rejected_without_mutating_profile(self):
        runtime = RuntimeStub(stream_tool('update_profile', {'fields': {'admin': 'true'}}))
        events = list(run_chat(ChatRequest(message='Bonjour'), runtime))
        self.assertTrue(any(event['type'] == 'tool' and event['status'] == 'failed' for event in events))
        self.assertEqual([event for event in events if event['type'] == 'workspace'][-1]['profile'], {})
        self.assertEqual(runtime.calls[1]['messages'][-1]['content'][0]['toolResult']['status'], 'error')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': ''})
    def test_missing_configuration_returns_error_without_runtime_call(self):
        runtime = RuntimeStub(None)
        events = list(run_chat(ChatRequest(message='Bonjour'), runtime))
        self.assertEqual(events[0]['code'], 'not_configured')
        self.assertEqual(runtime.calls, [])


if __name__ == '__main__':
    unittest.main()
