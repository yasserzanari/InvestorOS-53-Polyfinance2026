import unittest
from unittest.mock import patch

from investoros_api import simulation


class PublicXLambdaTests(unittest.TestCase):
    def test_public_timeline_uses_packaged_python_reader(self):
        post = {
            'id': '123',
            'author': 'Nvidia',
            'text': 'A public update',
            'publishedAt': '2026-11-15T12:00:00+00:00',
            'url': 'https://x.com/Nvidia/status/123',
            'profile': {'id': '42', 'username': 'Nvidia', 'name': 'NVIDIA'},
        }
        with patch('investoros_api.profiles.x_evidence.read_public_posts', return_value=[post]):
            with patch.object(simulation, '__file__', '/var/task/investoros_api/simulation.py'):
                result = simulation.public_x_posts('Nvidia')

        self.assertTrue(result['available'])
        self.assertEqual(result['posts'][0]['created_at'], post['publishedAt'])
        self.assertEqual(result['posts'][0]['author'], 'Nvidia')
        self.assertIn('observedAt', result)

    def test_public_profile_uses_timeline_profile_instead_of_repository_node_script(self):
        post = {
            'id': '123', 'text': 'A public update',
            'publishedAt': '2026-11-15T12:00:00+00:00',
            'url': 'https://x.com/Nvidia/status/123',
            'profile': {'id': '42', 'username': 'Nvidia', 'name': 'NVIDIA', 'verified': True},
        }
        with patch('investoros_api.profiles.x_evidence.read_public_posts', return_value=[post]):
            with patch.object(simulation, '__file__', '/var/task/investoros_api/simulation.py'):
                result = simulation.public_x_profile('Nvidia')

        self.assertEqual(result['username'], 'Nvidia')
        self.assertTrue(result['verified'])
        self.assertEqual(result['latestPost']['id'], '123')
        self.assertEqual(result['recentPosts'][0]['id'], '123')

    def test_public_timeline_failure_is_reported_without_lambda_path_crash(self):
        with patch('investoros_api.profiles.x_evidence.read_public_posts', side_effect=OSError('offline')):
            with patch.object(simulation, '__file__', '/var/task/investoros_api/simulation.py'):
                result = simulation.public_x_posts('Nvidia')

        self.assertFalse(result['available'])
        self.assertEqual(result['posts'], [])
        self.assertIn('indisponible', result['reason'])


if __name__ == '__main__':
    unittest.main()
