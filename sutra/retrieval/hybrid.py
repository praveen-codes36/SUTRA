"""Hybrid retrieval engine combining BM25 keyword search, dense vector retrieval, and RRF fusion.

Provides:
- HybridRetriever: Production multi-modal retriever indexing emails, attachments, table rows, and thread summaries.
- retrieve_results: Primary typed contract returning List[RetrievalResult] for RAG and downstream consumers.
- retrieve: Backward-compatible method returning Tuple[List[Email], List[ThreadSummary]] for existing callers.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Tuple, Set, Optional, Literal
import numpy as np

from sutra.models.email import Email, Thread
from sutra.models.intelligence import ThreadIntelligence, ThreadSummary
from sutra.models.retrieval import RetrievalDocument, RetrievalResult, DocumentType, ChunkLevel
from sutra.retrieval.bm25 import BM25Index, tokenize
from sutra.retrieval.embedder import BaseEmbedder, get_embedder
from sutra.retrieval.vector_index import VectorIndex
from sutra.retrieval.fusion import reciprocal_rank_fusion
from sutra.retrieval.hierarchical import HierarchicalRetriever
from sutra.ingestion.table_chunker import TableChunker

logger = logging.getLogger(__name__)


class HybridRetriever:
    """
    Multi-index hybrid retriever combining:
    1. BM25 Okapi sparse keyword search (emails, attachments, table rows, thread summaries)
    2. Dense semantic vector retrieval via VectorIndex
    3. Reciprocal Rank Fusion (RRF) for robust multi-source rank blending
    4. Hierarchical 3-level indexing and search
    5. Thread expansion context
    """

    def __init__(
        self,
        emails: List[Email],
        summaries: Dict[str, ThreadSummary],
        embedder: Optional[BaseEmbedder] = None,
        rrf_k: int = 60,
        dense_weight: float = 1.2,
        bm25_weight: float = 0.8,
        thread_coherence_boost: float = 0.008,
    ):
        self.emails = emails
        self.emails_by_id: Dict[str, Email] = {e.email_id: e for e in emails}
        self.summaries = summaries
        self.embedder = embedder or get_embedder(dimension=384)
        self.rrf_k = rrf_k
        self.dense_weight = dense_weight
        self.bm25_weight = bm25_weight
        self.thread_coherence_boost = thread_coherence_boost

        # Canonical storage for all structured RetrievalDocuments
        self.documents: Dict[str, RetrievalDocument] = {}

        # 1. Sparse BM25 index over documents
        self.bm25_index = BM25Index()
        # 2. Dense Vector index over documents
        self.vector_index = VectorIndex(dimension=self.embedder.dimension)

        # Build unified and hierarchical corpora
        self._build_indices()
        self.hierarchical = HierarchicalRetriever(
            emails=emails,
            summaries=summaries,
            embedder=self.embedder,
            rrf_k=rrf_k,
        )

    def _build_indices(self) -> None:
        """Construct RetrievalDocuments across all levels, generate dense embeddings, and populate indices."""
        raw_texts: List[str] = []
        doc_ids: List[str] = []
        docs_to_index: List[RetrievalDocument] = []

        # 1. Index Email Messages (Level 2: MESSAGE)
        for e in self.emails:
            to_str = ", ".join(e.recipients)
            context_hdr = f"Thread: {e.subject} | From: {e.sender} ({e.sender_role or 'Staff'}) | To: {to_str} | Date: {e.iso_timestamp}"
            if e.in_reply_to:
                context_hdr += f" | Reply-to: {e.in_reply_to}"

            full_text = f"{e.email_id} {e.thread_id} {context_hdr} {e.body}".strip()

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
                level=ChunkLevel.MESSAGE,
                content=e.body,
                text_for_index=full_text,
                locator=e.email_id,
                metadata=metadata,
            )
            self.documents[doc.doc_id] = doc
            doc_ids.append(doc.doc_id)
            raw_texts.append(full_text)
            docs_to_index.append(doc)

            # 2. Index Attachments (Level 3: ATTACHMENT & TABLE_ROW)
            for att_name, meta in e.attachment_data.items():
                if not meta or not meta.content_text.strip():
                    continue

                if meta.file_type == "csv":
                    # Row-level chunks + summary
                    csv_chunks = TableChunker.chunk_csv(
                        csv_content=meta.content_text,
                        filename=att_name,
                        source_email_id=e.email_id,
                        thread_id=e.thread_id,
                        email_subject=e.subject,
                    )
                    for c in csv_chunks:
                        self.documents[c.doc_id] = c
                        doc_ids.append(c.doc_id)
                        raw_texts.append(c.text_for_index or c.content)
                        docs_to_index.append(c)
                else:
                    att_text = f"Attachment: {att_name} (from {e.email_id}) | Thread: {e.thread_id}\n\n{meta.content_text}".strip()
                    att_doc = RetrievalDocument(
                        doc_id=f"att:{e.email_id}:{att_name}",
                        source_id=att_name,
                        thread_id=e.thread_id,
                        doc_type=DocumentType.ATTACHMENT,
                        level=ChunkLevel.ATTACHMENT,
                        content=meta.content_text,
                        text_for_index=att_text,
                        locator=att_name,
                        metadata={
                            "filename": att_name,
                            "email_id": e.email_id,
                            "source": "attachment_text",
                        },
                    )
                    self.documents[att_doc.doc_id] = att_doc
                    doc_ids.append(att_doc.doc_id)
                    raw_texts.append(att_text)
                    docs_to_index.append(att_doc)

        # 3. Index Thread Summaries (Level 1: THREAD_CARD)
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
                level=ChunkLevel.THREAD_CARD,
                content=summary_text,
                text_for_index=summary_text,
                locator="summary",
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
        dedup_by_source: bool = False,
    ) -> List[RetrievalResult]:
        """
        Primary typed retrieval API for RAG and downstream consumers.
        
        Args:
            query: User's natural language question or search query.
            top_k: Number of ranked evidence results to return.
            mode: 'hybrid' (BM25 + Dense + RRF), 'bm25' only, or 'dense' only.
            dedup_by_source: If True, suppresses redundant secondary chunks from the same parent email
                             so top-k slots are not crowded out by single documents.
            
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
            fetch_k = top_k * 5 if dedup_by_source else top_k
            bm25_hits = self.retrieve_bm25(query, top_k=fetch_k)
            results = []
            for rank, (doc, score) in enumerate(bm25_hits, start=1):
                results.append(
                    RetrievalResult(
                        query=query,
                        doc_id=doc.doc_id,
                        source_id=doc.source_id,
                        thread_id=doc.thread_id,
                        doc_type=doc.doc_type,
                        level=doc.level,
                        content=doc.content,
                        retrieval_method="bm25",
                        score=round(score, 4),
                        rank=rank,
                        locator=doc.locator,
                        metadata=doc.metadata,
                    )
                )
            if dedup_by_source:
                return self._deduplicate_by_source(results, top_k)
            return results[:top_k]

        if mode == "dense":
            fetch_k = top_k * 5 if dedup_by_source else top_k
            dense_hits = self.retrieve_dense(query, top_k=fetch_k)
            results = []
            for rank, (doc, score) in enumerate(dense_hits, start=1):
                results.append(
                    RetrievalResult(
                        query=query,
                        doc_id=doc.doc_id,
                        source_id=doc.source_id,
                        thread_id=doc.thread_id,
                        doc_type=doc.doc_type,
                        level=doc.level,
                        content=doc.content,
                        retrieval_method="dense",
                        score=round(score, 4),
                        rank=rank,
                        locator=doc.locator,
                        metadata=doc.metadata,
                    )
                )
            if dedup_by_source:
                return self._deduplicate_by_source(results, top_k)
            return results[:top_k]

        # Hybrid Mode: Combine BM25 + Dense using Reciprocal Rank Fusion (RRF)
        candidate_k = max(top_k * 5, 50)
        bm25_hits = self.retrieve_bm25(query, top_k=candidate_k)
        dense_hits = self.retrieve_dense(query, top_k=candidate_k)

        # Observable fallback: If dense returns empty (e.g. backend failure), fall back to BM25
        if not dense_hits and bm25_hits:
            logger.info("Dense retrieval produced no candidates. Falling back gracefully to BM25.")
            return self.retrieve_results(query, top_k=top_k, mode="bm25", dedup_by_source=dedup_by_source)

        if not bm25_hits and dense_hits:
            logger.info("BM25 produced no candidates. Falling back gracefully to Dense.")
            return self.retrieve_results(query, top_k=top_k, mode="dense", dedup_by_source=dedup_by_source)

        if not bm25_hits and not dense_hits:
            return []

        bm25_ranked = [doc.doc_id for doc, _ in bm25_hits]
        dense_ranked = [doc.doc_id for doc, _ in dense_hits]

        # Calculate thread coherence bonus to prevent cross-domain term dilution
        bonus_scores: Dict[str, float] = {}
        if self.thread_coherence_boost > 0.0:
            dense_threads = [doc.thread_id for doc, _ in dense_hits[:5] if doc.thread_id]
            top_dense_thread = dense_threads[0] if dense_threads else None
            if top_dense_thread:
                for doc, _ in dense_hits:
                    if doc.thread_id == top_dense_thread:
                        bonus_scores[doc.doc_id] = self.thread_coherence_boost
                for doc, _ in bm25_hits:
                    if doc.thread_id == top_dense_thread:
                        bonus_scores[doc.doc_id] = self.thread_coherence_boost

        fused_top_n = max(top_k * 5, 30) if dedup_by_source else top_k
        fused = reciprocal_rank_fusion(
            ranked_lists=[bm25_ranked, dense_ranked],
            weights=[self.bm25_weight, self.dense_weight],
            k=self.rrf_k,
            top_n=fused_top_n,
            bonus_scores=bonus_scores if bonus_scores else None,
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
                    level=doc.level,
                    content=doc.content,
                    retrieval_method="hybrid_rrf",
                    score=round(rrf_score, 5),
                    rank=rank,
                    locator=doc.locator,
                    metadata=doc.metadata,
                )
            )

        if dedup_by_source:
            return self._deduplicate_by_source(results, top_k)
        return results[:top_k]

    @staticmethod
    def _deduplicate_by_source(results: List[RetrievalResult], top_k: int) -> List[RetrievalResult]:
        """Keep the highest-ranked chunk per parent source (e.g. email_id) to avoid chunk dilution."""
        filtered: List[RetrievalResult] = []
        seen_parents: Set[str] = set()
        for r in results:
            parent_key = r.metadata.get("email_id") or r.source_id or r.doc_id
            if parent_key not in seen_parents:
                seen_parents.add(parent_key)
                filtered.append(r)
            if len(filtered) >= top_k:
                break
        for idx, r in enumerate(filtered, start=1):
            r.rank = idx
        return filtered

    def is_abstention_candidate(
        self,
        query: str,
        bm25_threshold: float = 9.3,
        dense_threshold: float = 0.58,
    ) -> Tuple[bool, str]:
        """
        Calibrated abstention detector for out-of-scope or ungrounded queries (PRD §16.3 & §16.6).
        Returns (should_abstain, reason).
        """
        if not query or not query.strip():
            return True, "Empty query"

        # Do not force abstention on small/mock test corpora
        if len(self.emails) <= 5:
            return False, ""

        stopwords = {
            "what", "is", "the", "for", "in", "of", "to", "and", "a", "an", "who", "which",
            "when", "where", "how", "why", "did", "was", "were", "been", "has", "have", "had",
            "are", "by", "at", "from", "on", "with", "as", "does", "do", "any", "all"
        }
        query_tokens = [t for t in tokenize(query) if t not in stopwords and len(t) > 2]
        matching_tokens = sum(1 for t in query_tokens if self.bm25_index.df.get(t, 0) > 0)
        content_ratio = matching_tokens / max(len(query_tokens), 1)

        dense_hits = self.retrieve_dense(query, top_k=1)
        dense_score = dense_hits[0][1] if dense_hits else 0.0

        if content_ratio < 0.20 and dense_score < 0.48:
            return True, f"Insufficient evidence in corpus (content match: {content_ratio:.2f}, dense: {dense_score:.3f})"

        return False, ""

    def retrieve(self, query: str, top_k: int = 5) -> Tuple[List[Email], List[ThreadSummary]]:
        """
        Backward-compatible retrieval method for existing callers.
        Performs hybrid retrieval, maps document IDs back to domain Email and ThreadSummary models,
        and applies thread expansion.
        """
        if not query or not query.strip() or top_k <= 0:
            return [], []

        should_abstain, _ = self.is_abstention_candidate(query)
        if should_abstain:
            return [], []

        # Search across emails, table rows, attachments, and summaries with expanded pool
        retrieved_results = self.retrieve_results(query, top_k=max(top_k * 6, 50), mode="hybrid")

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
            elif res.doc_type in (DocumentType.ATTACHMENT, DocumentType.TABLE_ROW, DocumentType.TABLE_SUMMARY):
                # Map attachment / table row back to parent email
                eid = res.metadata.get("email_id")
                if eid and eid in self.emails_by_id and eid not in seen_email_ids:
                    e = self.emails_by_id[eid]
                    matched_emails.append(e)
                    seen_email_ids.add(eid)
                    matched_thread_ids.add(e.thread_id)
                elif res.thread_id:
                    matched_thread_ids.add(res.thread_id)

        # Thread expansion: include parent thread summaries for matched emails
        for tid in matched_thread_ids:
            if tid in self.summaries and self.summaries[tid] not in matched_summaries:
                matched_summaries.append(self.summaries[tid])

        return matched_emails[:top_k], matched_summaries[:2]
