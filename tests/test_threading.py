"""Test suite for Thread Reconstruction and Conversation Ordering."""

import os
import unittest
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.processing.threading import ThreadManager

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))


class TestThreadingModule(unittest.TestCase):
    def setUp(self):
        self.loader = EmailDatasetLoader(DATASET_DIR)
        self.emails = self.loader.load_emails()
        self.threads = ThreadManager.build_threads_from_dataset(self.emails)

    def test_ten_threads_reconstructed(self):
        self.assertEqual(len(self.threads), 10, f"Expected 10 threads, got {len(self.threads)}")

        # Check known thread lengths
        expected_counts = {
            "THR-001": 7,
            "THR-002": 5,
            "THR-003": 6,
            "THR-004": 6,
            "THR-005": 4,
            "THR-006": 6,
            "THR-007": 6,
            "THR-008": 4,
            "THR-009": 4,
            "THR-010": 4,
        }

        for tid, count in expected_counts.items():
            self.assertIn(tid, self.threads, f"Missing {tid}")
            self.assertEqual(self.threads[tid].message_count, count, f"{tid} expected {count} messages, got {self.threads[tid].message_count}")

    def test_chronological_ordering(self):
        for tid, thread in self.threads.items():
            self.assertLessEqual(thread.start_time, thread.last_updated)


if __name__ == "__main__":
    unittest.main()
