"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ApiCandle } from "@/lib/api/types";

type Candle = ApiCandle;
type Period = "1D" | "5D" | "1M" | "6M" | "1Y" | "3Y" | "5Y" | "MAX";

const PERIODS: { id: Period; label: string }[] = [
  { id: "1D", label: "1D" },
  { id: "5D", label: "5D" },
  { id: "1M", label: "1M" },
  { id: "6M", label: "6M" },
  { id: "1Y", label: "1Y" },
  { id: "3Y", label: "3Y" },
  { id: "5Y", label: "5Y" },
  { id: "MAX", label: "Max" },
];
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

/**
 * Hand-rolled SVG chart rather than a canvas library: every stroke and fill
 * resolves a CSS custom property, so a light/dark switch re-themes the chart
 * with no redraw code and no theme listener.
 */

const VIEW_W = 1000;
const PRICE_H = 260;
const VOLUME_H = 56;
const GAP = 12;
const VIEW_H = PRICE_H + GAP + VOLUME_H;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;

interface Scales {
  min: number;
  max: number;
  maxVolume: number;
  x: (i: number) => number;
  y: (price: number) => number;
  volY: (volume: number) => number;
}

function buildScales(candles: Candle[]): Scales {
  // Defensive: an empty series reaches here before the render guard runs, and
  // Math.min() with no arguments returns Infinity.
  if (candles.length === 0) {
    return { min: 0, max: 1, maxVolume: 1, x: () => 0, y: () => 0, volY: () => VIEW_H };
  }

  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const rawMin = Math.min(...lows);
  const rawMax = Math.max(...highs);
  // 4% headroom so the line never touches the plot edge
  const pad = (rawMax - rawMin) * 0.04 || rawMax * 0.02;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const maxVolume = Math.max(...candles.map((c) => c.volume));
  const usableH = PRICE_H - PAD_TOP - PAD_BOTTOM;

  return {
    min,
    max,
    maxVolume,
    x: (i) => (candles.length <= 1 ? 0 : (i / (candles.length - 1)) * VIEW_W),
    y: (price) => PAD_TOP + (1 - (price - min) / (max - min)) * usableH,
    volY: (volume) => VIEW_H - (volume / maxVolume) * VOLUME_H,
  };
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  const intraday = iso.includes("T");
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: intraday ? undefined : "numeric",
    hour: intraday ? "2-digit" : undefined,
    minute: intraday ? "2-digit" : undefined,
    timeZone: "Asia/Kolkata",
  });
}

