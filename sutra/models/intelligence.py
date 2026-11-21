"""Shared Pydantic models for Conversation Intelligence: Summaries, Decisions, Approvals, Actions, Status, and Lifecycles."""

from __future__ import annotations
from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class LifecycleState(str, Enum):
    REQUESTED = "requested"
    QUOTED = "quoted"
    RECOMMENDED = "recommended"
    APPROVED = "approved"
    ORDERED = "ordered"
    EXECUTED = "executed"
    CLOSED = "closed"
    PENDING = "pending"
    RESOLVED = "resolved"
    UNKNOWN = "unknown"


class ThreadStatusType(str, Enum):
    AWAITING_RESPONSE = "awaiting_response"
    PENDING_APPROVAL = "pending_approval"
    CONDITIONALLY_APPROVED = "conditionally_approved"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    RESOLVED = "resolved"
    BLOCKED = "blocked"
    UNCLEAR = "unclear"


class DecisionCategory(str, Enum):
    APPROVAL = "approval"
    CONDITIONAL_APPROVAL = "conditional_approval"
    LIMITED_SCOPE_ACCEPTANCE = "limited_scope_acceptance"
    REJECTION = "rejection"
    RECOMMENDATION = "recommendation"
    SELECTION = "selection"
    CONFIRMATION = "confirmation"
    POSTPONEMENT = "postponement"
    CANCELLATION = "cancellation"
    MODIFICATION = "modification"
    ACCEPTANCE = "acceptance"
    AUTHORIZATION = "authorization"
    ASSIGNMENT = "assignment"
    OTHER = "other"


class ActionStatus(str, Enum):
    PENDING = "pending"
    OPEN = "open"
    DONE = "done"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CONDITIONAL = "conditional"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"
    SUPERSEDED = "superseded"
    REASSIGNED = "reassigned"
    UNCLEAR = "unclear"
    NONE_STATED = "none_stated"


class EvidenceReference(BaseModel):
    """Direct, verifiable evidence linking an extracted claim to its source."""
    source_id: str = Field(description="Source email ID (e.g. 'E005') or attachment filename")
    thread_id: str = Field(description="Parent conversation thread ID, e.g. 'THR-001'")
    timestamp: Optional[str] = Field(default=None, description="ISO-8601 timestamp of source message")
    excerpt: str = Field(default="", description="Verbatim snippet or factual excerpt from source")
    is_attachment: bool = Field(default=False, description="Whether evidence originates from an attachment")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Extraction confidence score")


class ImportantEvent(BaseModel):
    """Milestone event in a conversation's history."""
    event_id: str = Field(description="Unique event ID, e.g. 'EVT-001'")
    date: str = Field(description="Date string or ISO timestamp of the event")
    actor: Optional[str] = Field(default=None, description="Person or role performing the action")
    actor_role: Optional[str] = Field(default=None, description="Formal administrative role of actor")
    description: str = Field(description="Description of what occurred")
    evidence_email_id: str = Field(description="Source email ID grounding the event")
    supporting_evidence: List[EvidenceReference] = Field(default_factory=list)


# Alias TimelineItem to ImportantEvent for backward compatibility
TimelineItem = ImportantEvent


class DecisionScope(BaseModel):
    """PRD FR-E1 structured scope defining what a decision permits, excludes, and conditions."""
    authorizes: List[str] = Field(default_factory=list, description="What the decision permits")
    excludes: List[str] = Field(default_factory=list, description="What the decision explicitly excludes")
    conditions: List[str] = Field(default_factory=list, description="Conditions that must be met")


