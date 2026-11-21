import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Clock,
  Eraser,
  History,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useSutra } from '../app/providers';
import { AnswerCard } from '../components/ask/AnswerCard';
import { EvidencePanel } from '../components/ask/EvidencePanel';
import type { CitationInspectTarget } from '../components/evidence/CitationChip';
import { EvidenceDrawer } from '../components/evidence/EvidenceDrawer';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { ErrorState } from '../components/ui/ErrorState';
import { Select } from '../components/ui/Select';
import { usePrefs } from '../hooks/usePrefs';
import {
  clearPreviousQuestions,
  getSuggestedQuestions,
  loadPreviousQuestions,
  savePreviousQuestion,
  type PreviousQuestionEntry,
} from '../lib/askHelpers';
import { actionService } from '../services/actionService';
import { SutraApiError } from '../services/apiClient';
import { decisionService } from '../services/decisionService';
import { emailService } from '../services/emailService';
import { intelligenceService } from '../services/intelligenceService';
import { threadService } from '../services/threadService';
import type {
  ActionItem,
  Answer,
  ClarificationOption,
  Decision,
  EmailMessage,
} from '../types/api';

const MAX_QUESTION_CHARS = 500;

export const AskSutraPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { mode, dataSource, persona, addToast } = useSutra();
  const { prefs } = usePrefs();

  const initialThread = searchParams.get('thread') || '';
  const initialQuery = searchParams.get('q') || '';

  const [scope, setScope] = useState<string>(initialThread);
  const [questionInput, setQuestionInput] = useState<string>(initialQuery);
  const [sessionId, setSessionId] = useState<string>(() => `sess-${Date.now()}`);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Retrieving and verifying evidence…');
  const [askError, setAskError] = useState<{
    message: string;
    requestId?: string;
    lastRequest: { question: string; thread_scope: string | null };
  } | null>(null);
  const [previousQuestions, setPreviousQuestions] = useState<PreviousQuestionEntry[]>(() =>
    loadPreviousQuestions(),
  );
  const [drawerTarget, setDrawerTarget] = useState<CitationInspectTarget | null>(null);
  const [mobileEvidenceOpen, setMobileEvidenceOpen] = useState(false);
  const [showUtc, setShowUtc] = useState(prefs.showUtc);

  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const scopeKey = persona?.persona_id ?? 'live';
  const isDemo = mode === 'demo';

  useEffect(() => {
    setShowUtc(prefs.showUtc);
  }, [prefs.showUtc]);

  // Keep scope synchronized if URL ?thread= changes externally
  useEffect(() => {
    const paramThread = searchParams.get('thread') || '';
    setScope(paramThread);
  }, [searchParams]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const threadsQuery = useQuery({
    queryKey: threadService.keys.list(mode, scopeKey, { limit: 100 }),
    queryFn: () => threadService.list(dataSource, { limit: 100 }),
  });

  const threads = threadsQuery.data?.items || [];

  const scopeOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All conversations' }];
    if (scope === 'ALL') {
      opts.push({ value: 'ALL', label: 'All conversations (cross-thread)' });
    }
    for (const t of threads) {
      opts.push({
        value: t.thread_key,
        label: `${t.thread_key} · ${t.title || 'Untitled conversation'}`,
      });
    }
    if (scope && scope !== 'ALL' && !threads.some((t) => t.thread_key === scope)) {
      opts.push({ value: scope, label: scope });
    }
    return opts;
  }, [threads, scope]);

  const activeAnswer = useMemo(() => {
    if (answers.length === 0) return null;
    if (selectedAnswerId) {
      return answers.find((a) => a.answer_id === selectedAnswerId) || answers[answers.length - 1];
    }
    return answers[answers.length - 1];
  }, [answers, selectedAnswerId]);

  const activeScopeLabel = useMemo(() => {
    const effectiveScope = scope || activeAnswer?.thread_scope || '';
    if (!effectiveScope) return null;
    if (effectiveScope === 'ALL') return 'All conversations (cross-thread)';
    const matched = threads.find((t) => t.thread_key === effectiveScope);
    return matched ? `${matched.thread_key} · ${matched.title || 'Conversation'}` : effectiveScope;
  }, [scope, activeAnswer, threads]);

  // Resolve cited emails, decisions, and actions referenced across visible answers
  const referencedEmailIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ans of answers) {
      for (const c of ans.citations) {
        if (c.email_id) ids.add(c.email_id);
      }
    }
    return Array.from(ids);
  }, [answers]);

  const referencedDecisionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ans of answers) {
      for (const did of ans.structured?.decision_ids || []) {
        ids.add(did);
      }
    }
    return Array.from(ids);
  }, [answers]);

  const referencedActionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ans of answers) {
      for (const aid of ans.structured?.action_ids || []) {
        ids.add(aid);
      }
    }
    return Array.from(ids);
  }, [answers]);

  const emailQueries = useQueries({
    queries: referencedEmailIds.map((eid) => ({
      queryKey: emailService.keys.detail(mode, scopeKey, eid),
      queryFn: () => emailService.get(dataSource, eid),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const decisionQueries = useQueries({
    queries: referencedDecisionIds.map((did) => ({
      queryKey: decisionService.keys.detail(mode, scopeKey, did),
      queryFn: () => decisionService.get(dataSource, did),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const actionQueries = useQueries({
    queries: referencedActionIds.map((aid) => ({
      queryKey: ['actions', mode, scopeKey, 'single', aid] as const,
      queryFn: async () => {
        const page = await actionService.list(dataSource, { limit: 100 });
        return page.items.find((a) => a.action_id === aid) || null;
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const emailsById = useMemo(() => {
    const map = new Map<string, EmailMessage>();
    emailQueries.forEach((q, idx) => {
      if (q.data) map.set(referencedEmailIds[idx], q.data);
    });
    return map;
  }, [emailQueries, referencedEmailIds]);

  const decisionsById = useMemo(() => {
    const map = new Map<string, Decision>();
    decisionQueries.forEach((q, idx) => {
      if (q.data) map.set(referencedDecisionIds[idx], q.data);
    });
    return map;
  }, [decisionQueries, referencedDecisionIds]);

  const actionsById = useMemo(() => {
    const map = new Map<string, ActionItem>();
    actionQueries.forEach((q) => {
      if (q.data) map.set(q.data.action_id, q.data);
    });
    return map;
  }, [actionQueries]);

  const updateScope = (nextScope: string) => {
    setScope(nextScope);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextScope) {
          next.set('thread', nextScope);
        } else {
          next.delete('thread');
        }
        return next;
      },
      { replace: true },
    );
  };

  const submitQuestion = async (rawQuestion: string, overrideScope?: string | null) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || loading) return;

    const effectiveScope =
      overrideScope !== undefined ? overrideScope : scope ? scope : null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAskError(null);
    setLoading(true);
    setLoadingLabel('Retrieving and verifying evidence…');

    try {
      const result = await intelligenceService.ask(
        dataSource,
        {
          question: trimmed,
          thread_scope: effectiveScope,
          session_id: sessionId,
        },
        controller.signal,
        (phase) => {
          if (phase === 'verifying_sources') {
            setLoadingLabel('verifying sources…');
          }
        },
      );

      // Ensure unique answer_id within conversation turn list
      const uniqueAnswer: Answer = answers.some((a) => a.answer_id === result.answer_id)
        ? { ...result, answer_id: `${result.answer_id}-${Date.now()}` }
        : result;

      setAnswers((prev) => [...prev, uniqueAnswer]);
      setSelectedAnswerId(uniqueAnswer.answer_id);
      setQuestionInput('');

      const scopeLabel =
        effectiveScope === 'ALL'
          ? 'All conversations'
          : effectiveScope || 'All conversations';
      setPreviousQuestions(
        savePreviousQuestion({
          question: trimmed,
          threadScope: effectiveScope,
          scopeLabel,
        }),
      );
    } catch (err) {
      if (err instanceof SutraApiError && err.code === 'ABORTED') {
        addToast({ tone: 'info', title: 'Question cancelled.' });
        return;
      }
      setAskError({
        message:
          err instanceof Error
            ? err.message
            : 'Unable to retrieve an answer from the configured backend.',
        requestId: err instanceof SutraApiError ? err.requestId : undefined,
        lastRequest: { question: trimmed, thread_scope: effectiveScope },
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleClarificationSelect = (option: ClarificationOption) => {
    const nextScope = option.thread_scope ?? '';
    updateScope(nextScope);
    void submitQuestion(option.question, option.thread_scope);
  };

  const handleDetachContext = () => {
    updateScope('');
    setSessionId(`sess-${Date.now()}`);
  };

  const handleNewConversation = () => {
    abortRef.current?.abort();
    setAnswers([]);
    setSelectedAnswerId(null);
    setAskError(null);
    setSessionId(`sess-${Date.now()}`);
    composerRef.current?.focus();
  };

  const suggestedQuestions = getSuggestedQuestions(isDemo);

  return (
    <div
      className={`mx-auto w-full min-w-0 max-w-[1360px] space-y-5 ${
        activeAnswer ? 'pb-16 lg:pb-0' : ''
      }`}
    >
      {/* Page header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E2D9] pb-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">Ask SUTRA</h1>
          <p className="mt-1 text-[14px] text-[#5A6560]">
            Evidence-first question answering across institutional conversations with claim-level citations and explicit limitations.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <div className="w-full sm:w-[290px]">
            <Select
              label="Conversation scope"
              value={scope}
              onChange={updateScope}
              options={scopeOptions}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowUtc((prev) => !prev)}
            className="inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-3 py-2 text-[12.5px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
          >
            <Clock size={13} aria-hidden="true" />
            <span>{showUtc ? 'Show IST' : 'Show UTC'}</span>
          </button>

          {answers.length > 0 && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleNewConversation}
              leftIcon={<RotateCcw size={14} aria-hidden="true" />}
            >
              New conversation
            </Button>
          )}
        </div>
      </header>

      {/* Two-region workspace (~60% Main / ~40% Evidence panel on lg+) */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Main region (left ~60%) */}
        <div className="min-w-0 space-y-5 lg:col-span-7">
          {/* Welcome state when no answers yet */}
          {answers.length === 0 && !loading && !askError && (
            <section
              aria-label="Ask SUTRA welcome"
              className="rounded-[8px] border border-[#E5E2D9] bg-white p-5 sm:p-6"
            >
              <div className="flex items-start gap-2.5">
                <Sparkles size={18} className="mt-1 shrink-0 text-[#7A5C1E]" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-[19px] font-semibold text-[#102D2A]">
                    What would you like to understand?
                  </h2>
                  <p className="mt-1 text-[14px] leading-[1.55] text-[#5A6560]">
                    Ask questions across your institutional email conversations. SUTRA retrieves relevant evidence and presents answers you can verify.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                  Suggested questions {isDemo ? '(pre-authored demo queries)' : ''}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setQuestionInput(q);
                        void submitQuestion(q);
                      }}
                      className="rounded-[6px] border border-[#7B8581]/70 bg-[#F5F2EA]/65 px-3 py-2 text-left text-[13px] font-medium text-[#102D2A] transition-colors hover:border-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Conversation of answers */}
          {answers.length > 0 && (
            <div className="space-y-4" aria-live="polite">
              {answers.map((ans) => (
                <AnswerCard
                  key={ans.answer_id}
                  answer={ans}
                  isSelected={activeAnswer?.answer_id === ans.answer_id}
                  isDemo={isDemo}
                  showUtc={showUtc}
                  decisionsById={decisionsById}
                  actionsById={actionsById}
                  emailsById={emailsById}
                  onSelectAnswer={() => setSelectedAnswerId(ans.answer_id)}
                  onInspectCitation={(target) => setDrawerTarget(target)}
                  onSelectClarification={handleClarificationSelect}
                  onUseSuggestion={(q) => {
                    setQuestionInput(q);
                    void submitQuestion(q);
                  }}
                  onOpenEvidenceMobile={() => {
                    setSelectedAnswerId(ans.answer_id);
                    setMobileEvidenceOpen(true);
                  }}
                  onSubmitFeedback={
                    isDemo
                      ? undefined
                      : (answerId, rating, comment) =>
                          intelligenceService.submitFeedback(dataSource, answerId, {
                            rating,
                            comment,
                          })
                  }
                />
              ))}
            </div>
          )}

          {/* Indeterminate loading state (no simulated progress steps) */}
          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-between gap-3 rounded-[8px] border border-[#102D2A]/25 bg-white p-4"
            >
              <div className="flex items-center gap-2.5 text-[14px] font-medium text-[#102D2A]">
                <Loader2 size={17} className="animate-spin shrink-0" aria-hidden="true" />
                <span>{loadingLabel}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => abortRef.current?.abort()}
                leftIcon={<Square size={12} aria-hidden="true" />}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Error state when live backend fails (never fabricates an answer) */}
          {askError && (
            <ErrorState
              title="Answer could not be retrieved"
              message={askError.message}
              requestId={askError.requestId}
              onRetry={() =>
                void submitQuestion(
                  askError.lastRequest.question,
                  askError.lastRequest.thread_scope,
                )
              }
            />
          )}

          {/* Composer */}
          <section
            aria-label="Ask a question composer"
            className="rounded-[8px] border border-[#E5E2D9] bg-white p-4 sm:p-5 space-y-3"
          >
            {activeScopeLabel && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#102D2A]/25 bg-[#E8EFEA] px-2.5 py-1 text-[12px] font-medium text-[#102D2A]">
                  <span>Following up on: {activeScopeLabel}</span>
                  <button
                    type="button"
                    onClick={handleDetachContext}
                    aria-label="Detach conversation follow-up context"
                    className="rounded-[2px] p-0.5 hover:bg-[#102D2A] hover:text-[#F5F2EA] cursor-pointer"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              </div>
            )}

            <div>
              <label
                htmlFor="ask-sutra-composer"
                className="block font-display text-[13px] font-semibold text-[#102D2A]"
              >
                Ask an evidence-grounded question
              </label>
              <textarea
                id="ask-sutra-composer"
                ref={composerRef}
                rows={3}
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submitQuestion(questionInput);
                  }
                }}
                placeholder="Ask about approvals, ceilings, timelines, or pending obligations… (Enter to send, Shift+Enter for new line)"
                className="mt-1.5 w-full rounded-[6px] border border-[#7B8581] bg-white px-3 py-2.5 text-[14px] leading-[1.5] text-[#202B35] placeholder:text-[#5A6560] focus:border-[#102D2A] focus:outline-2 focus:outline-[#102D2A]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`text-[12px] tabular-nums ${
                  questionInput.length > MAX_QUESTION_CHARS ? 'text-[#8A5A00] font-medium' : 'text-[#5A6560]'
                }`}
              >
                {questionInput.length}/{MAX_QUESTION_CHARS} characters recommended · Enter sends · Shift+Enter newline
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {questionInput.length > 0 && !loading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuestionInput('')}
                    leftIcon={<Eraser size={13} aria-hidden="true" />}
                  >
                    Clear
                  </Button>
                )}

                {loading ? (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => abortRef.current?.abort()}
                    leftIcon={<Square size={13} aria-hidden="true" />}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={questionInput.trim().length === 0}
                    onClick={() => void submitQuestion(questionInput)}
                    rightIcon={<Send size={14} aria-hidden="true" />}
                  >
                    Send
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Suggested questions bar after conversation started */}
          {answers.length > 0 && (
            <section
              aria-label="Quick suggested questions"
              className="rounded-[8px] border border-[#E5E2D9] bg-white p-4"
            >
              <p className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                More suggested questions
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestedQuestions.map((q) => (
                  <button
                    key={`quick-${q}`}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setQuestionInput(q);
                      void submitQuestion(q);
                    }}
                    className="rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/60 px-2.5 py-1 text-left text-[12px] font-medium text-[#102D2A] hover:border-[#102D2A] hover:bg-[#E8EFEA] disabled:opacity-50 cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Previous questions (browser-only) */}
          <section
            aria-label="Previous questions"
            className="rounded-[8px] border border-[#E5E2D9] bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <History size={14} className="text-[#5A6560]" aria-hidden="true" />
                <h2 className="font-display text-[13px] font-semibold text-[#102D2A]">
                  Previous questions
                </h2>
                <span className="text-[11.5px] text-[#5A6560]">
                  (stored in this browser only)
                </span>
              </div>
              {previousQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviousQuestions(clearPreviousQuestions())}
                  className="text-[12px] font-medium text-[#5A6560] hover:text-[#102D2A] underline cursor-pointer"
                >
                  Clear history
                </button>
              )}
            </div>

            {previousQuestions.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-[#5A6560]">
                Questions you ask in this browser will appear here for quick re-use.
              </p>
            ) : (
              <ul className="mt-2.5 divide-y divide-[#E5E2D9]">
                {previousQuestions.map((pq) => (
                  <li key={pq.id} className="py-2 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (pq.threadScope) {
                          updateScope(pq.threadScope);
                        } else {
                          updateScope('');
                        }
                        setQuestionInput(pq.question);
                        void submitQuestion(pq.question, pq.threadScope);
                      }}
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-[13px] text-[#102D2A] hover:underline cursor-pointer"
                    >
                      <span className="font-medium break-words">{pq.question}</span>
                      <span className="text-[11.5px] text-[#5A6560] shrink-0">
                        {pq.scopeLabel}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right Evidence panel (~40%) on desktop */}
        <div className="hidden min-w-0 lg:block lg:col-span-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <EvidencePanel
            answer={activeAnswer}
            emailsById={emailsById}
            showUtc={showUtc}
            onInspectCitation={(target) => setDrawerTarget(target)}
          />
        </div>
      </div>

      {/* Bottom sheet / Drawer for Evidence panel on small screens (<lg) */}
      {activeAnswer && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5E2D9] bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => setMobileEvidenceOpen(true)}
          >
            Inspect evidence &amp; sources ({activeAnswer.citations.length})
          </Button>
        </div>
      )}

      <Drawer
        open={mobileEvidenceOpen}
        onClose={() => setMobileEvidenceOpen(false)}
        side="bottom"
        title="Evidence panel"
        subtitle={activeAnswer?.question || undefined}
      >
        <EvidencePanel
          answer={activeAnswer}
          emailsById={emailsById}
          showUtc={showUtc}
          onInspectCitation={(target) => {
            setMobileEvidenceOpen(false);
            setDrawerTarget(target);
          }}
        />
      </Drawer>

      <EvidenceDrawer
        open={Boolean(drawerTarget)}
        onClose={() => setDrawerTarget(null)}
        emailId={drawerTarget?.emailId ?? null}
        quote={drawerTarget?.quote ?? null}
        attachmentId={drawerTarget?.attachmentId ?? null}
        initialTab={drawerTarget?.tab ?? 'email'}
        verification={drawerTarget?.verification}
      />
    </div>
  );
};

export default AskSutraPage;
