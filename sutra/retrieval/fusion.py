"""Reciprocal Rank Fusion (RRF) for combining ranked retrieval result lists.

Adapted from mailrag (src/query/fusion.py), licensed under Apache-2.0.
"""

from typing import List, Dict, Tuple, Any

def reciprocal_rank_fusion(
    ranked_lists: List[List[str]],
    k: int = 60,
    top_n: int = 10,
) -> List[Tuple[str, float]]:
    """
    Standard Reciprocal Rank Fusion:
    Score(d) = sum_{list in ranked_lists} (1 / (k + rank(d) + 1))
    """
    scores: Dict[str, float] = {}

    for r_list in ranked_lists:
        for rank, doc_id in enumerate(r_list):
            if doc_id not in scores:
                scores[doc_id] = 0.0
            scores[doc_id] += 1.0 / (k + rank + 1)

    sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_results[:top_n]

