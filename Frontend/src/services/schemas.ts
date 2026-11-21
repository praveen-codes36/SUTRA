import { z } from 'zod';

export const ApiMetaSchema = z
  .object({
    request_id: z.string().optional(),
    next_cursor: z.string().nullable().optional(),
    total_estimate: z.number().nullable().optional(),
    scope: z.string().optional(),
  })
  .passthrough();

export const PersonSchema = z
  .object({
    address: z.string(),
    role: z.string().nullable().default(null),
    role_source: z.enum(['DIRECTORY', 'INFERRED_FROM_ADDRESS']).nullable().default(null),
    is_shared_mailbox: z.boolean().optional(),
  })
  .passthrough();

export const AttachmentSummarySchema = z
  .object({
    attachment_id: z.string(),
    filename: z.string(),
    status: z.enum([
      'READY',
      'MISSING_FILE',
      'UNSUPPORTED',
      'OVERSIZE',
      'ENCRYPTED',
      'CORRUPT',
      'MALWARE_FLAGGED',
      'EXTRACTION_FAILED',
      'PENDING',
    ]),
    size_bytes: z.number().nullable().optional(),
    detected_mime: z.string().nullable().optional(),
    status_detail: z.string().nullable().optional(),
  })
  .passthrough();

export const AttachmentDetailSchema = AttachmentSummarySchema.extend({
  email_id: z.string(),
  thread_key: z.string(),
  text_content: z.string().nullable().default(null),
  table: z
    .object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .nullable()
    .default(null),
  ocr_confidence: z.number().nullable().optional(),
}).passthrough();

export const MentionSchema = z
  .object({
    kind: z.enum(['AMOUNT', 'DATE', 'TIME', 'IDENTIFIER', 'QUANTITY']),
    original_text: z.string(),
    normalized_value: z.union([z.string(), z.number()]),
    unit: z.string().nullable().default(null),
    timezone_label: z.string().nullable().default(null),
  })
  .passthrough();

export const EmailMessageSchema = z
  .object({
    email_id: z.string(),
    thread_key: z.string(),
    subject: z.string().nullable().default(null),
    timestamp: z.string(),
    timestamp_local: z.string().optional(),
    sender: PersonSchema,
    recipients: z.array(PersonSchema),
    body_raw: z.string(),
    body_preview: z.string().optional(),
    in_reply_to: z.string().nullable().default(null),
    attachments: z.array(AttachmentSummarySchema).default([]),
    quality_flags: z.array(z.string()).default([]),
    mentions: z.array(MentionSchema).optional(),
    category: z.string().nullable().optional(),
  })
  .passthrough();

export const ThreadListItemSchema = z
  .object({
    thread_key: z.string(),
    title: z.string().nullable().default(null),
    category: z.string().nullable().default(null),
    status_class: z.enum([
      'OPEN',
      'AWAITING_ACTION',
      'PARTIALLY_COMPLETE',
      'MONITORING',
      'COMPLETED',
      'UNKNOWN',
    ]),
    integrity: z.enum(['COMPLETE', 'PARTIAL', 'CONFLICT']),
    first_message_at: z.string(),
    last_message_at: z.string(),
    message_count: z.number(),
    participants: z.array(PersonSchema),
    attachment_count: z.number().optional(),
  })
  .passthrough();

export const ThreadEdgeSchema = z
  .object({
    child_email_id: z.string(),
    parent_email_id: z.string().nullable().default(null),
    edge_type: z.enum(['REPLY_TO', 'FORWARD_OF', 'SAME_TOPIC_CANDIDATE']),
    anomaly: z.string().nullable().optional(),
  })
  .passthrough();

export const ThreadDetailSchema = ThreadListItemSchema.extend({
  message_ids: z.array(z.string()),
  edges: z.array(ThreadEdgeSchema),
  reconstruction: z
    .object({
      method: z.string(),
      confidence: z.number(),
      review_state: z.enum(['NONE', 'PENDING', 'CONFIRMED', 'CORRECTED', 'REJECTED']),
    })
    .passthrough(),
}).passthrough();

export const CitedStatementSchema = z
  .object({
    text: z.string(),
    email_ids: z.array(z.string()),
  })
  .passthrough();

export const TimelineEventSchema = z
  .object({
    date: z.string(),
    event: z.string(),
    email_ids: z.array(z.string()),
  })
  .passthrough();

export const ThreadSummarySchema = z
  .object({
    thread_key: z.string(),
    summary_version: z.number(),
    verification_status: z.enum(['VERIFIED', 'DRAFT_UNVERIFIED', 'FAILED']),
    stale: z.boolean(),
    generated_by: z.string().optional(),
    content: z
      .object({
        purpose: z.string(),
        initial_context: z.string(),
        discussion_points: z.array(CitedStatementSchema),
        timeline: z.array(TimelineEventSchema),
        latest_status: z
          .object({
            class: z.enum([
              'OPEN',
              'AWAITING_ACTION',
              'PARTIALLY_COMPLETE',
              'MONITORING',
              'COMPLETED',
              'UNKNOWN',
            ]),
            text: z.string(),
            as_of_email_id: z.string(),
            as_of_time: z.string(),
          })
          .passthrough(),
        pending_action_ids: z.array(z.string()),
        pending_note: z.string().nullable().default(null),
        deadlines: z.array(CitedStatementSchema),
        unresolved: z.array(CitedStatementSchema),
      })
      .passthrough(),
  })
  .passthrough();

