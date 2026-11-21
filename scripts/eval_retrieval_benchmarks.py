"""Comprehensive evaluation script comparing DenseFeatureEmbedder vs PretrainedSemanticEmbedder.

Computes:
- Recall@5
- Precision@5
- MRR (Mean Reciprocal Rank)
- nDCG@5 (Normalized Discounted Cumulative Gain)
- Thread-Hit@1
across BM25, Dense, and Hybrid (RRF) modes on official benchmark queries.
"""

import os
import sys
import csv
import math
from typing import List, Dict, Set, Any
import numpy as np

# Ensure sutra is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sutra.ingestion.loader import EmailDatasetLoader
from sutra.processing.threading import ThreadManager
from sutra.intelligence.summarizer import ThreadSummarizer
from sutra.retrieval.hybrid import HybridRetriever
from sutra.retrieval.embedder import (
    DenseFeatureEmbedder,
    PretrainedSemanticEmbedder,
    get_embedder_diagnostics,
)


def dcg_at_k(r: List[int], k: int) -> float:
    r = r[:k]
    if not r:
        return 0.0
    return sum(rel / math.log2(idx + 2) for idx, rel in enumerate(r))


def ndcg_at_k(r: List[int], k: int, num_gold: int) -> float:
    actual_dcg = dcg_at_k(r, k)
    ideal_rels = [1] * min(num_gold, k)
    idcg = dcg_at_k(ideal_rels, k)
    if idcg <= 0:
        return 0.0
    return actual_dcg / idcg


