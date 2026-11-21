"""Unit and regression tests for CitationVerifier (PRD §16.3 & §16.4).

Verifies strict provenance validation across the full 14-scenario adversarial matrix:
1. Valid email ID and exact quotation -> PASS
2. Fabricated email ID -> REJECT
3. Valid email ID, fabricated quotation -> REJECT
4. Correct quotation from wrong email -> REJECT
5. Altered numerical amount -> REJECT
6. Altered date -> REJECT
7. Wrong vendor -> REJECT
8. Empty quotation -> REJECT
9. Attachment quotation -> PASS if source exists
10. Minor whitespace differences -> PASS if genuinely equivalent
11. Minor punctuation differences -> PASS if genuinely equivalent
12. Unsupported claim with valid quote -> FLAGGED / Documented limitation
13. Repeated quotation -> Correct occurrence offsets
14. Fabricated attachment reference -> REJECT
"""

import os
import unittest
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.rag.verifier import CitationVerifier
from sutra.intelligence.evidence import EvidenceValidator

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))


class TestCitationVerifier(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loader = EmailDatasetLoader(DATASET_DIR)
        cls.emails = cls.loader.load_emails()
        cls.emails_by_id = {e.email_id: e for e in cls.emails}
        cls.verifier = CitationVerifier(cls.emails_by_id)
        cls.evidence_validator = EvidenceValidator(cls.emails)

    def test_01_authentic_exact_quote(self):
        """Scenario 1: Valid email ID and exact quotation -> PASS."""
        email = self.emails_by_id["E005"]
        quote = "Approved"
        is_v, loc, start, end, method = self.verifier.verify_citation("E005", quote)

        self.assertTrue(is_v)
        self.assertEqual(loc, "body")
        self.assertIsNotNone(start)
        self.assertIsNotNone(end)
        self.assertEqual(email.body[start:end], quote)
        self.assertEqual(method, "exact_match")

    def test_02_fabricated_email_id(self):
        """Scenario 2: Fabricated email ID -> REJECT."""
        is_v, loc, start, end, method = self.verifier.verify_citation("E999_FABRICATED", "any text")
        self.assertFalse(is_v)
        self.assertEqual(loc, "unknown")
        self.assertIsNone(start)

    def test_03_valid_id_fabricated_quotation(self):
        """Scenario 3: Valid email ID, fabricated quotation -> REJECT."""
        is_v, loc, start, end, method = self.verifier.verify_citation(
            "E005", "This quotation was unconditionally accepted without budget clearance."
        )
        self.assertFalse(is_v)
        self.assertIsNone(start)

    def test_04_correct_quotation_from_wrong_email(self):
        """Scenario 4: Correct quotation from wrong email -> REJECT."""
        # 'Dean (Administration)' appears in E005, not in E009 (Registrar bonafide)
        is_v, loc, start, end, method = self.verifier.verify_citation(
            "E009", "Dean (Administration) approved the file"
        )
        self.assertFalse(is_v)

    def test_05_altered_numerical_amount(self):
        """Scenario 5: Altered numerical amount -> REJECT."""
        # E005 has INR 17.9 lakh (1,790,000)
        # Non-equivalent: INR 18.9 lakh, INR 179,000
        is_v_18, _, _, _, _ = self.verifier.verify_citation("E005", "INR 18.9 lakh")
        self.assertFalse(is_v_18, "Altered amount 18.9 lakh must be rejected!")

        is_v_179k, _, _, _, _ = self.verifier.verify_citation("E005", "INR 179,000")
        self.assertFalse(is_v_179k, "Altered amount 179,000 (10x smaller) must be rejected!")

    def test_06_altered_date(self):
        """Scenario 6: Altered date -> REJECT."""
        # E005 has 8 September 2026
        is_v, _, _, _, _ = self.verifier.verify_citation("E005", "approved on 18 September 2026")
        self.assertFalse(is_v)

    def test_07_wrong_vendor(self):
        """Scenario 7: Wrong vendor -> REJECT."""
        # E005 has Vendor B approved
        is_v, _, _, _, _ = self.verifier.verify_citation("E005", "Vendor A was approved")
        self.assertFalse(is_v)

    def test_08_empty_quotation(self):
        """Scenario 8: Empty quotation -> REJECT."""
        is_v1, _, _, _, _ = self.verifier.verify_citation("E005", "")
        is_v2, _, _, _, _ = self.verifier.verify_citation("E005", "    ")
        self.assertFalse(is_v1)
        self.assertFalse(is_v2)

    def test_09_attachment_quotation(self):
        """Scenario 9: Attachment quotation -> PASS if source exists."""
        # E002 has attachment cnc_vendor_comparison.csv containing Vendor B and 1790000
        is_v, loc, start, end, method = self.verifier.verify_citation("E002", "17,90,000")
        self.assertTrue(is_v)
        self.assertIn(".csv", loc)
        self.assertIn("attachment", method)

    def test_10_minor_whitespace_differences(self):
        """Scenario 10: Minor whitespace differences -> PASS."""
        quote = "Approved.   Proceed    with   Vendor  B"
        is_v, loc, start, end, method = self.verifier.verify_citation("E005", quote)
        self.assertTrue(is_v)
        self.assertIn("match", method)

    def test_11_minor_punctuation_differences(self):
        """Scenario 11: Minor punctuation differences -> PASS."""
        quote = "Approved Proceed with Vendor B"
        is_v, loc, start, end, method = self.verifier.verify_citation("E005", quote)
        self.assertTrue(is_v)

    def test_12_unsupported_claim_with_valid_quote_distinction(self):
        """
        Scenario 12: Unsupported claim with valid quote.
        Quoting an authentic figure (e.g. INR 3.42 lakh) while making an unauthorized purchase claim
        is guarded at the Layer 3 evidence validation level.
        """
        # Test EvidenceValidator detects conditionality/planning vs authorization
        is_valid, reason, conf = self.evidence_validator.validate_reference(
            source_id="E047",
            thread_id="THR-009",
            excerpt="Direct purchase is authorized for INR 3.42 lakh consumables"
        )
        self.assertFalse(is_valid, "EvidenceValidator must reject purchase authorization claim on budget planning email")
        self.assertTrue(any(w in (reason or "").lower() for w in ["conditional", "planning", "approvals", "procurement"]))

    def test_13_repeated_quotation_offsets(self):
        """Scenario 13: Offsets refer to authentic source substring."""
        email = self.emails_by_id["E007"]
        quote = "purchase order"
        is_v, loc, start, end, method = self.verifier.verify_citation("E007", quote)
        self.assertTrue(is_v)
        self.assertEqual(email.body[start:end].lower(), quote.lower())

    def test_14_fabricated_attachment_reference(self):
        """Scenario 14: Fabricated attachment reference -> REJECT."""
        is_v, loc, _, _, _ = self.verifier.verify_citation("E005", "nonexistent_financial_audit_2026.pdf")
        self.assertFalse(is_v)

    def test_currency_equivalence_representations(self):
        """Test Indian currency unit conversions and representations."""
        # E005 mentions '17.9 lakh'
        # Equivalent representations:
        self.assertTrue(self.verifier.verify_citation("E005", "INR 17,90,000")[0])
        self.assertTrue(self.verifier.verify_citation("E005", "Rs. 17,90,000")[0])
        self.assertTrue(self.verifier.verify_citation("E005", "17.9 lakh")[0])

    def test_filter_and_validate_drops_fabricated_ids(self):
        """filter_and_validate must drop fabricated IDs and verify real ones."""
        cited_ids = ["E005", "E999_FAKE", "E007"]
        quotes = {
            "E005": "Vendor B",
            "E007": "Completely hallucinated non-existent sentence in body.",
        }

        citations = self.verifier.filter_and_validate("THR-001", cited_ids, quotes_by_email=quotes)

        result_eids = [c.email_id for c in citations]
        self.assertNotIn("E999_FAKE", result_eids)
        self.assertIn("E005", result_eids)
        self.assertIn("E007", result_eids)

        c005 = next(c for c in citations if c.email_id == "E005")
        self.assertTrue(c005.verified)

        c007 = next(c for c in citations if c.email_id == "E007")
        self.assertFalse(c007.verified)
        self.assertIsNone(c007.matched_quote)


if __name__ == "__main__":
    unittest.main()
