import os
import sys
import csv
import math
sys.path.insert(0, ".")
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.processing.threading import ThreadManager
from sutra.intelligence.summarizer import ThreadSummarizer
from sutra.retrieval.hybrid import HybridRetriever
from sutra.retrieval.embedder import PretrainedSemanticEmbedder

loader = EmailDatasetLoader("dataset")
emails = loader.load_emails()
threads = ThreadManager.build_threads_from_dataset(emails)
summaries = {tid: ThreadSummarizer.summarize_thread(tid, [e for e in emails if e.thread_id == tid]) for tid in threads}
retriever = HybridRetriever(emails, summaries, embedder=PretrainedSemanticEmbedder())
queries = list(csv.DictReader(open("dataset/sample_queries.csv", encoding="utf-8-sig")))

print("--- DENSE-ONLY RETRIEVAL FOR ALL 15 QUERIES ---")
for q in queries:
    hits = retriever.retrieve_dense(q["query"], top_k=7)
    eids = []
    seen = set()
    for h in hits:
        eid = h[0].metadata.get("email_id") or h[0].source_id
        if eid not in seen:
            seen.add(eid)
            eids.append((eid, h[0].thread_id, round(h[1], 4)))
    gold = set(q["expected_email_ids"].split(";"))
    print(f"{q['query_id']} ({q['expected_thread_id']}): Gold={gold}")
    print(f"   Dense: {eids[:5]}")
