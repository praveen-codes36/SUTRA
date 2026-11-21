import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { useSutra } from '../app/providers';
import { Wordmark } from '../components/brand/Wordmark';

export const NotFoundPage: React.FC = () => {
  const { mode, persona, liveUser } = useSutra();
  const hasWorkspaceSession = mode === 'demo' ? Boolean(persona) : Boolean(liveUser);

  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#202B35]">
      <header className="border-b border-[#E5E2D9] bg-white">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="rounded-[4px]">
            <Wordmark variant="onLight" showDevanagari size="md" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-4 py-16 sm:px-6">
        <div className="rounded-[8px] border border-[#E5E2D9] bg-white p-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-[4px] bg-[#E8EFEA] text-[#102D2A]">
            <FileQuestion size={20} aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-display text-[24px] font-semibold text-[#102D2A]">
            The requested page is not available
          </h1>
          <p className="mt-2 text-[14px] leading-[1.55] text-[#5A6560]">
            The link may be outdated, or the resource may not exist in this workspace.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {hasWorkspaceSession && (
              <Link
                to="/app/overview"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-[4px] bg-[#102D2A] px-4 py-2 font-display text-[14px] font-semibold text-[#F5F2EA] hover:bg-[#1B4A45]"
              >
                <ArrowLeft size={15} aria-hidden="true" />
                <span>Return to workspace</span>
              </Link>
            )}
            <Link
              to="/"
              className="inline-flex min-h-[40px] items-center rounded-[4px] border border-[#7B8581] bg-white px-4 py-2 font-display text-[14px] font-semibold text-[#102D2A] hover:bg-[#E8EFEA]"
            >
              Go to landing page
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFoundPage;
