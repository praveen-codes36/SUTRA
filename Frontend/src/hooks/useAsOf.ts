import { useMemo } from 'react';
import { DEMO_DATASET } from '../data/demoData';
import type { DataMode } from '../config/env';

export function useAsOf(mode: DataMode, serverAsOf?: string | null): string {
  return useMemo(() => {
    if (mode === 'demo') {
      return DEMO_DATASET.meta.as_of;
    }
    return serverAsOf || new Date().toISOString();
  }, [mode, serverAsOf]);
}
