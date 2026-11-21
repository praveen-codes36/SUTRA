import React from 'react';
import { Paperclip, Quote } from 'lucide-react';
import { formatDateShort } from '../../lib/format';
import type { Citation } from '../../types/api';

export interface CitationInspectTarget {
  emailId: string;
  quote?: string | null;
  attachmentId?: string | null;
  tab?: 'email' | 'attachment' | 'thread';
  verification?: Citation['verification'];
}

export interface CitationChipProps {
  citation?: Citation;
  emailId?: string;
  label?: string;
  quote?: string | null;
  attachmentId?: string | null;
  indexNumber?: number;
  showUtc?: boolean;
  onInspect?: (target: CitationInspectTarget) => void;
  className?: string;
}

export const CitationChip: React.FC<CitationChipProps> = ({
  citation,
  emailId,
  label,
  quote,
  attachmentId,
  indexNumber,
  showUtc = false,
  onInspect,
  className = '',
}) => {
  const resolvedEmailId = citation?.email_id || emailId || '';
  const resolvedQuote = citation?.quote ?? quote ?? null;
  const resolvedAttId = citation?.attachment_id ?? attachmentId ?? null;
  const senderLabel = citation?.sender?.role || citation?.sender?.address;
  const dateLabel = citation?.timestamp
    ? formatDateShort(citation.timestamp, { showUtc })
    : null;

  const accessibleParts = [
    indexNumber !== undefined ? `Source ${indexNumber}` : 'Source',
    resolvedEmailId,
    senderLabel,
    dateLabel,
    citation?.attachment_filename ? `Attachment ${citation.attachment_filename}` : null,
  ].filter(Boolean);

  const visibleText =
    label ||
    (indexNumber !== undefined ? `[${indexNumber}] ${resolvedEmailId}` : resolvedEmailId);

  const handleClick = () => {
    if (!onInspect || !resolvedEmailId) return;
    onInspect({
      emailId: resolvedEmailId,
      quote: resolvedQuote,
      attachmentId: resolvedAttId,
      tab: resolvedAttId ? 'attachment' : 'email',
      verification: citation?.verification,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!onInspect || !resolvedEmailId}
      aria-label={accessibleParts.join(', ')}
      title={
        resolvedQuote
          ? `${accessibleParts.join(' · ')} — “${resolvedQuote.slice(0, 120)}”`
          : accessibleParts.join(' · ')
      }
      className={`inline-flex items-center gap-1 rounded-[4px] border border-[#102D2A]/25 bg-[#E8EFEA] px-2 py-0.5 font-mono text-[11.5px] font-semibold text-[#102D2A] tabular-nums transition-colors duration-150 hover:border-[#102D2A] hover:bg-[#102D2A] hover:text-[#F5F2EA] disabled:cursor-default disabled:opacity-70 cursor-pointer ${className}`}
    >
      <Quote size={11} aria-hidden="true" className="shrink-0" />
      <span>{visibleText}</span>
      {resolvedAttId && <Paperclip size={11} aria-hidden="true" className="shrink-0" />}
    </button>
  );
};