export const EvidenceSchema = z
  .object({
    email_id: z.string(),
    quote: z.string(),
    role: z.enum(['PRIMARY', 'CORROBORATING', 'CONTEXT']).optional(),
    attachment_id: z.string().nullable().optional(),
    attachment_filename: z.string().nullable().optional(),
  })
  .passthrough();

export const AmountSchema = z
  .object({
    role: z.enum([
      'QUOTED',
      'ESTIMATE',
      'CEILING',
      'APPROVED',
      'PAID',
      'TOTAL',
      'CAP',
      'PLANNED',
      'ELIGIBLE',
      'OTHER',
    ]),
    value_inr: z.number().nullable().default(null),
    original_text: z.string(),
    basis: z.enum(['TOTAL', 'PER_UNIT']).nullable().default(null),
    derived: z.boolean().optional(),
  })
  .passthrough();

export const ConditionItemSchema = z
  .object({
    text: z.string(),
    state: z.enum(['FULFILLED', 'PENDING', 'NOT_EVIDENCED']).nullable().optional(),
    evidence_email_ids: z.array(z.string()).optional(),
  })
  .passthrough();

export const DecisionSchema = z
  .object({
    decision_id: z.string(),
    thread_key: z.string(),
    type: z.enum([
      'APPROVAL',
      'CONDITIONAL_APPROVAL',
      'LIMITED_SCOPE_ACCEPTANCE',
      'REJECTION',
      'RECOMMENDATION',
      'SELECTION',
      'CONFIRMATION',
    ]),
    subject: z.string(),
    outcome: z.string(),
    approver: PersonSchema.nullable().default(null),
    recommended_by: PersonSchema.nullable().default(null),
    confirmed_by: PersonSchema.nullable().default(null),
    attribution_note: z.string().nullable().optional(),
    authority_basis: z.string().nullable().optional(),
    decided_at: z.string(),
    event_date: z.string().nullable().optional(),
    amounts: z.array(AmountSchema).default([]),
    scope: z
      .object({
        authorizes: z.array(z.string()).default([]),
        excludes: z.array(z.string()).default([]),
        conditions: z.array(z.union([ConditionItemSchema, z.string()])).default([]),
      })
      .passthrough(),
    status: z.enum(['ACTIVE', 'CONDITION_PENDING', 'FULFILLED', 'SUPERSEDED', 'WITHDRAWN']),
    supersedes_id: z.string().nullable().optional(),
    provenance: z.enum(['EXPLICIT', 'DERIVED_CALC', 'INFERRED']).optional(),
    confidence: z.number().nullable().optional(),
    review_state: z.enum(['NONE', 'PENDING', 'CONFIRMED', 'CORRECTED', 'REJECTED']).default('NONE'),
    evidence: z.array(EvidenceSchema).default([]),
  })
  .passthrough();

export const ActionItemSchema = z
  .object({
    action_id: z.string(),
    thread_key: z.string(),
    action_kind: z.enum(['REQUEST', 'INSTRUCTION', 'COMMITMENT', 'CONDITIONAL_NEXT_STEP']),
    task: z.string(),
    owner: PersonSchema.nullable().default(null),
    owner_basis: z.enum(['EXPLICIT', 'INFERRED']).nullable().default(null),
    requested_by: PersonSchema.nullable().default(null),
    deadline: z
      .object({
        date: z.string().nullable().default(null),
        text: z.string().nullable().default(null),
        precision: z.enum(['DATE', 'DATETIME', 'RELATIVE']).nullable().default(null),
      })
      .passthrough(),
    status: z.enum([
      'OPEN',
      'DONE',
      'CONDITIONAL',
      'CANCELLED',
      'SUPERSEDED',
      'IN_PROGRESS',
      'BLOCKED',
    ]),
    deadline_state: z.enum(['NONE', 'UPCOMING', 'OVERDUE', 'MET', 'MISSED', 'UNDETERMINED']),
    completed_at: z.string().nullable().optional(),
    provenance: z.enum(['EXPLICIT', 'DERIVED_CALC', 'INFERRED']).optional(),
    confidence: z.number().nullable().optional(),
    review_state: z.enum(['NONE', 'PENDING', 'CONFIRMED', 'CORRECTED', 'REJECTED']).default('NONE'),
    status_basis: z.string(),
    evidence: z.array(EvidenceSchema).default([]),
    completion_evidence: z.array(EvidenceSchema).default([]),
  })
  .passthrough();

