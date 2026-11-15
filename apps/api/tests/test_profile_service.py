"""Contract tests for tool validation and real stream event handling (no AWS calls)."""
import os
from copy import deepcopy
from datetime import date
import unittest
from unittest.mock import patch

from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat, VisibleText, _historical_calculation_requested


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

    def test_response_wrappers_are_removed_without_losing_the_answer(self):
        text = '<thinking>private</thinking><response>Risque < 10 %, source [1].</response>'
        for size in range(1, 14):
            with self.subTest(chunk_size=size):
                visible = VisibleText()
                chunks = [text[start:start + size] for start in range(0, len(text), size)]
                self.assertEqual(''.join(visible.push(chunk) for chunk in chunks) + visible.push('', final=True), 'Risque < 10 %, source [1].')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_scenario_navigation_selects_an_existing_simulation(self):
        runtime = RuntimeStub(stream_tool('open_profile_view', {'view':'scenarios', 'documentId':'simulation-aapl'}))
        request = ChatRequest(message='Ouvre le scénario AAPL', tabs=[{'id':'simulation-aapl','title':'AAPL','kind':'simulation','content':'{}'}])
        events = list(run_chat(request, runtime))
        self.assertIn({'type':'profile_view','view':'scenarios','documentId':'simulation-aapl'}, events)

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_scenario_navigation_rejects_a_note_as_simulation(self):
        runtime = RuntimeStub(stream_tool('open_profile_view', {'view':'scenarios', 'documentId':'note-aapl'}))
        request = ChatRequest(message='Ouvre le scénario AAPL', tabs=[{'id':'note-aapl','title':'AAPL','kind':'note','content':'{}'}])
        events = list(run_chat(request, runtime))
        tool = next(event for event in events if event.get('name')=='open_profile_view' and event.get('status')=='failed')
        self.assertIn('Document inconnu', tool['error'])
        self.assertFalse(any(event['type']=='profile_view' for event in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_new_alignment_uses_declarations_without_copying_an_old_interpretation(self):
        import json
        old = {'id':'profile-alignment','title':'Alignement','kind':'decision','content':'Une interprétation financière antérieure non vérifiée.'}
        runtime = FinalRuntime()
        request = ChatRequest(message='Publie un nouveau constat des tensions de mon profil', workspaceMode='profiles', profile={'horizon':'18 mois'}, tabs=[old])
        events = list(run_chat(request, runtime))
        context_block = next(block['text'] for block in runtime.calls[0]['system'] if block['text'].startswith('Contexte de travail'))
        context = json.loads(context_block.split('\n', 1)[1])
        self.assertEqual(context['profile']['horizon'], '18 mois')
        self.assertNotIn(old['content'], context_block)
        self.assertEqual(request.tabs[0].content, old['content'])
        self.assertEqual(events[-1]['code'], 'missing_insight')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_profile_card_retry_does_not_repeat_drafts_in_the_chat(self):
        import json
        good = {'title':'Projet et pertes','question':'Que faut-il clarifier pour ce projet ?', 'status':'tension',
                'summary':'La tolérance émotionnelle élevée ne démontre pas la capacité financière de perte pour ce projet à 18 mois.',
                'fields':['riskTolerance','lossCapacity'], 'alternatives':['Discuter de la conséquence d’une perte encore présente à l’échéance.']}
        bad = {**good, 'status':'clarification', 'summary':'Voici les constats, les compromis et les inconnues concernant ce projet.', 'alternatives':[]}
        final = 'La carte rassemble la tension et une piste de discussion.'
        calls = []
        class Runtime:
            def converse_stream(self, **kwargs):
                calls.append(deepcopy(kwargs))
                if len(calls) > 2:
                    return {'stream':[{'contentBlockDelta':{'contentBlockIndex':0,'delta':{'text':final}}},{'messageStop':{'stopReason':'end_turn'}}]}
                response = stream_tool('publish_profile_insight', bad if len(calls)==1 else good)
                for event in response['stream']:
                    for kind in ('contentBlockStart','contentBlockDelta'):
                        if kind in event:event[kind]['contentBlockIndex']=1
                    if 'contentBlockStart' in event:event['contentBlockStart']['start']['toolUse']['toolUseId']='publish-'+str(len(calls))
                response['stream'].insert(0, {'contentBlockDelta':{'contentBlockIndex':0,'delta':{'text':'Voici un long brouillon qui ne doit pas être affiché deux fois.'}}})
                return response
        events=list(run_chat(ChatRequest(message='Publie un constat des tensions',workspaceMode='profiles',profile={'riskTolerance':'Élevée','lossCapacity':'Ne peut absorber une perte','horizon':'18 mois'}),Runtime()))
        self.assertEqual(''.join(event['delta'] for event in events if event['type']=='text'),final)
        self.assertEqual([event['status'] for event in events if event.get('name')=='publish_profile_insight' and event.get('status') in {'done','failed'}],['failed','done'])
        self.assertEqual(calls[0]['toolConfig']['toolChoice'],{'any':{}})
        self.assertNotIn('toolChoice',calls[-1]['toolConfig'])
        card=json.loads(next(tab['content'] for tab in [event for event in events if event['type']=='workspace'][-1]['tabs'] if tab['id']=='profile-alignment'))
        self.assertEqual(card['summary'],good['summary'])
        self.assertEqual(events[-1]['type'],'done')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_profile_plan_is_shown_before_approval_when_tool_drafts_are_buffered(self):
        plan='1. Clarifier le projet.\n2. Relever les contraintes déclarées.\n3. Présenter les inconnues à discuter.'
        form={'title':'Valider le plan','purpose':'plan_approval','questions':[{'id':'approval','label':'Lancer ce plan ?','kind':'single_choice','options':[{'id':'yes','label':'Oui, lancer ce plan'},{'id':'edit','label':'Modifier le plan'}]}]}
        response=stream_tool('ask_user',form)
        for event in response['stream']:
            for kind in ('contentBlockStart','contentBlockDelta'):
                if kind in event:event[kind]['contentBlockIndex']=1
        response['stream'].insert(0,{'contentBlockDelta':{'contentBlockIndex':0,'delta':{'text':plan}}})
        events=list(run_chat(ChatRequest(message='Prépare un plan pour construire mon profil',workspaceMode='profiles'),RuntimeStub(response)))
        self.assertEqual(''.join(event['delta'] for event in events if event['type']=='text'),plan+'\n\n')
        self.assertLess(next(i for i,e in enumerate(events) if e['type']=='text'),next(i for i,e in enumerate(events) if e['type']=='questions'))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID':'test-model'})
    def test_historical_only_turn_cannot_modify_profile_or_publish_alignment(self):
        runtime=RuntimeStub(stream_tool('update_profile',{'fields':{'horizon':'25 ans'}}))
        request=ChatRequest(message='Compare historiquement AAPL et MSFT. Cette demande porte seulement sur les historiques. Ouvre Comparer.',workspaceMode='profiles',profile={'horizon':'18 mois'})
        events=list(run_chat(request,runtime))
        offered={tool['toolSpec']['name'] for tool in runtime.calls[0]['toolConfig']['tools']}
        self.assertNotIn('update_profile',offered)
        self.assertNotIn('publish_profile_insight',offered)
        self.assertIn('compare_profile_instruments',offered)
        self.assertEqual(request.profile['horizon'],'18 mois')
        self.assertFalse(any(event['type']=='workspace' and event['profile'].get('horizon')=='25 ans' for event in events))
        self.assertEqual(events[-1]['code'],'missing_comparison')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID':'test-model'})
    @patch('investoros_api.profiles.service.compare_instruments')
    def test_historical_only_calculation_finishes_on_comparison_without_changing_the_profile(self, compare):
        compare.return_value={'type':'comparison','title':'AAPL / MSFT','metrics':[],'series':[]}
        runtime=RuntimeStub(stream_tool('compare_profile_instruments',{'tickers':['AAPL','MSFT']}))
        request=ChatRequest(message='Compare historiquement AAPL et MSFT. Ouvre Comparer.',workspaceMode='profiles',profile={'horizon':'18 mois'})
        events=list(run_chat(request,runtime))
        self.assertEqual([event for event in events if event['type']=='profile_view'][-1]['view'],'comparison')
        self.assertEqual([event for event in events if event['type']=='workspace'][-1]['profile'],{'horizon':'18 mois'})
        self.assertEqual(events[-1]['type'],'done')
        compare.assert_called_once()

    @patch('investoros_api.profiles.service.simulation_assets',return_value={'assets':[{'ticker':'AAPL'},{'ticker':'MSFT'}]})
    def test_comparison_calculation_intent_distinguishes_concepts_and_negation(self, assets):
        for message in ['Compare historiquement AAPL et MSFT','Compare le rendement historique de AAPL et MSFT']:
            self.assertTrue(_historical_calculation_requested(ChatRequest(message=message)))
        for message in ['Compare rendement historique et rendement attendu','Ne compare pas historiquement AAPL et MSFT','Je ne veux pas comparer historiquement AAPL et MSFT']:
            self.assertFalse(_historical_calculation_requested(ChatRequest(message=message)))

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
    def test_declared_capacity_is_recomputed_after_update_and_wrong_final_is_repaired(self):
        declaration = 'Je ne peux pas absorber une perte compromettant ce projet'
        class CapacityRuntime(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls) == 2:
                    return {'stream': [
                        {'contentBlockDelta': {'contentBlockIndex': 0, 'delta': {'text': 'La capacité financière reste inconnue.'}}},
                        {'messageStop': {'stopReason': 'end_turn'}},
                    ]}
                return response
        runtime = CapacityRuntime(stream_tool('update_profile', {'fields': {'lossCapacity': declaration}}))
        events = list(run_chat(ChatRequest(message='Voici ma capacité de perte', workspaceMode='profiles'), runtime))
        self.assertEqual(len(runtime.calls), 3)
        context = '\n'.join(block['text'] for block in runtime.calls[1]['system'])
        self.assertIn('"lossCapacity": {"state": "declared", "value": "' + declaration + '"}', context)
        self.assertNotIn('inconnue', ''.join(event.get('delta', '') for event in events))
        self.assertEqual(events[-1]['type'], 'done')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_repeated_declared_capacity_conflict_has_bounded_recovery(self):
        runtime = FinalRuntime()
        def wrong_answer(**kwargs):
            runtime.calls.append(deepcopy(kwargs))
            return {'stream': [
                {'contentBlockDelta': {'contentBlockIndex': 0, 'delta': {'text': 'Votre capacité de perte reste inconnue.'}}},
                {'messageStop': {'stopReason': 'end_turn'}},
            ]}
        runtime.converse_stream = wrong_answer
        events = list(run_chat(ChatRequest(message='Explique mon profil', workspaceMode='profiles',
            profile={'lossCapacity': 'Je ne peux pas absorber une perte compromettant ce projet'}), runtime))
        self.assertEqual(len(runtime.calls), 3)
        self.assertEqual(events[-1]['code'], 'profile_claim_conflict')
        self.assertFalse(any(event['type'] == 'text' for event in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_invalid_insight_gets_targeted_reformulation_context(self):
        args = {'title': 'Constat', 'question': 'Quelle tension ?', 'status': 'information',
                'summary': 'Un constat trop long. ' * 60, 'fields': ['horizon']}
        class ReformulatedRuntime(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls) == 2:
                    return stream_tool('publish_profile_insight', {**args,
                        'summary': 'Les fonds du projet sont nécessaires dans 18 mois.'})
                return response
        runtime = ReformulatedRuntime(stream_tool('publish_profile_insight', args))
        events = list(run_chat(ChatRequest(message='Publie un constat dans Alignement', workspaceMode='profiles'), runtime))
        context = '\n'.join(block['text'] for block in runtime.calls[1]['system'])
        self.assertIn('La carte précédente a été refusée', context)
        self.assertIn('250 à 450 caractères', context)
        recovery_tools = {tool['toolSpec']['name'] for tool in runtime.calls[1]['toolConfig']['tools']}
        self.assertNotIn('suggest_followups', recovery_tools)
        self.assertNotIn('upsert_tab', recovery_tools)
        self.assertEqual(events[-1]['type'], 'done')
        self.assertEqual(len([e for e in events if e.get('name') == 'publish_profile_insight' and e.get('status') == 'failed']), 1)

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_repeated_invalid_insight_stops_after_two_reformulations(self):
        class RepeatedInvalid(RuntimeStub):
            def converse_stream(self, **kwargs):
                self.calls.append(deepcopy(kwargs))
                return self.first
        runtime = RepeatedInvalid(stream_tool('publish_profile_insight', {
            'title': 'Constat', 'question': 'Quelle tension ?', 'status': 'information',
            'summary': 'Un constat trop long. ' * 60, 'fields': ['horizon']}))
        events = list(run_chat(ChatRequest(message='Publie un constat dans Alignement', workspaceMode='profiles'), runtime))
        self.assertEqual(len(runtime.calls), 3)
        self.assertEqual(events[-1]['code'], 'insight_validation_failed')
        self.assertFalse(any(event['type'] == 'text' for event in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    @patch('investoros_api.profiles.service.analyze_configured_portfolio')
    def test_alignment_attaches_server_portfolio_weights_without_model_copy(self, analyze):
        import json
        analyze.return_value = {'portfolioName': 'Portefeuille de test', 'currency': 'CAD',
            'positions': [{'label': 'Liquidités (fixture)', 'weightPct': 70},
                          {'label': 'Actions (fixture)', 'weightPct': 30}]}
        args = {'title': 'Fonds pour le projet', 'question': 'Que peut-on observer ?', 'status': 'partial',
            'summary': 'Les catégories ne permettent pas de mesurer les pertes du portefeuille.',
            'fields': ['lossCapacity'], 'alternatives': ['Préciser le montant indispensable au projet']}
        class PortfolioCardRuntime(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls) == 2:
                    return stream_tool('analyze_demo_portfolio', {})
                if len(self.calls) == 3:
                    return stream_tool('publish_profile_insight', args)
                if len(self.calls) == 4:
                    return {'stream': [{'messageStop': {'stopReason': 'end_turn'}}]}
                return response
        runtime = PortfolioCardRuntime(stream_tool('load_skill', {'skill_id': 'portfolio-exposures'}))
        events = list(run_chat(ChatRequest(accountId='robert', workspaceMode='profiles',
            message='Lis le portefeuille fictif et publie un constat dans Alignement',
            profile={'lossCapacity': 'Je ne peux pas perdre les fonds du projet'}), runtime))
        workspace = [event for event in events if event['type'] == 'workspace'][-1]
        card = json.loads(next(tab['content'] for tab in workspace['tabs'] if tab['id'] == 'profile-alignment'))
        self.assertEqual(card['portfolioBasis'], analyze.return_value)
        self.assertNotIn('portfolioBasis', args)
        self.assertEqual(''.join(event.get('delta', '') for event in events), args['summary'])
        self.assertEqual(events[-1]['type'], 'done')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    @patch('investoros_api.profiles.service.project_scenarios')
    def test_note_only_keeps_financial_tools_unavailable_after_note_creation(self, project):
        class NoteRuntime(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls) == 2:
                    return stream_tool('project_market_scenarios', {'ticker': 'AAPL'})
                return response
        runtime = NoteRuntime(stream_tool('upsert_tab', {'id':'note-test','title':'Synthèse',
            'kind':'note','content':'Les scénarios sont conditionnels.'}))
        events = list(run_chat(ChatRequest(message='Crée une note pour rappeler que les scénarios sont conditionnels, puis ouvre Documents.',
            workspaceMode='profiles', tabs=[{'id':'simulation-aapl','title':'AAPL','kind':'simulation','content':'{"horizonObservations":30}'}]), runtime))
        for call in runtime.calls:
            self.assertNotIn('project_market_scenarios', {t['toolSpec']['name'] for t in call['toolConfig']['tools']})
        project.assert_not_called()
        workspace = [e for e in events if e['type'] == 'workspace'][-1]
        self.assertEqual(next(t for t in workspace['tabs'] if t['id']=='simulation-aapl')['content'], '{"horizonObservations":30}')
        self.assertEqual(events[-1]['type'], 'done')

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    @patch('investoros_api.profiles.service.project_scenarios')
    def test_completed_scenario_has_confirmation_when_model_finishes_without_text(self, project):
        project.return_value = {'ticker':'AAPL','asOf':'2025-01-02','source':'Fixture test','branches':[], 'method':'Test arithmetic', 'limitations':['Test only']}
        class EmptyFinal(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls)>1:
                    return {'stream':[{'messageStop':{'stopReason':'end_turn'}}]}
                return response
        runtime = EmptyFinal(stream_tool('project_market_scenarios', {'ticker':'AAPL','horizonObservations':20,
            'branches':[{'id':'down','title':'Baisse','shockPct':-10,'eventAfterObservations':10},
                        {'id':'up','title':'Hausse','shockPct':10,'eventAfterObservations':10}]}))
        events = list(run_chat(ChatRequest(message='Affiche ces hypothèses',workspaceMode='profiles'), runtime))
        text = ''.join(e.get('delta','') for e in events)
        self.assertIn('a été calculé', text)
        self.assertIn('n’est pas une prévision', text)
        self.assertEqual(events[-1]['type'],'done')

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
        self.assertIn({'type':'profile_view','view':'scenarios','documentId':'simulation-abc'}, events)

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
