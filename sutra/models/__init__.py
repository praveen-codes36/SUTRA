"""Unified exports for SUTRA shared data contracts."""

from .email import Email, Thread, AttachmentMetadata
from .intelligence import (
    LifecycleState,
    Decision,
    Approval,
    Action,
    TimelineItem,
    ThreadIntelligence,
    ThreadSummary,
)
from .retrieval import (
    DocumentType,
    RetrievalDocument,
    RetrievalResult,
)
from .rag import (
    Citation,
    RAGAnswer,
    Answer,
)

__all__ = [
    # Contract 1: Email
    "Email",
    "AttachmentMetadata",
    # Contract 2: Thread
    "Thread",
    # Contract 3: Thread Intelligence
    "LifecycleState",
    "Decision",
    "Approval",
    "Action",
    "TimelineItem",
    "ThreadIntelligence",
    "ThreadSummary",
    # Contract 4 & 5: Retrieval Document & Result
    "DocumentType",
    "RetrievalDocument",
    "RetrievalResult",
    # Contract 6: RAG Answer & Citation
    "Citation",
    "RAGAnswer",
    "Answer",
]
