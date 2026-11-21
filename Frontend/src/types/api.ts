// ============ SUTRA frontend contract (mirrors PRD v1.0 §12 wire format; snake_case) ============
export type ISODateTime = string; // UTC ISO-8601 ("...Z") unless a field name ends with _local

// ---- Envelope & errors ----
export interface ApiMeta { request_id?: string; next_cursor?: string | null; total_estimate?: number | null; scope?: string }
export interface ApiEnvelope<T> { data: T; meta?: ApiMeta }
export type ApiErrorCode =
  | 'AUTH_REQUIRED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE' | 'RATE_LIMITED' | 'DEPENDENCY_UNAVAILABLE' | 'UPSTREAM_TIMEOUT' | 'INTERNAL_ERROR';
export interface ApiErrorBody { error: { code: ApiErrorCode | (string & {}); message: string; details?: unknown[]; request_id?: string } }

// ---- People ----
export type RoleSource = 'DIRECTORY' | 'INFERRED_FROM_ADDRESS';
export interface Person { address: string; role: string | null; role_source: RoleSource | null; is_shared_mailbox?: boolean }

// ---- Attachments ----
export type AttachmentStatus =
  | 'READY' | 'MISSING_FILE' | 'UNSUPPORTED' | 'OVERSIZE' | 'ENCRYPTED' | 'CORRUPT' | 'MALWARE_FLAGGED' | 'EXTRACTION_FAILED' | 'PENDING';
export interface AttachmentSummary {
  attachment_id: string; filename: string; status: AttachmentStatus;
  size_bytes?: number | null; detected_mime?: string | null; status_detail?: string | null;
}
export interface AttachmentDetail extends AttachmentSummary {
  email_id: string; thread_key: string; text_content: string | null;
  table: { columns: string[]; rows: string[][] } | null; ocr_confidence?: number | null;
}

// ---- Emails ----
export interface Mention {
  kind: 'AMOUNT' | 'DATE' | 'TIME' | 'IDENTIFIER' | 'QUANTITY';
  original_text: string; normalized_value: string | number; unit: string | null; timezone_label: string | null;
}
export interface EmailMessage {
  email_id: string; thread_key: string; subject: string | null;
  timestamp: ISODateTime; timestamp_local?: string;
  sender: Person; recipients: Person[];
  body_raw: string; body_preview?: string;
  in_reply_to: string | null; attachments: AttachmentSummary[];
  quality_flags: string[]; mentions?: Mention[]; category?: string | null;
}

// ---- Threads ----
export type ThreadStatusClass = 'OPEN' | 'AWAITING_ACTION' | 'PARTIALLY_COMPLETE' | 'MONITORING' | 'COMPLETED' | 'UNKNOWN';
export type ThreadIntegrity = 'COMPLETE' | 'PARTIAL' | 'CONFLICT';
export type ReviewState = 'NONE' | 'PENDING' | 'CONFIRMED' | 'CORRECTED' | 'REJECTED';
export interface ThreadListItem {
  thread_key: string; title: string | null; category: string | null; status_class: ThreadStatusClass;
  integrity: ThreadIntegrity; first_message_at: ISODateTime; last_message_at: ISODateTime;
  message_count: number; participants: Person[]; attachment_count?: number;
}
export interface ThreadEdge {
  child_email_id: string; parent_email_id: string | null;
  edge_type: 'REPLY_TO' | 'FORWARD_OF' | 'SAME_TOPIC_CANDIDATE'; anomaly?: string | null;
}
export interface ThreadDetail extends ThreadListItem {
  message_ids: string[]; edges: ThreadEdge[];
  reconstruction: { method: string; confidence: number; review_state: ReviewState };
}

