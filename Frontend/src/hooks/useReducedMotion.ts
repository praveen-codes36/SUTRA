import { useEffect, useState } from 'react';
import { usePrefs } from './usePrefs';

export function useReducedMotion(): boolean {
  const { prefs } = usePrefs();
  const [systemReduced, setSystemReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setSystemReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return prefs.reducedMotionOverride || systemReduced;
}
