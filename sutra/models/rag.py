"""Data models for RAG, citation grounding, and evidence verification."""

from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field

class Citation(BaseModel):
    """Grounding citation linking a claim directly to source evidence."""
    email_id: str
    thread_id: str
    evidence_text: str
    source_location: str = "body"  # 'body' or attachment filename
    verified: bool = False
    start_offset: Optional[int] = None
    end_offset: Optional[int] = None
    matched_quote: Optional[str] = None
    verification_method: Optional[str] = None

class RAGAnswer(BaseModel):
    """Evidence-grounded answer to a natural-language query produced by Role 2."""
    question: str
    answer: str
    summary: Optional[str] = None
    direct_decision: Optional[str] = None
    approver: Optional[str] = None
    amount_inr: Optional[float] = None
    pending_action: Optional[str] = None
    citations: List[Citation] = Field(default_factory=list)
    cited_email_ids: List[str] = Field(default_factory=list)
    confidence: float = 1.0
    abstained: bool = False
    abstention_reason: Optional[str] = None

# Backward compatibility alias
Answer = RAGAnswer
