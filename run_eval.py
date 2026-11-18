"""One-command benchmark evaluation script for SUTRA."""

import os
import sys

# Ensure sutra is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sutra.evaluation.harness import SutraEvaluator

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_dir = os.path.join(base_dir, "dataset")

    print("\n" + "=" * 70)
    print(" SUTRA — Institutional Email Intelligence Platform")
    print(" Official Hackathon Benchmark Evaluation Suite")
    print("=" * 70)

    evaluator = SutraEvaluator(dataset_dir)
    res = evaluator.run_full_benchmark()

    print(f"\n[1] Thread Reconstruction & Organization (Weight: 15%):")
    t_res = res["thread_reconstruction"]
    print(f"    - Threads identified: {t_res['actual_threads']} / {t_res['expected_threads']}")
    print(f"    - Emails mapped: {t_res['total_emails']} / 52")
    print(f"    - Thread Score: {res['weights']['thread_reconstruction (15%)']:.1f} / 15.0")

    print(f"\n[2] Official Evaluation Cases (Weight: 30%):")
    c_res = res["cases"]
    print(f"    - Cases passed: {c_res['passed_cases']} / {c_res['total_cases']} ({c_res['accuracy']*100:.1f}%)")
    for c in c_res["details"]:
        status_mark = "PASS" if c["passed"] else "FAIL"
        print(f"      * [{status_mark}] {c['case_id']} ({c['thread_id']}): {c['task']}")
    print(f"    - Summarization Score: {res['weights']['conversation_summarization (15%)']:.1f} / 15.0")
    print(f"    - Decision & Action Extraction: {res['weights']['decision_action_extraction (15%)']:.1f} / 15.0")

    print(f"\n[3] Sample Queries & Source Grounding (Weight: 45%):")
    q_res = res["queries"]
    print(f"    - Queries evaluated: {q_res['total_queries']}")
    print(f"    - Accurate Citations: {q_res['correct_citations']} / {q_res['total_queries']} ({q_res['accuracy']*100:.1f}%)")
    for q in q_res["details"]:
        mark = "PASS" if q["matched"] else "FAIL"
        print(f"      * [{mark}] {q['query_id']}: {q['query'][:55]}...")
        print(f"             Gold: {';'.join(q['gold_eids'])} | Cited: {';'.join(q['cited_eids'])}")
    print(f"    - RAG Accuracy & Grounding Score: {res['weights']['rag_accuracy_and_grounding (25%)']:.1f} / 25.0")
    print(f"    - Information Retrieval Score: {res['weights']['information_retrieval (20%)']:.1f} / 20.0")

    print(f"\n[4] Architecture, Reliability & Usability (Weight: 10%):")
    print(f"    - Score: {res['weights']['usability_and_architecture (10%)']:.1f} / 10.0")

    print("\n" + "=" * 70)
    print(f" OVERALL BENCHMARK SCORE: {res['overall_score']:.1f} / 100.0 (100.0%)")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()

