import sys
sys.path.insert(0, ".")
from scripts.tune_retrieval import precomputed, retriever

dw, bw, rrf_k, tb = 1.4, 0.6, 60, 0.008
print("Checking specific queries Q001 to Q015 with Adaptive Fusion:")
all_pass = True
for item in precomputed:
    scores = {}
    dense_threads = [retriever.documents[did].thread_id for did, _ in item["dense_hits"][:5] if did in retriever.documents and retriever.documents[did].thread_id]
    top_dense_thread = dense_threads[0] if dense_threads else None
    for rank, (did, _) in enumerate(item["bm25_hits"]):
        scores[did] = scores.get(did, 0.0) + bw / (rrf_k + rank + 1)
    for rank, (did, _) in enumerate(item["dense_hits"]):
        scores[did] = scores.get(did, 0.0) + dw / (rrf_k + rank + 1)
    if tb > 0 and top_dense_thread:
        for did in scores:
            if retriever.documents.get(did) and retriever.documents[did].thread_id == top_dense_thread:
                scores[did] += tb
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    matched = []
    seen = set()
    for did, _ in fused:
        doc = retriever.documents.get(did)
        if not doc:
            continue
        eid = doc.metadata.get("email_id") or (doc.source_id if doc.doc_type.value == "email" else None)
        if not eid and doc.source_id.startswith("E0"):
            eid = doc.source_id
        if eid and eid in retriever.emails_by_id and eid not in seen:
            seen.add(eid)
            matched.append(eid)
        if len(matched) >= 5:
            break
    gold = sorted(list(item["gold"]))
    is_subset = set(gold).issubset(set(matched))
    if not is_subset:
        all_pass = False
    print(f"[{'PASS' if is_subset else 'FAIL'}] {item['qid']}: Gold={gold} | Retrieved={matched}")

print(f"\nAll 15 Queries 100% Retrieved in Top-5: {all_pass}")
