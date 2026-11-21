import React, { Suspense, lazy } from 'react';
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { useSutra } from './providers';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { Skeleton } from '../components/ui/Skeleton';
import { env } from '../config/env';

const LandingPage = lazy(() => import('../pages/LandingPage'));
const SignInPage = lazy(() => import('../pages/SignInPage'));
const OverviewPage = lazy(() => import('../pages/OverviewPage'));
const EmailExplorerPage = lazy(() => import('../pages/EmailExplorerPage'));
const ThreadListPage = lazy(() => import('../pages/ThreadListPage'));
const ThreadDetailPage = lazy(() => import('../pages/ThreadDetailPage'));
const AskSutraPage = lazy(() => import('../pages/AskSutraPage'));
const DecisionsPage = lazy(() => import('../pages/DecisionsPage'));
const ActionsPage = lazy(() => import('../pages/ActionsPage'));
const ImportPage = lazy(() => import('../pages/ImportPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const EvaluationPage = lazy(() => import('../pages/EvaluationPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

const PageFallback: React.FC = () => (
  <div className="mx-auto max-w-[960px] space-y-4 p-4 sm:p-6">
    <Skeleton className="h-7 w-48" />
    <Skeleton lines={4} />
  </div>
);

const WorkspaceGuard: React.FC = () => {
  const { mode, persona, liveUser, authChecking, healthError } = useSutra();

  if (mode === 'demo') {
    if (!persona) {
      return <Navigate to="/signin" replace />;
    }
    return (
      <WorkspaceShell>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </WorkspaceShell>
    );
  }

  const showLiveOffline =
    healthError !== null &&
    (healthError.code === 'NETWORK_ERROR' ||
      healthError.code === 'TIMEOUT' ||
      healthError.code === 'DEPENDENCY_UNAVAILABLE' ||
      healthError.code === 'UPSTREAM_TIMEOUT');

  if (authChecking) {
    return (
      <WorkspaceShell>
        <PageFallback />
      </WorkspaceShell>
    );
  }

  if (showLiveOffline) {
    return (
      <WorkspaceShell>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </WorkspaceShell>
    );
  }

  if (!liveUser) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <WorkspaceShell>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </WorkspaceShell>
  );
};

export const AppRouter: React.FC = () => {
  const Router = env.ROUTER_MODE === 'browser' ? BrowserRouter : HashRouter;

  return (
    <Router>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<SignInPage />} />

          <Route path="/app" element={<WorkspaceGuard />}>
            <Route index element={<Navigate to="/app/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="emails" element={<EmailExplorerPage />} />
            <Route path="threads" element={<ThreadListPage />} />
            <Route path="threads/:threadId" element={<ThreadDetailPage />} />
            <Route path="ask" element={<AskSutraPage />} />
            <Route path="decisions" element={<DecisionsPage />} />
            <Route path="actions" element={<ActionsPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="evaluation" element={<EvaluationPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
};
