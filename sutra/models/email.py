"""Shared data models for emails, threads, and attachments."""

from __future__ import annotations
from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class AttachmentMetadata(BaseModel):
    """Metadata and extracted content for an email attachment."""
    filename: str
    file_type: str
    content_text: str = ""
    row_count: Optional[int] = None
    structured_data: Optional[List[Dict[str, Any]]] = None

class Email(BaseModel):
    """Normalized email message model."""
    email_id: str
    thread_id: str
    sender: str
    recipients: List[str] = Field(default_factory=list)
    subject: str
    timestamp: datetime
    body: str
    in_reply_to: Optional[str] = None
    attachments: List[str] = Field(default_factory=list)
    attachment_data: Dict[str, AttachmentMetadata] = Field(default_factory=dict)
    
    # Institutional metadata
    sender_role: Optional[str] = None
    recipient_roles: List[str] = Field(default_factory=list)

    @property
    def iso_timestamp(self) -> str:
        return self.timestamp.isoformat()

class Thread(BaseModel):
    """Conversation thread containing chronologically ordered emails."""
    thread_id: str
    subject: str
    email_ids: List[str] = Field(default_factory=list)
    participants: List[str] = Field(default_factory=list)
    participant_roles: List[str] = Field(default_factory=list)
    start_time: datetime
    last_updated: datetime
    message_count: int = 0
    attachment_filenames: List[str] = Field(default_factory=list)

