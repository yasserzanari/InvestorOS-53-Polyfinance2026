import unittest
from unittest.mock import patch

from investoros_api.research import runtime


def timeline(username):
    tweet = {
        'rest_id': '123456789',
        'core': {'user_results': {'result': {'rest_id': '42', 'core': {'screen_name': username, 'name': username}}}},
        'details': {'full_text': 'A public market update', 'created_at': 'Sun Nov 15 12:00:00 +0000 2026'},
    }
    return {'data': {'user_result_by_screen_name': {'result': {
        'profile_user_originals_timeline': {'timeline': {'instructions': [
            {'entries': [{'content': {'itemContent': {'tweet_results': {'result': tweet}}}}]}
        ]}}
    }}}}


class ApiAnythingXProxyTests(unittest.TestCase):
    @patch('investoros_api.research.runtime._api_anything_fetch')
    def test_worker_learns_or_reuses_template_and_returns_attributed_public_posts(self, fetch):
        fetch.return_value = {'data': timeline('Nvidia')}
        result = runtime.read_public_x_posts({'usernames': ['Nvidia']})

        self.assertTrue(result['ok'])
        self.assertEqual(result['source'], 'API Anything · X getRecentPosts')
        self.assertEqual(result['results']['nvidia'][0]['author'], 'Nvidia')
        self.assertEqual(result['results']['nvidia'][0]['url'], 'https://x.com/Nvidia/status/123456789')
        self.assertFalse(result['failures'])
        fetch.assert_called_once()
        source, username = fetch.call_args.args
        self.assertEqual(username, 'Nvidia')
        self.assertEqual(source['api_site'], 'x-public-timeline')
        self.assertEqual(source['api_operation'], 'getRecentPosts')

    def test_worker_rejects_invalid_or_unbounded_handle_lists(self):
        for event in ({'usernames': []}, {'usernames': ['bad/name']}, {'usernames': ['Nvidia'] * 9}):
            with self.subTest(event=event), self.assertRaises(ValueError):
                runtime.read_public_x_posts(event)


if __name__ == '__main__':
    unittest.main()
