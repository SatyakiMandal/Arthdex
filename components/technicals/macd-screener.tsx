"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import { CellBar } from "@/components/ui/cell-bar";
import { DeskAnalysis } from "@/components/ui/desk-analysis";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";
import type { ApiMacdScreen, TechInterval } from "@/lib/api/types";

const INTERVALS: { id: TechInterval; label: string }[] = [
  { id: "5m", label: "5 min" },
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 hour" },
  { id: "1d", label: "Daily" },
];
const DIRECTIONS = [
  { id: "above" as const, label: "Crossed above signal" },
  { id: "below" as const, label: "Crossed below signal" },
];
const INDICES = [
  { id: "nifty50", label: "Nifty 50" },
  { id: "nifty100", label: "Nifty 100" },
  { id: "nifty200", label: "Nifty 200" },
];
const BAR_MINUTES: Record<TechInterval, number> = { "5m": 5, "15m": 15, "1h": 60, "1d": 1440 };

function span(interval: TechInterval, within: number): string {
  if (interval === "1d") return `${within} trading day${within === 1 ? "" : "s"}`;
  const mins = BAR_MINUTES[interval] * within;
  return mins >= 60 ? `${(mins / 60).toFixed(mins % 60 ? 1 : 0)} h of trading` : `${mins} min of trading`;
}

