import React from 'react';
import { isProvenanceReported } from '../../adapters/normalisers';
import { formatDateTime, formatUtcTooltip } from '../../lib/format';
import {
  ACTION_KIND_META,
  DEADLINE_STATE_META,
  getActionStatusMeta,
} from '../../lib/semantics';
import type { ActionItem } from '../../types/api';
import { CitationChip, type CitationInspectTarget } from '../evidence/CitationChip';
import { ProvenanceTag } from '../evidence/ProvenanceTag';
import { Badge, StatusPill } from '../ui/Badge';
import { RolePill } from '../ui/RolePill';

export interface ThreadActionsSectionProps {
  actions: ActionItem[];
  pendingNote?: string | null;
  showUtc: boolean;
  onNavigateEmail: (emailId: string, quote?: string | null) => void;
  onInspectAttachment: (target: CitationInspectTarget) => void;
}

export const ThreadActionsSection: React.FC<ThreadActionsSectionProps> = ({
  actions,
  pendingNote,
  showUtc,
  onNavigateEmail,
  onInspectAttachment,
}) => {
  const hasPendingActions = actions.some(
    (a) =>
      a.status === 'OPEN' ||
      a.status === 'CONDITIONAL' ||
      a.status === 'IN_PROGRESS' ||
      a.status === 'BLOCKED',
  );

  return (
    <section aria-label="Action items extracted from this conversation" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[17px] font-semibold text-[#102D2A]">
          Action items ({actions.length})
        </h2>
        <span className="text-[12px] text-[#5A6560]">
          Read-only extracted commitments, instructions, and follow-up obligations.
        </span>
      </div>

      {!hasPendingActions && (
        <div
          data-testid="no-pending-action-banner"
          className="rounded-[6px] border border-[#E5E2D9] bg-[#E8EFEA]/65 px-4 py-3 text-[13px] font-medium text-[#102D2A]"
        >
          {pendingNote || 'No pending action stated in the emails'}
        </div>
      )}

      {actions.length === 0 ? (
        <div className="rounded-[8px] border border-[#E5E2D9] bg-white p-5 text-[13px] text-[#5A6560]">
          No action items were extracted from this conversation.
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((act) => {
            const statusMeta = getActionStatusMeta(act.status);
            const kindMeta = ACTION_KIND_META[act.action_kind];
            const deadlineMeta = DEADLINE_STATE_META[act.deadline_state];
            const isInferred = act.provenance === 'INFERRED';

            const deadlineDisplay =
              act.deadline.precision === 'RELATIVE' || !act.deadline.date
                ? act.deadline.text || 'No deadline stated'
                : `${formatDateTime(act.deadline.date, { showUtc, dateOnly: act.deadline.precision === 'DATE' })}${
                    act.deadline.text ? ` (${act.deadline.text})` : ''
                  }`;

            return (
              <article
                key={act.action_id}
                data-testid={`action-card-${act.action_id}`}
                className={`rounded-[8px] border p-5 ${
                  isInferred
                    ? 'border-dashed border-[#8A5A00]/70 bg-[#FBF0D9]/20'
                    : 'border-[#E5E2D9] bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      label={statusMeta.label}
                      tone={statusMeta.tone}
                      icon={statusMeta.icon}
                      title={statusMeta.tooltip}
                    />
                    <Badge
                      label={kindMeta.label}
                      tone={kindMeta.tone}
                      icon={kindMeta.icon}
                      title={kindMeta.tooltip}
                    />
                    <ProvenanceTag
                      provenance={act.provenance}
                      reported={isProvenanceReported(act)}
                    />
                  </div>
                  <StatusPill
                    label={deadlineMeta.label}
                    tone={deadlineMeta.tone}
                    icon={deadlineMeta.icon}
                    title={deadlineMeta.tooltip}
                  />
                </div>

                <h3 className="mt-2.5 font-display text-[15px] font-semibold text-[#102D2A]">
                  {act.task}
                </h3>

                <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                      Owner
                    </dt>
                    <dd className="mt-1 flex flex-wrap items-center gap-2">
                      <RolePill person={act.owner} unknownLabel="Owner not stated" />
                      {act.owner && act.owner_basis === 'INFERRED' && (
                        <span className="text-[11px] italic text-[#5A6560]">(owner inferred)</span>
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                      Deadline
                    </dt>
                    <dd
                      title={act.deadline.date ? formatUtcTooltip(act.deadline.date) : undefined}
                      className="mt-1 font-medium text-[#202B35] tabular-nums"
                    >
                      {deadlineDisplay}
                    </dd>
                  </div>
                </dl>

                <p className="mt-2.5 text-[13px] text-[#5A6560]">
                  <span className="font-semibold text-[#202B35]">Status basis:</span>{' '}
                  {act.status_basis}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#E5E2D9] pt-3">
                  {act.evidence.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] font-medium text-[#5A6560]">Source:</span>
                      {act.evidence.map((ev, idx) => (
                        <CitationChip
                          key={`${act.action_id}-ev-${idx}`}
                          emailId={ev.email_id}
                          quote={ev.quote}
                          attachmentId={ev.attachment_id}
                          label={
                            ev.attachment_filename
                              ? `${ev.email_id} · ${ev.attachment_filename}`
                              : ev.email_id
                          }
                          onInspect={(t) => {
                            if (t.attachmentId) {
                              onInspectAttachment({
                                emailId: t.emailId,
                                attachmentId: t.attachmentId,
                                quote: t.quote,
                                tab: 'attachment',
                              });
                            } else {
                              onNavigateEmail(t.emailId, t.quote);
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {act.completion_evidence.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] font-medium text-[#1E6B45]">
                        Completion evidence:
                      </span>
                      {act.completion_evidence.map((ev, idx) => (
                        <CitationChip
                          key={`${act.action_id}-comp-${idx}`}
                          emailId={ev.email_id}
                          quote={ev.quote}
                          attachmentId={ev.attachment_id}
                          label={
                            ev.attachment_filename
                              ? `${ev.email_id} · ${ev.attachment_filename}`
                              : ev.email_id
                          }
                          onInspect={(t) => {
                            if (t.attachmentId) {
                              onInspectAttachment({
                                emailId: t.emailId,
                                attachmentId: t.attachmentId,
                                quote: t.quote,
                                tab: 'attachment',
                              });
                            } else {
                              onNavigateEmail(t.emailId, t.quote);
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
