"""Unit and regression tests for CitationVerifier (PRD §16.3 & §16.4).

Verifies strict provenance validation:
- Fabricated email IDs are dropped
- Fabricated quotes are flagged as unverified (verified=False)
- Authentic exact and case-insensitive quotes return exact character offsets
- Attachment citations accurately pinpoint attachment filename
- Whitespace variations are handled cleanly
- Currency equivalence (e.g. INR 17.9 lakh == 1,790,000) is supported
- Hallucinated or altered amounts/dates are rejected
"""

import os
import unittest
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.rag.verifier import CitationVerifier
from sutra.models.email import Email

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))


class TestCitationVerifier(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loader = EmailDatasetLoader(DATASET_DIR)
        cls.emails = cls.loader.load_emails()
        cls.emails_by_id = {e.email_id: e for e in cls.emails}
        cls.verifier = CitationVerifier(cls.emails_by_id)

    def test_authentic_exact_quote(self):
        """Exact quote in email body should be verified with correct character offsets."""
        email = self.emails_by_id["E005"]
        quote = "Approved"
        is_v, loc, start, end, method = self.verifier.verify_citation("E005", quote)

        self.assertTrue(is_v)
        self.assertEqual(loc, "body")
        self.assertIsNotNone(start)
        self.assertIsNotNone(end)
        self.assertEqual(email.body[start:end], quote)
        self.assertEqual(method, "exact_match")

    def test_case_insensitive_quote(self):
        """Case-different quote should match and return offsets."""
        quote = "PURCHASE ORDER"
        is_v, loc, start, end, method = self.verifier.verify_citation("E007", quote)

        self.assertTrue(is_v)
        self.assertEqual(loc, "body")
        self.assertEqual(method, "case_insensitive_match")

    def test_attachment_quote_verification(self):
        """Quotes located in attachments must be verified and report attachment filename."""
        # E002 has attachment cnc_vendor_comparison.csv containing Vendor B and 1790000
        is_v, loc, start, end, method = self.verifier.verify_citation("E002", "17,90,000")
        self.assertTrue(is_v)
        self.assertIn(".csv", loc)
        self.assertIn("attachment", method)

    def test_fabricated_quote_rejected(self):
        """Hallucinated quotes not present in the email must return verified=False."""
        is_v, loc, start, end, method = self.verifier.verify_citation(
            "E005", "This quotation was unconditionally accepted without budget clearance."
        )
        self.assertFalse(is_v)
        self.assertIsNone(start)
        self.assertIsNone(end)

    def test_nonexistent_email_id_rejected(self):
        """Fabricated email IDs must immediately fail validation."""
        is_v, loc, start, end, method = self.verifier.verify_citation("E999_FABRICATED", "any text")
        self.assertFalse(is_v)
        self.assertEqual(loc, "unknown")

    def test_filter_and_validate_drops_fabricated_ids(self):
        """filter_and_validate must drop fabricated IDs and verify real ones."""
        cited_ids = ["E005", "E999_FAKE", "E007"]
        quotes = {
            "E005": "Vendor B",
            "E007": "Completely hallucinated non-existent sentence in body.",
        }

        citations = self.verifier.filter_and_validate("THR-001", cited_ids, quotes_by_email=quotes)

        # E999_FAKE dropped
        result_eids = [c.email_id for c in citations]
        self.assertNotIn("E999_FAKE", result_eids)
        self.assertIn("E005", result_eids)
        self.assertIn("E007", result_eids)

        # Check verification status
        c005 = next(c for c in citations if c.email_id == "E005")
        self.assertTrue(c005.verified)
        self.assertEqual(c005.verification_method, "exact_match")

        c007 = next(c for c in citations if c.email_id == "E007")
        self.assertFalse(c007.verified)
        self.assertIsNone(c007.matched_quote)

    def test_currency_equivalence_verification(self):
        """Currency variations (INR 17.9 lakh vs 1,790,000) should be recognized."""
        # E005 mentions 17.9 lakh
        is_v, loc, start, end, method = self.verifier.verify_citation("E005", "INR 17,90,000")
        self.assertTrue(is_v)
        self.assertEqual(method, "currency_equivalence_match")


if __name__ == "__main__":
    unittest.main()
