"""A qualitative project constraint does not establish a measured zero capacity."""
from copy import deepcopy
import json
import os
import unittest
from unittest.mock import patch

from investoros_api.profiles.decision import InsightInput, insight_tab, validate_profile_claims
from investoros_api.profiles.models import ChatRequest
from investoros_api.profiles.service import run_chat
from test_profile_service import RuntimeStub, stream_tool


QUALITATIVE_CAPACITY = 'Je ne peux pas absorber une perte qui compromettrait ce projet'


class ZeroCapacityClaimTests(unittest.TestCase):
    def test_qualitative_constraint_cannot_be_converted_to_zero_capacity(self):
        for assertion in [
            'Votre capacité financière est structurellement nulle.',
            'La capacité à absorber une perte est nulle.',
            'Votre capacité financière nulle constitue une limite pour ce projet.',
            'La capacité financière de perte reste donc nulle.',
            'La capacité de perte est de zéro.',
            '**Capacité financière : 0 %**.',
        ]:
            for capacity in [QUALITATIVE_CAPACITY, 'Capacité faible', 'À préciser', '',
                             'Je ne peux subir aucune perte importante', 'Je peux supporter 0,5 % de perte']:
                with self.subTest(assertion=assertion, capacity=capacity), self.assertRaisesRegex(ValueError, 'seuil zéro'):
                    validate_profile_claims([assertion], {'lossCapacity': capacity})

    def test_explicit_zero_or_unqualified_no_loss_declarations_are_preserved(self):
        for capacity in [
            'Capacité nulle', 'Capacité financière égale à zéro', 'Nulle', '0 %', '0,00 $',
            'Capacité de perte : 0 %', 'Je ne peux subir aucune perte',
            'Je ne peux pas supporter de perte', 'Je ne peux pas perdre d’argent',
            'Aucune perte n’est acceptable', 'Je peux absorber 0 % de perte',
        ]:
            with self.subTest(capacity=capacity):
                validate_profile_claims(['La capacité financière est nulle.'], {'lossCapacity': capacity})

    def test_zero_ranges_or_qualified_no_loss_are_not_declarations_of_zero_capacity(self):
        for capacity in [
            'Capacité entre 0 et 5 %', 'Capacité de perte : 0 à 5 %',
            '0 à 5 %', '0,5 %', '0.1 %',
            'Je ne peux subir aucune perte qui compromettrait ce projet',
            'Je ne peux pas supporter de perte importante',
            'Si je ne peux subir aucune perte',
            'Une capacité financière nulle n’est pas établie',
            'Je ne sais pas si ma capacité financière est nulle',
            'Capacité financière nulle ou faible',
        ]:
            with self.subTest(capacity=capacity), self.assertRaisesRegex(ValueError, 'seuil zéro'):
                validate_profile_claims(['Votre capacité financière est nulle.'], {'lossCapacity': capacity})

    def test_negated_unestablished_and_hypothetical_zero_claims_are_not_positive_assertions(self):
        for text in [
            'Votre capacité financière n’est pas nulle.',
            'Cette réponse ne signifie pas une capacité financière nulle.',
            'On ne peut pas déduire que la capacité financière est nulle.',
            'Il ne faut pas conclure à une capacité financière nulle.',
            'Sans établir une capacité financière nulle, la contrainte qualitative reste connue.',
            'Une capacité financière nulle n’est pas établie.',
            'La capacité financière nulle n’est pas forcément démontrée.',
            'Une capacité financière nulle n’a pas été démontrée.',
            'Une capacité financière nulle n’est pas forcément le cas.',
            'Une capacité financière nulle ne peut pas être déduite.',
            'Capacité financière nulle : non démontrée.',
            'Aucune preuve d’une capacité financière nulle.',
            'Si la capacité financière est nulle, il faut distinguer cette hypothèse du profil.',
            'Capacité financière nulle ?',
            'La capacité financière reste qualitative ; le montant exact n’est pas chiffré.',
            'La capacité d’endettement est nulle.',
        ]:
            with self.subTest(text=text):
                validate_profile_claims([text], {'lossCapacity': QUALITATIVE_CAPACITY})

    def test_negation_does_not_hide_a_later_positive_zero_assertion(self):
        for text in [
            'Une capacité financière nulle n’est pas établie. Votre capacité financière est nulle.',
            'La capacité financière nulle n’est pas démontrée, mais sa capacité financière reste nulle.',
            'La tolérance n’est pas faible et la capacité financière est nulle.',
        ]:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, 'seuil zéro'):
                validate_profile_claims([text], {'lossCapacity': QUALITATIVE_CAPACITY})

    def test_explicit_generic_definitions_are_not_assertions_about_the_client(self):
        for text in [
            'Une capacité financière nulle signifie ne pouvoir absorber aucune perte.',
            'En général, une capacité financière nulle désigne une absence de capacité de perte.',
            'La capacité financière est nulle lorsque aucune perte ne peut être absorbée.',
            'La capacité financière est nulle si toute perte est impossible à absorber.',
        ]:
            with self.subTest(text=text):
                validate_profile_claims([text], {'lossCapacity': QUALITATIVE_CAPACITY})
        for text in [
            'Votre capacité financière nulle signifie que le projet est fragile.',
            'Sa capacité financière nulle désigne une absence de capacité de perte.',
            'Cette capacité financière est nulle lorsque le projet doit être protégé.',
            'Une capacité financière nulle signifie aucune perte possible. Votre capacité financière est nulle.',
        ]:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, 'seuil zéro'):
                validate_profile_claims([text], {'lossCapacity': QUALITATIVE_CAPACITY})

    def test_insight_summary_and_limits_are_checked_without_replacing_the_snapshot(self):
        profile = {'lossCapacity': QUALITATIVE_CAPACITY, 'horizon': '18 mois'}
        for location in ('summary', 'limits'):
            args = InsightInput(title='Projet et perte', question='Quelle capacité est déclarée ?',
                                status='information', fields=['lossCapacity'],
                                summary='La capacité de perte est qualitative ; aucun montant maximal n’est déclaré.')
            if location == 'summary':
                args.summary = 'La capacité financière est structurellement nulle pour ce projet à 18 mois.'
            else:
                args.limits = ['Votre capacité financière nulle est une limite du profil.']
            with self.subTest(location=location), self.assertRaisesRegex(ValueError, 'seuil zéro'):
                insight_tab(args, profile, set())
        args.limits = []
        result = json.loads(insight_tab(args, profile, set())['content'])
        self.assertEqual(result['profileSnapshot'], profile)

    def test_no_visible_insight_field_can_hide_an_unsupported_positive_zero_claim(self):
        for location in ('title', 'question', 'summary', 'limits', 'alternatives', 'nextQuestion'):
            raw = {'title': 'Capacité et projet', 'question': 'Quelle capacité est déclarée ?',
                   'status': 'information', 'fields': ['lossCapacity'],
                   'summary': 'La capacité déclarée décrit une contrainte qualitative ; le montant reste non chiffré.'}
            assertion = 'Votre capacité financière est nulle.'
            raw[location] = [assertion] if location in ('limits', 'alternatives') else assertion
            if location == 'nextQuestion':
                raw[location] += ' Quelle échéance faut-il retenir ?'
            args = InsightInput.model_validate(raw)
            with self.subTest(location=location), self.assertRaisesRegex(ValueError, 'seuil zéro'):
                insight_tab(args, {'lossCapacity': QUALITATIVE_CAPACITY}, set())

    def test_visible_questions_and_hypotheses_remain_valid_without_inventing_zero(self):
        args = InsightInput(title='Hypothèse d’une capacité financière nulle',
                            question='Votre capacité financière est-elle nulle ?',
                            status='clarification', fields=['lossCapacity'],
                            summary='La déclaration reçue ne mesure pas une capacité financière nulle.',
                            alternatives=['Si la capacité financière est nulle, il faut distinguer cette hypothèse du profil.'],
                            nextQuestion='Une capacité financière nulle est-elle réellement établie ?')
        result = json.loads(insight_tab(args, {'lossCapacity': QUALITATIVE_CAPACITY}, set())['content'])
        self.assertEqual(result['nextQuestion'], args.nextQuestion)

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_final_response_repairs_unsupported_zero_before_streaming_it(self):
        corrected = 'Vous avez indiqué ne pas pouvoir absorber une perte compromettant le projet ; le montant maximal reste non chiffré.'
        class Runtime(RuntimeStub):
            def converse_stream(self, **kwargs):
                self.calls.append(deepcopy(kwargs))
                text = 'Votre capacité financière est structurellement nulle.' if len(self.calls) == 1 else corrected
                return {'stream': [
                    {'contentBlockDelta': {'contentBlockIndex': 0, 'delta': {'text': text}}},
                    {'messageStop': {'stopReason': 'end_turn'}},
                ]}
        runtime = Runtime(None)
        events = list(run_chat(ChatRequest(message='Explique ma capacité de perte', workspaceMode='profiles',
                                           profile={'lossCapacity': QUALITATIVE_CAPACITY}), runtime))
        self.assertEqual(len(runtime.calls), 2)
        self.assertEqual(''.join(event['delta'] for event in events if event['type'] == 'text'), corrected)
        self.assertEqual(events[-1]['type'], 'done')
        self.assertIn('seuil zéro', runtime.calls[-1]['messages'][-1]['content'][0]['text'])

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_unsupported_insight_is_rejected_before_publishing_a_workspace_card(self):
        args = {'title': 'Projet et perte', 'question': 'Quelle capacité est déclarée ?',
                'status': 'information', 'fields': ['lossCapacity'],
                'summary': 'La capacité financière est structurellement nulle pour ce projet à 18 mois.'}
        runtime = RuntimeStub(stream_tool('publish_profile_insight', args))
        events = list(run_chat(ChatRequest(message='Présente cette lecture', workspaceMode='profiles',
                                           profile={'lossCapacity': QUALITATIVE_CAPACITY}), runtime))
        self.assertTrue(any(event.get('name') == 'publish_profile_insight' and event.get('status') == 'failed'
                            and 'seuil zéro' in event.get('error', '') for event in events))
        self.assertFalse(any(event.get('name') == 'publish_profile_insight' and event.get('status') == 'done'
                             for event in events))
        self.assertFalse(any(tab['kind'] == 'decision' for event in events if event['type'] == 'workspace'
                             for tab in event['tabs']))


if __name__ == '__main__':
    unittest.main()
