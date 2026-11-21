import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, FilterX } from 'lucide-react';
import { isProvenanceReported } from '../adapters/normalisers';
import { useSutra } from '../app/providers';
import { DecisionDetailDrawer } from '../components/decisions/DecisionDetailDrawer';
import { CitationChip, type CitationInspectTarget } from '../components/evidence/CitationChip';
import { EvidenceDrawer } from '../components/evidence/EvidenceDrawer';
import { ProvenanceTag } from '../components/evidence/ProvenanceTag';
import { Badge, StatusPill } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DateRange } from '../components/ui/DateRange';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { RolePill } from '../components/ui/RolePill';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { Stat } from '../components/ui/Stat';
import { Table, type TableColumn } from '../components/ui/Table';
import { useDebounce } from '../hooks/useDebounce';
import { usePrefs } from '../hooks/usePrefs';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { formatDateTime, formatUtcTooltip } from '../lib/format';
import { computeDecisionSummary, getDecisionActor } from '../lib/ledgerHelpers';
import {
  DECISION_STATUS_META,
  DECISION_TYPE_META,
  getThreadCategoryLabel,
} from '../lib/semantics';
import { actionService } from '../services/actionService';
import { SutraApiError } from '../services/apiClient';
import { decisionService } from '../services/decisionService';
import { threadService } from '../services/threadService';
import type {
  Decision,
  DecisionStatus,
  DecisionType,
  Provenance,
} from '../types/api';

const DECISION_FILTER_DEFAULTS = {
  type: '',
  status: '',
  provenance: '',
  category: '',
  person: '',
  thread: '',
  date_from: '',
  date_to: '',
  sort_by: 'decided_at',
  sort_dir: 'desc',
};

const PAGE_SIZE = 10;

