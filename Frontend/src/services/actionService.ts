import type { ActionListParams, DataSource } from '../adapters/dataSource';
import type { ActionStatus, ReviewState } from '../types/api';

export const actionService = {
  keys: {
    list: (mode: string, personaId: string | null, params?: ActionListParams) =>
      ['actions', 'list', mode, personaId ?? 'anon', params ?? {}] as const,
  },
  list: (ds: DataSource, params?: ActionListParams) => ds.listActions(params),
  patchReview: (
    ds: DataSource,
    actionId: string,
    payload: { review_state: ReviewState; status?: ActionStatus; note?: string },
  ) => ds.patchActionReview(actionId, payload),
};
