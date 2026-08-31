'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'pos:hide-amounts';

/**
 * Local-only "hide monetary amounts" toggle. Persisted in localStorage
 * so refreshing the dashboard never accidentally exposes the values
 * the operator was actively hiding. The hook is intentionally SSR-safe
 * by lazily reading from localStorage inside an effect.
 */
export function useHideAmounts() {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === '1') setHide(true);
    } catch {
      /* localStorage may be disabled (private mode) - silently ignore. */
    }
  }, []);

  const toggle = useCallback(() => {
    setHide((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { hide, toggle };
}