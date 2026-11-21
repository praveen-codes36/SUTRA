"""Test suite for Email and Attachment Ingestion."""

import os
import unittest
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.ingestion.normalizers import parse_indian_currency, clean_email_body

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))


class TestIngestionModule(unittest.TestCase):
    def setUp(self):
        self.loader = EmailDatasetLoader(DATASET_DIR)
        self.emails = self.loader.load_emails()

    def test_load_all_emails(self):
        self.assertEqual(len(self.emails), 52, f"Expected 52 emails, got {len(self.emails)}")

    def test_attachments_discovered(self):
        emails_with_attachments = [e for e in self.emails if e.attachments]
        self.assertGreater(len(emails_with_attachments), 0)

        # Test CNC PO attachment on E007
        e007 = next((e for e in self.emails if e.email_id == "E007"), None)
        self.assertIsNotNone(e007)
        self.assertIn("cnc_purchase_order.txt", e007.attachments)
        self.assertIn("cnc_purchase_order.txt", e007.attachment_data)
        self.assertIn("Vendor B", e007.attachment_data["cnc_purchase_order.txt"].content_text)

    def test_indian_currency_parsing(self):
        cases = [
            ("Vendor B INR 17.9 lakh", 1790000.0),
            ("estimate is INR 28,000, excluding parts", 28000.0),
            ("Replacement quote is INR 6,500", 6500.0),
            ("totals INR 3.42 lakh for sensors", 342000.0),
            ("INR 3.5 lakh for consumables", 350000.0),
            ("total INR 59,000", 59000.0),
            ("eligible reimbursement is INR 24,650", 24650.0),
        ]
        for text, expected in cases:
            parsed = parse_indian_currency(text)
            self.assertGreater(len(parsed), 0, f"Failed to parse currency from: {text}")
            self.assertAlmostEqual(parsed[0][0], expected, delta=1e-4, msg=f"Expected {expected}, got {parsed[0][0]} from '{text}'")

    def test_role_resolution(self):
        e005 = next((e for e in self.emails if e.email_id == "E005"), None)
        self.assertIsNotNone(e005)
        self.assertEqual(e005.sender_role, "Dean (Administration)")

    def test_timestamp_robustness(self):
        from sutra.ingestion.normalizers import parse_iso_timestamp
        # Standard ISO
        dt1 = parse_iso_timestamp("2026-09-08T14:30:00Z")
        self.assertEqual(dt1.year, 2026)
        # Space-separated
        dt2 = parse_iso_timestamp("2026-09-08 14:30:00")
        self.assertEqual(dt2.month, 9)
        # Slash-separated
        dt3 = parse_iso_timestamp("2026/09/08")
        self.assertEqual(dt3.day, 8)
        # Empty string fallback
        dt_fallback = parse_iso_timestamp("")
        self.assertEqual(dt_fallback.year, 1970)

    def test_clean_email_body_unicode_and_zero_width(self):
        raw = "\u200bअनुमोदन प्राप्त हो गया है।\n\r\n\rApproved and verified.\ufeff\n\n\n\nFinal."
        cleaned = clean_email_body(raw)
        self.assertNotIn("\u200b", cleaned)
        self.assertNotIn("\ufeff", cleaned)
        self.assertIn("अनुमोदन", cleaned)
        self.assertIn("Approved and verified.", cleaned)
        self.assertNotIn("\n\n\n", cleaned)


if __name__ == "__main__":
    unittest.main()
