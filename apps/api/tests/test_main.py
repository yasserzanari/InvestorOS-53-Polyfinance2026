import unittest
from unittest.mock import patch

from investoros_api import main


class LambdaAuthorizationTests(unittest.TestCase):
    def test_gateway_group_array_serializations_authorize_exact_administrator_only(self):
        allowed = [['administrators'], 'administrators', '["administrators"]', '[administrators]', '[readers administrators]']
        denied = [None, [], {}, '["readers"]', 'administrators-extra', '[not-administrators]', 'readers,administrators', '[[administrators]]', '["administrators",null]', '[administrators,readers]']
        with patch.dict('os.environ', {'REQUIRE_ADMIN_AUTH':'true'}):
            for groups in allowed + denied:
                with self.subTest(groups=groups), patch.object(main, '_mangum_handler', return_value={'statusCode':200}) as application:
                    response=main.handler({'requestContext':{'routeKey':'GET /v1/profiles/status','authorizer':{'jwt':{'claims':{'cognito:groups':groups}}}}},None)
                    self.assertEqual(response['statusCode'],200 if groups in allowed else 403)
                    self.assertEqual(application.call_count,1 if groups in allowed else 0)

    def test_cors_defaults_are_limited_to_local_development_origins(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual(
                main._cors_allowed_origins(),
                ["http://localhost:5173", "http://127.0.0.1:5173"],
            )


    def test_cors_uses_explicit_configured_origins_and_deduplicates(self):
        with patch.dict("os.environ", {"CORS_ALLOWED_ORIGINS": "https://app.example,http://localhost:5173,https://app.example"}):
            self.assertEqual(
                main._cors_allowed_origins(),
                ["https://app.example", "http://localhost:5173"],
            )


    def test_cors_rejects_wildcard_origin(self):
        with patch.dict("os.environ", {"CORS_ALLOWED_ORIGINS": "*"}):
            with self.assertRaisesRegex(RuntimeError, "explicit origins"):
                main._cors_allowed_origins()


    def test_lambda_requires_administrator_claim_on_protected_routes(self):
        event = {"requestContext": {"routeKey": "GET /v1/demo/overview"}}
        with patch.dict("os.environ", {"REQUIRE_ADMIN_AUTH": "true"}), patch.object(
            main, "_mangum_handler"
        ) as mangum:
            response = main.handler(event, None)

        self.assertEqual(response["statusCode"], 403)
        mangum.assert_not_called()


    def test_lambda_allows_administrator_claim_and_local_mode_remains_unauthenticated(self):
        event = {
            "requestContext": {
                "routeKey": "GET /v1/demo/overview",
                "authorizer": {"jwt": {"claims": {"cognito:groups": "administrators"}}},
            }
        }
        expected = {"statusCode": 200}
        with patch.dict("os.environ", {"REQUIRE_ADMIN_AUTH": "true"}), patch.object(
            main, "_mangum_handler", return_value=expected
        ) as mangum:
            self.assertIs(main.handler(event, None), expected)
            mangum.assert_called_once_with(event, None)

        with patch.dict("os.environ", {}, clear=True), patch.object(
            main, "_mangum_handler", return_value=expected
        ) as mangum:
            self.assertIs(main.handler({"requestContext": {"routeKey": "GET /v1/demo/overview"}}, None), expected)
            mangum.assert_called_once()
