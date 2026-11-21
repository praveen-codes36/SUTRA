import Papa from 'papaparse';
import type { IngestionStageName } from '../types/api';

export interface OfficialEvaluationCriterion {
  id: string;
  criterion: string;
  weightPercent: number;
  notes: string;
}

export const OFFICIAL_EVALUATION_WEIGHTS: OfficialEvaluationCriterion[] = [
  {
    id: 'thread_reconstruction',
    criterion: 'Thread Reconstruction & Organization',
    weightPercent: 15,
    notes: 'Reconstruction accuracy across In-Reply-To, References, and Subject heuristic matching.',
  },
  {
    id: 'evaluation_cases',
    criterion: 'Official Evaluation Cases (Decisions & Actions)',
    weightPercent: 30,
    notes: 'Extraction of binding institutional decisions, attribution, status, and action items with deadlines.',
  },
  {
    id: 'sample_queries',
    criterion: 'Sample Queries & Source Grounding (RAG)',
    weightPercent: 45,
    notes: 'Hybrid retrieval accuracy, claim-level email citations, and hallucination-free answer synthesis.',
  },
  {
    id: 'architecture_reliability',
    criterion: 'Architecture, Reliability & Usability',
    weightPercent: 10,
    notes: 'Performance latency, provenance compliance, graceful error states, and UX responsiveness.',
  },
];

export interface IngestionStepItem {
  name: IngestionStageName;
  label: string;
}

export const INGESTION_PIPELINE_STEPS: IngestionStepItem[] = [
  { name: 'file_received', label: 'File received & validated' },
  { name: 'schema_validation', label: 'CSV schema & header check' },
  { name: 'records_parsed', label: 'Email records parsed' },
  { name: 'threads_reconstructed', label: 'Conversation threads reconstructed' },
  { name: 'attachments_registered', label: 'Attachments extracted & indexed' },
  { name: 'index_prepared', label: 'Hybrid vector & BM25 index built' },
  { name: 'workspace_ready', label: 'Workspace ready for queries' },
];

export interface CsvPrecheckIssue {
  rowNumber: number;
  field: string;
  severity: 'error' | 'warning';
  reason: string;
  value?: string;
}

export interface CsvPrecheckResult {
  fileName: string;
  fileSizeBytes: number;
  rowCount: number;
  detectedColumns: string[];
  missingColumns: string[];
  duplicateEmailIds: Array<{ emailId: string; rows: number[] }>;
  errorCount: number;
  warningCount: number;
  issues: CsvPrecheckIssue[];
  isValid: boolean;
}

export async function precheckEmailsCsvFile(
  file: File,
  options?: { maxUploadMb?: number; suppliedAttachmentNames?: string[] },
): Promise<CsvPrecheckResult> {
  const issues: CsvPrecheckIssue[] = [];
  const maxMb = options?.maxUploadMb || 100;

  if (file.size > maxMb * 1024 * 1024) {
    issues.push({
      rowNumber: 0,
      field: 'file_size',
      severity: 'error',
      reason: `File size exceeds the configured maximum upload limit of ${maxMb} MB.`,
      value: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    });
  }

  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const detectedColumns = results.meta.fields || [];
        const rows = results.data;
        const missingColumns: string[] = [];

        // Check required columns
        const requiredColumns = ['email_id', 'sender', 'recipient', 'date', 'subject', 'body'];
        const lowerColumns = detectedColumns.map((c) => c.toLowerCase().trim());

        for (const req of requiredColumns) {
          if (!lowerColumns.some((c) => c === req || c === req.replace('_', ''))) {
            missingColumns.push(req);
            issues.push({
              rowNumber: 1,
              field: req,
              severity: 'error',
              reason: `Required column '${req}' is missing from the CSV header.`,
            });
          }
        }

        // Validate individual rows
        const seenIds = new Map<string, number[]>();
        rows.forEach((row, idx) => {
          const rowNumber = idx + 2; // 1-indexed, header is row 1
          const emailId = (row.email_id || row.emailId || row.id || '').trim();

          if (!emailId) {
            issues.push({
              rowNumber,
              field: 'email_id',
              severity: 'error',
              reason: 'Empty or missing email_id.',
            });
          } else {
            const existing = seenIds.get(emailId);
            if (existing) {
              existing.push(rowNumber);
              issues.push({
                rowNumber,
                field: 'email_id',
                severity: 'error',
                reason: `Duplicate email_id detected: '${emailId}'.`,
                value: emailId,
              });
            } else {
              seenIds.set(emailId, [rowNumber]);
            }
          }

          const sender = (row.sender || row.from || '').trim();
          if (!sender) {
            issues.push({
              rowNumber,
              field: 'sender',
              severity: 'error',
              reason: 'Missing sender address.',
            });
          }

          const date = (row.date || row.timestamp || '').trim();
          if (date) {
            const parsedDate = Date.parse(date);
            if (Number.isNaN(parsedDate)) {
              issues.push({
                rowNumber,
                field: 'date',
                severity: 'warning',
                reason: 'Unparseable date format; ISO-8601 recommended.',
                value: date,
              });
            }
          }
        });

        const duplicateEmailIds: Array<{ emailId: string; rows: number[] }> = [];
        for (const [emailId, rowsList] of seenIds.entries()) {
          if (rowsList.length > 1) {
            duplicateEmailIds.push({ emailId, rows: rowsList });
          }
        }

        const errorCount = issues.filter((i) => i.severity === 'error').length;
        const warningCount = issues.filter((i) => i.severity === 'warning').length;
        const isValid = errorCount === 0;

        resolve({
          fileName: file.name,
          fileSizeBytes: file.size,
          rowCount: rows.length,
          detectedColumns,
          missingColumns,
          duplicateEmailIds,
          errorCount,
          warningCount,
          issues,
          isValid,
        });
      },
      error: (error) => {
        issues.push({
          rowNumber: 0,
          field: 'parser',
          severity: 'error',
          reason: `CSV parser failure: ${error.message}`,
        });
        resolve({
          fileName: file.name,
          fileSizeBytes: file.size,
          rowCount: 0,
          detectedColumns: [],
          missingColumns: [],
          duplicateEmailIds: [],
          errorCount: 1,
          warningCount: 0,
          issues,
          isValid: false,
        });
      },
    });
  });
}

export function buildPrecheckErrorReportCsv(result: CsvPrecheckResult): string {
  const rows = [
    ['CSV Row', 'Field', 'Severity', 'Reason', 'Value'],
    ...result.issues.map((i) => [
      i.rowNumber.toString(),
      i.field,
      i.severity,
      `"${i.reason.replace(/"/g, '""')}"`,
      `"${(i.value || '').replace(/"/g, '""')}"`,
    ]),
  ];
  return rows.map((r) => r.join(',')).join('\n');
}
