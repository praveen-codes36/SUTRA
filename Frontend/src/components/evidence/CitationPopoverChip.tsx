import React, { useEffect, useId, useRef, useState } from 'react';
import { Paperclip, Quote } from 'lucide-react';
import { formatDateShort, formatDateTime, formatUtcTooltip } from '../../lib/format';
import { locateQuote } from '../../lib/quote';
import type { Citation } from '../../types/api';
import { Badge } from '../ui/Badge';
import { RolePill } from '../ui/RolePill';
import type { CitationInspectTarget } from './CitationChip';

export interface CitationPopoverChipProps {
  citation: Citation;
  indexNumber?: number;
  emailBody?: string | null;
  showUtc?: boolean;
  onInspect: (target: CitationInspectTarget) => void;
  className?: string;
}

export const CitationPopoverChip: React.FC<CitationPopoverChipProps> = ({
  citation,
  indexNumber,
  emailBody = null,
  showUtc = false,
  onInspect,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const popoverId = useId();

  const senderLabel = citation.sender?.role || citation.sender?.address;
  const dateLabel = citation.timestamp
    ? formatDateShort(citation.timestamp, { showUtc })
    : null;

  const accessibleParts = [
    indexNumber !== undefined ? `Source ${indexNumber}` : 'Source',
    citation.email_id,
    senderLabel,
    dateLabel,
    citation.attachment_filename ? `Attachment ${citation.attachment_filename}` : null,
  ].filter(Boolean);

  const visibleLabel =
    indexNumber !== undefined ? `[${indexNumber}] ${citation.email_id}` : citation.email_id;

  const clearTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPopover = () => {
    clearTimer();
    if (wrapperRef.current && typeof window !== 'undefined') {
      const rect = wrapperRef.current.getBoundingClientRect();
      setAlignRight(rect.left + 350 > window.innerWidth - 16);
    }
    setOpen(true);
  };

  const scheduleClose = () => {
    clearTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const renderExcerpt = () => {
    if (emailBody && citation.quote) {
      const match = locateQuote(emailBody, citation.quote);
      if (match) {
        const ctxStart = Math.max(0, match.start - 55);
        const ctxEnd = Math.min(emailBody.length, match.end + 55);
        const prefix = ctxStart > 0 ? '…' : '';
        const suffix = ctxEnd < emailBody.length ? '…' : '';
        return (
          <p className="text-[12.5px] leading-[1.55] text-[#202B35] whitespace-pre-wrap break-words">
            <span>{prefix}{emailBody.slice(ctxStart, match.start)}</span>
            <mark className="rounded-[2px] bg-[#FBF0D9] px-0.5 font-medium text-[#102D2A]">
              {emailBody.slice(match.start, match.end)}
            </mark>
            <span>{emailBody.slice(match.end, ctxEnd)}{suffix}</span>
          </p>
        );
      }
    }

    if (citation.quote) {
      return (
        <p className="text-[12.5px] leading-[1.55] text-[#202B35] break-words">
          <mark className="rounded-[2px] bg-[#FBF0D9] px-1 py-0.5 font-medium text-[#102D2A]">
            “{citation.quote}”
          </mark>
        </p>
      );
    }

    return (
      <p className="text-[12px] italic text-[#5A6560]">
        No excerpt preview provided; click to inspect source email.
      </p>
    );
  };

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex align-baseline ${className}`}
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-label={accessibleParts.join(', ')}
        aria-describedby={open ? popoverId : undefined}
        onFocus={openPopover}
        onBlur={scheduleClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        onClick={() => {
          setOpen(false);
          onInspect({
            emailId: citation.email_id,
            quote: citation.quote || null,
            attachmentId: citation.attachment_id ?? null,
            tab: citation.attachment_id ? 'attachment' : 'email',
            verification: citation.verification,
          });
        }}
        className="inline-flex items-center gap-1 rounded-[4px] border border-[#102D2A]/25 bg-[#E8EFEA] px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-[#102D2A] tabular-nums transition-colors duration-150 hover:border-[#102D2A] hover:bg-[#102D2A] hover:text-[#F5F2EA] cursor-pointer"
      >
        <Quote size={10} aria-hidden="true" className="shrink-0" />
        <span>{visibleLabel}</span>
        {citation.attachment_id && <Paperclip size={10} aria-hidden="true" className="shrink-0" />}
      </button>

      {open && (
        <div
          id={popoverId}
          role="tooltip"
          onMouseEnter={clearTimer}
          onMouseLeave={scheduleClose}
          className={`fixed inset-x-3 bottom-16 z-40 rounded-[8px] border border-[#7B8581] bg-white p-3.5 text-left shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:z-30 sm:mt-1.5 sm:w-[330px] sm:max-w-[calc(100vw-2rem)] ${
            alignRight ? 'sm:right-0 sm:left-auto' : 'sm:left-0 sm:right-auto'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E2D9] pb-2">
            <div className="flex items-center gap-1.5">
              <span className="rounded-[4px] bg-[#102D2A] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#F5F2EA] tabular-nums">
                {citation.email_id}
              </span>
              {citation.thread_id && (
                <span className="font-mono text-[11px] text-[#5A6560] tabular-nums">
                  {citation.thread_id}
                </span>
              )}
            </div>
            <span
              title={formatUtcTooltip(citation.timestamp)}
              className="text-[11px] text-[#5A6560] tabular-nums"
            >
              {formatDateTime(citation.timestamp, { showUtc })}
            </span>
          </div>

          {citation.subject && (
            <p className="mt-2 font-display text-[13px] font-semibold text-[#102D2A]">
              {citation.subject}
            </p>
          )}

          {citation.sender && (
            <div className="mt-1">
              <RolePill person={citation.sender} />
            </div>
          )}

          <div className="mt-2 rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/60 p-2.5">
            {renderExcerpt()}
          </div>

          {citation.attachment_filename && (
            <p className="mt-2 flex items-center gap-1 text-[11.5px] font-medium text-[#102D2A]">
              <Paperclip size={11} aria-hidden="true" />
              <span className="font-mono break-all">{citation.attachment_filename}</span>
            </p>
          )}

          {citation.verification && (
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge
                label={citation.verification.email_exists ? 'Email exists' : 'Email missing'}
                tone={citation.verification.email_exists ? 'success' : 'error'}
                icon={citation.verification.email_exists ? 'CheckCircle2' : 'XCircle'}
              />
              <Badge
                label={citation.verification.access_ok ? 'Access ok' : 'Restricted'}
                tone={citation.verification.access_ok ? 'success' : 'error'}
                icon={citation.verification.access_ok ? 'CheckCircle2' : 'Ban'}
              />
              <Badge
                label={citation.verification.quote_found ? 'Quote found' : 'Quote unverified'}
                tone={citation.verification.quote_found ? 'success' : 'warning'}
                icon={citation.verification.quote_found ? 'CheckCircle2' : 'AlertTriangle'}
              />
              {citation.verification.values_match !== undefined && (
                <Badge
                  label={citation.verification.values_match ? 'Values match' : 'Value mismatch'}
                  tone={citation.verification.values_match ? 'success' : 'warning'}
                  icon={citation.verification.values_match ? 'CheckCircle2' : 'AlertTriangle'}
                />
              )}
            </div>
          )}

          <p className="mt-2 text-[11px] font-medium text-[#5A6560]">
            Click chip to open full email &amp; attachments in Evidence drawer.
          </p>
        </div>
      )}
    </span>
  );
};
