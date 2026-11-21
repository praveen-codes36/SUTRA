"""Export machine-readable evaluation artifacts for ANVAYA audit reproducibility."""

import os
import sys
import json
import csv
from datetime import datetime

sys.path.insert(0, ".")
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.processing.threading import ThreadManager
from sutra.intelligence.summarizer import ThreadSummarizer
from sutra.retrieval.hybrid import HybridRetriever
from sutra.retrieval.embedder import PretrainedSemanticEmbedder, get_embedder_diagnostics
from sutra.evaluation.harness import SutraEvaluator
from sutra.evaluation.metrics import (
    recall_at_k,
    precision_at_k,
    mrr_at_k,
    ndcg_at_k,
    thread_hit_at_1,
    extract_distinct_document_ids,
)

os.makedirs("reports/artifacts", exist_ok=True)

# 1. Dataset & Components
loader = EmailDatasetLoader("dataset")
emails = loader.load_emails()
threads = ThreadManager.build_threads_from_dataset(emails)
summaries = {tid: ThreadSummarizer.summarize_thread(tid, [e for e in emails if e.thread_id == tid]) for tid in threads}
embedder = PretrainedSemanticEmbedder()
retriever = HybridRetriever(emails, summaries, embedder=embedder)

queries = list(csv.DictReader(open("dataset/sample_queries.csv", encoding="utf-8-sig")))

query_eval_results = []
recalls, precs, mrrs, ndcgs, thits = [], [], [], [], []

for q in queries:
    qid = q["query_id"]
    query_text = q["query"]
    gold = [x.strip() for x in q["expected_email_ids"].split(";") if x.strip()]
    exp_tid = q["expected_thread_id"]

    matched_emails, matched_sums = retriever.retrieve(query_text, top_k=5)
    ret_eids = [e.email_id for e in matched_emails]
    top_t = matched_emails[0].thread_id if matched_emails else (matched_sums[0].thread_id if matched_sums else "NONE")

    rec = recall_at_k(ret_eids, gold, k=5)
    prec = precision_at_k(ret_eids, gold, k=5)
    mrr = mrr_at_k(ret_eids, gold, k=5)
    ndcg = ndcg_at_k(ret_eids, gold, k=5)
    thit = thread_hit_at_1(top_t, exp_tid)

    recalls.append(rec)
    precs.append(prec)
    mrrs.append(mrr)
    ndcgs.append(ndcg)
    thits.append(thit)

    query_eval_results.append({
        "query_id": qid,
        "query": query_text,
        "expected_thread_id": exp_tid,
        "retrieved_top_thread": top_t,
        "thread_hit": bool(thit == 1.0),
        "gold_email_ids": gold,
        "retrieved_email_ids": ret_eids,
        "metrics": {
            "recall@5": round(rec, 4),
            "precision@5": round(prec, 4),
            "mrr@5": round(mrr, 4),
            "ndcg@5": round(ndcg, 4),
        }
    })

summary_metrics = {
    "evaluation_timestamp": datetime.now().isoformat(),
    "dataset_size": len(emails),
    "total_queries": len(queries),
    "embedder_diagnostics": get_embedder_diagnostics(embedder),
    "retrieval_configuration": {
        "rrf_k": retriever.rrf_k,
        "dense_weight": retriever.dense_weight,
        "bm25_weight": retriever.bm25_weight,
        "thread_coherence_boost": retriever.thread_coherence_boost,
    },
    "macro_averages": {
        "recall@5": round(sum(recalls) / len(recalls), 4),
        "precision@5": round(sum(precs) / len(precs), 4),
        "mrr@5": round(sum(mrrs) / len(mrrs), 4),
        "ndcg@5": round(sum(ndcgs) / len(ndcgs), 4),
        "thread_hit@1": round(sum(thits) / len(thits), 4),
    },
    "per_query_results": query_eval_results,
}

with open("reports/artifacts/final_retrieval_metrics.json", "w", encoding="utf-8") as f:
    json.dump(summary_metrics, f, indent=2)

# 2. Official Full Benchmark Artifact
evaluator = SutraEvaluator("dataset")
bench_res = evaluator.run_full_benchmark()

with open("reports/artifacts/benchmark_results.json", "w", encoding="utf-8") as f:
    json.dump(bench_res, f, indent=2)

print("Saved reports/artifacts/final_retrieval_metrics.json")
print("Saved reports/artifacts/benchmark_results.json")
print("Macro averages:", summary_metrics["macro_averages"])
