"""Zero-dependency test runner using standard library unittest."""

import os
import sys
import unittest

# Ensure sutra is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sutra.ingestion.loader import EmailDatasetLoader
from sutra.ingestion.normalizers import parse_indian_currency
from sutra.processing.threading import ThreadManager
from sutra.evaluation.harness import SutraEvaluator
from tests.test_retrieval import TestEmbeddingAndVectorRetrieval
from tests.test_intelligence import TestConversationIntelligence
from tests.test_generalization import TestGeneralizationIntelligence
from tests.test_deadline_compliance import TestDeadlineComplianceEngine
from tests.test_generalized_intelligence import TestGeneralizedIntelligenceMetamorphic
from tests.test_evaluation_metrics import TestEvaluationMetrics

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))

class TestIngestion(unittest.TestCase):
    def setUp(self):
        self.loader = EmailDatasetLoader(DATASET_DIR)
        self.emails = self.loader.load_emails()

    def test_load_all_emails(self):
        self.assertEqual(len(self.emails), 52)

    def test_attachments_discovered(self):
        emails_with_att = [e for e in self.emails if e.attachments]
        self.assertGreater(len(emails_with_att), 0)
        e007 = next((e for e in self.emails if e.email_id == "E007"), None)
        self.assertIsNotNone(e007)
        self.assertIn("cnc_purchase_order.txt", e007.attachments)

    def test_indian_currency_parsing(self):
        res = parse_indian_currency("Vendor B INR 17.9 lakh")
        self.assertEqual(res[0][0], 1790000.0)

    def test_role_resolution(self):
        e005 = next((e for e in self.emails if e.email_id == "E005"), None)
        self.assertEqual(e005.sender_role, "Dean (Administration)")

class TestThreading(unittest.TestCase):
    def setUp(self):
        self.loader = EmailDatasetLoader(DATASET_DIR)
        self.emails = self.loader.load_emails()
        self.threads = ThreadManager.build_threads_from_dataset(self.emails)

    def test_ten_threads_reconstructed(self):
        self.assertEqual(len(self.threads), 10)

    def test_chronological_ordering(self):
        for tid, t in self.threads.items():
            self.assertLessEqual(t.start_time, t.last_updated)

class TestBenchmark(unittest.TestCase):
    def test_full_benchmark(self):
        evaluator = SutraEvaluator(DATASET_DIR)
        res = evaluator.run_full_benchmark()
        self.assertEqual(res["cases"]["passed_cases"], 9)
        self.assertEqual(res["queries"]["correct_citations"], 15)
        self.assertEqual(res["overall_score"], 100.0)

if __name__ == "__main__":
    unittest.main()

