import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Paperclip, Trash2, Upload } from 'lucide-react';
import { useSutra } from '../app/providers';
import { IngestionHistorySection } from '../components/ingestion/IngestionHistorySection';
import { IngestionPrecheckPanel } from '../components/ingestion/IngestionPrecheckPanel';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { FileDropzone } from '../components/ui/FileDropzone';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Stepper, type StepItem } from '../components/ui/Stepper';
import { env } from '../config/env';
import {
  INGESTION_PIPELINE_STEPS,
  precheckEmailsCsvFile,
  type CsvPrecheckResult,
} from '../lib/csvPrecheck';
import { formatFileSize } from '../lib/format';
import { SutraApiError } from '../services/apiClient';
import { ingestionService } from '../services/ingestionService';
import type { IngestionJob } from '../types/api';

const TERMINAL_JOB_STATUSES = new Set<IngestionJob['status']>([
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'CANCELLED',
]);

export const ImportPage: React.FC = () => {
  const { mode, dataSource, liveUser, addToast } = useSutra();
  const queryClient = useQueryClient();
  const isDemo = mode === 'demo';

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [precheck, setPrecheck] = useState<CsvPrecheckResult | null>(null);
  const [prechecking, setPrechecking] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<{ message: string; requestId?: string } | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [selectedHistoryJobId, setSelectedHistoryJobId] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ingestionService.keys.jobs(mode),
    queryFn: () => ingestionService.listJobs(dataSource),
  });

  const jobs = jobsQuery.data || [];

  // Poll active live job every 2 seconds until a terminal state; stops automatically on unmount
  const activeJobQuery = useQuery({
    queryKey: ingestionService.keys.job(mode, activeJobId || ''),
    queryFn: () => ingestionService.getJob(dataSource, activeJobId!),
    enabled: !isDemo && Boolean(activeJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || !TERMINAL_JOB_STATUSES.has(status)) {
        return 2000;
      }
      return false;
    },
  });

  const activeJob = activeJobQuery.data ?? null;

  useEffect(() => {
    if (activeJob && TERMINAL_JOB_STATUSES.has(activeJob.status)) {
      void queryClient.invalidateQueries({ queryKey: ingestionService.keys.jobs(mode) });
    }
  }, [activeJob, mode, queryClient]);

  const runPrecheck = useCallback(async (file: File | null, atts: File[]) => {
    if (!file) {
      setPrecheck(null);
      return;
    }
    setPrechecking(true);
    try {
      const result = await precheckEmailsCsvFile(file, {
        maxUploadMb: env.MAX_UPLOAD_MB,
        suppliedAttachmentNames: atts.map((f) => f.name),
      });
      setPrecheck(result);
    } finally {
      setPrechecking(false);
    }
  }, []);

  useEffect(() => {
    void runPrecheck(csvFile, attachmentFiles);
  }, [csvFile, attachmentFiles, runPrecheck]);

  const handleCsvSelected = (files: File[]) => {
    const first = files[0];
    if (!first) return;
    setUploadError(null);
    setCsvFile(first);
  };

  const handleAttachmentsSelected = (files: File[]) => {
    setUploadError(null);
    setAttachmentFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      for (const f of files) {
        byName.set(f.name, f);
      }
      return Array.from(byName.values());
    });
  };

  const attachmentSizeError = useMemo(() => {
    const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
    const totalBytes =
      (csvFile?.size || 0) + attachmentFiles.reduce((acc, f) => acc + f.size, 0);
    if (totalBytes > maxBytes) {
      return `Combined upload size (${formatFileSize(totalBytes)}) exceeds VITE_MAX_UPLOAD_MB (${env.MAX_UPLOAD_MB} MB).`;
    }
    return null;
  }, [csvFile, attachmentFiles]);

  const roleDisallowsIngest = !isDemo && liveUser?.can_ingest === false;
  const canStartLiveUpload =
    !isDemo &&
    !roleDisallowsIngest &&
    Boolean(csvFile) &&
    Boolean(precheck?.isValid) &&
    !attachmentSizeError &&
    !uploading;

  const handleStartUpload = async () => {
    if (!csvFile || isDemo || roleDisallowsIngest) return;
    if (!precheck?.isValid || attachmentSizeError) return;

    setUploading(true);
    setUploadPercent(0);
    setUploadError(null);

    try {
      const job = await ingestionService.createJob(dataSource, {
        emailsCsv: csvFile,
        attachments: attachmentFiles,
        onProgress: (pct) => setUploadPercent(pct),
      });
      setActiveJobId(job.job_id);
      setSelectedHistoryJobId(job.job_id);
      await queryClient.invalidateQueries({ queryKey: ingestionService.keys.jobs(mode) });
      addToast({
        tone: 'info',
        title: `Ingestion job ${job.job_id} queued`,
        message: 'Polling backend pipeline status every 2 seconds.',
      });
    } catch (err) {
      if (err instanceof SutraApiError) {
        setUploadError({ message: err.message, requestId: err.requestId });
      } else {
        setUploadError({
          message: err instanceof Error ? err.message : 'Unable to start ingestion job.',
        });
      }
    } finally {
      setUploading(false);
    }
  };

  // Seven-step Stepper driven strictly by backend job state; never marked complete in demo mode
  const stepperSteps = useMemo<StepItem[]>(() => {
    if (isDemo) {
      return INGESTION_PIPELINE_STEPS.map((step) => ({
        id: step.name,
        label: step.label,
        status: 'NOT_STARTED',
      }));
    }

    return INGESTION_PIPELINE_STEPS.map((step) => {
      if (!activeJob) {
        return {
          id: step.name,
          label: step.label,
          status: 'PENDING',
        };
      }
      const reported = activeJob.stages.find((s) => s.name === step.name);
      const status = reported?.status ?? 'PENDING';
      const detail =
        status === 'FAILED'
          ? activeJob.warnings[0] || 'Stage failed during backend processing.'
          : undefined;
      return {
        id: step.name,
        label: step.label,
        status,
        detail,
      };
    });
  }, [isDemo, activeJob]);

  const effectiveSelectedJobId = selectedHistoryJobId || activeJobId || jobs[0]?.job_id || null;

  return (
    <div className="mx-auto max-w-[1160px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E2D9] pb-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">Data Ingestion</h1>
          <p className="mt-1 text-[14px] text-[#5A6560]">
            Run an authoritative CSV browser pre-check, upload email records and attachments, and monitor the seven-stage ingestion pipeline.
          </p>
        </div>
        <p className="rounded-[4px] border border-[#E5E2D9] bg-white px-3 py-1.5 text-[12px] text-[#5A6560]">
          Live mailbox connectors are planned for a later phase.
        </p>
      </div>

      {isDemo && (
        <Banner tone="demo" title="Processing requires the backend. This is a browser-side pre-check.">
          You can drop any CSV file below to validate columns, duplicate email IDs, timestamps, bodies, and attachment references directly in the browser. Switching to Live mode is required to submit jobs to the backend pipeline.
        </Banner>
      )}

      {/* Upload panel */}
      <section
        aria-label="Dataset upload and validation"
        className="space-y-5 rounded-[8px] border border-[#E5E2D9] bg-white p-5"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <FileDropzone
              label="Drop emails.csv here or choose file"
              hint={`Required columns: email_id, thread_id, sender, recipients, subject, timestamp, body, in_reply_to, attachments · Max ${env.MAX_UPLOAD_MB} MB`}
              accept=".csv,text/csv"
              onFilesSelected={handleCsvSelected}
            />
            {csvFile && (
              <div className="flex items-center justify-between gap-3 rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/60 px-3.5 py-2.5 text-[13px]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet size={16} className="shrink-0 text-[#102D2A]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12.5px] font-semibold text-[#102D2A]">
                      {csvFile.name}
                    </p>
                    <p className="text-[11.5px] text-[#5A6560] tabular-nums">
                      {formatFileSize(csvFile.size)} · {csvFile.type || 'text/csv'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCsvFile(null);
                    setPrecheck(null);
                    setUploadError(null);
                  }}
                  aria-label={`Remove ${csvFile.name}`}
                  className="inline-flex min-h-[44px] min-w-[44px] lg:h-9 lg:w-9 lg:min-h-0 lg:min-w-0 items-center justify-center rounded-[4px] text-[#5A6560] hover:bg-[#F9E4E1] hover:text-[#A3342B] cursor-pointer"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <FileDropzone
              label="Optional: drop attachments (.zip or individual files)"
              hint="Supplied filenames are cross-checked against the CSV attachments column before upload."
              accept=".zip,.txt,.csv,.pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg"
              multiple
              onFilesSelected={handleAttachmentsSelected}
            />
            {attachmentFiles.length > 0 && (
              <div className="rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/60 p-3">
                <div className="mb-2 flex items-center justify-between text-[12px] text-[#5A6560]">
                  <span className="font-display font-semibold text-[#102D2A]">
                    Selected attachments ({attachmentFiles.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachmentFiles([])}
                    className="inline-flex min-h-[44px] lg:min-h-0 items-center text-[12px] font-medium text-[#A3342B] hover:underline cursor-pointer"
                  >
                    Clear attachments
                  </button>
                </div>
                <ul className="max-h-32 overflow-y-auto divide-y divide-[#E5E2D9] text-[12px]">
                  {attachmentFiles.map((file) => (
                    <li
                      key={file.name}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate font-mono text-[#202B35]">
                        <Paperclip size={12} className="shrink-0 text-[#5A6560]" aria-hidden="true" />
                        <span className="truncate">{file.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[#5A6560]">
                        {formatFileSize(file.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {attachmentSizeError && (
          <Banner tone="error" title="Upload size limit exceeded">
            {attachmentSizeError}
          </Banner>
        )}

        {uploadError && (
          <ErrorState
            title="Ingestion upload failed"
            message={uploadError.message}
            requestId={uploadError.requestId}
          />
        )}

        {uploadPercent !== null && uploading && (
          <ProgressBar value={uploadPercent} label="Uploading archive to SUTRA backend" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E2D9] pt-4">
          <p className="text-[12.5px] text-[#5A6560]">
            {prechecking
              ? 'Running PapaParse browser pre-check…'
              : isDemo
                ? 'Backend upload disabled in Demo dataset mode; browser pre-check runs locally.'
                : roleDisallowsIngest
                  ? 'Your signed-in role does not permit starting ingestion jobs.'
                  : precheck
                    ? precheck.isValid
                      ? 'Browser pre-check passed. Ready to upload to the SUTRA backend.'
                      : 'Resolve blocking pre-check errors before submitting to the backend.'
                    : 'Select an emails CSV file to run the browser pre-check.'}
          </p>

          <Button
            variant="primary"
            disabled={!canStartLiveUpload}
            loading={uploading}
            title={
              isDemo
                ? 'Processing requires the backend (switch to Live mode in Settings).'
                : roleDisallowsIngest
                  ? 'Your signed-in role does not allow data ingestion.'
                  : !csvFile
                    ? 'Select an emails CSV file first.'
                    : !precheck?.isValid
                      ? 'Resolve pre-check errors before uploading.'
                      : 'Upload CSV and start backend ingestion job'
            }
            onClick={() => void handleStartUpload()}
            leftIcon={<Upload size={15} aria-hidden="true" />}
          >
            Start backend ingestion
          </Button>
        </div>
      </section>

      {/* Browser pre-check details */}
      <IngestionPrecheckPanel
        result={precheck}
        fileType={csvFile?.type || 'text/csv'}
      />

      {/* Seven-stage processing workflow */}
      <section aria-label="Ingestion processing workflow" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
            Processing workflow
          </h2>
          <span className="text-[12px] text-[#5A6560]">
            {isDemo
              ? 'Demo mode — processing requires the backend'
              : activeJob
                ? `Tracking job ${activeJob.job_id} (${activeJob.status})`
                : 'Awaiting live upload'}
          </span>
        </div>

        {!isDemo && activeJobQuery.error && (
          <ErrorState
            title="Unable to poll ingestion job status"
            message={
              activeJobQuery.error instanceof Error
                ? activeJobQuery.error.message
                : 'Polling failed.'
            }
            onRetry={() => void activeJobQuery.refetch()}
          />
        )}

        <Stepper steps={stepperSteps} />
      </section>

      {/* Results, failed records, and history */}
      <IngestionHistorySection
        jobs={jobs}
        jobsLoading={jobsQuery.isLoading}
        jobsError={jobsQuery.error}
        onRetryJobs={() => void jobsQuery.refetch()}
        selectedJobId={effectiveSelectedJobId}
        onSelectJob={(jobId) => setSelectedHistoryJobId(jobId)}
      />
    </div>
  );
};

export default ImportPage;
