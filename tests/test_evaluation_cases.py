"""Test suite for Official Evaluation Cases and Sample Queries."""

import os
import pytest
from sutra.evaluation.harness import SutraEvaluator

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))

def test_full_benchmark_execution():
    evaluator = SutraEvaluator(DATASET_DIR)
    results = evaluator.run_full_benchmark()

    # 1. Thread reconstruction
    assert results["thread_reconstruction"]["passed"] is True
    assert results["thread_reconstruction"]["actual_threads"] == 10

    # 2. Official Evaluation Cases
    assert results["cases"]["accuracy"] == 1.0, f"Expected 100% case accuracy, got {results['cases']['accuracy']}"
    assert results["cases"]["passed_cases"] == 9

    # 3. Sample Queries
    assert results["queries"]["accuracy"] == 1.0, f"Expected 100% query citation accuracy, got {results['queries']['accuracy']}"
    assert results["queries"]["correct_citations"] == 15

    # 4. Overall weighted score
    assert results["overall_score"] >= 95.0, f"Expected overall score >= 95%, got {results['overall_score']}"

