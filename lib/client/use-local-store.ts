"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * State persisted in localStorage and kept in sync across tabs and components.
 *
 * Reads happen after mount, so server and client markup match on first render.
 * Every write also dispatches a same-tab event, because the native `storage`
 * event only fires in other tabs.
 */
const SAME_TAB = "arthdex:store";

export function useLocalStore<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  const read = useCallback((): T => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as unknown;
      // A value of the wrong shape (an older format, or edited by hand) falls back to the default
      if (Array.isArray(initial) && !Array.isArray(parsed)) return initial;
      return parsed as T;
    } catch {
      return initial;
    }
    // `initial` is a stable default; depending on its identity would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    setValue(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(read());
    };
    const onSameTab = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setValue(read());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SAME_TAB, onSameTab);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SAME_TAB, onSameTab);
    };
  }, [key, read]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(read()) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Private mode or a full quota: keep the in-memory value so the UI still works
      }
      setValue(resolved);
      window.dispatchEvent(new CustomEvent(SAME_TAB, { detail: key }));
    },
    [key, read],
  );

  return [value, set, ready];
}
