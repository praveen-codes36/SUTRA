import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquareText,
  Scale,
  Settings,
  Upload,
  X,
} from 'lucide-react';
import { Wordmark } from '../brand/Wordmark';
import { getFocusableElements, getInitials, trapFocusOnKeyDown } from '../../lib/a11y';
import type { DataMode } from '../../config/env';
import type { HealthStatus } from '../../types/api';

interface NavEntry {
  to: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
}

const NAV_ITEMS: NavEntry[] = [
  { to: '/app/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/app/emails', label: 'Email Explorer', icon: Mail },
  { to: '/app/threads', label: 'Thread Intelligence', icon: GitBranch },
  { to: '/app/ask', label: 'Ask SUTRA', icon: MessageSquareText },
  { to: '/app/decisions', label: 'Decisions', icon: Scale },
  { to: '/app/actions', label: 'Action Tracker', icon: CheckSquare },
  { to: '/app/import', label: 'Data Ingestion', icon: Upload },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  mode: DataMode;
  workspaceName: string;
  userName: string;
  userRole: string;
  health: HealthStatus | null;
  healthError: boolean;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  mode,
  workspaceName,
  userName,
  userRole,
  health,
  healthError,
  onSignOut,
}) => {
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const onCloseMobileRef = useRef(onCloseMobile);
  onCloseMobileRef.current = onCloseMobile;

  useEffect(() => {
    if (!mobileOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      if (mobileDrawerRef.current) {
        const focusables = getFocusableElements(mobileDrawerRef.current);
        if (focusables.length > 0) focusables[0].focus();
        else mobileDrawerRef.current.focus();
      }
    }, 10);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseMobileRef.current();
      } else {
        trapFocusOnKeyDown(e, mobileDrawerRef.current);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      prevFocusRef.current?.focus();
    };
  }, [mobileOpen]);

  const statusLabel =
    mode === 'demo'
      ? 'Demo dataset'
      : healthError || !health
        ? 'Backend unreachable'
        : health.status === 'ok'
          ? 'Backend ready'
          : `Backend ${health.status}`;

  const renderContent = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;
    return (
      <div
        data-surface="dark"
        className="surface-dark flex h-full flex-col bg-[#102D2A] text-[#F5F2EA]"
      >
        {/* Brand header */}
        <div
          className={`flex items-center border-b border-[#1B4A45] px-4 py-4 ${
            isCompact ? 'justify-center' : 'justify-between'
          }`}
        >
          <NavLink
            to="/app/overview"
            onClick={isMobileDrawer ? onCloseMobile : undefined}
            aria-label="SUTRA Workspace Overview"
            className="inline-flex items-center rounded-[4px]"
          >
            <Wordmark variant="onDark" showDevanagari={!isCompact} compact={isCompact} size="md" />
          </NavLink>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[4px] text-[#F5F2EA] hover:bg-[#1B4A45] cursor-pointer"
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-[#B8C4BE] hover:bg-[#1B4A45] hover:text-[#F5F2EA] cursor-pointer"
            >
              {collapsed ? (
                <ChevronRight size={16} aria-hidden="true" />
              ) : (
                <ChevronLeft size={16} aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {/* Read-only workspace chip */}
        {!isCompact && (
          <div className="border-b border-[#1B4A45] px-4 py-3">
            <div className="text-[11px] font-medium text-[#B8C4BE]">Workspace</div>
            <div
              title={workspaceName}
              className="mt-0.5 truncate font-display text-[13px] font-semibold text-[#F5F2EA]"
            >
              {workspaceName}
            </div>
          </div>
        )}

        {/* Navigation links */}
        <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={isMobileDrawer ? onCloseMobile : undefined}
                    title={isCompact ? item.label : undefined}
                    aria-label={isCompact ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-[13px] font-display font-medium transition-colors duration-150 ${
                        isCompact ? 'justify-center px-2' : ''
                      } ${
                        isActive
                          ? 'border-l-[3px] border-[#D5B77B] bg-[#1B4A45] text-[#F5F2EA]'
                          : 'border-l-[3px] border-transparent text-[#B8C4BE] hover:bg-[#1B4A45]/60 hover:text-[#F5F2EA]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={17}
                          className={`shrink-0 ${isActive ? 'text-[#D5B77B]' : 'text-[#B8C4BE]'}`}
                          aria-hidden={true}
                        />
                        {!isCompact && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom user & status */}
        <div className="border-t border-[#1B4A45] p-3">
          <div className={`flex items-center gap-2.5 ${isCompact ? 'justify-center' : ''}`}>
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[#D5B77B]/60 bg-[#1B4A45] font-display text-[12px] font-bold text-[#F5F2EA]"
            >
              {getInitials(userName)}
            </span>
            {!isCompact && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#F5F2EA]">{userName}</p>
                <p className="truncate text-[11px] text-[#B8C4BE]">
                  {userRole} · {statusLabel}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className={`mt-3 flex w-full items-center gap-2 rounded-[4px] border border-[#1B4A45] px-3 py-2 text-[13px] font-medium text-[#B8C4BE] hover:bg-[#1B4A45] hover:text-[#F5F2EA] cursor-pointer ${
              isCompact ? 'justify-center px-2' : ''
            }`}
          >
            <LogOut size={15} className="shrink-0" aria-hidden="true" />
            {!isCompact && <span>Sign out</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop rail */}
      <aside
        aria-label="Primary sidebar"
        className={`hidden lg:block shrink-0 border-r border-[#1B4A45] transition-[width] duration-150 ${
          collapsed ? 'w-[72px]' : 'w-[256px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderContent(false)}</div>
      </aside>

      {/* Mobile / tablet slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#102D2A]/50"
            aria-hidden="true"
            onClick={onCloseMobile}
          />
          <aside
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation drawer"
            tabIndex={-1}
            className="relative z-10 h-full w-[280px] max-w-[85vw] shadow-[var(--shadow-overlay)] focus:outline-none"
          >
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