class Decision(BaseModel):
    """Formal institutional decision, outcome, or agreement (PRD FR-E1, §9.2)."""
    decision_id: str = Field(description="Unique decision ID, e.g. 'THR-001-DEC-1'")
    thread_id: str = Field(description="Parent thread ID")
    decision: str = Field(description="Clear description of the decision")
    category: DecisionCategory = Field(default=DecisionCategory.APPROVAL, description="Category of decision")
    authority: str = Field(description="Identity or designated entity making the decision")
    authority_role: Optional[str] = Field(default=None, description="Administrative role of decision maker")
    role_source: str = Field(default="INFERRED_FROM_ADDRESS", description="DIRECTORY or INFERRED_FROM_ADDRESS")
    authority_basis: Optional[str] = Field(default=None, description="Basis of authority (e.g. policy citation)")
    status: str = Field(default="approved", description="Status: approved, ACTIVE, CONDITION_PENDING, FULFILLED, SUPERSEDED, rejected")
    amount_inr: Optional[float] = Field(default=None, description="Normalized amount in INR if financial")
    amount_formatted: Optional[str] = Field(default=None, description="Human-readable formatted amount, e.g. 'INR 1,790,000'")
    date: Optional[str] = Field(default=None, description="Date decision was recorded")
    decision_time: Optional[str] = Field(default=None, description="Message timestamp")
    event_date: Optional[str] = Field(default=None, description="If text states another date")
    scope_qualifier: Optional[str] = Field(default=None, description="Explicit conditions or limits, e.g. 'budget planning only'")
    scope: DecisionScope = Field(default_factory=DecisionScope, description="PRD FR-E1 structured scope")
    is_conditional: bool = Field(default=False, description="True if approval is contingent on external conditions")
    is_current: bool = Field(default=True, description="True if decision has not been superseded or revoked")
    superseded_by: Optional[str] = Field(default=None, description="ID of subsequent decision that modified/superseded this")
    evidence_references: List[str] = Field(default_factory=list, description="List of supporting email IDs")
    evidence_details: List[EvidenceReference] = Field(default_factory=list, description="Detailed evidence references")


class Approval(BaseModel):
    """Explicit formal authorization, sanction, or administrative clearance."""
    approval_id: str = Field(description="Unique approval ID, e.g. 'THR-001-APP-1'")
    thread_id: str = Field(description="Parent thread ID")
    approver: str = Field(description="Identity or role of the approving authority")
    approver_role: Optional[str] = Field(default=None, description="Administrative role of approver")
    role_source: str = Field(default="INFERRED_FROM_ADDRESS", description="DIRECTORY or INFERRED_FROM_ADDRESS")
    authority_basis: Optional[str] = Field(default=None, description="Basis of authority")
    item_approved: str = Field(description="Specific proposal, item, purchase, or claim approved")
    amount_inr: Optional[float] = Field(default=None, description="Approved monetary value in INR")
    date: Optional[str] = Field(default=None, description="Date approval was issued")
    decision_time: Optional[str] = Field(default=None, description="Message timestamp")
    event_date: Optional[str] = Field(default=None, description="If text states another date")
    scope_qualifier: Optional[str] = Field(default=None, description="Scope limitation (e.g. 'budget planning only')")
    scope: DecisionScope = Field(default_factory=DecisionScope, description="PRD FR-E1 structured scope")
    is_conditional: bool = Field(default=False, description="True if approval is conditional")
    is_authorization: bool = Field(default=True, description="True if this constitutes actual execution authorization (vs budget planning acceptance)")
    status: str = Field(default="approved", description="State: approved, pending, conditionally_approved, rejected, superseded")
    evidence_references: List[str] = Field(default_factory=list, description="Supporting email IDs")
    evidence_details: List[EvidenceReference] = Field(default_factory=list, description="Detailed evidence references")


class Action(BaseModel):
    """Extracted actionable task, obligation, or assignment (PRD FR-E2, §9.3)."""
    action_id: str = Field(description="Unique action ID, e.g. 'THR-001-ACT-1'")
    thread_id: str = Field(description="Parent thread ID")
    description: str = Field(default="", description="Task description")
    task: str = Field(default="", description="Task description (PRD alias)")
    action_kind: str = Field(default="REQUEST", description="REQUEST, INSTRUCTION, COMMITMENT, CONDITIONAL_NEXT_STEP")
    owner: str = Field(default="none_stated", description="Responsible person or 'none_stated'")
    owner_role: Optional[str] = Field(default=None, description="Designated role of responsible party")
    owner_email: Optional[str] = Field(default=None, description="Email of responsible owner if available")
    owner_status: str = Field(default="NOT_STATED", description="EXPLICIT, INFERRED_FROM_ADDRESS, NOT_STATED")
    assigned_date: Optional[str] = Field(default=None, description="Date action was assigned")
    deadline: Optional[str] = Field(default=None, description="Explicit deadline string, or None if none stated")
    deadline_state: str = Field(default="NONE", description="NONE, UPCOMING, OVERDUE, MET, MISSED, UNDETERMINED")
    status: ActionStatus = Field(default=ActionStatus.PENDING, description="Action status")
    priority: Optional[str] = Field(default=None, description="Explicit priority if mentioned (e.g. 'high', 'urgent')")
    related_decision_id: Optional[str] = Field(default=None, description="Associated decision ID if applicable")
    completion_evidence: List[str] = Field(default_factory=list, description="IDs of messages completing this task")
    completed_at: Optional[str] = Field(default=None, description="Completion timestamp")
    evidence_references: List[str] = Field(default_factory=list, description="Supporting email IDs")
    evidence_details: List[EvidenceReference] = Field(default_factory=list, description="Detailed evidence references")

    def model_post_init(self, __context: Any) -> None:
        if not self.task and self.description:
            self.task = self.description
        elif not self.description and self.task:
            self.description = self.task


