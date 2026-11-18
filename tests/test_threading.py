"""Test suite for Thread Reconstruction and Conversation Ordering."""

import os
import pytest
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.processing.threading import ThreadManager

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))

def test_ten_threads_reconstructed():
    loader = EmailDatasetLoader(DATASET_DIR)
    emails = loader.load_emails()
    threads = ThreadManager.build_threads_from_dataset(emails)

    assert len(threads) == 10, f"Expected 10 threads, got {len(threads)}"

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
        assert tid in threads, f"Missing {tid}"
        assert threads[tid].message_count == count, f"{tid} expected {count} messages, got {threads[tid].message_count}"

def test_chronological_ordering():
    loader = EmailDatasetLoader(DATASET_DIR)
    emails = loader.load_emails()
    threads = ThreadManager.build_threads_from_dataset(emails)

    for tid, thread in threads.items():
        assert thread.start_time <= thread.last_updated

