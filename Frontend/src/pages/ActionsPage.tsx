import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, FilterX, Info } from 'lucide-react';
import { isProvenanceReported } from '../adapters/normalisers';
import { useSutra } from '../app/providers';
import { ActionDetailDrawer } from '../components/actions/ActionDetailDrawer';
import { CitationChip, type CitationInspectTarget } from '../components/evidence/CitationChip';
import { EvidenceDrawer } from '../components/evidence/EvidenceDrawer';
import { ProvenanceTag } from '../components/evidence/ProvenanceTag';
import { StatusPill } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
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
import { computeActionSummary } from '../lib/ledgerHelpers';
import { DEADLINE_STATE_META, getActionStatusMeta } from '../lib/semantics';
import { actionService } from '../services/actionService';
import { SutraApiError } from '../services/apiClient';
import { threadService } from '../services/threadService';
import type {
  ActionItem,
  ActionStatus,
  DeadlineState,
  Provenance,
  ReviewState,
} from '../types/api';

const ACTION_FILTER_DEFAULTS = {
  status: '',
  deadline_state: '',
  owner: '',
  unowned: '',
  thread: '',
  provenance: '',
  due_from: '',
  due_to: '',
  sort_by: 'status',
  sort_dir: 'desc',
};

const PAGE_SIZE = 10;

