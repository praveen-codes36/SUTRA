import type { DataSource, ThreadListParams } from '../adapters/dataSource';

export const threadService = {
  keys: {
    all: ['threads'] as const,
    list: (mode: string, personaId: string | null, params?: ThreadListParams) =>
      ['threads', 'list', mode, personaId ?? 'anon', params ?? {}] as const,
    detail: (mode: string, personaId: string | null, threadKey: string) =>
      ['threads', 'detail', mode, personaId ?? 'anon', threadKey] as const,
    summary: (mode: string, personaId: string | null, threadKey: string) =>
      ['threads', 'summary', mode, personaId ?? 'anon', threadKey] as const,
    topics: (mode: string, personaId: string | null) =>
      ['threads', 'topics', mode, personaId ?? 'anon'] as const,
  },
  list: (ds: DataSource, params?: ThreadListParams) => ds.listThreads(params),
  get: (ds: DataSource, threadKey: string) => ds.getThread(threadKey),
  getSummary: (ds: DataSource, threadKey: string) => ds.getThreadSummary(threadKey),
  refreshSummary: (ds: DataSource, threadKey: string) => ds.refreshThreadSummary(threadKey),
  getTopics: (ds: DataSource) => ds.getTopics(),
};
