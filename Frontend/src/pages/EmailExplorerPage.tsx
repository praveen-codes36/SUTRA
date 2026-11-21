import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, Paperclip } from 'lucide-react';
import { useSutra } from '../app/providers';
import {
  EmailFilterPanel,
  type EmailFilterValues,
} from '../components/emails/EmailFilterPanel';
import { EmailPreviewPanel } from '../components/emails/EmailPreviewPanel';
import type { CitationInspectTarget } from '../components/evidence/CitationChip';
import { EvidenceDrawer } from '../components/evidence/EvidenceDrawer';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { ErrorState } from '../components/ui/ErrorState';
import { Pagination } from '../components/ui/Pagination';
import { RolePill } from '../components/ui/RolePill';
import { Skeleton } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { usePrefs } from '../hooks/usePrefs';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { formatDateTime } from '../lib/format';
import { actionService } from '../services/actionService';
import { decisionService } from '../services/decisionService';
import { emailService } from '../services/emailService';
import { threadService } from '../services/threadService';
import type { EmailMessage } from '../types/api';

const PAGE_SIZE = 25;

const FILTER_DEFAULTS = {
  q: '',
  sender: '',
  subject: '',
  thread: '',
  category: '',
  att: 'all',
  date_from: '',
  date_to: '',
  email: '',
  attachment: '',
  cursor: '',
};

