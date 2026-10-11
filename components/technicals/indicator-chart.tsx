"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ApiTechnicals } from "@/lib/api/types";

export type OverlayId = "sma20" | "sma50" | "sma200" | "ema20" | "ema50" | "bb" | "supertrend" | "vwap" | "sr" | "orderBlocks" | "fvg" | "liquidity";
export type PaneId = "volume" | "rsi" | "macd" | "stoch" | "mfi" | "adx" | "atr";

export const OVERLAYS: { id: OverlayId; label: string; color: string }[] = [
  { id: "sma20", label: "SMA 20", color: "hsl(var(--flat))" },
  { id: "sma50", label: "SMA 50", color: "hsl(var(--accent))" },
  { id: "sma200", label: "SMA 200", color: "#a78bfa" },
  { id: "ema20", label: "EMA 20", color: "#22d3ee" },
  { id: "ema50", label: "EMA 50", color: "#f472b6" },
  { id: "bb", label: "Bollinger", color: "hsl(var(--muted-foreground))" },
  { id: "supertrend", label: "Supertrend", color: "hsl(var(--up))" },
  { id: "vwap", label: "VWAP", color: "#fb923c" },
  { id: "sr", label: "Support / resistance", color: "hsl(var(--muted-foreground))" },
  { id: "orderBlocks", label: "Order blocks", color: "hsl(var(--up))" },
  { id: "fvg", label: "Fair value gaps", color: "#a78bfa" },
  { id: "liquidity", label: "Liquidity sweeps", color: "#fb923c" },
];

export const PANES: { id: PaneId; label: string }[] = [
  { id: "volume", label: "Volume" },
  { id: "rsi", label: "RSI" },
  { id: "macd", label: "MACD" },
  { id: "stoch", label: "Stochastic" },
  { id: "mfi", label: "MFI" },
  { id: "adx", label: "ADX" },
  { id: "atr", label: "ATR" },
];

const W = 1000;
const PRICE_H = 340;
const PANE_H = 110;

type Line = { key: string; label: string; color: string };
interface PaneSpec {
  lines: Line[];
  hist?: string;
  bands?: number[];
  range?: [number, number];
}

const PANE_SPECS: Record<Exclude<PaneId, "volume">, PaneSpec> = {
  rsi: { lines: [{ key: "rsi", label: "RSI", color: "hsl(var(--accent))" }], bands: [30, 70], range: [0, 100] },
  macd: {
    lines: [
      { key: "macd", label: "MACD", color: "hsl(var(--accent))" },
      { key: "signal", label: "Signal", color: "hsl(var(--flat))" },
    ],
    hist: "hist",
  },
  stoch: {
    lines: [
      { key: "stochK", label: "%K", color: "hsl(var(--accent))" },
      { key: "stochD", label: "%D", color: "hsl(var(--flat))" },
    ],
    bands: [20, 80],
    range: [0, 100],
  },
  mfi: { lines: [{ key: "mfi", label: "MFI", color: "#22d3ee" }], bands: [20, 80], range: [0, 100] },
  adx: {
    lines: [
      { key: "adx", label: "ADX", color: "hsl(var(--foreground))" },
      { key: "plusDI", label: "+DI", color: "hsl(var(--up))" },
      { key: "minusDI", label: "−DI", color: "hsl(var(--down))" },
    ],
    bands: [25],
  },
  atr: { lines: [{ key: "atr", label: "ATR", color: "hsl(var(--flat))" }] },
};

type Series = (number | null)[];

