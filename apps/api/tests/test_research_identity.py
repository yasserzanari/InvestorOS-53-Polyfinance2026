import json
import unittest

from investoros_api.research.identity import identity_claims, identity_snapshot


SOURCE = {"id": "official-example-accounts", "url": "https://authority.example/official-accounts/",
          "domain": "authority.example", "publisher": "Example Authority",
          "identity_profiles": {"ExampleAgency": "Compte institutionnel Example Agency"}}
CAPTURE = {"url": SOURCE["url"], "title": "Official accounts", "captured_at": "2026-11-15T00:00:00Z",
           "links": ["https://twitter.com/ExampleAgency/?ref=authority#profile"]}


class IdentityContractTest(unittest.TestCase):
    def test_explicit_profile_crosslink_is_canonical_and_current(self):
        proof = identity_snapshot(SOURCE, "@EXAMPLEAGENCY", CAPTURE)

        self.assertEqual((proof["handle"], proof["profile_url"]), ("exampleagency", "https://x.com/exampleagency"))
        self.assertEqual(proof["identity_status"], "linked_by_authority")
        self.assertTrue(proof["identity_verified"])
        self.assertEqual(proof["checked_at"], CAPTURE["captured_at"])
        self.assertTrue(any("véracité" in limitation for limitation in proof["limitations"]))
        self.assertTrue(any("personnels" in limitation for limitation in proof["limitations"]))

    def test_spoofed_urls_status_links_and_mentions_never_establish_identity(self):
        links = ["@ExampleAgency", "Example Agency — verified badge", "https://x.com.evil.test/ExampleAgency",
                 "https://x.com@evil.test/ExampleAgency", "https://person@x.com/ExampleAgency",
                 "https://x.com:443/ExampleAgency", "https://x.com/ExampleAgency/status/123",
                 "https://x.com/OtherAgency?profile=https://x.com/ExampleAgency", "http://x.com/ExampleAgency",
                 "https://x.com/ExampleAgency%2f", "https://127.0.0.1/ExampleAgency"]
        proof = identity_snapshot(SOURCE, "ExampleAgency", {**CAPTURE, "links": links})

        self.assertEqual(proof["identity_status"], "not_linked")
        self.assertFalse(proof["identity_verified"])
        claims = identity_claims({"evidence_id": "proof", "content": proof})
        self.assertEqual(claims[0]["confidence"], "unverified")
        self.assertIn("reste non vérifiée", claims[0]["text"])

    def test_historical_crosslink_cannot_become_current_verified_identity(self):
        proof = identity_snapshot({**SOURCE, "identity_historical": True}, "ExampleAgency", CAPTURE)

        self.assertEqual(proof["identity_status"], "historical_crosslink")
        self.assertFalse(proof["identity_verified"])
        claims = identity_claims({"evidence_id": "archive", "content": json.dumps(proof)})
        self.assertEqual(claims[0]["confidence"], "partial")
        self.assertIn("actuelle reste à vérifier", claims[0]["text"])
        self.assertTrue(any("archive historique" in limitation for limitation in proof["limitations"]))

    def test_capture_must_match_exact_authority_domain_and_page(self):
        for url in ["https://authority.example.evil.test/official-accounts/", "https://other.authority.example/official-accounts/",
                    "https://authority.example/other-page/", "http://authority.example/official-accounts/",
                    "https://user@authority.example/official-accounts/", "https://authority.example:443/official-accounts/"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                identity_snapshot(SOURCE, "ExampleAgency", {**CAPTURE, "url": url})
        proof = identity_snapshot(SOURCE, "ExampleAgency", {**CAPTURE, "url": SOURCE["url"].rstrip("/")})
        self.assertTrue(proof["identity_verified"])

    def test_unknown_handle_is_rejected_even_when_capture_links_to_it(self):
        with self.assertRaises(ValueError):
            identity_snapshot(SOURCE, "OtherAgency", {**CAPTURE, "links": ["https://x.com/OtherAgency"]})

    def test_claim_unwraps_browser_envelope_and_keeps_authority_citation(self):
        proof = identity_snapshot(SOURCE, "ExampleAgency", CAPTURE)
        direct = identity_claims({"evidence_id": "identity-proof", "content": proof})
        wrapped = identity_claims({"evidence_id": "identity-proof", "content": json.dumps({"text": json.dumps(proof)})})

        self.assertEqual(wrapped, direct)
        self.assertEqual(direct[0]["claim_type"], "account_identity")
        self.assertEqual(direct[0]["confidence"], "supported")
        self.assertEqual(direct[0]["url"], SOURCE["url"])
        self.assertEqual(direct[0]["evidence_ids"], ["identity-proof"])
        self.assertIn("ne confirme pas la véracité", direct[0]["text"])

    def test_missing_capture_fields_and_inconsistent_verified_flags_are_rejected(self):
        for update in [{"links": None}, {"captured_at": "2026-11-15"}, {"captured_at": "not-a-date"}]:
            with self.subTest(update=update), self.assertRaises(ValueError):
                identity_snapshot(SOURCE, "ExampleAgency", {**CAPTURE, **update})
        proof = identity_snapshot({**SOURCE, "identity_historical": True}, "ExampleAgency", CAPTURE)
        self.assertEqual(identity_claims({"evidence_id": "bad-proof", "content": {**proof, "identity_verified": True}}), [])


if __name__ == "__main__":
    unittest.main()
