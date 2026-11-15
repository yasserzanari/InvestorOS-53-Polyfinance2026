import json
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from investoros_api.profiles.decision import CompareInput, InsightInput, compare_instruments, insight_tab, research_evidence_references
from investoros_api.profiles.memory import MemoryWrite, read_memory, write_memory
from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat
from test_profile_service import RuntimeStub, stream_tool

class DecisionTests(unittest.TestCase):
    def history(self,ticker,start=None,end=None):
        values={'AAA':[100,120,90,108],'BBB':[50,60,45,54]}[ticker]
        return dict(asset={'name':ticker},prices=[{'date':f'2025-01-0{i+1}','adjustedClose':v} for i,v in enumerate(values)],currency='USD',source='test-series',sourceClassification='fixture')

    @patch('investoros_api.profiles.decision.history')
    def test_comparison_has_common_base_and_exact_drawdown(self,history):
        history.side_effect=self.history
        r=compare_instruments(CompareInput(tickers=['AAA','BBB']))
        self.assertEqual(r['observations'],4)
        self.assertEqual(r['metrics'][0]['returnPct'],8)
        self.assertEqual(r['metrics'][0]['drawdownPct'],-25)
        self.assertEqual(r['series'][0]['AAA'],100)
        self.assertEqual(r['series'][-1]['BBB'],108)
        self.assertEqual(r['dataSha256'],compare_instruments(CompareInput(tickers=['AAA','BBB']))['dataSha256'])

    @patch('investoros_api.profiles.decision.history')
    def test_no_silent_currency_conversion(self,history):
        a=self.history('AAA');b=self.history('BBB');b['currency']='CAD';history.side_effect=[a,b]
        with self.assertRaisesRegex(ValueError,'Devises différentes'):
            compare_instruments(CompareInput(tickers=['AAA','BBB']))

    @patch('investoros_api.profiles.decision.history')
    def test_dates_intersect_without_fill(self,history):
        a=self.history('AAA');b=self.history('BBB');b['prices']=b['prices'][1:];history.side_effect=[a,b]
        result=compare_instruments(CompareInput(tickers=['AAA','BBB']))
        self.assertEqual(result['period']['from'],'2025-01-02')
        self.assertEqual(result['metrics'][0]['excludedObservations'],1)
        self.assertEqual(result['metrics'][0]['returnPct'],-10)

    @patch('boto3.Session')
    def test_expired_aws_memory_does_not_fall_back_or_claim_saved(self,session):
        from botocore.exceptions import ClientError
        from investoros_api.profiles.memory import _dynamodb_call
        session.return_value.client.return_value.get_item.side_effect=ClientError({'Error':{'Code':'ExpiredTokenException','Message':'expired'}},'GetItem')
        with self.assertRaises(HTTPException) as failure:_dynamodb_call('get_item',TableName='demo')
        self.assertEqual(failure.exception.status_code,503)
        self.assertIn('expiré',failure.exception.detail)

    def test_claim_ids_are_not_received_evidence(self):
        self.assertEqual(research_evidence_references({'result':{'claims':[{'evidence_ids':['invented']}]}}),(set(),[]))
        ids,citations=research_evidence_references({'evidence':[{'evidence_id':'actual','source_name':'Émetteur','url':'https://example.com/filing','content':{'excerpt':'Passage effectivement reçu'}}]})
        self.assertEqual(ids,{'actual'})
        self.assertEqual(citations[0]['snippet'],'Passage effectivement reçu')

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model','RESEARCH_API_URL':'https://example.com'})
    @patch('investoros_api.profiles.service.research_tool')
    def test_received_research_evidence_can_be_linked_to_alignment(self,research):
        research.return_value={'evidence':[{'evidence_id':'actual','source_name':'Émetteur','url':'https://example.com/filing','content':{'excerpt':'Contenu reçu'}}]}
        class Sequence(RuntimeStub):
            def converse_stream(self, **kwargs):
                response=super().converse_stream(**kwargs)
                if len(self.calls)==2:
                    return stream_tool('publish_profile_insight',{'title':'Point à examiner','question':'Mon projet','summary':'Interprétation conditionnelle','status':'partial','fields':['objective'],'evidenceIds':['actual']})
                return response
        runtime=Sequence(stream_tool('get_evidence',{'analysis_id':'00000000-0000-4000-8000-000000000001'}))
        events=list(run_chat(ChatRequest(message='Relie les preuves au profil',profile={'objective':'Mon projet'}),runtime))
        self.assertTrue(any(e.get('name')=='publish_profile_insight' and e.get('status')=='done' for e in events))
        self.assertTrue(any(e['type']=='sources' and e['citations'][0]['id']=='actual' for e in events))
        research.assert_called_once()

    def test_large_simulations_fit_the_workspace_without_expanding_notes(self):
        from investoros_api.profiles.models import WorkspaceTab
        from pydantic import ValidationError
        content=json.dumps({'branches':[{'path':[{'observations':i,'medianPrice':100+i,'lowerPrice':90+i,'upperPrice':110+i} for i in range(121)]} for _ in range(4)]})
        self.assertGreater(len(content),16000)
        self.assertEqual(WorkspaceTab(id='scenario',title='Scénario',kind='simulation',content=content).content,content)
        with self.assertRaises(ValidationError):WorkspaceTab(id='note',title='Note',kind='note',content=content)

    def test_insight_cannot_cite_invented_evidence(self):
        args=InsightInput(title='Test',question='Mon projet',status='clarification',summary='Contexte à préciser',fields=['objective'],evidenceIds=['invented'])
        with self.assertRaisesRegex(ValueError,'preuve citée'):
            insight_tab(args,{},set())
        args.evidenceIds=[]
        self.assertEqual(json.loads(insight_tab(args,{},set())['content'])['classification'],'interpretation')

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    def test_missing_financial_input_identifies_the_field_without_changing_assumptions(self):
        args={'ticker':'AAPL','horizonObservations':20,'branches':[{'id':'down','title':'Baisse','event':'Hypothèse de baisse','shockPct':-10}]}
        runtime=RuntimeStub(stream_tool('project_market_scenarios',args))
        events=list(run_chat(ChatRequest(message='Baisse hypothétique de 10 % après dix séances'),runtime))
        failure=next(e for e in events if e.get('name')=='project_market_scenarios' and e.get('status')=='failed')
        self.assertIn('branches.0: Indiquez exactement un décalage',failure['error'])
        feedback=runtime.calls[1]['messages'][-1]['content'][0]['toolResult']['content'][0]['text']
        self.assertIn('branches.0',feedback)
        self.assertNotIn('https://errors.pydantic',feedback)
        self.assertEqual(failure['input']['branches'][0]['shockPct'],-10)

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    def test_silent_model_after_failed_tool_does_not_report_empty_success(self):
        class Silent(RuntimeStub):
            def converse_stream(self,**kwargs):
                result=super().converse_stream(**kwargs)
                return result if len(self.calls)==1 else {'stream':[{'messageStop':{'stopReason':'end_turn'}}]}
        events=list(run_chat(ChatRequest(message='Ouvre une vue'),Silent(stream_tool('open_profile_view',{'view':'invalid'}))))
        self.assertTrue(any(e.get('code')=='tool_failed' for e in events))
        self.assertFalse(any(e['type']=='done' for e in events))

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    @patch('investoros_api.profiles.service.simulation_capabilities',return_value={'ready':True,'supportedTickers':['AAPL']})
    def test_scenario_request_cannot_stream_a_success_claim_without_calculating(self,capabilities):
        runtime=RuntimeStub({'stream':[{'contentBlockDelta':{'contentBlockIndex':0,'delta':{'text':'Les scénarios sont ouverts.'}}},{'messageStop':{'stopReason':'end_turn'}}]})
        events=list(run_chat(ChatRequest(message='Calcule deux scénarios conditionnels AAPL avec un choc de 10 %',workspaceMode='profiles'),runtime))
        self.assertEqual(runtime.calls[0]['toolConfig']['toolChoice'],{'any':{}})
        self.assertEqual({t['toolSpec']['name'] for t in runtime.calls[0]['toolConfig']['tools']},{'project_market_scenarios','ask_user'})
        self.assertFalse(any(e['type']=='text' for e in events))
        self.assertTrue(any(e.get('code')=='missing_calculation' for e in events))
        self.assertTrue(any(e.get('actor')=='runtime-bootstrap' and e.get('output',{}).get('id')=='conditional-scenarios' for e in events))

    def test_explanations_and_portfolio_scenarios_keep_their_own_workflow(self):
        from investoros_api.profiles.service import _scenario_calculation_requested
        for prompt in ['Comment calculer une simulation ?','Explique les trajectoires déjà affichées','Calcule un scénario sur les positions de mon portefeuille','Crée une note sur les scénarios conditionnels et ouvre Documents']:
            self.assertFalse(_scenario_calculation_requested(ChatRequest(message=prompt)))
        self.assertTrue(_scenario_calculation_requested(ChatRequest(message='Pour AAPL, calcule deux scénarios sur vingt séances.')))

    def test_tool_derives_only_display_label_and_keeps_the_financial_contract(self):
        from investoros_api.profiles.service import _scenario_tool_input
        from pydantic import ValidationError
        args={'ticker':'AAPL','horizonDays':30,'branches':[{'id':'down','title':'Baisse hypothétique','shockPct':-10,'eventAfterDays':10}]}
        request=_scenario_tool_input(args)
        self.assertEqual(request.branches[0].event,'Hypothèse de simulation : Baisse hypothétique')
        self.assertEqual(request.branches[0].shockPct,-10)
        self.assertEqual(request.branches[0].eventAfterDays,10)
        self.assertEqual(request.horizonDays,30)
        self.assertIsNone(request.horizonObservations)
        self.assertNotIn('event',args['branches'][0])
        with self.assertRaises(ValidationError):_scenario_tool_input({**args,'branches':[{'id':'down','title':'Baisse','eventAfterDays':10}]})

    def test_persistence_isolated_and_optimistic(self):
        with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'PROFILE_MEMORY_DB':tmp+'/memory.db','PROFILE_WORKSPACE_TABLE':'','SOURCE_WORKSPACE_TABLE':''}):
            initial=read_memory('amira');self.assertEqual(initial['revision'],0)
            write_memory('amira',MemoryWrite(expectedRevision=0,profile={'horizon':'15 ans'}))
            self.assertEqual(read_memory('amira')['profile']['horizon'],'15 ans')
            self.assertIsNone(read_memory('robert')['profile'])
            with self.assertRaises(HTTPException) as e:
                write_memory('amira',MemoryWrite(expectedRevision=0,profile={'horizon':'2 ans'}))
            self.assertEqual(e.exception.status_code,409)
            self.assertEqual(read_memory('amira')['profile']['horizon'],'15 ans')

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    def test_closing_a_document_preserves_profile_and_other_documents(self):
        request=ChatRequest(message='Ferme la note brouillon',profile={'horizon':'12 ans'},tabs=[{'id':'draft','title':'Brouillon','kind':'note'},{'id':'keep','title':'À conserver','kind':'note'}])
        events=list(run_chat(request,RuntimeStub(stream_tool('close_profile_document',{'id':'draft'}))))
        last=[e for e in events if e['type']=='workspace'][-1]
        self.assertEqual(last['profile'],{'horizon':'12 ans'})
        self.assertEqual([t['id'] for t in last['tabs']],['keep'])

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    def test_creating_a_profile_note_opens_and_selects_the_document(self):
        runtime=RuntimeStub(stream_tool('upsert_tab',{'id':'discussion','title':'Discussion','kind':'note','content':'Question à reprendre'}))
        events=list(run_chat(ChatRequest(message='Garde une note',workspaceMode='profiles'),runtime))
        self.assertIn({'type':'profile_view','view':'documents','documentId':'discussion'},events)
        self.assertTrue(any(e['type']=='workspace' and e['tabs'][0]['id']=='discussion' for e in events))

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    def test_document_navigation_rejects_an_invented_id(self):
        request=ChatRequest(message='Ouvre mes notes',tabs=[{'id':'known','title':'Note','kind':'note'}])
        events=list(run_chat(request,RuntimeStub(stream_tool('open_profile_view',{'view':'documents','documentId':'invented'}))))
        self.assertFalse(any(e['type']=='profile_view' for e in events))
        self.assertTrue(any(e.get('name')=='open_profile_view' and e.get('status')=='failed' for e in events))

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    def test_document_navigation_selects_an_existing_id(self):
        request=ChatRequest(message='Ouvre ma note',tabs=[{'id':'known','title':'Note','kind':'note'}])
        events=list(run_chat(request,RuntimeStub(stream_tool('open_profile_view',{'view':'documents','documentId':'known'}))))
        self.assertIn({'type':'profile_view','view':'documents','documentId':'known'},events)

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    def test_profile_procedures_reach_the_model_and_are_attributed(self):
        runtime=RuntimeStub({'stream':[{'contentBlockDelta':{'contentBlockIndex':0,'delta':{'text':'Contexte reçu.'}}},{'messageStop':{'stopReason':'end_turn'}}]})
        events=list(run_chat(ChatRequest(message='Précisons mon profil',workspaceMode='profiles'),runtime))
        loaded=[e for e in events if e.get('actor')=='runtime-bootstrap']
        self.assertEqual({e['output']['id'] for e in loaded},{'investor-profile','profile-investment-alignment'})
        system=' '.join(block['text'] for block in runtime.calls[0]['system'])
        for event in loaded:self.assertIn(event['output']['content'],system)

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    @patch('investoros_api.profiles.service.compare_instruments')
    def test_agent_tool_publishes_structured_tab_and_navigation(self,compare):
        compare.return_value={'type':'comparison','title':'AAA / BBB','metrics':[],'methodDetails':'test'}
        events=list(run_chat(ChatRequest(message='Compare AAA et BBB'),RuntimeStub(stream_tool('compare_profile_instruments',{'tickers':['AAA','BBB']}))))
        workspace=[e for e in events if e['type']=='workspace'][-1]
        self.assertEqual(workspace['tabs'][0]['kind'],'decision')
        self.assertEqual(json.loads(workspace['tabs'][0]['content'])['type'],'comparison')
        self.assertIn({'type':'profile_view','view':'comparison'},events)

if __name__=='__main__':unittest.main()
