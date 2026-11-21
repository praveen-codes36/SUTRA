import { useCallback, useEffect, useState } from 'react';
import type { AmountDisplayPref } from '../lib/format';

export type DensityPref = 'comfortable' | 'compact';

export interface UserPrefs {
  density: DensityPref;
  showUtc: boolean;
  amountDisplay: AmountDisplayPref;
  reducedMotionOverride: boolean;
  enable3D: boolean;
  sidebarCollapsed: boolean;
}

const STORAGE_KEY = 'sutra.prefs.v1';

const DEFAULT_PREFS: UserPrefs = {
  density: 'comfortable',
  showUtc: false,
  amountDisplay: 'both',
  reducedMotionOverride: false,
  enable3D: true,
  sidebarCollapsed: false,
};

function loadPrefs(): UserPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return {
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      showUtc: Boolean(parsed.showUtc),
      amountDisplay:
        parsed.amountDisplay === 'original' ||
        parsed.amountDisplay === 'normalised' ||
        parsed.amountDisplay === 'both'
          ? parsed.amountDisplay
          : 'both',
      reducedMotionOverride: Boolean(parsed.reducedMotionOverride),
      enable3D: parsed.enable3D === undefined ? true : Boolean(parsed.enable3D),
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

type Listener = (prefs: UserPrefs) => void;
const listeners = new Set<Listener>();
let memoryPrefs: UserPrefs = loadPrefs();

function notify(next: UserPrefs) {
  memoryPrefs = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  listeners.forEach((fn) => fn(next));
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<UserPrefs>(() => memoryPrefs);

  useEffect(() => {
    const listener: Listener = (next) => setPrefs(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const updatePref = useCallback(<K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    notify({ ...memoryPrefs, [key]: value });
  }, []);

  const resetPrefs = useCallback(() => {
    notify(DEFAULT_PREFS);
  }, []);

  return { prefs, updatePref, resetPrefs };
}
