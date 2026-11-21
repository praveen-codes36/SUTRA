import React, { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FileSearch, Quote } from 'lucide-react';
import { Wordmark } from '../components/brand/Wordmark';
import {
  LandingTrustAndClosing,
  LandingWorkflowSection,
} from '../components/landing/LandingSections';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Skeleton } from '../components/ui/Skeleton';
import { HeroSvgFallback } from '../components/visualizations/SvgFallbacks';
import { useCapability } from '../hooks/useCapability';

const LazyHeroScene = lazy(() => import('../components/visualizations/HeroScene'));

const PROBLEM_POINTS = [
  {
    num: '01',
    title: 'Decisions buried in threads',
    detail: 'Formal approvals, conditions, and follow-up clarifications are scattered across long reply chains.',
  },
  {
    num: '02',
    title: 'Approvals and responsibilities hard to trace',
    detail: 'Recommendations get mistaken for final approvals, and action owners remain implicit or unrecorded.',
  },
  {
    num: '03',
    title: 'Critical information spread across replies and attachments',
    detail: 'Revised figures, eligibility caps, and compliance notes live inside separate tables and memos.',
  },
  {
    num: '04',
    title: 'Manual review wastes institutional time',
    detail: 'Staff reconstruct context by reading decades of chronological messages before answering a single question.',
  },
];

const SOLUTION_CAPABILITIES = [
  {
    num: '01',
    title: 'Intelligent email organisation',
    detail: 'Group raw email exports into reconstructed reply chains, participants, and institutional topics.',
  },
  {
    num: '02',
    title: 'Conversation summarisation',
    detail: 'Distil purpose, key developments, latest status, deadlines, and unresolved questions with source links.',
  },
  {
    num: '03',
    title: 'Decision and action extraction',
    detail: 'Separate recommendations from conditional approvals, limited-scope acceptances, and pending obligations.',
  },
  {
    num: '04',
    title: 'Natural-language intelligence search',
    detail: 'Query across institutional threads or scope questions to one conversation with retrieval-grounded synthesis.',
  },
  {
    num: '05',
    title: 'Verifiable source attribution',
    detail: 'Trace every claim, amount, and owner back to verbatim email excerpts and extracted attachment records.',
  },
];

