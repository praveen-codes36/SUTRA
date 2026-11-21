"""Metamorphic and Invariance Test Suite for SUTRA / ANVAYA (PRD §16.4 & §16.5).

Verifies core invariance and transformation guarantees:
1. Entity Substitution: Replacing amounts, dates, or vendor names preserves extraction structure.
2. Email Ordering Invariance: Thread reconstruction and chronological ordering are invariant to arrival permutations.
3. Missing Metadata Robustness: Missing thread_id and in_reply_to headers degrade gracefully to subject clustering.
4. Text & Formatting Variations: Whitespace, case, currency variations (Rs., INR, lakh) are recognized equivalently.
"""

import copy
import os
import random
import unittest
from datetime import datetime

from sutra.ingestion.loader import EmailDatasetLoader
from sutra.ingestion.normalizers import parse_indian_currency, parse_iso_timestamp
from sutra.processing.threading import ThreadManager
from sutra.intelligence.decisions import DecisionExtractor
from sutra.intelligence.evidence import EvidenceValidator, normalize_text_for_matching
from sutra.rag.verifier import CitationVerifier

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))


class TestMetamorphicSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loader = EmailDatasetLoader(DATASET_DIR)
        cls.emails = cls.loader.load_emails()
        cls.emails_by_id = {e.email_id: e for e in cls.emails}

    def test_email_ordering_invariance(self):
        """Thread grouping must be invariant to email input permutation."""
        emails_copy = copy.deepcopy(self.emails)
        random.seed(42)
        random.shuffle(emails_copy)

        threads_original = ThreadManager.build_threads_from_dataset(self.emails)
        threads_shuffled = ThreadManager.build_threads_from_dataset(emails_copy)

        self.assertEqual(len(threads_original), len(threads_shuffled))
        for tid, orig_th in threads_original.items():
            self.assertIn(tid, threads_shuffled)
            shuf_th = threads_shuffled[tid]
            self.assertEqual(orig_th.message_count, shuf_th.message_count)
            # Verify chronological ordering inside thread is identical
            orig_eids = orig_th.email_ids
            shuf_eids = shuf_th.email_ids
            self.assertEqual(orig_eids, shuf_eids, f"Message ordering diverged for thread {tid}")

    def test_missing_metadata_cascade(self):
        """Thread clustering must fall back to subject normalization when thread_id and in_reply_to are stripped."""
        stripped_emails = []
        for e in self.emails:
            e_copy = copy.deepcopy(e)
            e_copy.thread_id = ""
            e_copy.in_reply_to = None
            stripped_emails.append(e_copy)

        reconstructed = ThreadManager.reconstruct_without_thread_ids(stripped_emails)
        # Should reconstruct at least 8 to 10 clusters without crashing
        self.assertGreaterEqual(len(reconstructed), 8)
        total_mapped = sum(len(eids) for eids in reconstructed.values())
        self.assertEqual(total_mapped, len(self.emails))

    def test_entity_substitution_amount_and_vendor(self):
        """Replacing vendor name and financial amount should alter extraction output dynamically."""
        t1_emails = [copy.deepcopy(e) for e in self.emails if e.thread_id == "THR-001"]
        # Substitute Vendor B with 'Apex Machining' and 17.9 lakh with '24.5 lakh'
        for e in t1_emails:
            e.body = e.body.replace("Vendor B", "Apex Machining").replace("17.9 lakh", "24.5 lakh").replace("1,790,000", "2,450,000")
            e.subject = e.subject.replace("Vendor B", "Apex Machining")

        decisions = DecisionExtractor.extract_decisions("THR-001", t1_emails)
        self.assertGreater(len(decisions), 0)
        first_dec = decisions[0].decision
        self.assertIn("Apex Machining", first_dec, "Dynamic vendor extraction failed on substituted entity")
        self.assertEqual(decisions[0].amount_inr, 2450000.0, "Amount extraction failed on substituted currency")

    def test_currency_formatting_robustness(self):
        """Currency parsing and evidence validation must handle INR, Rs., commas, and decimals."""
        variants = [
            "INR 17,90,000",
            "Rs. 17,90,000",
            "INR 17.9 lakh",
            "Rs 17.9 Lakh",
            "17,90,000 INR",
        ]
        parsed_values = []
        for v in variants:
            res = parse_indian_currency(f"The approved tender cost was {v} payable in advance.")
            self.assertTrue(len(res) > 0, f"Failed to parse currency variant: {v}")
            parsed_values.append(res[0][0])

        for val in parsed_values:
            self.assertEqual(val, 1790000.0, f"Value mismatch: got {val}, expected 1790000.0")

    def test_text_normalization_metamorphic(self):
        """Whitespace and punctuation normalization should be invariant under repeated operations."""
        text = "  Vendor   B:   Approved    on  8 September,  2026. \n\t "
        norm1 = normalize_text_for_matching(text)
        norm2 = normalize_text_for_matching(norm1)
        self.assertEqual(norm1, norm2)
        self.assertEqual(norm1, "vendor b approved on 8 september 2026")


if __name__ == "__main__":
    unittest.main()
