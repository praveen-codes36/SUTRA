"""Reciprocal Rank Fusion (RRF) for combining ranked retrieval result lists.

Adapted from mailrag (src/query/fusion.py), licensed under Apache-2.0.
"""

from typing import List, Dict, Tuple, Optional, Any

def reciprocal_rank_fusion(
    ranked_lists: List[List[str]],
    weights: Optional[List[float]] = None,
    k: int = 60,
    top_n: int = 10,
    bonus_scores: Optional[Dict[str, float]] = None,
) -> List[Tuple[str, float]]:
    """
    Weighted Reciprocal Rank Fusion with optional score adjustment:
    Score(d) = sum_{i, list in enumerate(ranked_lists)} weights[i] * (1 / (k + rank(d) + 1)) + bonus(d)
    """
    scores: Dict[str, float] = {}
    if weights is None:
        weights = [1.0] * len(ranked_lists)
    elif len(weights) != len(ranked_lists):
        raise ValueError(f"Length of weights ({len(weights)}) must match ranked_lists ({len(ranked_lists)})")

    for r_list, w in zip(ranked_lists, weights):
        for rank, doc_id in enumerate(r_list):
            if doc_id not in scores:
                scores[doc_id] = 0.0
            scores[doc_id] += float(w) / (k + rank + 1)

    if bonus_scores:
        for doc_id, bonus in bonus_scores.items():
            if doc_id in scores:
                scores[doc_id] += float(bonus)

    # Sort descending by score, breaking ties deterministically by doc_id
    sorted_results = sorted(scores.items(), key=lambda x: (x[1], x[0]), reverse=True)
    return sorted_results[:top_n]

