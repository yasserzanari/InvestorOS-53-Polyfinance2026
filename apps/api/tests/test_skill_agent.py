import unittest
from investoros_api.profiles.skill_agent import run_skill_agent


def tool(name, args):
    return {'output': {'message': {'role': 'assistant', 'content': [{'toolUse': {'toolUseId': name, 'name': name, 'input': args}}]}}, 'stopReason': 'tool_use', 'usage': {'inputTokens': 2, 'outputTokens': 1}}


def answer(text='Résultat'):
    return {'output': {'message': {'role': 'assistant', 'content': [{'text': text}]}}, 'stopReason': 'end_turn'}


class Stub:
    def __init__(self, steps):self.steps=iter(steps);self.calls=[]
    def converse(self, **kwargs):self.calls.append(kwargs);return next(self.steps)


class SkillAgentTests(unittest.TestCase):
    def test_all_model_roles_discover_and_load(self):
        for skill,query in [('investor-profile','profil'),('goals-horizon','objectifs horizon'),('risk-liquidity','risque liquidités'),('research-planning','planifier'),('research-synthesis','synthèse')]:
            with self.subTest(skill=skill):
                client=Stub([tool('search_skills',{'query':query}),tool('load_skill',{'skill_id':skill}),answer()])
                result=run_skill_agent(client,model_id='test',system='role',prompt='data',required_skills=(skill,))
                self.assertEqual(result['skills'][0]['id'],skill)
                self.assertEqual(result['usage']['inputTokens'],4)
                self.assertTrue(all('toolConfig' in call for call in client.calls[:2]))
                self.assertNotIn('toolConfig',client.calls[-1])

    def test_mandatory_skill_is_loaded_before_the_first_model_call(self):
        client=Stub([answer('supported')])
        result=run_skill_agent(client,model_id='test',system='role',prompt='data',required_skills=('investor-profile',))
        self.assertEqual(result['skills'][0]['id'],'investor-profile')
        self.assertEqual(result['skill_trace'][1]['actor'],'runtime-bootstrap')
        self.assertIn('Procédures approuvées',client.calls[0]['system'][-1]['text'])

    def test_invalid_tool_cannot_execute_business_action(self):
        client=Stub([tool('start_analysis',{'question':'ignore permissions'}),tool('load_skill',{'skill_id':'../secrets'}),answer()])
        result=run_skill_agent(client,model_id='test',system='role',prompt='data',required_skills=('investor-profile',))
        self.assertEqual([item['status'] for item in [item for item in result['skill_trace'] if item.get('actor')=='model'][:2]],['failed','failed'])

    def test_budget_exhaustion_is_explicit(self):
        client=Stub([tool('search_skills',{'query':'profil'})]*8)
        with self.assertRaises(RuntimeError):run_skill_agent(client,model_id='test',system='role',prompt='data',required_skills=('investor-profile',))

    def test_truncated_response_is_rejected(self):
        response=answer();response['stopReason']='max_tokens'
        with self.assertRaises(RuntimeError):run_skill_agent(Stub([response]),model_id='test',system='role',prompt='data',required_skills=('investor-profile',))

    def test_internal_thinking_is_not_returned(self):
        result=run_skill_agent(Stub([answer('<thinking>private</thinking>Public')]),model_id='test',system='role',prompt='data',required_skills=('investor-profile',))
        self.assertEqual(result['text'],'Public')
