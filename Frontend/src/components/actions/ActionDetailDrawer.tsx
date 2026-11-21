import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Info, ShieldCheck } from 'lucide-react';
import { isProvenanceReported } from '../../adapters/normalisers';
import { formatDateTime, formatUtcTooltip } from '../../lib/format';
import {
  ACTION_KIND_META,
  DEADLINE_STATE_META,
  getActionStatusMeta,
} from '../../lib/semantics';
import type { ActionItem, ActionStatus, ReviewState } from '../../types/api';
import { CitationChip, type CitationInspectTarget } from '../evidence/CitationChip';
import { ProvenanceTag } from '../evidence/ProvenanceTag';
import { Badge, StatusPill } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { RolePill } from '../ui/RolePill';
import { Select } from '../ui/Select';

export interface ActionDetailDrawerProps {
  action: ActionItem | null;
  isDemo: boolean;
  canOverrideReview: boolean;
  showUtc: boolean;
  onClose: () => void;
  onInspectEvidence: (target: CitationInspectTarget) => void;
  onPatchReview?: (
    actionId: string,
    payload: { review_state: ReviewState; status?: ActionStatus; note?: string },
  ) => Promise<void>;
}

function getOwnerBasisLabel(basis: ActionItem['owner_basis']): string {
  if (basis === 'EXPLICIT') return 'Explicitly stated in email';
  if (basis === 'INFERRED') return 'Inferred from thread context';
  return 'Not stated in emails';
}

function getPrecisionLabel(precision: ActionItem['deadline']['precision']): string {
  if (precision === 'DATETIME') return 'Exact date & time';
  if (precision === 'DATE') return 'Date only (end of day)';
  if (precision === 'RELATIVE') return 'Relative wording';
  return 'None stated';
}

