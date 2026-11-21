import type {
  ActionItem,
  ActionStatus,
  Answer,
  ApiMeta,
  AttachmentDetail,
  AttachmentSummary,
  ChatRequest,
  Citation,
  DeadlineState,
  Decision,
  DecisionStatus,
  DecisionType,
  EmailMessage,
  HealthStatus,
  IngestionJob,
  IngestionRecordError,
  Provenance,
  ReviewState,
  ThreadDetail,
  ThreadListItem,
  ThreadStatusClass,
  ThreadSummary,
} from '../types/api';

export interface AuthSessionUser {
  user_id: string;
  display_name: string;
  role_code: string;
  address: string | null;
  workspace_name?: string;
  mfa_enabled?: boolean;
  can_refresh_summary?: boolean;
  can_override_review?: boolean;
  can_ingest?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface LoginResult {
  status: 'AUTHENTICATED' | 'MFA_REQUIRED';
  user?: AuthSessionUser;
  mfa_challenge_id?: string;
}

export interface PageResult<T> {
  items: T[];
  meta?: ApiMeta;
}

export interface EmailListParams {
  sender?: string;
  subject?: string;
  thread_key?: string;
  category?: string;
  has_attachments?: 'yes' | 'no' | 'all';
  date_from?: string;
  date_to?: string;
  q?: string;
  limit?: number;
  cursor?: string | null;
}

export interface ThreadListParams {
  category?: string;
  status_class?: ThreadStatusClass | '';
  participant?: string;
  date_from?: string;
  date_to?: string;
  has_pending_actions?: 'yes' | 'no' | '';
  has_decision?: 'yes' | 'no' | '';
  sort_by?: 'last_message_at' | 'message_count' | 'title';
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  cursor?: string | null;
}

export interface DecisionListParams {
  type?: DecisionType | '';
  status?: DecisionStatus | '';
  provenance?: Provenance | '';
  person?: string;
  category?: string;
  thread_key?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: 'decided_at' | 'type' | 'status';
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  cursor?: string | null;
}

export interface ActionListParams {
  status?: ActionStatus | '';
  deadline_state?: DeadlineState | '';
  owner?: string;
  thread_key?: string;
  provenance?: Provenance | '';
  due_from?: string;
  due_to?: string;
  sort_by?: 'status' | 'deadline' | 'thread_key';
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  cursor?: string | null;
}

export interface SearchHit {
  hit_id: string;
  level: 'email' | 'attachment' | 'thread' | 'decision' | 'action';
  thread_key: string;
  email_id?: string;
  attachment_id?: string;
  title: string;
  snippet: string;
  timestamp?: string;
}

export interface TopicItem {
  category: string;
  thread_count: number;
  last_activity_at: string;
}

export interface AnalyticsOverview {
  total_emails: number | null;
  total_threads: number | null;
  total_decisions: number | null;
  pending_actions: number | null;
  as_of: string | null;
}

export interface EvaluationRun {
  run_id: string;
  created_at: string;
  dataset_name?: string;
  scores?: Record<string, number>;
  status: string;
}

export interface DataSource {
  readonly mode: 'demo' | 'live';

  health(): Promise<HealthStatus>;
  authMe(): Promise<AuthSessionUser | null>;
  authLogin(credentials: LoginCredentials): Promise<LoginResult>;
  authLogout(): Promise<void>;

  getAnalyticsOverview(): Promise<AnalyticsOverview>;
  getTopics(): Promise<TopicItem[]>;

  listEmails(params?: EmailListParams): Promise<PageResult<EmailMessage>>;
  getEmail(emailId: string): Promise<EmailMessage>;

  listThreads(params?: ThreadListParams): Promise<PageResult<ThreadListItem>>;
  getThread(threadKey: string): Promise<ThreadDetail>;
  getThreadSummary(threadKey: string): Promise<ThreadSummary>;
  refreshThreadSummary(threadKey: string): Promise<ThreadSummary>;

  search(query: string, signal?: AbortSignal): Promise<{ items: SearchHit[]; degraded?: boolean }>;
  ask(
    request: ChatRequest,
    signal?: AbortSignal,
    onStreamEvent?: (phase: 'verifying_sources') => void,
  ): Promise<Answer>;
  submitAnswerFeedback(
    answerId: string,
    feedback: { rating: 'HELPFUL' | 'NOT_HELPFUL' | 'WRONG' | 'MISSING_SOURCE'; comment?: string },
  ): Promise<void>;
  getCitation(citationId: string): Promise<Citation>;

  listDecisions(params?: DecisionListParams): Promise<PageResult<Decision>>;
  getDecision(decisionId: string): Promise<Decision>;

  listActions(params?: ActionListParams): Promise<PageResult<ActionItem>>;
  patchActionReview(
    actionId: string,
    payload: { review_state: ReviewState; status?: ActionStatus; note?: string },
  ): Promise<ActionItem>;

  listAttachments(threadKey?: string): Promise<AttachmentSummary[]>;
  getAttachment(attachmentId: string): Promise<AttachmentDetail>;
  getAttachmentDownloadUrl(attachmentId: string): Promise<string | null>;

  listIngestionJobs(): Promise<IngestionJob[]>;
  getIngestionJob(jobId: string): Promise<IngestionJob>;
  getIngestionRecords(
    jobId: string,
    status?: 'FAILED' | 'DUPLICATE_EXACT' | 'CONFLICTING_DUPLICATE',
  ): Promise<IngestionRecordError[]>;
  createIngestionJob(params: {
    emailsCsv: File;
    attachments: File[];
    onProgress?: (percent: number) => void;
  }): Promise<IngestionJob>;

  listEvaluationRuns(): Promise<EvaluationRun[]>;
}
