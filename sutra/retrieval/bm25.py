"""BM25 keyword search engine for precise entity, ID, and term matching."""

import re
import math
from typing import List, Dict, Tuple, Set
from collections import Counter

def tokenize(text: str) -> List[str]:
    """Tokenize text into lowercase alphanumeric terms and special email identifiers."""
    # Preserve tokens like THR-001, E005, numbers with commas/decimals
    raw_tokens = re.findall(r"[A-Za-z0-9_\-\.]+", text.lower())
    clean: List[str] = []
    for t in raw_tokens:
        clean.append(t)
        # Also split hyphens if compound (e.g. thr-001 -> thr, 001)
        if "-" in t:
            clean.extend(t.split("-"))
    return clean

class BM25Index:
    """In-memory BM25Okapi search engine."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_ids: List[str] = []
        self.doc_tokens: List[List[str]] = []
        self.doc_lens: List[int] = []
        self.avg_doc_len: float = 0.0
        self.df: Counter = Counter()
        self.idf: Dict[str, float] = {}
        self.corpus_size: int = 0

    def fit(self, doc_ids: List[str], texts: List[str]):
        """Index a corpus of document texts."""
        self.doc_ids = doc_ids
        self.corpus_size = len(texts)
        self.doc_tokens = []
        self.doc_lens = []
        self.df = Counter()

        for text in texts:
            tokens = tokenize(text)
            self.doc_tokens.append(tokens)
            self.doc_lens.append(len(tokens))
            unique_tokens = set(tokens)
            for t in unique_tokens:
                self.df[t] += 1

        self.avg_doc_len = sum(self.doc_lens) / max(self.corpus_size, 1)

        # Precompute IDF
        self.idf = {}
        for term, freq in self.df.items():
            # BM25 standard IDF with smoothing
            val = math.log((self.corpus_size - freq + 0.5) / (freq + 0.5) + 1.0)
            self.idf[term] = max(val, 0.01)

    def search(self, query: str, top_n: int = 10) -> List[Tuple[str, float]]:
        """Score query against indexed documents."""
        q_tokens = tokenize(query)
        scores: List[float] = [0.0] * self.corpus_size

        for term in q_tokens:
            if term not in self.idf:
                continue
            idf_val = self.idf[term]

            for idx, doc_toks in enumerate(self.doc_tokens):
                tf = doc_toks.count(term)
                if tf == 0:
                    continue
                d_len = self.doc_lens[idx]
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (d_len / self.avg_doc_len))
                scores[idx] += idf_val * (numerator / denominator)

        # Pair with doc IDs and sort
        results = [(self.doc_ids[i], scores[i]) for i in range(self.corpus_size) if scores[i] > 0]
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_n]