// ---- Summaries ----
export type VerificationStatus = 'VERIFIED' | 'DRAFT_UNVERIFIED' | 'FAILED';
export interface CitedStatement { text: string; email_ids: string[] }
export interface TimelineEvent { date: ISODateTime; event: string; email_ids: string[] }
export interface LatestStatus { class: ThreadStatusClass; text: string; as_of_email_id: string; as_of_time: ISODateTime }
export interface ThreadSummaryContent {
  purpose: string; initial_context: string; discussion_points: CitedStatement[]; timeline: TimelineEvent[];
  latest_status: LatestStatus; pending_action_ids: string[]; pending_note: string | null;
  deadlines: CitedStatement[]; unresolved: CitedStatement[];
}
export interface ThreadSummary {
  thread_key: string; summary_version: number; verification_status: VerificationStatus; stale: boolean;
  generated_by?: string; content: ThreadSummaryContent;
}

// ---- Evidence, decisions, actions ----
export type Provenance = 'EXPLICIT' | 'DERIVED_CALC' | 'INFERRED';
export interface Evidence {
  email_id: string; quote: string; role?: 'PRIMARY' | 'CORROBORATING' | 'CONTEXT';
  attachment_id?: string | null; attachment_filename?: string | null;
}
export type AmountRole = 'QUOTED' | 'ESTIMATE' | 'CEILING' | 'APPROVED' | 'PAID' | 'TOTAL' | 'CAP' | 'PLANNED' | 'ELIGIBLE' | 'OTHER';
export interface Amount { role: AmountRole; value_inr: number | null; original_text: string; basis: 'TOTAL' | 'PER_UNIT' | null; derived?: boolean }
export type DecisionType =
  | 'APPROVAL' | 'CONDITIONAL_APPROVAL' | 'LIMITED_SCOPE_ACCEPTANCE' | 'REJECTION' | 'RECOMMENDATION' | 'SELECTION' | 'CONFIRMATION';
export type DecisionStatus = 'ACTIVE' | 'CONDITION_PENDING' | 'FULFILLED' | 'SUPERSEDED' | 'WITHDRAWN';
export type ConditionState = 'FULFILLED' | 'PENDING' | 'NOT_EVIDENCED' | null;
export interface ConditionItem { text: string; state?: ConditionState; evidence_email_ids?: string[] }
export interface DecisionScope { authorizes: string[]; excludes: string[]; conditions: Array<ConditionItem | string> }
export interface Decision {
  decision_id: string; thread_key: string; type: DecisionType; subject: string; outcome: string;
  approver: Person | null; recommended_by: Person | null; confirmed_by: Person | null;
  attribution_note?: string | null; authority_basis?: string | null;
  decided_at: ISODateTime; event_date?: string | null; amounts: Amount[]; scope: DecisionScope;
  status: DecisionStatus; supersedes_id?: string | null; provenance: Provenance;
  confidence?: number | null; review_state: ReviewState; evidence: Evidence[];
}
export type ActionKind = 'REQUEST' | 'INSTRUCTION' | 'COMMITMENT' | 'CONDITIONAL_NEXT_STEP';
export type ActionStatus = 'OPEN' | 'DONE' | 'CONDITIONAL' | 'CANCELLED' | 'SUPERSEDED' | 'IN_PROGRESS' | 'BLOCKED';
export type DeadlineState = 'NONE' | 'UPCOMING' | 'OVERDUE' | 'MET' | 'MISSED' | 'UNDETERMINED';
export interface Deadline { date: string | null; text: string | null; precision: 'DATE' | 'DATETIME' | 'RELATIVE' | null }
export interface ActionItem {
  action_id: string; thread_key: string; action_kind: ActionKind; task: string;
  owner: Person | null; owner_basis: 'EXPLICIT' | 'INFERRED' | null; requested_by: Person | null;
  deadline: Deadline; status: ActionStatus; deadline_state: DeadlineState; completed_at?: ISODateTime | null;
  provenance: Provenance; confidence?: number | null; review_state: ReviewState; status_basis: string;
  evidence: Evidence[]; completion_evidence: Evidence[];
}

// ---- Answers (RAG) ----
export type AnswerStatus =
  | 'ANSWERED' | 'PARTIAL' | 'INSUFFICIENT_EVIDENCE' | 'CONFLICTING_EVIDENCE'
  | 'CLARIFICATION_NEEDED' | 'DEGRADED' | 'FAILED';
