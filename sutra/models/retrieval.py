"""Data models for retrieval documents, chunks, and scored search results."""

from __future__ import annotations
from enum import Enum
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class DocumentType(str, Enum):
    EMAIL = "email"
    ATTACHMENT = "attachment"
    THREAD_SUMMARY = "thread_summary"
    DECISION = "decision"
    ACTION = "action"
    TABLE_SUMMARY = "table_summary"
    TABLE_ROW = "table_row"

class ChunkLevel(str, Enum):
    """PRD §8.3 & §10.5 Hierarchical Chunking Levels."""
    THREAD_CARD = "THREAD_CARD"
    SEGMENT = "SEGMENT"
    MESSAGE = "MESSAGE"
    ATTACHMENT = "ATTACHMENT"
    TABLE_SUMMARY = "TABLE_SUMMARY"
    TABLE_ROW = "TABLE_ROW"
    LEDGER = "LEDGER"

class RetrievalDocument(BaseModel):
    """
    Indexed unit of text and metadata produced for search across hierarchical levels.
    Represents an email body chunk, attachment content, table row, or thread summary.
    """
    doc_id: str = Field(description="Unique identifier for chunk/document, e.g. 'doc:E001' or 'att:cnc_po'")
    source_id: str = Field(description="Underlying source email ID (e.g. 'E001') or attachment filename")
    thread_id: str = Field(description="Parent conversation thread ID, e.g. 'THR-001'")
    doc_type: DocumentType = Field(default=DocumentType.EMAIL, description="Kind of document indexed")
    level: ChunkLevel = Field(default=ChunkLevel.MESSAGE, description="PRD §8.3 hierarchical chunk level")
    content: str = Field(description="Raw textual content indexed for dense/sparse retrieval")
    text_for_index: Optional[str] = Field(default=None, description="Enriched text with contextual header for indexing")
    locator: Optional[str] = Field(default=None, description="Line range, CSV row index, or section locator")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata: sender, role, date, participants, filename")
    dense_vector: Optional[List[float]] = Field(default=None, description="Optional dense embedding vector representation")

class RetrievalResult(BaseModel):
    """
    Scored and ranked evidence item returned by the hybrid retrieval engine to RAG and callers.
    """
    query: str = Field(description="Original user search query")
    doc_id: str = Field(description="Unique chunk/document ID")
    source_id: str = Field(description="Underlying email ID or attachment filename")
    thread_id: str = Field(description="Associated conversation thread ID")
    doc_type: DocumentType = Field(description="Type of source document")
    level: ChunkLevel = Field(default=ChunkLevel.MESSAGE, description="PRD §8.3 hierarchical chunk level")
    content: str = Field(description="Retrieved text snippet or full message body")
    retrieval_method: str = Field(description="Method used: 'bm25', 'dense', 'hybrid_rrf', or 'reranked'")
    score: float = Field(description="Relevance or fusion score")
    rank: int = Field(description="Rank position in final result list (1-indexed)")
    locator: Optional[str] = Field(default=None, description="Line range, CSV row index, or page locator")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Preserved source metadata")
