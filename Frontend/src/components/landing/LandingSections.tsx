import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  FileText,
  Lock,
  Quote,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { WorkflowSvgFallback } from '../visualizations/SvgFallbacks';
import type { CapabilityState } from '../../hooks/useCapability';

const LazyWorkflowScene = lazy(() => import('../visualizations/WorkflowScene'));

const STAGE_CAPTIONS: Record<1 | 2 | 3 | 4, { title: string; detail: string }> = {
  1: {
    title: 'Stage 1 — Email messages',
    detail: 'Individual email records enter as disconnected messages across senders, forwards, and attachments.',
  },
  2: {
    title: 'Stage 2 — Connected conversations',
    detail: 'Messages are grouped into chronological thread clusters using reply links and subject continuity.',
  },
  3: {
    title: 'Stage 3 — Extracted decisions & actions',
    detail: 'Key messages containing approvals, conditions, scope limits, and obligations are identified (shown in gold).',
  },
  4: {
    title: 'Stage 4 — Institutional intelligence',
    detail: 'Conversations connect to a unified, retrieval-grounded intelligence index with source citations.',
  },
};

const WORKFLOW_STEPS = [
  { num: '1', title: 'Import official email records', detail: 'Load authorised CSV archives and paired attachments.' },
  { num: '2', title: 'Organise messages into conversations', detail: 'Reconstruct reply chains, anomalies, and topic groups.' },
  { num: '3', title: 'Analyse and retrieve relevant information', detail: 'Index bodies and extracted attachment text for hybrid search.' },
  { num: '4', title: 'Extract decisions and actions', detail: 'Separate recommendations, conditional approvals, and pending tasks.' },
  { num: '5', title: 'Deliver evidence-backed intelligence', detail: 'Synthesise answers where every claim links to original quotes.' },
];

export interface LandingWorkflowSectionProps {
  capability: CapabilityState;
}

