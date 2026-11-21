import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpLeft,
  Clock,
  ExternalLink,
  MailOpen,
  Paperclip,
} from 'lucide-react';
import { usePrefs } from '../../hooks/usePrefs';
import {
  formatDateTime,
  formatFileSize,
  formatINR,
  formatUtcTooltip,
} from '../../lib/format';
import {
  ATTACHMENT_STATUS_META,
  DECISION_TYPE_META,
  getActionStatusMeta,
} from '../../lib/semantics';
import type { ActionItem, Decision, EmailMessage, Mention } from '../../types/api';
import { Badge } from '../ui/Badge';
import { RolePill } from '../ui/RolePill';
import type { CitationInspectTarget } from '../evidence/CitationChip';

export interface EmailPreviewPanelProps {
  email: EmailMessage | null;
  loading?: boolean;
  citingDecisions: Decision[];
  citingActions: ActionItem[];
  onSelectParentEmail: (emailId: string) => void;
  onInspectEvidence: (target: CitationInspectTarget) => void;
}

function formatMentionChip(mention: Mention): string {
  if (mention.kind === 'AMOUNT') {
    const numeric =
      typeof mention.normalized_value === 'number'
        ? mention.normalized_value
        : Number(mention.normalized_value);
    if (Number.isFinite(numeric)) {
      const normalised = formatINR(numeric);
      if (mention.original_text.trim() !== normalised) {
        return `${mention.original_text} → ${normalised}`;
      }
      return normalised;
    }
  }
  if (mention.kind === 'TIME') {
    return mention.original_text;
  }
  return `${mention.original_text} (${mention.kind.toLowerCase()})`;
}

