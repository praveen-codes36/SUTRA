import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, MessageSquare } from 'lucide-react';
import { useSutra } from '../app/providers';
import type { CitationInspectTarget } from '../components/evidence/CitationChip';
import { EvidenceDrawer } from '../components/evidence/EvidenceDrawer';
import { ThreadActionsSection } from '../components/threads/ThreadActionsSection';
import { ThreadDecisionsSection } from '../components/threads/ThreadDecisionsSection';
import { ThreadSummaryPanel } from '../components/threads/ThreadSummaryPanel';
import { ThreadTimelineSection } from '../components/threads/ThreadTimelineSection';
import { Badge, StatusPill } from '../components/ui/Badge';
import { Banner } from '../components/ui/Banner';
import { ErrorState } from '../components/ui/ErrorState';
import { RolePill } from '../components/ui/RolePill';
import { Skeleton } from '../components/ui/Skeleton';
import { ThreadGraph } from '../components/visualizations/ThreadGraph';
import { useAsOf } from '../hooks/useAsOf';
import { useCapability } from '../hooks/useCapability';
import { usePrefs } from '../hooks/usePrefs';
import { formatDateTime, formatUtcTooltip } from '../lib/format';
import {
  getThreadCategoryLabel,
  THREAD_INTEGRITY_META,
  THREAD_STATUS_META,
} from '../lib/semantics';
import { actionService } from '../services/actionService';
import { SutraApiError } from '../services/apiClient';
import { decisionService } from '../services/decisionService';
import { emailService } from '../services/emailService';
import { threadService } from '../services/threadService';

