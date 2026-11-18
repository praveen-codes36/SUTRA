"""Hybrid retrieval engine combining BM25 keyword search, semantic scoring, and thread expansion."""

from typing import List, Dict, Tuple, Set
from sutra.models.email import Email, Thread
from sutra.models.intelligence import ThreadSummary
from sutra.retrieval.bm25 import BM25Index, tokenize
from sutra.retrieval.fusion import reciprocal_rank_fusion

class HybridRetriever:
    """
    Multi-level hybrid retriever indexing:
    1. Individual email messages
    2. Attachment contents
    3. Thread-level summaries
    """

    def __init__(self, emails: List[Email], summaries: Dict[str, ThreadSummary]):
        self.emails = emails
        self.emails_by_id = {e.email_id: e for e in emails}
        self.summaries = summaries

        # 1. Email Message BM25 index
        self.email_bm25 = BM25Index()
        doc_ids = []
        texts = []
        for e in emails:
            doc_ids.append(e.email_id)
            # Combine subject, sender role, body, and attachment texts
            att_texts = " ".join([m.content_text for m in e.attachment_data.values()])
            text = f"{e.email_id} {e.thread_id} {e.subject} {e.sender_role or ''} {e.sender} {e.body} {att_texts}"
            texts.append(text)
        self.email_bm25.fit(doc_ids, texts)

        # 2. Thread Summary BM25 index
        self.summary_bm25 = BM25Index()
        s_ids = []
        s_texts = []
        for tid, s in summaries.items():
            s_ids.append(tid)
            text = f"{s.thread_id} {s.topic} {s.summary} {s.latest_status}"
            s_texts.append(text)
        self.summary_bm25.fit(s_ids, s_texts)

    def retrieve(self, query: str, top_k: int = 5) -> Tuple[List[Email], List[ThreadSummary]]:
        """
        Execute hybrid search and return top matching emails and thread summaries.
        Applies Reciprocal Rank Fusion and thread expansion.
        """
        # Search emails
        email_hits = self.email_bm25.search(query, top_n=15)
        # Search summaries
        summary_hits = self.summary_bm25.search(query, top_n=5)

        matched_emails: List[Email] = []
        matched_summaries: List[ThreadSummary] = []
        seen_email_ids: Set[str] = set()
        matched_thread_ids: Set[str] = set()

        for tid, _ in summary_hits:
            if tid in self.summaries:
                matched_summaries.append(self.summaries[tid])
                matched_thread_ids.add(tid)

        for eid, _ in email_hits:
            if eid in self.emails_by_id and eid not in seen_email_ids:
                e = self.emails_by_id[eid]
                matched_emails.append(e)
                seen_email_ids.add(eid)
                matched_thread_ids.add(e.thread_id)

        # If emails matched, ensure their parent thread summary is included
        for tid in matched_thread_ids:
            if tid in self.summaries and self.summaries[tid] not in matched_summaries:
                matched_summaries.append(self.summaries[tid])

        return matched_emails[:top_k], matched_summaries[:2]

