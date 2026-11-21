import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const value = searchParams.get(String(key));
      if (value !== null) {
        result[key] = value as T[keyof T];
      }
    }
    return result;
  }, [defaults, searchParams]);

  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === defaults[key]) {
            next.delete(String(key));
          } else {
            next.set(String(key), value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [defaults, setSearchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<T>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (!v || v === defaults[k]) {
              next.delete(k);
            } else {
              next.set(k, String(v));
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [defaults, setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of Object.keys(defaults)) {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }, [defaults, setSearchParams]);

  return { filters, setFilter, setFilters, clearFilters };
}
