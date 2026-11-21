import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useSutra } from '../../app/providers';
import type { SearchHit } from '../../adapters/dataSource';
import { env } from '../../config/env';
import { useDebounce } from '../../hooks/useDebounce';
import { usePrefs } from '../../hooks/usePrefs';
import { decisionService } from '../../services/decisionService';
import { ingestionService } from '../../services/ingestionService';
import { intelligenceService } from '../../services/intelligenceService';
import { ModeBanner } from '../evidence/ModeBanner';
import { CommandPalette } from '../ui/CommandPalette';
import { ServiceUnavailable } from '../ui/ServiceUnavailable';
import type { BreadcrumbItem } from '../ui/Breadcrumbs';
import { ErrorBoundary } from './ErrorBoundary';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const base: BreadcrumbItem[] = [{ label: 'Workspace', to: '/app/overview' }];
  if (pathname.startsWith('/app/overview')) return [...base, { label: 'Overview' }];
  if (pathname.startsWith('/app/emails')) return [...base, { label: 'Email Explorer' }];
  if (pathname.startsWith('/app/threads/')) {
    const threadId = decodeURIComponent(pathname.replace('/app/threads/', ''));
    return [
      ...base,
      { label: 'Thread Intelligence', to: '/app/threads' },
      { label: threadId },
    ];
  }
  if (pathname.startsWith('/app/threads')) return [...base, { label: 'Thread Intelligence' }];
  if (pathname.startsWith('/app/ask')) return [...base, { label: 'Ask SUTRA' }];
  if (pathname.startsWith('/app/decisions')) return [...base, { label: 'Decisions' }];
  if (pathname.startsWith('/app/actions')) return [...base, { label: 'Action Tracker' }];
  if (pathname.startsWith('/app/import')) return [...base, { label: 'Data Ingestion' }];
  if (pathname.startsWith('/app/settings')) return [...base, { label: 'Settings' }];
  if (pathname.startsWith('/app/evaluation')) return [...base, { label: 'Evaluation' }];
  return base;
}

