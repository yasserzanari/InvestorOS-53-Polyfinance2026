import unittest
from unittest.mock import patch
from fastapi import HTTPException
from investoros_api.profiles.forecast import forecast
from investoros_api.profiles.network_evidence import network_for
from investoros_api.simulation import ScenarioProjectionRequest
from investoros_api.profiles.tools import TOOLS

class JourneyTests(unittest.TestCase):
    def test_bootstrap_reproducible_and_has_holdout(self):
        prices=[{'date':f'2025-{1+i//28:02}-{1+i%28:02}','adjustedClose':100*(1.001**i)*(1+.01*(i%5))} for i in range(250)]
        data={'prices':prices,'currency':'USD','source':'unit-test','sourceClassification':'illustrative'}
        request=ScenarioProjectionRequest(ticker='ABC',horizonObservations=5,branches=[{'id':'base','title':'Base','event':'Aucun choc','shockPct':0.0,'eventAfterObservations':0},{'id':'down','title':'Choc','event':'Hypothèse','shockPct':-10.0,'eventAfterObservations':2}])
        with patch('investoros_api.profiles.forecast.history',return_value=data):
            first=forecast(request);second=forecast(request)
        self.assertEqual(first,second)
        self.assertGreater(first['validation']['holdoutWindows'],0)
        for point in first['branches'][0]['path']:
            self.assertLessEqual(point['lowerPrice'],point['medianPrice'])
            self.assertLessEqual(point['medianPrice'],point['upperPrice'])
        base,down=first['branches']
        self.assertEqual(base['path'][1]['medianPrice'],down['path'][1]['medianPrice'])
        self.assertAlmostEqual(base['path'][2]['medianPrice']*.9,down['path'][2]['medianPrice'],places=3)
        self.assertEqual(base['path'][-1]['observations'],5)
    def test_sparse_data_cannot_be_estimated(self):
        with patch('investoros_api.profiles.forecast.history',return_value={'prices':[]}):
            with self.assertRaises(HTTPException):
                forecast(ScenarioProjectionRequest(ticker='ABC',horizonObservations=5,branches=[{'id':'base','title':'Base','event':'Sans choc','shockPct':0.0,'eventAfterObservations':0}]))
    def test_network_has_only_referenced_relations_and_no_fabricated_risk(self):
        data=network_for('NVDA');ids={e['id'] for e in data['entities']};proofs={e['id'] for e in data['evidence']}
        self.assertEqual(len(data['relations']),7)
        for relation in data['relations']:
            self.assertIn(relation['source'],ids);self.assertIn(relation['target'],ids)
            self.assertTrue(set(relation['evidenceIds'])<=proofs)
            self.assertEqual(relation['risk'],'unknown');self.assertNotIn('share',relation)
        with self.assertRaises(HTTPException):network_for('ABC')
    def test_new_capabilities_are_available_to_bedrock(self):
        names={tool['toolSpec']['name'] for tool in TOOLS}
        self.assertTrue({'estimate_market_trajectories','inspect_supply_chain'}<=names)

    def test_stream_authorization_does_not_leak_across_worker_contexts(self):
        from contextvars import Context
        from types import SimpleNamespace
        from investoros_api.profiles.router import chat
        from investoros_api.profiles.models import ChatRequest
        import asyncio
        from starlette.requests import Request
        from investoros_api.profiles.research_bridge import _authorization
        seen=[]
        def fake_chat(_):
            seen.append(_authorization.get())
            yield {'type':'text','text':'first'}
            seen.append(_authorization.get())
            yield {'type':'done'}
        request=Request({'type':'http','headers':[(b'authorization',b'Bearer test-only')]})
        with patch('investoros_api.profiles.router.run_chat',side_effect=fake_chat):
            response=chat(ChatRequest(message='Bonjour'),request)
            async def collect():
                return [item async for item in response.body_iterator]
            result=asyncio.run(collect())
        self.assertEqual(len(result),2)
        self.assertEqual(seen,['Bearer test-only','Bearer test-only'])
        self.assertEqual(_authorization.get(),'')
