import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ExternalLink, FileSearch, Paperclip } from 'lucide-react';
import { formatDateTime, formatUtcTooltip } from '../../lib/format';
import type { Citation, EmailMessage } from '../../types/api';
import { Badge } from '../ui/Badge';
import { CodeQuote } from '../ui/CodeQuote';
import { RolePill } from '../ui/RolePill';
import type { CitationInspectTarget } from './CitationChip';

export interface SourceCardProps {
  citation?: Citation;
  email?: EmailMessage;
  showUtc?: boolean;
  onInspect?: (target: CitationInspectTarget) => void;
  className?: string;
}

export const SourceCard: React.FC<SourceCardProps> = ({
  citation,
  email,
  showUtc = false,
  onInspect,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  const emailId = citation?.email_id || email?.email_id || '';
  const threadKey = citation?.thread_id || email?.thread_key || '';
  const subject = citation?.subject ?? email?.subject ?? 'Untitled message';
  const sender = citation?.sender ?? email?.sender;
  const timestamp = citation?.timestamp || email?.timestamp || '';
  const quote = citation?.quote || null;
  const verification = citation?.verification;

  return (
    <article
      className={`rounded-[6px] border border-[#E5E2D9] bg-white p-3.5 text-[13px] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="rounded-[4px] bg-[#E8EFEA] px-2 py-0.5 font-mono text-[12px] font-semibold text-[#102D2A] tabular-nums">
            {emailId}
          </span>
          {threadKey && (
            <Link
              to={`/app/threads/${encodeURIComponent(threadKey)}?email=${encodeURIComponent(emailId)}`}
              className="rounded-[4px] border border-[#7B8581]/50 bg-[#F5F2EA] px-2 py-0.5 font-mono text-[11.5px] font-medium text-[#102D2A] hover:border-[#102D2A] tabular-nums"
            >
              {threadKey}
            </Link>
          )}
          {citation?.evidence_role && (
            <Badge label={citation.evidence_role} tone="forest" />
          )}
        </div>
        <span
          title={formatUtcTooltip(timestamp)}
          className="text-[12px] text-[#5A6560] tabular-nums"
        >
          {formatDateTime(timestamp, { showUtc })}
        </span>
      </div>

      <h3 className="mt-2 font-display text-[14px] font-semibold text-[#102D2A]">{subject}</h3>
      {sender && (
        <div className="mt-1">
          <RolePill person={sender} />
        </div>
      )}

      {quote && (
        <blockquote className="mt-2.5 border-l-2 border-[#D5B77B] bg-[#F5F2EA]/60 py-1.5 pl-3 pr-2 text-[13px] leading-[1.55] text-[#202B35]">
          “{quote}”
        </blockquote>
      )}

      {verification && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge
            label={verification.email_exists ? 'Email verified' : 'Email unverified'}
            tone={verification.email_exists ? 'success' : 'error'}
            icon={verification.email_exists ? 'CheckCircle2' : 'XCircle'}
          />
          <Badge
            label={verification.quote_found ? 'Quote found' : 'Quote not matched'}
            tone={verification.quote_found ? 'success' : 'warning'}
            icon={verification.quote_found ? 'CheckCircle2' : 'AlertTriangle'}
          />
        </div>
      )}

      {(citation?.attachment_id || (email && email.attachments.length > 0)) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {citation?.attachment_id && citation.attachment_filename && (
            <button
              type="button"
              onClick={() =>
                onInspect?.({
                  emailId,
                  quote,
                  attachmentId: citation.attachment_id,
                  tab: 'attachment',
                  verification,
                })
              }
              className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B8581] bg-white px-2 py-1 text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
            >
              <Paperclip size={12} aria-hidden="true" />
              <span>{citation.attachment_filename}</span>
            </button>
          )}
          {email?.attachments.map((att) => (
            <button
              key={att.attachment_id}
              type="button"
              onClick={() =>
                onInspect?.({
                  emailId,
                  quote,
                  attachmentId: att.attachment_id,
                  tab: 'attachment',
                  verification,
                })
              }
              className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B8581] bg-white px-2 py-1 text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
            >
              <Paperclip size={12} aria-hidden="true" />
              <span>{att.filename}</span>
            </button>
          ))}
        </div>
      )}

      {email && expanded && (
        <div className="mt-3">
          <CodeQuote body={email.body_raw} quote={quote} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E2D9] pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {onInspect && emailId && (
            <button
              type="button"
              onClick={() =>
                onInspect({
                  emailId,
                  quote,
                  attachmentId: citation?.attachment_id ?? null,
                  tab: 'email',
                  verification,
                })
              }
              className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1 text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
            >
              <FileSearch size={13} aria-hidden="true" />
              <span>Inspect in Evidence drawer</span>
            </button>
          )}
          {email && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
            >
              {expanded ? (
                <>
                  <ChevronUp size={13} aria-hidden="true" />
                  <span>Hide full email</span>
                </>
              ) : (
                <>
                  <ChevronDown size={13} aria-hidden="true" />
                  <span>Expand original email</span>
                </>
              )}
            </button>
          )}
        </div>

        {threadKey && (
          <Link
            to={`/app/threads/${encodeURIComponent(threadKey)}?email=${encodeURIComponent(emailId)}`}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#102D2A] hover:underline"
          >
            <span>Open complete conversation</span>
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
};
