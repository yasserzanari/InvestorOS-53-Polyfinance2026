"""Inline portfolio widget orchestration; model and data calls stay local stubs."""
from copy import deepcopy
import hashlib
import json
import os
import unittest
from unittest.mock import patch

from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat
from investoros_api.profiles.skills import load_skill, search_skills
from test_profile_service import RuntimeStub, stream_tool


def tool_step(name, args, identifier):
    response = stream_tool(name, args)
    response['stream'][0]['contentBlockStart']['start']['toolUse']['toolUseId'] = identifier
    return response


class WidgetRuntime(RuntimeStub):
    def __init__(self, *steps):
        super().__init__(steps[0])
        self.steps = steps

    def converse_stream(self, **kwargs):
        response = super().converse_stream(**kwargs)
        if len(self.calls) <= len(self.steps):
            return deepcopy(self.steps[len(self.calls) - 1])
        return response


def completed_tools(events, name):
    return [event for event in events
            if event.get('name') == name and event.get('status') == 'done']


@patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
class FinancialWidgetServiceTests(unittest.TestCase):
    def test_deictic_period_is_enforced_but_an_explicit_new_period_wins(self):
        for prompt, wrong, correct in [('Affiche la période que je viens de sélectionner.', '1M', '1Y'),
                                       ('Affiche cette carte sur un mois.', None, '1M')]:
            with self.subTest(prompt=prompt):
                steps = ([tool_step('render_portfolio_widget', {'view': 'portfolio', 'period': wrong}, 'wrong')] if wrong else [])
                steps.append(tool_step('render_portfolio_widget', {'view': 'portfolio', 'period': correct}, 'correct'))
                runtime = WidgetRuntime(*steps)
                with patch('investoros_api.profiles.service.render_portfolio_widget', return_value={'view': 'portfolio'}) as render:
                    events = list(run_chat(ChatRequest(message=prompt, widgetContext=[{'view': 'portfolio', 'period': '1Y'}]), runtime))
                render.assert_called_once_with(persona='mateo', view='portfolio', period=correct)
                if wrong:
                    self.assertTrue(any(event.get('id') == 'wrong' and event.get('status') == 'failed' for event in events))
                self.assertEqual(events[-1]['type'], 'done')

    def test_visual_sector_caption_cannot_repeat_a_model_direction_error(self):
        final = {'stream': [{'contentBlockDelta': {'contentBlockIndex': 0, 'delta': {'text': 'Énergie progresse.'}}},
                            {'messageStop': {'stopReason': 'end_turn'}}]}
        runtime = WidgetRuntime(tool_step('render_portfolio_widget', {'view': 'sectors'}, 'widget-1'), final)
        output = {'view': 'sectors', 'period': '1M', 'sectors': [{'id': 'energy', 'label': 'Énergie'}],
                  'periods': {'1M': {'sectors': [{'id': 'energy', 'changePct': -1.4}]}}}
        with patch('investoros_api.profiles.service.render_portfolio_widget', return_value=output):
            events = list(run_chat(ChatRequest(message='Montre les variations par secteur.'), runtime))
        visible = ''.join(event.get('delta', '') for event in events if event['type'] == 'text')
        self.assertEqual(visible, 'En baisse : Énergie.')
        self.assertEqual(events[-1]['type'], 'done')

    def test_selected_widget_controls_reach_model_without_browser_financial_inputs(self):
        runtime = RuntimeStub(stream_tool('render_portfolio_widget', {'view': 'portfolio', 'period': '1Y'}))
        request = ChatRequest(message='Montre la période sélectionnée.', widgetContext=[{'view': 'portfolio', 'period': '1Y'}])
        with patch('investoros_api.profiles.service.render_portfolio_widget', return_value={'view': 'portfolio'}):
            events = list(run_chat(request, runtime))
        block = next(item['text'] for item in runtime.calls[0]['system'] if item['text'].startswith('Contexte de travail'))
        context = json.loads(block.split('\n', 1)[1])
        self.assertEqual(context['widget_controls'], [{'view': 'portfolio', 'period': '1Y'}])
        self.assertEqual(events[-1]['type'], 'done')
        from pydantic import ValidationError
        for context in [[{'view': 'portfolio', 'period': '1M', 'totalValue': 999}],
                        [{'view': 'portfolio', 'period': '1M', 'accountId': 'amira'}],
                        [{'view': 'portfolio', 'period': '1M'}] * 6]:
            with self.subTest(context=context), self.assertRaises(ValidationError):
                ChatRequest(message='Afficher', widgetContext=context)

    def test_each_view_routes_server_data_into_an_inline_event_and_model_result(self):
        cases = [('portfolio', '1M'), ('heatmap', '1D'), ('allocation', '1Y'),
                 ('contributions', '1W'), ('sectors', '1D')]
        for view, period in cases:
            with self.subTest(view=view, period=period):
                output = {'view': view, 'period': period, 'currency': 'CAD',
                          'positions': [], 'coverage': {'state': 'unavailable'},
                          'limitations': ['Historique indisponible.']}
                expected = deepcopy(output)
                runtime = WidgetRuntime(tool_step('render_portfolio_widget',
                                                  {'view': view, 'period': period}, 'widget-1'))
                with patch('investoros_api.profiles.service.render_portfolio_widget',
                           return_value=output) as render:
                    events = list(run_chat(ChatRequest(accountId='robert',
                                                       message='Montre mon portefeuille dans le chat.'), runtime))

                render.assert_called_once_with(persona='robert', view=view, period=period)
                offered = {tool['toolSpec']['name'] for tool in runtime.calls[0]['toolConfig']['tools']}
                self.assertIn('render_portfolio_widget', offered)
                widgets = [event for event in events if event['type'] == 'financial_widget']
                self.assertEqual(widgets, [{'type': 'financial_widget',
                                           'widget': {**expected, 'id': 'widget-1'}}])
                done = completed_tools(events, 'render_portfolio_widget')
                self.assertEqual(len(done), 1)
                self.assertEqual(done[0]['output'], expected)
                self.assertEqual(output, expected)
                self.assertLess(events.index(widgets[0]), events.index(done[0]))
                results = [block['toolResult'] for message in runtime.calls[-1]['messages']
                           for block in message['content'] if 'toolResult' in block]
                self.assertIn({'toolUseId': 'widget-1', 'content': [{'json': expected}],
                               'status': 'success'}, results)
                self.assertFalse(any(event['type'] == 'profile_view' for event in events))
                self.assertEqual(events[-1]['type'], 'done')

    def test_active_account_is_injected_and_missing_period_uses_server_default(self):
        for account in ('amira', 'mateo', 'robert'):
            with self.subTest(account=account):
                runtime = WidgetRuntime(tool_step('render_portfolio_widget',
                                                  {'view': 'portfolio'}, 'widget-1'))
                with patch('investoros_api.profiles.service.render_portfolio_widget',
                           return_value={'view': 'portfolio'}) as render:
                    events = list(run_chat(ChatRequest(accountId=account,
                                                       message='Montre mon portefeuille.'), runtime))
                render.assert_called_once_with(persona=account, view='portfolio', period='1M')
                self.assertEqual(len(completed_tools(events, 'render_portfolio_widget')), 1)

    def test_invalid_inputs_and_model_supplied_accounts_fail_before_data_access(self):
        invalid = [
            {'view': 'html'},
            {'view': 'portfolio', 'period': '1J'},
            {'view': 'portfolio', 'period': None},
            {'period': '1M'},
            {'view': 'portfolio', 'accountId': 'amira'},
            {'view': 'portfolio', 'persona': 'amira'},
            {'view': 'portfolio', 'positions': [{'ticker': 'INVENTED', 'returnPct': 12}]},
            {'view': 'portfolio', 'html': '<script>untrusted()</script>'},
            ['portfolio', '1M'],
        ]
        for args in invalid:
            with self.subTest(args=args):
                runtime = WidgetRuntime(tool_step('render_portfolio_widget', args, 'widget-1'))
                with patch('investoros_api.profiles.service.render_portfolio_widget') as render:
                    events = list(run_chat(ChatRequest(accountId='robert',
                                                       message='Montre mon portefeuille.'), runtime))
                render.assert_not_called()
                self.assertFalse(any(event['type'] == 'financial_widget' for event in events))
                self.assertFalse(completed_tools(events, 'render_portfolio_widget'))
                self.assertTrue(any(event.get('name') == 'render_portfolio_widget'
                                    and event.get('status') == 'failed' for event in events))
                self.assertFalse(completed_tools(events, 'load_skill'))

    def test_fallback_discovers_and_loads_the_reviewed_skill_with_integrity_trace(self):
        runtime = WidgetRuntime(tool_step('render_portfolio_widget',
                                          {'view': 'sectors', 'period': '1W'}, 'widget-1'))
        with patch('investoros_api.profiles.service.render_portfolio_widget',
                   return_value={'view': 'sectors'}), \
                patch('investoros_api.profiles.service.search_skills', wraps=search_skills) as search, \
                patch('investoros_api.profiles.service.load_skill', wraps=load_skill) as load:
            events = list(run_chat(ChatRequest(message='Montre la variation par secteur.'), runtime))

        search.assert_called_once_with(query='portfolio-visual-widgets', limit=8)
        load.assert_called_once_with('portfolio-visual-widgets')
        loaded = completed_tools(events, 'load_skill')
        self.assertEqual(len(loaded), 1)
        skill = loaded[0]['output']
        self.assertEqual(skill['id'], 'portfolio-visual-widgets')
        self.assertEqual(skill['sha256'], hashlib.sha256(skill['content'].encode()).hexdigest())
        self.assertEqual(skill['version'], load_skill('portfolio-visual-widgets')['version'])
        self.assertIn('render_portfolio_widget', skill['required_tools'])
        self.assertTrue(loaded[0]['id'].startswith('runtime-'))
        search_done = completed_tools(events, 'search_skills')[0]
        self.assertEqual(search_done['actor'], 'runtime-bootstrap')
        self.assertEqual(loaded[0]['actor'], 'runtime-bootstrap')
        widget = next(event for event in events if event['type'] == 'financial_widget')
        self.assertLess(events.index(search_done), events.index(loaded[0]))
        self.assertLess(events.index(loaded[0]), events.index(widget))
        context_block = next(block['text'] for block in runtime.calls[-1]['system']
                             if block['text'].startswith('Contexte de travail'))
        context = json.loads(context_block.split('\n', 1)[1])
        self.assertIn({'id': skill['id'], 'content': skill['content']}, context['loaded_skills'])

    def test_model_loaded_skill_is_reused_without_a_second_fallback_load(self):
        runtime = WidgetRuntime(
            tool_step('search_skills', {'query': 'portfolio-visual-widgets'}, 'search-1'),
            tool_step('load_skill', {'skill_id': 'portfolio-visual-widgets'}, 'skill-1'),
            tool_step('render_portfolio_widget', {'view': 'heatmap', 'period': '1D'}, 'widget-1'),
        )
        with patch('investoros_api.profiles.service.render_portfolio_widget',
                   return_value={'view': 'heatmap'}), \
                patch('investoros_api.profiles.service.search_skills', wraps=search_skills) as search, \
                patch('investoros_api.profiles.service.load_skill', wraps=load_skill) as load:
            events = list(run_chat(ChatRequest(message='Montre mes positions en carte de chaleur.'), runtime))
        search.assert_called_once_with('portfolio-visual-widgets', 4)
        load.assert_called_once_with('portfolio-visual-widgets')
        self.assertEqual(len(completed_tools(events, 'load_skill')), 1)
        self.assertNotEqual(completed_tools(events, 'load_skill')[0].get('actor'), 'runtime-bootstrap')
        self.assertEqual(len([event for event in events if event['type'] == 'financial_widget']), 1)

    def test_backend_failure_cannot_emit_a_widget_or_successful_tool_result(self):
        for failure in (ValueError('Historique et conversion indisponibles.'), RuntimeError('Unavailable')):
            with self.subTest(failure=type(failure).__name__):
                runtime = WidgetRuntime(tool_step('render_portfolio_widget',
                                                  {'view': 'portfolio', 'period': '1Y'}, 'widget-1'))
                with patch('investoros_api.profiles.service.render_portfolio_widget',
                           side_effect=failure) as render:
                    events = list(run_chat(ChatRequest(message='Montre mon portefeuille.'), runtime))
                render.assert_called_once()
                self.assertFalse(any(event['type'] == 'financial_widget' for event in events))
                self.assertFalse(completed_tools(events, 'render_portfolio_widget'))
                self.assertTrue(any(event.get('status') == 'failed' or event['type'] == 'error'
                                    for event in events))
                results = [block['toolResult'] for call in runtime.calls[1:]
                           for message in call['messages'] for block in message['content']
                           if 'toolResult' in block and block['toolResult']['toolUseId'] == 'widget-1']
                self.assertFalse(any(result['status'] == 'success' for result in results))

    def test_followups_keep_the_widget_and_existing_documents_without_opening_tabs(self):
        prompts = ['Montre la répartition.', 'Montre les gains et pertes.']
        runtime = WidgetRuntime(
            tool_step('render_portfolio_widget', {'view': 'allocation', 'period': '1M'}, 'widget-1'),
            tool_step('suggest_followups', {'prompts': prompts}, 'followups-1'),
        )
        document = {'id': 'existing-note', 'title': 'Notes', 'kind': 'note', 'content': 'À conserver.'}
        request = ChatRequest(message='Montre la répartition de mon portefeuille.', tabs=[document])
        before = [tab.model_dump() for tab in request.tabs]
        output = {'view': 'allocation', 'period': '1M', 'positions': []}
        with patch('investoros_api.profiles.service.render_portfolio_widget', return_value=output):
            events = list(run_chat(request, runtime))
        widgets = [event for event in events if event['type'] == 'financial_widget']
        self.assertEqual(widgets, [{'type': 'financial_widget', 'widget': {**output, 'id': 'widget-1'}}])
        followups = next(event for event in events if event['type'] == 'followups')
        self.assertEqual([item['label'] for item in followups['prompts']], prompts)
        self.assertLess(events.index(widgets[0]), events.index(followups))
        self.assertFalse(any(event['type'] == 'profile_view' for event in events))
        workspace = [event for event in events if event['type'] == 'workspace'][-1]
        self.assertEqual(workspace['tabs'], before)
        self.assertEqual([tab.model_dump() for tab in request.tabs], before)
        self.assertEqual(events[-1]['type'], 'done')


if __name__ == '__main__':
    unittest.main()