export const CitationSchema = z
  .object({
    citation_id: z.string(),
    email_id: z.string(),
    thread_id: z.string(),
    timestamp: z.string(),
    sender: PersonSchema.nullable().optional(),
    subject: z.string().nullable().optional(),
    quote: z.string(),
    attachment_id: z.string().nullable().optional(),
    attachment_filename: z.string().nullable().optional(),
    evidence_role: z.enum(['PRIMARY', 'CORROBORATING', 'CONTEXT']).optional(),
    verification: z
      .object({
        email_exists: z.boolean(),
        access_ok: z.boolean(),
        quote_found: z.boolean(),
        values_match: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough();

export const CalculationSchema = z
  .object({
    operation: z.enum(['SUM', 'DIFFERENCE', 'PRODUCT']),
    operands: z.array(
      z
        .object({
          label: z.string(),
          value_inr: z.number(),
          citation_ids: z.array(z.string()),
        })
        .passthrough(),
    ),
    result_inr: z.number(),
  })
  .passthrough();

export const AnswerBlockSchema = z
  .object({
    claim_id: z.string(),
    claim_type: z.enum(['EXPLICIT', 'DERIVED_CALC', 'INFERRED']),
    text: z.string(),
    citation_ids: z.array(z.string()),
    calculation: CalculationSchema.optional(),
  })
  .passthrough();

export const AnswerSchema = z
  .object({
    answer_id: z.string(),
    status: z.enum([
      'ANSWERED',
      'PARTIAL',
      'INSUFFICIENT_EVIDENCE',
      'CONFLICTING_EVIDENCE',
      'CLARIFICATION_NEEDED',
      'DEGRADED',
      'FAILED',
    ]),
    question: z.string().optional(),
    intents: z.array(z.string()).optional(),
    as_of: z.string().optional(),
    answer_blocks: z.array(AnswerBlockSchema).default([]),
    structured: z
      .object({
        decision_ids: z.array(z.string()).optional(),
        action_ids: z.array(z.string()).optional(),
        latest_status: z
          .object({
            class: z.enum([
              'OPEN',
              'AWAITING_ACTION',
              'PARTIALLY_COMPLETE',
              'MONITORING',
              'COMPLETED',
              'UNKNOWN',
            ]),
            text: z.string(),
            as_of_email_id: z.string(),
          })
          .optional(),
      })
      .passthrough()
      .optional(),
    caveats: z.array(z.string()).default([]),
    citations: z.array(CitationSchema).default([]),
    confidence: z
      .object({
        level: z.enum(['HIGH', 'MEDIUM', 'LOW']),
        reasons: z.array(z.string()),
      })
      .nullable()
      .optional(),
    validation: z
      .object({
        passed: z.boolean(),
        repairs: z.number(),
        removed_claims: z.number(),
      })
      .optional(),
    search_scope: z
      .object({
        threads_searched: z.number(),
        date_range: z.tuple([z.string(), z.string()]),
      })
      .nullable()
      .optional(),
    suggestions: z.array(z.string()).optional(),
    options: z
      .array(
        z
          .object({
            label: z.string(),
            question: z.string(),
            thread_scope: z.string().nullable(),
          })
          .passthrough(),
      )
      .optional(),
    thread_scope: z.string().nullable().optional(),
    provenance: z.enum(['DEMO_PREAUTHORED', 'LIVE']).optional(),
  })
  .passthrough();

export const LegacyChatAnswerSchema = z
  .object({
    answer: z.string(),
    status: z.enum([
      'answered',
      'insufficient_evidence',
      'conflicting_evidence',
      'clarification_needed',
      'error',
    ]),
    claims: z.array(
      z.object({
        text: z.string(),
        source_email_ids: z.array(z.string()),
      }),
    ),
    sources: z.array(
      z.object({
        email_id: z.string(),
        thread_id: z.string(),
        subject: z.string(),
        timestamp: z.string(),
      }),
    ),
    limitations: z.array(z.string()),
  })
  .passthrough();

export const IngestionJobSchema = z
  .object({
    job_id: z.string(),
    status: z.enum([
      'QUEUED',
      'RUNNING',
      'COMPLETED',
      'COMPLETED_WITH_ERRORS',
      'FAILED',
      'CANCELLED',
    ]),
    source_file_name: z.string().nullable().optional(),
    created_at: z.string().nullable().default(null),
    finished_at: z.string().nullable().default(null),
    counts: z
      .object({
        rows_total: z.number(),
        rows_ok: z.number(),
        rows_failed: z.number(),
        rows_duplicate: z.number(),
        attachments_linked: z.number(),
        threads: z.number(),
      })
      .passthrough(),
    warnings: z.array(z.string()).default([]),
    stages: z.array(
      z
        .object({
          name: z.enum([
            'file_received',
            'schema_validation',
            'records_parsed',
            'threads_reconstructed',
            'attachments_registered',
            'index_prepared',
            'workspace_ready',
          ]),
          status: z.enum(['PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED']),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const IngestionRecordErrorSchema = z
  .object({
    row_number: z.number(),
    status: z.enum(['FAILED', 'DUPLICATE_EXACT', 'CONFLICTING_DUPLICATE']),
    reason_code: z.string(),
    message: z.string().optional(),
  })
  .passthrough();

export const HealthStatusSchema = z
  .object({
    status: z.enum(['ok', 'degraded', 'down']),
    version: z.string().optional(),
    components: z.record(z.string(), z.enum(['ok', 'degraded', 'down'])).optional(),
  })
  .passthrough();
