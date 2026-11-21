import React, { useEffect, useRef } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import type { SearchHit } from '../../adapters/dataSource';
import { trapFocusOnKeyDown } from '../../lib/a11y';
import { IconButton } from './IconButton';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchHit[];
  loading: boolean;
  degraded?: boolean;
  isDemo: boolean;
  onSelectHit: (hit: SearchHit) => void;
  onAskAbout: (queryOrTitle: string, threadKey?: string) => void;
}

const LEVEL_LABELS: Record<SearchHit['level'], string> = {
  email: 'Message',
  attachment: 'Attachment',
  thread: 'Conversation',
  decision: 'Decision',
  action: 'Action item',
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  query,
  onQueryChange,
  results,
  loading,
  degraded = false,
  isDemo,
  onSelectHit,
  onAskAbout,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else {
        trapFocusOnKeyDown(e, dialogRef.current);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 sm:pt-24">
      <div className="fixed inset-0 bg-[#102D2A]/45" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global workspace search"
        className="relative z-10 w-full max-w-[660px] overflow-hidden rounded-[8px] border border-[#7B8581] bg-white shadow-[var(--shadow-overlay)]"
      >
        <div className="flex items-center gap-2 border-b border-[#E5E2D9] px-4 py-3">
          <Search size={18} className="shrink-0 text-[#5A6560]" aria-hidden="true" />
          <label htmlFor="sutra-command-search" className="sr-only">
            Search emails, threads, attachments, decisions, and actions
          </label>
          <input
            ref={inputRef}
            id="sutra-command-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search messages, attachments, threads, decisions, actions…"
            className="w-full bg-transparent text-[15px] text-[#202B35] placeholder:text-[#5A6560] focus:outline-none"
          />
          <IconButton label="Close search" size="sm" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="flex items-center justify-between border-b border-[#E5E2D9] bg-[#F5F2EA] px-4 py-1.5 text-[12px] text-[#5A6560]">
          <span>
            {isDemo
              ? 'Demo keyword search (not AI retrieval)'
              : degraded
                ? 'Semantic retrieval unavailable; keyword results shown'
                : 'Workspace retrieval search'}
          </span>
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                onAskAbout(query.trim());
                onClose();
              }}
              className="inline-flex items-center gap-1 font-medium text-[#102D2A] hover:underline cursor-pointer"
            >
              <span>Ask SUTRA about “{query.trim().slice(0, 32)}”</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E5E2D9]">
          {loading ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#5A6560]">
              Searching records…
            </div>
          ) : !query.trim() ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#5A6560]">
              Type a keyword, email ID (e.g. E005), thread key (e.g. THR-001), or topic.
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#5A6560]">
              No matching items in the available records.
            </div>
          ) : (
            (['thread', 'email', 'attachment', 'decision', 'action'] as const)
              .map((lvl) => ({
                level: lvl,
                hits: results.filter((r) => r.level === lvl),
              }))
              .filter((group) => group.hits.length > 0)
              .map((group) => (
                <div key={group.level}>
                  <div className="bg-[#F5F2EA]/70 px-4 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A6560]">
                    {LEVEL_LABELS[group.level]}s ({group.hits.length})
                  </div>
                  <div className="divide-y divide-[#E5E2D9]">
                    {group.hits.map((hit) => (
                      <div
                        key={hit.hit_id}
                        className="flex flex-col gap-1.5 px-4 py-3 hover:bg-[#E8EFEA]/60 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectHit(hit);
                            onClose();
                          }}
                          className="min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-[12px] text-[#5A6560]">
                            <span className="font-semibold text-[#102D2A]">
                              {LEVEL_LABELS[hit.level]}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums font-medium">{hit.thread_key}</span>
                          </div>
                          <p className="mt-0.5 truncate font-display text-[14px] font-semibold text-[#202B35]">
                            {hit.title}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[13px] text-[#5A6560]">
                            {hit.snippet}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAskAbout(hit.title, hit.thread_key);
                            onClose();
                          }}
                          className="shrink-0 self-start sm:self-center rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1 text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                        >
                          Ask SUTRA about this
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