export const LandingWorkflowSection: React.FC<LandingWorkflowSectionProps> = ({ capability }) => {
  const [activeStage, setActiveStage] = useState<1 | 2 | 3 | 4>(1);
  const [userLockedStage, setUserLockedStage] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (capability.reducedMotion || userLockedStage) return;

    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight || 800;
      // Map section progression through viewport into stages 1..4
      const totalTravel = Math.max(1, rect.height + viewH * 0.25);
      const progressed = viewH * 0.65 - rect.top;
      const ratio = Math.max(0, Math.min(0.999, progressed / totalTravel));
      const stage = (Math.floor(ratio * 4) + 1) as 1 | 2 | 3 | 4;
      setActiveStage(stage);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [capability.reducedMotion, userLockedStage]);

  const handleSelectStage = (stage: 1 | 2 | 3 | 4) => {
    setUserLockedStage(true);
    setActiveStage(stage);
  };

  const use3D = capability.canUse3D && !webglFailed && inView;
  const caption = STAGE_CAPTIONS[activeStage];

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="scroll-mt-20 border-t border-[#E5E2D9] bg-white"
    >
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
        <div className="max-w-[720px]">
          <p className="font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7A5C1E]">
            How SUTRA works
          </p>
          <h2 className="mt-2 font-display text-[24px] font-semibold text-[#102D2A] sm:text-[28px]">
            From scattered messages to verifiable institutional intelligence
          </h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-[#5A6560]">
            Visual stages are illustrated with the supplied synthetic benchmark (52 emails, 10 conversations). Visual stage 3 maps to workflow steps 3–4, and visual stage 4 maps to step 5.
          </p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          {/* Sticky visual panel */}
          <div className="lg:sticky lg:top-20 space-y-4">
            <div
              role="group"
              aria-label="Workflow stage selector"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {([1, 2, 3, 4] as const).map((stage) => {
                const selected = activeStage === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleSelectStage(stage)}
                    className={`min-h-[40px] rounded-[4px] border px-3 py-2 text-left font-display text-[12px] font-semibold transition-colors duration-150 cursor-pointer ${
                      selected
                        ? 'border-[#102D2A] bg-[#102D2A] text-[#F5F2EA]'
                        : 'border-[#7B8581] bg-[#F5F2EA]/60 text-[#102D2A] hover:bg-[#E8EFEA]'
                    }`}
                  >
                    Stage {stage}
                  </button>
                );
              })}
            </div>

            {use3D ? (
              <Suspense
                fallback={
                  <div className="h-[320px] sm:h-[380px] rounded-[8px] border border-[#1B4A45] bg-[#102D2A] p-6">
                    <Skeleton className="h-full w-full bg-[#1B4A45]/70" />
                  </div>
                }
              >
                <LazyWorkflowScene
                  activeStage={activeStage}
                  isSoftwareGl={capability.isSoftwareGl}
                  reducedMotion={capability.reducedMotion}
                  onWebGLError={() => setWebglFailed(true)}
                />
              </Suspense>
            ) : (
              <WorkflowSvgFallback
                activeStage={activeStage}
                onSelectStage={handleSelectStage}
              />
            )}

            <div
              aria-live="polite"
              className="rounded-[8px] border border-[#E5E2D9] bg-[#F5F2EA]/70 px-4 py-3"
            >
              <p className="font-display text-[14px] font-semibold text-[#102D2A]">
                {caption.title}
              </p>
              <p className="mt-1 text-[13px] leading-[1.55] text-[#5A6560]">
                {caption.detail}
              </p>
            </div>
          </div>

          {/* Five numbered workflow steps */}
          <div className="divide-y divide-[#E5E2D9] border-t border-b border-[#E5E2D9]">
            {WORKFLOW_STEPS.map((step) => {
              const linkedStage =
                step.num === '1' ? 1 : step.num === '2' ? 2 : step.num === '5' ? 4 : 3;
              const isHighlighted = activeStage === linkedStage;
              return (
                <div
                  key={step.num}
                  className={`grid grid-cols-[40px_1fr] gap-4 px-3 py-5 transition-colors duration-150 ${
                    isHighlighted ? 'bg-[#E8EFEA]/70' : 'bg-white'
                  }`}
                >
                  <span className="font-mono text-[14px] font-semibold text-[#7A5C1E] tabular-nums">
                    0{step.num}
                  </span>
                  <div>
                    <h3 className="font-display text-[16px] font-semibold text-[#102D2A]">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-[14px] leading-[1.55] text-[#5A6560]">
                      {step.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export const LandingTrustAndClosing: React.FC = () => {
  return (
    <>
      <section id="trust" className="scroll-mt-20 border-t border-[#E5E2D9] bg-[#F5F2EA]">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-start">
            <div>
              <p className="font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7A5C1E]">
                Trust and security
              </p>
              <h2 className="mt-2 font-display text-[24px] font-semibold text-[#102D2A] sm:text-[28px]">
                Built for verification, not ungrounded automation
              </h2>
              <ul className="mt-6 divide-y divide-[#E5E2D9] border-t border-b border-[#E5E2D9]">
                {[
                  {
                    icon: CheckCircle2,
                    title: 'Evidence-backed answers',
                    detail: 'Responses carry explicit citations so reviewers can confirm every factual claim.',
                  },
                  {
                    icon: FileSearch,
                    title: 'Source traceability',
                    detail: 'Inspect verbatim email bodies, message reply links, and extracted attachment text.',
                  },
                  {
                    icon: Lock,
                    title: 'Permission-aware retrieval',
                    detail: 'Document and thread visibility are enforced by the backend; restricted items are never leaked.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Secure data handling',
                    detail: 'Read-only intelligence layer: SUTRA never sends, forwards, edits, or approves correspondence.',
                  },
                  {
                    icon: Scale,
                    title: 'Explicit unknowns and conflicts',
                    detail: 'Unstated owners, missing deadlines, and conflicting records are reported explicitly.',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title} className="flex items-start gap-3 py-3.5">
                      <Icon size={17} className="mt-0.5 shrink-0 text-[#102D2A]" aria-hidden="true" />
                      <div>
                        <p className="font-display text-[14px] font-semibold text-[#102D2A]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-[1.55] text-[#5A6560]">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Answer anatomy diagram */}
            <div className="rounded-[8px] border border-[#E5E2D9] bg-white p-6">
              <p className="font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-[#7A5C1E]">
                Answer anatomy
              </p>
              <h3 className="mt-1 font-display text-[18px] font-semibold text-[#102D2A]">
                Claim → Citation → Original email
              </h3>
              <p className="mt-1 text-[13px] text-[#5A6560]">
                Every generated claim links to a verifiable passage in the corpus.
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/70 p-4">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-[#7A5C1E]">
                    <span>1 · Synthesised claim</span>
                    <span className="rounded-[4px] border border-[#7B8581] bg-white px-2 py-0.5 text-[#102D2A]">
                      Explicit
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] leading-[1.55] text-[#202B35]">
                    The revised consumables plan was accepted for budget planning only and does not authorize purchases.
                  </p>
                </div>

                <div className="flex justify-center text-[#7A5C1E]" aria-hidden="true">
                  <ArrowRight size={16} className="rotate-90" />
                </div>

                <div className="rounded-[6px] border border-[#102D2A]/25 bg-[#E8EFEA] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-display font-semibold text-[#102D2A]">
                    <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.08em]">
                      <Quote size={13} aria-hidden="true" />
                      <span>2 · Verifiable citation</span>
                    </span>
                    <span className="font-mono tabular-nums">E048 · THR-009</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-[#202B35]">
                    Research Office · 18 Sep 2026, 13:55 IST
                  </p>
                </div>

                <div className="flex justify-center text-[#7A5C1E]" aria-hidden="true">
                  <ArrowRight size={16} className="rotate-90" />
                </div>

                <div className="rounded-[6px] border border-[#7B8581] bg-white p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-[#5A6560]">
                    <FileText size={13} aria-hidden="true" />
                    <span>3 · Original email passage</span>
                  </div>
                  <blockquote className="mt-2 border-l-2 border-[#D5B77B] pl-3 text-[13px] leading-[1.55] text-[#202B35]">
                    “Revised plan accepted for budget planning only. This is not purchase authorization; submit individual requisitions for approval before ordering.”
                  </blockquote>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section
        data-surface="dark"
        className="surface-dark border-t border-[#1B4A45] bg-[#102D2A] text-[#F5F2EA]"
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center">
          <div className="max-w-[680px]">
            <h2 className="font-serif text-[28px] font-normal leading-[1.2] text-[#F5F2EA] sm:text-[34px]">
              Make institutional knowledge accessible, connected and accountable.
            </h2>
          </div>
          <Link
            to="/signin"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[4px] border border-[#D5B77B] bg-[#D5B77B] px-5 py-2.5 font-display text-[14px] font-bold text-[#102D2A] hover:bg-[#F5F2EA] hover:border-[#F5F2EA] shrink-0"
          >
            <span>Enter the SUTRA workspace</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
};
