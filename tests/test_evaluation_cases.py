"""Test suite for Official Evaluation Cases and Sample Queries."""

import os
import unittest
from sutra.evaluation.harness import SutraEvaluator

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))


class TestEvaluationCases(unittest.TestCase):
    def test_full_benchmark_execution(self):
        evaluator = SutraEvaluator(DATASET_DIR)
        results = evaluator.run_full_benchmark()

        # 1. Thread reconstruction
        self.assertTrue(results["thread_reconstruction"]["passed"])
        self.assertEqual(results["thread_reconstruction"]["actual_threads"], 10)

        # 2. Official Evaluation Cases
        self.assertEqual(results["cases"]["accuracy"], 1.0, f"Expected 100% case accuracy, got {results['cases']['accuracy']}")
        self.assertEqual(results["cases"]["passed_cases"], 9)

        # 3. Sample Queries
        self.assertEqual(results["queries"]["accuracy"], 1.0, f"Expected 100% query citation accuracy, got {results['queries']['accuracy']}")
        self.assertEqual(results["queries"]["correct_citations"], 15)

        # 4. Overall weighted score
        self.assertGreaterEqual(results["overall_score"], 95.0, f"Expected overall score >= 95%, got {results['overall_score']}")


if __name__ == "__main__":
    unittest.main()
