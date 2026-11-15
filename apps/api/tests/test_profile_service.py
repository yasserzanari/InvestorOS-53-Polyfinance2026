"""Contract tests for tool validation and real stream event handling (no AWS calls)."""
import os
from copy import deepcopy
from datetime import date
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


class FinalRuntime:
    def __init__(self):
        self.calls = []

    def converse_stream(self, **kwargs):
        self.calls.append(deepcopy(kwargs))
        return {'stream': [
            {'contentBlockDelta': {'contentBlockIndex': 0, 'delta': {'text': 'La plateforme ne fournit pas de score ESG comparable.'}}},
            {'messageStop': {'stopReason': 'end_turn'}},
            {'metadata': {'usage': {'inputTokens': 10, 'outputTokens': 8}}},
        ]}


class ProfileServiceTests(unittest.TestCase):
    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_profile_fit_contract_allows_evidence_based_conditional_tensions(self):
        request = ChatRequest(
            accountId='mateo',
            message='Mon portefeuille correspond-il à mon objectif et à mes critères ESG ?',
            profile={'objective': 'Stabilité', 'horizon': 'Court terme', 'preferences': 'Critères ESG'},
        )
        runtime = FinalRuntime()

        events = list(run_chat(request, runtime))

        system = '\n'.join(block['text'] for block in runtime.calls[0]['system'])
        self.assertIn('Tu peux expliquer une tension conditionnelle', system)
        self.assertIn('Dis précisément quelles données manquent', system)
        self.assertNotIn('Ne propose aucune conclusion qualitative d’adéquation', system)
        self.assertIn('N’attribue aucun score', system)
        available = {tool['toolSpec']['name'] for tool in runtime.calls[0]['toolConfig']['tools']}
        self.assertIn('analyze_demo_portfolio', available)
        self.assertEqual(events[-1]['type'], 'done')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_plan_approval_form_cannot_appear_before_visible_plan_steps(self):
        request = {
            'title': 'Valider le plan', 'purpose': 'plan_approval',
            'questions': [{'id': 'approval', 'label': 'Que faire ?', 'kind': 'single_choice', 'required': True,
                'allowOther': True, 'options': [{'id': 'launch', 'label': 'Oui, lancer ce plan'},
                {'id': 'edit', 'label': 'Modifier le plan'}]}],
        }
        events = list(run_chat(ChatRequest(message='Analyse NVDA'), RuntimeStub(stream_tool('ask_user', request))))
        self.assertFalse(any(event['type'] == 'questions' for event in events))
        self.assertTrue(any(event.get('status') == 'failed' and 'trois à six étapes' in event.get('error', '') for event in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_general_platform_capability_question_loads_skill_and_blocks_financial_tools(self):
        runtime = FinalRuntime()
        request = ChatRequest(
            accountId='mateo',
            message='Évalue ce que la plateforme peut réellement vérifier pour les critères ESG de Mateo.',
        )

        events = list(run_chat(request, runtime))

        skill_events = [event for event in events if event.get('name') in {'search_skills', 'load_skill'}]
        self.assertEqual([event['name'] for event in skill_events if event['status'] == 'done'], ['search_skills', 'load_skill'])
        self.assertEqual(skill_events[-1]['output']['id'], 'platform-capabilities')
        available = {tool['toolSpec']['name'] for tool in runtime.calls[0]['toolConfig']['tools']}
        self.assertEqual(available, {'ask_user', 'search_skills', 'load_skill'})
        self.assertIn('platform_available_tools', '\n'.join(block['text'] for block in runtime.calls[0]['system']))
        self.assertNotIn('inspect_supply_chain', available)
        self.assertEqual(events[-1]['type'], 'done')

    def test_workspace_accepts_simulation_results_as_shared_tabs(self):
        request = ChatRequest(
            message='Montre les trajectoires dans le chat',
            tabs=[{
                'id': 'simulation-abc',
                'title': 'Trajectoires · ABC',
                'kind': 'simulation',
                'content': '{"ticker":"ABC","branches":[]}',
            }],
        )
        self.assertEqual(request.tabs[0].kind, 'simulation')

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
        class PortfolioSequence(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls) == 2:
                    return stream_tool('load_skill', {'skill_id':'portfolio-exposures'})
                if len(self.calls) == 3:
                    return stream_tool('analyze_demo_portfolio', {})
                return response
        runtime = PortfolioSequence(stream_tool('search_skills', {'query':'portefeuille concentration'}))
        events = list(run_chat(ChatRequest(accountId='robert', message='Analyse la répartition de mon portefeuille'), runtime))
        tool_event = [event for event in events if event['type'] == 'tool' and event['name'] == 'analyze_demo_portfolio'][-1]
        self.assertEqual(tool_event['status'], 'done')
        self.assertEqual(tool_event['output'], summary)
        result = runtime.calls[-1]['messages'][-1]['content'][0]['toolResult']
        self.assertEqual(result['content'][0]['json'], summary)
        analyze.assert_called_once_with(persona='robert')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    @patch('investoros_api.profiles.service.analyze_configured_scenario')
    def test_scenario_tool_uses_only_supplied_assumptions_for_active_persona(self, analyze):
        result = {
            'name': 'Repli', 'persona': 'amira', 'changeValue': -3500,
            'provenance': {'assumptions': 'user_supplied_conditional_shocks'},
        }
        analyze.return_value = result
        runtime = RuntimeStub(stream_tool('analyze_demo_scenario', {
            'name': 'Repli', 'shocks': [{'positionId': 'technology', 'shockPct': -10}],
        }))

        events = list(run_chat(ChatRequest(accountId='amira', message='Applique cette hypothèse'), runtime))

        tool_event = [event for event in events if event['type'] == 'tool' and event['name'] == 'analyze_demo_scenario'][-1]
        self.assertEqual(tool_event['status'], 'done')
        self.assertEqual(tool_event['output'], result)
        self.assertEqual(runtime.calls[1]['messages'][-1]['content'][0]['toolResult']['content'][0]['json'], result)
        analyze.assert_called_once()
        scenario, = analyze.call_args.args
        self.assertEqual(scenario.name, 'Repli')
        self.assertEqual(scenario.shocks[0].shockPct, -10)
        self.assertEqual(analyze.call_args.kwargs, {'persona': 'amira'})

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    @patch('investoros_api.profiles.service.simulation_history')
    def test_simulation_history_tool_returns_real_observations_and_module_link(self, read_history):
        read_history.return_value = {
            'asset': {'ticker': 'ABC', 'name': 'Example Corp'},
            'currency': 'USD',
            'prices': [
                {'date': '2025-01-01', 'adjustedClose': 100.0},
                {'date': '2025-01-02', 'adjustedClose': 110.0},
            ],
            'events': [{'id': 'evt-1', 'date': '2025-01-02', 'kind': 'dividend', 'observedReturnsPct': {'1observations': 2.0}}],
            'method': 'Observed adjusted closes only.',
            'limitations': ['A date match does not prove causality.'],
            'source': 'prices_daily.csv · adj_close; corporate_actions.csv',
            'sourceAsOf': '2026-11-12',
        }
        runtime = RuntimeStub(stream_tool('inspect_simulation_history', {'ticker': 'abc', 'startDate': '2025-01-01'}))

        events = list(run_chat(ChatRequest(message='Analyse abc dans l’historique'), runtime))

        tool_event = [event for event in events if event['type'] == 'tool' and event['name'] == 'inspect_simulation_history'][-1]
        self.assertEqual(tool_event['status'], 'done')
        self.assertEqual(tool_event['output']['totalObservedReturnPct'], 10.0)
        self.assertEqual(tool_event['output']['eventCount'], 1)
        self.assertEqual(tool_event['output']['provenance']['moduleUrl'], '/app/scenarios?ticker=ABC')
        self.assertEqual(
            tool_event['output']['provenance']['sourceUrl'],
            'https://finance.yahoo.com/quote/ABC/history/',
        )
        read_history.assert_called_once()
        self.assertEqual(read_history.call_args.args, ('ABC',))
        self.assertEqual(read_history.call_args.kwargs, {'start': date(2025, 1, 1), 'end': None})

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    @patch('investoros_api.profiles.service.project_scenarios')
    def test_simulation_projection_tool_runs_only_with_valid_explicit_branches(self, project):
        project.return_value = {
            'ticker': 'ABC', 'asOf': '2025-01-02', 'source': 'prices_daily.csv',
            'branches': [{'id': 'down', 'shockPct': -10}],
            'method': 'Empirical marginal quantiles.', 'limitations': ['Not a forecast.'],
        }
        runtime = RuntimeStub(stream_tool('project_market_scenarios', {
            'ticker': 'ABC', 'horizonObservations': 20,
            'branches': [
                {'id': 'down', 'title': 'Baisse', 'event': 'Tarif explicite', 'shockPct': -10, 'eventAfterObservations': 5},
                {'id': 'up', 'title': 'Hausse', 'event': 'Tarif explicite', 'shockPct': 5, 'eventAfterObservations': 5},
            ],
        }))

        events = list(run_chat(ChatRequest(message='Compare ces hypothèses explicites'), runtime))

        tool_event = [event for event in events if event['type'] == 'tool' and event['name'] == 'project_market_scenarios'][-1]
        self.assertEqual(tool_event['status'], 'done')
        self.assertEqual(tool_event['output']['provenance']['moduleUrl'], '/app/scenarios?ticker=ABC')
        project.assert_called_once()
        request, = project.call_args.args
        self.assertEqual(request.branches[0].shockPct, -10)
        self.assertEqual(request.branches[1].shockPct, 5)
        final_workspace = [e for e in events if e['type']=='workspace'][-1]
        self.assertEqual(final_workspace['tabs'][-1]['id'], 'simulation-abc')
        self.assertEqual(final_workspace['tabs'][-1]['kind'], 'simulation')
        self.assertIn({'type':'profile_view','view':'scenarios'}, events)

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
