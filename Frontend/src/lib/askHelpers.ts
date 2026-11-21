import type { Answer, AnswerBlock, AnswerStatus, Calculation, Citation } from '../types/api';
import type { MetaItem, StatusTone } from './semantics';

export interface PreviousQuestionEntry {
  id: string;
  question: string;
  threadScope: string | null;
  scopeLabel: string;
  timestamp: string;
}

const STORAGE_KEY = 'sutra.prev_questions.v1';

export function loadPreviousQuestions(): PreviousQuestionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePreviousQuestion(entry: {
  question: string;
  threadScope: string | null;
  scopeLabel: string;
}): PreviousQuestionEntry[] {
  const existing = loadPreviousQuestions();
  const newEntry: PreviousQuestionEntry = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    question: entry.question,
    threadScope: entry.threadScope,
    scopeLabel: entry.scopeLabel,
    timestamp: new Date().toISOString(),
  };

  const filtered = existing.filter((q) => q.question.trim() !== entry.question.trim());
  const updated = [newEntry, ...filtered].slice(0, 10);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
  }
  return updated;
}

export function clearPreviousQuestions(): PreviousQuestionEntry[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  return [];
}

export const DEFAULT_SUGGESTED_QUESTIONS = [
  'What was the final decision on the CNC machine procurement and what was the approved price?',
  'What is the approved venue and security status for the annual technical fest?',
  'What was the total repair cost for the Universal Testing Machine (UTM)?',
  'Which printer vendor was selected and what are the delivery milestones?',
  'What caused the Engineering Block network outage and how was it resolved?',
];

export function getSuggestedQuestions(isDemo: boolean): string[] {
  return DEFAULT_SUGGESTED_QUESTIONS;
}

export const ANSWER_STATUS_META: Record<AnswerStatus, MetaItem> = {
  ANSWERED: {
    label: 'Answered',
    tone: 'success',
    icon: 'CheckCircle2',
    tooltip: 'Directly supported by retrieved institutional communications.',
  },
  PARTIAL: {
    label: 'Partial Answer',
    tone: 'warning',
    icon: 'PieChart',
    tooltip: 'Partially supported; some aspects lack explicit evidence.',
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Insufficient Evidence',
    tone: 'warning',
    icon: 'AlertTriangle',
    tooltip: 'The available email records do not state sufficient evidence to answer this question.',
  },
  CONFLICTING_EVIDENCE: {
    label: 'Conflicting Evidence',
    tone: 'error',
    icon: 'AlertTriangle',
    tooltip: 'Retrieved records document contradictory statements across different emails.',
  },
  CLARIFICATION_NEEDED: {
    label: 'Clarification Needed',
    tone: 'info',
    icon: 'HelpCircle',
    tooltip: 'Multiple potential matches found; please select a specific scope.',
  },
  DEGRADED: {
    label: 'Degraded Mode',
    tone: 'warning',
    icon: 'FileWarning',
    tooltip: 'Synthesized using fallback search mode.',
  },
  FAILED: {
    label: 'Processing Failed',
    tone: 'error',
    icon: 'XCircle',
    tooltip: 'Unable to process the query against the retrieval pipeline.',
  },
};

export function getAnswerStatusMeta(status: AnswerStatus): MetaItem {
  return ANSWER_STATUS_META[status] || { label: status, tone: 'neutral' };
}

export interface ClassifiedEvidence {
  uniqueCitations: Citation[];
  citationsById: Map<string, Citation>;
  citationIndexMap: Map<string, number>;
  explicitBlocks: AnswerBlock[];
  inferredBlocks: AnswerBlock[];
  calculations: Array<{ block: AnswerBlock; calculation: Calculation }>;
}

export function classifyAnswerEvidence(answer: Answer): ClassifiedEvidence {
  const citationsById = new Map<string, Citation>();
  const citationIndexMap = new Map<string, number>();
  const uniqueCitations: Citation[] = [];

  let idx = 1;
  for (const c of answer.citations) {
    if (!citationsById.has(c.citation_id)) {
      citationsById.set(c.citation_id, c);
      citationIndexMap.set(c.citation_id, idx++);
      uniqueCitations.push(c);
    }
  }

  const explicitBlocks: AnswerBlock[] = [];
  const inferredBlocks: AnswerBlock[] = [];
  const calculations: Array<{ block: AnswerBlock; calculation: Calculation }> = [];

  for (const b of answer.answer_blocks) {
    if (b.claim_type === 'EXPLICIT') {
      explicitBlocks.push(b);
    } else if (b.claim_type === 'INFERRED') {
      inferredBlocks.push(b);
    }

    if (b.calculation) {
      calculations.push({ block: b, calculation: b.calculation });
    }
  }

  return {
    uniqueCitations,
    citationsById,
    citationIndexMap,
    explicitBlocks,
    inferredBlocks,
    calculations,
  };
}

export function parseSseEvents(buffer: string): {
  events: Array<{ event?: string; data: string }>;
  remainder: string;
} {
  const events: Array<{ event?: string; data: string }> = [];
  const lines = buffer.split('\n');
  let currentEvent: string | undefined;
  let currentData = '';
  let remainder = '';

  let i = 0;
  for (; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\r$/, '');

    if (line === '') {
      if (currentData || currentEvent) {
        events.push({ event: currentEvent, data: currentData.trimEnd() });
        currentEvent = undefined;
        currentData = '';
      }
      continue;
    }

    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const chunk = line.slice(5).trim();
      currentData += (currentData ? '\n' : '') + chunk;
    } else if (i === lines.length - 1 && !buffer.endsWith('\n')) {
      // Incomplete trailing chunk
      remainder = rawLine;
    }
  }

  return { events, remainder };
}
