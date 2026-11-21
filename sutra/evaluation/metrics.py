"""Standard Information Retrieval and Evaluation Metrics for ANVAYA (PRD §16.4).

Provides mathematically rigorous, audited implementations of:
- Recall@K
- Precision@K
- MRR@K (Mean Reciprocal Rank)
- DCG@K and IDCG@K
- nDCG@K (Normalized Discounted Cumulative Gain)
- Thread-Hit@1
"""

from __future__ import annotations
import math
from typing import List, Set, Sequence, Any, Optional, Dict


def extract_distinct_document_ids(
    retrieved_items: Sequence[Any],
    k: Optional[int] = None,
) -> List[str]:
    """
    Extract distinct document/email identifiers from retrieved items.
    Handles raw strings, objects with .email_id, or objects with .source_id / .metadata['email_id'].
    Ensures that multiple chunks from the same document are credited only once.
    """
    distinct: List[str] = []
    seen: Set[str] = set()

    for item in retrieved_items:
        doc_id: Optional[str] = None
        if isinstance(item, str):
            doc_id = item
        elif hasattr(item, "email_id"):
            doc_id = getattr(item, "email_id")
        elif hasattr(item, "metadata") and isinstance(getattr(item, "metadata"), dict):
            meta = getattr(item, "metadata")
            doc_id = meta.get("email_id") or getattr(item, "source_id", None) or getattr(item, "doc_id", None)
        elif hasattr(item, "source_id"):
            doc_id = getattr(item, "source_id")
        elif hasattr(item, "doc_id"):
            doc_id = getattr(item, "doc_id")

        if doc_id and doc_id not in seen:
            seen.add(doc_id)
            distinct.append(doc_id)
            if k is not None and len(distinct) >= k:
                break

    return distinct


def recall_at_k(
    retrieved_ids: Sequence[str],
    gold_ids: Set[str] | Sequence[str],
    k: int = 5,
) -> float:
    """
    Recall@K = |Relevant ∩ Retrieved@K| / |Relevant|
    
    Requirements:
    - If gold_ids is empty, returns 1.0 (vacuously complete).
    - If retrieved_ids is empty, returns 0.0.
    - Duplicate retrieved IDs count only once towards relevant set.
    """
    gold_set = set(gold_ids)
    if not gold_set:
        return 1.0

    top_k_items = retrieved_ids[:k]
    # Unique relevant retrieved items
    relevant_retrieved = set(top_k_items).intersection(gold_set)
    return float(len(relevant_retrieved) / len(gold_set))


def precision_at_k(
    retrieved_ids: Sequence[str],
    gold_ids: Set[str] | Sequence[str],
    k: int = 5,
) -> float:
    """
    Precision@K = |Relevant ∩ Retrieved@K| / K
    """
    if k <= 0:
        return 0.0
    gold_set = set(gold_ids)
    if not gold_set:
        return 0.0

    top_k_items = retrieved_ids[:k]
    relevant_retrieved = set(top_k_items).intersection(gold_set)
    return float(len(relevant_retrieved) / k)


def mrr_at_k(
    retrieved_ids: Sequence[str],
    gold_ids: Set[str] | Sequence[str],
    k: int = 5,
) -> float:
    """
    Mean Reciprocal Rank (MRR@K):
    Reciprocal rank of the first relevant document appearing in the top-K.
    If no relevant document appears within rank K, returns 0.0.
    """
    gold_set = set(gold_ids)
    if not gold_set:
        return 0.0

    top_k_items = retrieved_ids[:k]
    for rank, doc_id in enumerate(top_k_items, start=1):
        if doc_id in gold_set:
            return 1.0 / rank
    return 0.0


def dcg_at_k(relevance_scores: Sequence[float | int], k: int = 5) -> float:
    """
    Standard Discounted Cumulative Gain:
    DCG@K = sum_{i=1}^K (2^{rel_i} - 1) / log2(i + 1)
    For binary relevance (rel_i in {0, 1}):
    2^{rel_i} - 1 simplifies exactly to rel_i.
    """
    score = 0.0
    for i, rel in enumerate(relevance_scores[:k], start=1):
        if rel > 0:
            gain = (math.pow(2.0, float(rel)) - 1.0)
            discount = math.log2(i + 1)
            score += gain / discount
    return score


def idcg_at_k(gold_count: int, k: int = 5) -> float:
    """
    Ideal Discounted Cumulative Gain (IDCG@K):
    The DCG of a perfect ranking where all relevant documents are ranked at the top.
    """
    ideal_count = min(gold_count, k)
    if ideal_count <= 0:
        return 0.0
    ideal_rels = [1.0] * ideal_count
    return dcg_at_k(ideal_rels, k=k)


def ndcg_at_k(
    retrieved_ids: Sequence[str],
    gold_ids: Set[str] | Sequence[str],
    k: int = 5,
) -> float:
    """
    Normalized Discounted Cumulative Gain (nDCG@K):
    nDCG@K = DCG@K / IDCG@K
    
    Guarantees:
    - Strictly bounded in [0.0, 1.0].
    - Duplicate documents in retrieved_ids are credited only once (subsequent occurrences have gain 0).
    - If gold_ids is empty, returns 1.0 (empty target).
    - If IDCG is 0, returns 0.0.
    """
    gold_set = set(gold_ids)
    if not gold_set:
        return 1.0

    top_k_items = retrieved_ids[:k]
    if not top_k_items:
        return 0.0

    # Binary relevance vector with deduplication
    relevance_scores: List[float] = []
    seen_gold: Set[str] = set()
    for doc_id in top_k_items:
        if doc_id in gold_set and doc_id not in seen_gold:
            relevance_scores.append(1.0)
            seen_gold.add(doc_id)
        else:
            relevance_scores.append(0.0)

    actual_dcg = dcg_at_k(relevance_scores, k=k)
    ideal_dcg = idcg_at_k(len(gold_set), k=k)

    if ideal_dcg <= 0.0:
        return 0.0

    ndcg_val = actual_dcg / ideal_dcg
    # Guard against float rounding exceeding 1.0
    return min(max(ndcg_val, 0.0), 1.0)


def thread_hit_at_1(
    top_retrieved_thread_id: Optional[str],
    expected_thread_id: str,
) -> float:
    """
    Thread-Hit@1:
    1.0 if the top retrieved result belongs to the expected conversation thread, else 0.0.
    """
    if not top_retrieved_thread_id or not expected_thread_id:
        return 0.0
    return 1.0 if top_retrieved_thread_id == expected_thread_id else 0.0
