import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckSquare,
  ExternalLink,
  MessageSquare,
  Upload,
} from 'lucide-react';
import { isProvenanceReported } from '../adapters/normalisers';
import { useSutra } from '../app/providers';
import { OverviewAnalytics } from '../components/dashboard/OverviewAnalytics';
import { EvidenceDrawer } from '../components/evidence/EvidenceDrawer';
import { ProvenanceTag } from '../components/evidence/ProvenanceTag';
import { Badge, StatusPill } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { RolePill } from '../components/ui/RolePill';
import { Skeleton } from '../components/ui/Skeleton';
import { Stat } from '../components/ui/Stat';
import { Table, type TableColumn } from '../components/ui/Table';
import { Tabs } from '../components/ui/Tabs';
import { Constellation } from '../components/visualizations/Constellation';
import { useAsOf } from '../hooks/useAsOf';
import { usePrefs } from '../hooks/usePrefs';
import {
  formatDateTime,
  formatUtcTooltip,
  getTimeOfDayGreeting,
} from '../lib/format';
import {
  DECISION_TYPE_META,
  THREAD_STATUS_META,
  getActionStatusMeta,
} from '../lib/semantics';
import { actionService } from '../services/actionService';
import { decisionService } from '../services/decisionService';
import { emailService } from '../services/emailService';
import { intelligenceService } from '../services/intelligenceService';
import { threadService } from '../services/threadService';
import type { ThreadListItem } from '../types/api';

