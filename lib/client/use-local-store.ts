"use client";

import { useCallback, useSyncExternalStore } from "react";

const SAME_TAB = "arthdex:store";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(SAME_TAB, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SAME_TAB, callback);
  };
}

const memoryCache = new Map<string, { raw: string | null; parsed: unknown }>();

export function useLocalStore<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const getSnapshot = useCallback((): T => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      const cached = memoryCache.get(key);
      if (cached && cached.raw === raw) {
        return cached.parsed as T;
      }
      if (raw === null) {
        memoryCache.set(key, { raw: null, parsed: initial });
        return initial;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(initial) && !Array.isArray(parsed)) {
        memoryCache.set(key, { raw, parsed: initial });
        return initial;
      }
      memoryCache.set(key, { raw, parsed });
      return parsed as T;
    } catch {
      return initial;
    }
  }, [key, initial]);

  const getServerSnapshot = useCallback((): T => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = getSnapshot();
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(current) : next;
      try {
        const raw = JSON.stringify(resolved);
        window.localStorage.setItem(key, raw);
        memoryCache.set(key, { raw, parsed: resolved });
      } catch {
        // Quota or private mode
      }
      window.dispatchEvent(new CustomEvent(SAME_TAB, { detail: key }));
    },
    [key, getSnapshot],
  );

  return [value, set, true];
}
