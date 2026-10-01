"use client";

import { useMemo, useState } from "react";
import { cn, formatINR, formatPct } from "@/lib/utils";

const W = 720;
const H = 280;
const PAD = 12;
const DAY = 86_400_000;

const RANGES = [
  { id: "6M", days: 183 },
  { id: "1Y", days: 365 },
  { id: "3Y", days: 1096 },
  { id: "Max", days: Infinity },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

interface Point {
  date: string;
  price: number;
}

const fmt = (p: number) => `₹${formatINR(p, p < 100 ? 2 : 0)}`;

/**
 * Indicative price drawn as a step line. The source only revises its price now
 * and then and holds it flat in between, so a straight line between revisions
 * would invent a drift that was never quoted.
 */
export function PriceHistoryChart({ series }: { series: Point[] }) {
  const [range, setRange] = useState<RangeId>("1Y");
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    if (series.length === 0) return [] as Point[];
    const days = RANGES.find((r) => r.id === range)!.days;
    if (!Number.isFinite(days)) return series;
    const end = new Date(series[series.length - 1].date).getTime();
    const cutoff = end - days * DAY;
    const inside = series.filter((p) => new Date(p.date).getTime() >= cutoff);
    // Carry the price in force at the start of the window, so the line begins at the left edge
    const before = [...series].reverse().find((p) => new Date(p.date).getTime() < cutoff);
    return before ? [{ date: new Date(cutoff).toISOString().slice(0, 10), price: before.price }, ...inside] : inside;
  }, [series, range]);

  const geo = useMemo(() => {
    if (view.length < 2) return null;
    const t0 = new Date(view[0].date).getTime();
    const t1 = new Date(view[view.length - 1].date).getTime();
    const prices = view.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W;
    const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
    let line = "";
    view.forEach((p, i) => {
      const px = x(new Date(p.date).getTime());
      const py = y(p.price);
      line += i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` H ${px.toFixed(1)} V ${py.toFixed(1)}`;
    });
    return { t0, t1, min, max, x, y, line, area: `${line} L ${W} ${H} L 0 ${H} Z` };
  }, [view]);

  if (!geo) {
    return <p className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">Not enough price history to chart.</p>;
  }

  const first = view[0].price;
  const last = view[view.length - 1].price;
  const up = last >= first;
  const stroke = up ? "hsl(var(--up))" : "hsl(var(--down))";

  // The price in force on the hovered date is the latest revision on or before it
  const hoverTime = hover === null ? null : geo.t0 + hover * (geo.t1 - geo.t0);
  const active = hoverTime === null ? view[view.length - 1] : [...view].reverse().find((p) => new Date(p.date).getTime() <= hoverTime) ?? view[0];
  const pct = ((active.price - first) / first) * 100;
  const dateShown = hoverTime === null ? view[view.length - 1].date : new Date(hoverTime).toISOString().slice(0, 10);

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Indicative price history</div>
          <div className="mt-0.5 font-mono text-2xs text-muted-foreground">{dateShown}</div>
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
                "rounded-md px-2.5 py-1 font-mono text-2xs font-medium transition-all active:scale-95",
                range === r.id ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.id}
            </button>
          ))}
        </div>
      </figcaption>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="font-mono text-2xl font-semibold tabular-nums">{fmt(active.price)}</span>
        <span className={cn("font-mono text-sm tabular-nums", pct >= 0 ? "text-up" : "text-down")}>
          {formatPct(pct, 1)} <span className="text-muted-foreground">over the range</span>
        </span>
      </div>

      <div
        className="relative mt-4 cursor-crosshair touch-pan-y"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          key={range}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="chart-draw h-56 w-full"
          role="img"
          aria-label={`Indicative price over the selected range, ${formatPct(((last - first) / first) * 100, 1)}`}
        >
          <defs>
            <linearGradient id="unlisted-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geo.area} fill="url(#unlisted-fill)" />
          <path d={geo.line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {hover !== null ? (
          <span className="pointer-events-none absolute inset-y-0 w-px bg-foreground/25" style={{ left: `${hover * 100}%` }} aria-hidden />
        ) : null}

        <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-between py-1">
          {[geo.max, geo.min].map((v) => (
            <span key={v} className="rounded bg-surface/80 px-1 font-mono text-2xs text-muted-foreground">
              {fmt(v)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
