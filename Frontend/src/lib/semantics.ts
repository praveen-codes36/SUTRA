import type {
  ActionKind,
  ActionStatus,
  AmountRole,
  AttachmentStatus,
  ConditionState,
  DeadlineState,
  DecisionStatus,
  DecisionType,
  Provenance,
  RoleSource,
  ThreadIntegrity,
  ThreadStatusClass,
} from '../types/api';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'forest';

export type SemanticIconName =
  | 'CircleDot'
  | 'Clock'
  | 'PieChart'
  | 'Eye'
  | 'CheckCircle2'
  | 'HelpCircle'
  | 'ShieldCheck'
  | 'ShieldAlert'
  | 'Ban'
  | 'ArrowUpRight'
  | 'CheckSquare'
  | 'FileCheck'
  | 'AlertTriangle'
  | 'XCircle'
  | 'Info'
  | 'Calculator'
  | 'Sparkles'
  | 'FileText'
  | 'Lock'
  | 'FileWarning'
  | 'FileX'
  | 'Minus';

export interface MetaItem {
  label: string;
  tone: StatusTone;
  icon?: SemanticIconName;
  tooltip: string;
  description?: string;
}

export interface ProvenanceMetaItem extends MetaItem {
  icon: SemanticIconName;
}

export const ACTION_KIND_META: Record<ActionKind, MetaItem> = {
  REQUEST: { label: 'Request', tone: 'info', icon: 'HelpCircle', tooltip: 'Requested task' },
  INSTRUCTION: { label: 'Instruction', tone: 'neutral', icon: 'CircleDot', tooltip: 'Direct instruction' },
  COMMITMENT: { label: 'Commitment', tone: 'success', icon: 'CheckCircle2', tooltip: 'Explicit commitment' },
  CONDITIONAL_NEXT_STEP: { label: 'Conditional next step', tone: 'warning', icon: 'Clock', tooltip: 'Pending preconditions' },
};

export const ACTION_STATUS_META: Record<ActionStatus, MetaItem> = {
  OPEN: { label: 'Open', tone: 'neutral', icon: 'CircleDot', tooltip: 'Pending execution' },
  DONE: { label: 'Completed', tone: 'success', icon: 'CheckCircle2', tooltip: 'Action completed' },
  CONDITIONAL: { label: 'Conditional', tone: 'warning', icon: 'Clock', tooltip: 'Preconditions pending' },
  CANCELLED: { label: 'Cancelled', tone: 'error', icon: 'XCircle', tooltip: 'Action cancelled' },
  SUPERSEDED: { label: 'Superseded', tone: 'neutral', icon: 'Minus', tooltip: 'Superseded by newer action' },
  IN_PROGRESS: { label: 'In Progress', tone: 'info', icon: 'Clock', tooltip: 'Currently being executed' },
  BLOCKED: { label: 'Blocked', tone: 'error', icon: 'Ban', tooltip: 'Execution blocked' },
};

export function getActionStatusMeta(status: ActionStatus): MetaItem {
  return ACTION_STATUS_META[status] || { label: status, tone: 'neutral' };
}

export const AMOUNT_ROLE_LABELS: Record<AmountRole, string> = {
  QUOTED: 'Quoted',
  ESTIMATE: 'Estimate',
  CEILING: 'Ceiling',
  APPROVED: 'Approved',
  PAID: 'Paid',
  TOTAL: 'Total',
  CAP: 'Cap',
  PLANNED: 'Planned',
  ELIGIBLE: 'Eligible',
  OTHER: 'Amount',
};

export const ATTACHMENT_STATUS_META: Record<AttachmentStatus, MetaItem> = {
  READY: { label: 'Parsed & Indexed', tone: 'success', icon: 'FileCheck', tooltip: 'Attachment processed' },
  MISSING_FILE: { label: 'Missing', tone: 'error', icon: 'FileX', tooltip: 'Attachment referenced but file missing' },
  UNSUPPORTED: { label: 'Unsupported', tone: 'neutral', icon: 'FileText', tooltip: 'Unsupported file format' },
  OVERSIZE: { label: 'Oversize', tone: 'warning', icon: 'FileWarning', tooltip: 'File exceeds processing limit' },
  ENCRYPTED: { label: 'Encrypted', tone: 'warning', icon: 'Lock', tooltip: 'Password protected' },
  CORRUPT: { label: 'Corrupt', tone: 'error', icon: 'FileX', tooltip: 'Unreadable attachment file' },
  MALWARE_FLAGGED: { label: 'Flagged', tone: 'error', icon: 'ShieldAlert', tooltip: 'Security scanning flag' },
  EXTRACTION_FAILED: { label: 'Extraction Failed', tone: 'error', icon: 'FileWarning', tooltip: 'Text extraction failed' },
  PENDING: { label: 'Pending', tone: 'info', icon: 'Clock', tooltip: 'Queued for processing' },
};

export const CONDITION_STATE_META: Record<string, MetaItem> = {
  FULFILLED: { label: 'Fulfilled', tone: 'success', icon: 'CheckCircle2', tooltip: 'Condition satisfied' },
  PENDING: { label: 'Pending', tone: 'warning', icon: 'Clock', tooltip: 'Precondition pending' },
  NOT_EVIDENCED: { label: 'Not Evidenced', tone: 'neutral', icon: 'HelpCircle', tooltip: 'No evidence found in emails' },
};

