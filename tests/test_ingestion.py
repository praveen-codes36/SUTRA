"""Test suite for Email and Attachment Ingestion."""

import os
import pytest
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.ingestion.normalizers import parse_indian_currency, clean_email_body

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))

def test_load_all_emails():
    loader = EmailDatasetLoader(DATASET_DIR)
    emails = loader.load_emails()
    assert len(emails) == 52, f"Expected 52 emails, got {len(emails)}"

def test_attachments_discovered():
    loader = EmailDatasetLoader(DATASET_DIR)
    emails = loader.load_emails()
    emails_with_attachments = [e for e in emails if e.attachments]
    assert len(emails_with_attachments) > 0

    # Test CNC PO attachment on E007
    e007 = next((e for e in emails if e.email_id == "E007"), None)
    assert e007 is not None
    assert "cnc_purchase_order.txt" in e007.attachments
    assert "cnc_purchase_order.txt" in e007.attachment_data
    assert "Vendor B" in e007.attachment_data["cnc_purchase_order.txt"].content_text

def test_indian_currency_parsing():
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
        assert len(parsed) > 0, f"Failed to parse currency from: {text}"
        assert abs(parsed[0][0] - expected) < 1e-4, f"Expected {expected}, got {parsed[0][0]} from '{text}'"

def test_role_resolution():
    loader = EmailDatasetLoader(DATASET_DIR)
    emails = loader.load_emails()
    e005 = next((e for e in emails if e.email_id == "E005"), None)
    assert e005.sender_role == "Dean (Administration)"
