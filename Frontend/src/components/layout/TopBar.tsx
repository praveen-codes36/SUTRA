import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu, Search, User } from 'lucide-react';
import { Breadcrumbs, type BreadcrumbItem } from '../ui/Breadcrumbs';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';
import type { DataMode } from '../../config/env';
import type { HealthStatus } from '../../types/api';

export interface TopBarFailedJobNotice {
  job_id: string;
  rows_failed: number;
}

export interface TopBarProps {
  breadcrumbs: BreadcrumbItem[];
  onOpenMobileNav: () => void;
  onOpenSearch: () => void;
  mode: DataMode;
  userName: string;
  userRole: string;
  health: HealthStatus | null;
  healthError: boolean;
  pendingReviewCount?: number;
  failedJobs?: TopBarFailedJobNotice[];
  onSignOut: () => void;
}

interface RealNotice {
  id: string;
  title: string;
  detail: string;
  to?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  breadcrumbs,
  onOpenMobileNav,
  onOpenSearch,
  mode,
  userName,
  userRole,
  health,
  healthError,
  pendingReviewCount = 0,
  failedJobs = [],
  onSignOut,
}) => {
  const notices = useMemo<RealNotice[]>(() => {
    const items: RealNotice[] = [];
    if (mode === 'live' && (healthError || (health && health.status !== 'ok'))) {
      items.push({
        id: 'health',
        title: 'Backend status requires attention',
        detail: health ? `Health reported: ${health.status}` : 'Health check unreachable.',
        to: '/app/settings',
      });
    }
    if (pendingReviewCount > 0) {
      items.push({
        id: 'decisions-review',
        title: `${pendingReviewCount} decision${pendingReviewCount === 1 ? '' : 's'} flagged for review`,
        detail: 'Inspect in Decisions ledger.',
        to: '/app/decisions',
      });
    }
    if (failedJobs.length > 0) {
      items.push({
        id: 'ingestion-errors',
        title: 'Ingestion job has failed records',
        detail: `Job ${failedJobs[0].job_id} reported ${failedJobs[0].rows_failed} failed rows.`,
        to: '/app/import',
      });
    }
    return items;
  }, [mode, health, healthError, pendingReviewCount, failedJobs]);

  return (
    <header className="sticky top-0 z-30 flex min-h-[56px] items-center justify-between gap-4 border-b border-[#E5E2D9] bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <IconButton
          label="Open navigation menu"
          onClick={onOpenMobileNav}
          className="lg:hidden"
        >
          <Menu size={19} aria-hidden="true" />
        </IconButton>
        <Breadcrumbs items={breadcrumbs} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open global workspace search (Ctrl+K or Cmd+K)"
          className="inline-flex min-h-[44px] min-w-[44px] lg:min-h-[38px] lg:min-w-0 items-center justify-center gap-2 rounded-[4px] border border-[#7B8581] bg-[#F5F2EA]/60 px-3 py-1.5 text-[13px] text-[#5A6560] hover:border-[#102D2A] hover:text-[#102D2A] cursor-pointer"
        >
          <Search size={15} aria-hidden="true" />
          <span className="hidden sm:inline whitespace-nowrap">Search workspace…</span>
          <kbd className="hidden md:inline-block rounded-[4px] border border-[#E5E2D9] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#5A6560]">
            ⌘K
          </kbd>
        </button>

        <Popover
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={`Workspace notices (${notices.length})`}
              className="relative inline-flex h-11 w-11 lg:h-10 lg:w-10 items-center justify-center rounded-[4px] text-[#202B35] hover:bg-[#E8EFEA] hover:text-[#102D2A] cursor-pointer"
            >
              <Bell size={18} aria-hidden="true" />
              {notices.length > 0 && (
                <span className="sr-only">{notices.length} active notices</span>
              )}
            </button>
          )}
        >
          <div className="text-[13px]">
            <div className="border-b border-[#E5E2D9] pb-2 font-display font-semibold text-[#102D2A]">
              Workspace notices
            </div>
            {notices.length === 0 ? (
              <p className="py-3 text-[13px] text-[#5A6560]">No notices</p>
            ) : (
              <ul className="divide-y divide-[#E5E2D9]">
                {notices.map((n) => (
                  <li key={n.id} className="py-2.5">
                    <p className="font-medium text-[#202B35]">{n.title}</p>
                    <p className="mt-0.5 text-[12px] text-[#5A6560]">{n.detail}</p>
                    {n.to && (
                      <Link
                        to={n.to}
                        className="mt-1 inline-block text-[12px] font-medium text-[#102D2A] underline"
                      >
                        Open view
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Popover>

        <Popover
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label="User menu"
              className="inline-flex h-11 min-w-[44px] lg:h-10 lg:min-w-0 items-center justify-center gap-2 rounded-[4px] px-2.5 text-[13px] font-medium text-[#202B35] hover:bg-[#E8EFEA] hover:text-[#102D2A] cursor-pointer"
            >
              <User size={17} aria-hidden="true" />
              <span className="hidden md:inline max-w-[160px] truncate">{userName}</span>
            </button>
          )}
        >
          <div className="flex flex-col gap-2 text-[13px]">
            <div className="border-b border-[#E5E2D9] pb-2">
              <p className="font-display font-semibold text-[#102D2A]">{userName}</p>
              <p className="text-[12px] text-[#5A6560]">{userRole}</p>
            </div>
            <Link
              to="/app/settings"
              className="rounded-[4px] px-2 py-1.5 text-[#202B35] hover:bg-[#E8EFEA] hover:text-[#102D2A]"
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-[4px] px-2 py-1.5 text-left text-[#A3342B] hover:bg-[#F9E4E1] cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </Popover>
      </div>
    </header>
  );
};
