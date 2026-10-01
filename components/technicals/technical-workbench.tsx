"use client";

import { useEffect, useState } from "react";
import { Activity, Layers, Loader2, Target } from "lucide-react";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { Tip } from "@/components/ui/tip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, formatINR } from "@/lib/utils";
import type { ApiTechnicals, TechInterval } from "@/lib/api/types";
import { IndicatorChart, OVERLAYS, PANES, type OverlayId, type PaneId } from "./indicator-chart";

const INTERVALS: { id: TechInterval; label: string }[] = [
  { id: "5m", label: "5 min" },
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 hour" },
  { id: "1d", label: "Daily" },
];

const GUIDE: Record<string, string> = {
  "SMA 20": "Simple moving average: the mean close over the last 20 bars. Price above it leans bullish.",
  "SMA 50": "Simple moving average over 50 bars, a slower trend line.",
  "SMA 200": "Simple moving average over 200 bars, the long-run trend.",
  "EMA 20": "Exponential moving average: like an SMA but weights recent bars more, so it reacts faster.",
  "EMA 50": "Exponential moving average over 50 bars.",
  "ADX (14)": "Average Directional Index: how strong a trend is, not which way. Above 25 is trending; below 20 is ranging.",
  "Supertrend (10, 3)": "An ATR-based trailing line. Price above it is an uptrend, below it a downtrend; the line flips on a close through it.",
  "RSI (14)": "Relative Strength Index: momentum on a 0–100 scale. Above 70 is stretched up, below 30 stretched down.",
  "MACD (12, 26, 9)": "Difference of a 12 and a 26 EMA, against its own 9-bar EMA (the signal line). A cross above is bullish momentum.",
  "Stochastic (14, 3, 3)": "Where the close sits in the recent high–low range. Above 80 overbought, below 20 oversold.",
  "Money Flow Index (14)": "An RSI that weights each bar by its traded value, so it reflects volume. Above 80 overbought, below 20 oversold.",
  "ATR (14)": "Average True Range: the typical size of a bar, in price terms. Used for stop distances, not direction.",
  "Bollinger (20, 2σ)": "A 20-bar mean with bands two standard deviations out. %B above 1 is outside the upper band, below 0 outside the lower.",
  VWAP: "Volume-weighted average price. Intraday it resets each session; on daily bars it is anchored at the first bar shown.",
};