export const LandingPage: React.FC = () => {
  const capability = useCapability();
  const [heroWebGLError, setHeroWebGLError] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: capability.reducedMotion ? 'auto' : 'smooth' });
    }
  };

  const useHero3D = capability.canUse3D && !heroWebGLError;

  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#202B35]">
      <a href="#landing-main" className="skip-link">
        Skip to main content
      </a>

      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-[#E5E2D9] bg-[#F5F2EA]/95">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="rounded-[4px]" aria-label="SUTRA home">
            <Wordmark variant="onLight" size="md" />
          </Link>

          <nav
            aria-label="Primary landing navigation"
            className="hidden md:flex items-center gap-6 text-[13px] font-display font-medium text-[#202B35]"
          >
            <button
              type="button"
              onClick={() => scrollToSection('product')}
              className="hover:text-[#102D2A] cursor-pointer"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('capabilities')}
              className="hover:text-[#102D2A] cursor-pointer"
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[#102D2A] cursor-pointer"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('trust')}
              className="hover:text-[#102D2A] cursor-pointer"
            >
              Trust and security
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/signin"
              className="inline-flex min-h-[44px] lg:min-h-[38px] items-center rounded-[4px] border border-[#7B8581] bg-white px-3.5 py-1.5 font-display text-[13px] font-semibold text-[#102D2A] hover:bg-[#E8EFEA]"
            >
              Sign in
            </Link>
            <Link
              to="/signin"
              className="inline-flex min-h-[44px] lg:min-h-[38px] items-center gap-1.5 rounded-[4px] bg-[#102D2A] px-3.5 py-1.5 font-display text-[13px] font-semibold text-[#F5F2EA] hover:bg-[#1B4A45]"
            >
              <span>Get started</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1} className="focus:outline-none">
        {/* Hero with Scene A */}
        <section
          id="product"
          data-surface="dark"
          className="surface-dark scroll-mt-20 border-b border-[#1B4A45] bg-[#102D2A] text-[#F5F2EA]"
        >
          <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
            <div>
              <p className="font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-[#D5B77B]">
                AI-Powered Institutional Email Intelligence
              </p>
              <h1 className="mt-4 font-serif text-[36px] font-normal leading-[1.08] tracking-[-0.015em] text-[#F5F2EA] sm:text-[48px]">
                Every Connection. One Intelligence.
              </h1>
              <p className="mt-5 max-w-[540px] text-[16px] leading-[1.6] text-[#B8C4BE]">
                Transform fragmented institutional email conversations into connected, searchable and evidence-backed knowledge.
              </p>

              {/* Single Devanagari brand moment */}
              <p className="mt-4 text-[13px] text-[#B8C4BE]">
                <span
                  lang="sa"
                  className="mr-2 font-semibold text-[#D5B77B]"
                >
                  सूत्र
                </span>
                — a connecting thread across institutional records.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/signin"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[4px] border border-[#D5B77B] bg-[#D5B77B] px-5 py-2.5 font-display text-[14px] font-bold text-[#102D2A] hover:bg-[#F5F2EA] hover:border-[#F5F2EA]"
                >
                  <span>Explore SUTRA</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="inline-flex min-h-[44px] items-center rounded-[4px] border border-[#B8C4BE]/60 bg-[#1B4A45]/45 px-5 py-2.5 font-display text-[14px] font-semibold text-[#F5F2EA] transition-colors duration-150 hover:border-[#F5F2EA] hover:bg-[#1B4A45] cursor-pointer"
                >
                  Discover how it works
                </button>
              </div>
            </div>

            <div className="min-w-0">
              {useHero3D ? (
                <Suspense
                  fallback={
                    <div className="h-[320px] sm:h-[380px] rounded-[8px] border border-[#1B4A45] bg-[#102D2A] p-6">
                      <Skeleton className="h-full w-full bg-[#1B4A45]/70" />
                    </div>
                  }
                >
                  <LazyHeroScene
                    isSoftwareGl={capability.isSoftwareGl}
                    reducedMotion={capability.reducedMotion}
                    onWebGLError={() => setHeroWebGLError(true)}
                  />
                </Suspense>
              ) : (
                <HeroSvgFallback reducedMotion={capability.reducedMotion} />
              )}
              <p className="sr-only">
                Interactive visual showing email messages assembling into connected thread clusters linked by a continuous gold thread.
              </p>
            </div>
          </div>
        </section>

        {/* Problem — editorial two-column layout with numbered list (no cards) */}
        <section className="border-b border-[#E5E2D9] bg-white">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7A5C1E]">
                The problem
              </p>
              <h2 className="mt-2 font-display text-[24px] font-semibold leading-[1.25] text-[#102D2A]">
                Institutional knowledge is scattered across replies, forwards, and attachments.
              </h2>
              <p className="mt-3 text-[14px] leading-[1.6] text-[#5A6560]">
                Mailboxes store messages chronologically, not structurally. Finding what was recommended, conditionally approved, or left unconfirmed requires manual reading across every message.
              </p>
            </div>

            <ol className="divide-y divide-[#E5E2D9] border-t border-b border-[#E5E2D9]">
              {PROBLEM_POINTS.map((item) => (
                <li
                  key={item.num}
                  className="grid grid-cols-[44px_1fr] gap-4 py-4"
                >
                  <span className="font-mono text-[13px] font-semibold text-[#7A5C1E] tabular-nums">
                    {item.num}
                  </span>
                  <div>
                    <h3 className="font-display text-[16px] font-semibold text-[#102D2A]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[14px] leading-[1.55] text-[#5A6560]">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Solution — ruled list of five capabilities + E048 evidence citation visual */}
        <section id="capabilities" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="max-w-[680px]">
            <p className="font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7A5C1E]">
              Solution &amp; Capabilities
            </p>
            <h2 className="mt-2 font-display text-[24px] font-semibold text-[#102D2A] sm:text-[28px]">
              Connected, evidence-backed email intelligence
            </h2>
          </div>

          <div className="mt-8 divide-y divide-[#E5E2D9] border-t border-b border-[#E5E2D9] bg-white">
            {SOLUTION_CAPABILITIES.map((cap) => (
              <div
                key={cap.num}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[56px_1fr_auto] sm:items-center sm:gap-6"
              >
                <span className="font-mono text-[13px] font-semibold text-[#7A5C1E] tabular-nums">
                  {cap.num}
                </span>
                <div>
                  <h3 className="font-display text-[16px] font-semibold text-[#102D2A]">
                    {cap.title}
                  </h3>
                  <p className="mt-1 text-[14px] leading-[1.55] text-[#5A6560]">{cap.detail}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#102D2A]">
                  <FileSearch size={14} aria-hidden="true" />
                  <span>Evidence</span>
                </span>
              </div>
            ))}
          </div>

          {/* Real product evidence citation visual (E048 benchmark excerpt) */}
          <div className="mt-8 rounded-[8px] border border-[#E5E2D9] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E2D9] pb-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#E8EFEA] px-2.5 py-1 font-mono text-[12px] font-semibold text-[#102D2A] tabular-nums">
                  <Quote size={13} aria-hidden="true" />
                  <span>E048</span>
                </span>
                <span className="text-[13px] font-medium text-[#202B35]">
                  Research Office · 18 Sep 2026, 13:55 IST
                </span>
                <span className="font-mono text-[12px] text-[#5A6560]">THR-009</span>
              </div>
              <span className="rounded-[4px] border border-[#8A5A00]/35 bg-[#FBF0D9] px-2.5 py-0.5 font-display text-[12px] font-semibold text-[#8A5A00]">
                Limited-scope acceptance
              </span>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <blockquote className="border-l-2 border-[#D5B77B] pl-4 text-[14px] leading-[1.6] text-[#202B35]">
                “Revised plan accepted for budget planning only. This is not purchase authorization; submit individual requisitions for approval before ordering.”
              </blockquote>
              <dl className="grid gap-3 border-t border-[#E5E2D9] pt-4 text-[13px] lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                <div>
                  <dt className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1E6B45]">
                    Authorizes
                  </dt>
                  <dd className="mt-0.5 text-[#202B35]">Budget planning only</dd>
                </div>
                <div>
                  <dt className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A3342B]">
                    Does not authorize
                  </dt>
                  <dd className="mt-0.5 text-[#202B35]">Purchase authorization or ordering without individual requisitions</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* How SUTRA works (Scene B + 4 stage controls + 5-step list) */}
        <LandingWorkflowSection capability={capability} />

        {/* Trust & security + Closing CTA */}
        <LandingTrustAndClosing />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E2D9] bg-[#F5F2EA]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-[#5A6560] sm:px-6">
          <div className="space-y-1">
            <Wordmark variant="onLight" size="sm" />
            <p className="text-[12px] text-[#5A6560]">
              SUTRA — AI-Powered Institutional Email Intelligence Platform
            </p>
          </div>

          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => scrollToSection('product')}
              className="hover:text-[#102D2A] cursor-pointer"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('capabilities')}
              className="hover:text-[#102D2A] cursor-pointer"
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[#102D2A] cursor-pointer"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('trust')}
              className="hover:text-[#102D2A] cursor-pointer"
            >
              Trust and security
            </button>
            <Link to="/signin" className="font-medium text-[#102D2A] hover:underline">
              Sign in
            </Link>
            <button
              type="button"
              onClick={() => setDocsOpen(true)}
              className="inline-flex items-center gap-1.5 font-medium text-[#102D2A] underline hover:text-[#1B4A45] cursor-pointer"
            >
              <BookOpen size={14} aria-hidden="true" />
              <span>Documentation (placeholder)</span>
            </button>
            <span>© SUTRA</span>
          </nav>
        </div>
      </footer>

      <Dialog
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        title="Documentation"
        footer={
          <Button variant="primary" size="sm" onClick={() => setDocsOpen(false)}>
            Close
          </Button>
        }
      >
        <p className="text-[14px] leading-[1.55] text-[#202B35]">
          Product documentation is not yet published in this release. Sign in to explore the interactive workspace or review system mode settings.
        </p>
      </Dialog>
    </div>
  );
};

export default LandingPage;
