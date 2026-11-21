import { DEMO_DATASET } from '../data/demoData';
import type {
  ActionItem,
  ActionStatus,
  Answer,
  AttachmentDetail,
  AttachmentSummary,
  ChatRequest,
  Citation,
  Decision,
  EmailMessage,
  HealthStatus,
  IngestionJob,
  IngestionRecordError,
  Persona,
  ReviewState,
  ThreadDetail,
  ThreadListItem,
  ThreadSummary,
} from '../types/api';
import type {
  ActionListParams,
  AnalyticsOverview,
  AuthSessionUser,
  DataSource,
  DecisionListParams,
  EmailListParams,
  EvaluationRun,
  LoginCredentials,
  LoginResult,
  PageResult,
  SearchHit,
  ThreadListParams,
  TopicItem,
} from './dataSource';

function normaliseMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function paginate<T>(items: T[], limit = 25, cursor?: string | null): PageResult<T> {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
  const slice = items.slice(offset, offset + safeLimit);
  const nextOffset = offset + slice.length;
  return {
    items: slice,
    meta: {
      total_estimate: items.length,
      next_cursor: nextOffset < items.length ? String(nextOffset) : null,
      scope: 'demo',
    },
  };
}

export class DemoAdapter implements DataSource {
  readonly mode = 'demo' as const;
  private activePersona: Persona | null = null;

  setPersona(persona: Persona | null) {
    this.activePersona = persona;
  }

  getPersona(): Persona | null {
    return this.activePersona;
  }

  private getVisibleThreadKeys(): Set<string> {
    if (!this.activePersona || !this.activePersona.address) {
      return new Set(DEMO_DATASET.threads.map((t) => t.thread_key));
    }
    const addr = this.activePersona.address.toLowerCase();
    const visible = new Set<string>();
    for (const email of DEMO_DATASET.emails) {
      const isSender = email.sender.address.toLowerCase() === addr;
      const isRecipient = email.recipients.some((r) => r.address.toLowerCase() === addr);
      if (isSender || isRecipient) {
        visible.add(email.thread_key);
      }
    }
    return visible;
  }

  private getVisibleEmails(): EmailMessage[] {
    const keys = this.getVisibleThreadKeys();
    return DEMO_DATASET.emails.filter((e) => keys.has(e.thread_key));
  }

  private getVisibleThreads(): ThreadDetail[] {
    const keys = this.getVisibleThreadKeys();
    return DEMO_DATASET.threads.filter((t) => keys.has(t.thread_key));
  }

  private getVisibleDecisions(): Decision[] {
    const keys = this.getVisibleThreadKeys();
    return DEMO_DATASET.decisions.filter((d) => keys.has(d.thread_key));
  }

  private getVisibleActions(): ActionItem[] {
    const keys = this.getVisibleThreadKeys();
    return DEMO_DATASET.actions.filter((a) => keys.has(a.thread_key));
  }

  private getVisibleAttachments(): AttachmentDetail[] {
    const keys = this.getVisibleThreadKeys();
    return DEMO_DATASET.attachments.filter((a) => keys.has(a.thread_key));
  }

  async health(): Promise<HealthStatus> {
    return { status: 'ok', version: 'demo-benchmark' };
  }

  async authMe(): Promise<AuthSessionUser | null> {
    if (!this.activePersona) return null;
    return {
      user_id: this.activePersona.persona_id,
      display_name: this.activePersona.display_name,
      role_code: this.activePersona.role_code,
      address: this.activePersona.address,
      workspace_name: 'Northbridge — demo workspace',
      can_refresh_summary: false,
      can_override_review: false,
      can_ingest: false,
    };
  }

  async authLogin(_credentials: LoginCredentials): Promise<LoginResult> {
    throw new Error('Password login is only used in live mode.');
  }

