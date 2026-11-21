import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FilterX } from 'lucide-react';
import { useSutra } from '../app/providers';
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
import { Table, type TableColumn } from '../components/ui/Table';
import { useDebounce } from '../hooks/useDebounce';
import { usePrefs } from '../hooks/usePrefs';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { formatDateTime, formatUtcTooltip } from '../lib/format';
import {
  getThreadCategoryLabel,
  THREAD_INTEGRITY_META,
  THREAD_STATUS_META,
} from '../lib/semantics';
import { SutraApiError } from '../services/apiClient';
import { threadService } from '../services/threadService';
import type { ThreadListItem, ThreadStatusClass } from '../types/api';

const THREAD_FILTER_DEFAULTS = {
  category: '',
  status: '',
  participant: '',
  date_from: '',
  date_to: '',
  pending: 'all',
  decision: 'all',
  sort_by: 'last_message_at',
  sort_dir: 'desc',
};

const PAGE_SIZE = 25;

export const ThreadListPage: React.FC = () => {
  const navigate = useNavigate();
  const { mode, dataSource, persona } = useSutra();
  const { prefs } = usePrefs();
  const { filters, setFilter, setFilters, clearFilters } = useUrlFilters(THREAD_FILTER_DEFAULTS);

  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  const debouncedParticipant = useDebounce(filters.participant, 250);
  const scopeKey = persona?.persona_id ?? 'live';

  const topicsQuery = useQuery({
    queryKey: threadService.keys.topics(mode, scopeKey),
    queryFn: () => threadService.getTopics(dataSource),
  });

  const queryParams = useMemo(
    () => ({
      category: filters.category || undefined,
      status_class: (filters.status as ThreadStatusClass) || undefined,
      participant: debouncedParticipant || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      has_pending_actions:
        filters.pending === 'yes' || filters.pending === 'no'
          ? (filters.pending as 'yes' | 'no')
          : undefined,
      has_decision:
        filters.decision === 'yes' || filters.decision === 'no'
          ? (filters.decision as 'yes' | 'no')
          : undefined,
      sort_by: (filters.sort_by as 'last_message_at' | 'message_count' | 'title') || 'last_message_at',
      sort_dir: (filters.sort_dir as 'asc' | 'desc') || 'desc',
      limit: PAGE_SIZE,
      cursor: currentCursor,
    }),
    [filters, debouncedParticipant, currentCursor],
  );

  const threadsQuery = useQuery({
    queryKey: threadService.keys.list(mode, scopeKey, queryParams),
    queryFn: () => threadService.list(dataSource, queryParams),
  });

  const hasActiveFilter = Boolean(
    filters.category ||
      filters.status ||
      filters.participant ||
      filters.date_from ||
      filters.date_to ||
      filters.pending !== 'all' ||
      filters.decision !== 'all',
  );

  const resetPaging = () => {
    setCursorHistory([]);
    setCurrentCursor(null);
  };

  const handleFilterChange = (key: keyof typeof THREAD_FILTER_DEFAULTS, value: string) => {
    resetPaging();
    setFilter(key, value);
  };

  const handleSort = (columnKey: string) => {
    resetPaging();
    if (filters.sort_by === columnKey) {
      setFilter('sort_dir', filters.sort_dir === 'asc' ? 'desc' : 'asc');
    } else {
      setFilters({ sort_by: columnKey, sort_dir: columnKey === 'title' ? 'asc' : 'desc' });
    }
  };

  const rows = threadsQuery.data?.items || [];
  const meta = threadsQuery.data?.meta;

  const columns: Array<TableColumn<ThreadListItem>> = [
    {
      key: 'title',
      header: 'Conversation',
      sortable: true,
      render: (row) => (
        <div className="min-w-[210px]">
          <Link
            to={`/app/threads/${encodeURIComponent(row.thread_key)}`}
            onClick={(e) => e.stopPropagation()}
            className="font-display font-semibold text-[#102D2A] hover:underline"
          >
            {row.title || 'Untitled conversation'}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[#5A6560]">
            <span className="font-mono tabular-nums">{row.thread_key}</span>
            <span>·</span>
            <span>{getThreadCategoryLabel(row.category)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'participants',
      header: 'Participants',
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
      sortable: true,
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
      sortable: true,
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
        const sMeta = THREAD_STATUS_META[row.status_class];
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
      key: 'integrity',
      header: 'Integrity',
      render: (row) => {
        const iMeta = THREAD_INTEGRITY_META[row.integrity];
        return (
          <Badge
            label={iMeta.label}
            tone={iMeta.tone}
            icon={iMeta.icon}
            title={iMeta.tooltip}
          />
        );
      },
    },
    {
      key: 'open',
      header: 'Detail',
      align: 'right',
      render: (row) => (
        <Link
          to={`/app/threads/${encodeURIComponent(row.thread_key)}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-display text-[12.5px] font-semibold text-[#102D2A] hover:underline whitespace-nowrap"
        >
          <span>Open</span>
          <ExternalLink size={12} aria-hidden="true" />
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1280px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E5E2D9] pb-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">
            Thread Intelligence
          </h1>
          <p className="mt-1 text-[14px] text-[#5A6560]">
            Reconstructed email conversations with verified summaries, decision chains, and action obligations.
          </p>
        </div>
        {mode === 'demo' && (
          <span className="text-[12px] font-medium text-[#7A5C1E]">Demo annotation</span>
        )}
      </header>

      {/* Filter bar */}
      <section
        aria-label="Conversation filters"
        className="rounded-[8px] border border-[#E5E2D9] bg-white p-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Topic / category"
            value={filters.category}
            onChange={(val) => handleFilterChange('category', val)}
            options={[
              { value: '', label: 'All topics' },
              ...(topicsQuery.data || []).map((t) => ({
                value: t.category,
                label: getThreadCategoryLabel(t.category),
              })),
            ]}
          />

          <Select
            label="Status"
            value={filters.status}
            onChange={(val) => handleFilterChange('status', val)}
            options={[
              { value: '', label: 'All statuses' },
              ...(Object.keys(THREAD_STATUS_META) as ThreadStatusClass[]).map((k) => ({
                value: k,
                label: THREAD_STATUS_META[k].label,
              })),
            ]}
          />

          <Input
            label="Participant"
            value={filters.participant}
            onChange={(e) => handleFilterChange('participant', e.target.value)}
            placeholder="Role or email address…"
          />

          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Pending actions"
              value={filters.pending}
              onChange={(val) => handleFilterChange('pending', val)}
              options={[
                { value: 'all', label: 'Any' },
                { value: 'yes', label: 'Has pending' },
                { value: 'no', label: 'None pending' },
              ]}
            />
            <Select
              label="Decisions"
              value={filters.decision}
              onChange={(val) => handleFilterChange('decision', val)}
              options={[
                { value: 'all', label: 'Any' },
                { value: 'yes', label: 'Has decision' },
                { value: 'no', label: 'No decision' },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#E5E2D9] pt-3">
          <DateRange
            label="Activity date range"
            from={filters.date_from}
            to={filters.date_to}
            onChange={(range) => {
              resetPaging();
              setFilters({ date_from: range.from, date_to: range.to });
            }}
          />

          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetPaging();
                clearFilters();
              }}
              leftIcon={<FilterX size={13} aria-hidden="true" />}
            >
              Clear filters
            </Button>
          )}
        </div>
      </section>

      {threadsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : threadsQuery.error ? (
        <ErrorState
          title="Unable to load conversations"
          message={
            threadsQuery.error instanceof Error
              ? threadsQuery.error.message
              : 'The service could not retrieve conversations.'
          }
          requestId={
            threadsQuery.error instanceof SutraApiError ? threadsQuery.error.requestId : undefined
          }
          onRetry={() => void threadsQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No conversations match the selected filters"
          description="Adjust or clear your topic, status, participant, or date filters to view available conversations."
          action={
            hasActiveFilter ? (
              <Button
                variant="secondary"
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
        <div className="space-y-3">
          <Table
            caption="Institutional email conversations"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.thread_key}
            sortBy={filters.sort_by}
            sortDir={filters.sort_dir === 'asc' ? 'asc' : 'desc'}
            onSort={handleSort}
            onRowClick={(r) => navigate(`/app/threads/${encodeURIComponent(r.thread_key)}`)}
          />

          <Pagination
            hasPrev={cursorHistory.length > 0}
            hasNext={Boolean(meta?.next_cursor)}
            onPrev={() => {
              if (cursorHistory.length === 0) return;
              const prevCursor = cursorHistory[cursorHistory.length - 1];
              setCursorHistory((prev) => prev.slice(0, -1));
              setCurrentCursor(prevCursor || null);
            }}
            onNext={() => {
              if (!meta?.next_cursor) return;
              setCursorHistory((prev) => [...prev, currentCursor ?? '']);
              setCurrentCursor(meta.next_cursor);
            }}
            pageNumber={cursorHistory.length + 1}
            totalEstimate={meta?.total_estimate}
            pageSize={PAGE_SIZE}
            itemCount={rows.length}
          />
        </div>
      )}
    </div>
  );
};

export default ThreadListPage;
