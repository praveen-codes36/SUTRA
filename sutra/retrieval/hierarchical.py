"""Hierarchical 3-Level Retrieval Engine (PRD §8.3, §8.5, FR-F3, FR-G3).

Implements the PRD's three-level indexing and search architecture:
- Level 1: Thread-Card Index (thread summaries, key participants, latest status, decisions/actions)
- Level 2: Message-Level Index (individual email messages with contextual headers)
- Level 3: Attachment-Chunk Index (text file chunks, CSV table summaries, and row-level semantic chunks)
- Supporting Ledger Index: Extracted decision and action items.

Provides cross-granularity search, level-specific filtering, and thread-score aggregation.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Tuple, Set, Optional, Literal
from collections import defaultdict

from sutra.models.email import Email, Thread
from sutra.models.intelligence import ThreadIntelligence, ThreadSummary, Decision, Action
from sutra.models.retrieval import RetrievalDocument, RetrievalResult, DocumentType, ChunkLevel
from sutra.retrieval.bm25 import BM25Index
from sutra.retrieval.embedder import BaseEmbedder, get_embedder
from sutra.retrieval.vector_index import VectorIndex
from sutra.retrieval.fusion import reciprocal_rank_fusion
from sutra.ingestion.table_chunker import TableChunker

logger = logging.getLogger(__name__)


class LevelIndex:
    """A dual BM25 + Dense Vector index for a specific hierarchical granularity level."""

    def __init__(self, level: ChunkLevel, dimension: int = 384, embedder: Optional[BaseEmbedder] = None):
        self.level = level
        self.dimension = dimension
        self.embedder = embedder or get_embedder(dimension=dimension)
        self.bm25 = BM25Index()
        self.vector_index = VectorIndex(dimension=dimension)
        self.documents: Dict[str, RetrievalDocument] = {}

    def __len__(self) -> int:
        return len(self.documents)

    def add_documents(self, docs: List[RetrievalDocument]) -> None:
        """Add documents to both BM25 and Vector indices."""
        if not docs:
            return

        doc_ids = []
        raw_texts = []
        for doc in docs:
            self.documents[doc.doc_id] = doc
            doc_ids.append(doc.doc_id)
            idx_text = doc.text_for_index or doc.content
            raw_texts.append(idx_text)

        self.bm25.fit(doc_ids, raw_texts)

        try:
            vectors = self.embedder.embed_batch(raw_texts)
            for doc, vec in zip(docs, vectors):
                doc.dense_vector = vec
                self.vector_index.add_document(doc)
        except Exception as e:
            logger.warning("LevelIndex [%s] failed dense embedding: %s", self.level.value, e)

    def search_bm25(self, query: str, top_k: int = 10) -> List[Tuple[RetrievalDocument, float]]:
        if not query.strip() or top_k <= 0 or len(self.documents) == 0:
            return []
        hits = self.bm25.search(query, top_n=top_k)
        return [(self.documents[did], score) for did, score in hits if did in self.documents]

    def search_dense(self, query: str, top_k: int = 10) -> List[Tuple[RetrievalDocument, float]]:
        if not query.strip() or top_k <= 0 or len(self.documents) == 0:
            return []
        try:
            vec = self.embedder.embed_text(query)
            return self.vector_index.search(vec, top_k=top_k)
        except Exception as e:
            logger.warning("LevelIndex [%s] dense search error: %s", self.level.value, e)
            return []

    def search_hybrid(self, query: str, top_k: int = 10, rrf_k: int = 60) -> List[Tuple[RetrievalDocument, float]]:
        if not query.strip() or top_k <= 0 or len(self.documents) == 0:
            return []
        candidate_k = max(top_k * 3, 15)
        bm25_hits = self.search_bm25(query, top_k=candidate_k)
        dense_hits = self.search_dense(query, top_k=candidate_k)

        if not dense_hits and bm25_hits:
            return bm25_hits[:top_k]
        if not bm25_hits and dense_hits:
            return dense_hits[:top_k]
        if not bm25_hits and not dense_hits:
            return []

        bm25_ranked = [doc.doc_id for doc, _ in bm25_hits]
        dense_ranked = [doc.doc_id for doc, _ in dense_hits]

        fused = reciprocal_rank_fusion(
            ranked_lists=[bm25_ranked, dense_ranked],
            k=rrf_k,
            top_n=top_k,
        )
        return [(self.documents[did], score) for did, score in fused if did in self.documents]


class HierarchicalRetriever:
    """
    3-Level Hierarchical Retrieval coordinator managing:
    - Level 1: Thread-Card Index
    - Level 2: Message-Level Index
    - Level 3: Attachment-Chunk Index (Text & CSV Rows)
    - Ledger Index: Decisions & Actions
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

        # Master lookup
        self.all_documents: Dict[str, RetrievalDocument] = {}

        # 3 Dedicated Hierarchical Level Indices + Ledger
        self.thread_index = LevelIndex(ChunkLevel.THREAD_CARD, dimension=self.embedder.dimension, embedder=self.embedder)
        self.message_index = LevelIndex(ChunkLevel.MESSAGE, dimension=self.embedder.dimension, embedder=self.embedder)
        self.attachment_index = LevelIndex(ChunkLevel.ATTACHMENT, dimension=self.embedder.dimension, embedder=self.embedder)
        self.ledger_index = LevelIndex(ChunkLevel.LEDGER, dimension=self.embedder.dimension, embedder=self.embedder)

        self._build_hierarchical_indices()

    def _build_hierarchical_indices(self) -> None:
        """Construct and populate all 3 indexing tiers from source emails, attachments, and summaries."""
        thread_docs: List[RetrievalDocument] = []
        message_docs: List[RetrievalDocument] = []
        attachment_docs: List[RetrievalDocument] = []
        ledger_docs: List[RetrievalDocument] = []

        # 1. Level 1 — Thread-Level Indexing (PRD §8.3: Thread-card chunks)
        for tid, s in self.summaries.items():
            # Build rich thread card content
            dec_texts = "; ".join([getattr(d, "decision", "") or getattr(d, "subject", "") for d in getattr(s, "decisions", [])])
            act_texts = "; ".join([f"{getattr(a, 'task', '') or getattr(a, 'description', '')} (Owner: {a.owner})" for a in getattr(s, "actions", [])])
            card_content = (
                f"Thread: {tid} | Topic: {s.topic} | Status: {s.latest_status}\n"
                f"Summary: {s.summary}\n"
                f"Decisions: {dec_texts}\n"
                f"Actions: {act_texts}\n"
                f"Participants: {', '.join(getattr(s, 'key_participants', []))}"
            )
            doc = RetrievalDocument(
                doc_id=f"thread:{tid}",
                source_id=tid,
                thread_id=tid,
                doc_type=DocumentType.THREAD_SUMMARY,
                level=ChunkLevel.THREAD_CARD,
                content=card_content,
                text_for_index=f"{tid} {s.topic} {s.summary} {s.latest_status} {dec_texts} {act_texts}",
                locator="thread_card",
                metadata={
                    "thread_id": tid,
                    "topic": s.topic,
                    "latest_status": s.latest_status,
                    "source": "thread_card",
                },
            )
            thread_docs.append(doc)
            self.all_documents[doc.doc_id] = doc

            # Index ledger records as discrete searchable units (PRD §8.3 Decision/Action records)
            for d in getattr(s, "decisions", []):
                dec_desc = getattr(d, "decision", "") or getattr(d, "subject", "")
                d_text = f"Decision: {dec_desc} | Category: {d.category} | Authority: {d.authority} | Amount: {d.amount_formatted or ''}"
                d_doc = RetrievalDocument(
                    doc_id=f"dec:{d.decision_id}",
                    source_id=d.decision_id,
                    thread_id=tid,
                    doc_type=DocumentType.DECISION,
                    level=ChunkLevel.LEDGER,
                    content=d_text,
                    text_for_index=f"{tid} {d_text}",
                    locator=d.decision_id,
                    metadata={"decision_id": d.decision_id, "category": str(d.category), "source": "decision_ledger"},
                )
                ledger_docs.append(d_doc)
                self.all_documents[d_doc.doc_id] = d_doc

            for a in getattr(s, "actions", []):
                act_desc = getattr(a, "task", "") or getattr(a, "description", "")
                a_text = f"Action: {act_desc} | Owner: {a.owner} | Deadline: {a.deadline or 'None stated'} | Status: {a.status}"
                a_doc = RetrievalDocument(
                    doc_id=f"act:{a.action_id}",
                    source_id=a.action_id,
                    thread_id=tid,
                    doc_type=DocumentType.ACTION,
                    level=ChunkLevel.LEDGER,
                    content=a_text,
                    text_for_index=f"{tid} {a_text}",
                    locator=a.action_id,
                    metadata={"action_id": a.action_id, "owner": a.owner, "source": "action_ledger"},
                )
                ledger_docs.append(a_doc)
                self.all_documents[a_doc.doc_id] = a_doc

        # 2. Level 2 — Message-Level Indexing (PRD §8.3: One chunk per message with contextual header)
        for e in self.emails:
            # Contextual header prepended per PRD §8.3:
            # Thread: <subject> | From: <sender/role> | To: ... | Date: ... | Reply-to: <parent id>
            to_str = ", ".join(e.recipients)
            header = f"Thread: {e.subject} | From: {e.sender} ({e.sender_role or 'Staff'}) | To: {to_str} | Date: {e.iso_timestamp}"
            if e.in_reply_to:
                header += f" | Reply-to: {e.in_reply_to}"
            
            full_indexed_text = f"{header}\n\n{e.body}".strip()

            doc = RetrievalDocument(
                doc_id=f"msg:{e.email_id}",
                source_id=e.email_id,
                thread_id=e.thread_id,
                doc_type=DocumentType.EMAIL,
                level=ChunkLevel.MESSAGE,
                content=e.body,
                text_for_index=full_indexed_text,
                locator=e.email_id,
                metadata={
                    "sender": e.sender,
                    "sender_role": e.sender_role,
                    "timestamp": e.iso_timestamp,
                    "subject": e.subject,
                    "attachments": e.attachments,
                    "source": "email_message",
                },
            )
            message_docs.append(doc)
            self.all_documents[doc.doc_id] = doc

            # 3. Level 3 — Attachment-Chunk Indexing (PRD §8.3 & §7.6)
            for att_name, meta in e.attachment_data.items():
                if not meta or not meta.content_text.strip():
                    continue

                if meta.file_type == "csv":
                    # Row-level semantic chunking + table summary
                    csv_chunks = TableChunker.chunk_csv(
                        csv_content=meta.content_text,
                        filename=att_name,
                        source_email_id=e.email_id,
                        thread_id=e.thread_id,
                        email_subject=e.subject,
                    )
                    for c in csv_chunks:
                        attachment_docs.append(c)
                        self.all_documents[c.doc_id] = c
                else:
                    # Text / document attachment chunking
                    # Format header: Attachment: <filename> (from <email_id>)
                    att_header = f"Attachment: {att_name} (from {e.email_id}) | Thread: {e.thread_id}"
                    full_att_text = f"{att_header}\n\n{meta.content_text}".strip()

                    att_doc = RetrievalDocument(
                        doc_id=f"att:{e.email_id}:{att_name}",
                        source_id=att_name,
                        thread_id=e.thread_id,
                        doc_type=DocumentType.ATTACHMENT,
                        level=ChunkLevel.ATTACHMENT,
                        content=meta.content_text,
                        text_for_index=full_att_text,
                        locator=att_name,
                        metadata={
                            "filename": att_name,
                            "email_id": e.email_id,
                            "source": "attachment_text",
                        },
                    )
                    attachment_docs.append(att_doc)
                    self.all_documents[att_doc.doc_id] = att_doc

        # Build each dedicated LevelIndex
        self.thread_index.add_documents(thread_docs)
        self.message_index.add_documents(message_docs)
        self.attachment_index.add_documents(attachment_docs)
        self.ledger_index.add_documents(ledger_docs)

        logger.info(
            "Hierarchical indices built: %d thread cards, %d messages, %d attachment chunks, %d ledger chunks",
            len(thread_docs), len(message_docs), len(attachment_docs), len(ledger_docs)
        )

    def retrieve_hierarchical(
        self,
        query: str,
        levels: Optional[List[ChunkLevel]] = None,
        top_k: int = 5,
        mode: Literal["hybrid", "bm25", "dense"] = "hybrid",
    ) -> List[RetrievalResult]:
        """
        Search across requested hierarchy levels or all levels with unified rank fusion.
        """
        if not query or not query.strip() or top_k <= 0:
            return []

        active_levels = levels or [ChunkLevel.MESSAGE, ChunkLevel.ATTACHMENT, ChunkLevel.THREAD_CARD, ChunkLevel.LEDGER]
        candidate_hits: List[Tuple[RetrievalDocument, float]] = []

        sub_k = max(top_k * 2, 10)
        for lvl in active_levels:
            if lvl == ChunkLevel.THREAD_CARD:
                idx = self.thread_index
            elif lvl == ChunkLevel.MESSAGE:
                idx = self.message_index
            elif lvl in (ChunkLevel.ATTACHMENT, ChunkLevel.TABLE_ROW, ChunkLevel.TABLE_SUMMARY):
                idx = self.attachment_index
            elif lvl == ChunkLevel.LEDGER:
                idx = self.ledger_index
            else:
                idx = self.message_index

            if mode == "bm25":
                hits = idx.search_bm25(query, top_k=sub_k)
            elif mode == "dense":
                hits = idx.search_dense(query, top_k=sub_k)
            else:
                hits = idx.search_hybrid(query, top_k=sub_k, rrf_k=self.rrf_k)

            candidate_hits.extend(hits)

        # Merge and deduplicate by doc_id using RRF if multiple levels queried
        if len(active_levels) > 1 and candidate_hits:
            # Group scores
            doc_scores: Dict[str, float] = defaultdict(float)
            for doc, score in candidate_hits:
                doc_scores[doc.doc_id] = max(doc_scores[doc.doc_id], score)
            
            sorted_docs = sorted(
                doc_scores.keys(),
                key=lambda did: (-doc_scores[did], did)
            )[:top_k]
            
            results = []
            for rank, did in enumerate(sorted_docs, start=1):
                doc = self.all_documents[did]
                results.append(
                    RetrievalResult(
                        query=query,
                        doc_id=doc.doc_id,
                        source_id=doc.source_id,
                        thread_id=doc.thread_id,
                        doc_type=doc.doc_type,
                        level=doc.level,
                        content=doc.content,
                        retrieval_method=f"hierarchical_{mode}",
                        score=round(doc_scores[did], 5),
                        rank=rank,
                        locator=doc.locator,
                        metadata=doc.metadata,
                    )
                )
            return results

        # Single level return
        candidate_hits.sort(key=lambda x: (-x[1], x[0].doc_id))
        results = []
        for rank, (doc, score) in enumerate(candidate_hits[:top_k], start=1):
            results.append(
                RetrievalResult(
                    query=query,
                    doc_id=doc.doc_id,
                    source_id=doc.source_id,
                    thread_id=doc.thread_id,
                    doc_type=doc.doc_type,
                    level=doc.level,
                    content=doc.content,
                    retrieval_method=f"hierarchical_{mode}",
                    score=round(score, 5),
                    rank=rank,
                    locator=doc.locator,
                    metadata=doc.metadata,
                )
            )
        return results
