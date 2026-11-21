import type { DataSource } from '../adapters/dataSource';

export const ingestionService = {
  keys: {
    jobs: (mode: string) => ['ingestion', 'jobs', mode] as const,
    job: (mode: string, jobId: string) => ['ingestion', 'job', mode, jobId] as const,
    records: (mode: string, jobId: string, status?: string) =>
      ['ingestion', 'records', mode, jobId, status ?? 'ALL'] as const,
  },
  listJobs: (ds: DataSource) => ds.listIngestionJobs(),
  getJob: (ds: DataSource, jobId: string) => ds.getIngestionJob(jobId),
  getRecords: (
    ds: DataSource,
    jobId: string,
    status?: 'FAILED' | 'DUPLICATE_EXACT' | 'CONFLICTING_DUPLICATE',
  ) => ds.getIngestionRecords(jobId, status),
  createJob: (
    ds: DataSource,
    params: { emailsCsv: File; attachments: File[]; onProgress?: (percent: number) => void },
  ) => ds.createIngestionJob(params),
};
