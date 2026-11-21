import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, XCircle } from 'lucide-react';
import { formatFileSize } from '../../lib/format';
import {
  buildPrecheckErrorReportCsv,
  type CsvPrecheckIssue,
  type CsvPrecheckResult,
} from '../../lib/csvPrecheck';
import { Badge } from '../ui/Badge';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Pagination } from '../ui/Pagination';
import { Table, type TableColumn } from '../ui/Table';

export interface IngestionPrecheckPanelProps {
  result: CsvPrecheckResult | null;
  fileType: string;
}

const ISSUES_PAGE_SIZE = 10;

export const IngestionPrecheckPanel: React.FC<IngestionPrecheckPanelProps> = ({
  result,
  fileType,
}) => {
  const [page, setPage] = useState(1);

  const totalPages = result ? Math.max(1, Math.ceil(result.issues.length / ISSUES_PAGE_SIZE)) : 1;
  const safePage = Math.min(page, totalPages);

  const visibleIssues = useMemo(() => {
    if (!result) return [];
    const start = (safePage - 1) * ISSUES_PAGE_SIZE;
    return result.issues.slice(start, start + ISSUES_PAGE_SIZE);
  }, [result, safePage]);

  if (!result) {
    return null;
  }

  const handleDownloadReport = () => {
    const csv = buildPrecheckErrorReportCsv(result);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.fileName.replace(/\.csv$/i, '')}-precheck-report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns: Array<TableColumn<CsvPrecheckIssue>> = [
    {
      key: 'row',
      header: 'CSV row',
      widthClass: 'w-[92px]',
      render: (issue) => (
        <span className="font-mono text-[12px] font-semibold text-[#102D2A] tabular-nums">
          {issue.rowNumber === 0 ? 'File' : issue.rowNumber === 1 ? 'Header (1)' : `Row ${issue.rowNumber}`}
        </span>
      ),
    },
    {
      key: 'field',
      header: 'Field',
      widthClass: 'w-[130px]',
      render: (issue) => (
        <span className="font-mono text-[12px] text-[#202B35]">{issue.field}</span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      widthClass: 'w-[120px]',
      render: (issue) => (
        <Badge
          label={issue.severity === 'error' ? 'Error' : 'Warning'}
          tone={issue.severity === 'error' ? 'error' : 'warning'}
          icon={issue.severity === 'error' ? 'XCircle' : 'AlertTriangle'}
        />
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (issue) => <span className="text-[13px] text-[#202B35]">{issue.reason}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      render: (issue) => (
        <span className="font-mono text-[12px] text-[#5A6560] break-all">
          {issue.value || '—'}
        </span>
      ),
    },
  ];

  return (
    <section
      aria-label="Browser pre-check results"
      className="space-y-4 rounded-[8px] border border-[#E5E2D9] bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E2D9] pb-3">
        <div>
          <p className="font-display text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#7A5C1E]">
            Browser pre-check (the backend validates authoritatively)
          </p>
          <h2 className="mt-0.5 font-display text-[16px] font-semibold text-[#102D2A]">
            {result.fileName}
          </h2>
          <p className="mt-1 text-[12.5px] text-[#5A6560] tabular-nums">
            {formatFileSize(result.fileSizeBytes)} · {fileType || 'text/csv'} ·{' '}
            {result.rowCount} data row{result.rowCount === 1 ? '' : 's'} ·{' '}
            {result.detectedColumns.length} column{result.detectedColumns.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {result.errorCount === 0 && result.warningCount === 0 ? (
            <Badge label="Pre-check passed" tone="success" icon="CheckCircle2" />
          ) : result.errorCount > 0 ? (
            <Badge
              label={`${result.errorCount} error${result.errorCount === 1 ? '' : 's'}`}
              tone="error"
              icon="XCircle"
            />
          ) : (
            <Badge
              label={`${result.warningCount} warning${result.warningCount === 1 ? '' : 's'}`}
              tone="warning"
              icon="AlertTriangle"
            />
          )}

          {result.issues.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadReport}
              leftIcon={<Download size={14} aria-hidden="true" />}
            >
              Download error report (CSV)
            </Button>
          )}
        </div>
      </div>

      {result.missingColumns.length > 0 && (
        <Banner tone="error" title="Required header columns missing">
          Missing column{result.missingColumns.length === 1 ? '' : 's'}:{' '}
          <span className="font-mono font-semibold">{result.missingColumns.join(', ')}</span>. Expected case-insensitive columns: email_id, thread_id, sender, recipients, subject, timestamp, body, in_reply_to, attachments.
        </Banner>
      )}

      {result.duplicateEmailIds.length > 0 && (
        <Banner tone="error" title="Duplicate email_id values detected">
          {result.duplicateEmailIds
            .map((d) => `${d.emailId} (rows ${d.rows.join(', ')})`)
            .join('; ')}
        </Banner>
      )}

      {result.issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-[4px] border border-[#1E6B45]/30 bg-[#E3F1E8]/60 px-4 py-3 text-[13px] text-[#1E6B45]">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>
            All required columns, email_id uniqueness, timestamps, and bodies passed the browser pre-check.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[12.5px] text-[#5A6560]">
            {result.errorCount > 0 ? (
              <XCircle size={15} className="text-[#A3342B]" aria-hidden="true" />
            ) : (
              <AlertTriangle size={15} className="text-[#8A5A00]" aria-hidden="true" />
            )}
            <span>
              Row numbers correspond to lines in the uploaded CSV (row 1 is the header).
            </span>
          </div>

          <Table
            caption="CSV pre-check validation issues"
            columns={columns}
            rows={visibleIssues}
            rowKey={(issue, idx) => `${issue.rowNumber}-${issue.field}-${idx}`}
          />

          {result.issues.length > ISSUES_PAGE_SIZE && (
            <Pagination
              hasPrev={safePage > 1}
              hasNext={safePage < totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              pageNumber={safePage}
              pageSize={ISSUES_PAGE_SIZE}
              itemCount={visibleIssues.length}
              totalEstimate={result.issues.length}
            />
          )}
        </div>
      )}
    </section>
  );
};
