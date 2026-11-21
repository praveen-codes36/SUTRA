import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSutra } from '../../app/providers';
import { usePrefs } from '../../hooks/usePrefs';
import { formatDateTime, formatUtcTooltip } from '../../lib/format';
import { ingestionService } from '../../services/ingestionService';
import type { StatusTone } from '../../lib/semantics';
import type { IngestionJob, IngestionRecordError } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Banner } from '../ui/Banner';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Skeleton } from '../ui/Skeleton';
import { Stat } from '../ui/Stat';
import { Table, type TableColumn } from '../ui/Table';

export interface IngestionHistorySectionProps {
  jobs: IngestionJob[];
  jobsLoading: boolean;
  jobsError: unknown;
  onRetryJobs: () => void;
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

const JOB_STATUS_TONE: Record<IngestionJob['status'], { label: string; tone: StatusTone }> = {
  QUEUED: { label: 'Queued', tone: 'neutral' },
  RUNNING: { label: 'Running', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  COMPLETED_WITH_ERRORS: { label: 'Completed with errors', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'error' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const IngestionHistorySection: React.FC<IngestionHistorySectionProps> = ({
  jobs,
  jobsLoading,
  jobsError,
  onRetryJobs,
  selectedJobId,
  onSelectJob,
}) => {
  const { mode, dataSource } = useSutra();
  const { prefs } = usePrefs();
  const [recordFilter, setRecordFilter] = useState<'FAILED' | 'DUPLICATE_EXACT' | 'CONFLICTING_DUPLICATE'>('FAILED');

  const selectedJob = jobs.find((j) => j.job_id === selectedJobId) || jobs[0] || null;
  const sourceLabel = mode === 'demo' ? 'Supplied benchmark record' : 'Backend job telemetry';

  const recordsQuery = useQuery({
    queryKey: ingestionService.keys.records(mode, selectedJob?.job_id || '', recordFilter),
    queryFn: () => ingestionService.getRecords(dataSource, selectedJob!.job_id, recordFilter),
    enabled: Boolean(selectedJob?.job_id),
  });

  const jobColumns: Array<TableColumn<IngestionJob>> = [
    {
      key: 'job_id',
      header: 'Job ID',
      render: (job) => (
        <div>
          <span className="font-mono text-[12.5px] font-semibold text-[#102D2A] tabular-nums">
            {job.job_id}
          </span>
          {job.job_id === 'job-demo-benchmark' && (
            <p className="text-[11.5px] text-[#7A5C1E]">Supplied synthetic benchmark</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (job) => {
        const meta = JOB_STATUS_TONE[job.status] || { label: job.status, tone: 'neutral' as StatusTone };
        return <Badge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      key: 'source_file_name',
      header: 'Source file',
      render: (job) => (
        <span className="font-mono text-[12px] text-[#202B35]">
          {job.source_file_name || 'Not reported'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (job) =>
        job.created_at ? (
          <span title={formatUtcTooltip(job.created_at)} className="tabular-nums text-[12px] text-[#5A6560] whitespace-nowrap">
            {formatDateTime(job.created_at, { showUtc: prefs.showUtc })}
          </span>
        ) : (
          <span className="text-[12px] text-[#5A6560]">Not reported</span>
        ),
    },
    {
      key: 'rows_ok',
      header: 'Accepted',
      align: 'right',
      render: (job) => <span className="tabular-nums font-semibold">{job.counts.rows_ok}</span>,
    },
    {
      key: 'rows_failed',
      header: 'Rejected',
      align: 'right',
      render: (job) => <span className="tabular-nums">{job.counts.rows_failed}</span>,
    },
    {
      key: 'rows_duplicate',
      header: 'Duplicate',
      align: 'right',
      render: (job) => <span className="tabular-nums">{job.counts.rows_duplicate}</span>,
    },
    {
      key: 'threads',
      header: 'Threads',
      align: 'right',
      render: (job) => <span className="tabular-nums">{job.counts.threads}</span>,
    },
    {
      key: 'attachments_linked',
      header: 'Attachments',
      align: 'right',
      render: (job) => <span className="tabular-nums">{job.counts.attachments_linked}</span>,
    },
  ];

  const recordColumns: Array<TableColumn<IngestionRecordError>> = [
    {
      key: 'row_number',
      header: 'Row',
      widthClass: 'w-[90px]',
      render: (rec) => (
        <span className="font-mono text-[12.5px] font-semibold text-[#102D2A] tabular-nums">
          Row {rec.row_number}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Record status',
      render: (rec) => (
        <Badge
          label={rec.status}
          tone={rec.status === 'FAILED' ? 'error' : 'warning'}
        />
      ),
    },
    {
      key: 'reason_code',
      header: 'Reason code',
      render: (rec) => <span className="font-mono text-[12px] text-[#202B35]">{rec.reason_code}</span>,
    },
    {
      key: 'message',
      header: 'Details',
      render: (rec) => <span className="text-[13px] text-[#5A6560]">{rec.message || 'Not reported'}</span>,
    },
  ];

  return (
    <div className="min-w-0 space-y-6">
      {/* Selected job import results */}
      {selectedJob && (
        <section
          aria-label="Import job results"
          className="min-w-0 space-y-4 rounded-[8px] border border-[#E5E2D9] bg-white p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E2D9] pb-3">
            <div>
              <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
                Import results · <span className="font-mono">{selectedJob.job_id}</span>
              </h2>
              <p className="mt-0.5 text-[12.5px] text-[#5A6560]">
                {selectedJob.job_id === 'job-demo-benchmark'
                  ? 'Preloaded synthetic benchmark: 52 records accepted, 0 rejected, 0 duplicates, 10 threads, 11 attachments linked.'
                  : `Source file: ${selectedJob.source_file_name || 'Not reported'}`}
              </p>
            </div>
            <Badge
              label={JOB_STATUS_TONE[selectedJob.status]?.label || selectedJob.status}
              tone={JOB_STATUS_TONE[selectedJob.status]?.tone || 'neutral'}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <Stat label="Accepted" value={selectedJob.counts.rows_ok} sourceLabel={sourceLabel} />
            <Stat label="Rejected" value={selectedJob.counts.rows_failed} sourceLabel={sourceLabel} />
            <Stat label="Duplicate" value={selectedJob.counts.rows_duplicate} sourceLabel={sourceLabel} />
            <Stat label="Threads detected" value={selectedJob.counts.threads} sourceLabel={sourceLabel} />
            <Stat
              label="Attachments linked"
              value={selectedJob.counts.attachments_linked}
              sourceLabel={sourceLabel}
            />
          </div>

          {selectedJob.warnings.length > 0 && (
            <Banner tone="warn" title="Ingestion warnings">
              <ul className="list-disc pl-5 space-y-1 text-[13px]">
                {selectedJob.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Banner>
          )}

          {/* Failed / duplicate record table */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-[14px] font-semibold text-[#102D2A]">
                Record diagnostics
              </h3>
              <SegmentedControl<'FAILED' | 'DUPLICATE_EXACT' | 'CONFLICTING_DUPLICATE'>
                ariaLabel="Filter record status"
                size="sm"
                value={recordFilter}
                onChange={setRecordFilter}
                options={[
                  { value: 'FAILED', label: 'Failed' },
                  { value: 'DUPLICATE_EXACT', label: 'Exact duplicate' },
                  { value: 'CONFLICTING_DUPLICATE', label: 'Conflicting' },
                ]}
              />
            </div>

            {recordsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : recordsQuery.error ? (
              <ErrorState
                message={
                  recordsQuery.error instanceof Error
                    ? recordsQuery.error.message
                    : 'Unable to load record diagnostics.'
                }
                onRetry={() => void recordsQuery.refetch()}
              />
            ) : (
              <Table
                caption="Ingestion failed and duplicate records"
                columns={recordColumns}
                rows={recordsQuery.data || []}
                rowKey={(rec) => `${rec.row_number}-${rec.status}-${rec.reason_code}`}
                emptyMessage={`No ${recordFilter.toLowerCase().replace(/_/g, ' ')} records reported for this job.`}
              />
            )}
          </div>
        </section>
      )}

      {/* Import history */}
      <section aria-label="Import history" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">Import history</h2>
          <span className="text-[12px] text-[#5A6560]">Select a job row to inspect counts and failed records.</span>
        </div>

        {jobsLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : jobsError ? (
          <ErrorState
            message={jobsError instanceof Error ? jobsError.message : 'Unable to load ingestion history.'}
            onRetry={onRetryJobs}
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No ingestion jobs recorded"
            description="Upload an authorised emails CSV archive above to start an ingestion job."
          />
        ) : (
          <Table
            caption="Historical and active ingestion jobs"
            columns={jobColumns}
            rows={jobs}
            rowKey={(job) => job.job_id}
            selectedKey={selectedJob?.job_id ?? null}
            onRowClick={(job) => onSelectJob(job.job_id)}
          />
        )}
      </section>
    </div>
  );
};