export interface Citation {
  citation_id: string; email_id: string; thread_id: string; timestamp: ISODateTime;
  sender?: Person | null; subject?: string | null; quote: string;
  attachment_id?: string | null; attachment_filename?: string | null;
  evidence_role?: 'PRIMARY' | 'CORROBORATING' | 'CONTEXT';
  verification?: { email_exists: boolean; access_ok: boolean; quote_found: boolean; values_match?: boolean };
}
export interface CalculationOperand { label: string; value_inr: number; citation_ids: string[] }
export interface Calculation { operation: 'SUM' | 'DIFFERENCE' | 'PRODUCT'; operands: CalculationOperand[]; result_inr: number }
export interface AnswerBlock { claim_id: string; claim_type: Provenance; text: string; citation_ids: string[]; calculation?: Calculation }
export interface ClarificationOption { label: string; question: string; thread_scope: string | null }
export interface Answer {
  answer_id: string; status: AnswerStatus; question?: string; intents?: string[]; as_of?: ISODateTime;
  answer_blocks: AnswerBlock[];
  structured?: { decision_ids?: string[]; action_ids?: string[]; latest_status?: { class: ThreadStatusClass; text: string; as_of_email_id: string } };
  caveats: string[]; citations: Citation[];
  confidence?: { level: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[] } | null;
  validation?: { passed: boolean; repairs: number; removed_claims: number };
  search_scope?: { threads_searched: number; date_range: [string, string] } | null;
  suggestions?: string[]; options?: ClarificationOption[]; thread_scope?: string | null;
  provenance?: 'DEMO_PREAUTHORED' | 'LIVE';
}
export interface ChatRequest { question: string; thread_scope?: string | null; session_id?: string | null; filters?: Record<string, unknown>; stream?: boolean }
// Proposed legacy contract from the product brief; normalise into Answer at the service boundary.
export interface LegacyChatAnswer {
  answer: string; status: 'answered' | 'insufficient_evidence' | 'conflicting_evidence' | 'clarification_needed' | 'error';
  claims: Array<{ text: string; source_email_ids: string[] }>;
  sources: Array<{ email_id: string; thread_id: string; subject: string; timestamp: ISODateTime }>;
  limitations: string[];
}

// ---- Ingestion ----
export type IngestionStageName =
  | 'file_received' | 'schema_validation' | 'records_parsed' | 'threads_reconstructed' | 'attachments_registered' | 'index_prepared' | 'workspace_ready';
export interface IngestionStage { name: IngestionStageName; status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED' }
export interface IngestionJob {
  job_id: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED';
  source_file_name?: string | null; created_at: ISODateTime | null; finished_at: ISODateTime | null;
  counts: { rows_total: number; rows_ok: number; rows_failed: number; rows_duplicate: number; attachments_linked: number; threads: number };
  warnings: string[]; stages: IngestionStage[];
}
export interface IngestionRecordError { row_number: number; status: 'FAILED' | 'DUPLICATE_EXACT' | 'CONFLICTING_DUPLICATE'; reason_code: string; message?: string }

// ---- Misc ----
export interface HealthStatus { status: 'ok' | 'degraded' | 'down'; version?: string; components?: Record<string, 'ok' | 'degraded' | 'down'> }
export interface Persona { persona_id: string; display_name: string; role_code: string; address: string | null }
export interface DemoMeta {
  dataset: string; as_of: ISODateTime; is_demo: true; visibility_policy: 'THREAD_PARTICIPANT' | 'MESSAGE_PARTICIPANT';
  counts: { emails: number; threads: number; attachments: number; sample_queries: number; evaluation_cases: number }; notice: string;
}
export interface DemoAnswerEntry { demo_key: string; matches: Array<{ question: string; scope: string | null }>; answer: Answer }
export interface DemoDataset {
  meta: DemoMeta; personas: Persona[]; directory: Person[]; emails: EmailMessage[]; attachments: AttachmentDetail[];
  threads: ThreadDetail[]; summaries: ThreadSummary[]; decisions: Decision[]; actions: ActionItem[];
  answers: DemoAnswerEntry[]; ingestion_jobs: IngestionJob[]; suggested_questions: string[];
}
