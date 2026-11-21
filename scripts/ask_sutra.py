#!/usr/bin/env python
"""
Interactive CLI for ANVAYA / SUTRA.
Allows querying the institutional intelligence engine directly from the command line.

Usage:
    python scripts/ask_sutra.py
    python scripts/ask_sutra.py "What was the final decision on the CNC machine procurement?"
"""

import os
import sys

# Ensure repository root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sutra.evaluation.harness import SutraEvaluator


def print_answer(ans):
    print("\n" + "=" * 70)
    print(" SUTRA INTELLIGENCE ANSWER")
    print("=" * 70)
    print(f"\n{ans.answer}\n")

    if ans.direct_decision:
        print(f"• Decision: {ans.direct_decision}")
    if ans.approver:
        print(f"• Approver: {ans.approver}")
    if ans.amount_inr:
        print(f"• Amount: INR {ans.amount_inr:,.0f}")
    if ans.pending_action:
        print(f"• Pending Action: {ans.pending_action}")

    print("\n" + "-" * 70)
    print(f"Source Grounding Citations: {', '.join(ans.cited_email_ids) if ans.cited_email_ids else 'None'}")
    if ans.citations:
        print("\nVerbatim Excerpts:")
        for idx, cit in enumerate(ans.citations, 1):
            print(f"  [{idx}] (Email {cit.email_id}, Thread {cit.thread_id})")
            print(f"      \"{cit.evidence_text}\"")

    if ans.abstained:
        print("\n⚠️ Notice: Model abstained due to lack of verifiable evidence.")
    print("=" * 70 + "\n")


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dataset_dir = os.path.join(base_dir, "dataset")

    print("\nLoading ANVAYA Knowledge Engine & Pretrained Embeddings...")
    evaluator = SutraEvaluator(dataset_dir)
    engine = evaluator.engine
    print("✓ Knowledge Engine Ready! (10 threads, 52 emails, dense vector embeddings active)\n")

    # If query was passed via command line arguments
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        print(f"Query: {query}")
        ans = engine.answer_query(query)
        print_answer(ans)
        return

    # Interactive prompt loop
    print("Type your question below (or 'exit' / 'quit' to quit):")
    print("Sample queries to try:")
    print("  1. What was the final decision on the CNC machine procurement?")
    print("  2. What was the final cost to repair the UTM and when was it completed?")
    print("  3. Which venues are approved for the annual technical fest?")
    print("  4. What documents are required for a bonafide certificate?")
    print("  5. Did the Manufacturing Processes examination date change?\n")

    while True:
        try:
            query = input("Ask SUTRA > ").strip()
            if not query:
                continue
            if query.lower() in ("exit", "quit", "q"):
                print("Goodbye!")
                break
            ans = engine.answer_query(query)
            print_answer(ans)
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
