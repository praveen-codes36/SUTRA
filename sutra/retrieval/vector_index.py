"""In-memory dense vector index for fast cosine similarity search."""

from __future__ import annotations
from typing import List, Dict, Tuple, Optional, Callable, Any
import numpy as np

from sutra.models.retrieval import RetrievalDocument, DocumentType


class VectorIndex:
    """
    In-memory vector store supporting cosine similarity search, metadata filtering,
    batch addition, deduplication by document ID, and in-place vector updates.
    
    Scalability & Memory Note:
    This index is designed for institutional email datasets up to ~50,000 documents
    (~75 MB in RAM for 384-dim fp32 vectors). For enterprise multi-million document corpora,
    replace this class with an external vector store (e.g. Qdrant or Milvus) via the same interface.
    """

    def __init__(self, dimension: int = 384):
        if dimension <= 0:
            raise ValueError(f"Vector index dimension must be positive, got {dimension}")
        self.dimension = dimension
        self.doc_ids: List[str] = []
        self.documents: Dict[str, RetrievalDocument] = {}
        # Matrix of shape (N, dimension)
        self.matrix: np.ndarray = np.empty((0, dimension), dtype=np.float32)

    def __len__(self) -> int:
        return len(self.doc_ids)

    def add_document(self, doc: RetrievalDocument) -> None:
        """
        Add or update a single document with its dense vector.
        Guarantees strict deduplication by `doc.doc_id`.
        """
        if doc.dense_vector is None:
            raise ValueError(f"Document '{doc.doc_id}' has no dense_vector")
        if len(doc.dense_vector) != self.dimension:
            raise ValueError(
                f"Document '{doc.doc_id}' vector dimension {len(doc.dense_vector)} does not match index dimension {self.dimension}"
            )

        vec = np.array(doc.dense_vector, dtype=np.float32)
        norm = float(np.linalg.norm(vec))
        if norm > 1e-9:
            vec = vec / norm
        else:
            vec = np.zeros(self.dimension, dtype=np.float32)

        if doc.doc_id in self.documents:
            # Update existing document in-place
            idx = self.doc_ids.index(doc.doc_id)
            self.matrix[idx] = vec
            self.documents[doc.doc_id] = doc
        else:
            # Append new document
            self.doc_ids.append(doc.doc_id)
            self.documents[doc.doc_id] = doc
            if self.matrix.shape[0] == 0:
                self.matrix = vec.reshape(1, self.dimension)
            else:
                self.matrix = np.vstack([self.matrix, vec.reshape(1, self.dimension)])

    def add_documents(self, docs: List[RetrievalDocument]) -> None:
        """Batch add or update multiple documents."""
        for doc in docs:
            self.add_document(doc)

    def search(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filter_fn: Optional[Callable[[RetrievalDocument], bool]] = None,
        min_score: float = -1.0,
    ) -> List[Tuple[RetrievalDocument, float]]:
        """
        Search for most similar documents using cosine similarity.
        
        Args:
            query_vector: Dense query vector of length `dimension`.
            top_k: Number of top results to return. If corpus has fewer than top_k items,
                   returns all matching candidates without error.
            filter_fn: Optional predicate filter on candidate RetrievalDocument.
                       Guarantees no document failing filter_fn is ever returned.
            min_score: Minimum cosine similarity threshold.
            
        Returns:
            List of (RetrievalDocument, similarity_score) sorted descending by score.
            Ties are broken deterministically by doc_id.
        """
        if len(self.doc_ids) == 0:
            return []

        if top_k <= 0:
            return []

        if query_vector is None or len(query_vector) != self.dimension:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = float(np.linalg.norm(q_vec))
        if q_norm <= 1e-9:
            # Query is empty or zero-magnitude: return empty results safely
            return []

        q_vec = q_vec / q_norm

        # Cosine similarity dot product against all normalized vectors
        scores = np.dot(self.matrix, q_vec)

        # Build candidate tuples
        candidates: List[Tuple[RetrievalDocument, float]] = []
        for i, score in enumerate(scores):
            score_val = float(score)
            if score_val < min_score:
                continue
            doc = self.documents[self.doc_ids[i]]
            # Strict metadata filtering
            if filter_fn is not None and not filter_fn(doc):
                continue
            candidates.append((doc, score_val))

        # Sort descending by score, breaking ties deterministically by doc_id
        candidates.sort(key=lambda x: (x[1], x[0].doc_id), reverse=True)
        return candidates[:top_k]

    def get_document(self, doc_id: str) -> Optional[RetrievalDocument]:
        """Retrieve a document by ID."""
        return self.documents.get(doc_id)

    def clear(self) -> None:
        """Reset index state and release memory."""
        self.doc_ids.clear()
        self.documents.clear()
        self.matrix = np.empty((0, self.dimension), dtype=np.float32)
