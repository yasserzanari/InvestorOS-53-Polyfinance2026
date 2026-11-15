import unittest
from unittest.mock import patch

from fastapi import HTTPException
from investoros_api.profiles.movement_analysis import (
    compare_history, grounded_factors, investigate_movement, temporal_documents, _SYNTHESIS_CACHE,
)


def document(identifier, published):
    return {'evidence_id': identifier, 'source_id': 'issuer', 'source_name': 'Issuer', 'method': 'official_document_read',
            'content': {'ticker': 'NVDA', 'documents': [{'title': 'Official statement', 'url': f'https://investor.nvidia.com/news/{identifier}',
            'published_at': published, 'excerpt': 'The board announced the resignation of the chief executive effective immediately. A successor has been appointed.', 'characters_read': 200}]}}


class MovementInvestigationTests(unittest.TestCase):
    def setUp(self):
        _SYNTHESIS_CACHE.clear()

    def test_benchmark_requires_exact_same_closes(self):
        history = {'prices': [{'date': '2026-10-29', 'adjustedClose': 100}, {'date': '2026-10-30', 'adjustedClose': 97}], 'sourceClassification': 'observations'}
        self.assertEqual(compare_history(history, 'QQQ', '2026-10-29', '2026-10-30')['changePct'], -3)
        self.assertFalse(compare_history(history, 'QQQ', '2026-10-28', '2026-10-30')['available'])

    def test_documents_after_close_and_later_announcements_are_excluded(self):
        snapshot = {'evidence': [document('before', '2026-10-30T15:59:00-04:00'),
                                 document('after', '2026-10-30T16:01:00-04:00'),
                                 document('future', '2026-11-12T09:00:00-05:00'),
                                 document('background', '2026-10-28T17:00:00-04:00'),
                                 document('uncertain', '2026-10-30')]}
        documents = temporal_documents(snapshot, 'NVDA', '2026-10-29', '2026-10-30')
        self.assertEqual({d['evidenceId'] for d in documents}, {'before', 'background', 'uncertain'})
        self.assertEqual(next(d for d in documents if d['evidenceId'] == 'background')['context'], 'background')
        self.assertEqual(next(d for d in documents if d['evidenceId'] == 'uncertain')['temporalStatus'], 'time_uncertain')

    def test_factors_require_real_source_and_verbatim_excerpt(self):
        documents = temporal_documents({'evidence': [document('read', '2026-10-29T17:00:00-04:00')]}, 'NVDA', '2026-10-29', '2026-10-30')
        valid = {'category': 'company', 'title': 'Contexte de calendrier', 'interpretation': 'Lecture conditionnelle.',
                 'counterpoint': 'Aucun effet causal mesuré.', 'sourceId': documents[0]['id'], 'quote': documents[0]['excerpt']}
        factors = grounded_factors({'factors': [valid, {**valid, 'quote': 'The company reported a surprise loss.'}, {**valid, 'sourceId': 'invented'}]}, documents)
        self.assertEqual(len(factors), 1)
        self.assertEqual(factors[0]['status'], 'hypothesis')
        self.assertFalse(grounded_factors({'factors': [valid]}, [{**documents[0], 'temporalStatus': 'time_uncertain'}]))

    def test_calendar_announcement_is_never_promoted_to_an_earnings_cause(self):
        item = document('calendar', '2026-10-28T17:00:00-04:00')
        item['content']['documents'][0].update(title='NVIDIA Sets Conference Call', excerpt='NVIDIA will host a conference call on November 17 to discuss the results of its third quarter, which ended October 25.')
        documents = temporal_documents({'evidence': [item]}, 'NVDA', '2026-10-29', '2026-10-30')
        self.assertEqual(documents[0]['documentRole'], 'calendar_only')
        proposal = {'factors': [{'category': 'earnings', 'sourceId': documents[0]['id'], 'quote': documents[0]['excerpt'], 'title': 'Earnings', 'interpretation': 'Bad earnings caused the fall.', 'counterpoint': 'Unknown'}]}
        self.assertEqual(grounded_factors(proposal, documents), [])

    @patch('investoros_api.profiles.movement_analysis.movement_report', side_effect=HTTPException(403, 'Other account'))
    @patch('investoros_api.profiles.movement_analysis.discover_news')
    def test_account_refusal_prevents_new_collection(self, news, report):
        with self.assertRaises(HTTPException):
            investigate_movement('id', 'amira', 'NVDA', '2026-10-29', '2026-10-30')
        news.assert_not_called()

    @patch('investoros_api.profiles.movement_analysis._call', side_effect=ValueError('Catalog unavailable'))
    @patch('investoros_api.profiles.movement_analysis.interpret_documents', return_value=([], 'unavailable'))
    @patch('investoros_api.profiles.movement_analysis.discover_news', return_value={'status': 'unavailable', 'leads': []})
    @patch('investoros_api.profiles.movement_analysis.simulation_history')
    @patch('investoros_api.profiles.movement_analysis.research_snapshot', return_value={'evidence': []})
    @patch('investoros_api.profiles.movement_analysis.movement_report')
    def test_missing_news_or_model_does_not_erase_comparisons_or_invent_cause(self, report, snapshot, history, news, interpret, catalog):
        report.return_value = {'movements': [{'previousDate': '2026-10-29', 'date': '2026-10-30', 'changePct': -4.22, 'candidates': []}], 'currency': 'USD', 'source': {'classification': 'observations'}, 'marketClock': {'supported': True}}
        history.return_value = {'currency': 'USD', 'sourceClassification': 'observations', 'prices': [{'date': '2026-10-29', 'adjustedClose': 100}, {'date': '2026-10-30', 'adjustedClose': 97}]}
        result = investigate_movement('id', 'mateo', 'NVDA', '2026-10-29', '2026-10-30')
        self.assertEqual(len(result['benchmarks']), 2)
        self.assertIn('même sens', result['conclusion'])
        self.assertEqual(result['factors'], [])
        self.assertEqual(result['coverage']['flows'], 'missing')
        self.assertEqual(result['coverage']['causality'], 'not_established')
        self.assertEqual(result['status'], 'partial')
        self.assertIn('synthèse documentaire n’a pas abouti', result['conclusion'])


if __name__ == '__main__':
    unittest.main()
