import type { DataSource } from '../adapters/dataSource';
import type { ChatRequest } from '../types/api';

export const intelligenceService = {
  keys: {
    overview: (mode: string, personaId: string | null) =>
      ['intelligence', 'overview', mode, personaId ?? 'anon'] as const,
    evaluationRuns: (mode: string) => ['intelligence', 'evaluation', mode] as const,
  },
  getOverview: (ds: DataSource) => ds.getAnalyticsOverview(),
  search: (ds: DataSource, query: string, signal?: AbortSignal) => ds.search(query, signal),
  ask: (
    ds: DataSource,
    request: ChatRequest,
    signal?: AbortSignal,
    onStreamEvent?: (phase: 'verifying_sources') => void,
  ) => ds.ask(request, signal, onStreamEvent),
  submitFeedback: (
    ds: DataSource,
    answerId: string,
    feedback: { rating: 'HELPFUL' | 'NOT_HELPFUL' | 'WRONG' | 'MISSING_SOURCE'; comment?: string },
  ) => ds.submitAnswerFeedback(answerId, feedback),
  getCitation: (ds: DataSource, citationId: string) => ds.getCitation(citationId),
  listEvaluationRuns: (ds: DataSource) => ds.listEvaluationRuns(),
};
