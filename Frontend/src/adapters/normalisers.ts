import type {
  ActionItem,
  Answer,
  AnswerBlock,
  AnswerStatus,
  Citation,
  ConditionItem,
  Decision,
  LegacyChatAnswer,
  Person,
  Provenance,
} from '../types/api';

const LEGACY_STATUS_MAP: Record<LegacyChatAnswer['status'], AnswerStatus> = {
  answered: 'ANSWERED',
  insufficient_evidence: 'INSUFFICIENT_EVIDENCE',
  conflicting_evidence: 'CONFLICTING_EVIDENCE',
  clarification_needed: 'CLARIFICATION_NEEDED',
  error: 'FAILED',
};

export function normalisePerson(raw: Partial<Person> & { address: string }): Person {
  return {
    address: raw.address,
    role: raw.role ?? null,
    role_source: raw.role_source ?? null,
    is_shared_mailbox: raw.is_shared_mailbox,
  };
}

export function normaliseConditions(
  conditions: Array<ConditionItem | string> | undefined,
): ConditionItem[] {
  if (!conditions) return [];
  return conditions.map((c) => {
    if (typeof c === 'string') {
      return { text: c, state: 'NOT_EVIDENCED', evidence_email_ids: [] };
    }
    return {
      text: c.text,
      state: c.state ?? 'NOT_EVIDENCED',
      evidence_email_ids: c.evidence_email_ids ?? [],
    };
  });
}

export interface NormalisedProvenance {
  provenance: Provenance;
  reported: boolean;
}

export function normaliseProvenance(
  provenance: Provenance | null | undefined,
): NormalisedProvenance {
  if (!provenance) {
    return { provenance: 'EXPLICIT', reported: false };
  }
  return { provenance, reported: true };
}

export function normaliseDecision(raw: Decision & { provenance?: Provenance | null }): Decision & {
  provenance_reported?: boolean;
} {
  const prov = normaliseProvenance(raw.provenance);
  return {
    ...raw,
    provenance: prov.provenance,
    provenance_reported: prov.reported,
    scope: {
      authorizes: raw.scope?.authorizes ?? [],
      excludes: raw.scope?.excludes ?? [],
      conditions: normaliseConditions(raw.scope?.conditions),
    },
  };
}

export function normaliseActionItem(
  raw: ActionItem & { provenance?: Provenance | null },
): ActionItem & { provenance_reported?: boolean } {
  const prov = normaliseProvenance(raw.provenance);
  return {
    ...raw,
    provenance: prov.provenance,
    provenance_reported: prov.reported,
  };
}

export function isLegacyChatAnswer(payload: unknown): payload is LegacyChatAnswer {
  if (!payload || typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;
  return typeof obj.answer === 'string' && Array.isArray(obj.claims) && !Array.isArray(obj.answer_blocks);
}

export function isProvenanceReported(item: unknown): boolean {
  if (!item || typeof item !== 'object') return true;
  return (item as { provenance_reported?: boolean }).provenance_reported !== false;
}

export function normaliseLegacyAnswer(
  legacy: LegacyChatAnswer,
  question?: string,
  threadScope?: string | null,
): Answer {
  const citationsByEmail = new Map<string, Citation>();

  for (const src of legacy.sources || []) {
    const citId = `cit_legacy_${src.email_id}`;
    if (!citationsByEmail.has(src.email_id)) {
      citationsByEmail.set(src.email_id, {
        citation_id: citId,
        email_id: src.email_id,
        thread_id: src.thread_id,
        timestamp: src.timestamp,
        subject: src.subject,
        quote: '',
        evidence_role: 'PRIMARY',
      });
    }
  }

  const answer_blocks: Array<AnswerBlock & { provenance_reported?: boolean }> =
    legacy.claims && legacy.claims.length > 0
      ? legacy.claims.map((claim, idx) => ({
          claim_id: `legacy_c_${idx + 1}`,
          claim_type: 'EXPLICIT',
          provenance_reported: false,
          text: claim.text,
          citation_ids: claim.source_email_ids
            .map((eid) => citationsByEmail.get(eid)?.citation_id)
            .filter((v): v is string => Boolean(v)),
        }))
      : [
          {
            claim_id: 'legacy_c_1',
            claim_type: 'EXPLICIT',
            provenance_reported: false,
            text: legacy.answer,
            citation_ids: Array.from(citationsByEmail.values()).map((c) => c.citation_id),
          },
        ];

  return {
    answer_id: `ans_legacy_${Date.now()}`,
    status: LEGACY_STATUS_MAP[legacy.status] ?? 'FAILED',
    question,
    answer_blocks,
    caveats: legacy.limitations || [],
    citations: Array.from(citationsByEmail.values()),
    thread_scope: threadScope ?? null,
    provenance: 'LIVE',
  };
}

export function normaliseAnswer(payload: Answer | LegacyChatAnswer, question?: string, threadScope?: string | null): Answer {
  if (isLegacyChatAnswer(payload)) {
    return normaliseLegacyAnswer(payload, question, threadScope);
  }
  return {
    ...payload,
    provenance: payload.provenance ?? 'LIVE',
    caveats: payload.caveats ?? [],
    citations: payload.citations ?? [],
    answer_blocks: payload.answer_blocks ?? [],
  };
}
