"use client";

import type { WatchKind } from "./watchlist";

export interface SnapshotListed {
  id: string;
  price: number;
  changePct: number;
  previousClose: number;
}

export interface SnapshotUnlisted {
  id: string;
  price: number | null;
  name: string;
  sector: string | null;
}

export interface Snapshot {
  listed: SnapshotListed[];
  unlisted: SnapshotUnlisted[];
  unlistedReady: boolean;
}

export interface Target {
  kind: WatchKind;
  id: string;
}

/** Latest prices for a set of watched names. Returns null when the data service is unreachable. */
export async function fetchSnapshot(targets: Target[], signal?: AbortSignal): Promise<Snapshot | null> {
  const listed = [...new Set(targets.filter((t) => t.kind === "listed").map((t) => t.id))];
  const unlisted = [...new Set(targets.filter((t) => t.kind === "unlisted").map((t) => t.id))];
  if (listed.length === 0 && unlisted.length === 0) return { listed: [], unlisted: [], unlistedReady: true };
  try {
    const res = await fetch("/api/watchlist/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listed, unlisted }),
      signal,
    });
    if (!res.ok) return null;
    return ((await res.json()) as { data: Snapshot }).data;
  } catch {
    return null;
  }
}
