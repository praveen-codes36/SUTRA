import { getEnvOverride } from './env';

function override(envKey: string, fallback: string): string {
  const val = getEnvOverride(`VITE_ENDPOINT_${envKey}`);
  return val && val.trim().length > 0 ? val.trim() : fallback;
}

export const endpoints = {
  authLogin: () => override('AUTH_LOGIN', '/auth/login'),
  authLogout: () => override('AUTH_LOGOUT', '/auth/logout'),
  authMe: () => override('AUTH_ME', '/auth/me'),

  ingestionCreate: () => override('INGESTION_CREATE', '/ingestion/jobs'),
  ingestionList: () => override('INGESTION_LIST', '/ingestion/jobs'),
  ingestionGet: (jobId: string) =>
    override('INGESTION_GET', '/ingestion/jobs/{job_id}').replace('{job_id}', encodeURIComponent(jobId)),
  ingestionRecords: (jobId: string, status?: string) => {
    const base = override('INGESTION_RECORDS', '/ingestion/jobs/{job_id}/records').replace(
      '{job_id}',
      encodeURIComponent(jobId),
    );
    return status ? `${base}?status=${encodeURIComponent(status)}` : base;
  },

  emailsList: () => override('EMAILS_LIST', '/emails'),
  emailsGet: (emailId: string) =>
    override('EMAILS_GET', '/emails/{email_id}').replace('{email_id}', encodeURIComponent(emailId)),

  threadsList: () => override('THREADS_LIST', '/threads'),
  threadsGet: (threadKey: string) =>
    override('THREADS_GET', '/threads/{thread_key}').replace('{thread_key}', encodeURIComponent(threadKey)),
  threadSummary: (threadKey: string) =>
    override('THREAD_SUMMARY', '/threads/{thread_key}/summary').replace('{thread_key}', encodeURIComponent(threadKey)),
  threadSummaryRefresh: (threadKey: string) =>
    override('THREAD_SUMMARY_REFRESH', '/threads/{thread_key}/summary/refresh').replace(
      '{thread_key}',
      encodeURIComponent(threadKey),
    ),
  threadReconstruction: (threadKey: string) =>
    override('THREAD_RECONSTRUCTION', '/threads/{thread_key}/reconstruction').replace(
      '{thread_key}',
      encodeURIComponent(threadKey),
    ),

  search: () => override('SEARCH', '/search'),
  answers: () => override('ANSWERS', '/answers'),
  answerGet: (answerId: string) =>
    override('ANSWER_GET', '/answers/{answer_id}').replace('{answer_id}', encodeURIComponent(answerId)),
  answerFeedback: (answerId: string) =>
    override('ANSWER_FEEDBACK', '/answers/{answer_id}/feedback').replace('{answer_id}', encodeURIComponent(answerId)),

  citationGet: (citationId: string) =>
    override('CITATION_GET', '/citations/{citation_id}').replace('{citation_id}', encodeURIComponent(citationId)),

  decisionsList: () => override('DECISIONS_LIST', '/decisions'),
  decisionGet: (decisionId: string) =>
    override('DECISION_GET', '/decisions/{id}').replace('{id}', encodeURIComponent(decisionId)),

  actionsList: () => override('ACTIONS_LIST', '/action-items'),
  actionPatch: (actionId: string) =>
    override('ACTION_PATCH', '/action-items/{id}').replace('{id}', encodeURIComponent(actionId)),

  attachmentsList: () => override('ATTACHMENTS_LIST', '/attachments'),
  attachmentGet: (attachmentId: string) =>
    override('ATTACHMENT_GET', '/attachments/{id}').replace('{id}', encodeURIComponent(attachmentId)),
  attachmentText: (attachmentId: string) =>
    override('ATTACHMENT_TEXT', '/attachments/{id}/text').replace('{id}', encodeURIComponent(attachmentId)),
  attachmentDownloadUrl: (attachmentId: string) =>
    override('ATTACHMENT_DOWNLOAD_URL', '/attachments/{id}/download-url').replace(
      '{id}',
      encodeURIComponent(attachmentId),
    ),

  topics: () => override('TOPICS', '/topics'),
  analyticsOverview: () => override('ANALYTICS_OVERVIEW', '/analytics/overview'),
  evaluationRuns: () => override('EVALUATION_RUNS', '/evaluation/runs'),
  evaluationRun: (runId: string) =>
    override('EVALUATION_RUN', '/evaluation/runs/{run_id}').replace('{run_id}', encodeURIComponent(runId)),

  health: () => override('HEALTH', '/health/ready'),
} as const;