function formatVolume(v: number): string {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)} K`;
  return String(v);
}

export function PriceChart({
  symbol,
  initialCandles,
  initialPeriod = "1Y",
}: {
  symbol: string;
  initialCandles: ApiCandle[];
  initialPeriod?: Period;
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [candles, setCandles] = useState<ApiCandle[]>(initialCandles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Refetch on period change. In-flight requests are aborted so a slow response
  // for an old period cannot overwrite a newer one.
  useEffect(() => {
    if (period === initialPeriod && candles === initialCandles) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const response = await fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&period=${period}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(body?.error ?? "Could not load price history");
          return;
        }
        setCandles(body.candles ?? []);
        setHoverIndex(null);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError" && !cancelled) {
          setError("Could not load price history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, symbol]);

  const scales = useMemo(() => buildScales(candles), [candles]);

  // Hooks must all run before any early return, so an empty series is handled
  // with safe fallbacks here and the guard is applied once below.
  const isEmpty = candles.length === 0;
  const first = candles[0];
  const last = candles[candles.length - 1];
  const periodChangePct =
    isEmpty || !first.close ? 0 : ((last.close - first.close) / first.close) * 100;
  const rising = periodChangePct >= 0;
  const lineColor = rising ? "hsl(var(--up))" : "hsl(var(--down))";

  const linePath = useMemo(
    () => candles.map((c, i) => `${i === 0 ? "M" : "L"} ${scales.x(i).toFixed(2)} ${scales.y(c.close).toFixed(2)}`).join(" "),
    [candles, scales],
  );

  const areaPath = `${linePath} L ${VIEW_W} ${PRICE_H} L 0 ${PRICE_H} Z`;

  // Map pointer position to the nearest bar. Using the SVG's own bounding box
  // keeps this correct at any rendered width without a resize observer.
  const handleMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const ratio = (event.clientX - rect.left) / rect.width;
      const idx = Math.round(ratio * (candles.length - 1));
      setHoverIndex(Math.max(0, Math.min(candles.length - 1, idx)));
    },
    [candles.length],
  );

  const active = hoverIndex === null ? null : candles[hoverIndex];
  const activeX = hoverIndex === null ? 0 : scales.x(hoverIndex);
  // Flip the tooltip to the left of the crosshair once it nears the right edge
  const tooltipOnLeft = activeX > VIEW_W * 0.62;

  const gridLines = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const price = scales.min + ((scales.max - scales.min) * i) / steps;
      return { price, y: scales.y(price) };
    });
  }, [scales]);

  if (isEmpty) {
    return (
      <section className="rounded-xl border border-border bg-surface p-8">
        <p className="text-sm text-muted-foreground">
          {error ?? `No price history available for ${symbol}.`}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            Price
            {loading ? <Loader2 className="h-3 w-3 animate-spin text-accent" /> : null}
          </h3>
          <span className={cn("font-mono text-xs", deltaColor(periodChangePct))}>
            {formatPct(periodChangePct)} <span className="text-muted-foreground">over {period}</span>
          </span>
        </div>
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={(p) => setPeriod(p)}
          layoutGroupId="price-chart-period"
        />
      </header>

      <div className="relative px-2 py-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-[320px] w-full touch-none"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`${symbol} price chart over ${period}`}
        >
          <defs>
            <linearGradient id={`fill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal price gridlines */}
          <g stroke="hsl(var(--border))" strokeWidth="1" opacity="0.7">
            {gridLines.map((g) => (
              <line key={g.price} x1="0" y1={g.y} x2={VIEW_W} y2={g.y} />
            ))}
          </g>

          {/* Volume histogram */}
          <g fill="hsl(var(--muted-foreground))" opacity="0.35">
            {candles.map((c, i) => {
              const barW = Math.max(VIEW_W / candles.length - 0.6, 0.6);
              return (
                <rect
                  key={`v-${c.date}`}
                  x={scales.x(i) - barW / 2}
                  y={scales.volY(c.volume)}
                  width={barW}
                  height={VIEW_H - scales.volY(c.volume)}
                />
              );
            })}
          </g>

          <path d={areaPath} fill={`url(#fill-${symbol})`} />
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Crosshair */}
          {active ? (
            <g>
              <line
                x1={activeX}
                y1="0"
                x2={activeX}
                y2={VIEW_H}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="0"
                y1={scales.y(active.close)}
                x2={VIEW_W}
                y2={scales.y(active.close)}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={activeX}
                cy={scales.y(active.close)}
                r="4"
                fill="hsl(var(--background))"
                stroke={lineColor}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ) : null}
        </svg>

        {/* Price axis labels. Rendered as HTML so text isn't distorted by
            preserveAspectRatio="none", but positioned from the same y-scale as
            the gridlines — hence the SVG-units-to-percent conversion. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 h-[320px]">
          {gridLines.map((g) => (
            <span
              key={g.price}
              className="absolute right-0 -translate-y-1/2 bg-surface pl-1 font-mono text-2xs text-muted-foreground"
              style={{ top: `${(g.y / VIEW_H) * 100}%` }}
            >
              {formatINR(g.price, 0)}
            </span>
          ))}
        </div>

        {/* Crosshair inspector */}
        {active ? (
          <div
            className={cn(
              "pointer-events-none absolute top-5 z-10 min-w-[190px] rounded-lg border border-border bg-surface-raised/95 p-2.5 shadow-lg backdrop-blur",
              tooltipOnLeft ? "translate-x-[-105%]" : "translate-x-[5%]",
            )}
            style={{ left: `${(activeX / VIEW_W) * 100}%` }}
          >
            <div className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
              {formatStamp(active.date)}
            </div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-2xs">
              {(
                [
                  ["Open", formatINR(active.open)],
                  ["High", formatINR(active.high)],
                  ["Low", formatINR(active.low)],
                  ["Close", formatINR(active.close)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="col-span-2 mt-1 flex justify-between gap-2 border-t border-border pt-1">
                <dt className="text-muted-foreground">Volume</dt>
                <dd className="tabular-nums">{formatVolume(active.volume)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>

      <footer className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-2xs text-muted-foreground">
        <span>{formatStamp(first.date)}</span>
        <span>{candles.length} bars</span>
        <span>{formatStamp(last.date)}</span>
      </footer>
    </section>
  );
}