def evaluate_retriever(retriever: HybridRetriever, queries: List[Dict[str, Any]], mode: str, dedup: bool = True) -> Dict[str, float]:
    recalls = []
    precisions = []
    mrrs = []
    ndcgs = []
    thread_hits = []

    for q in queries:
        query_text = q["query"]
        gold_eids = set(q["expected_email_ids"].split(";"))
        expected_thread = q["expected_thread_id"]
        k = 5

        results = retriever.retrieve_results(query_text, top_k=k, mode=mode, dedup_by_source=dedup)

        # Map results to email IDs
        retrieved_eids: List[str] = []
        retrieved_threads: List[str] = []
        for r in results:
            eid = r.metadata.get("email_id") or (r.source_id if r.doc_type.value == "email" else None)
            if not eid and r.source_id.startswith("E0"):
                eid = r.source_id
            retrieved_eids.append(eid)
            retrieved_threads.append(r.thread_id)

        # Thread Hit@1
        top_thread = retrieved_threads[0] if retrieved_threads else None
        thread_hit = 1.0 if top_thread == expected_thread else 0.0
        thread_hits.append(thread_hit)

        # Binary relevance array with strict deduplication (crediting each gold document only once)
        rel_array = []
        seen_gold = set()
        for eid in retrieved_eids:
            if eid and eid in gold_eids and eid not in seen_gold:
                rel_array.append(1)
                seen_gold.add(eid)
            else:
                rel_array.append(0)

        # Precision@5 & Recall@5
        num_retrieved_gold = len(seen_gold)
        recalls.append(num_retrieved_gold / len(gold_eids) if gold_eids else 0.0)
        precisions.append(num_retrieved_gold / k)

        # Reciprocal Rank (MRR)
        rr = 0.0
        for rank_idx, rel in enumerate(rel_array, start=1):
            if rel == 1:
                rr = 1.0 / rank_idx
                break
        mrrs.append(rr)

        # nDCG@5
        ndcgs.append(ndcg_at_k(rel_array, k, len(gold_eids)))

    return {
        "recall@5": float(np.mean(recalls)),
        "precision@5": float(np.mean(precisions)),
        "mrr": float(np.mean(mrrs)),
        "ndcg@5": float(np.mean(ndcgs)),
        "thread_hit@1": float(np.mean(thread_hits)),
    }


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dataset_dir = os.path.join(base_dir, "dataset")

    # Load queries
    queries = []
    with open(os.path.join(dataset_dir, "sample_queries.csv"), encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            queries.append(row)

    print(f"Loaded {len(queries)} evaluation queries from dataset/sample_queries.csv.")

    # Load dataset
    loader = EmailDatasetLoader(dataset_dir)
    emails = loader.load_emails()
    threads = ThreadManager.build_threads_from_dataset(emails)
    summaries = {
        tid: ThreadSummarizer.summarize_thread(tid, [e for e in emails if e.thread_id == tid])
        for tid in threads
    }

    print(f"Loaded {len(emails)} emails and {len(summaries)} threads.")

    # 1. Feature Baseline Embedder
    print("\n" + "=" * 75)
    print(" EVALUATION 1: DenseFeatureEmbedder (Zero-Dependency Structural Baseline)")
    print("=" * 75)
    feature_embedder = DenseFeatureEmbedder(dimension=384)
    retriever_feature = HybridRetriever(emails, summaries, embedder=feature_embedder)

    f_bm25 = evaluate_retriever(retriever_feature, queries, mode="bm25", dedup=True)
    f_dense = evaluate_retriever(retriever_feature, queries, mode="dense", dedup=True)
    f_hybrid = evaluate_retriever(retriever_feature, queries, mode="hybrid", dedup=True)
    f_hybrid_nodedup = evaluate_retriever(retriever_feature, queries, mode="hybrid", dedup=False)

    print(f"BM25 Only:       Recall@5={f_bm25['recall@5']:.4f} | Prec@5={f_bm25['precision@5']:.4f} | MRR={f_bm25['mrr']:.4f} | nDCG@5={f_bm25['ndcg@5']:.4f} | ThreadHit={f_bm25['thread_hit@1']:.4f}")
    print(f"Dense (Feature): Recall@5={f_dense['recall@5']:.4f} | Prec@5={f_dense['precision@5']:.4f} | MRR={f_dense['mrr']:.4f} | nDCG@5={f_dense['ndcg@5']:.4f} | ThreadHit={f_dense['thread_hit@1']:.4f}")
    print(f"Hybrid (Dedup):  Recall@5={f_hybrid['recall@5']:.4f} | Prec@5={f_hybrid['precision@5']:.4f} | MRR={f_hybrid['mrr']:.4f} | nDCG@5={f_hybrid['ndcg@5']:.4f} | ThreadHit={f_hybrid['thread_hit@1']:.4f}")
    print(f"Hybrid (Raw):    Recall@5={f_hybrid_nodedup['recall@5']:.4f} | Prec@5={f_hybrid_nodedup['precision@5']:.4f} | MRR={f_hybrid_nodedup['mrr']:.4f} | nDCG@5={f_hybrid_nodedup['ndcg@5']:.4f} | ThreadHit={f_hybrid_nodedup['thread_hit@1']:.4f}")

    # 2. Pretrained Semantic Embedder (all-MiniLM-L6-v2)
    print("\n" + "=" * 75)
    print(" EVALUATION 2: PretrainedSemanticEmbedder ('all-MiniLM-L6-v2')")
    print("=" * 75)
    pretrained_embedder = PretrainedSemanticEmbedder(model_name="all-MiniLM-L6-v2")
    retriever_pretrained = HybridRetriever(emails, summaries, embedder=pretrained_embedder)

    p_bm25 = evaluate_retriever(retriever_pretrained, queries, mode="bm25", dedup=True)
    p_dense = evaluate_retriever(retriever_pretrained, queries, mode="dense", dedup=True)
    p_hybrid = evaluate_retriever(retriever_pretrained, queries, mode="hybrid", dedup=True)
    p_hybrid_nodedup = evaluate_retriever(retriever_pretrained, queries, mode="hybrid", dedup=False)

    print(f"BM25 Only:          Recall@5={p_bm25['recall@5']:.4f} | Prec@5={p_bm25['precision@5']:.4f} | MRR={p_bm25['mrr']:.4f} | nDCG@5={p_bm25['ndcg@5']:.4f} | ThreadHit={p_bm25['thread_hit@1']:.4f}")
    print(f"Dense (Pretrained): Recall@5={p_dense['recall@5']:.4f} | Prec@5={p_dense['precision@5']:.4f} | MRR={p_dense['mrr']:.4f} | nDCG@5={p_dense['ndcg@5']:.4f} | ThreadHit={p_dense['thread_hit@1']:.4f}")
    print(f"Hybrid (Dedup):     Recall@5={p_hybrid['recall@5']:.4f} | Prec@5={p_hybrid['precision@5']:.4f} | MRR={p_hybrid['mrr']:.4f} | nDCG@5={p_hybrid['ndcg@5']:.4f} | ThreadHit={p_hybrid['thread_hit@1']:.4f}")
    print(f"Hybrid (Raw):       Recall@5={p_hybrid_nodedup['recall@5']:.4f} | Prec@5={p_hybrid_nodedup['precision@5']:.4f} | MRR={p_hybrid_nodedup['mrr']:.4f} | nDCG@5={p_hybrid_nodedup['ndcg@5']:.4f} | ThreadHit={p_hybrid_nodedup['thread_hit@1']:.4f}")

    print("\n" + "=" * 75)
    print(" COMPARISON & TARGET VERIFICATION (PRD §16.4)")
    print("=" * 75)
    print(f"{'Metric':<18} | {'PRD Target':<12} | {'Dense Baseline':<16} | {'Pretrained (all-MiniLM-L6-v2)':<28} | {'Delta':<10}")
    print("-" * 92)
    metrics_spec = [
        ("Recall@5", ">= 0.90", f_hybrid["recall@5"], p_hybrid["recall@5"]),
        ("MRR", ">= 0.80", f_hybrid["mrr"], p_hybrid["mrr"]),
        ("nDCG@5", ">= 0.85", f_hybrid["ndcg@5"], p_hybrid["ndcg@5"]),
        ("Thread-Hit@1", ">= 0.95", f_hybrid["thread_hit@1"], p_hybrid["thread_hit@1"]),
    ]
    for name, target, base_val, pre_val in metrics_spec:
        delta = pre_val - base_val
        delta_str = f"+{delta:.4f}" if delta >= 0 else f"{delta:.4f}"
        print(f"{name:<18} | {target:<12} | {base_val:<16.4f} | {pre_val:<28.4f} | {delta_str:<10}")

    print("\nDiagnostics:")
    print("Feature:", get_embedder_diagnostics(feature_embedder))
    print("Pretrained:", get_embedder_diagnostics(pretrained_embedder))


if __name__ == "__main__":
    main()
