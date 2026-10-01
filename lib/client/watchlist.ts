"use client";

import { useCallback } from "react";
import { useLocalStore } from "./use-local-store";

export type WatchKind = "listed" | "unlisted";

export interface WatchItem {
  kind: WatchKind;
  /** NSE symbol for listed names, directory id for unlisted ones. */
  id: string;
  name: string;
  addedAt: string;
}

const KEY = "arthdex:watchlist:v1";
const EMPTY: WatchItem[] = [];

export function useWatchlist() {
  const [items, setItems, ready] = useLocalStore<WatchItem[]>(KEY, EMPTY);

  const has = useCallback((kind: WatchKind, id: string) => items.some((i) => i.kind === kind && i.id === id), [items]);

  const toggle = useCallback(
    (kind: WatchKind, id: string, name: string) => {
      setItems((prev) =>
        prev.some((i) => i.kind === kind && i.id === id)
          ? prev.filter((i) => !(i.kind === kind && i.id === id))
          : [...prev, { kind, id, name, addedAt: new Date().toISOString() }],
      );
    },
    [setItems],
  );

  const remove = useCallback(
    (kind: WatchKind, id: string) => setItems((prev) => prev.filter((i) => !(i.kind === kind && i.id === id))),
    [setItems],
  );

  return { items, has, toggle, remove, ready };
}