export const DEADLINE_STATE_META: Record<DeadlineState, MetaItem> = {
  NONE: { label: 'No deadline', tone: 'neutral', tooltip: 'No explicit deadline stated' },
  UPCOMING: { label: 'Upcoming', tone: 'info', icon: 'Clock', tooltip: 'Approaching target deadline' },
  OVERDUE: { label: 'Overdue', tone: 'error', icon: 'AlertTriangle', tooltip: 'Deadline has passed' },
  MET: { label: 'Met on time', tone: 'success', icon: 'CheckCircle2', tooltip: 'Completed before deadline' },
  MISSED: { label: 'Missed', tone: 'error', icon: 'XCircle', tooltip: 'Target deadline missed' },
  UNDETERMINED: { label: 'Undetermined', tone: 'neutral', icon: 'HelpCircle', tooltip: 'Status undetermined' },
};

export const DECISION_STATUS_META: Record<DecisionStatus, MetaItem> = {
  ACTIVE: { label: 'Active', tone: 'success', icon: 'CheckCircle2', tooltip: 'Authoritative and binding' },
  CONDITION_PENDING: { label: 'Conditional', tone: 'warning', icon: 'Clock', tooltip: 'Preconditions pending fulfillment' },
  FULFILLED: { label: 'Fulfilled', tone: 'success', icon: 'ShieldCheck', tooltip: 'Completed and fulfilled' },
  SUPERSEDED: { label: 'Superseded', tone: 'neutral', icon: 'Minus', tooltip: 'Superseded by subsequent decision' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'error', icon: 'XCircle', tooltip: 'Formally rescinded or cancelled' },
};

export const DECISION_TYPE_META: Record<DecisionType, MetaItem> = {
  APPROVAL: { label: 'Approval', tone: 'success', icon: 'CheckCircle2', tooltip: 'Formal approval granted' },
  CONDITIONAL_APPROVAL: { label: 'Conditional Approval', tone: 'warning', icon: 'Clock', tooltip: 'Approved with stated conditions' },
  LIMITED_SCOPE_ACCEPTANCE: { label: 'Limited Acceptance', tone: 'warning', icon: 'AlertTriangle', tooltip: 'Partial scope authorization' },
  REJECTION: { label: 'Rejection', tone: 'error', icon: 'XCircle', tooltip: 'Proposal rejected' },
  RECOMMENDATION: { label: 'Recommendation', tone: 'info', icon: 'ArrowUpRight', tooltip: 'Formal recommendation' },
  SELECTION: { label: 'Selection', tone: 'forest', icon: 'CheckSquare', tooltip: 'Vendor or candidate selected' },
  CONFIRMATION: { label: 'Confirmation', tone: 'success', icon: 'ShieldCheck', tooltip: 'Formally confirmed' },
};

export const PROVENANCE_META: Record<Provenance, ProvenanceMetaItem> = {
  EXPLICIT: { label: 'Explicit', tone: 'forest', icon: 'FileText', tooltip: 'Verbatim text directly in email records' },
  DERIVED_CALC: { label: 'Calculation', tone: 'info', icon: 'Calculator', tooltip: 'Mathematically derived from cited amounts' },
  INFERRED: { label: 'Inferred', tone: 'warning', icon: 'Sparkles', tooltip: 'Synthesized inference across conversation context' },
};

export const ROLE_SOURCE_META: Record<RoleSource, MetaItem> = {
  DIRECTORY: { label: 'Directory', tone: 'forest', tooltip: 'Verified institutional identity directory' },
  INFERRED_FROM_ADDRESS: { label: 'Inferred from address', tone: 'neutral', tooltip: 'Inferred from email address role patterns' },
};

export const THREAD_INTEGRITY_META: Record<ThreadIntegrity, MetaItem> = {
  COMPLETE: { label: 'Complete thread', tone: 'success', icon: 'CheckCircle2', tooltip: 'Complete conversation tree' },
  PARTIAL: { label: 'Partial thread', tone: 'warning', icon: 'AlertTriangle', tooltip: 'Some historical replies missing' },
  CONFLICT: { label: 'Branching conflict', tone: 'error', icon: 'AlertTriangle', tooltip: 'Branching inconsistency detected' },
};

export const THREAD_STATUS_META: Record<ThreadStatusClass, MetaItem> = {
  OPEN: { label: 'Open', tone: 'info', icon: 'CircleDot', tooltip: 'Ongoing communication' },
  AWAITING_ACTION: { label: 'Awaiting Action', tone: 'warning', icon: 'Clock', tooltip: 'Action items pending' },
  PARTIALLY_COMPLETE: { label: 'Partially Complete', tone: 'warning', icon: 'PieChart', tooltip: 'Some deliverables fulfilled' },
  MONITORING: { label: 'Monitoring', tone: 'neutral', icon: 'Eye', tooltip: 'Monitoring status' },
  COMPLETED: { label: 'Completed', tone: 'success', icon: 'CheckCircle2', tooltip: 'All objectives completed' },
  UNKNOWN: { label: 'Unknown', tone: 'neutral', icon: 'HelpCircle', tooltip: 'Status unknown' },
};

export function getThreadCategoryLabel(category?: string | null): string {
  if (!category) return 'General';
  const clean = category.trim();
  if (!clean) return 'General';
  return clean
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