export interface WorkspaceShellProps {
  children: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { prefs, updatePref } = usePrefs();
  const {
    mode,
    setMode,
    dataSource,
    persona,
    liveUser,
    signOut,
    health,
    healthError,
    healthChecking,
    refreshHealth,
    commandPaletteOpen,
    setCommandPaletteOpen,
  } = useSutra();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 200);

  // Global Cmd/Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const searchResult = useQuery({
    queryKey: ['globalSearch', mode, persona?.persona_id ?? 'live', debouncedQuery],
    queryFn: ({ signal }) => intelligenceService.search(dataSource, debouncedQuery, signal),
    enabled: commandPaletteOpen && debouncedQuery.trim().length > 0,
  });

  const noticesEnabled = mode === 'demo' || Boolean(liveUser);

  const pendingDecisionsNoticeQuery = useQuery({
    queryKey: ['workspaceNotices', 'decisions', mode, persona?.persona_id ?? 'live'],
    queryFn: async () => {
      try {
        const res = await decisionService.list(dataSource, { limit: 50 });
        return res.items.filter((d) => d.review_state === 'PENDING').length;
      } catch {
        return 0;
      }
    },
    enabled: noticesEnabled,
    staleTime: 60_000,
  });

  const failedJobsNoticeQuery = useQuery({
    queryKey: ['workspaceNotices', 'jobs', mode, persona?.persona_id ?? 'live'],
    queryFn: async () => {
      try {
        const jobs = await ingestionService.listJobs(dataSource);
        return jobs
          .filter(
            (j) =>
              j.status === 'FAILED' ||
              j.status === 'COMPLETED_WITH_ERRORS' ||
              j.counts.rows_failed > 0,
          )
          .map((j) => ({ job_id: j.job_id, rows_failed: j.counts.rows_failed }));
      } catch {
        return [];
      }
    },
    enabled: noticesEnabled,
    staleTime: 60_000,
  });

  const breadcrumbs = useMemo(() => buildBreadcrumbs(location.pathname), [location.pathname]);

  const userName =
    mode === 'demo'
      ? persona?.display_name || 'Demo User'
      : liveUser?.display_name || 'Not signed in';
  const userRole =
    mode === 'demo' ? persona?.role_code || 'DEMO' : liveUser?.role_code || 'Unauthenticated';
  const workspaceName =
    mode === 'demo'
      ? 'Northbridge — demo workspace'
      : liveUser?.workspace_name || 'Live backend (unconnected)';

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleSelectHit = (hit: SearchHit) => {
    if ((hit.level === 'email' || hit.level === 'attachment') && hit.email_id) {
      const params = new URLSearchParams({ email: hit.email_id });
      if (hit.attachment_id) params.set('attachment', hit.attachment_id);
      navigate(`/app/emails?${params.toString()}`);
    } else if (hit.level === 'decision') {
      navigate(`/app/decisions?thread=${encodeURIComponent(hit.thread_key)}`);
    } else if (hit.level === 'action') {
      navigate(`/app/actions?thread=${encodeURIComponent(hit.thread_key)}`);
    } else {
      navigate(`/app/threads/${encodeURIComponent(hit.thread_key)}`);
    }
  };

  const handleAskAbout = (text: string, threadKey?: string) => {
    const params = new URLSearchParams();
    if (threadKey) params.set('thread', threadKey);
    if (text) params.set('q', text);
    navigate(`/app/ask?${params.toString()}`);
  };

  const showLiveOffline =
    mode === 'live' &&
    healthError !== null &&
    (healthError.code === 'NETWORK_ERROR' ||
      healthError.code === 'TIMEOUT' ||
      healthError.code === 'DEPENDENCY_UNAVAILABLE' ||
      healthError.code === 'UPSTREAM_TIMEOUT');

  return (
    <div className="flex min-h-screen bg-[#F5F2EA] text-[#202B35]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        collapsed={prefs.sidebarCollapsed}
        onToggleCollapse={() => updatePref('sidebarCollapsed', !prefs.sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        mode={mode}
        workspaceName={workspaceName}
        userName={userName}
        userRole={userRole}
        health={health}
        healthError={Boolean(healthError)}
        onSignOut={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {mode === 'demo' && (
          <ModeBanner
            personaLabel={
              persona
                ? `${persona.display_name} (${persona.role_code})`
                : undefined
            }
          />
        )}

        <TopBar
          breadcrumbs={breadcrumbs}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenSearch={() => setCommandPaletteOpen(true)}
          mode={mode}
          userName={userName}
          userRole={userRole}
          health={health}
          healthError={Boolean(healthError)}
          pendingReviewCount={pendingDecisionsNoticeQuery.data ?? 0}
          failedJobs={failedJobsNoticeQuery.data ?? []}
          onSignOut={handleSignOut}
        />

        <main id="main-content" tabIndex={-1} className="min-w-0 w-full flex-1 p-4 sm:p-6 focus:outline-none">
          <ErrorBoundary routeKey={location.pathname + location.search}>
            {showLiveOffline ? (
              <div className="mx-auto max-w-[780px] py-6">
                <ServiceUnavailable
                  baseUrl={env.API_BASE_URL}
                  healthStatus={health}
                  errorMessage={healthError?.message}
                  requestId={healthError?.requestId}
                  checking={healthChecking}
                  onRetry={() => void refreshHealth()}
                  onSwitchToDemo={
                    env.ALLOW_MODE_SWITCH ? () => setMode('demo') : undefined
                  }
                />
              </div>
            ) : (
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            )}
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        results={searchResult.data?.items || []}
        loading={searchResult.isFetching}
        degraded={searchResult.data?.degraded}
        isDemo={mode === 'demo'}
        onSelectHit={handleSelectHit}
        onAskAbout={handleAskAbout}
      />
    </div>
  );
};
