"""Focused regressions for facts copied from SEC filings and shared learning."""
import json
import unittest
from botocore.exceptions import ClientError
from investoros_api.research.financials import financial_snapshot, financial_claims
from investoros_api.research.learning import learning_lease
from investoros_api.research.api_anything import ApiAnythingClient, ApiAnythingError


class FinancialFactsTest(unittest.TestCase):
    def test_annual_fact_excludes_quarterly_duration_and_keeps_provenance(self):
        base = {'form': '10-K', 'fp': 'FY', 'accn': 'example', 'filed': '2026-11-03', 'end': '2026-09-26'}
        rows = [{**base, 'start': '2025-09-28', 'val': 100}, {**base, 'start': '2026-06-28', 'val': 900}]
        payload = {'facts': {'us-gaap': {'NetIncomeLoss': {'units': {'USD': rows}}}}}
        value = financial_snapshot(payload)['annual_financials'][0]
        self.assertEqual((value['value'], value['unit'], value['accession']), (100, 'USD', 'example'))
        self.assertEqual(value['period_start'], '2025-09-28')
        claims = financial_claims({'evidence_id': 'proof', 'content': json.dumps(financial_snapshot(payload))})
        self.assertEqual(claims[0]['reported_fact'], value)
        self.assertEqual(claims[0]['evidence_ids'], ['proof'])

    def test_latest_filed_restatement_of_same_period_is_retained(self):
        first = {'form': '10-K', 'fp': 'FY', 'accn': 'first', 'filed': '2026-11-03', 'end': '2026-09-26', 'val': 500}
        amended = {**first, 'form': '10-K/A', 'filed': '2026-11-10', 'accn': 'amended', 'val': 510}
        snapshot = financial_snapshot({'assets': {'units': {'USD': [amended, first]}}})
        self.assertEqual(snapshot['annual_financials'][0]['value'], 510)
        self.assertEqual(snapshot['annual_financials'][0]['accession'], 'amended')

    def test_missing_financial_concepts_are_not_invented(self):
        self.assertEqual(financial_snapshot({'facts': {}})['annual_financials'], [])

    def test_truncated_api_result_is_reassembled_without_requesting_source_again(self):
        class Client(ApiAnythingClient):
            def __init__(self): self.calls = []
            def request(self, method, path, payload=None):
                self.calls.append((method, path))
                if path.startswith('/v1/call/'):
                    return {'ok': True, 'data': {}, 'truncated': 'cut', 'resultId': '11111111-1111-1111-1111-111111111111'}
                if 'offset=0&' in path:
                    return {'encoding': 'json', 'data': '{"net_', 'more': {'offset': 6}}
                return {'encoding': 'json', 'data': 'income":42}'}
        client = Client()
        result = client.call({'param': 'cik', 'api_site': 'sec-companyfacts', 'api_operation': 'annualFinancials'}, '0000320193')
        self.assertEqual(result['data'], {'net_income': 42})
        self.assertEqual(len([path for _, path in client.calls if path.startswith('/v1/call/')]), 1)

    def test_concurrent_learning_uses_browser_fallback_instead_of_second_learner(self):
        class Table:
            busy = False
            def update_item(self, **kwargs):
                if kwargs['UpdateExpression'].startswith('SET'):
                    if self.busy:
                        raise ClientError({'Error': {'Code': 'ConditionalCheckFailedException'}}, 'UpdateItem')
                    self.busy = True
                else: self.busy = False
        table = Table()
        with learning_lease(table, 'source'):
            with self.assertRaises(ApiAnythingError) as caught:
                with learning_lease(table, 'source'): pass
            self.assertEqual(caught.exception.failure_class, 'learning_busy')
        self.assertFalse(table.busy)


if __name__ == '__main__': unittest.main()