export const DecisionsPage: React.FC = () => {
  const { mode, dataSource, persona } = useSutra();
  const { prefs } = usePrefs();
  const { filters, setFilter, setFilters, clearFilters } = useUrlFilters(DECISION_FILTER_DEFAULTS);

  const [showUtc, setShowUtc] = useState(prefs.showUtc);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<CitationInspectTarget | null>(null);

  const debouncedPerson = useDebounce(filters.person, 250);
  const scopeKey = persona?.persona_id ?? 'live';
  const sourceLabel = mode === 'demo' ? 'Demo annotation' : 'Live backend';

  // Unfiltered summary query for accurate counts across all visible decisions
  const summaryQuery = useQuery({
    queryKey: decisionService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => decisionService.list(dataSource, { limit: 100 }),
  });

  const topicsQuery = useQuery({
    queryKey: threadService.keys.topics(mode, scopeKey),
    queryFn: () => threadService.getTopics(dataSource),
  });

  const threadsQuery = useQuery({
    queryKey: threadService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => threadService.list(dataSource, { limit: 100 }),
  });

  const listParams = useMemo(
    () => ({
      type: (filters.type as DecisionType) || undefined,
      status: (filters.status as DecisionStatus) || undefined,
      provenance: (filters.provenance as Provenance) || undefined,
      category: filters.category || undefined,
      person: debouncedPerson || undefined,
      thread_key: filters.thread || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      sort_by: (filters.sort_by as 'decided_at' | 'type' | 'status') || 'decided_at',
      sort_dir: (filters.sort_dir as 'asc' | 'desc') || 'desc',
      limit: PAGE_SIZE,
      cursor: currentCursor,
    }),
    [filters, debouncedPerson, currentCursor],
  );

  const decisionsQuery = useQuery({
    queryKey: decisionService.keys.list(mode, scopeKey, listParams),
    queryFn: () => decisionService.list(dataSource, listParams),
  });

  // Load thread decisions + actions when a decision drawer is open so approval chain is complete
  const selectedThreadKey = selectedDecision?.thread_key || null;
  const threadDecisionsQuery = useQuery({
    queryKey: decisionService.keys.list(mode, scopeKey, {
      thread_key: selectedThreadKey || undefined,
      limit: 100,
    }),
    queryFn: () => decisionService.list(dataSource, { thread_key: selectedThreadKey!, limit: 100 }),
    enabled: Boolean(selectedThreadKey),
  });

  const threadActionsQuery = useQuery({
    queryKey: actionService.keys.list(mode, scopeKey, {
      thread_key: selectedThreadKey || undefined,
      limit: 100,
    }),
    queryFn: () => actionService.list(dataSource, { thread_key: selectedThreadKey!, limit: 100 }),
    enabled: Boolean(selectedThreadKey),
  });

  const summaryItems = summaryQuery.data?.items || [];
  const summaryTotalMeta = summaryQuery.data?.meta?.total_estimate ?? null;
  const summaryCounts = useMemo(() => computeDecisionSummary(summaryItems), [summaryItems]);
  const summaryTruncated =
    summaryTotalMeta !== null && summaryTotalMeta > summaryItems.length;

  const rows = decisionsQuery.data?.items || [];
  const meta = decisionsQuery.data?.meta;

  const hasActiveFilter = Boolean(
    filters.type ||
      filters.status ||
      filters.provenance ||
      filters.category ||
      filters.person ||
      filters.thread ||
      filters.date_from ||
      filters.date_to,
  );

  const resetPaging = () => {
    setCursorHistory([]);
    setCurrentCursor(null);
  };

  const handleFilterChange = (key: keyof typeof DECISION_FILTER_DEFAULTS, value: string) => {
    resetPaging();
    setFilter(key, value);
  };

  const handleSort = (columnKey: string) => {
    resetPaging();
    if (filters.sort_by === columnKey) {
      setFilter('sort_dir', filters.sort_dir === 'asc' ? 'desc' : 'asc');
    } else {
      setFilters({ sort_by: columnKey, sort_dir: columnKey === 'decided_at' ? 'desc' : 'asc' });
    }
  };

  const columns: Array<TableColumn<Decision>> = [
    {
      key: 'subject',
      header: 'Decision',
      render: (row) => (
        <div className="min-w-[240px] max-w-[380px]">
          <p className="font-display font-semibold text-[#102D2A]">{row.subject}</p>
          <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[#5A6560]">{row.outcome}</p>
        </div>
      ),
    },
    {
      key: 'thread_key',
      header: 'Related thread',
      render: (row) => (
        <Link
          to={`/app/threads/${encodeURIComponent(row.thread_key)}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[12.5px] font-semibold text-[#102D2A] hover:underline whitespace-nowrap"
        >
          {row.thread_key}
        </Link>
      ),
    },
    {
      key: 'who',
      header: 'Who',
      render: (row) => {
        const actorInfo = getDecisionActor(row);
        return (
          <div className="min-w-[160px] space-y-1">
            <span className="block text-[11px] font-medium uppercase tracking-[0.04em] text-[#5A6560]">
              {actorInfo.capacityLabel}
            </span>
            <RolePill person={actorInfo.person} unknownLabel="Actor not stated" />
          </div>
        );
      },
    },
    {
      key: 'decided_at',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span
          title={formatUtcTooltip(row.decided_at)}
          className="whitespace-nowrap text-[12.5px] text-[#202B35] tabular-nums"
        >
          {formatDateTime(row.decided_at, { showUtc })}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (row) => {
        const tMeta = DECISION_TYPE_META[row.type];
        return (
          <Badge
            label={tMeta.label}
            tone={tMeta.tone}
            icon={tMeta.icon}
            title={tMeta.tooltip}
          />
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => {
        const sMeta = DECISION_STATUS_META[row.status];
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill
              label={sMeta.label}
              tone={sMeta.tone}
              icon={sMeta.icon}
              title={sMeta.tooltip}
            />
            <ProvenanceTag
              provenance={row.provenance}
              reported={isProvenanceReported(row)}
            />
          </div>
        );
      },
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => (
        <div
          className="flex flex-wrap gap-1 min-w-[90px]"
          onClick={(e) => e.stopPropagation()}
        >
          {row.evidence.slice(0, 2).map((ev, idx) => (
            <CitationChip
              key={`${row.decision_id}-src-${idx}`}
              emailId={ev.email_id}
              quote={ev.quote}
              attachmentId={ev.attachment_id}
              label={ev.email_id}
              onInspect={setEvidenceTarget}
            />
          ))}
          {row.evidence.length === 0 && (
            <span className="text-[12px] text-[#5A6560]">—</span>
          )}
        </div>
      ),
    },
  ];

  const categoryOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All categories' }];
    for (const t of topicsQuery.data || []) {
      opts.push({ value: t.category, label: getThreadCategoryLabel(t.category) });
    }
    return opts;
  }, [topicsQuery.data]);

  const threadOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All conversations' }];
    for (const t of threadsQuery.data?.items || []) {
      opts.push({
        value: t.thread_key,
        label: `${t.thread_key} · ${t.title || 'Untitled'}`,
      });
    }
    return opts;
  }, [threadsQuery.data]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1360px] space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E2D9] pb-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">Decisions</h1>
          <p className="mt-1 text-[14px] text-[#5A6560]">
            Typed institutional decision ledger keeping approvals, conditional approvals, limited-scope acceptances, recommendations, and confirmations distinct.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowUtc((prev) => !prev)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-3 py-2 text-[12.5px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
        >
          <Clock size={13} aria-hidden="true" />
          <span>{showUtc ? 'Show IST' : 'Show UTC'}</span>
        </button>
      </header>

      {/* Summary strip */}
      <section aria-label="Decision counts summary" data-testid="decisions-summary-strip" className="space-y-2.5">
        {summaryQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[96px] w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Total decisions"
                value={summaryTotalMeta ?? summaryCounts.total}
                sourceLabel={sourceLabel}
                footnote={summaryTruncated ? 'Breakdown below covers first 100 loaded records' : undefined}
              />
              <Stat
                label="Approvals"
                value={summaryCounts.approvals}
                sourceLabel={sourceLabel}
                footnote={`${summaryCounts.approvalCount} approval${summaryCounts.approvalCount === 1 ? '' : 's'} + ${summaryCounts.conditionalApprovalCount} conditional approval${summaryCounts.conditionalApprovalCount === 1 ? '' : 's'}`}
              />
              <Stat
                label="Rejections"
                value={summaryCounts.rejections === 0 ? 'None identified' : summaryCounts.rejections}
                sourceLabel={sourceLabel}
              />
              <Stat
                label="Requiring review"
                value={summaryCounts.requiringReview}
                sourceLabel={sourceLabel}
                footnote="review_state = PENDING"
              />
            </div>

            {/* Secondary distinct-type breakdown bar */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[6px] border border-[#E5E2D9] bg-white px-4 py-2.5 text-[12.5px] text-[#202B35]">
              <span className="font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                Non-approval positions:
              </span>
              <button
                type="button"
                onClick={() =>
                  handleFilterChange(
                    'type',
                    filters.type === 'LIMITED_SCOPE_ACCEPTANCE' ? '' : 'LIMITED_SCOPE_ACCEPTANCE',
                  )
                }
                className="inline-flex items-center gap-1.5 font-medium text-[#102D2A] hover:underline cursor-pointer tabular-nums"
              >
                <span>Limited-scope acceptances:</span>
                <strong className="text-[#8A5A00]">{summaryCounts.limitedScope}</strong>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleFilterChange(
                    'type',
                    filters.type === 'RECOMMENDATION' ? '' : 'RECOMMENDATION',
                  )
                }
                className="inline-flex items-center gap-1.5 font-medium text-[#102D2A] hover:underline cursor-pointer tabular-nums"
              >
                <span>Recommendations:</span>
                <strong className="text-[#1F5A8A]">{summaryCounts.recommendations}</strong>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleFilterChange(
                    'type',
                    filters.type === 'CONFIRMATION' ? '' : 'CONFIRMATION',
                  )
                }
                className="inline-flex items-center gap-1.5 font-medium text-[#102D2A] hover:underline cursor-pointer tabular-nums"
              >
                <span>Confirmations:</span>
                <strong>{summaryCounts.confirmations}</strong>
              </button>
              {summaryCounts.selections > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                  <span>Selections:</span>
                  <strong>{summaryCounts.selections}</strong>
                </span>
              )}
            </div>
          </>
        )}
      </section>

      {/* Filters */}
      <section
        aria-label="Decision filters"
        className="rounded-[8px] border border-[#E5E2D9] bg-white p-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Decision type"
            value={filters.type}
            onChange={(v) => handleFilterChange('type', v)}
            options={[
              { value: '', label: 'All types' },
              { value: 'APPROVAL', label: 'Approval' },
              { value: 'CONDITIONAL_APPROVAL', label: 'Conditional approval' },
              { value: 'LIMITED_SCOPE_ACCEPTANCE', label: 'Limited-scope acceptance' },
              { value: 'REJECTION', label: 'Rejection' },
              { value: 'RECOMMENDATION', label: 'Recommendation (not approval)' },
              { value: 'SELECTION', label: 'Selection' },
              { value: 'CONFIRMATION', label: 'Confirmation' },
            ]}
          />

          <Select
            label="Status"
            value={filters.status}
            onChange={(v) => handleFilterChange('status', v)}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'CONDITION_PENDING', label: 'Condition pending' },
              { value: 'FULFILLED', label: 'Fulfilled' },
              { value: 'SUPERSEDED', label: 'Superseded' },
              { value: 'WITHDRAWN', label: 'Withdrawn' },
            ]}
          />

          <Select
            label="Provenance"
            value={filters.provenance}
            onChange={(v) => handleFilterChange('provenance', v)}
            options={[
              { value: '', label: 'All provenance' },
              { value: 'EXPLICIT', label: 'Explicit' },
              { value: 'DERIVED_CALC', label: 'Derived calculation' },
              { value: 'INFERRED', label: 'Inferred' },
            ]}
          />

          <Select
            label="Topic / category"
            value={filters.category}
            onChange={(v) => handleFilterChange('category', v)}
            options={categoryOptions}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <Input
            label="Approver / person"
            value={filters.person}
            onChange={(e) => handleFilterChange('person', e.target.value)}
            placeholder="Name, role, or email…"
          />

          <Select
            label="Conversation"
            value={filters.thread}
            onChange={(v) => handleFilterChange('thread', v)}
            options={threadOptions}
          />

          <DateRange
            label="Decision date range"
            from={filters.date_from}
            to={filters.date_to}
            onChange={({ from, to }) => {
              resetPaging();
              setFilters({ date_from: from, date_to: to });
            }}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasActiveFilter && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  resetPaging();
                  clearFilters();
                }}
                leftIcon={<FilterX size={14} aria-hidden="true" />}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Main ledger */}
      {decisionsQuery.isLoading ? (
        <div className="space-y-3 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-12 w-full" />
          ))}
        </div>
      ) : decisionsQuery.error ? (
        <ErrorState
          title="Unable to load decisions"
          message={
            decisionsQuery.error instanceof Error
              ? decisionsQuery.error.message
              : 'Decision records could not be retrieved.'
          }
          requestId={
            decisionsQuery.error instanceof SutraApiError
              ? decisionsQuery.error.requestId
              : undefined
          }
          onRetry={() => void decisionsQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No decisions match the active filters"
          description={
            hasActiveFilter
              ? 'No institutional decisions match the current filter criteria. Clear filters to return to the full ledger.'
              : 'No decisions are recorded in the current workspace scope.'
          }
          action={
            hasActiveFilter ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  resetPaging();
                  clearFilters();
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table<Decision>
              caption="Institutional decisions ledger"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.decision_id}
              selectedKey={selectedDecision?.decision_id ?? null}
              onRowClick={setSelectedDecision}
              sortBy={filters.sort_by}
              sortDir={(filters.sort_dir as 'asc' | 'desc') || 'desc'}
              onSort={handleSort}
            />
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden" data-testid="decisions-mobile-cards">
            {rows.map((row) => {
              const tMeta = DECISION_TYPE_META[row.type];
              const sMeta = DECISION_STATUS_META[row.status];
              const actorInfo = getDecisionActor(row);
              const isInferred = row.provenance === 'INFERRED';
              return (
                <article
                  key={row.decision_id}
                  className={`rounded-[8px] border bg-white p-4 space-y-2.5 ${
                    isInferred ? 'border-dashed border-[#8A5A00]/75' : 'border-[#E5E2D9]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge label={tMeta.label} tone={tMeta.tone} icon={tMeta.icon} />
                    <StatusPill label={sMeta.label} tone={sMeta.tone} icon={sMeta.icon} />
                    <ProvenanceTag
                      provenance={row.provenance}
                      reported={isProvenanceReported(row)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDecision(row)}
                    className="block w-full text-left cursor-pointer"
                  >
                    <h2 className="font-display text-[15px] font-semibold text-[#102D2A] hover:underline">
                      {row.subject}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-[13px] text-[#5A6560]">{row.outcome}</p>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E2D9] pt-2 text-[12px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[#5A6560]">{actorInfo.capacityLabel}:</span>
                      <RolePill person={actorInfo.person} unknownLabel="Actor not stated" />
                    </div>
                    <span className="text-[#5A6560] tabular-nums">
                      {formatDateTime(row.decided_at, { showUtc })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <Link
                      to={`/app/threads/${encodeURIComponent(row.thread_key)}`}
                      className="font-mono font-semibold text-[#102D2A] hover:underline"
                    >
                      {row.thread_key}
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      {row.evidence.slice(0, 2).map((ev, idx) => (
                        <CitationChip
                          key={`${row.decision_id}-m-${idx}`}
                          emailId={ev.email_id}
                          quote={ev.quote}
                          attachmentId={ev.attachment_id}
                          label={ev.email_id}
                          onInspect={setEvidenceTarget}
                        />
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <Pagination
            hasPrev={cursorHistory.length > 0}
            hasNext={Boolean(meta?.next_cursor)}
            onPrev={() => {
              const nextHistory = cursorHistory.slice(0, -1);
              const prevCursor = nextHistory[nextHistory.length - 1] ?? null;
              setCursorHistory(nextHistory);
              setCurrentCursor(prevCursor);
            }}
            onNext={() => {
              if (!meta?.next_cursor) return;
              setCursorHistory((prev) => [...prev, currentCursor ?? '']);
              setCurrentCursor(meta.next_cursor);
            }}
            pageNumber={cursorHistory.length + 1}
            totalEstimate={meta?.total_estimate ?? null}
            pageSize={PAGE_SIZE}
            itemCount={rows.length}
          />
        </div>
      )}

      <DecisionDetailDrawer
        decision={selectedDecision}
        threadDecisions={threadDecisionsQuery.data?.items || (selectedDecision ? [selectedDecision] : [])}
        threadActions={threadActionsQuery.data?.items || []}
        showUtc={showUtc}
        onClose={() => setSelectedDecision(null)}
        onInspectEvidence={setEvidenceTarget}
      />

      <EvidenceDrawer
        open={Boolean(evidenceTarget)}
        onClose={() => setEvidenceTarget(null)}
        emailId={evidenceTarget?.emailId ?? null}
        quote={evidenceTarget?.quote ?? null}
        attachmentId={evidenceTarget?.attachmentId ?? null}
        initialTab={evidenceTarget?.tab ?? 'email'}
        verification={evidenceTarget?.verification}
      />
    </div>
  );
};

export default DecisionsPage;