export const EmailExplorerPage: React.FC = () => {
  const { mode, dataSource, persona } = useSutra();
  const { prefs } = usePrefs();
  const { filters, setFilter, setFilters, clearFilters } = useUrlFilters(FILTER_DEFAULTS);

  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [evidenceTarget, setEvidenceTarget] = useState<CitationInspectTarget | null>(null);

  const debouncedQ = useDebounce(filters.q, 180);
  const debouncedSender = useDebounce(filters.sender, 180);
  const debouncedSubject = useDebounce(filters.subject, 180);

  const scopeKey = persona?.persona_id ?? 'live';

  const listParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      sender: debouncedSender || undefined,
      subject: debouncedSubject || undefined,
      thread_key: filters.thread || undefined,
      category: filters.category || undefined,
      has_attachments:
        filters.att === 'yes' || filters.att === 'no'
          ? (filters.att as 'yes' | 'no')
          : ('all' as const),
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      limit: PAGE_SIZE,
      cursor: filters.cursor || null,
    }),
    [
      debouncedQ,
      debouncedSender,
      debouncedSubject,
      filters.thread,
      filters.category,
      filters.att,
      filters.date_from,
      filters.date_to,
      filters.cursor,
    ],
  );

  const emailsQuery = useQuery({
    queryKey: emailService.keys.list(mode, scopeKey, listParams),
    queryFn: () => emailService.list(dataSource, listParams),
  });

  const threadsQuery = useQuery({
    queryKey: threadService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => threadService.list(dataSource, { limit: 100 }),
  });

  const topicsQuery = useQuery({
    queryKey: threadService.keys.topics(mode, scopeKey),
    queryFn: () => threadService.getTopics(dataSource),
  });

  const decisionsQuery = useQuery({
    queryKey: decisionService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => decisionService.list(dataSource, { limit: 100 }),
  });

  const actionsQuery = useQuery({
    queryKey: actionService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => actionService.list(dataSource, { limit: 100 }),
  });

  const items = emailsQuery.data?.items || [];
  const selectedEmailId = filters.email || items[0]?.email_id || null;

  const selectedDetailQuery = useQuery({
    queryKey: emailService.keys.detail(mode, scopeKey, selectedEmailId || ''),
    queryFn: () => emailService.get(dataSource, selectedEmailId!),
    enabled: Boolean(selectedEmailId),
  });

  // Open attachment drawer automatically if ?attachment= is supplied
  useEffect(() => {
    if (filters.attachment && selectedEmailId) {
      setEvidenceTarget({
        emailId: selectedEmailId,
        attachmentId: filters.attachment,
        tab: 'attachment',
      });
    }
  }, [filters.attachment, selectedEmailId]);

  const activeEmail: EmailMessage | null =
    selectedDetailQuery.data ||
    items.find((e) => e.email_id === selectedEmailId) ||
    null;

  const citingDecisions = useMemo(() => {
    if (!activeEmail) return [];
    return (decisionsQuery.data?.items || []).filter((d) =>
      d.evidence.some((ev) => ev.email_id === activeEmail.email_id),
    );
  }, [activeEmail, decisionsQuery.data]);

  const citingActions = useMemo(() => {
    if (!activeEmail) return [];
    return (actionsQuery.data?.items || []).filter(
      (a) =>
        a.evidence.some((ev) => ev.email_id === activeEmail.email_id) ||
        a.completion_evidence.some((ev) => ev.email_id === activeEmail.email_id),
    );
  }, [activeEmail, actionsQuery.data]);

  const handleFilterChange = (key: keyof EmailFilterValues, value: string) => {
    setCursorHistory([]);
    setFilters({ [key]: value, cursor: '' });
  };

  const handleClear = () => {
    setCursorHistory([]);
    clearFilters();
  };

  const handleSelectEmail = (emailId: string) => {
    setFilters({ email: emailId, attachment: '' });
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobilePreviewOpen(true);
    }
  };

  const handleNextPage = () => {
    const nextCursor = emailsQuery.data?.meta?.next_cursor;
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, filters.cursor]);
    setFilter('cursor', nextCursor);
  };

  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return;
    const prevCursor = cursorHistory[cursorHistory.length - 1];
    setCursorHistory((prev) => prev.slice(0, -1));
    setFilter('cursor', prevCursor);
  };

  const pageNumber = cursorHistory.length + 1;
  const totalEstimate = emailsQuery.data?.meta?.total_estimate;

  return (
    <div className="mx-auto max-w-[1360px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E2D9] pb-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">
            Email Explorer
          </h1>
          <p className="text-[13px] text-[#5A6560]">
            Read-only archive of ingested email messages, extracted mentions, and attachments.
          </p>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMobileFiltersOpen(true)}
            leftIcon={<Filter size={14} aria-hidden="true" />}
          >
            Filters
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        {/* Desktop left filter rail */}
        <div className="hidden xl:block min-w-0">
          <EmailFilterPanel
            filters={filters}
            threads={threadsQuery.data?.items || []}
            topics={topicsQuery.data || []}
            onChangeFilter={handleFilterChange}
            onChangeRange={(range) => {
              setCursorHistory([]);
              setFilters({ date_from: range.from, date_to: range.to, cursor: '' });
            }}
            onClearFilters={handleClear}
          />
        </div>

        {/* Centre email list */}
        <section
          aria-label="Email list"
          className="min-w-0 flex flex-col rounded-[8px] border border-[#E5E2D9] bg-white"
        >
          <div className="flex items-center justify-between border-b border-[#E5E2D9] px-4 py-2.5 text-[12.5px] text-[#5A6560]">
            <span className="font-display font-semibold text-[#102D2A] tabular-nums">
              {typeof totalEstimate === 'number'
                ? `${totalEstimate} matching messages`
                : `${items.length} messages shown`}
            </span>
            {filters.thread && (
              <span className="font-mono text-[11.5px] text-[#7A5C1E] tabular-nums">
                Thread {filters.thread}
              </span>
            )}
          </div>

          {emailsQuery.isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : emailsQuery.error ? (
            <div className="p-4">
              <ErrorState
                message={
                  emailsQuery.error instanceof Error
                    ? emailsQuery.error.message
                    : 'Unable to load emails.'
                }
                onRetry={() => void emailsQuery.refetch()}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#5A6560]">
              <p>No emails match the current filters.</p>
              <Button variant="secondary" size="sm" onClick={handleClear} className="mt-3">
                Clear filters
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E2D9]" data-testid="email-explorer-list">
              {items.map((email) => {
                const selected = email.email_id === selectedEmailId;
                const firstRec = email.recipients[0];
                const extraCount = Math.max(0, email.recipients.length - 1);
                return (
                  <li
                    key={email.email_id}
                    className={`transition-colors duration-100 ${
                      selected
                        ? 'border-l-2 border-l-[#102D2A] bg-[#E8EFEA]'
                        : 'bg-white hover:bg-[#F5F2EA]/70'
                    }`}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2 text-[11.5px] text-[#5A6560]">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleSelectEmail(email.email_id)}
                            aria-current={selected ? 'true' : undefined}
                            className="inline-flex min-h-[44px] lg:min-h-0 items-center font-mono font-semibold text-[#102D2A] tabular-nums hover:underline cursor-pointer"
                          >
                            {email.email_id}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFilterChange('thread', email.thread_key)}
                            title={`Filter by thread ${email.thread_key}`}
                            className="inline-flex min-h-[44px] lg:min-h-0 items-center rounded-[4px] border border-[#7B8581]/50 bg-[#F5F2EA] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#102D2A] hover:border-[#102D2A] tabular-nums cursor-pointer"
                          >
                            {email.thread_key}
                          </button>
                          {email.attachments.length > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 font-mono text-[#7A5C1E] tabular-nums"
                              title={`${email.attachments.length} attachment(s)`}
                            >
                              <Paperclip size={11} aria-hidden="true" />
                              <span>{email.attachments.length}</span>
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 tabular-nums">
                          {formatDateTime(email.timestamp, { showUtc: prefs.showUtc })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectEmail(email.email_id)}
                        aria-label={`Select email ${email.email_id}: ${email.subject || 'Untitled message'}`}
                        className="mt-0.5 block w-full text-left cursor-pointer"
                      >
                        <p className="truncate font-display text-[14px] font-semibold text-[#102D2A]">
                          {email.subject || 'Untitled message'}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[#5A6560]">
                          <RolePill person={email.sender} />
                          {firstRec && (
                            <span className="truncate">
                              → {firstRec.role || firstRec.address}
                              {extraCount > 0 ? ` +${extraCount}` : ''}
                            </span>
                          )}
                        </div>

                        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.45] text-[#5A6560]">
                          {email.body_preview || email.body_raw}
                        </p>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-4 pb-3">
            <Pagination
              hasPrev={cursorHistory.length > 0}
              hasNext={Boolean(emailsQuery.data?.meta?.next_cursor)}
              onPrev={handlePrevPage}
              onNext={handleNextPage}
              pageNumber={pageNumber}
              totalEstimate={totalEstimate}
              pageSize={PAGE_SIZE}
              itemCount={items.length}
            />
          </div>
        </section>

        {/* Desktop right preview panel */}
        <div className="hidden lg:block lg:sticky lg:top-20 min-w-0">
          <EmailPreviewPanel
            email={activeEmail}
            loading={selectedDetailQuery.isLoading && !activeEmail}
            citingDecisions={citingDecisions}
            citingActions={citingActions}
            onSelectParentEmail={(id) => handleSelectEmail(id)}
            onInspectEvidence={(target) => setEvidenceTarget(target)}
          />
        </div>
      </div>

      {/* Mobile filters drawer */}
      <Drawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Filter emails"
        side="left"
        widthClass="max-w-[360px]"
      >
        <EmailFilterPanel
          filters={filters}
          threads={threadsQuery.data?.items || []}
          topics={topicsQuery.data || []}
          onChangeFilter={handleFilterChange}
          onChangeRange={(range) => {
            setCursorHistory([]);
            setFilters({ date_from: range.from, date_to: range.to, cursor: '' });
          }}
          onClearFilters={handleClear}
        />
      </Drawer>

      {/* Mobile full-screen preview sheet */}
      <Drawer
        open={mobilePreviewOpen}
        onClose={() => setMobilePreviewOpen(false)}
        title={activeEmail ? `${activeEmail.email_id} · Message preview` : 'Message preview'}
        widthClass="max-w-full"
      >
        <EmailPreviewPanel
          email={activeEmail}
          loading={selectedDetailQuery.isLoading && !activeEmail}
          citingDecisions={citingDecisions}
          citingActions={citingActions}
          onSelectParentEmail={(id) => handleSelectEmail(id)}
          onInspectEvidence={(target) => setEvidenceTarget(target)}
        />
      </Drawer>

      <EvidenceDrawer
        open={Boolean(evidenceTarget)}
        onClose={() => {
          setEvidenceTarget(null);
          if (filters.attachment) setFilter('attachment', '');
        }}
        emailId={evidenceTarget?.emailId ?? null}
        quote={evidenceTarget?.quote ?? null}
        attachmentId={evidenceTarget?.attachmentId ?? null}
        initialTab={evidenceTarget?.tab ?? 'email'}
        verification={evidenceTarget?.verification}
      />
    </div>
  );
};

export default EmailExplorerPage;
