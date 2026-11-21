import type { DataSource, DecisionListParams } from '../adapters/dataSource';

export const decisionService = {
  keys: {
    list: (mode: string, personaId: string | null, params?: DecisionListParams) =>
      ['decisions', 'list', mode, personaId ?? 'anon', params ?? {}] as const,
    detail: (mode: string, personaId: string | null, decisionId: string) =>
      ['decisions', 'detail', mode, personaId ?? 'anon', decisionId] as const,
  },
  list: (ds: DataSource, params?: DecisionListParams) => ds.listDecisions(params),
  get: (ds: DataSource, decisionId: string) => ds.getDecision(decisionId),
};
