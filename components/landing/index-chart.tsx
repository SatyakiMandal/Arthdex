"use client";

import { useMemo, useState } from "react";
import type { ApiCandle } from "@/lib/api/types";
import { cn, formatINR, formatPct } from "@/lib/utils";

const W = 720;
const H = 300;
const PAD = 12;

const RANGES = [
  { id: "1M", sessions: 21 },
  { id: "3M", sessions: 63 },
  { id: "6M", sessions: 126 },
  { id: "1Y", sessions: Infinity },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

/**
 * Nifty 50 drawn from the same candle data the company charts use. The range
 * switch only slices what the server already sent, and the crosshair reads the
 * exact close for the session under the pointer.
 */
export function IndexChart({ candles, label }: { candles: ApiCandle[]; label: string }) {
  const [range, setRange] = useState<RangeId>("1Y");
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    const sessions = RANGES.find((r) => r.id === range)!.sessions;
    return candles.length > sessions ? candles.slice(-sessions) : candles;
  }, [candles, range]);

  const geometry = useMemo(() => {
    const closes = view.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const x = (i: number) => (i / (view.length - 1)) * W;
    const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
    const line = closes.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    return { closes, min, max, span, x, y, line, area: `${line} L ${W} ${H} L 0 ${H} Z` };
  }, [view]);

  if (candles.length < 2 || view.length < 2) return null;

  const { closes, min, max, span, x, y, line, area } = geometry;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const rising = last >= first;
  const stroke = rising ? "hsl(var(--up))" : "hsl(var(--down))";
  const active = hover ?? closes.length - 1;
  const shown = closes[active];
  const shownPct = ((shown - first) / first) * 100;
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((s) => min + span * s);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
    setHover(Math.round(ratio * (closes.length - 1)));
  }

  return (
    <figure className="group/chart relative overflow-hidden rounded-2xl border border-border bg-surface/80 p-4 shadow-[0_30px_60px_-40px_hsl(var(--accent)/0.55)] backdrop-blur sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" aria-hidden />

      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-0.5 font-mono text-2xs text-muted-foreground">
            {hover !== null ? view[active].date : `${view.length} sessions to ${view[view.length - 1].date}`}
          </div>
        </div>

        <div role="tablist" aria-label="Chart range" className="flex rounded-lg border border-border bg-surface-muted p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              onClick={() => {
                setRange(r.id);
                setHover(null);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-2xs font-medium transition-all duration-200 active:scale-95",
                range === r.id ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.id}
            </button>
          ))}
        </div>
      </figcaption>

      <div className="mt-4 flex items-baseline gap-3">
        <div className="font-mono text-3xl font-semibold tabular-nums">{formatINR(shown, 2)}</div>
        <div className={cn("font-mono text-sm tabular-nums", shownPct >= 0 ? "text-up" : "text-down")}>
          {formatPct(shownPct, 2)} <span className="text-muted-foreground">since {view[0].date}</span>
        </div>
      </div>

      <div
        className="relative mt-4 cursor-crosshair touch-pan-y"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          key={range}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="chart-draw h-56 w-full sm:h-64"
          role="img"
          aria-label={`${label} closing level, ${formatPct(((last - first) / first) * 100, 2)} over the selected range`}
        >
          <defs>
            <linearGradient id="index-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" strokeDasharray="2 5">
            {gridValues.map((value) => (
              <line key={value} x1="0" y1={y(value)} x2={W} y2={y(value)} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          <path d={area} fill="url(#index-fill)" />
          <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {hover !== null ? (
          <>
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground/25"
              style={{ left: `${(x(active) / W) * 100}%` }}
              aria-hidden
            />
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
              style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(shown) / H) * 100}%`, backgroundColor: stroke }}
              aria-hidden
            />
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-between py-1">
          {[max, min].map((value) => (
            <span key={value} className="rounded bg-surface/80 px-1 font-mono text-2xs text-muted-foreground">
              {formatINR(value, 0)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
