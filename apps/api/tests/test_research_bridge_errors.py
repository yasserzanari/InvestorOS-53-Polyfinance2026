import unittest

from investoros_api.profiles.research_bridge import _http_error_message


class ResearchBridgeErrorTests(unittest.TestCase):
    def test_daily_quota_response_explains_no_analysis_was_started(self):
        message = _http_error_message(
            429,
            b'{"detail":"Limite quotidienne de recherches atteinte pour cette adresse reseau et ce compte demo."}',
        )
        self.assertIn('limite quotidienne', message.lower())
        self.assertIn('Aucun lancement n’a été fait', message)

    def test_other_rate_limits_do_not_expose_raw_response(self):
        message = _http_error_message(429, b'<html>internal proxy detail</html>')
        self.assertIn('Aucun lancement n’a été confirmé', message)
        self.assertNotIn('internal proxy', message)

    def test_other_http_errors_keep_their_status(self):
        self.assertEqual(
            _http_error_message(503),
            'Le moteur de recherche a refusé la requête (HTTP 503).',
        )


if __name__ == '__main__':
    unittest.main()
