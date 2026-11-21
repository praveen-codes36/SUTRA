import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, Paperclip } from 'lucide-react';
import { useSutra } from '../../app/providers';
import { formatFileSize } from '../../lib/format';
import { locateQuote } from '../../lib/quote';
import { ATTACHMENT_STATUS_META } from '../../lib/semantics';
import { emailService } from '../../services/emailService';
import type { AttachmentSummary } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';

const STATUS_EXPLANATIONS: Record<string, string> = {
  MISSING_FILE:
    'The email metadata references this attachment filename, but the file was not supplied in the archive.',
  UNSUPPORTED:
    'This file format cannot be parsed or extracted by the current document pipeline.',
  OVERSIZE:
    'This attachment exceeded the configured upload size threshold and was not indexed.',
  ENCRYPTED:
    'This file is encrypted or password-protected and cannot be read automatically.',
  CORRUPT:
    'The file appears damaged or malformed and could not be parsed.',
  MALWARE_FLAGGED:
    'This file was quarantined by security scanning and is blocked from viewing.',
  EXTRACTION_FAILED:
    'Text extraction failed during processing. Refer to the email body for context.',
  PENDING: 'Attachment extraction is queued or in progress on the backend.',
};

export interface EvidenceAttachmentTabProps {
  attachments: AttachmentSummary[];
  selectedAttachmentId: string | null;
  onSelectAttachment: (attachmentId: string) => void;
  quote?: string | null;
}

export const EvidenceAttachmentTab: React.FC<EvidenceAttachmentTabProps> = ({
  attachments,
  selectedAttachmentId,
  onSelectAttachment,
  quote,
}) => {
  const { mode, dataSource, persona, addToast } = useSutra();
  const [downloading, setDownloading] = useState(false);

  const activeId = selectedAttachmentId || attachments[0]?.attachment_id || null;

  const attQuery = useQuery({
    queryKey: emailService.keys.attachment(mode, persona?.persona_id ?? null, activeId || ''),
    queryFn: () => emailService.getAttachment(dataSource, activeId!),
    enabled: Boolean(activeId),
  });

  if (!activeId && attachments.length === 0) {
    return (
      <p className="py-6 text-[13px] text-[#5A6560]">
        This email has no attachments recorded.
      </p>
    );
  }

  const handleDownload = async () => {
    if (!activeId || mode !== 'live') return;
    setDownloading(true);
    try {
      const url = await emailService.getAttachmentDownloadUrl(dataSource, activeId);
      if (!url) {
        addToast({ tone: 'info', title: 'Download URL unavailable for this attachment.' });
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.rel = 'noopener noreferrer';
      link.download = attQuery.data?.filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      addToast({
        tone: 'error',
        title: 'Unable to retrieve attachment download URL',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {attachments.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select attachment">
          {attachments.map((att) => {
            const active = att.attachment_id === activeId;
            return (
              <button
                key={att.attachment_id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectAttachment(att.attachment_id)}
                className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-[12px] font-medium cursor-pointer ${
                  active
                    ? 'border-[#102D2A] bg-[#102D2A] text-[#F5F2EA]'
                    : 'border-[#7B8581] bg-white text-[#102D2A] hover:bg-[#E8EFEA]'
                }`}
              >
                <Paperclip size={12} aria-hidden="true" />
                <span>{att.filename}</span>
              </button>
            );
          })}
        </div>
      )}

      {attQuery.isLoading ? (
        <div className="space-y-2 py-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : attQuery.error ? (
        <ErrorState
          title="Unable to load attachment"
          message={attQuery.error instanceof Error ? attQuery.error.message : 'Attachment unavailable.'}
          onRetry={() => void attQuery.refetch()}
        />
      ) : attQuery.data ? (
        (() => {
          const att = attQuery.data;
          const statusMeta = ATTACHMENT_STATUS_META[att.status];
          const lowOcr = typeof att.ocr_confidence === 'number' && att.ocr_confidence < 0.75;
          const explanation = STATUS_EXPLANATIONS[att.status];

          return (
            <div className="space-y-3">
              <div className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/60 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[13px] font-semibold text-[#102D2A] break-all">
                      {att.filename}
                    </p>
                    <p className="mt-1 text-[12px] text-[#5A6560] tabular-nums">
                      {att.detected_mime || 'Unknown MIME'} · {formatFileSize(att.size_bytes)}
                    </p>
                  </div>
                  <Badge
                    label={statusMeta.label}
                    tone={statusMeta.tone}
                    icon={statusMeta.icon}
                    title={statusMeta.tooltip}
                  />
                </div>

                {mode === 'live' && att.status === 'READY' && (
                  <div className="mt-3 border-t border-[#E5E2D9] pt-2.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={downloading}
                      onClick={() => void handleDownload()}
                      leftIcon={<Download size={14} aria-hidden="true" />}
                    >
                      Download attachment
                    </Button>
                  </div>
                )}
              </div>

              {att.status !== 'READY' && (
                <Banner tone={statusMeta.tone === 'error' ? 'error' : 'warn'}>
                  {att.status_detail || explanation || statusMeta.tooltip}
                </Banner>
              )}

              {lowOcr && (
                <Banner tone="warn">
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle size={14} aria-hidden="true" />
                    <span>
                      Low-confidence OCR ({Math.round((att.ocr_confidence ?? 0) * 100)}%). Verify numbers against the original source document.
                    </span>
                  </span>
                </Banner>
              )}

              {att.table && att.table.columns.length > 0 && (
                <div className="overflow-x-auto rounded-[4px] border border-[#E5E2D9] bg-white">
                  <table className="w-full border-collapse text-left text-[12.5px]">
                    <caption className="sr-only">
                      Extracted table from {att.filename}
                    </caption>
                    <thead className="bg-[#F5F2EA]">
                      <tr className="border-b border-[#E5E2D9]">
                        {att.table.columns.map((col) => (
                          <th
                            key={col}
                            scope="col"
                            className="px-3 py-2 font-display font-semibold text-[#102D2A] whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2D9]">
                      {att.table.rows.map((row, rIdx) => {
                        const rowText = row.join(' ');
                        const matchesQuote = Boolean(quote && locateQuote(rowText, quote));
                        return (
                          <tr
                            key={rIdx}
                            className={matchesQuote ? 'bg-[#FBF0D9]/70' : 'bg-white'}
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-3 py-2 text-[#202B35] tabular-nums"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {att.text_content && (
                <div>
                  <p className="mb-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                    Extracted text
                  </p>
                  <pre className="whitespace-pre-wrap break-words rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/50 p-3.5 font-mono text-[12px] leading-[1.55] text-[#202B35]">
                    {att.text_content}
                  </pre>
                </div>
              )}
            </div>
          );
        })()
      ) : null}
    </div>
  );
};
