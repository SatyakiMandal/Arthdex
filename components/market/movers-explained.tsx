"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, FlaskConical, Newspaper, SearchX } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, formatINR, formatPct } from "@/lib/utils";
import type { ApiMoverExplained } from "@/lib/api/types";

type Side = "gainers" | "losers";

const SIDES = [
  { id: "gainers" as const, label: "Gainers" },
  { id: "losers" as const, label: "Losers" },
];

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/**
 * Today's biggest movers next to the filings and headlines that name them.
 * A headline is a candidate explanation, not proof, and the panel says so.
 */
export function MoversExplained({ gainers, losers }: { gainers: ApiMoverExplained[]; losers: ApiMoverExplained[] }) {
  const [side, setSide] = useState<Side>("gainers");
  const rows = side === "gainers" ? gainers : losers;
  const explained = rows.filter((r) => r.news.length > 0).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Why they moved</h2>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {explained} of {rows.length} have a filing or headline naming them
          </p>
        </div>
        <SegmentedControl options={SIDES} value={side} onChange={setSide} layoutGroupId="explained-side" />
      </header>

      <ul className="divide-y divide-border/60">
        {rows.map((r) => (
          <li key={r.symbol} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link href={`/company/${r.symbol}`} className="font-mono text-sm font-semibold hover:text-accent">
                  {r.symbol}
                </Link>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">₹{formatINR(r.cmp, r.cmp < 100 ? 2 : 0)}</span>
                <span className={cn("font-mono text-xs font-semibold tabular-nums", r.changePct >= 0 ? "text-up" : "text-down")}>
                  {formatPct(r.changePct, 2)}
                </span>
                {r.labels.map((l) => (
                  <span key={l} className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-2xs text-accent">
                    {l}
                  </span>
                ))}
              </div>
              <Link
                href={`/analyzer?company=${encodeURIComponent(r.name ?? r.symbol)}&ticker=${encodeURIComponent(`${r.symbol}.NS`)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-2xs font-medium text-muted-foreground transition-all hover:border-accent/50 hover:text-accent active:scale-95"
              >
                <FlaskConical className="h-3 w-3" />
                Analyze in depth
              </Link>
            </div>

            {r.news.length === 0 ? (
              <p className="mt-2 flex items-start gap-2 text-2xs text-muted-foreground">
                <SearchX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                No filing or headline names this stock today. The move may come from trading flow, its sector, or news not yet
                indexed.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {r.news.map((n) => (
                  <li key={n.headline} className="flex items-start gap-2 text-sm">
                    <Newspaper className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", n.kind === "filing" ? "text-accent" : "text-muted-foreground")} />
                    <span className="min-w-0">
                      {n.url ? (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1 hover:text-accent">
                          <span>{n.headline}</span>
                          <ArrowUpRight className="mt-1 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                      ) : (
                        n.headline
                      )}
                      <span className="ml-2 text-2xs text-muted-foreground">
                        {n.kind === "filing" ? "Exchange filing" : n.source}
                        {n.publishedAt ? ` · ${ago(n.publishedAt)}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
        A headline that names a stock is a candidate explanation, not proof of cause. Exchange filings are primary sources;
        press items are commentary.
      </p>
    </section>
  );
}
