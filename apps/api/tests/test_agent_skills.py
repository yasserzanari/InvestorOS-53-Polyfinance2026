"""Skills discovery, runtime tool dispatch and fixed-origin research boundaries."""
import json
import os
import unittest
from unittest.mock import patch

from investoros_api.profiles.skills import search_skills, load_skill
from investoros_api.profiles.research_bridge import research_tool
from investoros_api.profiles.service import SYSTEM, run_chat
from investoros_api.profiles.models import AskUserInput, ChatRequest
from test_profile_service import RuntimeStub, stream_tool


class SkillSequence(RuntimeStub):
    def converse_stream(self, **kwargs):
        response = super().converse_stream(**kwargs)
        if len(self.calls) == 2:
            return stream_tool('load_skill', {'skill_id': 'company-analysis'})
        return response


class AgentSkillTests(unittest.TestCase):
    def test_system_prompt_exposes_a_user_facing_plan_without_revealing_private_reasoning(self):
        self.assertIn('plan de décision visible de trois à six étapes', SYSTEM)
        self.assertIn('chaîne de pensée privée', SYSTEM)
        self.assertNotIn('aucun plan annoncé', SYSTEM)

    def test_plan_approval_form_has_a_distinct_validated_purpose(self):
        form = AskUserInput.model_validate({
            'title': 'Valider le plan', 'purpose': 'plan_approval',
            'questions': [{'id': 'approval', 'label': 'Que souhaitez-vous faire ?', 'kind': 'single_choice',
                'required': True, 'allowOther': True,
                'options': [{'id': 'launch', 'label': 'Oui, lancer ce plan'}, {'id': 'edit', 'label': 'Modifier le plan'}]}],
        })
        self.assertEqual(form.purpose, 'plan_approval')
        with self.assertRaisesRegex(ValueError, 'validation doit proposer'):
            AskUserInput.model_validate({'title': 'Valider', 'purpose': 'plan_approval', 'questions': [{
                'id': 'approval', 'label': 'Valider ?', 'kind': 'single_choice', 'options': [
                    {'id': 'yes', 'label': 'Oui'}, {'id': 'no', 'label': 'Non'}]}]})

    def test_french_search_is_accent_insensitive_and_content_is_lazy(self):
        results = search_skills('chaine approvisionnement')
        self.assertEqual(results['skills'][0]['id'], 'supply-chain')
        self.assertNotIn('content', results['skills'][0])
        self.assertIn('start_analysis', load_skill('company-analysis')['required_tools'])

    def test_analysis_use_cases_discover_the_planning_and_domain_skills(self):
        cases = {
            'diversification portefeuille tolérance risque': {'analysis-planning', 'portfolio-exposures', 'profile-investment-alignment'},
            'critères ESG personnels preuves entreprise': {'analysis-planning', 'profile-investment-alignment', 'evidence-review', 'company-analysis'},
            'horizon court stabilité rumeur média NVDA': {'analysis-planning', 'profile-investment-alignment', 'company-analysis', 'evidence-review'},
            'pourquoi NVDA a chuté hier explication mouvement bourse': {'market-movement-investigation'},
            'Chine exposition marché fournisseur NVDA': {'supply-chain', 'platform-capabilities'},
            'plateforme capacités score ESG couvertures': {'platform-capabilities'},
        }
        for query, expected in cases.items():
            with self.subTest(query=query):
                found = {item['id'] for item in search_skills(query)['skills']}
                self.assertTrue(expected <= found, f'{query}: missing {expected-found}')

    def test_unknown_path_and_bad_query_are_rejected(self):
        for identifier in ('../service.py', 'invented'):
            with self.assertRaises(ValueError):
                load_skill(identifier)
        for limit in (0, 9, True):
            with self.assertRaises(ValueError):
                search_skills('analyse', limit)

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model', 'RESEARCH_API_URL': ''})
    def test_skill_is_delivered_to_model_and_visible_activity(self):
        client = SkillSequence(stream_tool('search_skills', {'query': 'analyse entreprise'}))
        events = list(run_chat(ChatRequest(message='Analyse NVDA pour la semaine prochaine'), client))
        loaded = [event for event in events if event['type'] == 'tool' and event['status'] == 'done' and event['name'] == 'load_skill'][0]
        self.assertEqual(loaded['output']['id'], 'company-analysis')
        names = {tool['toolSpec']['name'] for tool in client.calls[0]['toolConfig']['tools']}
        self.assertIn('search_skills', names)
        self.assertNotIn('start_analysis', names)
        self.assertIn('content', client.calls[2]['messages'][-1]['content'][0]['toolResult']['content'][0]['json'])

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model', 'RESEARCH_API_URL': ''})
    def test_model_cannot_invoke_disabled_research(self):
        client = RuntimeStub(stream_tool('start_analysis', {'question': 'Analyse NVDA cette semaine'}))
        with patch('investoros_api.profiles.service.research_tool') as dispatch:
            events = list(run_chat(ChatRequest(message='Analyse NVDA'), client))
        dispatch.assert_not_called()
        self.assertTrue(any(event.get('status') == 'failed' for event in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model', 'RESEARCH_API_URL': 'https://example.com'})
    def test_research_requires_a_discovered_loaded_skill(self):
        client = RuntimeStub(stream_tool('start_analysis', {'question': 'Analyse NVDA cette semaine'}))
        with patch('investoros_api.profiles.service.research_tool') as dispatch:
            events = list(run_chat(ChatRequest(message='Analyse NVDA'), client))
        dispatch.assert_not_called()
        self.assertTrue(any('analysis-planning' in event.get('error', '') for event in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model', 'RESEARCH_API_URL': 'https://example.com'})
    def test_discover_load_start_runs_once_and_duplicate_is_blocked(self):
        class Sequence(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls) == 2:
                    return stream_tool('load_skill', {'skill_id': 'analysis-planning'})
                if len(self.calls) == 3:
                    return stream_tool('load_skill', {'skill_id': 'company-analysis'})
                if len(self.calls) in (4, 5):
                    return stream_tool('start_analysis', {'question': 'Analyse NVDA cette semaine'})
                return response
        client = Sequence(stream_tool('search_skills', {'query': 'analyse plan entreprise'}))
        with patch('investoros_api.profiles.service.research_tool', return_value={'analysis_id': 'confirmed', 'status': 'queued'}) as dispatch:
            events = list(run_chat(ChatRequest(message='Analyse NVDA; lance sans autre question.'), client))
        dispatch.assert_called_once_with('start_analysis', {'question': 'Analyse NVDA cette semaine'}, 'mateo')
        self.assertTrue(any('Une seule tentative' in event.get('error', '') for event in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model', 'RESEARCH_API_URL': 'https://example.com'})
    def test_start_analysis_is_blocked_until_plan_is_explicitly_approved(self):
        class Sequence(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls) == 2:
                    return stream_tool('load_skill', {'skill_id': 'analysis-planning'})
                if len(self.calls) == 3:
                    return stream_tool('load_skill', {'skill_id': 'company-analysis'})
                if len(self.calls) == 4:
                    return stream_tool('start_analysis', {'question': 'Analyse NVDA cette semaine'})
                return response
        client = Sequence(stream_tool('search_skills', {'query': 'analyse plan entreprise'}))
        with patch('investoros_api.profiles.service.research_tool') as dispatch:
            events = list(run_chat(ChatRequest(message='Analyse NVDA cette semaine'), client))
        dispatch.assert_not_called()
        self.assertTrue(any(event.get('status') == 'failed' and 'validation du plan' in event.get('error', '') for event in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model', 'RESEARCH_API_URL': 'https://example.com'})
    def test_start_analysis_accepts_the_selected_plan_approval(self):
        class Sequence(RuntimeStub):
            def converse_stream(self, **kwargs):
                response = super().converse_stream(**kwargs)
                if len(self.calls) == 2:
                    return stream_tool('load_skill', {'skill_id': 'analysis-planning'})
                if len(self.calls) == 3:
                    return stream_tool('load_skill', {'skill_id': 'company-analysis'})
                if len(self.calls) == 4:
                    return stream_tool('start_analysis', {'question': 'Analyse NVDA cette semaine'})
                return response
        form = {'id': 'plan-question', 'title': 'Valider le plan', 'purpose': 'plan_approval', 'questions': [{
            'id': 'approval', 'label': 'Que faire ?', 'kind': 'single_choice', 'required': True, 'allowOther': True,
            'options': [{'id': 'launch', 'label': 'Oui, lancer ce plan'}, {'id': 'edit', 'label': 'Modifier le plan'}]}]}
        answer = {'requestId': 'plan-question', 'answers': [{'questionId': 'approval', 'selectedOptionIds': ['launch'], 'text': ''}]}
        request = ChatRequest(message='Oui, lancer ce plan', history=[{'role': 'assistant', 'content': '1. Définir la question\n2. Vérifier les sources\n3. Comparer les faits et les limites'}], questionRequest=form, questionAnswer=answer)
        client = Sequence(stream_tool('search_skills', {'query': 'analyse plan entreprise'}))
        with patch('investoros_api.profiles.service.research_tool', return_value={'analysis_id': 'approved', 'status': 'queued'}) as dispatch:
            events = list(run_chat(request, client))
        dispatch.assert_called_once_with('start_analysis', {'question': 'Analyse NVDA cette semaine'}, 'mateo')
        self.assertTrue(any(event.get('name') == 'start_analysis' and event.get('status') == 'done' for event in events))

    @patch('investoros_api.profiles.research_bridge._call')
    def test_persona_comes_from_server_context(self, call):
        call.return_value = {'analysis_id': 'test', 'status': 'queued'}
        research_tool('start_analysis', {'question': 'Analyse NVDA cette semaine'}, 'amira')
        self.assertEqual(call.call_args.args[3]['persona'], 'amira')
        with self.assertRaises(ValueError):
            research_tool('start_analysis', {'question': 'Analyse NVDA cette semaine', 'persona': 'robert'}, 'amira')

    def test_research_id_cannot_inject_a_url_or_path(self):
        with self.assertRaises(ValueError):
            research_tool('get_analysis_status', {'analysis_id': '../sources'}, 'mateo')

    @patch.dict(os.environ, {'RESEARCH_API_URL': 'http://127.0.0.1:80'})
    def test_non_https_origin_is_rejected(self):
        with self.assertRaises(ValueError):
            research_tool('start_analysis', {'question': 'Analyse NVDA cette semaine'}, 'mateo')


if __name__ == '__main__':
    unittest.main()

class ResearchSnapshotTests(unittest.TestCase):
    @patch('investoros_api.profiles.research_bridge._call')
    def test_snapshot_only_reads_existing_analysis_for_the_active_persona(self, call):
        from investoros_api.profiles.research_bridge import research_snapshot
        identifier='3ca004a7-6a66-4c8e-b82a-9d751a058c0a'
        call.side_effect=[{'analysis_id':identifier,'status':'complete','result':{'summary':'Test'}}, {'events':[{'type':'skills_loaded'}]}, {'evidence':[{'evidence_id':'proof'}]}]
        result=research_snapshot(identifier,'mateo')
        self.assertEqual(result['events'][0]['type'],'skills_loaded')
        self.assertTrue(all(args.args[0]=='GET' and args.args[2]=='mateo' for args in call.call_args_list))
        self.assertEqual(call.call_count,3)
        self.assertEqual(result['evidence'][0]['evidence_id'],'proof')

    @patch('investoros_api.profiles.research_bridge._call')
    def test_event_pagination_keeps_skill_and_completion_events(self, call):
        from investoros_api.profiles.research_bridge import research_snapshot
        call.side_effect=[{'status':'running'}, {'events':[{'type':'source_opened'}],'next_after':'cursor'},
                          {'events':[{'type':'skills_loaded'}]}, {'evidence':[{'evidence_id':'partial-proof'}]}]
        result=research_snapshot('3ca004a7-6a66-4c8e-b82a-9d751a058c0a','mateo')
        self.assertEqual([event['type'] for event in result['events']],['source_opened','skills_loaded'])
        self.assertFalse(result['events_truncated'])
        self.assertEqual(result['evidence'][0]['evidence_id'],'partial-proof')
        self.assertEqual(call.call_args.args[1],'/analyses/3ca004a7-6a66-4c8e-b82a-9d751a058c0a/evidence')

    @patch('investoros_api.profiles.research_bridge._call')
    def test_invalid_identifier_never_reaches_backend(self, call):
        from investoros_api.profiles.research_bridge import research_snapshot
        with self.assertRaises(ValueError):research_snapshot('../other-account','mateo')
        call.assert_not_called()

    @patch('investoros_api.profiles.research_bridge._call')
    def test_research_history_reads_only_requested_persona_with_bounded_limit(self, call):
        from investoros_api.profiles.research_bridge import research_history
        call.return_value={'analyses':[{'analysis_id':'run-1'}]}
        self.assertEqual(research_history('amira', 12), {'analyses':[{'analysis_id':'run-1'}]})
        call.assert_called_once_with('GET', '/analyses?limit=12', 'amira')
        for limit in (0, 61, True):
            with self.assertRaises(ValueError):
                research_history('mateo', limit)
        self.assertEqual(call.call_count, 1)

class ResearchIamTransportTests(unittest.TestCase):
    @patch.dict('os.environ', {'RESEARCH_LAMBDA_FUNCTION':'investoros-dev-api'})
    @patch('investoros_api.profiles.research_bridge._lambda_client')
    def test_iam_transport_preserves_persona_and_does_not_fabricate_jwt_claims(self, client):
        import io,json
        from investoros_api.profiles.research_bridge import _call
        client.return_value.invoke.return_value={'Payload':io.BytesIO(json.dumps({'statusCode':200,'body':json.dumps({'status':'running'})}).encode())}
        result=_call('GET','/analyses/example/events?limit=150','mateo')
        call=client.return_value.invoke.call_args.kwargs
        envelope=json.loads(call['Payload'])
        self.assertEqual(envelope['source'],'investoros.research-iam')
        event=envelope['request']
        self.assertEqual(call['FunctionName'],'investoros-dev-api')
        self.assertEqual(event['rawQueryString'],'limit=150&persona=mateo')
        self.assertNotIn('authorizer',event['requestContext'])
        self.assertNotIn('authorization',event['headers'])
        self.assertEqual(result['status'],'running')

    @patch.dict('os.environ', {'RESEARCH_LAMBDA_FUNCTION':'investoros-dev-api'})
    @patch('investoros_api.profiles.research_bridge._lambda_client')
    def test_iam_transport_rejected_request_is_not_reported_as_success(self, client):
        import io,json
        from investoros_api.profiles.research_bridge import _call
        client.return_value.invoke.return_value={'Payload':io.BytesIO(json.dumps({'statusCode':403,'body':'{}'}).encode())}
        with self.assertRaisesRegex(ValueError,'403'):_call('POST','/analyses','mateo',{'question':'test'})
        client.return_value.invoke.assert_called_once()

class ResearchAuthorizationTests(unittest.TestCase):
    @patch.dict('os.environ',{'REQUIRE_ADMIN_AUTH':'true'})
    @patch('investoros_api.research.iam_handler.handle')
    def test_http_event_cannot_select_the_internal_iam_entry(self, internal):
        from investoros_api.main import handler
        response=handler({'source':'investoros.research-iam','requestContext':{'routeKey':'POST /v1/research/analyses'}},None)
        self.assertEqual(response['statusCode'],403)
        internal.assert_not_called()

    @patch.dict('os.environ',{'REQUIRE_ADMIN_AUTH':'true'})
    @patch('investoros_api.research.iam_handler.handle',return_value={'statusCode':200})
    def test_direct_iam_envelope_uses_the_restricted_research_handler(self, internal):
        from investoros_api.main import handler
        event={'source':'investoros.research-iam','request':{}}
        self.assertEqual(handler(event,None)['statusCode'],200)
        internal.assert_called_once_with(event,None)

    @patch.dict('os.environ',{'RESEARCH_LAMBDA_FUNCTION':'','RESEARCH_API_URL':'https://research.example'})
    @patch('investoros_api.profiles.research_bridge.build_opener')
    def test_user_bearer_is_forwarded_only_in_its_request_context(self, opener):
        import io,json
        from investoros_api.profiles.research_bridge import _call,forward_research_authorization
        response=opener.return_value.open.return_value.__enter__.return_value
        response.read.return_value=b'{}'
        with forward_research_authorization('Bearer test-context-token'):
            _call('GET','/analyses/test','mateo')
        first=opener.return_value.open.call_args.args[0]
        self.assertEqual(first.get_header('Authorization'),'Bearer test-context-token')
        _call('GET','/analyses/test','robert')
        second=opener.return_value.open.call_args.args[0]
        self.assertIsNone(second.get_header('Authorization'))
