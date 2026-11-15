import hashlib
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from investoros_api.research.router import _consume_daily_quota


class ResearchQuotaTests(unittest.TestCase):
    def _request(self, subject=None, principal_hash=None, host='127.0.0.1'):
        claims = {'sub': subject} if subject else {}
        context = {'authorizer': {'jwt': {'claims': claims}}} if subject else {}
        if principal_hash:
            context['trustedPrincipalHash'] = principal_hash
        return SimpleNamespace(
            scope={'aws.event': {'requestContext': context}},
            client=SimpleNamespace(host=host),
        )

    def test_quota_isolated_by_verified_user_and_persona(self):
        table = SimpleNamespace(update_item=Mock())
        with patch('investoros_api.research.router._table', return_value=table):
            _consume_daily_quota(self._request(subject='user-a'), 'mateo')
            first_key = table.update_item.call_args.kwargs['Key']['quota_key']
            _consume_daily_quota(self._request(subject='user-b'), 'mateo')
            second_key = table.update_item.call_args.kwargs['Key']['quota_key']
            _consume_daily_quota(self._request(subject='user-a'), 'amira')
            third_key = table.update_item.call_args.kwargs['Key']['quota_key']
        self.assertEqual(len({first_key, second_key, third_key}), 3)
        self.assertNotIn('user-a', first_key)

    def test_iam_hop_uses_hashed_cognito_subject_not_shared_lambda_ip(self):
        table = SimpleNamespace(update_item=Mock())
        with patch('investoros_api.research.router._table', return_value=table):
            principal = hashlib.sha256(b'user-a').hexdigest()
            _consume_daily_quota(self._request(principal_hash=principal), 'mateo')
        quota_key = table.update_item.call_args.kwargs['Key']['quota_key']
        self.assertNotIn('127.0.0.1', quota_key)

    def test_local_requests_keep_ip_fallback(self):
        table = SimpleNamespace(update_item=Mock())
        with patch('investoros_api.research.router._table', return_value=table):
            _consume_daily_quota(self._request(host='10.0.0.1'), 'mateo')
        quota_key = table.update_item.call_args.kwargs['Key']['quota_key']
        self.assertTrue(quota_key.split(':', 1)[1])


if __name__ == '__main__':
    unittest.main()
