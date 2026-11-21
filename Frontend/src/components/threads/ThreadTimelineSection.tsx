import React from 'react';
import { ArrowUpLeft, Paperclip } from 'lucide-react';
import { formatDateTime, formatFileSize, formatUtcTooltip } from '../../lib/format';
import {
  ATTACHMENT_STATUS_META,
  DECISION_TYPE_META,
  getActionStatusMeta,
} from '../../lib/semantics';
import type { ActionItem, Decision, EmailMessage } from '../../types/api';
import type { CitationInspectTarget } from '../evidence/CitationChip';
import { Badge } from '../ui/Badge';
import { CodeQuote } from '../ui/CodeQuote';
import { RolePill } from '../ui/RolePill';

export interface ThreadTimelineSectionProps {
  emails: EmailMessage[];
  threadTitle: string | null;
  decisions: Decision[];
  actions: ActionItem[];
  selectedEmailId: string | null;
  highlightedQuote: string | null;
  showUtc: boolean;
  onSelectEmail: (emailId: string) => void;
  onInspectAttachment: (target: CitationInspectTarget) => void;
}

export const ThreadTimelineSection: React.FC<ThreadTimelineSectionProps> = ({
  emails,
  threadTitle,
  decisions,
  actions,
  selectedEmailId,
  highlightedQuote,
  showUtc,
  onSelectEmail,
  onInspectAttachment,
}) => {
  const sorted = emails
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <section aria-label="Chronological conversation timeline" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[17px] font-semibold text-[#102D2A]">
          Conversation timeline ({sorted.length} messages)
        </h2>
        <span className="text-[12px] text-[#5A6560]">
          Verbatim email records in chronological sequence.
        </span>
      </div>

      <div className="space-y-3">
        {sorted.map((email) => {
          const isSelected = selectedEmailId === email.email_id;
          const emailDecisions = decisions.filter((d) =>
            d.evidence.some((ev) => ev.email_id === email.email_id),
          );
          const emailActions = actions.filter((a) =>
            [...a.evidence, ...a.completion_evidence].some(
              (ev) => ev.email_id === email.email_id,
            ),
          );
          const subjectDiffers =
            email.subject &&
            threadTitle &&
            email.subject.trim().toLowerCase() !== threadTitle.trim().toLowerCase();

          return (
            <article
              key={email.email_id}
              id={`msg-${email.email_id}`}
              data-email-id={email.email_id}
              data-selected={isSelected ? 'true' : 'false'}
              tabIndex={-1}
              aria-label={`Message ${email.email_id} from ${email.sender.role || email.sender.address}`}
              className={`min-w-0 scroll-mt-24 rounded-[8px] border p-4 sm:p-5 transition-colors duration-200 focus:outline-2 focus:outline-[#102D2A] focus:outline-offset-2 ${
                isSelected
                  ? 'border-[#102D2A] bg-[#E8EFEA]/45 ring-2 ring-[#D5B77B]/70'
                  : 'border-[#E5E2D9] bg-white'
              }`}
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E2D9] pb-3">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-[4px] bg-[#E8EFEA] px-2 py-0.5 font-mono text-[12px] font-semibold text-[#102D2A] tabular-nums">
                      {email.email_id}
                    </span>
                    <RolePill person={email.sender} showAddressInline />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#5A6560]">
                    <span className="font-medium">To:</span>
                    {email.recipients.map((r, idx) => (
                      <RolePill key={`${r.address}-${idx}`} person={r} />
                    ))}
                  </div>
                  {subjectDiffers && (
                    <p className="font-display text-[13.5px] font-semibold text-[#102D2A]">
                      Subject: {email.subject}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    title={formatUtcTooltip(email.timestamp)}
                    className="text-[12.5px] font-medium text-[#202B35] tabular-nums"
                  >
                    {formatDateTime(email.timestamp, { showUtc })}
                  </span>
                  {email.in_reply_to && (
                    <button
                      type="button"
                      onClick={() => onSelectEmail(email.in_reply_to!)}
                      className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B8581] bg-white px-2 py-0.5 font-mono text-[11.5px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                    >
                      <ArrowUpLeft size={12} aria-hidden="true" />
                      <span>In reply to {email.in_reply_to}</span>
                    </button>
                  )}
                </div>
              </header>

              {(emailDecisions.length > 0 || emailActions.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5 min-w-0">
                  {emailDecisions.map((d) => {
                    const meta = DECISION_TYPE_META[d.type];
                    return (
                      <Badge
                        key={d.decision_id}
                        label={`${meta.label}: ${d.subject}`}
                        tone={meta.tone}
                        icon={meta.icon}
                        className="max-w-full !whitespace-normal text-left"
                      />
                    );
                  })}
                  {emailActions.map((a) => {
                    const meta = getActionStatusMeta(a.status);
                    return (
                      <Badge
                        key={a.action_id}
                        label={`Action (${meta.label}): ${a.task.slice(0, 42)}${a.task.length > 42 ? '…' : ''}`}
                        tone={meta.tone}
                        icon={meta.icon}
                        className="max-w-full !whitespace-normal text-left"
                      />
                    );
                  })}
                </div>
              )}

              <div className="mt-3">
                {isInQuoteScope(isSelected, highlightedQuote) ? (
                  <CodeQuote body={email.body_raw} quote={highlightedQuote} />
                ) : (
                  <div className="email-measure whitespace-pre-wrap break-words rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/40 px-4 py-3 text-[#202B35]">
                    {email.body_raw}
                  </div>
                )}
              </div>

              {email.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E5E2D9] pt-3">
                  <span className="text-[12px] font-medium text-[#5A6560]">Attachments:</span>
                  {email.attachments.map((att) => {
                    const attMeta = ATTACHMENT_STATUS_META[att.status];
                    return (
                      <button
                        key={att.attachment_id}
                        type="button"
                        onClick={() =>
                          onInspectAttachment({
                            emailId: email.email_id,
                            attachmentId: att.attachment_id,
                            tab: 'attachment',
                          })
                        }
                        className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1 text-left text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                      >
                        <Paperclip size={12} aria-hidden="true" className="shrink-0" />
                        <span className="font-mono break-all">{att.filename}</span>
                        <span className="text-[11px] text-[#5A6560]">
                          ({attMeta.label}, {formatFileSize(att.size_bytes)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

function isInQuoteScope(isSelected: boolean, quote: string | null): boolean {
  return isSelected && Boolean(quote && quote.trim().length > 0);
}
