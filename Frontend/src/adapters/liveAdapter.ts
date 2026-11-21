import { z } from 'zod';
import { endpoints } from '../config/endpoints';
import { env } from '../config/env';
import { parseSseEvents } from '../lib/askHelpers';
import {
  apiRequest,
  captureCsrfHeader,
  mapErrorCodeToUserMessage,
  mapHttpStatusToErrorCode,
  readCsrfToken,
  SutraApiError,
  uploadWithProgress,
} from '../services/apiClient';
import {
  ActionItemSchema,
  AnswerSchema,
  AttachmentDetailSchema,
  AttachmentSummarySchema,
  CitationSchema,
  DecisionSchema,
  EmailMessageSchema,
  HealthStatusSchema,
  IngestionJobSchema,
  IngestionRecordErrorSchema,
  LegacyChatAnswerSchema,
  ThreadDetailSchema,
  ThreadListItemSchema,
  ThreadSummarySchema,
} from '../services/schemas';
import type {
  ActionItem,
  ActionStatus,
  Answer,
  ApiErrorBody,
  AttachmentDetail,
  AttachmentSummary,
  ChatRequest,
  Citation,
  Decision,
  EmailMessage,
  HealthStatus,
  IngestionJob,
  IngestionRecordError,
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
import { normaliseActionItem, normaliseAnswer, normaliseDecision } from './normalisers';

const AuthUserSchema = z
  .object({
    user_id: z.string(),
    display_name: z.string(),
    role_code: z.string(),
    address: z.string().nullable(),
    workspace_name: z.string().optional(),
    mfa_enabled: z.boolean().optional(),
    can_refresh_summary: z.boolean().optional(),
    can_override_review: z.boolean().optional(),
    can_ingest: z.boolean().optional(),
  })
  .passthrough();

const LoginResponseSchema = z
  .object({
    status: z.enum(['AUTHENTICATED', 'MFA_REQUIRED']).optional(),
    mfa_required: z.boolean().optional(),
    mfa_challenge_id: z.string().optional(),
    user: AuthUserSchema.optional(),
  })
  .passthrough();

const AnalyticsOverviewSchema = z
  .object({
    total_emails: z.number().nullable().optional(),
    total_threads: z.number().nullable().optional(),
    total_decisions: z.number().nullable().optional(),
    pending_actions: z.number().nullable().optional(),
    as_of: z.string().nullable().optional(),
  })
  .passthrough();

const TopicSchema = z
  .object({
    category: z.string(),
    thread_count: z.number(),
    last_activity_at: z.string(),
  })
  .passthrough();

const SearchHitSchema = z
  .object({
    hit_id: z.string(),
    level: z.enum(['email', 'attachment', 'thread', 'decision', 'action']),
    thread_key: z.string(),
    email_id: z.string().optional(),
    attachment_id: z.string().optional(),
    title: z.string(),
    snippet: z.string(),
    timestamp: z.string().optional(),
  })
  .passthrough();

const EvaluationRunSchema = z
  .object({
    run_id: z.string(),
    created_at: z.string(),
    dataset_name: z.string().optional(),
    scores: z.record(z.string(), z.number()).optional(),
    status: z.string(),
  })
  .passthrough();

export class LiveAdapter implements DataSource {
  readonly mode = 'live' as const;

  async health(): Promise<HealthStatus> {
    const res = await apiRequest(endpoints.health(), {
      schema: HealthStatusSchema,
      timeoutMs: Math.min(env.REQUEST_TIMEOUT_MS, 8000),
    });
    return res.data;
  }

  async authMe(): Promise<AuthSessionUser | null> {
    try {
      const res = await apiRequest(endpoints.authMe(), {
        schema: AuthUserSchema,
      });
      return res.data;
    } catch (err) {
      if (err instanceof SutraApiError && err.code === 'AUTH_REQUIRED') {
        return null;
      }
      throw err;
    }
  }

  async authLogin(credentials: LoginCredentials): Promise<LoginResult> {
    const res = await apiRequest(endpoints.authLogin(), {
      method: 'POST',
      body: credentials,
      schema: LoginResponseSchema,
    });
    const status =
      res.data.status === 'MFA_REQUIRED' || res.data.mfa_required
        ? 'MFA_REQUIRED'
        : 'AUTHENTICATED';
    return {
      status,
      user: res.data.user,
      mfa_challenge_id: res.data.mfa_challenge_id,
    };
  }

  async authLogout(): Promise<void> {
    await apiRequest(endpoints.authLogout(), { method: 'POST' });
  }

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const res = await apiRequest(endpoints.analyticsOverview(), {
      schema: AnalyticsOverviewSchema,
    });
    return {
      total_emails: res.data.total_emails ?? null,
      total_threads: res.data.total_threads ?? null,
      total_decisions: res.data.total_decisions ?? null,
      pending_actions: res.data.pending_actions ?? null,
      as_of: res.data.as_of ?? null,
    };
  }

  async getTopics(): Promise<TopicItem[]> {
    const res = await apiRequest(endpoints.topics(), {
      schema: z.array(TopicSchema),
    });
    return res.data;
  }

  async listEmails(params: EmailListParams = {}): Promise<PageResult<EmailMessage>> {
    const res = await apiRequest(endpoints.emailsList(), {
      query: {
        sender: params.sender,
        subject: params.subject,
        thread_key: params.thread_key,
        category: params.category,
        has_attachments:
          params.has_attachments === 'yes'
            ? true
            : params.has_attachments === 'no'
              ? false
              : undefined,
        date_from: params.date_from,
        date_to: params.date_to,
        q: params.q,
        limit: Math.min(100, params.limit ?? 25),
        cursor: params.cursor,
      },
      schema: z.array(EmailMessageSchema),
    });
    return { items: res.data, meta: res.meta };
  }

  async getEmail(emailId: string): Promise<EmailMessage> {
    const res = await apiRequest(endpoints.emailsGet(emailId), {
      schema: EmailMessageSchema,
    });
    return res.data;
  }

  async listThreads(params: ThreadListParams = {}): Promise<PageResult<ThreadListItem>> {
    const res = await apiRequest(endpoints.threadsList(), {
      query: {
        category: params.category,
        status_class: params.status_class,
        participant: params.participant,
        date_from: params.date_from,
        date_to: params.date_to,
        has_pending_actions: params.has_pending_actions,
        has_decision: params.has_decision,
        sort_by: params.sort_by,
        sort_dir: params.sort_dir,
        limit: Math.min(100, params.limit ?? 25),
        cursor: params.cursor,
      },
      schema: z.array(ThreadListItemSchema),
    });
    return { items: res.data, meta: res.meta };
  }

  async getThread(threadKey: string): Promise<ThreadDetail> {
    const res = await apiRequest(endpoints.threadsGet(threadKey), {
      schema: ThreadDetailSchema,
    });
    return res.data;
  }

  async getThreadSummary(threadKey: string): Promise<ThreadSummary> {
    const res = await apiRequest(endpoints.threadSummary(threadKey), {
      schema: ThreadSummarySchema,
    });
    return res.data;
  }

  async refreshThreadSummary(threadKey: string): Promise<ThreadSummary> {
    const res = await apiRequest(endpoints.threadSummaryRefresh(threadKey), {
      method: 'POST',
      schema: ThreadSummarySchema,
    });
    return res.data;
  }

  async search(
    query: string,
    signal?: AbortSignal,
  ): Promise<{ items: SearchHit[]; degraded?: boolean }> {
    const res = await apiRequest(endpoints.search(), {
      method: 'POST',
      body: { query },
      signal,
      schema: z.union([
        z.array(SearchHitSchema),
        z.object({ items: z.array(SearchHitSchema), degraded: z.boolean().optional() }).passthrough(),
      ]),
    });
    if (Array.isArray(res.data)) {
      return { items: res.data };
    }
    return { items: res.data.items, degraded: res.data.degraded };
  }

  async ask(
    request: ChatRequest,
    signal?: AbortSignal,
    onStreamEvent?: (phase: 'verifying_sources') => void,
  ): Promise<Answer> {
    if (request.stream) {
      const controller = new AbortController();
      const timeoutId = globalThis.setTimeout(() => controller.abort('timeout'), env.ANSWER_TIMEOUT_MS);
      const onExternalAbort = () => controller.abort('external');
      if (signal) {
        if (signal.aborted) {
          globalThis.clearTimeout(timeoutId);
          throw new SutraApiError({ code: 'ABORTED', message: 'Request cancelled.' });
        }
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }

      try {
        const cleanPath = endpoints.answers().startsWith('/')
          ? endpoints.answers()
          : `/${endpoints.answers()}`;
        const url = `${env.API_BASE_URL}${cleanPath}`;
        const headers = new Headers({
          Accept: 'text/event-stream, application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        });
        const csrf = readCsrfToken();
        if (csrf) {
          headers.set(env.CSRF_HEADER, csrf);
        }
        const res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        captureCsrfHeader(res.headers);

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('text/event-stream') && res.body) {
          onStreamEvent?.('verifying_sources');
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let finalPayload: unknown = null;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parsed = parseSseEvents(buffer);
            buffer = parsed.remainder;
            for (const evt of parsed.events) {
              if (evt.event === 'error') {
                throw new SutraApiError({
                  code: 'INTERNAL_ERROR',
                  message: evt.data || 'Streaming error returned by backend.',
                });
              }
              if (evt.event === 'answer' || evt.event === 'final' || evt.event === 'done') {
                try {
                  finalPayload = JSON.parse(evt.data);
                } catch {
                  // Ignore partial non-JSON frame
                }
              } else {
                onStreamEvent?.('verifying_sources');
                try {
                  const maybeJson = JSON.parse(evt.data) as Record<string, unknown>;
                  if (
                    maybeJson &&
                    typeof maybeJson === 'object' &&
                    ('answer_blocks' in maybeJson || 'claims' in maybeJson || 'data' in maybeJson)
                  ) {
                    finalPayload = 'data' in maybeJson ? maybeJson.data : maybeJson;
                  }
                } catch {
                  // Wait for final validated payload; never release partial prose
                }
              }
            }
          }

          if (finalPayload) {
            const candidate =
              finalPayload && typeof finalPayload === 'object' && 'data' in finalPayload
                ? (finalPayload as { data: unknown }).data
                : finalPayload;
            const validated = z.union([AnswerSchema, LegacyChatAnswerSchema]).safeParse(candidate);
            if (!validated.success) {
              throw new SutraApiError({
                code: 'UNEXPECTED_RESPONSE',
                message: mapErrorCodeToUserMessage('UNEXPECTED_RESPONSE'),
              });
            }
            return normaliseAnswer(
              validated.data as Answer,
              request.question,
              request.thread_scope ?? null,
            );
          }
          throw new SutraApiError({
            code: 'UNEXPECTED_RESPONSE',
            message: mapErrorCodeToUserMessage('UNEXPECTED_RESPONSE'),
          });
        }

        if (!res.ok) {
          const retryAfterRaw = res.headers.get('Retry-After');
          const retryAfterSeconds = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined;
          let errorBody: ApiErrorBody | null = null;
          try {
            errorBody = (await res.json()) as ApiErrorBody;
          } catch {
            errorBody = null;
          }
          const errObj = errorBody?.error;
          const code = errObj?.code || mapHttpStatusToErrorCode(res.status);
          throw new SutraApiError({
            code,
            status: res.status,
            requestId: errObj?.request_id || res.headers.get('X-Request-Id') || undefined,
            details: errObj?.details,
            retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
            message: mapErrorCodeToUserMessage(code, errObj?.message, retryAfterSeconds),
          });
        }

        const json = (await res.json()) as unknown;
        const rawData =
          json && typeof json === 'object' && 'data' in json
            ? (json as { data: unknown }).data
            : json;
        const validated = z.union([AnswerSchema, LegacyChatAnswerSchema]).safeParse(rawData);
        if (!validated.success) {
          throw new SutraApiError({
            code: 'UNEXPECTED_RESPONSE',
            message: mapErrorCodeToUserMessage('UNEXPECTED_RESPONSE'),
          });
        }
        return normaliseAnswer(
          validated.data as Answer,
          request.question,
          request.thread_scope ?? null,
        );
      } catch (err) {
        if (err instanceof SutraApiError) throw err;
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (isAbort && signal?.aborted) {
          throw new SutraApiError({ code: 'ABORTED', message: 'Request cancelled.' });
        }
        throw new SutraApiError({
          code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: mapErrorCodeToUserMessage(isAbort ? 'TIMEOUT' : 'NETWORK_ERROR'),
        });
      } finally {
        globalThis.clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onExternalAbort);
      }
    }

    const res = await apiRequest(endpoints.answers(), {
      method: 'POST',
      body: request,
      timeoutMs: env.ANSWER_TIMEOUT_MS,
      idempotencyKey: crypto.randomUUID(),
      signal,
      schema: z.union([AnswerSchema, LegacyChatAnswerSchema]),
    });
    return normaliseAnswer(
      res.data as Answer,
      request.question,
      request.thread_scope ?? null,
    );
  }

  async submitAnswerFeedback(
    answerId: string,
    feedback: { rating: 'HELPFUL' | 'NOT_HELPFUL' | 'WRONG' | 'MISSING_SOURCE'; comment?: string },
  ): Promise<void> {
    await apiRequest(endpoints.answerFeedback(answerId), {
      method: 'POST',
      body: feedback,
    });
  }

  async getCitation(citationId: string): Promise<Citation> {
    const res = await apiRequest(endpoints.citationGet(citationId), {
      schema: CitationSchema,
    });
    return res.data;
  }

  async listDecisions(params: DecisionListParams = {}): Promise<PageResult<Decision>> {
    const res = await apiRequest(endpoints.decisionsList(), {
      query: {
        type: params.type,
        status: params.status,
        provenance: params.provenance,
        person: params.person,
        category: params.category,
        thread_key: params.thread_key,
        date_from: params.date_from,
        date_to: params.date_to,
        sort_by: params.sort_by,
        sort_dir: params.sort_dir,
        limit: Math.min(100, params.limit ?? 25),
        cursor: params.cursor,
      },
      schema: z.array(DecisionSchema),
    });
    return {
      items: res.data.map((d) => normaliseDecision(d as Decision)),
      meta: res.meta,
    };
  }

  async getDecision(decisionId: string): Promise<Decision> {
    const res = await apiRequest(endpoints.decisionGet(decisionId), {
      schema: DecisionSchema,
    });
    return normaliseDecision(res.data as Decision);
  }

  async listActions(params: ActionListParams = {}): Promise<PageResult<ActionItem>> {
    const res = await apiRequest(endpoints.actionsList(), {
      query: {
        status: params.status,
        deadline_state: params.deadline_state,
        owner: params.owner,
        thread_key: params.thread_key,
        provenance: params.provenance,
        due_from: params.due_from,
        due_to: params.due_to,
        sort_by: params.sort_by,
        sort_dir: params.sort_dir,
        limit: Math.min(100, params.limit ?? 25),
        cursor: params.cursor,
      },
      schema: z.array(ActionItemSchema),
    });
    return {
      items: res.data.map((a) => normaliseActionItem(a as ActionItem)),
      meta: res.meta,
    };
  }

  async patchActionReview(
    actionId: string,
    payload: { review_state: ReviewState; status?: ActionStatus; note?: string },
  ): Promise<ActionItem> {
    const res = await apiRequest(endpoints.actionPatch(actionId), {
      method: 'PATCH',
      body: payload,
      schema: ActionItemSchema,
    });
    return normaliseActionItem(res.data as ActionItem);
  }

  async listAttachments(threadKey?: string): Promise<AttachmentSummary[]> {
    const res = await apiRequest(endpoints.attachmentsList(), {
      query: { thread_key: threadKey },
      schema: z.array(AttachmentSummarySchema),
    });
    return res.data;
  }

  async getAttachment(attachmentId: string): Promise<AttachmentDetail> {
    const res = await apiRequest(endpoints.attachmentGet(attachmentId), {
      schema: AttachmentDetailSchema,
    });
    return res.data;
  }

  async getAttachmentDownloadUrl(attachmentId: string): Promise<string | null> {
    const res = await apiRequest(endpoints.attachmentDownloadUrl(attachmentId), {
      schema: z.object({ url: z.string() }).passthrough(),
    });
    return res.data.url;
  }

  async listIngestionJobs(): Promise<IngestionJob[]> {
    const res = await apiRequest(endpoints.ingestionList(), {
      schema: z.array(IngestionJobSchema),
    });
    return res.data;
  }

  async getIngestionJob(jobId: string): Promise<IngestionJob> {
    const res = await apiRequest(endpoints.ingestionGet(jobId), {
      schema: IngestionJobSchema,
    });
    return res.data;
  }

  async getIngestionRecords(
    jobId: string,
    status?: 'FAILED' | 'DUPLICATE_EXACT' | 'CONFLICTING_DUPLICATE',
  ): Promise<IngestionRecordError[]> {
    const res = await apiRequest(endpoints.ingestionRecords(jobId, status), {
      schema: z.array(IngestionRecordErrorSchema),
    });
    return res.data;
  }

  async createIngestionJob(params: {
    emailsCsv: File;
    attachments: File[];
    onProgress?: (percent: number) => void;
  }): Promise<IngestionJob> {
    const formData = new FormData();
    formData.append('emails_csv', params.emailsCsv);
    for (const file of params.attachments) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        formData.append('attachments_zip', file);
      } else {
        formData.append('attachments', file);
      }
    }
    const res = await uploadWithProgress({
      path: endpoints.ingestionCreate(),
      formData,
      idempotencyKey: crypto.randomUUID(),
      onProgress: params.onProgress,
      schema: IngestionJobSchema,
    });
    return res.data;
  }

  async listEvaluationRuns(): Promise<EvaluationRun[]> {
    const res = await apiRequest(endpoints.evaluationRuns(), {
      schema: z.array(EvaluationRunSchema),
    });
    return res.data;
  }
}

export const liveAdapter = new LiveAdapter();
