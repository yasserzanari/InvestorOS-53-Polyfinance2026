import json
import unittest
from unittest.mock import patch
from investoros_api.profiles.supply_chain_research import quarterly_revenue, validate_extraction, build_dossier, resolve, research_documents, read, collect_filings, extraction_json
from investoros_api.profiles.models import ChatRequest, WorkspaceTab
from investoros_api.profiles.service import run_chat
from test_profile_service import RuntimeStub, stream_tool


def fact(start, end, val, filed='2026-11-05', **extra):
    return {'start':start,'end':end,'val':val,'form':'10-Q','filed':filed,'accn':'0000000000-26-123456',**extra}


def financials(rows):
    return {'facts':{'us-gaap':{'Revenues':{'units':{'USD':rows}}}}}


class SupplyChainResearchTests(unittest.TestCase):
    def setUp(self):
        collector=patch('investoros_api.profiles.supplier_disclosures.official_supplier_documents',return_value=[])
        collector.start();self.addCleanup(collector.stop)

    def test_quarterly_not_ytd_and_deduplicates_amendments(self):
        result = quarterly_revenue(financials([fact('2026-04-01','2026-06-30',10e9), fact('2026-07-01','2026-09-30',12e9), fact('2026-01-01','2026-09-30',30e9),fact('2026-07-01','2026-09-30',11e9,filed='2026-11-01')]))
        self.assertEqual(result['current']['val'],12e9)
        self.assertAlmostEqual(result['changePct'],20)
        self.assertEqual(result['previous']['val'],10e9)

    def test_missing_quarter_zero_and_nonfinite(self):
        result=quarterly_revenue(financials([fact('2026-01-01','2026-03-31',3e9),fact('2026-07-01','2026-09-30',4e9)]))
        self.assertIsNone(result['previous'])
        self.assertIsNone(result['changePct'])
        self.assertIsNone(quarterly_revenue(financials([fact('2026-07-01','2026-09-30',float('nan'))])))
        result=quarterly_revenue(financials([fact('2026-04-01','2026-06-30',0),fact('2026-07-01','2026-09-30',4e9)]))
        self.assertIsNone(result['changePct'])

    def test_exact_quote_and_company_name_required(self):
        text='Acme uses Contoso for assembly of all widgets in this disclosed program.'
        docs=[{'id':'s1','text':text,'publishedAt':'2026-11-01'}]
        raw={'suppliers':[{'name':'Contoso','role':'Assemblage','sourceId':'s1','quote':text},{'name':'Invented Supplier','role':'Other','sourceId':'s1','quote':text},{'name':'Fake','role':'X','sourceId':'missing','quote':text}], 'events':[{'title':'Risque déclaré','sourceId':'s1','quote':'Invented quote that does not exist in this source at all.','sentiment':'pressure'}]}
        suppliers,events=validate_extraction(raw,docs)
        self.assertEqual([s['label'] for s in suppliers],['Contoso'])
        self.assertEqual(events,[])

    @patch('investoros_api.profiles.supply_chain_research.issuers',return_value=[{'ticker':'ACME','title':'ACME INC','cik_str':1},{'ticker':'ACB','title':'ACME INDUSTRIES','cik_str':2}])
    def test_resolve_ambiguous_name_does_not_choose_first(self,_):
        self.assertIsNone(resolve('ACME ' .lower()+' holdings'))
        self.assertEqual(resolve('acme')['ticker'],'ACME')
        self.assertIsNone(resolve('Acme I'))

    @patch('investoros_api.profiles.supply_chain_research.read')
    def test_long_filing_preserves_named_supplier_disclosure(self,reader):
        index={'filings':{'recent':{'form':['10-K'],'accessionNumber':['0000000001-26-000001'],'primaryDocument':['report.htm'],'filingDate':['2026-11-01']}}}
        generic='Our suppliers face disruption. '+('Risk context. '*120)
        declaration='We utilize foundries, such as Contoso Foundry, to manufacture our components. We engage contract manufacturers such as Fabrikam Assembly.'
        reader.side_effect=[json.dumps(index),'<p>'+generic*23+declaration+generic*37+'</p>']
        docs=collect_filings({'cik_str':1,'title':'Acme'})
        self.assertIn('Contoso Foundry',docs[0]['text'])
        self.assertIn('Fabrikam Assembly',docs[0]['text'])

    @patch('investoros_api.profiles.supply_chain_research.issuers',return_value=[{'ticker':'TSM','title':'TAIWAN SEMICONDUCTOR MANUFACTURING CO LTD','cik_str':1}])
    def test_legal_supplier_name_resolves_for_financials(self,_):
        self.assertEqual(resolve('Taiwan Semiconductor Manufacturing Company Limited')['ticker'],'TSM')

    def test_model_json_with_markdown_and_xml_framing(self):
        payload={'suppliers':[{'name':'Contoso'}],'events':[]}
        for text in [json.dumps(payload),'Voici les résultats sourcés :\n```json\n'+json.dumps(payload)+'\n```','<answer>'+json.dumps(payload)+'</answer>']:
            self.assertEqual(extraction_json(text),payload)
        with self.assertRaises(ValueError):extraction_json('Pas de JSON valide {suppliers: nope}')

    def test_specialist_forces_structured_result_after_skill_bootstrap(self):
        from investoros_api.profiles.skill_agent import run_skill_agent
        from investoros_api.profiles.supply_chain_research import EXTRACTION_SCHEMA
        class Client:
            def converse(self,**kwargs):
                self.config=kwargs['toolConfig']
                return {'output':{'message':{'role':'assistant','content':[{'toolUse':{'toolUseId':'result','name':'publish_result','input':{'suppliers':[],'events':[]}}}]}},'stopReason':'tool_use','usage':{}}
        client=Client()
        result=run_skill_agent(client,model_id='stub',system='Extract',prompt='Documents',required_skills=('supply-chain',),result_schema=EXTRACTION_SCHEMA)
        self.assertEqual(json.loads(result['text']),{'suppliers':[],'events':[]})
        self.assertEqual(client.config['toolChoice']['tool']['name'],'publish_result')
        self.assertEqual(result['skills'][0]['id'],'supply-chain')

    def test_bond_underwriters_and_trustees_are_not_operational_suppliers(self):
        quote='Acme appointed Example Bank as trustee and Contoso Securities as underwriting representative for its notes.'
        raw={'suppliers':[{'name':'Example Bank','role':'Fiduciaire','sourceId':'filing','quote':quote},{'name':'Contoso Securities','role':'Représentant des souscripteurs','sourceId':'filing','quote':quote}], 'events':[]}
        suppliers,_=validate_extraction(raw,[{'id':'filing','text':quote}])
        self.assertEqual(suppliers,[])

    def test_fixed_origins_block_ssrf(self):
        for url in ['http://data.sec.gov/','https://localhost/','https://data.sec.gov@127.0.0.1/','https://data.sec.gov:444/']:
            with self.subTest(url=url),self.assertRaises(ValueError): read(url)

    @patch('investoros_api.profiles.supply_chain_research.logo_for',return_value=None)
    @patch('investoros_api.profiles.supply_chain_research.resolve',return_value=None)
    def test_uncovered_company_is_empty_not_nvda_fallback(self,*_):
        result=build_dossier('Private Uncovered Company',None,'unused')
        self.assertEqual(result['coverage'],'insufficient')
        self.assertEqual(result['entities'][0]['label'],'Private Uncovered Company')
        self.assertEqual(result['relations'],[])

    @patch('investoros_api.profiles.supply_chain_research.logo_for',return_value=None)
    @patch('investoros_api.profiles.supply_chain_research.resolve',return_value=None)
    @patch('investoros_api.profiles.supply_chain_research.run_skill_agent')
    def test_non_nvda_company_research_evidence(self,agent,*_):
        passage='Contoso supplies assembly services to Acme under a signed manufacturing agreement.'
        agent.return_value={'text':json.dumps({'suppliers':[{'name':'Contoso','role':'Assemblage','sourceId':'research-0','quote':passage}],'events':[]}), 'skills':[],'skill_trace':[],'usage':{}}
        result=build_dossier('Acme',None,'model',[{'id':'research-0','title':'Filing','url':'https://example.org/filing','text':passage}])
        self.assertEqual(result['relations'][0]['target'],'issuer')
        self.assertEqual(result['entities'][1]['label'],'Contoso')
        WorkspaceTab(id='test',title='Chain',kind='network',content=json.dumps(result))

    @patch('investoros_api.profiles.research_bridge.research_snapshot')
    def test_research_reuse_ignores_unread_leads(self,snapshot):
        snapshot.return_value={'evidence':[{'content':{'documents':[{'url':'https://example.org/a','excerpt':'a'*80},{'url':'https://example.org/b','excerpt':'b'*80,'characters_read':1000}]}}]}
        self.assertEqual([d['url'] for d in research_documents('uuid','mateo')],['https://example.org/b'])

    @patch.dict('os.environ',{'BEDROCK_MODEL_ID':'test'})
    @patch('investoros_api.profiles.supply_chain_research.build_dossier')
    def test_chat_opens_structured_tab_and_records_real_agent(self,build):
        build.return_value={'schemaVersion':2,'ticker':'ACME','company':'Acme','entities':[{'id':'issuer','kind':'product','label':'Acme'}],'relations':[],'evidence':[],'events':[],'reviewedAt':'2026-11-15','coverage':'insufficient','limitations':[],'skills':[],'skill_trace':[],'usage':{}}
        events=list(run_chat(ChatRequest(message='Montre les fournisseurs de Acme'),RuntimeStub(stream_tool('inspect_supply_chain',{'ticker':'ACME'}))))
        self.assertTrue(any(e['type']=='workspace' and any(t['kind']=='network' for t in e['tabs']) for e in events))
        self.assertTrue(any(e['type']=='profile_view' and e.get('documentId')=='supply-chain-acme' for e in events))
        self.assertEqual([e['status'] for e in events if e['type']=='agent'],['running','done'])

if __name__=='__main__': unittest.main()
