"""Question schemas, answer validation and pause/resume contract; no network calls."""
import os
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from investoros_api.profiles.models import AskUserInput, ChatRequest
from investoros_api.profiles.service import _messages, run_chat
from test_profile_service import RuntimeStub, stream_tool


def questions():
    return {
        'title': 'Précisons votre situation',
        'questions': [
            {'id': 'horizon', 'label': 'Quand pensez-vous utiliser cet argent?',
             'kind': 'single_choice', 'options': [{'id': 'soon', 'label': 'Dans 3 ans'}, {'id': 'later', 'label': 'Dans 10 ans'}]},
            {'id': 'needs', 'label': 'Quels projets souhaitez-vous financer?',
             'kind': 'multiple_choice', 'options': [{'id': 'house', 'label': 'Logement'}, {'id': 'retirement', 'label': 'Retraite'}]},
            {'id': 'impact', 'label': 'Quel serait l’effet d’une perte?', 'kind': 'text', 'placeholder': 'Décrivez les conséquences sur vos projets'},
        ],
    }


def answer_request():
    return {'message': 'Voici mes réponses.', 'questionRequest': {'id': 'request-1', **questions()},
            'questionAnswer': {'requestId': 'request-1', 'answers': [
                {'questionId': 'horizon', 'selectedOptionIds': ['later']},
                {'questionId': 'needs', 'selectedOptionIds': ['house', 'retirement']},
                {'questionId': 'impact', 'text': 'Je devrais reporter mon projet.'},
            ]}}


class AskUserTests(unittest.TestCase):
    def test_varied_formats_validate_without_selected_defaults(self):
        data = AskUserInput.model_validate(questions())
        self.assertEqual([q.kind for q in data.questions], ['single_choice', 'multiple_choice', 'text'])
        self.assertTrue(all(q.required and q.allowOther for q in data.questions))
        self.assertNotIn('selectedOptionIds', data.model_dump()['questions'][0])

    def test_choice_count_and_duplicate_ids_rejected(self):
        for change in ['one_option', 'duplicate_options', 'duplicate_questions', 'text_options']:
            with self.subTest(change=change):
                data = questions()
                if change == 'one_option':
                    data['questions'][0]['options'] = [{'id': 'only', 'label': 'Un seul'}]
                elif change == 'duplicate_options':
                    data['questions'][0]['options'][1]['id'] = 'soon'
                elif change == 'duplicate_questions':
                    data['questions'][1]['id'] = 'horizon'
                else:
                    data['questions'][2]['options'] = [{'id': 'extra', 'label': 'Non'}]
                with self.assertRaises(ValidationError):
                    AskUserInput.model_validate(data)

    def test_more_than_three_questions_rejected(self):
        data = questions()
        data['questions'].append({'id': 'extra', 'label': 'Question supplémentaire', 'kind': 'text'})
        with self.assertRaises(ValidationError):
            AskUserInput.model_validate(data)

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_ask_user_pauses_without_fabricated_answer_or_second_model_call(self):
        runtime = RuntimeStub(stream_tool('ask_user', questions()))
        events = list(run_chat(ChatRequest(message='Aide-moi à construire mon profil.'), runtime))
        request = next(event['request'] for event in events if event['type'] == 'questions')
        self.assertEqual(len(request['questions']), 3)
        self.assertEqual(len(runtime.calls), 1)
        self.assertEqual(events[-1]['type'], 'done')
        self.assertTrue(events[-1]['awaitingUser'])
        self.assertEqual(events[-1]['questionRequestId'], request['id'])
        self.assertFalse(any('toolResult' in block for call in runtime.calls for message in call['messages'] for block in message['content']))

    @patch.dict(os.environ, {'BEDROCK_MODEL_ID': 'test-model'})
    def test_invalid_model_question_returns_tool_error_and_can_recover(self):
        data = questions()
        data['questions'][0]['options'] = []
        runtime = RuntimeStub(stream_tool('ask_user', data))
        events = list(run_chat(ChatRequest(message='Bonjour'), runtime))
        self.assertFalse(any(e['type'] == 'questions' for e in events))
        self.assertTrue(any(e['type'] == 'tool' and e['status'] == 'failed' for e in events))

    def test_structured_answers_resume_with_real_question_labels(self):
        request = ChatRequest.model_validate(answer_request())
        text = _messages(request)[-1]['content'][0]['text']
        self.assertIn('Dans 10 ans', text)
        self.assertIn('Logement', text)
        self.assertIn('Retraite', text)
        self.assertIn('reporter mon projet', text)
        self.assertNotIn('Dans 3 ans', text)

    def test_invalid_answer_ids_selection_and_required_empty_rejected(self):
        for change in ['request_id', 'unknown_question', 'duplicate_question', 'unknown_choice', 'duplicate_choice', 'single_multiple', 'empty_required', 'missing_required', 'text_selection', 'other_not_allowed']:
            with self.subTest(change=change):
                data = answer_request()
                answers = data['questionAnswer']['answers']
                if change == 'request_id': data['questionAnswer']['requestId'] = 'different'
                elif change == 'unknown_question': answers[0]['questionId'] = 'unknown'
                elif change == 'duplicate_question': answers[1]['questionId'] = 'horizon'
                elif change == 'unknown_choice': answers[0]['selectedOptionIds'] = ['unknown']
                elif change == 'duplicate_choice': answers[0]['selectedOptionIds'] = ['later', 'later']
                elif change == 'single_multiple': answers[0]['selectedOptionIds'] = ['soon', 'later']
                elif change == 'empty_required': answers[0]['selectedOptionIds'] = []
                elif change == 'missing_required': answers.pop()
                elif change == 'text_selection': answers[2]['selectedOptionIds'] = ['later']
                else:
                    data['questionRequest']['questions'][0]['allowOther'] = False
                    answers[0]['text'] = 'Autre situation'
                with self.assertRaises(ValidationError): ChatRequest.model_validate(data)

    def test_optional_questions_can_be_omitted_and_free_other_is_accepted(self):
        data = answer_request()
        data['questionRequest']['questions'][2]['required'] = False
        data['questionAnswer']['answers'].pop()
        data['questionAnswer']['answers'][0] = {'questionId': 'horizon', 'text': 'Mon horizon dépendra de mon prochain emploi.'}
        self.assertIsNotNone(ChatRequest.model_validate(data))

    def test_snapshot_and_answer_must_be_supplied_together(self):
        for key in ['questionRequest', 'questionAnswer']:
            data = answer_request()
            del data[key]
            with self.assertRaises(ValidationError): ChatRequest.model_validate(data)


if __name__ == '__main__':
    unittest.main()
