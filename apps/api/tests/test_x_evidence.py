import os
import unittest
from unittest.mock import patch
from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat
from investoros_api.profiles.x_evidence import collect_authorized_posts
from test_profile_service import RuntimeStub, stream_tool

POST={'id':'123456789','author':'bankofcanada','text':'Our interest rate decision and inflation outlook.','publishedAt':'2026-11-10T12:00:00+00:00','url':'https://x.com/bankofcanada/status/123456789'}

class AuthorizedXTests(unittest.TestCase):
    @patch.dict(os.environ, {'API_ANYTHING_PROXY_FUNCTION_NAME': 'investoros-dev-research-worker'})
    @patch('boto3.client')
    def test_timeline_uses_vpc_api_anything_worker_in_aws(self, client):
        invoke = client.return_value.invoke
        class Payload:
            def read(self, _limit):
                import json
                return json.dumps({'ok': True, 'results': {'bankofcanada': [POST]}, 'failures': {}}).encode()
        invoke.return_value = {'Payload': Payload()}

        from investoros_api.profiles.x_evidence import read_public_posts
        result = read_public_posts('bankofcanada')

        self.assertEqual(result, [POST])
        self.assertEqual(invoke.call_args.kwargs['FunctionName'], 'investoros-dev-research-worker')
        invoke_payload = __import__('json').loads(invoke.call_args.kwargs['Payload'])
        self.assertEqual(invoke_payload, {'action': 'read_public_x_posts', 'usernames': ['bankofcanada']})

    @patch('investoros_api.profiles.x_evidence.read_workspace')
    @patch('investoros_api.profiles.x_evidence.read_public_posts')
    def test_account_boundary_and_no_request_to_unauthorized_author(self,fetch,read):
        read.return_value={'authorized':[{'username':'bankofcanada'}]}
        with self.assertRaises(ValueError):collect_authorized_posts('amira','inflation',['SECGov'])
        read.assert_called_once_with('amira');fetch.assert_not_called()

    @patch('investoros_api.profiles.x_evidence.read_workspace')
    @patch('investoros_api.profiles.x_evidence.read_public_posts')
    def test_relevant_posts_and_failures_are_distinguished(self,fetch,read):
        read.return_value={'authorized':[{'username':'bankofcanada'}]}
        fetch.return_value=[dict(POST),{**POST,'id':'999','text':'Welcome to our office.'}]
        result=collect_authorized_posts('mateo','taux inflation')
        self.assertEqual([p['id'] for p in result['posts']],['123456789'])
        fetch.side_effect=TimeoutError()
        result=collect_authorized_posts('mateo','taux inflation')
        self.assertEqual(result['posts'],[]);self.assertEqual(len(result['failures']),1)

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    @patch('investoros_api.profiles.service.authorized_profiles',return_value=[{'username':'bankofcanada'}])
    @patch('investoros_api.profiles.service.collect_authorized_posts')
    def test_model_gets_real_sources_with_clickable_citation_indices(self,collect,profiles):
        collect.return_value={'posts':[dict(POST)],'limitations':[]}
        runtime=RuntimeStub(stream_tool('read_authorized_x_posts',{'query':'taux inflation'}))
        events=list(run_chat(ChatRequest(accountId='mateo',message='Analyse les taux depuis les tweets autorisés'),runtime))
        collect.assert_called_once_with('mateo','taux inflation',None)
        sources=[e for e in events if e['type']=='sources'][-1]['citations']
        self.assertEqual(sources[0]['url'],POST['url'])
        self.assertEqual(sources[0]['index'],1)
        output=runtime.calls[1]['messages'][-1]['content'][0]['toolResult']['content'][0]['json']
        self.assertEqual(output['posts'][0]['citation_index'],1)

if __name__=='__main__':unittest.main()
