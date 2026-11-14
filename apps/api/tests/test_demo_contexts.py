"""The demo selector maps persona names to server-configured fixed DynamoDB keys."""
import json
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from investoros_api.demo_contexts import context_for
from investoros_api.main import demo_overview


class DemoDynamoStub:
    def __init__(self, persona_context):
        self.context = persona_context
        self.keys = []

    def get_item(self, *, TableName, Key, ConsistentRead):
        del ConsistentRead
        self.keys.append((TableName, Key))
        account_id = self.context["account_id"]
        profile_id = self.context["profile_id"]
        portfolio_id = self.context["portfolio_id"]
        if TableName == "accounts":
            payload = {"display_name": "Robert · Démo", "is_demo": True}
            item = {"account_id": {"S": account_id}}
        elif TableName == "profiles":
            payload = {"profile_id": profile_id, "is_demo": True, "status": "confirmed"}
            item = {"account_id": {"S": account_id}, "profile_id": {"S": profile_id}}
        else:
            payload = {
                "profile_id": profile_id,
                "is_demo": True,
                "currency": "CAD",
                "total_value": 100000,
                "positions": [],
            }
            item = {"account_id": {"S": account_id}, "portfolio_id": {"S": portfolio_id}}
        return {"Item": {**item, "payload": {"S": json.dumps(payload)}}}

    def query(self, **kwargs):
        return {"Items": []}


class DemoContextsTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "DEMO_CONTEXTS": json.dumps(
                {
                    "amira": {
                        "account_id": "fixed-amira-account",
                        "profile_id": "fixed-amira-profile",
                        "portfolio_id": "fixed-amira-portfolio",
                    }
                }
            )
        },
    )
    def test_persona_maps_to_only_server_configured_keys(self):
        self.assertEqual(
            context_for("amira"),
            {
                "account_id": "fixed-amira-account",
                "profile_id": "fixed-amira-profile",
                "portfolio_id": "fixed-amira-portfolio",
            },
        )

    @patch.dict(os.environ, {"DEMO_CONTEXTS": "{}"})
    def test_missing_persona_is_not_resolved_from_user_text(self):
        with self.assertRaises(HTTPException) as raised:
            context_for("robert")
        self.assertEqual(raised.exception.status_code, 404)

    @patch.dict(
        os.environ,
        {
            "DEMO_CONTEXTS": json.dumps(
                {
                    "robert": {
                        "account_id": "fixed-robert-account",
                        "profile_id": "fixed-robert-profile",
                        "portfolio_id": "fixed-robert-portfolio",
                    }
                }
            ),
            "ACCOUNTS_TABLE_NAME": "accounts",
            "PROFILES_TABLE_NAME": "profiles",
            "PORTFOLIOS_TABLE_NAME": "portfolios",
            "ANALYSES_TABLE_NAME": "analyses",
        },
    )
    @patch("investoros_api.main._client")
    def test_overview_reads_the_selected_persona_context(self, client_factory):
        context = {
            "account_id": "fixed-robert-account",
            "profile_id": "fixed-robert-profile",
            "portfolio_id": "fixed-robert-portfolio",
        }
        client = DemoDynamoStub(context)
        client_factory.return_value = client
        overview = demo_overview("robert")
        self.assertEqual(overview["persona"], "robert")
        self.assertEqual(overview["portfolio"]["profile_id"], "fixed-robert-profile")
        self.assertEqual(
            [key for _, key in client.keys],
            [
                {"account_id": {"S": "fixed-robert-account"}},
                {
                    "account_id": {"S": "fixed-robert-account"},
                    "profile_id": {"S": "fixed-robert-profile"},
                },
                {
                    "account_id": {"S": "fixed-robert-account"},
                    "portfolio_id": {"S": "fixed-robert-portfolio"},
                },
            ],
        )


if __name__ == "__main__":
    unittest.main()