export const ActionDetailDrawer: React.FC<ActionDetailDrawerProps> = ({
  action,
  isDemo,
  canOverrideReview,
  showUtc,
  onClose,
  onInspectEvidence,
  onPatchReview,
}) => {
  const [reviewState, setReviewState] = useState<ReviewState>('CONFIRMED');
  const [overrideStatus, setOverrideStatus] = useState<string>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (action) {
      setReviewState(action.review_state === 'NONE' ? 'CONFIRMED' : action.review_state);
      setOverrideStatus(action.status);
      setNote('');
    }
  }, [action]);

  if (!action) {
    return (
      <Drawer open={false} onClose={onClose} title="Action details">
        <div />
      </Drawer>
    );
  }

  const statusMeta = getActionStatusMeta(action.status);
  const kindMeta = ACTION_KIND_META[action.action_kind];
  const deadlineMeta = DEADLINE_STATE_META[action.deadline_state];
  const primaryEvidence = action.evidence[0];

  const deadlineDisplay =
    action.deadline.precision === 'RELATIVE' || !action.deadline.date
      ? action.deadline.text || 'No deadline stated'
      : `${formatDateTime(action.deadline.date, {
          showUtc,
          dateOnly: action.deadline.precision === 'DATE',
        })}${action.deadline.text ? ` (${action.deadline.text})` : ''}`;

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo || !canOverrideReview || !onPatchReview) return;
    setSaving(true);
    try {
      await onPatchReview(action.action_id, {
        review_state: reviewState,
        status: overrideStatus ? (overrideStatus as ActionStatus) : undefined,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={Boolean(action)}
      onClose={onClose}
      title={action.task}
      subtitle={`${action.action_id} · Conversation ${action.thread_key}`}
      widthClass="max-w-[640px]"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <Link
            to={`/app/threads/${encodeURIComponent(action.thread_key)}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 font-display font-semibold text-[#102D2A] hover:underline"
          >
            <span>Open conversation timeline</span>
            <ExternalLink size={13} aria-hidden="true" />
          </Link>

          {primaryEvidence && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onInspectEvidence({
                  emailId: primaryEvidence.email_id,
                  quote: primaryEvidence.quote,
                  attachmentId: primaryEvidence.attachment_id ?? null,
                  tab: primaryEvidence.attachment_id ? 'attachment' : 'email',
                })
              }
            >
              Open source email ({primaryEvidence.email_id})
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5" data-testid={`action-drawer-${action.action_id}`}>
        {/* Explicit intelligence-only banner */}
        <div className="flex items-start gap-2 rounded-[6px] border border-[#102D2A]/20 bg-[#E8EFEA]/65 p-3 text-[12.5px] font-medium text-[#102D2A]">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Intelligence view — SUTRA does not assign, execute or update tasks.</span>
        </div>

        {/* Status, kind, deadline_state, provenance */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={statusMeta.label}
            tone={statusMeta.tone}
            icon={statusMeta.icon}
            title={statusMeta.tooltip}
          />
          <StatusPill
            label={deadlineMeta.label}
            tone={deadlineMeta.tone}
            icon={deadlineMeta.icon}
            title={deadlineMeta.tooltip}
          />
          <Badge
            label={kindMeta.label}
            tone={kindMeta.tone}
            icon={kindMeta.icon}
            title={kindMeta.tooltip}
          />
          <ProvenanceTag
            provenance={action.provenance}
            reported={isProvenanceReported(action)}
          />
        </div>

        {/* Structured metadata */}
        <dl className="grid gap-3 rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/50 p-3.5 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Owner &amp; basis
            </dt>
            <dd className="mt-1 space-y-1">
              <RolePill person={action.owner} unknownLabel="Owner not stated" />
              <p className="text-[12px] text-[#5A6560]">{getOwnerBasisLabel(action.owner_basis)}</p>
            </dd>
          </div>

          <div>
            <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Requested by
            </dt>
            <dd className="mt-1">
              <RolePill person={action.requested_by} unknownLabel="Requester not stated" />
            </dd>
          </div>

          <div>
            <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Due date &amp; precision
            </dt>
            <dd className="mt-1 space-y-0.5 tabular-nums">
              <div className="font-medium text-[#202B35]">{deadlineDisplay}</div>
              <div className="text-[11.5px] text-[#5A6560]">
                Precision: {getPrecisionLabel(action.deadline.precision)}
              </div>
              {action.deadline.date && (
                <div className="text-[11.5px] text-[#5A6560]">
                  {formatUtcTooltip(action.deadline.date)}
                </div>
              )}
            </dd>
          </div>

          <div>
            <dt className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Completed at
            </dt>
            <dd className="mt-1 tabular-nums text-[#202B35]">
              {action.completed_at ? (
                <div>
                  <div className="font-medium">{formatDateTime(action.completed_at, { showUtc })}</div>
                  <div className="text-[11.5px] text-[#5A6560]">
                    {formatUtcTooltip(action.completed_at)}
                  </div>
                </div>
              ) : (
                <span className="text-[#5A6560]">Not recorded</span>
              )}
            </dd>
          </div>
        </dl>

        {/* Status basis */}
        <section aria-label="Status basis">
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Status basis
          </h3>
          <p className="mt-1.5 rounded-[6px] border border-[#E5E2D9] bg-white p-3 text-[13.5px] leading-[1.55] text-[#202B35]">
            {action.status_basis}
          </p>
        </section>

        {/* Source evidence */}
        <section aria-label="Source evidence">
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Source evidence ({action.evidence.length})
          </h3>
          {action.evidence.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-[#5A6560]">No source quote attached.</p>
          ) : (
            <div className="mt-2 space-y-2.5">
              {action.evidence.map((ev, idx) => (
                <div
                  key={`${action.action_id}-src-${idx}`}
                  className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/45 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CitationChip
                      emailId={ev.email_id}
                      quote={ev.quote}
                      attachmentId={ev.attachment_id}
                      label={
                        ev.attachment_filename
                          ? `${ev.email_id} · ${ev.attachment_filename}`
                          : ev.email_id
                      }
                      onInspect={onInspectEvidence}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onInspectEvidence({
                          emailId: ev.email_id,
                          quote: ev.quote,
                          attachmentId: ev.attachment_id ?? null,
                          tab: ev.attachment_id ? 'attachment' : 'email',
                        })
                      }
                      className="text-[12px] font-semibold text-[#102D2A] hover:underline cursor-pointer"
                    >
                      Open source email
                    </button>
                  </div>
                  <blockquote className="mt-2 border-l-2 border-[#D5B77B] pl-3 text-[13px] leading-[1.55] text-[#202B35]">
                    <mark className="rounded-[2px] bg-[#FBF0D9] px-1 py-0.5 text-[#102D2A]">
                      “{ev.quote}”
                    </mark>
                  </blockquote>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Completion evidence */}
        <section aria-label="Completion evidence">
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Completion evidence ({action.completion_evidence.length})
          </h3>
          {action.completion_evidence.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-[#5A6560]">
              No completion evidence recorded in the available emails.
            </p>
          ) : (
            <div className="mt-2 space-y-2.5">
              {action.completion_evidence.map((ev, idx) => (
                <div
                  key={`${action.action_id}-comp-${idx}`}
                  className="rounded-[6px] border border-[#1E6B45]/25 bg-[#E3F1E8]/35 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CitationChip
                      emailId={ev.email_id}
                      quote={ev.quote}
                      attachmentId={ev.attachment_id}
                      label={
                        ev.attachment_filename
                          ? `${ev.email_id} · ${ev.attachment_filename}`
                          : ev.email_id
                      }
                      onInspect={onInspectEvidence}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onInspectEvidence({
                          emailId: ev.email_id,
                          quote: ev.quote,
                          attachmentId: ev.attachment_id ?? null,
                          tab: ev.attachment_id ? 'attachment' : 'email',
                        })
                      }
                      className="text-[12px] font-semibold text-[#102D2A] hover:underline cursor-pointer"
                    >
                      Open completion email
                    </button>
                  </div>
                  <blockquote className="mt-2 border-l-2 border-[#1E6B45] pl-3 text-[13px] leading-[1.55] text-[#202B35]">
                    <mark className="rounded-[2px] bg-[#E3F1E8] px-1 py-0.5 text-[#102D2A]">
                      “{ev.quote}”
                    </mark>
                  </blockquote>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Review override control — ONLY in live mode AND when signed-in role permits */}
        {!isDemo && canOverrideReview && onPatchReview && (
          <section
            aria-label="Review override"
            className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/60 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#102D2A]" aria-hidden="true" />
              <h3 className="font-display text-[13px] font-semibold text-[#102D2A]">
                Reviewer status override
              </h3>
            </div>

            <form onSubmit={(e) => void handleOverrideSubmit(e)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Review decision"
                  value={reviewState}
                  onChange={(v) => setReviewState(v as ReviewState)}
                  options={[
                    { value: 'CONFIRMED', label: 'Confirmed' },
                    { value: 'CORRECTED', label: 'Corrected' },
                    { value: 'REJECTED', label: 'Rejected' },
                  ]}
                />
                <Select
                  label="Action status"
                  value={overrideStatus}
                  onChange={setOverrideStatus}
                  options={[
                    { value: 'OPEN', label: 'Pending (OPEN)' },
                    { value: 'IN_PROGRESS', label: 'In progress' },
                    { value: 'DONE', label: 'Completed' },
                    { value: 'BLOCKED', label: 'Blocked' },
                    { value: 'CONDITIONAL', label: 'Conditional' },
                    { value: 'CANCELLED', label: 'Cancelled' },
                  ]}
                />
              </div>
              <div>
                <label
                  htmlFor="action-override-note"
                  className="block font-display text-[12px] font-medium text-[#202B35]"
                >
                  Review note (optional)
                </label>
                <input
                  id="action-override-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Basis for audit log…"
                  className="mt-1 min-h-[38px] w-full rounded-[4px] border border-[#7B8581] bg-white px-3 py-1.5 text-[13px] text-[#202B35]"
                />
              </div>
              <Button type="submit" variant="primary" size="sm" loading={saving}>
                Save review override
              </Button>
            </form>
          </section>
        )}
      </div>
    </Drawer>
  );
};