export function TechnicalWorkbench({ symbol }: { symbol: string }) {
  const [interval, setInterval] = useState<TechInterval>("15m");
  const [data, setData] = useState<ApiTechnicals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overlays, setOverlays] = useState<Set<OverlayId>>(new Set(["sma20", "sma50", "supertrend", "vwap", "sr"]));
  const [panes, setPanes] = useState<PaneId[]>(["volume", "rsi", "macd"]);

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/technicals?symbol=${symbol}&interval=${interval}`, { signal: ctl.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load indicators.");
        setData(body as ApiTechnicals);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setData(null);
        setError(e instanceof Error ? e.message : "Could not load indicators.");
      })
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false);
      });
    return () => ctl.abort();
  }, [symbol, interval]);

  const toggleOverlay = (id: OverlayId) =>
    setOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePane = (id: PaneId) =>
    setPanes((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : PANES.map((p) => p.id).filter((p) => p === id || prev.includes(p))));

  const chip = (active: boolean) =>
    cn(
      "rounded-lg border px-2.5 py-1 text-2xs transition-colors",
      active ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl options={INTERVALS} value={interval} onChange={setInterval} layoutGroupId="tech-interval" />
        {data ? (
          <p className="font-mono text-2xs text-muted-foreground">
            {data.intervalLabel} bars · {data.barsAvailable.toLocaleString("en-IN")} loaded · last {data.asOf.replace("T", " ").slice(0, 16)} · ₹{formatINR(data.lastClose)}
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-2xs uppercase tracking-wider text-muted-foreground">Overlays</span>
          {OVERLAYS.map((o) => (
            <button key={o.id} type="button" aria-pressed={overlays.has(o.id)} onClick={() => toggleOverlay(o.id)} className={chip(overlays.has(o.id))}>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: o.color }} />
              {o.label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-2xs uppercase tracking-wider text-muted-foreground">Panels</span>
          {PANES.map((p) => (
            <button key={p.id} type="button" aria-pressed={panes.includes(p.id)} onClick={() => togglePane(p.id)} className={chip(panes.includes(p.id))}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="relative min-h-[360px]">
          {data ? (
            <div className={cn("transition-opacity", loading && "opacity-40")}>
              <IndicatorChart data={data} overlays={overlays} panes={panes} />
            </div>
          ) : !error ? (
            <div className="grid h-[360px] place-items-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : null}
          {loading && data ? <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-accent" /> : null}
        </div>
      </section>

      {data ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <DataCard
            title="Indicator readings"
            subtitle={`On ${data.intervalLabel.toLowerCase()} bars`}
            icon={Activity}
            badge={
              <span className="font-mono text-2xs text-muted-foreground">
                <span className="text-up">{data.tally.bullish} bullish</span> · <span className="text-down">{data.tally.bearish} bearish</span> · {data.tally.neutral} neutral
              </span>
            }
            footnote="Each reading is one indicator's own signal. The tally counts them; it is not a forecast, and indicators on the same bars are correlated."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <tbody>
                  {Object.entries(data.signals).map(([name, sig]) => (
                    <tr key={name} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <Tip title={GUIDE[name]}><p className="w-fit cursor-help border-b border-dotted border-muted-foreground/50">{name}</p></Tip>
                        {GUIDE[name] ? <p className="mt-0.5 max-w-md text-2xs text-muted-foreground/80">{GUIDE[name]}</p> : null}
                      </td>
                      <td className="px-2 py-2 font-mono">{sig.label}</td>
                      <td className="px-2 py-2 text-2xs text-muted-foreground">{sig.detail}</td>
                      <td className="px-4 py-2 text-right">
                        <StatusPill label={sig.tone === "up" ? "Bullish" : sig.tone === "down" ? "Bearish" : "Neutral"} tone={sig.tone} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>

          <div className="space-y-4">
            <DataCard title="Support & resistance" subtitle="Swing highs and lows grouped within 0.6 ATR" icon={Layers} footnote="Touches are how many swings formed the level; more is stronger.">
              <div className="grid grid-cols-2 gap-4 p-4">
                {(
                  [
                    ["Resistance", data.levels.resistance, "text-down"],
                    ["Support", data.levels.support, "text-up"],
                  ] as const
                ).map(([title, levels, tone]) => (
                  <div key={title}>
                    <p className="text-2xs uppercase tracking-wider text-muted-foreground">{title}</p>
                    {levels.length === 0 ? (
                      <p className="mt-1 text-2xs text-muted-foreground">None in range</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {levels.map((l) => (
                          <li key={l.price} className={cn("font-mono text-sm", tone)}>
                            ₹{formatINR(l.price)} <span className="text-2xs text-muted-foreground">{l.touches}×</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </DataCard>

            <DataCard title="MACD crossover" subtitle="Most recent signal-line cross on these bars" icon={Target}>
              <p className="p-4 text-sm">
                {data.lastCrossover ? (
                  <>
                    MACD crossed <strong className={data.lastCrossover.direction === "above" ? "text-up" : "text-down"}>{data.lastCrossover.direction}</strong> its signal line{" "}
                    {data.lastCrossover.barsAgo === 0 ? "on the latest bar" : `${data.lastCrossover.barsAgo} bars ago`}{" "}
                    <span className="font-mono text-2xs text-muted-foreground">({data.lastCrossover.at.replace("T", " ").slice(0, 16)})</span>.
                  </>
                ) : (
                  "No crossover in the loaded bars."
                )}
              </p>
            </DataCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
