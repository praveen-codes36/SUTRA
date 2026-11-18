"""Hybrid retrieval engine combining BM25 keyword search, dense vector retrieval, and RRF fusion.

Provides:
- HybridRetriever: Production multi-modal retriever indexing emails, attachments, and thread summaries.
- retrieve_results: Primary typed contract returning List[RetrievalResult] for Person 2 (RAG).
- retrieve: Backward-compatible method returning Tuple[List[Email], List[ThreadSummary]] for existing callers.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Tuple, Set, Optional, Literal
import numpy as np

from sutra.models.email import Email, Thread
from sutra.models.intelligence import ThreadIntelligence, ThreadSummary
from sutra.models.retrieval import RetrievalDocument, RetrievalResult, DocumentType
from sutra.retrieval.bm25 import BM25Index, tokenize
from sutra.retrieval.embedder import BaseEmbedder, get_embedder
from sutra.retrieval.vector_index import VectorIndex
from sutra.retrieval.fusion import reciprocal_rank_fusion

logger = logging.getLogger(__name__)


class HybridRetriever:
    """
    Multi-index hybrid retriever combining:
    1. BM25 Okapi sparse keyword search (emails, attachments, thread summaries)
    2. Dense semantic vector retrieval via VectorIndex
    3. Reciprocal Rank Fusion (RRF) for robust multi-source rank blending
    4. Thread expansion context
    """

    def __init__(
        self,
        emails: List[Email],
        summaries: Dict[str, ThreadSummary],
        embedder: Optional[BaseEmbedder] = None,
        rrf_k: int = 60,
    ):
        self.emails = emails
        self.emails_by_id: Dict[str, Email] = {e.email_id: e for e in emails}
        self.summaries = summaries
        self.embedder = embedder or get_embedder(dimension=384)
        self.rrf_k = rrf_k

        # Canonical storage for all structured RetrievalDocuments
        self.documents: Dict[str, RetrievalDocument] = {}

        # 1. Sparse BM25 index over documents
        self.bm25_index = BM25Index()
        # 2. Dense Vector index over documents
        self.vector_index = VectorIndex(dimension=self.embedder.dimension)

        # Build corpus
        self._build_indices()

    def _build_indices(self) -> None:
        """Construct RetrievalDocuments, generate dense embeddings, and populate indices."""
        raw_texts: List[str] = []
        doc_ids: List[str] = []
        docs_to_index: List[RetrievalDocument] = []

        # Index Email Messages
        for e in self.emails:
            att_texts = " ".join([m.content_text for m in e.attachment_data.values()])
            # Combined text enriched with identifiers, subject, participants, body, attachment content
            full_text = (
                f"{e.email_id} {e.thread_id} {e.subject} {e.sender_role or ''} "
                f"{e.sender} {e.body} {att_texts}"
            ).strip()

            metadata = {
                "sender": e.sender,
                "sender_role": e.sender_role,
                "timestamp": e.iso_timestamp,
                "subject": e.subject,
                "attachments": e.attachments,
                "source": "email",
            }

            doc = RetrievalDocument(
                doc_id=f"email:{e.email_id}",
                source_id=e.email_id,
                thread_id=e.thread_id,
                doc_type=DocumentType.EMAIL,
                content=full_text,
                metadata=metadata,
            )
            self.documents[doc.doc_id] = doc
            doc_ids.append(doc.doc_id)
            raw_texts.append(full_text)
            docs_to_index.append(doc)

        # Index Thread Summaries
        for tid, s in self.summaries.items():
            summary_text = f"{s.thread_id} {s.topic} {s.summary} {s.latest_status}".strip()
            metadata = {
                "topic": s.topic,
                "latest_status": s.latest_status,
                "latest_email_id": getattr(s, "latest_email_id", ""),
                "lifecycle_state": getattr(s, "lifecycle_state", ""),
                "source": "thread_summary",
            }
            doc = RetrievalDocument(
                doc_id=f"summary:{tid}",
                source_id=tid,
                thread_id=tid,
                doc_type=DocumentType.THREAD_SUMMARY,
                content=summary_text,
                metadata=metadata,
            )
            self.documents[doc.doc_id] = doc
            doc_ids.append(doc.doc_id)
            raw_texts.append(summary_text)
            docs_to_index.append(doc)

        # Fit BM25
        self.bm25_index.fit(doc_ids, raw_texts)

        # Generate Dense Embeddings and fit Vector Index
        try:
            dense_vectors = self.embedder.embed_batch(raw_texts)
            for doc, vec in zip(docs_to_index, dense_vectors):
                doc.dense_vector = vec
                self.vector_index.add_document(doc)
        except Exception as e:
            logger.error(
                "Dense embedding generation failed during index building (%s). Vector index will remain empty.",
                e,
            )

    def retrieve_bm25(self, query: str, top_k: int = 15) -> List[Tuple[RetrievalDocument, float]]:
        """Run BM25 search alone."""
        if not query or not query.strip() or top_k <= 0:
            return []
        hits = self.bm25_index.search(query, top_n=top_k)
        results = []
        for doc_id, score in hits:
            if doc_id in self.documents:
                results.append((self.documents[doc_id], score))
        return results

    def retrieve_dense(self, query: str, top_k: int = 15) -> List[Tuple[RetrievalDocument, float]]:
        """
        Run Dense Semantic search alone with explicit error handling.
        Returns empty list if embedding generation fails or query is empty.
        """
        if not query or not query.strip() or top_k <= 0:
            return []
        try:
            q_vec = self.embedder.embed_text(query)
            return self.vector_index.search(q_vec, top_k=top_k)
        except Exception as e:
            logger.warning("Dense retrieval error for query '%s': %s", query, e)
            return []

    def retrieve_results(
        self,
        query: str,
        top_k: int = 5,
        mode: Literal["hybrid", "bm25", "dense"] = "hybrid",
    ) -> List[RetrievalResult]:
        """
        Primary typed retrieval API for Person 2 (RAG & Intelligence).
        
        Args:
            query: User's natural language question or search query.
            top_k: Number of ranked evidence results to return.
            mode: 'hybrid' (BM25 + Dense + RRF), 'bm25' only, or 'dense' only.
            
        Returns:
            List of strongly-typed `RetrievalResult` objects sorted by rank.
            
        Raises:
            ValueError: If mode is not one of ('hybrid', 'bm25', 'dense').
        """
        if mode not in ("hybrid", "bm25", "dense"):
            raise ValueError(f"Invalid retrieval mode '{mode}'. Supported modes: 'hybrid', 'bm25', 'dense'.")

        if not query or not query.strip() or top_k <= 0:
            return []

        if mode == "bm25":
            bm25_hits = self.retrieve_bm25(query, top_k=top_k)
            results = []
            for rank, (doc, score) in enumerate(bm25_hits, start=1):
                results.append(
                    RetrievalResult(
                        query=query,
                        doc_id=doc.doc_id,
                        source_id=doc.source_id,
                        thread_id=doc.thread_id,
                        doc_type=doc.doc_type,
                        content=doc.content,
                        retrieval_method="bm25",
                        score=round(score, 4),
                        rank=rank,
                        metadata=doc.metadata,
                    )
                )
            return results

        if mode == "dense":
            dense_hits = self.retrieve_dense(query, top_k=top_k)
            results = []
            for rank, (doc, score) in enumerate(dense_hits, start=1):
                results.append(
                    RetrievalResult(
                        query=query,
                        doc_id=doc.doc_id,
                        source_id=doc.source_id,
                        thread_id=doc.thread_id,
                        doc_type=doc.doc_type,
                        content=doc.content,
                        retrieval_method="dense",
                        score=round(score, 4),
                        rank=rank,
                        metadata=doc.metadata,
                    )
                )
            return results

        # Hybrid Mode: Combine BM25 + Dense using Reciprocal Rank Fusion (RRF)
        candidate_k = max(top_k * 3, 20)
        bm25_hits = self.retrieve_bm25(query, top_k=candidate_k)
        dense_hits = self.retrieve_dense(query, top_k=candidate_k)

        # Observable fallback: If dense returns empty (e.g. backend failure), fall back to BM25
        if not dense_hits and bm25_hits:
            logger.info("Dense retrieval produced no candidates. Falling back gracefully to BM25.")
            return self.retrieve_results(query, top_k=top_k, mode="bm25")

        if not bm25_hits and dense_hits:
            logger.info("BM25 produced no candidates. Falling back gracefully to Dense.")
            return self.retrieve_results(query, top_k=top_k, mode="dense")

        if not bm25_hits and not dense_hits:
            return []

        bm25_ranked = [doc.doc_id for doc, _ in bm25_hits]
        dense_ranked = [doc.doc_id for doc, _ in dense_hits]

        fused = reciprocal_rank_fusion(
            ranked_lists=[bm25_ranked, dense_ranked],
            k=self.rrf_k,
            top_n=top_k,
        )

        results = []
        for rank, (doc_id, rrf_score) in enumerate(fused, start=1):
            if doc_id not in self.documents:
                continue
            doc = self.documents[doc_id]
            results.append(
                RetrievalResult(
                    query=query,
                    doc_id=doc.doc_id,
                    source_id=doc.source_id,
                    thread_id=doc.thread_id,
                    doc_type=doc.doc_type,
                    content=doc.content,
                    retrieval_method="hybrid_rrf",
                    score=round(rrf_score, 5),
                    rank=rank,
                    metadata=doc.metadata,
                )
            )

        return results

    def retrieve(self, query: str, top_k: int = 5) -> Tuple[List[Email], List[ThreadSummary]]:
        """
        Backward-compatible retrieval method for existing RAG engine and benchmark suite.
        Performs hybrid retrieval, maps document IDs back to domain Email and ThreadSummary models,
        and applies thread expansion.
        """
        if not query or not query.strip() or top_k <= 0:
            return [], []

        # Search emails and summaries
        retrieved_results = self.retrieve_results(query, top_k=max(top_k * 3, 15), mode="hybrid")

        matched_emails: List[Email] = []
        matched_summaries: List[ThreadSummary] = []
        seen_email_ids: Set[str] = set()
        matched_thread_ids: Set[str] = set()

        for res in retrieved_results:
            if res.doc_type == DocumentType.THREAD_SUMMARY:
                tid = res.source_id
                if tid in self.summaries and self.summaries[tid] not in matched_summaries:
                    matched_summaries.append(self.summaries[tid])
                    matched_thread_ids.add(tid)
            elif res.doc_type == DocumentType.EMAIL:
                eid = res.source_id
                if eid in self.emails_by_id and eid not in seen_email_ids:
                    e = self.emails_by_id[eid]
                    matched_emails.append(e)
                    seen_email_ids.add(eid)
                    matched_thread_ids.add(e.thread_id)

        # Thread expansion: include parent thread summaries for matched emails
        for tid in matched_thread_ids:
            if tid in self.summaries and self.summaries[tid] not in matched_summaries:
                matched_summaries.append(self.summaries[tid])

        return matched_emails[:top_k], matched_summaries[:2]
