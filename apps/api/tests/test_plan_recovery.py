"""Regression: a plan approval without visible steps must recover rather than loop."""
import os
import unittest
from unittest.mock import patch
from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat
from test_profile_service import stream_tool

FORM = {'title':'Valider le plan','purpose':'plan_approval','questions':[{'id':'approval','label':'Lancer cette recherche ?','kind':'single_choice','options':[{'id':'yes','label':'Oui, lancer ce plan'},{'id':'edit','label':'Modifier le plan'}]}]}
PLAN = '1. Définir le périmètre NVDA.\n2. Lire les sources autorisées.\n3. Comparer les faits et présenter les limites.'

class RecoveryTests(unittest.TestCase):
    @patch.dict(os.environ, {'BEDROCK_MODEL_ID':'test-model'})
    def test_missing_plan_is_rendered_before_approval(self):
        calls=[]
        class Runtime:
            def converse_stream(self, **kwargs):
                calls.append(kwargs)
                if len(calls)==2:
                    assert 'toolChoice' not in kwargs['toolConfig']
                    return {'stream':[{'contentBlockDelta':{'contentBlockIndex':0,'delta':{'text':PLAN}}},{'messageStop':{'stopReason':'end_turn'}}]}
                return stream_tool('ask_user', FORM)
        events=list(run_chat(ChatRequest(message='Analyse NVDA cette semaine'),Runtime()))
        types=[e['type'] for e in events]
        self.assertEqual(len(calls),3)
        self.assertEqual(sum(e['type']=='questions' for e in events),1)
        self.assertLess(types.index('text'),types.index('questions'))
        self.assertFalse(any(e.get('code')=='step_limit' for e in events))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID':'test-model'})
    def test_plan_in_form_is_displayed_before_question(self):
        class Runtime:
            def converse_stream(self, **kwargs):
                return stream_tool('ask_user',dict(FORM,description=PLAN))
        events=list(run_chat(ChatRequest(message='Analyse NVDA'),Runtime()))
        text=next(i for i,e in enumerate(events) if e['type']=='text')
        question=next(i for i,e in enumerate(events) if e['type']=='questions')
        self.assertLess(text,question)