export function MacdScreener() {
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [interval, setInterval] = useState<TechInterval>("5m");
  const [within, setWithin] = useState(3);
  const [index, setIndex] = useState("nifty50");
  const [data, setData] = useState<ApiMacdScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/screener/macd?direction=${direction}&interval=${interval}&within=${within}&index=${index}`, { signal: ctl.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Screener failed.");
        setData(body as ApiMacdScreen);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setData(null);
        setError(e instanceof Error ? e.message : "Screener failed.");
      })
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false);
      });
    return () => ctl.abort();
  }, [direction, interval, within, index, tick]);

  const maxHist = Math.max(...(data?.results.map((r) => Math.abs(r.hist ?? 0)) ?? [0]), 0.001);
  const label = "mb-1.5 block text-2xs font-medium uppercase tracking-wide text-muted-foreground";
  const unit = interval === "1d" ? "days" : "bars";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4 rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
        <div>
          <span className={label}>Signal</span>
          <SegmentedControl options={DIRECTIONS} value={direction} onChange={setDirection} layoutGroupId="macd-direction" />
        </div>
        <div>
          <span className={label}>Bar size</span>
          <SegmentedControl options={INTERVALS} value={interval} onChange={setInterval} layoutGroupId="macd-interval" />
        </div>

        <div>
          <span className={label}>Within last</span>
          <div className="flex h-9 items-center rounded-lg border border-border bg-surface-muted p-0.5">
            <button
              type="button"
              aria-label="Fewer bars"
              disabled={within <= 1}
              onClick={() => setWithin((w) => Math.max(1, w - 1))}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-all hover:bg-surface hover:text-foreground active:scale-90 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={50}
              aria-label="Number of bars to look back"
              value={within}
              onChange={(e) => setWithin(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
              className="w-9 bg-transparent text-center font-mono text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pr-1 text-xs text-muted-foreground">{unit}</span>
            <button
              type="button"
              aria-label="More bars"
              disabled={within >= 50}
              onClick={() => setWithin((w) => Math.min(50, w + 1))}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-all hover:bg-surface hover:text-foreground active:scale-90 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="macd-universe" className={label}>
            Universe
          </label>
          <div className="relative">
            <select
              id="macd-universe"
              value={index}
              onChange={(e) => setIndex(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-border bg-surface-muted pl-3 pr-9 text-sm transition-colors hover:border-accent/50"
            >
              {INDICES.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTick((t) => t + 1)}
          disabled={loading}
          className="btn-primary ml-auto h-9 px-4 py-0 active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <p className="text-2xs text-muted-foreground">
        Showing stocks whose MACD (12, 26, 9) {direction === "above" ? "crossed above" : "crossed below"} its signal line in the last {span(interval, within)}.
        {interval !== "1d" ? " Outside market hours this looks back from the close of the latest session." : ""}
      </p>

      {error ? (
        <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
          {error}
        </p>
      ) : null}

      {data ? <DeskAnalysis insights={data.insights} title="Universe analysis" /> : null}

      <section className="rounded-xl border border-border bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {loading && !data ? "Scanning…" : `${data?.results.length ?? 0} match${data?.results.length === 1 ? "" : "es"}`}
            {data ? <span className="ml-2 font-normal text-muted-foreground">of {data.scanned} scanned</span> : null}
          </h2>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : data?.asOf ? <span className="font-mono text-2xs text-muted-foreground">as of {data.asOf.replace("T", " ").slice(0, 16)}</span> : null}
        </header>

        {data && data.results.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No stock crossed {direction} its signal line in that window. Widen “within last” or try a coarser bar size.
          </p>
        ) : (
          <div className={cn("max-h-[70vh] overflow-auto", loading && "opacity-50")}>
            <table className="data-table data-table-sticky w-full min-w-[820px] border-collapse text-sm">
              <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">Scrip</th>
                  <th className="px-3 py-2 text-left font-medium">Industry</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Day %</th>
                  <th className="px-3 py-2 text-right font-medium">Crossed</th>
                  <th className="px-3 py-2 text-right font-medium">MACD</th>
                  <th className="px-3 py-2 text-right font-medium">Signal</th>
                  <th className="px-3 py-2 text-right font-medium">Histogram</th>
                  <th className="px-3 py-2 text-right font-medium">RSI</th>
                  <th className="px-3 py-2 text-right font-medium" title="Confirmations out of 4: MACD side of zero, price vs 50-bar EMA, ADX of 20+, RSI not stretched">Quality</th>
                </tr>
              </thead>
              <tbody>
                {data?.results.map((r) => (
                  <tr key={r.symbol} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                    <td className="px-3 py-2">
                      <Link href={`/company/${r.symbol}/technicals`} className="font-mono text-xs font-semibold hover:text-accent">
                        {r.symbol}
                      </Link>
                      <div className="max-w-[200px] truncate text-2xs text-muted-foreground">{r.name}</div>
                    </td>
                    <td className="px-3 py-2 text-2xs text-muted-foreground">{r.industry}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.price == null ? "—" : formatINR(r.price)}</td>
                    <td className={cn("px-3 py-2 text-right font-mono tabular-nums", r.changePct != null && deltaColor(r.changePct))}>
                      {r.changePct == null ? "—" : formatPct(r.changePct)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-2xs tabular-nums">
                      {r.barsAgo === 0 ? "latest bar" : `${r.barsAgo} ${interval === "1d" ? "days" : "bars"} ago`}
                      <div className="text-muted-foreground">{r.crossedAt.replace("T", " ").slice(interval === "1d" ? 5 : 5, 16)}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.macd ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.signal ?? "—"}</td>
                    <td className="px-3 py-1 text-right">
                      <CellBar value={r.hist} max={maxHist} tone={(r.hist ?? 0) >= 0 ? "up" : "down"}>
                        <span className={cn("text-xs", r.hist != null && deltaColor(r.hist))}>{r.hist ?? "—"}</span>
                      </CellBar>
                    </td>
                    <td className="px-3 py-1 text-right">
                      {r.rsi == null ? "—" : (
                        <CellBar value={r.rsi} max={100} tone={r.rsi > 70 ? "down" : r.rsi < 30 ? "up" : "muted"} markers={[30, 70]}>
                          <span className="text-xs">{r.rsi}</span>
                        </CellBar>
                      )}
                    </td>
                    <td className="px-3 py-1 text-right">
                      <span className="inline-flex gap-0.5" title={`${r.score ?? 0} of 4 confirmations`} aria-label={`${r.score ?? 0} of 4 confirmations`}>
                        {[0, 1, 2, 3].map((k) => (
                          <span key={k} className={cn("h-2 w-2 rounded-sm", k < (r.score ?? 0) ? "bg-accent" : "bg-muted")} />
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
          Bars are 15 minutes delayed and the latest bar can still change before it closes, so a fresh cross can reverse. A
          MACD cross is a momentum event, not a recommendation; confirm with trend (ADX, Supertrend) and volume.
        </p>
      </section>
    </div>
  );
}
