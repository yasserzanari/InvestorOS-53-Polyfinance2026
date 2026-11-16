import unittest

from fastapi import HTTPException

from investoros_api.simulation import source_catalog, source_operations


class SourceCatalogTests(unittest.TestCase):
    def test_catalog_uses_enabled_investoros_sources_and_includes_x(self):
        catalog = source_catalog()
        names = {site["name"] for site in catalog["sites"]}

        self.assertEqual(catalog["provider"], "InvestorOS · registre des sources autorisées")
        self.assertIn("x", names)
        self.assertIn("sec-edgar", names)
        self.assertNotIn("yahoo-finance", names)

    def test_x_operations_are_read_only_and_describe_provenance(self):
        result = source_operations("x")

        self.assertEqual([operation["name"] for operation in result["operations"]], ["getUser", "getRecentPosts"])
        self.assertTrue(all(operation["readOnly"] for operation in result["operations"]))
        self.assertIn("déclarations attribuées", result["notes"])

    def test_disabled_and_unknown_sources_are_not_authorized(self):
        with self.assertRaises(HTTPException) as disabled:
            source_operations("yahoo-finance")
        self.assertEqual(disabled.exception.status_code, 404)

        with self.assertRaises(HTTPException) as malformed:
            source_operations("x/../../private")
        self.assertEqual(malformed.exception.status_code, 422)

    def test_enabled_source_has_documented_read_only_operation(self):
        result = source_operations("sec-edgar")

        self.assertEqual(len(result["operations"]), 1)
        self.assertTrue(result["operations"][0]["readOnly"])
        self.assertEqual(result["operations"][0]["name"], "companySubmissionsV3")


if __name__ == "__main__":
    unittest.main()