export const ActionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { mode, dataSource, persona, liveUser, addToast } = useSutra();
  const { prefs } = usePrefs();
  const { filters, setFilter, setFilters, clearFilters } = useUrlFilters(ACTION_FILTER_DEFAULTS);

  const [showUtc, setShowUtc] = useState(prefs.showUtc);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<CitationInspectTarget | null>(null);

  const debouncedOwner = useDebounce(filters.owner, 250);
  const scopeKey = persona?.persona_id ?? 'live';
  const isDemo = mode === 'demo';
  const sourceLabel = isDemo ? 'Demo annotation' : 'Live backend';
  const canOverrideReview = !isDemo && Boolean(liveUser?.can_override_review);

  // Unfiltered summary query for real counts
  const summaryQuery = useQuery({
    queryKey: actionService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => actionService.list(dataSource, { limit: 100 }),
  });

  const threadsQuery = useQuery({
    queryKey: threadService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => threadService.list(dataSource, { limit: 100 }),
  });

  const effectiveOwnerFilter =
    filters.unowned === 'yes' ? '__unowned__' : debouncedOwner || undefined;

  const listParams = useMemo(
    () => ({
      status: (filters.status as ActionStatus) || undefined,
      deadline_state: (filters.deadline_state as DeadlineState) || undefined,
      owner: effectiveOwnerFilter,
      thread_key: filters.thread || undefined,
      provenance: (filters.provenance as Provenance) || undefined,
      due_from: filters.due_from || undefined,
      due_to: filters.due_to || undefined,
      sort_by: (filters.sort_by as 'status' | 'deadline' | 'thread_key') || 'status',
      sort_dir: (filters.sort_dir as 'asc' | 'desc') || 'desc',
      limit: PAGE_SIZE,
      cursor: currentCursor,
    }),
    [filters, effectiveOwnerFilter, currentCursor],
  );

  const actionsQuery = useQuery({
    queryKey: actionService.keys.list(mode, scopeKey, listParams),
    queryFn: () => actionService.list(dataSource, listParams),
  });

  const summaryItems = summaryQuery.data?.items || [];
  const summaryTotalMeta = summaryQuery.data?.meta?.total_estimate ?? null;
  const summaryCounts = useMemo(() => computeActionSummary(summaryItems), [summaryItems]);
  const summaryTruncated =
    summaryTotalMeta !== null && summaryTotalMeta > summaryItems.length;

  const rows = actionsQuery.data?.items || [];
  const meta = actionsQuery.data?.meta;

  const hasActiveFilter = Boolean(
    filters.status ||
      filters.deadline_state ||
      filters.owner ||
      filters.unowned === 'yes' ||
      filters.thread ||
      filters.provenance ||
      filters.due_from ||
      filters.due_to,
  );

  const resetPaging = () => {
    setCursorHistory([]);
    setCurrentCursor(null);
  };

  const handleFilterChange = (key: keyof typeof ACTION_FILTER_DEFAULTS, value: string) => {
    resetPaging();
    setFilter(key, value);
  };

  const handleSort = (columnKey: string) => {
    resetPaging();
    if (filters.sort_by === columnKey) {
      setFilter('sort_dir', filters.sort_dir === 'asc' ? 'desc' : 'asc');
    } else {
      setFilters({ sort_by: columnKey, sort_dir: columnKey === 'thread_key' ? 'asc' : 'desc' });
    }
  };

  const handlePatchReview = async (
    actionId: string,
    payload: { review_state: ReviewState; status?: ActionStatus; note?: string },
  ) => {
    const updated = await actionService.patchReview(dataSource, actionId, payload);
    setSelectedAction(updated);
    await queryClient.invalidateQueries({ queryKey: ['actions', 'list', mode, scopeKey] });
    addToast({
      tone: 'success',
      title: 'Action review updated',
      message: `${actionId} updated to ${updated.review_state}.`,
    });
  };

  const formatDeadlineText = (row: ActionItem) => {
    if (row.deadline.precision === 'RELATIVE' || !row.deadline.date) {
      return row.deadline.text || 'No deadline stated';
    }
    const formatted = formatDateTime(row.deadline.date, {
      showUtc,
      dateOnly: row.deadline.precision === 'DATE',
    });
    return row.deadline.text ? `${formatted} (${row.deadline.text})` : formatted;
  };

  const columns: Array<TableColumn<ActionItem>> = [
    {
      key: 'task',
      header: 'Task',
      render: (row) => (
        <div className="min-w-[230px] max-w-[360px]">
          <p className="font-display font-semibold text-[#102D2A]">{row.task}</p>
          <p className="mt-0.5 line-clamp-1 text-[12px] text-[#5A6560]">{row.status_basis}</p>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Assigned person / team',
      render: (row) => (
        <div className="min-w-[160px] space-y-1">
          <RolePill person={row.owner} unknownLabel="Owner not stated" />
          {row.owner && row.owner_basis === 'INFERRED' && (
            <span className="block text-[11px] italic text-[#5A6560]">owner inferred</span>
          )}
        </div>
      ),
    },
    {
      key: 'deadline',
      header: 'Due & deadline state',
      sortable: true,
      render: (row) => {
        const dMeta = DEADLINE_STATE_META[row.deadline_state];
        return (
          <div className="min-w-[180px] space-y-1">
            <div
              title={row.deadline.date ? formatUtcTooltip(row.deadline.date) : undefined}
              className="text-[12.5px] font-medium text-[#202B35] tabular-nums"
            >
              {formatDeadlineText(row)}
            </div>
            <StatusPill
              label={dMeta.label}
              tone={dMeta.tone}
              icon={dMeta.icon}
              title={dMeta.tooltip}
            />
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => {
        const sMeta = getActionStatusMeta(row.status);
        return (
          <StatusPill
            label={sMeta.label}
            tone={sMeta.tone}
            icon={sMeta.icon}
            title={sMeta.tooltip}
          />
        );
      },
    },
    {
      key: 'thread_key',
      header: 'Conversation',
      sortable: true,
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
      key: 'source',
      header: 'Source',
      render: (row) => (
        <div
          className="flex flex-wrap gap-1 min-w-[90px]"
          onClick={(e) => e.stopPropagation()}
        >
          {row.evidence.slice(0, 2).map((ev, idx) => (
            <CitationChip
              key={`${row.action_id}-src-${idx}`}
              emailId={ev.email_id}
              quote={ev.quote}
              attachmentId={ev.attachment_id}
              label={ev.email_id}
              onInspect={setEvidenceTarget}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'provenance',
      header: 'Provenance',
      render: (row) => (
        <div
          className={
            row.provenance === 'INFERRED'
              ? 'inline-block rounded-[4px] border border-dashed border-[#8A5A00]/75 p-0.5'
              : ''
          }
        >
          <ProvenanceTag
            provenance={row.provenance}
            reported={isProvenanceReported(row)}
          />
        </div>
      ),
    },
  ];

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
          <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">Action Tracker</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-[#5A6560]">
            <Info size={14} className="shrink-0 text-[#102D2A]" aria-hidden="true" />
            <span>Intelligence view — SUTRA does not assign, execute or update tasks.</span>
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

      {/* Summary strip — never shows "0" for unreported statuses */}
      <section aria-label="Action status summary" data-testid="actions-summary-strip" className="space-y-2.5">
        {summaryQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[96px] w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Stat
                label="Total"
                value={summaryTotalMeta ?? summaryCounts.total}
                sourceLabel={sourceLabel}
                footnote={summaryTruncated ? 'Breakdown below covers first 100 loaded records' : undefined}
              />
              <Stat label="Pending (OPEN)" value={summaryCounts.open} sourceLabel={sourceLabel} />
              <Stat label="Conditional" value={summaryCounts.conditional} sourceLabel={sourceLabel} />
              <Stat label="Completed" value={summaryCounts.done} sourceLabel={sourceLabel} />
              <Stat
                label="In progress"
                value={
                  summaryCounts.inProgress !== null
                    ? summaryCounts.inProgress
                    : 'Not reported by backend'
                }
                sourceLabel={sourceLabel}
                className={summaryCounts.inProgress === null ? '[&>div:nth-child(2)]:text-[14px] [&>div:nth-child(2)]:font-medium [&>div:nth-child(2)]:text-[#5A6560]' : ''}
              />
              <Stat
                label="Blocked"
                value={
                  summaryCounts.blocked !== null
                    ? summaryCounts.blocked
                    : 'Not reported by backend'
                }
                sourceLabel={sourceLabel}
                className={summaryCounts.blocked === null ? '[&>div:nth-child(2)]:text-[14px] [&>div:nth-child(2)]:font-medium [&>div:nth-child(2)]:text-[#5A6560]' : ''}
              />
            </div>

            {summaryCounts.unknownStatuses.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-[#E5E2D9] bg-white px-4 py-2 text-[12.5px] text-[#202B35]">
                <span className="font-display font-semibold text-[#5A6560]">
                  Unknown / unrecognised status values:
                </span>
                {summaryCounts.unknownStatuses.map((u) => (
                  <span key={u.status} className="font-mono text-[#102D2A] tabular-nums">
                    Unknown ({u.status}): {u.count}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Filters */}
      <section
        aria-label="Action filters"
        className="rounded-[8px] border border-[#E5E2D9] bg-white p-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Action status"
            value={filters.status}
            onChange={(v) => handleFilterChange('status', v)}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'OPEN', label: 'Pending (OPEN)' },
              { value: 'CONDITIONAL', label: 'Conditional' },
              { value: 'DONE', label: 'Completed (DONE)' },
              { value: 'IN_PROGRESS', label: 'In progress' },
              { value: 'BLOCKED', label: 'Blocked' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'SUPERSEDED', label: 'Superseded' },
            ]}
          />

          <Select
            label="Deadline state"
            value={filters.deadline_state}
            onChange={(v) => handleFilterChange('deadline_state', v)}
            options={[
              { value: '', label: 'All deadline states' },
              { value: 'MET', label: 'Deadline met (MET)' },
              { value: 'UNDETERMINED', label: 'Undetermined (UNDETERMINED)' },
              { value: 'UPCOMING', label: 'Upcoming (UPCOMING)' },
              { value: 'OVERDUE', label: 'Overdue' },
              { value: 'MISSED', label: 'Deadline missed' },
              { value: 'NONE', label: 'No deadline stated' },
            ]}
          />

          <Select
            label="Conversation"
            value={filters.thread}
            onChange={(v) => handleFilterChange('thread', v)}
            options={threadOptions}
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="space-y-2">
            <Input
              label="Assigned person / owner"
              value={filters.owner}
              disabled={filters.unowned === 'yes'}
              onChange={(e) => handleFilterChange('owner', e.target.value)}
              placeholder="Role or email…"
            />
            <Checkbox
              label="Owner not stated only"
              checked={filters.unowned === 'yes'}
              onChange={(checked) => {
                resetPaging();
                setFilters({ unowned: checked ? 'yes' : '', owner: checked ? '' : filters.owner });
              }}
            />
          </div>

          <DateRange
            label="Due date range"
            from={filters.due_from}
            to={filters.due_to}
            onChange={({ from, to }) => {
              resetPaging();
              setFilters({ due_from: from, due_to: to });
            }}
          />

          <div className="lg:col-span-2 flex flex-wrap items-center justify-end gap-2">
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
      {actionsQuery.isLoading ? (
        <div className="space-y-3 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-12 w-full" />
          ))}
        </div>
      ) : actionsQuery.error ? (
        <ErrorState
          title="Unable to load action items"
          message={
            actionsQuery.error instanceof Error
              ? actionsQuery.error.message
              : 'Action items could not be retrieved.'
          }
          requestId={
            actionsQuery.error instanceof SutraApiError ? actionsQuery.error.requestId : undefined
          }
          onRetry={() => void actionsQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No action items match the active filters"
          description={
            hasActiveFilter
              ? 'No extracted action items match the current filters. Clear filters to return to the full tracker.'
              : 'No action items are recorded in the current workspace scope.'
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
            <Table<ActionItem>
              caption="Extracted action items intelligence view"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.action_id}
              selectedKey={selectedAction?.action_id ?? null}
              onRowClick={setSelectedAction}
              sortBy={filters.sort_by}
              sortDir={(filters.sort_dir as 'asc' | 'desc') || 'desc'}
              onSort={handleSort}
            />
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden" data-testid="actions-mobile-cards">
            {rows.map((row) => {
              const sMeta = getActionStatusMeta(row.status);
              const dMeta = DEADLINE_STATE_META[row.deadline_state];
              const isInferred = row.provenance === 'INFERRED';
              return (
                <article
                  key={row.action_id}
                  className={`rounded-[8px] border bg-white p-4 space-y-2.5 ${
                    isInferred ? 'border-dashed border-[#8A5A00]/75' : 'border-[#E5E2D9]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill label={sMeta.label} tone={sMeta.tone} icon={sMeta.icon} />
                    <StatusPill label={dMeta.label} tone={dMeta.tone} icon={dMeta.icon} />
                    <ProvenanceTag
                      provenance={row.provenance}
                      reported={isProvenanceReported(row)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAction(row)}
                    className="block w-full text-left cursor-pointer"
                  >
                    <h2 className="font-display text-[15px] font-semibold text-[#102D2A] hover:underline">
                      {row.task}
                    </h2>
                    <p className="mt-1 text-[12.5px] text-[#5A6560]">{row.status_basis}</p>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E2D9] pt-2 text-[12px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RolePill person={row.owner} unknownLabel="Owner not stated" />
                      {row.owner && row.owner_basis === 'INFERRED' && (
                        <span className="italic text-[#5A6560]">(owner inferred)</span>
                      )}
                    </div>
                    <span className="text-[#5A6560] tabular-nums">{formatDeadlineText(row)}</span>
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
                          key={`${row.action_id}-m-${idx}`}
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

      <ActionDetailDrawer
        action={selectedAction}
        isDemo={isDemo}
        canOverrideReview={canOverrideReview}
        showUtc={showUtc}
        onClose={() => setSelectedAction(null)}
        onInspectEvidence={setEvidenceTarget}
        onPatchReview={handlePatchReview}
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

export default ActionsPage;