class DecisionTransition(BaseModel):
    """State transition tracking for a decision lifecycle."""
    decision_id: str
    from_state: str
    to_state: str
    trigger_email_id: str
    reason: str
    timestamp: str


class ActionTransition(BaseModel):
    """State transition tracking for an action lifecycle."""
    action_id: str
    from_state: str
    to_state: str
    trigger_email_id: str
    reason: str
    timestamp: str


class ThreadStatus(BaseModel):
    """Evaluated current status and resolution state of a conversation thread."""
    thread_id: str
    current_status: ThreadStatusType = Field(description="Taxonomy status classification")
    explanation: str = Field(description="Detailed explanation of the current situation")
    latest_relevant_event: str = Field(description="Most significant recent development")
    is_resolved: bool = Field(description="True if the thread issue or workflow is completely concluded")
    has_pending_actions: bool = Field(description="True if unfulfilled action items or approvals remain")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    relevant_email_ids: List[str] = Field(default_factory=list)


class ThreadIntelligence(BaseModel):
    """Complete, validated structured intelligence output for an institutional email thread (PRD FR-D1)."""
    thread_id: str = Field(description="Unique conversation thread ID, e.g. 'THR-001'")
    topic: str = Field(description="Standardized thread topic")
    summary: str = Field(description="Concise institutional summary of the conversation")
    detailed_summary: str = Field(default="", description="In-depth summary covering chronology and changes")
    purpose: str = Field(default="", description="PRD FR-D1 initial purpose")
    initial_context: str = Field(default="", description="PRD FR-D1 initial context")
    discussion_points: List[str] = Field(default_factory=list, description="PRD FR-D1 discussion points")
    latest_status: str = Field(description="Short human-readable string of latest status")
    status_details: Optional[ThreadStatus] = Field(default=None, description="Structured status classification")
    lifecycle_state: LifecycleState = Field(default=LifecycleState.UNKNOWN, description="High-level lifecycle stage")
    key_participants: List[str] = Field(default_factory=list, description="Primary actors in the conversation")
    important_events: List[ImportantEvent] = Field(default_factory=list, description="Milestone timeline items")
    timeline: List[TimelineItem] = Field(default_factory=list, description="Chronological timeline items (alias)")
    decisions: List[Decision] = Field(default_factory=list, description="All extracted institutional decisions")
    approvals: List[Approval] = Field(default_factory=list, description="All formal approvals and sanctions")
    actions: List[Action] = Field(default_factory=list, description="All action items and tasks")
    pending_actions: List[str] = Field(default_factory=list, description="PRD FR-D1 pending action descriptions or NONE_STATED")
    responsible_people: List[str] = Field(default_factory=list, description="PRD FR-D1 responsible actors")
    deadlines: List[str] = Field(default_factory=list, description="PRD FR-D1 extracted deadlines")
    attachments_referenced: List[str] = Field(default_factory=list, description="PRD FR-D1 referenced attachments")
    source_email_ids: List[str] = Field(default_factory=list, description="PRD FR-D1 source emails")
    generated_by: str = Field(default="sutra-intelligence-v1.0", description="Model/prompt/version generator identifier")
    decision_transitions: List[DecisionTransition] = Field(default_factory=list)
    action_transitions: List[ActionTransition] = Field(default_factory=list)
    latest_email_id: str = Field(description="Email ID of the most recent message in the thread")
    evidence_references: List[str] = Field(default_factory=list, description="All supporting email IDs across the thread")


# Backward compatibility alias
ThreadSummary = ThreadIntelligence