export const OverviewPage: React.FC = () => {
  const { mode, dataSource, persona, liveUser } = useSutra();
  const { prefs } = usePrefs();
  const [activityTab, setActivityTab] = useState<'messages' | 'threads' | 'decisions' | 'actions'>('messages');
  const [evidenceTarget, setEvidenceTarget] = useState<{
    emailId: string;
    quote?: string | null;
  } | null>(null);

  const scopeKey = persona?.persona_id ?? 'live';

  const overviewQuery = useQuery({
    queryKey: intelligenceService.keys.overview(mode, scopeKey),
    queryFn: () => intelligenceService.getOverview(dataSource),
  });
  const emailsQuery = useQuery({
    queryKey: emailService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => emailService.list(dataSource, { limit: 100 }),
  });
  const threadsQuery = useQuery({
    queryKey: threadService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => threadService.list(dataSource, { limit: 100 }),
  });
  const decisionsQuery = useQuery({
    queryKey: decisionService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => decisionService.list(dataSource, { limit: 100 }),
  });
  const actionsQuery = useQuery({
    queryKey: actionService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => actionService.list(dataSource, { limit: 100 }),
  });
  const topicsQuery = useQuery({
    queryKey: threadService.keys.topics(mode, scopeKey),
    queryFn: () => threadService.getTopics(dataSource),
  });

  const asOf = useAsOf(mode, overviewQuery.data?.as_of);
  const displayName =
    mode === 'demo'
      ? persona?.display_name || 'Workspace Reviewer'
      : liveUser?.display_name || 'Workspace User';

  const emails = emailsQuery.data?.items || [];
  const threads = threadsQuery.data?.items || [];
  const decisions = decisionsQuery.data?.items || [];
  const actions = actionsQuery.data?.items || [];
  const topics = topicsQuery.data || [];

  const kpiMetrics = useMemo(() => {
    const ov = overviewQuery.data;
    const ovErr = overviewQuery.error;
    const isDemo = mode === 'demo';
    const unavailableReason = ovErr
      ? `Analytics endpoint unavailable (${ovErr instanceof Error ? ovErr.message : 'error'})`
      : 'Not reported by backend';

    const resolveCount = (
      analyticsVal: number | null | undefined,
      metaTotal: number | null | undefined,
      fallbackErr: unknown,
    ): { display: string | number; source: string; footnote?: string } => {
      if (typeof analyticsVal === 'number') {
        return {
          display: analyticsVal,
          source: isDemo ? 'Demo annotation' : 'Live analytics',
        };
      }
      if (typeof metaTotal === 'number') {
        return {
          display: metaTotal,
          source: isDemo ? 'Demo annotation' : 'List estimate',
        };
      }
      return {
        display: '—',
        source: isDemo ? 'Demo annotation' : 'Unavailable',
        footnote: fallbackErr
          ? `Endpoint unavailable (${fallbackErr instanceof Error ? fallbackErr.message : 'error'})`
          : unavailableReason,
      };
    };

    const totalEmails = resolveCount(
      ov?.total_emails,
      emailsQuery.data?.meta?.total_estimate,
      emailsQuery.error,
    );
    const totalThreads = resolveCount(
      ov?.total_threads,
      threadsQuery.data?.meta?.total_estimate,
      threadsQuery.error,
    );
    const totalDecisions = resolveCount(
      ov?.total_decisions,
      decisionsQuery.data?.meta?.total_estimate,
      decisionsQuery.error,
    );

    let pendingActions: { display: string | number; source: string; footnote?: string };
    if (typeof ov?.pending_actions === 'number') {
      pendingActions = {
        display: ov.pending_actions,
        source: isDemo ? 'Demo annotation' : 'Live analytics',
        footnote: 'Pending = Open + Conditional action items',
      };
    } else if (actionsQuery.data && !actionsQuery.data.meta?.next_cursor) {
      pendingActions = {
        display: actions.filter((a) => a.status === 'OPEN' || a.status === 'CONDITIONAL').length,
        source: isDemo ? 'Demo annotation' : 'Action items list',
        footnote: 'Pending = Open + Conditional action items',
      };
    } else {
      pendingActions = {
        display: '—',
        source: isDemo ? 'Demo annotation' : 'Unavailable',
        footnote: unavailableReason,
      };
    }

    return { totalEmails, totalThreads, totalDecisions, pendingActions };
  }, [
    mode,
    overviewQuery.data,
    overviewQuery.error,
    emailsQuery.data,
    emailsQuery.error,
    threadsQuery.data,
    threadsQuery.error,
    decisionsQuery.data,
    decisionsQuery.error,
    actionsQuery.data,
    actions,
  ]);

  const isEmptyWorkspace =
    mode === 'live' &&
    !overviewQuery.isLoading &&
    !emailsQuery.isLoading &&
    !overviewQuery.error &&
    !emailsQuery.error &&
    kpiMetrics.totalEmails.display === 0;

  const liveCoreError =
    mode === 'live' &&
    !overviewQuery.isLoading &&
    !emailsQuery.isLoading &&
    !threadsQuery.isLoading &&
    Boolean(overviewQuery.error && emailsQuery.error && threadsQuery.error)
      ? overviewQuery.error || emailsQuery.error || threadsQuery.error
      : null;

  const threadColumns: Array<TableColumn<ThreadListItem>> = [
    {
      key: 'title',
      header: 'Conversation',
      render: (row) => (
        <div className="min-w-[200px]">
          <Link
            to={`/app/threads/${encodeURIComponent(row.thread_key)}`}
            className="font-display font-semibold text-[#102D2A] hover:underline"
          >
            {row.title || 'Untitled conversation'}
          </Link>
          <p className="font-mono text-[11.5px] text-[#5A6560] tabular-nums">{row.thread_key}</p>
        </div>
      ),
    },
    {
      key: 'participants',
      header: 'Main participants',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.participants.slice(0, 2).map((p) => (
            <RolePill key={p.address} person={p} />
          ))}
          {row.participants.length > 2 && (
            <span className="text-[12px] text-[#5A6560]">+{row.participants.length - 2}</span>
          )}
        </div>
      ),
    },
    {
      key: 'last_message_at',
      header: 'Last activity',
      render: (row) => (
        <span
          title={formatUtcTooltip(row.last_message_at)}
          className="text-[12.5px] text-[#5A6560] whitespace-nowrap tabular-nums"
        >
          {formatDateTime(row.last_message_at, { showUtc: prefs.showUtc })}
        </span>
      ),
    },
    {
      key: 'message_count',
      header: 'Messages',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-[13px] font-semibold text-[#102D2A] tabular-nums">
          {row.message_count}
        </span>
      ),
    },
    {
      key: 'status_class',
      header: 'Status',
      render: (row) => {
        const meta = THREAD_STATUS_META[row.status_class];
        return (
          <StatusPill
            label={meta.label}
            tone={meta.tone}
            icon={meta.icon}
            title={meta.tooltip}
          />
        );
      },
    },
    {
      key: 'open',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <Link
          to={`/app/threads/${encodeURIComponent(row.thread_key)}`}
          className="inline-flex items-center gap-1 font-display text-[12.5px] font-semibold text-[#102D2A] hover:underline whitespace-nowrap"
        >
          <span>Open conversation</span>
          <ExternalLink size={12} aria-hidden="true" />
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Greeting & as_of */}
      <section className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E2D9] pb-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">
            {getTimeOfDayGreeting()}, {displayName}
          </h1>
          <p className="mt-1 text-[14px] text-[#5A6560]">
            Here is the current state of your institutional email intelligence workspace.
          </p>
          {mode === 'demo' && persona?.address && (
            <p className="mt-1 text-[12px] text-[#7A5C1E]">
              Demo persona — visibility illustrated in the browser, not enforced.
            </p>
          )}
        </div>
        <div className="text-right text-[12px] text-[#5A6560]">
          <p className="font-display font-semibold uppercase tracking-[0.06em]">As of</p>
          <p title={formatUtcTooltip(asOf)} className="font-mono text-[#102D2A] tabular-nums">
            {formatDateTime(asOf, { showUtc: prefs.showUtc })}
          </p>
        </div>
      </section>

      {liveCoreError ? (
        <ErrorState
          title="Unable to load workspace overview"
          message={
            liveCoreError instanceof Error
              ? liveCoreError.message
              : 'The backend endpoints did not return workspace analytics.'
          }
          onRetry={() => {
            void overviewQuery.refetch();
            void emailsQuery.refetch();
            void threadsQuery.refetch();
            void decisionsQuery.refetch();
            void actionsQuery.refetch();
            void topicsQuery.refetch();
          }}
        />
      ) : isEmptyWorkspace ? (
        <EmptyState
          title="No email records indexed in this workspace"
          description="SUTRA requires an authorised email dataset before it can reconstruct conversations, extract decisions, or answer evidence-backed questions."
          icon={<Upload size={20} aria-hidden="true" />}
          action={
            <Link to="/app/import">
              <Button variant="primary">Import dataset</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* KPI Row */}
          <section aria-label="Workspace key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Total emails"
              value={overviewQuery.isLoading && emailsQuery.isLoading ? '…' : kpiMetrics.totalEmails.display}
              sourceLabel={kpiMetrics.totalEmails.source}
              footnote={kpiMetrics.totalEmails.footnote}
            />
            <Stat
              label="Total conversations"
              value={overviewQuery.isLoading && threadsQuery.isLoading ? '…' : kpiMetrics.totalThreads.display}
              sourceLabel={kpiMetrics.totalThreads.source}
              footnote={kpiMetrics.totalThreads.footnote}
            />
            <Stat
              label="Decisions identified"
              value={overviewQuery.isLoading && decisionsQuery.isLoading ? '…' : kpiMetrics.totalDecisions.display}
              sourceLabel={kpiMetrics.totalDecisions.source}
              footnote={kpiMetrics.totalDecisions.footnote}
            />
            <Stat
              label="Pending action items"
              value={overviewQuery.isLoading && actionsQuery.isLoading ? '…' : kpiMetrics.pendingActions.display}
              sourceLabel={kpiMetrics.pendingActions.source}
              footnote={kpiMetrics.pendingActions.footnote}
            />
          </section>

          {/* Quick actions */}
          <section
            aria-label="Quick actions"
            className="flex flex-wrap items-center gap-2.5 rounded-[8px] border border-[#E5E2D9] bg-white px-4 py-3"
          >
            <span className="mr-1 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-[#5A6560]">
              Quick actions
            </span>
            <Link
              to="/app/import"
              className="inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-3 py-1.5 font-display text-[12.5px] font-semibold text-[#102D2A] hover:bg-[#E8EFEA]"
            >
              <Upload size={14} aria-hidden="true" />
              <span>Import email dataset</span>
            </Link>
            <Link
              to="/app/threads"
              className="inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-3 py-1.5 font-display text-[12.5px] font-semibold text-[#102D2A] hover:bg-[#E8EFEA]"
            >
              <span>Explore conversations</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
            <Link
              to="/app/ask"
              className="inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1.5 rounded-[4px] bg-[#102D2A] px-3 py-1.5 font-display text-[12.5px] font-semibold text-[#F5F2EA] hover:bg-[#1B4A45]"
            >
              <MessageSquare size={14} aria-hidden="true" />
              <span>Ask SUTRA</span>
            </Link>
            <Link
              to="/app/actions?status=OPEN"
              className="inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-3 py-1.5 font-display text-[12.5px] font-semibold text-[#102D2A] hover:bg-[#E8EFEA]"
            >
              <CheckSquare size={14} aria-hidden="true" />
              <span>Review pending actions</span>
            </Link>
          </section>

          {/* Scene C — Intelligence Constellation */}
          <Constellation
            threads={threads}
            emails={emails}
            decisions={decisions}
            showUtc={prefs.showUtc}
            onSelectEmail={(emailId) => setEvidenceTarget({ emailId })}
          />

          {/* Recent activity (tabbed) */}
          <section className="rounded-[8px] border border-[#E5E2D9] bg-white p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
                Recent activity
              </h2>
              <span className="text-[12px] text-[#5A6560]">
                Ordered by message sent or decision date
              </span>
            </div>

            <Tabs
              ariaLabel="Recent workspace activity"
              activeId={activityTab}
              onChange={(id) =>
                setActivityTab(id as 'messages' | 'threads' | 'decisions' | 'actions')
              }
              items={[
                { id: 'messages', label: 'Latest messages (by sent time)', count: Math.min(6, emails.length) },
                { id: 'threads', label: 'Recently updated conversations', count: Math.min(6, threads.length) },
                { id: 'decisions', label: 'Latest decisions', count: Math.min(6, decisions.length) },
                { id: 'actions', label: 'Recently extracted action items', count: Math.min(6, actions.length) },
              ]}
            />

            <div className="mt-3 divide-y divide-[#E5E2D9]">
              {activityTab === 'messages' &&
                (emailsQuery.isLoading ? (
                  <Skeleton className="my-3 h-24 w-full" />
                ) : emails.length === 0 ? (
                  <p className="py-6 text-[13px] text-[#5A6560]">No messages available.</p>
                ) : (
                  emails.slice(0, 6).map((email) => (
                    <div
                      key={email.email_id}
                      className="flex flex-wrap items-start justify-between gap-3 py-3 text-[13px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[12px] font-semibold text-[#102D2A] tabular-nums">
                            {email.email_id}
                          </span>
                          <span className="font-mono text-[11.5px] text-[#5A6560] tabular-nums">
                            {email.thread_key}
                          </span>
                          <RolePill person={email.sender} />
                        </div>
                        <p className="mt-1 font-display font-semibold text-[#202B35]">
                          {email.subject || 'Untitled message'}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[#5A6560]">
                          {email.body_preview || email.body_raw}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          title={formatUtcTooltip(email.timestamp)}
                          className="text-[12px] text-[#5A6560] tabular-nums"
                        >
                          {formatDateTime(email.timestamp, { showUtc: prefs.showUtc })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEvidenceTarget({ emailId: email.email_id })}
                          className="min-h-[44px] lg:min-h-0 rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1 text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  ))
                ))}

              {activityTab === 'threads' &&
                threads.slice(0, 6).map((thread) => {
                  const statusMeta = THREAD_STATUS_META[thread.status_class];
                  return (
                    <div
                      key={thread.thread_key}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/app/threads/${encodeURIComponent(thread.thread_key)}`}
                          className="font-display font-semibold text-[#102D2A] hover:underline"
                        >
                          {thread.thread_key} · {thread.title || 'Untitled conversation'}
                        </Link>
                        <p className="mt-0.5 text-[12px] text-[#5A6560] tabular-nums">
                          {thread.message_count} messages · Last message{' '}
                          {formatDateTime(thread.last_message_at, { showUtc: prefs.showUtc })}
                        </p>
                      </div>
                      <StatusPill
                        label={statusMeta.label}
                        tone={statusMeta.tone}
                        icon={statusMeta.icon}
                      />
                    </div>
                  );
                })}

              {activityTab === 'decisions' &&
                decisions.slice(0, 6).map((dec) => {
                  const typeMeta = DECISION_TYPE_META[dec.type];
                  const primaryEvidence = dec.evidence[0];
                  return (
                    <div
                      key={dec.decision_id}
                      className="flex flex-wrap items-start justify-between gap-3 py-3 text-[13px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge label={typeMeta.label} tone={typeMeta.tone} icon={typeMeta.icon} />
                          <ProvenanceTag
                            provenance={dec.provenance}
                            reported={isProvenanceReported(dec)}
                          />
                          <span className="font-mono text-[11.5px] text-[#5A6560] tabular-nums">
                            {dec.thread_key}
                          </span>
                        </div>
                        <p className="mt-1 font-display font-semibold text-[#202B35]">
                          {dec.subject}
                        </p>
                        <p className="mt-0.5 text-[#5A6560]">{dec.outcome}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {primaryEvidence && (
                          <button
                            type="button"
                            onClick={() =>
                              setEvidenceTarget({
                                emailId: primaryEvidence.email_id,
                                quote: primaryEvidence.quote,
                              })
                            }
                            className="min-h-[44px] lg:min-h-0 rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1 font-mono text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                          >
                            Source {primaryEvidence.email_id}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {activityTab === 'actions' &&
                actions.slice(0, 6).map((act) => {
                  const statusMeta = getActionStatusMeta(act.status);
                  const primaryEvidence = act.evidence[0];
                  return (
                    <div
                      key={act.action_id}
                      className="flex flex-wrap items-start justify-between gap-3 py-3 text-[13px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill
                            label={statusMeta.label}
                            tone={statusMeta.tone}
                            icon={statusMeta.icon}
                          />
                          <ProvenanceTag
                            provenance={act.provenance}
                            reported={isProvenanceReported(act)}
                          />
                          <span className="font-mono text-[11.5px] text-[#5A6560] tabular-nums">
                            {act.thread_key}
                          </span>
                        </div>
                        <p className="mt-1 font-medium text-[#202B35]">{act.task}</p>
                        <div className="mt-1">
                          <RolePill person={act.owner} unknownLabel="Owner not stated" />
                        </div>
                      </div>
                      {primaryEvidence && (
                        <button
                          type="button"
                          onClick={() =>
                            setEvidenceTarget({
                              emailId: primaryEvidence.email_id,
                              quote: primaryEvidence.quote,
                            })
                          }
                          className="min-h-[44px] lg:min-h-0 shrink-0 rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1 font-mono text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                        >
                          Source {primaryEvidence.email_id}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>

          {/* Conversation overview table */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
                Conversation overview
              </h2>
              <Link
                to="/app/threads"
                className="text-[12.5px] font-semibold text-[#102D2A] hover:underline"
              >
                View all conversations
              </Link>
            </div>
            <Table
              caption="Overview of institutional email conversations"
              columns={threadColumns}
              rows={threads}
              rowKey={(r) => r.thread_key}
            />
          </section>

          {/* Intelligence overview breakdowns */}
          <OverviewAnalytics
            decisions={decisions}
            actions={actions}
            topics={topics}
            showUtc={prefs.showUtc}
          />
        </>
      )}

      <EvidenceDrawer
        open={Boolean(evidenceTarget)}
        onClose={() => setEvidenceTarget(null)}
        emailId={evidenceTarget?.emailId ?? null}
        quote={evidenceTarget?.quote ?? null}
      />
    </div>
  );
};

export default OverviewPage;
