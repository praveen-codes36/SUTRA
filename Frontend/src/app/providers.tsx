import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { demoAdapter } from '../adapters/demoAdapter';
import { liveAdapter } from '../adapters/liveAdapter';
import type { AuthSessionUser, DataSource } from '../adapters/dataSource';
import { env, type DataMode } from '../config/env';
import { DEMO_DATASET } from '../data/demoData';
import { usePrefs } from '../hooks/usePrefs';
import { SutraApiError } from '../services/apiClient';
import { ToastViewport, type ToastItem } from '../components/ui/Toast';
import type { HealthStatus, Persona } from '../types/api';

const MODE_STORAGE_KEY = 'sutra.mode.v1';
const PERSONA_STORAGE_KEY = 'sutra.demoPersona.v1';

interface SutraContextValue {
  mode: DataMode;
  setMode: (next: DataMode) => void;
  dataSource: DataSource;
  persona: Persona | null;
  selectPersona: (persona: Persona | null) => void;
  liveUser: AuthSessionUser | null;
  setLiveUser: (user: AuthSessionUser | null) => void;
  authChecking: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  health: HealthStatus | null;
  healthError: SutraApiError | null;
  healthChecking: boolean;
  refreshHealth: () => Promise<void>;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

const SutraContext = createContext<SutraContextValue | null>(null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function loadInitialMode(): DataMode {
  if (!env.ALLOW_MODE_SWITCH || typeof window === 'undefined') {
    return env.DATA_MODE;
  }
  const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
  return saved === 'live' || saved === 'demo' ? saved : env.DATA_MODE;
}

function loadInitialPersona(): Persona | null {
  if (typeof window === 'undefined') return null;
  const savedId = window.localStorage.getItem(PERSONA_STORAGE_KEY);
  if (!savedId) return null;
  return DEMO_DATASET.personas.find((p) => p.persona_id === savedId) || null;
}

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { prefs } = usePrefs();
  const [mode, setModeState] = useState<DataMode>(loadInitialMode);
  const [persona, setPersonaState] = useState<Persona | null>(loadInitialPersona);
  const [liveUser, setLiveUser] = useState<AuthSessionUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(mode === 'live');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<SutraApiError | null>(null);
  const [healthChecking, setHealthChecking] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Sync demoAdapter persona synchronously during render/effect
  useEffect(() => {
    demoAdapter.setPersona(mode === 'demo' ? persona : null);
  }, [mode, persona]);

  // Apply preference classes to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('density-compact', prefs.density === 'compact');
    root.classList.toggle('density-comfortable', prefs.density !== 'compact');
    root.classList.toggle('reduced-motion', prefs.reducedMotionOverride);
  }, [prefs.density, prefs.reducedMotionOverride]);

  const dataSource: DataSource = mode === 'live' ? liveAdapter : demoAdapter;

  const refreshHealth = useCallback(async () => {
    setHealthChecking(true);
    setHealthError(null);
    try {
      const h = await dataSource.health();
      setHealth(h);
    } catch (err) {
      setHealth(null);
      if (err instanceof SutraApiError) {
        setHealthError(err);
      } else {
        setHealthError(
          new SutraApiError({
            code: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Unable to reach backend.',
          }),
        );
      }
    } finally {
      setHealthChecking(false);
    }
  }, [dataSource]);

  const refreshAuth = useCallback(async () => {
    if (mode !== 'live') {
      setAuthChecking(false);
      return;
    }
    setAuthChecking(true);
    try {
      const user = await liveAdapter.authMe();
      setLiveUser(user);
      setHealthError(null);
    } catch (err) {
      setLiveUser(null);
      if (err instanceof SutraApiError && err.code !== 'AUTH_REQUIRED') {
        setHealthError(err);
      }
    } finally {
      setAuthChecking(false);
    }
  }, [mode]);

  useEffect(() => {
    void refreshHealth();
    if (mode === 'live') {
      void refreshAuth();
    } else {
      setAuthChecking(false);
    }
  }, [mode, refreshHealth, refreshAuth]);

  const setMode = useCallback((next: DataMode) => {
    if (!env.ALLOW_MODE_SWITCH) return;
    setHealth(null);
    setHealthError(null);
    if (next === 'live') {
      setAuthChecking(true);
      setHealthChecking(true);
    } else {
      setAuthChecking(false);
    }
    setModeState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    }
    queryClient.clear();
  }, []);

  const selectPersona = useCallback((next: Persona | null) => {
    setPersonaState(next);
    demoAdapter.setPersona(next);
    if (typeof window !== 'undefined') {
      if (next) {
        window.localStorage.setItem(PERSONA_STORAGE_KEY, next.persona_id);
      } else {
        window.localStorage.removeItem(PERSONA_STORAGE_KEY);
      }
    }
    queryClient.clear();
  }, []);

  const signOut = useCallback(async () => {
    if (mode === 'live') {
      try {
        await liveAdapter.authLogout();
      } catch {
        // Ignore logout network error and clear local user state
      }
      setLiveUser(null);
    } else {
      selectPersona(null);
    }
    queryClient.clear();
  }, [mode, selectPersona]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const value = useMemo<SutraContextValue>(
    () => ({
      mode,
      setMode,
      dataSource,
      persona,
      selectPersona,
      liveUser,
      setLiveUser,
      authChecking,
      refreshAuth,
      signOut,
      health,
      healthError,
      healthChecking,
      refreshHealth,
      addToast,
      commandPaletteOpen,
      setCommandPaletteOpen,
    }),
    [
      mode,
      setMode,
      dataSource,
      persona,
      selectPersona,
      liveUser,
      authChecking,
      refreshAuth,
      signOut,
      health,
      healthError,
      healthChecking,
      refreshHealth,
      addToast,
      commandPaletteOpen,
    ],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={prefs.reducedMotionOverride ? 'always' : 'user'}>
        <SutraContext.Provider value={value}>
          {children}
          <ToastViewport toasts={toasts} onDismiss={dismissToast} />
        </SutraContext.Provider>
      </MotionConfig>
    </QueryClientProvider>
  );
};

export function useSutra(): SutraContextValue {
  const ctx = useContext(SutraContext);
  if (!ctx) {
    throw new Error('useSutra must be used within AppProviders');
  }
  return ctx;
}