  async authLogout(): Promise<void> {
    this.activePersona = null;
  }

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const emails = this.getVisibleEmails();
    const threads = this.getVisibleThreads();
    const decisions = this.getVisibleDecisions();
    const actions = this.getVisibleActions();
    const pending = actions.filter((a) => a.status === 'OPEN' || a.status === 'CONDITIONAL').length;
    return {
      total_emails: emails.length,
      total_threads: threads.length,
      total_decisions: decisions.length,
      pending_actions: pending,
      as_of: DEMO_DATASET.meta.as_of,
    };
  }

  async getTopics(): Promise<TopicItem[]> {
    const map = new Map<string, TopicItem>();
    for (const thread of this.getVisibleThreads()) {
      const category = thread.category || 'UNCATEGORISED';
      const existing = map.get(category);
      if (!existing) {
        map.set(category, {
          category,
          thread_count: 1,
          last_activity_at: thread.last_message_at,
        });
      } else {
        existing.thread_count += 1;
        if (thread.last_message_at > existing.last_activity_at) {
          existing.last_activity_at = thread.last_message_at;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      b.last_activity_at.localeCompare(a.last_activity_at),
    );
  }

  async listEmails(params: EmailListParams = {}): Promise<PageResult<EmailMessage>> {
    const threadCategory = new Map<string, string | null>(
      DEMO_DATASET.threads.map((t) => [t.thread_key, t.category]),
    );
    let items = this.getVisibleEmails().slice();

    if (params.sender) {
      const s = params.sender.toLowerCase();
      items = items.filter(
        (e) =>
          e.sender.address.toLowerCase().includes(s) ||
          (e.sender.role && e.sender.role.toLowerCase().includes(s)),
      );
    }
    if (params.subject) {
      const sub = params.subject.toLowerCase();
      items = items.filter((e) => (e.subject || '').toLowerCase().includes(sub));
    }
    if (params.thread_key) {
      items = items.filter((e) => e.thread_key === params.thread_key);
    }
    if (params.category) {
      items = items.filter(
        (e) => (e.category || threadCategory.get(e.thread_key)) === params.category,
      );
    }
    if (params.has_attachments === 'yes') {
      items = items.filter((e) => e.attachments.length > 0);
    } else if (params.has_attachments === 'no') {
      items = items.filter((e) => e.attachments.length === 0);
    }
    if (params.date_from) {
      items = items.filter((e) => e.timestamp >= params.date_from!);
    }
    if (params.date_to) {
      const end = params.date_to.length === 10 ? `${params.date_to}T23:59:59Z` : params.date_to;
      items = items.filter((e) => e.timestamp <= end);
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (e) =>
          (e.subject || '').toLowerCase().includes(q) ||
          e.body_raw.toLowerCase().includes(q) ||
          e.email_id.toLowerCase().includes(q) ||
          e.sender.address.toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return paginate(items, params.limit, params.cursor);
  }

  async getEmail(emailId: string): Promise<EmailMessage> {
    const visible = this.getVisibleEmails();
    const found = visible.find((e) => e.email_id === emailId);
    if (!found) {
      throw new Error('The requested item is not available.');
    }
    return found;
  }

  async listThreads(params: ThreadListParams = {}): Promise<PageResult<ThreadListItem>> {
    const actions = this.getVisibleActions();
    const decisions = this.getVisibleDecisions();
    let items = this.getVisibleThreads().slice();

    if (params.category) {
      items = items.filter((t) => t.category === params.category);
    }
    if (params.status_class) {
      items = items.filter((t) => t.status_class === params.status_class);
    }
    if (params.participant) {
      const p = params.participant.toLowerCase();
      items = items.filter((t) =>
        t.participants.some(
          (person) =>
            person.address.toLowerCase().includes(p) ||
            (person.role && person.role.toLowerCase().includes(p)),
        ),
      );
    }
    if (params.date_from) {
      items = items.filter((t) => t.last_message_at >= params.date_from!);
    }
    if (params.date_to) {
      const end = params.date_to.length === 10 ? `${params.date_to}T23:59:59Z` : params.date_to;
      items = items.filter((t) => t.first_message_at <= end);
    }
    if (params.has_pending_actions === 'yes') {
      const pendingThreads = new Set(
        actions.filter((a) => a.status === 'OPEN' || a.status === 'CONDITIONAL').map((a) => a.thread_key),
      );
      items = items.filter((t) => pendingThreads.has(t.thread_key));
    } else if (params.has_pending_actions === 'no') {
      const pendingThreads = new Set(
        actions.filter((a) => a.status === 'OPEN' || a.status === 'CONDITIONAL').map((a) => a.thread_key),
      );
      items = items.filter((t) => !pendingThreads.has(t.thread_key));
    }
    if (params.has_decision === 'yes') {
      const decThreads = new Set(decisions.map((d) => d.thread_key));
      items = items.filter((t) => decThreads.has(t.thread_key));
    } else if (params.has_decision === 'no') {
      const decThreads = new Set(decisions.map((d) => d.thread_key));
      items = items.filter((t) => !decThreads.has(t.thread_key));
    }

    const dir = params.sort_dir === 'asc' ? 1 : -1;
    const sortBy = params.sort_by || 'last_message_at';
    items.sort((a, b) => {
      if (sortBy === 'message_count') return (a.message_count - b.message_count) * dir;
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '') * dir;
      return a.last_message_at.localeCompare(b.last_message_at) * dir;
    });

    return paginate(items, params.limit, params.cursor);
  }

  async getThread(threadKey: string): Promise<ThreadDetail> {
    const found = this.getVisibleThreads().find((t) => t.thread_key === threadKey);
    if (!found) {
      throw new Error('The requested item is not available.');
    }
    return found;
  }

  async getThreadSummary(threadKey: string): Promise<ThreadSummary> {
    const visible = this.getVisibleThreadKeys();
    if (!visible.has(threadKey)) {
      throw new Error('The requested item is not available.');
    }
    const found = DEMO_DATASET.summaries.find((s) => s.thread_key === threadKey);
    if (!found) {
      throw new Error('The requested item is not available.');
    }
    return found;
  }

  async refreshThreadSummary(_threadKey: string): Promise<ThreadSummary> {
    throw new Error('Summary regeneration requires the live backend.');
  }

  async search(query: string): Promise<{ items: SearchHit[]; degraded?: boolean }> {
    const q = query.trim().toLowerCase();
    if (!q) return { items: [] };

    const hits: SearchHit[] = [];
    for (const t of this.getVisibleThreads()) {
      if ((t.title || '').toLowerCase().includes(q) || t.thread_key.toLowerCase().includes(q)) {
        hits.push({
          hit_id: `thread:${t.thread_key}`,
          level: 'thread',
          thread_key: t.thread_key,
          title: t.title || t.thread_key,
          snippet: `${t.message_count} messages · ${t.status_class}`,
          timestamp: t.last_message_at,
        });
      }
    }
    for (const e of this.getVisibleEmails()) {
      if (
        e.body_raw.toLowerCase().includes(q) ||
        (e.subject || '').toLowerCase().includes(q) ||
        e.email_id.toLowerCase().includes(q) ||
        e.sender.address.toLowerCase().includes(q) ||
        (e.sender.role || '').toLowerCase().includes(q)
      ) {
        hits.push({
          hit_id: `email:${e.email_id}`,
          level: 'email',
          thread_key: e.thread_key,
          email_id: e.email_id,
          title: `${e.email_id} · ${e.subject || 'Untitled'}`,
          snippet: e.body_preview || e.body_raw.slice(0, 140),
          timestamp: e.timestamp,
        });
      }
    }
    for (const att of this.getVisibleAttachments()) {
      if (
        att.filename.toLowerCase().includes(q) ||
        (att.text_content || '').toLowerCase().includes(q)
      ) {
        hits.push({
          hit_id: `att:${att.attachment_id}`,
          level: 'attachment',
          thread_key: att.thread_key,
          email_id: att.email_id,
          attachment_id: att.attachment_id,
          title: att.filename,
          snippet: (att.text_content || '').slice(0, 140),
        });
      }
    }
    for (const d of this.getVisibleDecisions()) {
      if (d.subject.toLowerCase().includes(q) || d.outcome.toLowerCase().includes(q)) {
        hits.push({
          hit_id: `dec:${d.decision_id}`,
          level: 'decision',
          thread_key: d.thread_key,
          email_id: d.evidence[0]?.email_id,
          title: d.subject,
          snippet: d.outcome,
          timestamp: d.decided_at,
        });
      }
    }
    for (const a of this.getVisibleActions()) {
      if (a.task.toLowerCase().includes(q) || a.status_basis.toLowerCase().includes(q)) {
        hits.push({
          hit_id: `act:${a.action_id}`,
          level: 'action',
          thread_key: a.thread_key,
          email_id: a.evidence[0]?.email_id,
          title: a.task,
          snippet: a.status_basis,
        });
      }
    }

    return { items: hits.slice(0, 30) };
  }

  async ask(request: ChatRequest): Promise<Answer> {
    const normQ = normaliseMatchText(request.question);
    const reqScope = request.thread_scope ?? null;
    const visibleKeys = this.getVisibleThreadKeys();

    const findMatch = (entry: (typeof DEMO_DATASET.answers)[number], exactOnly: boolean) =>
      entry.matches.some((m) => {
        const normM = normaliseMatchText(m.question);
        if (normM !== normQ) return false;
        if (reqScope) {
          if (m.scope === reqScope) return true;
          if (
            !exactOnly &&
            m.scope === null &&
            (entry.answer.thread_scope === reqScope ||
              (reqScope === 'ALL' && entry.answer.thread_scope === null))
          ) {
            return true;
          }
          return false;
        }
        return m.scope === null;
      });

    const matchedEntry =
      DEMO_DATASET.answers.find((entry) => findMatch(entry, true)) ||
      (reqScope ? DEMO_DATASET.answers.find((entry) => findMatch(entry, false)) : undefined);

    if (matchedEntry) {
      const candidate = matchedEntry.answer;
      if (
        candidate.thread_scope &&
        candidate.thread_scope !== 'ALL' &&
        !visibleKeys.has(candidate.thread_scope)
      ) {
        return {
          answer_id: `ans-demo-restricted-${Date.now()}`,
          status: 'INSUFFICIENT_EVIDENCE',
          question: request.question,
          as_of: DEMO_DATASET.meta.as_of,
          answer_blocks: [
            {
              claim_id: 'c1',
              claim_type: 'EXPLICIT',
              text: 'I could not find sufficient supporting information in the available email records.',
              citation_ids: [],
            },
          ],
          caveats: [
            'Demo persona — visibility illustrated in the browser, not enforced. No records from this conversation are visible to the selected persona.',
          ],
          citations: [],
          thread_scope: reqScope,
          provenance: 'DEMO_PREAUTHORED',
        };
      }
      if (candidate.status === 'CLARIFICATION_NEEDED' && candidate.options) {
        return {
          ...candidate,
          options: candidate.options.filter(
            (o) => !o.thread_scope || o.thread_scope === 'ALL' || visibleKeys.has(o.thread_scope),
          ),
        };
      }
      if (candidate.thread_scope === 'ALL' && this.activePersona?.address) {
        const visibleCitations = candidate.citations.filter((c) => visibleKeys.has(c.thread_id));
        const visibleCitIds = new Set(visibleCitations.map((c) => c.citation_id));
        const visibleBlocks = candidate.answer_blocks.filter((b) =>
          b.citation_ids.some((id) => visibleCitIds.has(id)),
        );
        return {
          ...candidate,
          answer_blocks: visibleBlocks,
          citations: visibleCitations,
        };
      }
      return candidate;
    }

    return {
      answer_id: `ans-demo-unmatched-${Date.now()}`,
      status: 'INSUFFICIENT_EVIDENCE',
      question: request.question,
      as_of: DEMO_DATASET.meta.as_of,
      answer_blocks: [
        {
          claim_id: 'c1',
          claim_type: 'EXPLICIT',
          text: 'Demo mode answers the suggested questions only. Connect the backend (live mode) to ask free-form questions.',
          citation_ids: [],
        },
      ],
      caveats: [
        'Pre-authored demo answer — not generated by a model.',
      ],
      citations: [],
      suggestions: DEMO_DATASET.suggested_questions.slice(0, 4),
      thread_scope: reqScope,
      provenance: 'DEMO_PREAUTHORED',
    };
  }

  async submitAnswerFeedback(): Promise<void> {
    // No-op in demo mode; feedback button is hidden/disabled in demo mode.
  }

  async getCitation(citationId: string): Promise<Citation> {
    const visibleKeys = this.getVisibleThreadKeys();
    for (const entry of DEMO_DATASET.answers) {
      const cit = entry.answer.citations.find((c) => c.citation_id === citationId);
      if (cit && visibleKeys.has(cit.thread_id)) return cit;
    }
    throw new Error('The requested item is not available.');
  }

  async listDecisions(params: DecisionListParams = {}): Promise<PageResult<Decision>> {
    const threadCategory = new Map<string, string | null>(
      DEMO_DATASET.threads.map((t) => [t.thread_key, t.category]),
    );
    let items = this.getVisibleDecisions().slice();

    if (params.type) items = items.filter((d) => d.type === params.type);
    if (params.status) items = items.filter((d) => d.status === params.status);
    if (params.provenance) items = items.filter((d) => d.provenance === params.provenance);
    if (params.thread_key) items = items.filter((d) => d.thread_key === params.thread_key);
    if (params.category) {
      items = items.filter((d) => threadCategory.get(d.thread_key) === params.category);
    }
    if (params.person) {
      const p = params.person.toLowerCase();
      items = items.filter((d) =>
        [d.approver, d.recommended_by, d.confirmed_by]
          .filter(Boolean)
          .some(
            (person) =>
              person!.address.toLowerCase().includes(p) ||
              (person!.role && person!.role.toLowerCase().includes(p)),
          ),
      );
    }
    if (params.date_from) items = items.filter((d) => d.decided_at >= params.date_from!);
    if (params.date_to) {
      const end = params.date_to.length === 10 ? `${params.date_to}T23:59:59Z` : params.date_to;
      items = items.filter((d) => d.decided_at <= end);
    }

    const dir = params.sort_dir === 'asc' ? 1 : -1;
    const sortBy = params.sort_by || 'decided_at';
    items.sort((a, b) => {
      if (sortBy === 'type') return a.type.localeCompare(b.type) * dir;
      if (sortBy === 'status') return a.status.localeCompare(b.status) * dir;
      return a.decided_at.localeCompare(b.decided_at) * dir;
    });

    return paginate(items, params.limit, params.cursor);
  }

  async getDecision(decisionId: string): Promise<Decision> {
    const found = this.getVisibleDecisions().find((d) => d.decision_id === decisionId);
    if (!found) throw new Error('The requested item is not available.');
    return found;
  }

  async listActions(params: ActionListParams = {}): Promise<PageResult<ActionItem>> {
    let items = this.getVisibleActions().slice();

    if (params.status) items = items.filter((a) => a.status === params.status);
    if (params.deadline_state) {
      items = items.filter((a) => a.deadline_state === params.deadline_state);
    }
    if (params.provenance) items = items.filter((a) => a.provenance === params.provenance);
    if (params.thread_key) items = items.filter((a) => a.thread_key === params.thread_key);
    if (params.owner) {
      const o = params.owner.toLowerCase();
      if (o === '__unowned__') {
        items = items.filter((a) => !a.owner);
      } else {
        items = items.filter(
          (a) =>
            a.owner &&
            (a.owner.address.toLowerCase().includes(o) ||
              (a.owner.role && a.owner.role.toLowerCase().includes(o))),
        );
      }
    }
    if (params.due_from) {
      items = items.filter((a) => a.deadline.date && a.deadline.date >= params.due_from!);
    }
    if (params.due_to) {
      const end = params.due_to.length === 10 ? `${params.due_to}T23:59:59+05:30` : params.due_to;
      items = items.filter((a) => a.deadline.date && a.deadline.date <= end);
    }

    const dir = params.sort_dir === 'asc' ? 1 : -1;
    const sortBy = params.sort_by || 'status';
    items.sort((a, b) => {
      if (sortBy === 'thread_key') return a.thread_key.localeCompare(b.thread_key) * dir;
      if (sortBy === 'deadline') {
        return (a.deadline.date || '9999').localeCompare(b.deadline.date || '9999') * dir;
      }
      return a.status.localeCompare(b.status) * dir;
    });

    return paginate(items, params.limit, params.cursor);
  }

  async patchActionReview(
    _actionId: string,
    _payload: { review_state: ReviewState; status?: ActionStatus; note?: string },
  ): Promise<ActionItem> {
    throw new Error('Action review overrides require the live backend.');
  }

  async listAttachments(threadKey?: string): Promise<AttachmentSummary[]> {
    const visible = this.getVisibleAttachments();
    return threadKey ? visible.filter((a) => a.thread_key === threadKey) : visible;
  }

  async getAttachment(attachmentId: string): Promise<AttachmentDetail> {
    const found = this.getVisibleAttachments().find((a) => a.attachment_id === attachmentId);
    if (!found) throw new Error('The requested item is not available.');
    return found;
  }

  async getAttachmentDownloadUrl(_attachmentId: string): Promise<string | null> {
    return null;
  }

  async listIngestionJobs(): Promise<IngestionJob[]> {
    return DEMO_DATASET.ingestion_jobs;
  }

  async getIngestionJob(jobId: string): Promise<IngestionJob> {
    const found = DEMO_DATASET.ingestion_jobs.find((j) => j.job_id === jobId);
    if (!found) throw new Error('The requested item is not available.');
    return found;
  }

  async getIngestionRecords(): Promise<IngestionRecordError[]> {
    return [];
  }

  async createIngestionJob(): Promise<IngestionJob> {
    throw new Error('Processing requires the backend. This is a browser-side pre-check.');
  }

  async listEvaluationRuns(): Promise<EvaluationRun[]> {
    return [];
  }
}

export const demoAdapter = new DemoAdapter();