export const ThreadDetailPage: React.FC = () => {
  const { threadId = '' } = useParams<{ threadId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { mode, dataSource, persona, liveUser, addToast } = useSutra();
  const { prefs } = usePrefs();
  const { reducedMotion } = useCapability();

  const [localUtc, setLocalUtc] = useState(prefs.showUtc);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [refreshingSummary, setRefreshingSummary] = useState(false);
  const [drawerTarget, setDrawerTarget] = useState<CitationInspectTarget | null>(null);

  const scopeKey = persona?.persona_id ?? 'live';

  const lastUrlTargetRef = useRef<string | null>(null);

  useEffect(() => {
    setLocalUtc(prefs.showUtc);
  }, [prefs.showUtc]);

  useEffect(() => {
    lastUrlTargetRef.current = null;
    setSelectedEmailId(null);
    setHighlightedQuote(null);
  }, [threadId]);

  const threadQuery = useQuery({
    queryKey: threadService.keys.detail(mode, scopeKey, threadId),
    queryFn: () => threadService.get(dataSource, threadId),
    enabled: Boolean(threadId),
  });

  const summaryQuery = useQuery({
    queryKey: threadService.keys.summary(mode, scopeKey, threadId),
    queryFn: () => threadService.getSummary(dataSource, threadId),
    enabled: Boolean(threadId),
  });

  const emailsQuery = useQuery({
    queryKey: emailService.keys.list(mode, scopeKey, { thread_key: threadId, limit: 100 }),
    queryFn: () => emailService.list(dataSource, { thread_key: threadId, limit: 100 }),
    enabled: Boolean(threadId),
  });

  const decisionsQuery = useQuery({
    queryKey: decisionService.keys.list(mode, scopeKey, { thread_key: threadId, limit: 100 }),
    queryFn: () => decisionService.list(dataSource, { thread_key: threadId, limit: 100 }),
    enabled: Boolean(threadId),
  });

  const actionsQuery = useQuery({
    queryKey: actionService.keys.list(mode, scopeKey, { thread_key: threadId, limit: 100 }),
    queryFn: () => actionService.list(dataSource, { thread_key: threadId, limit: 100 }),
    enabled: Boolean(threadId),
  });

  const asOf = useAsOf(mode);
  const thread = threadQuery.data;
  const emails = emailsQuery.data?.items || [];
  const decisions = decisionsQuery.data?.items || [];
  const actions = actionsQuery.data?.items || [];

  const navigateToEmail = useCallback(
    (emailId: string, quote?: string | null) => {
      lastUrlTargetRef.current = emailId;
      setSelectedEmailId(emailId);
      setHighlightedQuote(quote ?? null);

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('email', emailId);
          return next;
        },
        { replace: true },
      );

      const matched = emails.find((e) => e.email_id === emailId);
      const senderLabel = matched ? matched.sender.role || matched.sender.address : '';
      const timeLabel = matched ? formatDateTime(matched.timestamp, { showUtc: localUtc }) : '';
      setLiveAnnouncement(
        `Navigated to message ${emailId}${senderLabel ? ` from ${senderLabel}` : ''}${
          timeLabel ? `, ${timeLabel}` : ''
        }.`,
      );

      window.requestAnimationFrame(() => {
        const el = document.getElementById(`msg-${emailId}`);
        if (el) {
          el.scrollIntoView({
            behavior: reducedMotion ? 'auto' : 'smooth',
            block: 'center',
          });
          el.focus({ preventScroll: true });
        }
      });
    },
    [emails, localUtc, reducedMotion, setSearchParams],
  );

  // Sync deep-linked ?email=E005 or #E005 on initial load or external URL navigation
  useEffect(() => {
    const hashTarget = location.hash ? location.hash.replace(/^#/, '') : null;
    const queryTarget = searchParams.get('email');
    const targetId = queryTarget || hashTarget;
    if (
      targetId &&
      targetId !== lastUrlTargetRef.current &&
      emails.some((e) => e.email_id === targetId)
    ) {
      navigateToEmail(targetId, null);
    }
  }, [location.hash, searchParams, emails, navigateToEmail]);

  const handleRefreshSummary = async () => {
    if (mode !== 'live' || !threadId) return;
    setRefreshingSummary(true);
    try {
      await threadService.refreshSummary(dataSource, threadId);
      await queryClient.invalidateQueries({
        queryKey: threadService.keys.summary(mode, scopeKey, threadId),
      });
      addToast({ tone: 'success', title: 'Summary refreshed from backend.' });
    } catch (err) {
      addToast({
        tone: 'error',
        title: 'Summary refresh failed',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRefreshingSummary(false);
    }
  };

  if (threadQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[1160px] space-y-5">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (threadQuery.error || !thread) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4">
        <Link
          to="/app/threads"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#102D2A] hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to all conversations</span>
        </Link>
        <ErrorState
          title="Conversation unavailable"
          message={
            threadQuery.error instanceof Error
              ? threadQuery.error.message
              : 'The requested item is not available.'
          }
          requestId={
            threadQuery.error instanceof SutraApiError ? threadQuery.error.requestId : undefined
          }
          onRetry={() => void threadQuery.refetch()}
        />
      </div>
    );
  }

  const statusMeta = THREAD_STATUS_META[thread.status_class];
  const integrityMeta = THREAD_INTEGRITY_META[thread.integrity];
  const confidencePct = Math.round((thread.reconstruction?.confidence ?? 0) * 100);
  const needsReview = thread.reconstruction?.review_state && thread.reconstruction.review_state !== 'NONE';

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1160px] space-y-6">
      {/* Screen-reader & polite live navigation announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Top breadcrumb + primary conversation CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/threads"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#102D2A] hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>All conversations</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLocalUtc((prev) => !prev)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
          >
            <Clock size={13} aria-hidden="true" />
            <span>{localUtc ? 'Show IST' : 'Show UTC'}</span>
          </button>

          <Link
            to={`/app/ask?thread=${encodeURIComponent(thread.thread_key)}`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[4px] bg-[#102D2A] px-3.5 py-1.5 font-display text-[13px] font-semibold text-[#F5F2EA] hover:bg-[#1B4A45]"
          >
            <MessageSquare size={14} aria-hidden="true" />
            <span>Ask about this conversation</span>
          </Link>
        </div>
      </div>

      {/* Detail header */}
      <header className="space-y-3 border-b border-[#E5E2D9] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[4px] bg-[#102D2A] px-2.5 py-0.5 font-mono text-[12px] font-semibold text-[#F5F2EA] tabular-nums">
            {thread.thread_key}
          </span>
          <Badge label={getThreadCategoryLabel(thread.category)} tone="forest" />
          <StatusPill
            label={statusMeta.label}
            tone={statusMeta.tone}
            icon={statusMeta.icon}
            title={statusMeta.tooltip}
          />
          <Badge
            label={integrityMeta.label}
            tone={integrityMeta.tone}
            icon={integrityMeta.icon}
            title={integrityMeta.tooltip}
          />
          <Badge
            label={`Reconstruction: ${thread.reconstruction.method} (${confidencePct}%)${
              needsReview ? ' · Review needed' : ''
            }`}
            tone={needsReview ? 'warning' : 'neutral'}
            icon={needsReview ? 'AlertTriangle' : 'CheckCircle2'}
          />
        </div>

        <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">
          {thread.title || 'Untitled conversation'}
        </h1>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#5A6560]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#202B35] tabular-nums">
              {thread.message_count} messages
            </span>
            <span aria-hidden="true">·</span>
            <span>Participants:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {thread.participants.map((p) => (
                <RolePill key={p.address} person={p} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[12px] tabular-nums">
            <span title={formatUtcTooltip(thread.last_message_at)}>
              Last activity: {formatDateTime(thread.last_message_at, { showUtc: localUtc })}
            </span>
            <span aria-hidden="true">·</span>
            <span title={formatUtcTooltip(asOf)}>
              As of: {formatDateTime(asOf, { showUtc: localUtc })}
            </span>
          </div>
        </div>
      </header>

      {/* Integrity banner when PARTIAL or CONFLICT */}
      {(thread.integrity === 'PARTIAL' || thread.integrity === 'CONFLICT') && (
        <Banner
          tone={thread.integrity === 'CONFLICT' ? 'error' : 'warn'}
          title={
            thread.integrity === 'PARTIAL'
              ? 'An earlier message in this conversation is missing from the data'
              : 'Conflicting reply structure detected'
          }
        >
          {thread.integrity === 'PARTIAL'
            ? 'One or more reply references point to messages outside the loaded dataset. Verify preceding context before relying on conclusions.'
            : 'Reply headers contain structural conflicts; inspect message timestamps and headers directly.'}
        </Banner>
      )}

      {/* Visually prominent Summary Panel */}
      <ThreadSummaryPanel
        summary={summaryQuery.data}
        actions={actions}
        loading={summaryQuery.isLoading}
        error={summaryQuery.error}
        isLive={mode === 'live'}
        canRefresh={liveUser?.can_refresh_summary !== false}
        refreshing={refreshingSummary}
        showUtc={localUtc}
        onRefreshSummary={() => void handleRefreshSummary()}
        onNavigateEmail={(eid) => navigateToEmail(eid)}
      />

      {/* §5.5 Thread relationship visualisation */}
      <ThreadGraph
        thread={thread}
        emails={emails}
        decisions={decisions}
        actions={actions}
        selectedEmailId={selectedEmailId}
        showUtc={localUtc}
        onSelectEmail={(eid) => navigateToEmail(eid)}
      />

      {/* Decisions & Action items */}
      <div className="space-y-6">
        <ThreadDecisionsSection
          decisions={decisions}
          showUtc={localUtc}
          onNavigateEmail={(eid, quote) => navigateToEmail(eid, quote)}
          onInspectAttachment={(target) => setDrawerTarget(target)}
        />

        <ThreadActionsSection
          actions={actions}
          pendingNote={summaryQuery.data?.content.pending_note}
          showUtc={localUtc}
          onNavigateEmail={(eid, quote) => navigateToEmail(eid, quote)}
          onInspectAttachment={(target) => setDrawerTarget(target)}
        />
      </div>

      {/* Verbatim chronological timeline */}
      <ThreadTimelineSection
        emails={emails}
        threadTitle={thread.title}
        decisions={decisions}
        actions={actions}
        selectedEmailId={selectedEmailId}
        highlightedQuote={highlightedQuote}
        showUtc={localUtc}
        onSelectEmail={(eid) => navigateToEmail(eid)}
        onInspectAttachment={(target) => setDrawerTarget(target)}
      />

      <EvidenceDrawer
        open={Boolean(drawerTarget)}
        onClose={() => setDrawerTarget(null)}
        emailId={drawerTarget?.emailId ?? null}
        quote={drawerTarget?.quote ?? null}
        attachmentId={drawerTarget?.attachmentId ?? null}
        initialTab={drawerTarget?.tab ?? 'attachment'}
        verification={drawerTarget?.verification}
      />
    </div>
  );
};

export default ThreadDetailPage;
