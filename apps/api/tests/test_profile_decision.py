import json
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from investoros_api.profiles.decision import CompareInput, InsightInput, compare_instruments, insight_tab, profile_declarations, research_evidence_references, validate_profile_claims
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
                    return stream_tool('publish_profile_insight',{'title':'Point à examiner','question':'Mon projet','summary':'Le document reçu ne précise pas les besoins de liquidité de ce projet; son échéance reste à déterminer.','status':'partial','fields':['objective'],'evidenceIds':['actual'],'nextQuestion':'Quelle est l’échéance de ce projet ?'})
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
        args=InsightInput(title='Test',question='Mon projet',status='clarification',summary='Le montant nécessaire au projet n’est pas déclaré; la capacité à absorber une perte ne peut pas être reliée à ce besoin.',fields=['objective'],evidenceIds=['invented'],nextQuestion='Quel montant sera nécessaire pour ce projet ?')
        with self.assertRaisesRegex(ValueError,'preuve citée'):
            insight_tab(args,{},set())
        args.evidenceIds=[]
        self.assertEqual(json.loads(insight_tab(args,{},set())['content'])['classification'],'interpretation')

    def test_empty_portfolio_announcement_is_not_an_alignment_finding(self):
        with self.assertRaisesRegex(ValueError,'summary doit énoncer un constat concret'):
            InsightInput(title='Correspondance du portefeuille à l’objectif',
                question='Mon portefeuille correspond-il à mon objectif de préservation du capital pour mon projet essentiel à 18 mois?',
                status='clarification', fields=['objective','horizon','lossCapacity'],
                summary='Voici les constats, les compromis et les inconnues concernant la correspondance du portefeuille à votre objectif de préservation du capital pour votre projet essentiel à 18 mois.')

    def test_question_copy_and_known_generic_summary_are_rejected(self):
        for summary in ['Mon portefeuille correspond-il à mon objectif ?', 'Interprétation conditionnelle', '  ', '?', 'Constats']:
            with self.subTest(summary=summary), self.assertRaises(ValueError):
                InsightInput(title='Mon projet', question='Mon portefeuille correspond-il à mon objectif ?',
                    status='information', summary=summary, fields=['objective'])

    def test_clarification_requires_a_real_targeted_question_even_with_alternatives(self):
        for question in ['', 'Précisez votre objectif', 'Voulez-vous en savoir plus ?', '?']:
            with self.subTest(question=question), self.assertRaisesRegex(ValueError,'nextQuestion'):
                InsightInput(title='Liquidités à préciser', question='Que sait-on de mon projet ?',
                    status='clarification', fields=['liquidity'],
                    summary='Le besoin de retrait à 18 mois est déclaré, mais le montant nécessaire n’est pas indiqué.',
                    alternatives=['Distinguer le montant indispensable du reste de l’épargne.'], nextQuestion=question)

    def test_tension_and_partial_need_a_discussion_path_or_useful_question(self):
        for status in ['tension','partial']:
            with self.subTest(status=status), self.assertRaisesRegex(ValueError,'au moins une piste ciblée'):
                InsightInput(title='Échéance et perte', question='Comment lire mon profil ?', status=status,
                    summary='Vous avez besoin de toute cette somme dans 18 mois et ne pouvez pas absorber une perte qui compromettrait ce projet.',
                    fields=['horizon','lossCapacity'])

    def test_profile_tension_with_targeted_path_preserves_snapshot(self):
        profile={'riskTolerance':'Élevée','lossCapacity':'Ne peut pas absorber une perte','horizon':'18 mois'}
        args=InsightInput(title='Tolérance et capacité distinctes',question='Quelles tensions dans mes déclarations ?',
            status='tension', fields=['riskTolerance','lossCapacity','horizon'],
            summary='Votre tolérance émotionnelle est élevée, mais votre capacité financière ne permet pas une perte compromettant le projet à 18 mois.',
            alternatives=['Distinguer les fluctuations acceptables du montant indispensable au projet.'],
            limits=['Cette tension concerne vos déclarations; aucun risque de portefeuille n’est calculé.'])
        result=json.loads(insight_tab(args,profile,set())['content'])
        self.assertEqual(result['profileSnapshot'],profile)
        self.assertEqual(result['status'],'tension')
        self.assertTrue(result['alternatives'])

    def test_portfolio_finding_has_facts_conditional_tension_and_targeted_question(self):
        args=InsightInput(title='Projet essentiel et exposition fictive',question='Mon portefeuille correspond-il à mon projet ?',
            status='clarification', fields=['horizon','liquidity','lossCapacity'],
            summary='La somme entière est nécessaire dans 18 mois. Le portefeuille fictif reçu comporte 40 % d’obligations court terme et 10 % d’une ligne libellée forte volatilité; cette dernière appelle une discussion au regard du projet, sans mesurer une perte future.',
            nextQuestion='Quel écart maximal sur le montant disponible compromettrait ce projet ?',
            limits=['Les libellés fictifs ne remplacent pas des séries de risque ni la composition sous-jacente.'])
        self.assertEqual(args.status,'clarification')
        self.assertIn('40 %',args.summary)
        self.assertEqual(args.alternatives,[])

    def test_information_can_stand_alone_without_manufacturing_a_question(self):
        args=InsightInput(title='Horizon déclaré',question='Quel horizon est mémorisé ?',status='information',
            summary='Votre horizon déclaré est de 18 mois; il correspond à la date de retrait intégral que vous avez indiquée.',
            fields=['horizon','liquidity'])
        self.assertEqual(args.nextQuestion,'')
        self.assertEqual(args.alternatives,[])

    def test_concrete_finding_after_intro_is_not_rejected_by_announcement_heuristic(self):
        for summary in ['Voici les constats : votre horizon est de 18 mois et le retrait concerne toute la somme.',
                        'Voici les constats du profil. Votre horizon déclaré est de 18 mois et le retrait concerne toute la somme.']:
            with self.subTest(summary=summary):
                self.assertEqual(InsightInput(title='Horizon',question='Quelle échéance ?',status='information',
                    summary=summary,fields=['horizon','liquidity']).summary,summary)

    def test_targeted_unknown_and_short_question_are_valid(self):
        args=InsightInput(title='Échéance inconnue',question='Quel point manque dans mon profil ?',status='clarification',
            summary='L’échéance du projet n’est pas déclarée; les besoins de retrait ne peuvent pas être situés dans le temps.',
            fields=['horizon','liquidity'],nextQuestion='Quel horizon ?')
        self.assertEqual(args.nextQuestion,'Quel horizon ?')

    def test_blank_or_known_generic_alternatives_do_not_satisfy_followup(self):
        for alternative in ['', '  ', 'En savoir plus', 'Discuter', '?', 'Analyser']:
            with self.subTest(alternative=alternative), self.assertRaises(ValueError):
                InsightInput(title='Tolérance et capacité',question='Quelle tension dans mon profil ?',status='tension',
                    summary='Vous acceptez des fluctuations élevées mais ne pouvez pas absorber une perte liée à ce projet.',
                    fields=['riskTolerance','lossCapacity'],alternatives=[alternative])

    def test_tool_schema_describes_concrete_finding_and_conditional_followups(self):
        from investoros_api.profiles.tools import TOOLS
        spec=next(tool['toolSpec'] for tool in TOOLS if tool['toolSpec']['name']=='publish_profile_insight')
        properties=spec['inputSchema']['json']['properties']
        self.assertIn('Constat concret',properties['summary']['description'])
        self.assertIn('clarification',properties['nextQuestion']['description'])
        self.assertIn('contraintes explicites',properties['alternatives']['description'])
        self.assertEqual(properties['alternatives']['items']['maxLength'],300)

    def test_profile_declarations_only_describes_available_text(self):
        declarations=profile_declarations({'lossCapacity':'Je ne peux pas absorber une perte qui compromettrait ce projet',
            'riskTolerance':'Faible', 'horizon':'18 mois à confirmer', 'constraints':'Aucune contrainte',
            'preferences':'Pas de crypto', 'knowledge':'Débutant', 'confirmed':True})
        self.assertEqual(set(declarations),{'objective','horizon','riskTolerance','lossCapacity','liquidity','constraints','preferences','knowledge'})
        for key in ['lossCapacity','riskTolerance','horizon','constraints','preferences','knowledge']:
            self.assertEqual(declarations[key]['state'],'declared',key)
        self.assertEqual(declarations['lossCapacity']['value'],'Je ne peux pas absorber une perte qui compromettrait ce projet')
        self.assertEqual(declarations['objective'],{'state':'unknown','value':''})
        self.assertNotIn('riskLevel',declarations['lossCapacity'])

    def test_empty_placeholders_and_bare_yes_no_are_not_qualitative_declarations(self):
        for value in ['', '   ', '…', 'À préciser.', 'Inconnue', 'Non renseignée', 'Oui', 'Non', 'oui / non',
                      'YES', 'NO', 'N/A', 'Je ne sais pas', 'Capacité : à préciser', 'Capacité financière : inconnue',
                      'Je ne sais pas combien je peux perdre', 'Je ne sais pas quelle somme je pourrais perdre',
                      'Je ne sais pas combien je peux perdre sans compromettre mon projet']:
            with self.subTest(value=value):
                self.assertEqual(profile_declarations({'lossCapacity':value})['lossCapacity'],{'state':'unknown','value':value})

    def test_qualitative_loss_capacity_is_available_without_quantification(self):
        for value in ['Je ne peux pas absorber une perte qui compromettrait ce projet',
                      'Capacité faible', 'Faible', 'Non, je ne peux pas absorber une perte importante.',
                      'Montant exact inconnu, mais je ne peux pas perdre la somme nécessaire au projet.',
                      'Capacité faible, montant à préciser',
                      'Je ne sais pas combien je peux perdre, mais je ne peux pas absorber une perte qui compromettrait ce projet']:
            with self.subTest(value=value):
                self.assertEqual(profile_declarations({'lossCapacity':value})['lossCapacity']['state'],'declared')

    def test_real_card_cannot_erase_received_qualitative_capacity_in_summary_or_limits(self):
        profile={'lossCapacity':'Je ne peux pas absorber une perte qui compromettrait ce projet'}
        for location,text in [
            ('summary','Le portefeuille fictif ne permet pas un calcul de risque. La capacité financière à absorber une perte reste inconnue.'),
            ('limits','La capacité financière à absorber une perte n’a pas été explicitement renseignée.'),
            ('limits','Votre capacité à supporter des pertes est non précisée.'),
            ('limits','The financial capacity to absorb a loss remains unknown.'),
        ]:
            args=InsightInput(title='Portefeuille et projet',question='Comment lire mes expositions ?',status='information',
                fields=['lossCapacity'],summary='Le calculateur retourne un portefeuille fictif; aucun risque historique n’est calculé.')
            if location=='summary': args.summary=text
            else: args.limits=[text]
            with self.subTest(location=location,text=text),self.assertRaisesRegex(ValueError,'lossCapacity contient déjà une déclaration'):
                insight_tab(args,profile,set())

    def test_missing_capacity_can_be_reported_when_only_a_placeholder_is_available(self):
        args=InsightInput(title='Capacité à préciser',question='Que manque-t-il dans mon profil ?',status='clarification',
            fields=['lossCapacity'],summary='La capacité financière à absorber une perte reste inconnue.',
            nextQuestion='Quelle conséquence aurait une perte sur le montant nécessaire au projet ?')
        for value in ['', 'À préciser', 'Oui', 'Non']:
            with self.subTest(value=value):
                result=json.loads(insight_tab(args,{'lossCapacity':value},set())['content'])
                self.assertEqual(result['profileSnapshot']['lossCapacity'],value)

    def test_quantification_and_market_unknowns_do_not_erase_qualitative_declaration(self):
        profile={'lossCapacity':'Capacité faible'}
        for text in [
            'La capacité financière à absorber une perte n’est pas chiffrée.',
            'Le montant exact de la capacité financière à absorber une perte reste inconnu.',
            'La quantification de la capacité financière reste inconnue.',
            'La capacité financière à absorber une perte reste inconnue en montant exact.',
            'La capacité financière à absorber une perte n’a pas été renseignée en euros.',
            'La capacité financière à absorber une perte est inconnue quantitativement.',
            'Your financial loss capacity is unknown in monetary terms.',
            'Le risque de marché n’a pas été calculé en l’absence d’historique de prix.',
            'Les pertes de marché futures restent inconnues.',
            'La capacité future à absorber une perte reste inconnue.',
            'Future financial loss capacity remains unknown.',
        ]:
            args=InsightInput(title='Déclaration et limites',question='Que sait-on de ma capacité ?',status='information',
                fields=['lossCapacity'],summary='Votre capacité de perte est déclarée faible; cette réponse ne chiffre pas un montant maximal.',limits=[text])
            with self.subTest(text=text):
                result=json.loads(insight_tab(args,profile,set())['content'])
                self.assertEqual(result['limits'],[text])

    def test_later_amount_unknown_does_not_excuse_an_earlier_false_missing_capacity_claim(self):
        args=InsightInput(title='Capacité et montant',question='Quelle capacité est déclarée ?',status='information',fields=['lossCapacity'],
            summary='La capacité financière reste inconnue. Son montant exact reste inconnu aussi.')
        with self.assertRaisesRegex(ValueError,'lossCapacity'):
            insight_tab(args,{'lossCapacity':'Faible'},set())

    def test_received_evidence_gate_still_precedes_declaration_consistency(self):
        args=InsightInput(title='Capacité et preuve',question='Que disent les sources ?',status='information',fields=['lossCapacity'],
            summary='La capacité financière à absorber une perte reste inconnue.',evidenceIds=['not-received'])
        with self.assertRaisesRegex(ValueError,'Une preuve citée n’a pas été reçue'):
            insight_tab(args,{'lossCapacity':'Faible'},set())

    def test_public_profile_claim_guard_can_validate_final_answer_without_card(self):
        with self.assertRaisesRegex(ValueError,'lossCapacity contient déjà une déclaration'):
            validate_profile_claims(['Le portefeuille est fictif.',
                '**La capacité financière à absorber une perte** reste inconnue.'],{'lossCapacity':'Capacité faible'})
        validate_profile_claims(['Votre capacité est déclarée faible; son montant exact n’est pas chiffré.',
            'Le risque de marché n’est pas calculé.'],{'lossCapacity':'Capacité faible'})
        validate_profile_claims(['La capacité financière à absorber une perte reste inconnue.'],
            {'lossCapacity':'Je ne sais pas combien je peux perdre'})

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

    @patch.dict(os.environ,{'BEDROCK_MODEL_ID':'test-model'})
    def test_explicit_document_command_requires_the_tool_and_preserves_other_tabs(self):
        request=ChatRequest(message='Ferme uniquement draft.',tabs=[{'id':'draft','title':'Brouillon','kind':'note'},{'id':'kept','title':'À conserver','kind':'note'}])
        runtime=RuntimeStub(stream_tool('close_profile_document',{'id':'draft'}))
        events=list(run_chat(request,runtime))
        self.assertEqual(runtime.calls[0]['toolConfig']['toolChoice'],{'tool':{'name':'close_profile_document'}})
        self.assertEqual([t['id'] for t in [e for e in events if e['type']=='workspace'][-1]['tabs']],['kept'])
        self.assertNotIn('toolChoice',runtime.calls[1]['toolConfig'])

    def test_closure_routing_rejects_negation_and_ambiguous_document_ids(self):
        from investoros_api.profiles.service import _explicit_document_closure
        tabs=[{'id':'draft','title':'Brouillon','kind':'note'},{'id':'kept','title':'À conserver','kind':'note'}]
        for prompt in ['Ne ferme pas draft','Comment fermer draft ?','Ferme draft ou kept','Ferme le brouillon']:
            self.assertIsNone(_explicit_document_closure(ChatRequest(message=prompt,tabs=tabs)))

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