export const EmailPreviewPanel: React.FC<EmailPreviewPanelProps> = ({
  email,
  loading = false,
  citingDecisions,
  citingActions,
  onSelectParentEmail,
  onInspectEvidence,
}) => {
  const { prefs } = usePrefs();
  const [localUtc, setLocalUtc] = useState(prefs.showUtc);
  const [showCleaned, setShowCleaned] = useState(false);

  useEffect(() => {
    setLocalUtc(prefs.showUtc);
    setShowCleaned(false);
  }, [email?.email_id, prefs.showUtc]);

  if (loading) {
    return (
      <div className="rounded-[8px] border border-[#E5E2D9] bg-white p-6 text-[13px] text-[#5A6560]">
        Loading message record…
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[8px] border border-[#E5E2D9] bg-white p-8 text-center">
        <MailOpen size={24} className="text-[#5A6560]" aria-hidden="true" />
        <p className="mt-3 font-display text-[15px] font-semibold text-[#102D2A]">
          Select a message to inspect
        </p>
        <p className="mt-1 max-w-[36ch] text-[13px] text-[#5A6560]">
          Choose any row from the list to view verbatim headers, attachments, mentions, and linked intelligence.
        </p>
      </div>
    );
  }

  const backendCleanedBody = (email as EmailMessage & { body_cleaned?: string }).body_cleaned;
  const displayedBody =
    showCleaned && backendCleanedBody ? backendCleanedBody : email.body_raw;

  return (
    <article
      aria-label={`Message preview ${email.email_id}`}
      className="min-w-0 max-w-full space-y-4 rounded-[8px] border border-[#E5E2D9] bg-white p-5"
    >
      {/* Header metadata */}
      <header className="space-y-2 border-b border-[#E5E2D9] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[4px] bg-[#E8EFEA] px-2 py-0.5 font-mono text-[12px] font-semibold text-[#102D2A] tabular-nums">
              {email.email_id}
            </span>
            <span className="rounded-[4px] border border-[#7B8581]/50 bg-[#F5F2EA] px-2 py-0.5 font-mono text-[12px] font-medium text-[#102D2A] tabular-nums">
              {email.thread_key}
            </span>
          </div>

          <Link
            to={`/app/threads/${encodeURIComponent(email.thread_key)}?email=${encodeURIComponent(email.email_id)}`}
            className="inline-flex items-center gap-1 font-display text-[12.5px] font-semibold text-[#102D2A] hover:underline"
          >
            <span>Open complete conversation</span>
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>

        <h2 className="font-display text-[18px] font-semibold text-[#102D2A] break-words">
          {email.subject || 'Untitled message'}
        </h2>

        <dl className="grid gap-1.5 pt-1 text-[13px]">
          <div className="flex flex-wrap items-baseline gap-2 min-w-0">
            <dt className="w-16 shrink-0 font-display font-semibold text-[#5A6560]">From</dt>
            <dd className="min-w-0 flex-1">
              <RolePill person={email.sender} showAddressInline />
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-2 min-w-0">
            <dt className="w-16 shrink-0 font-display font-semibold text-[#5A6560]">To</dt>
            <dd className="min-w-0 flex-1 flex flex-wrap gap-x-3 gap-y-1">
              {email.recipients.map((r, i) => (
                <RolePill key={`${r.address}-${i}`} person={r} />
              ))}
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="w-16 shrink-0 font-display font-semibold text-[#5A6560]">Sent</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span
                data-testid="email-preview-timestamp"
                title={formatUtcTooltip(email.timestamp)}
                className="font-medium text-[#202B35] tabular-nums"
              >
                {formatDateTime(email.timestamp, { showUtc: localUtc })}
              </span>
              <button
                type="button"
                onClick={() => setLocalUtc((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B8581] bg-white px-2 py-0.5 text-[11px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
              >
                <Clock size={11} aria-hidden="true" />
                <span>{localUtc ? 'Show IST' : 'Show UTC'}</span>
              </button>
            </dd>
          </div>

          {email.in_reply_to && (
            <div className="flex flex-wrap items-center gap-2">
              <dt className="w-16 shrink-0 font-display font-semibold text-[#5A6560]">Reply to</dt>
              <dd>
                <button
                  type="button"
                  onClick={() => onSelectParentEmail(email.in_reply_to!)}
                  className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B8581] bg-white px-2 py-0.5 font-mono text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                >
                  <ArrowUpLeft size={12} aria-hidden="true" />
                  <span>Parent message {email.in_reply_to}</span>
                </button>
              </dd>
            </div>
          )}
        </dl>
      </header>

      {/* Decision and Action badges citing this email */}
      {(citingDecisions.length > 0 || citingActions.length > 0) && (
        <div className="space-y-2 border-b border-[#E5E2D9] pb-3.5">
          <p className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Linked extracted intelligence
          </p>
          <div className="flex flex-wrap gap-2">
            {citingDecisions.map((dec) => {
              const meta = DECISION_TYPE_META[dec.type];
              const ev = dec.evidence.find((e) => e.email_id === email.email_id);
              return (
                <button
                  key={dec.decision_id}
                  type="button"
                  onClick={() =>
                    onInspectEvidence({
                      emailId: email.email_id,
                      quote: ev?.quote || null,
                      tab: 'email',
                    })
                  }
                  className="max-w-full cursor-pointer rounded-[4px]"
                  title="Inspect decision evidence quote"
                >
                  <Badge
                    label={`${meta.label}: ${dec.subject}`}
                    tone={meta.tone}
                    icon={meta.icon}
                  />
                </button>
              );
            })}
            {citingActions.map((act) => {
              const meta = getActionStatusMeta(act.status);
              const ev = act.evidence.find((e) => e.email_id === email.email_id);
              return (
                <button
                  key={act.action_id}
                  type="button"
                  onClick={() =>
                    onInspectEvidence({
                      emailId: email.email_id,
                      quote: ev?.quote || null,
                      tab: 'email',
                    })
                  }
                  className="max-w-full cursor-pointer rounded-[4px]"
                  title="Inspect action item evidence quote"
                >
                  <Badge
                    label={`Action (${meta.label}): ${act.task.slice(0, 42)}${act.task.length > 42 ? '…' : ''}`}
                    tone={meta.tone}
                    icon={meta.icon}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Verbatim message body */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Original message body
          </p>
          {backendCleanedBody && (
            <button
              type="button"
              onClick={() => setShowCleaned((prev) => !prev)}
              className="text-[12px] font-medium text-[#102D2A] underline cursor-pointer"
            >
              {showCleaned ? 'Show original body' : 'Show cleaned body'}
            </button>
          )}
        </div>
        <div
          data-testid="email-preview-body"
          className="email-measure whitespace-pre-wrap break-words rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/50 px-4 py-3 text-[#202B35]"
        >
          {displayedBody}
        </div>
      </div>

      {/* Extracted mentions */}
      {email.mentions && email.mentions.length > 0 && (
        <div className="border-t border-[#E5E2D9] pt-3.5">
          <p className="mb-2 font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Extracted mentions
          </p>
          <div className="flex flex-wrap gap-2">
            {email.mentions.map((m, idx) => (
              <span
                key={`${m.kind}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#7B8581]/60 bg-[#F5F2EA] px-2.5 py-1 text-[12px] font-medium text-[#102D2A] tabular-nums"
              >
                <span className="font-mono text-[10.5px] uppercase text-[#7A5C1E]">{m.kind}</span>
                <span>{formatMentionChip(m)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <div className="border-t border-[#E5E2D9] pt-3.5">
          <p className="mb-2 font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Attachments ({email.attachments.length})
          </p>
          <ul className="space-y-2">
            {email.attachments.map((att) => {
              const statusMeta = ATTACHMENT_STATUS_META[att.status];
              return (
                <li
                  key={att.attachment_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/50 px-3 py-2 text-[12.5px]"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Paperclip size={13} className="shrink-0 text-[#102D2A]" aria-hidden="true" />
                    <span className="font-mono font-semibold text-[#102D2A] break-all">
                      {att.filename}
                    </span>
                    <Badge
                      label={statusMeta.label}
                      tone={statusMeta.tone}
                      icon={statusMeta.icon}
                    />
                    <span className="text-[#5A6560] tabular-nums">
                      {formatFileSize(att.size_bytes)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onInspectEvidence({
                        emailId: email.email_id,
                        attachmentId: att.attachment_id,
                        tab: 'attachment',
                      })
                    }
                    className="rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1 text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                  >
                    Open attachment
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
};
