"""Unit tests for the IR evaluation metrics suite (PRD §16.4)."""

import unittest
import math
from sutra.evaluation.metrics import (
    recall_at_k,
    precision_at_k,
    mrr_at_k,
    dcg_at_k,
    idcg_at_k,
    ndcg_at_k,
    thread_hit_at_1,
    extract_distinct_document_ids,
)


class TestEvaluationMetrics(unittest.TestCase):

    def test_no_relevant_results(self):
        retrieved = ["E010", "E011", "E012"]
        gold = {"E001", "E002"}
        self.assertEqual(recall_at_k(retrieved, gold, k=3), 0.0)
        self.assertEqual(precision_at_k(retrieved, gold, k=3), 0.0)
        self.assertEqual(mrr_at_k(retrieved, gold, k=3), 0.0)
        self.assertEqual(ndcg_at_k(retrieved, gold, k=3), 0.0)

    def test_one_relevant_result(self):
        retrieved = ["E010", "E001", "E012"]
        gold = {"E001"}
        self.assertEqual(recall_at_k(retrieved, gold, k=3), 1.0)
        self.assertAlmostEqual(precision_at_k(retrieved, gold, k=3), 1.0 / 3.0)
        self.assertEqual(mrr_at_k(retrieved, gold, k=3), 0.5)  # rank 2 -> 1/2
        # DCG = 1 / log2(3), IDCG = 1 / log2(2) = 1.0 -> nDCG = 1 / log2(3)
        expected_ndcg = (1.0 / math.log2(3)) / (1.0 / math.log2(2))
        self.assertAlmostEqual(ndcg_at_k(retrieved, gold, k=3), expected_ndcg)

    def test_multiple_relevant_results_perfect_ranking(self):
        retrieved = ["E001", "E002", "E003"]
        gold = {"E001", "E002"}
        self.assertEqual(recall_at_k(retrieved, gold, k=3), 1.0)
        self.assertAlmostEqual(precision_at_k(retrieved, gold, k=3), 2.0 / 3.0)
        self.assertEqual(mrr_at_k(retrieved, gold, k=3), 1.0)
        self.assertEqual(ndcg_at_k(retrieved, gold, k=3), 1.0)

    def test_reverse_ranking(self):
        # Gold are E001 and E002, ranked at ranks 4 and 5
        retrieved = ["E010", "E011", "E012", "E001", "E002"]
        gold = {"E001", "E002"}
        self.assertEqual(recall_at_k(retrieved, gold, k=5), 1.0)
        self.assertEqual(mrr_at_k(retrieved, gold, k=5), 1.0 / 4.0)
        ndcg_val = ndcg_at_k(retrieved, gold, k=5)
        self.assertGreater(ndcg_val, 0.0)
        self.assertLess(ndcg_val, 1.0)

    def test_duplicate_ids_cannot_inflate_dcg(self):
        # E001 is retrieved at ranks 1, 2, and 3
        retrieved = ["E001", "E001", "E001", "E002", "E003"]
        gold = {"E001"}
        # E001 should only be credited ONCE at rank 1
        ndcg_val = ndcg_at_k(retrieved, gold, k=5)
        self.assertEqual(ndcg_val, 1.0)  # Exactly 1.0, not > 1.0!

    def test_relevant_item_outside_cutoff(self):
        retrieved = ["E010", "E011", "E012", "E013", "E014", "E001"]
        gold = {"E001"}
        # Cutoff k=5 means E001 at rank 6 is excluded
        self.assertEqual(recall_at_k(retrieved, gold, k=5), 0.0)
        self.assertEqual(mrr_at_k(retrieved, gold, k=5), 0.0)
        self.assertEqual(ndcg_at_k(retrieved, gold, k=5), 0.0)

    def test_multiple_chunks_belonging_to_one_email(self):
        class MockChunk:
            def __init__(self, doc_id, email_id):
                self.doc_id = doc_id
                self.metadata = {"email_id": email_id}

        chunks = [
            MockChunk("tab_sum:E046:items.csv", "E046"),
            MockChunk("tab_row:E046:items.csv:0", "E046"),
            MockChunk("tab_row:E046:items.csv:1", "E046"),
            MockChunk("email:E047", "E047"),
        ]
        distinct = extract_distinct_document_ids(chunks, k=5)
        self.assertEqual(distinct, ["E046", "E047"])

    def test_thread_hit_at_1(self):
        self.assertEqual(thread_hit_at_1("THR-001", "THR-001"), 1.0)
        self.assertEqual(thread_hit_at_1("THR-002", "THR-001"), 0.0)
        self.assertEqual(thread_hit_at_1(None, "THR-001"), 0.0)
        self.assertEqual(thread_hit_at_1("", "THR-001"), 0.0)

    def test_empty_edge_cases(self):
        self.assertEqual(recall_at_k([], {"E001"}, k=5), 0.0)
        self.assertEqual(recall_at_k(["E001"], set(), k=5), 1.0)
        self.assertEqual(precision_at_k([], {"E001"}, k=5), 0.0)
        self.assertEqual(mrr_at_k([], {"E001"}, k=5), 0.0)
        self.assertEqual(ndcg_at_k([], {"E001"}, k=5), 0.0)
        self.assertEqual(ndcg_at_k(["E001"], set(), k=5), 1.0)


if __name__ == "__main__":
    unittest.main()
