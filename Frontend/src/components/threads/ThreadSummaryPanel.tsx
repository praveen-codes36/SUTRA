import React from 'react';
import { RefreshCw } from 'lucide-react';
import { formatDateTime, formatUtcTooltip } from '../../lib/format';
import {
  DEADLINE_STATE_META,
  THREAD_STATUS_META,
} from '../../lib/semantics';
import type { ActionItem, ThreadSummary } from '../../types/api';
import { CitationChip } from '../evidence/CitationChip';
import { matchSummaryDeadlineAction } from './matchSummaryDeadline';
import { Badge, StatusPill } from '../ui/Badge';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';

export interface ThreadSummaryPanelProps {
  summary: ThreadSummary | undefined;
  actions: ActionItem[];
  loading: boolean;
  error: unknown;
  isLive: boolean;
  canRefresh: boolean;
  refreshing: boolean;
  showUtc: boolean;
  onRefreshSummary: () => void;
  onNavigateEmail: (emailId: string) => void;
}

export const ThreadSummaryPanel: React.FC<ThreadSummaryPanelProps> = ({
  summary,
  actions,
  loading,
  error,
  isLive,
  canRefresh,
  refreshing,
  showUtc,
  onRefreshSummary,
  onNavigateEmail,
}) => {
  if (loading) {
    return (
      <section className="rounded-[8px] border border-[#E5E2D9] bg-white p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-3 h-28 w-full" />
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="rounded-[8px] border border-[#E5E2D9] bg-white p-5">
        <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
          Conversation summary
        </h2>
        <p className="mt-2 text-[13px] text-[#5A6560]">
          {error instanceof Error
            ? `Summary unavailable (${error.message}).`
            : 'No verified summary is available for this conversation.'}
        </p>
      </section>
    );
  }

  const { content } = summary;
  const latestMeta = THREAD_STATUS_META[content.latest_status.class];
  const pendingActions = actions.filter((a) => content.pending_action_ids.includes(a.action_id));

  return (
    <section
      aria-label="Verified conversation summary"
      className="min-w-0 space-y-4 rounded-[8px] border-t-2 border-t-[#102D2A] border-x border-b border-x-[#E5E2D9] border-b-[#E5E2D9] bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E2D9] pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[17px] font-semibold text-[#102D2A]">
            Conversation summary
          </h2>
          <Badge
            label={
              summary.verification_status === 'VERIFIED'
                ? 'Source-verified summary'
                : summary.verification_status === 'DRAFT_UNVERIFIED'
                  ? 'Draft — unverified'
                  : 'Verification failed'
            }
            tone={
              summary.verification_status === 'VERIFIED'
                ? 'success'
                : summary.verification_status === 'DRAFT_UNVERIFIED'
                  ? 'warning'
                  : 'error'
            }
            icon={summary.verification_status === 'VERIFIED' ? 'CheckCircle2' : 'AlertTriangle'}
          />
          {!isLive && (
            <span className="text-[11.5px] font-medium text-[#7A5C1E]">Demo annotation</span>
          )}
        </div>

        {isLive && canRefresh && (
          <Button
            variant="secondary"
            size="sm"
            loading={refreshing}
            onClick={onRefreshSummary}
            leftIcon={<RefreshCw size={13} aria-hidden="true" />}
          >
            Refresh summary
          </Button>
        )}
      </div>

      {summary.verification_status === 'DRAFT_UNVERIFIED' && (
        <Banner tone="warn" title="Draft summary — source verification incomplete">
          Verify key statements directly against the cited messages below before relying on this summary.
        </Banner>
      )}
      {summary.verification_status === 'FAILED' && (
        <Banner tone="error" title="Summary verification failed">
          Automated grounding checks did not pass for this version. Inspect the chronological email messages below.
        </Banner>
      )}
      {summary.stale && (
        <Banner tone="info" title="Summary updating — newer messages exist">
          Additional messages arrived after summary version {summary.summary_version} was generated.
        </Banner>
      )}

      {/* Latest status callout */}
      <div className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/75 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
              Latest status
            </span>
            <StatusPill
              label={latestMeta.label}
              tone={latestMeta.tone}
              icon={latestMeta.icon}
              title={latestMeta.tooltip}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#5A6560]">
            <span>As of</span>
            <CitationChip
              emailId={content.latest_status.as_of_email_id}
              onInspect={(t) => onNavigateEmail(t.emailId)}
            />
            <span title={formatUtcTooltip(content.latest_status.as_of_time)} className="tabular-nums">
              {formatDateTime(content.latest_status.as_of_time, { showUtc })}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[14.5px] font-medium leading-[1.55] text-[#102D2A]">
          {content.latest_status.text}
        </p>
      </div>

      {/* Purpose & initial context */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Purpose
          </h3>
          <p className="mt-1 text-[14px] leading-[1.55] text-[#202B35]">{content.purpose}</p>
        </div>
        <div>
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Initial context
          </h3>
          <p className="mt-1 text-[14px] leading-[1.55] text-[#202B35]">
            {content.initial_context}
          </p>
        </div>
      </div>

      {/* Key developments with citation chips */}
      <div className="border-t border-[#E5E2D9] pt-4">
        <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
          Key developments
        </h3>
        <ul className="mt-2 space-y-2">
          {content.discussion_points.map((point, idx) => (
            <li
              key={idx}
              className="flex flex-wrap items-baseline gap-2 text-[14px] leading-[1.55] text-[#202B35]"
            >
              <span>• {point.text}</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                {point.email_ids.map((eid) => (
                  <CitationChip
                    key={`${idx}-${eid}`}
                    emailId={eid}
                    onInspect={(t) => onNavigateEmail(t.emailId)}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pending actions, Deadlines, Unresolved */}
      <div className="grid gap-4 border-t border-[#E5E2D9] pt-4 md:grid-cols-3">
        <div>
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Pending actions
          </h3>
          {pendingActions.length > 0 ? (
            <ul className="mt-2 space-y-2 text-[13px] text-[#202B35]">
              {pendingActions.map((act) => (
                <li key={act.action_id} className="space-y-1">
                  <p className="font-medium">{act.task}</p>
                  {act.evidence[0]?.email_id && (
                    <CitationChip
                      emailId={act.evidence[0].email_id}
                      onInspect={(t) => onNavigateEmail(t.emailId)}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-[#5A6560]">
              {content.pending_note || 'No pending action stated in the emails'}
            </p>
          )}
        </div>

        <div>
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Deadlines
          </h3>
          {content.deadlines.length === 0 ? (
            <p className="mt-2 text-[13px] text-[#5A6560]">No deadlines stated in the emails.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-[13px] text-[#202B35]">
              {content.deadlines.map((dl, idx) => {
                const matchedAction = matchSummaryDeadlineAction(dl, actions);
                const stateMeta = matchedAction
                  ? DEADLINE_STATE_META[matchedAction.deadline_state]
                  : null;
                return (
                  <li key={idx} className="min-w-0 space-y-1 break-words">
                    <p>{dl.text}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {stateMeta && (
                        <StatusPill
                          label={stateMeta.label}
                          tone={stateMeta.tone}
                          icon={stateMeta.icon}
                          title={stateMeta.tooltip}
                        />
                      )}
                      {dl.email_ids.map((eid) => (
                        <CitationChip
                          key={`dl-${idx}-${eid}`}
                          emailId={eid}
                          onInspect={(t) => onNavigateEmail(t.emailId)}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
            Unresolved items
          </h3>
          {content.unresolved.length === 0 ? (
            <p className="mt-2 text-[13px] text-[#5A6560]">No unresolved items recorded.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-[13px] text-[#202B35]">
              {content.unresolved.map((item, idx) => (
                <li key={idx} className="space-y-1">
                  <p>{item.text}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.email_ids.map((eid) => (
                      <CitationChip
                        key={`unres-${idx}-${eid}`}
                        emailId={eid}
                        onInspect={(t) => onNavigateEmail(t.emailId)}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
