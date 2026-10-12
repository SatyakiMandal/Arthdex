"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { cn } from "@/lib/utils";
import type { ApiRisk } from "@/lib/api/types";

const TONE = { Low: "up", Moderate: "flat", High: "down", "Very high": "down" } as const;

export function RiskCard({ symbol }: { symbol: string }) {
  const [data, setData] = useState<ApiRisk | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setData(null);
    setError(null);
    fetch(`/api/risk?symbol=${symbol}`, { signal: ctl.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load risk.");
        setData(body as ApiRisk);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load risk.");
      });
    return () => ctl.abort();
  }, [symbol]);

  const m = data?.metrics;
  return (
    <DataCard
      title="Risk"
      subtitle="From the last year of daily bars"
      icon={ShieldAlert}
      badge={data ? <StatusPill label={`${data.tier} · ${data.score}/100`} tone={TONE[data.tier]} /> : null}
      footnote={data?.method}
    >
      {error ? <p className="p-4 text-sm text-down">{error}</p> : null}
      {!data && !error ? (
        <div className="grid h-28 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : null}
      {data && m ? (
        <div className="space-y-3 p-4">
          <ul className="space-y-1.5">
            {data.components.map((c) => (
              <li key={c.name}>
                <div className="flex justify-between text-2xs">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="font-mono">{c.reading}</span>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-muted">
                  <div className={cn("h-full rounded-full", c.score < 40 ? "bg-up" : c.score < 70 ? "bg-flat" : "bg-down")} style={{ width: `${Math.max(c.score, 3)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-sm">
            <dt className="text-muted-foreground">Max drawdown (1y)</dt>
            <dd className="text-right">-{m.maxDrawdownPct}%</dd>
            <dt className="text-muted-foreground">Expected shortfall 95%</dt>
            <dd className="text-right">-{m.cvar95Pct}%</dd>
            <dt className="text-muted-foreground">ATR (14)</dt>
            <dd className="text-right">
              {m.atr} <span className="text-2xs text-muted-foreground">({m.atrPct}%)</span>
            </dd>
            <dt className="text-muted-foreground">2-ATR stop</dt>
            <dd className="text-right text-down">
              {data.sizing.stopPrice} <span className="text-2xs text-muted-foreground">(-{data.sizing.stopPct}%)</span>
            </dd>
            <dt className="text-muted-foreground">Max position for 1% risk</dt>
            <dd className="text-right font-semibold">{data.sizing.maxPositionPct == null ? "—" : `${data.sizing.maxPositionPct}% of capital`}</dd>
          </dl>
        </div>
      ) : null}
    </DataCard>
  );
}