/** SVG path for a series, breaking the line wherever the value is missing. */
function path(values: Series, x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

function fmt(v: number | null | undefined, d = 2): string {
  return v == null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function label(t: string, intraday: boolean): string {
  if (!intraday) return t.slice(5);
  return `${t.slice(5, 10)} ${t.slice(11, 16)}`;
}

export function IndicatorChart({
  data,
  overlays,
  panes,
}: {
  data: ApiTechnicals;
  overlays: Set<OverlayId>;
  panes: PaneId[];
}) {
  const n = data.bars.length;
  const [hover, setHover] = useState<number | null>(null);
  const idx = hover ?? n - 1;
  const step = W / Math.max(n, 1);
  const x = (i: number) => (i + 0.5) * step;

  const { lo, hi } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const b of data.bars) {
      if (b.l < mn) mn = b.l;
      if (b.h > mx) mx = b.h;
    }
    const pad = (mx - mn) * 0.05 || mx * 0.01;
    return { lo: mn - pad, hi: mx + pad };
  }, [data.bars]);
  const py = (v: number) => 12 + (1 - (v - lo) / (hi - lo)) * (PRICE_H - 24);
  const s = data.series;
  const bar = data.bars[idx];
  const up = bar.c >= bar.o;
  const maxVol = Math.max(1, ...data.bars.map((b) => b.v));
  const crossX = x(idx);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };

  const tickIdx = Array.from({ length: 5 }, (_, k) => Math.round((k / 4) * (n - 1)));

  const overlayLine = (id: OverlayId, key: string, dashed = false) =>
    overlays.has(id) ? (
      <path
        key={key}
        d={path(s[key], x, py)}
        fill="none"
        stroke={OVERLAYS.find((o) => o.id === id)!.color}
        strokeWidth={1.4}
        strokeDasharray={dashed ? "4 3" : undefined}
        vectorEffect="non-scaling-stroke"
      />
    ) : null;

  const PaneShell = ({ title, children, readout, height = PANE_H }: { title: string; children: React.ReactNode; readout: React.ReactNode; height?: number }) => (
    <div className="relative mt-1 border-t border-border">
      <div className="pointer-events-none absolute left-2 top-1 z-10 flex flex-wrap gap-x-3 text-2xs text-muted-foreground">
        <span className="font-medium text-foreground">{title}</span>
        {readout}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label={title}>
        {children}
        <line x1={crossX} x2={crossX} y1={0} y2={height} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );

  return (
    <div onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="select-none">
      {/* price pane */}
      <div className="relative">
        <div className="pointer-events-none absolute left-2 top-1 z-10 flex flex-wrap gap-x-3 font-mono text-2xs">
          <span className="text-muted-foreground">{label(bar.t, data.intraday)}</span>
          <span>O {fmt(bar.o)}</span>
          <span>H {fmt(bar.h)}</span>
          <span>L {fmt(bar.l)}</span>
          <span className={up ? "text-up" : "text-down"}>C {fmt(bar.c)}</span>
          <span className="text-muted-foreground">Vol {bar.v.toLocaleString("en-IN")}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${PRICE_H}`} preserveAspectRatio="none" className="block w-full" style={{ height: PRICE_H }} role="img" aria-label={`${data.symbol} price chart`}>
          {[0.2, 0.4, 0.6, 0.8].map((g) => (
            <line key={g} x1={0} x2={W} y1={PRICE_H * g} y2={PRICE_H * g} stroke="hsl(var(--border))" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
          ))}

          {overlays.has("bb") ? (
            <>
              <path d={path(s.bbUpper, x, py)} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
              <path d={path(s.bbLower, x, py)} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            </>
          ) : null}

          {data.bars.map((b, i) => {
            const c = b.c >= b.o ? "hsl(var(--up))" : "hsl(var(--down))";
            const w = Math.max(step * 0.62, 0.8);
            const top = py(Math.max(b.o, b.c));
            return (
              <g key={i}>
                <line x1={x(i)} x2={x(i)} y1={py(b.h)} y2={py(b.l)} stroke={c} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <rect x={x(i) - w / 2} y={top} width={w} height={Math.max(Math.abs(py(b.o) - py(b.c)), 0.8)} fill={c} />
              </g>
            );
          })}

          {overlayLine("sma20", "sma20")}
          {overlayLine("sma50", "sma50")}
          {overlayLine("sma200", "sma200")}
          {overlayLine("ema20", "ema20")}
          {overlayLine("ema50", "ema50")}
          {overlayLine("vwap", "vwap", true)}

          {overlays.has("supertrend")
            ? (["1", "-1"] as const).map((dir) => (
                <path
                  key={dir}
                  d={path(s.supertrend.map((v, i) => (String(s.supertrendDir[i]) === dir ? v : null)), x, py)}
                  fill="none"
                  stroke={dir === "1" ? "hsl(var(--up))" : "hsl(var(--down))"}
                  strokeWidth={1.8}
                  vectorEffect="non-scaling-stroke"
                />
              ))
            : null}

          {overlays.has("sr")
            ? [...data.levels.support.map((l) => ({ ...l, k: "s" })), ...data.levels.resistance.map((l) => ({ ...l, k: "r" }))]
                .filter((l) => l.price > lo && l.price < hi)
                .map((l, i) => (
                  <line
                    key={i}
                    x1={0}
                    x2={W}
                    y1={py(l.price)}
                    y2={py(l.price)}
                    stroke={l.k === "s" ? "hsl(var(--up))" : "hsl(var(--down))"}
                    strokeOpacity={0.75}
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                  />
                ))
            : null}

          {overlays.has("orderBlocks")
            ? data.orderBlocks.map((b, i) => {
                const x0 = x(b.start) - step / 2;
                const endI = b.mitigated ?? n - 1;
                const x1 = x(endI) + (b.mitigated != null ? -step / 2 : step / 2);
                const color = b.type === "bullish" ? "hsl(var(--up))" : "hsl(var(--down))";
                return (
                  <rect
                    key={i}
                    x={x0}
                    y={py(b.high)}
                    width={Math.max(x1 - x0, 1)}
                    height={Math.max(py(b.low) - py(b.high), 1)}
                    fill={color}
                    fillOpacity={b.mitigated != null ? 0.06 : 0.16}
                    stroke={color}
                    strokeOpacity={b.mitigated != null ? 0.25 : 0.6}
                    strokeWidth={1}
                    strokeDasharray={b.mitigated != null ? "3 3" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })
            : null}

          {overlays.has("fvg")
            ? data.fairValueGaps.map((g, i) => {
                const x0 = x(g.start) - step / 2;
                const endI = g.filled ?? n - 1;
                const x1 = x(endI) + (g.filled != null ? -step / 2 : step / 2);
                const color = g.type === "bullish" ? "hsl(var(--up))" : "hsl(var(--down))";
                return (
                  <rect
                    key={i}
                    x={x0}
                    y={py(g.high)}
                    width={Math.max(x1 - x0, 1)}
                    height={Math.max(py(g.low) - py(g.high), 1)}
                    fill={color}
                    fillOpacity={g.filled != null ? 0.05 : 0.14}
                    stroke="none"
                  />
                );
              })
            : null}

          {overlays.has("liquidity")
            ? data.liquiditySweeps.map((sw, i) => {
                const color = sw.type === "bullish" ? "hsl(var(--up))" : "hsl(var(--down))";
                const lx0 = x(Math.max(0, sw.at - 3));
                const lx1 = x(Math.min(n - 1, sw.at + 2));
                return (
                  <g key={i}>
                    <line x1={lx0} x2={lx1} y1={py(sw.level)} y2={py(sw.level)} stroke={color} strokeOpacity={0.6} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                    <circle cx={x(sw.at)} cy={py(sw.wick)} r={3} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })
            : null}

          <line x1={crossX} x2={crossX} y1={0} y2={PRICE_H} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* price-axis labels: HTML so they do not stretch with the SVG */}
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((g) => (
          <span key={g} className="pointer-events-none absolute right-1 font-mono text-2xs text-muted-foreground" style={{ top: `${g * 100}%` }}>
            {fmt(hi - g * (hi - lo))}
          </span>
        ))}
        {overlays.has("sr")
          ? [...data.levels.support, ...data.levels.resistance]
              .filter((l) => l.price > lo && l.price < hi)
              .map((l, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute left-1 -translate-y-full font-mono text-2xs text-muted-foreground"
                  style={{ top: `${(py(l.price) / PRICE_H) * 100}%` }}
                >
                  {fmt(l.price)} · {l.touches}×
                </span>
              ))
          : null}
      </div>

      {panes.map((id) => {
        if (id === "volume") {
          return (
            <PaneShell key={id} title="Volume" readout={<span className="font-mono">{bar.v.toLocaleString("en-IN")}</span>} height={70}>
              {data.bars.map((b, i) => (
                <rect key={i} x={x(i) - Math.max(step * 0.62, 0.8) / 2} y={70 - (b.v / maxVol) * 60} width={Math.max(step * 0.62, 0.8)} height={(b.v / maxVol) * 60} fill={b.c >= b.o ? "hsl(var(--up))" : "hsl(var(--down))"} fillOpacity={0.55} />
              ))}
            </PaneShell>
          );
        }
        const spec = PANE_SPECS[id];
        const all = [...spec.lines.flatMap((l) => s[l.key]), ...(spec.hist ? s[spec.hist] : [])].filter((v): v is number => v != null);
        const mn = spec.range ? spec.range[0] : Math.min(...all, ...(spec.hist ? [0] : []));
        const mx = spec.range ? spec.range[1] : Math.max(...all, ...(spec.hist ? [0] : []));
        const span = mx - mn || 1;
        const y = (v: number) => 8 + (1 - (v - mn) / span) * (PANE_H - 16);
        return (
          <PaneShell
            key={id}
            title={PANES.find((p) => p.id === id)!.label}
            readout={spec.lines.map((l) => (
              <span key={l.key} className="font-mono" style={{ color: l.color }}>
                {l.label} {fmt(s[l.key][idx], id === "macd" || id === "atr" ? 3 : 1)}
              </span>
            ))}
          >
            {spec.bands?.map((b) => (
              <line key={b} x1={0} x2={W} y1={y(b)} y2={y(b)} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.45} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            ))}
            {spec.hist ? (
              <>
                <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />
                {s[spec.hist].map((v, i) =>
                  v == null ? null : (
                    <rect key={i} x={x(i) - Math.max(step * 0.6, 0.8) / 2} y={Math.min(y(v), y(0))} width={Math.max(step * 0.6, 0.8)} height={Math.abs(y(v) - y(0))} fill={v >= 0 ? "hsl(var(--up))" : "hsl(var(--down))"} fillOpacity={0.55} />
                  ),
                )}
              </>
            ) : null}
            {spec.lines.map((l) => (
              <path key={l.key} d={path(s[l.key], x, y)} fill="none" stroke={l.color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
            ))}
          </PaneShell>
        );
      })}

      <div className="relative mt-1 h-4">
        {tickIdx.map((i) => (
          <span key={i} className={cn("absolute font-mono text-2xs text-muted-foreground", i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${(x(i) / W) * 100}%` }}>
            {label(data.bars[i].t, data.intraday)}
          </span>
        ))}
      </div>
    </div>
  );
}
