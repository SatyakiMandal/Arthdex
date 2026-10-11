"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ApiOrderflow } from "@/lib/api/types";

const W = 1000;
const CHART_W = 720;
const PRICE_H = 360;
const PANE_H = 90;

export type ProfileMode = "volume" | "delta";

function fmt(v: number | null | undefined, d = 2): string {
  return v == null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function compact(v: number): string {
  const a = Math.abs(v);
  const s = a >= 1e7 ? `${(a / 1e7).toFixed(2)}Cr` : a >= 1e5 ? `${(a / 1e5).toFixed(2)}L` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : `${Math.round(a)}`;
  return v < 0 ? `-${s}` : s;
}

function label(t: string, intraday: boolean): string {
  return intraday ? `${t.slice(5, 10)} ${t.slice(11, 16)}` : t.slice(5);
}

export function FlowChart({
  data,
  mode,
  showAbsorption,
  showBig,
}: {
  data: ApiOrderflow;
  mode: ProfileMode;
  showAbsorption: boolean;
  showBig: boolean;
}) {
  const n = data.bars.length;
  const [hover, setHover] = useState<number | null>(null);
  const idx = hover ?? n - 1;
  const step = CHART_W / Math.max(n, 1);
  const x = (i: number) => (i + 0.5) * step;
  const bar = data.bars[idx];

  const { lo, hi } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const b of data.bars) {
      if (b.l < mn) mn = b.l;
      if (b.h > mx) mx = b.h;
    }
    const pad = (mx - mn) * 0.04 || mx * 0.01;
    return { lo: mn - pad, hi: mx + pad };
  }, [data.bars]);
  const py = (v: number) => 10 + (1 - (v - lo) / (hi - lo)) * (PRICE_H - 20);

  const prof = data.profile;
  const maxV = Math.max(1, ...prof.bins.map((b) => b.v));
  const maxD = Math.max(1, ...prof.bins.map((b) => Math.abs(b.delta)));
  const PX0 = CHART_W + 14;
  const PW = W - PX0 - 4;

  const maxBarD = Math.max(1, ...data.bars.map((b) => Math.abs(b.delta)));
  const cvd = data.cvd;
  const cMin = Math.min(...cvd);
  const cMax = Math.max(...cvd);
  const cy = (v: number) => 8 + (1 - (v - cMin) / (cMax - cMin || 1)) * (PANE_H - 16);
  const cvdPath = cvd.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${cy(v).toFixed(1)}`).join("");

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    const i = Math.floor((frac * W) / step);
    setHover(i < 0 || i >= n ? null : i);
  };

  const crossX = x(idx);
  const up = bar.c >= bar.o;
  const tickIdx = Array.from({ length: 5 }, (_, k) => Math.round((k / 4) * (n - 1)));
  const keyLine = (v: number, color: string, dash?: string) => (
    <line x1={0} x2={W} y1={py(v)} y2={py(v)} stroke={color} strokeOpacity={0.85} strokeWidth={1.2} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
  );

  return (
    <div onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="select-none">
      <div className="relative">
        <div className="pointer-events-none absolute left-2 top-1 z-10 flex flex-wrap gap-x-3 font-mono text-2xs">
          <span className="text-muted-foreground">{label(bar.t, data.intraday)}</span>
          <span>O {fmt(bar.o)}</span>
          <span>H {fmt(bar.h)}</span>
          <span>L {fmt(bar.l)}</span>
          <span className={up ? "text-up" : "text-down"}>C {fmt(bar.c)}</span>
          <span className="text-muted-foreground">Vol {compact(bar.v)}</span>
          <span className={bar.delta >= 0 ? "text-up" : "text-down"}>Δ {compact(bar.delta)}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${PRICE_H}`} preserveAspectRatio="none" className="block w-full" style={{ height: PRICE_H }} role="img" aria-label={`${data.symbol} price with ${mode} profile`}>
          {[0.2, 0.4, 0.6, 0.8].map((g) => (
            <line key={g} x1={0} x2={CHART_W} y1={PRICE_H * g} y2={PRICE_H * g} stroke="hsl(var(--border))" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
          ))}

          {/* value area band behind the candles */}
          <rect x={0} y={py(prof.vah)} width={CHART_W} height={Math.max(py(prof.val) - py(prof.vah), 1)} fill="hsl(var(--accent))" fillOpacity={0.06} />

          {data.bars.map((b, i) => {
            const c = b.c >= b.o ? "hsl(var(--up))" : "hsl(var(--down))";
            const w = Math.max(step * 0.62, 0.8);
            return (
              <g key={i}>
                <line x1={x(i)} x2={x(i)} y1={py(b.h)} y2={py(b.l)} stroke={c} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <rect x={x(i) - w / 2} y={py(Math.max(b.o, b.c))} width={w} height={Math.max(Math.abs(py(b.o) - py(b.c)), 0.8)} fill={c} />
              </g>
            );
          })}

          <g clipPath="url(#flow-clip)">
            {keyLine(prof.poc, "#fbbf24")}
            {keyLine(prof.vah, "hsl(var(--accent))", "5 4")}
            {keyLine(prof.val, "hsl(var(--accent))", "5 4")}
          </g>
          <clipPath id="flow-clip">
            <rect x={0} y={0} width={CHART_W} height={PRICE_H} />
          </clipPath>

          {showAbsorption
            ? data.absorption.map((a, i) => {
                const b = data.bars[a.at];
                const bull = a.type === "bullish";
                const cx = x(a.at);
                const ty = bull ? py(b.l) + 6 : py(b.h) - 6;
                const pts = bull ? `${cx - 5},${ty + 7} ${cx + 5},${ty + 7} ${cx},${ty - 1}` : `${cx - 5},${ty - 7} ${cx + 5},${ty - 7} ${cx},${ty + 1}`;
                return (
                  <polygon key={i} points={pts} fill={bull ? "hsl(var(--up))" : "hsl(var(--down))"} stroke="hsl(var(--background))" strokeWidth={0.8}>
                    <title>{`${bull ? "Bullish" : "Bearish"} absorption: ${a.volRatio}x volume in a ${a.rangeAtr} ATR bar`}</title>
                  </polygon>
                );
              })
            : null}

          {showBig
            ? data.bigTrades.map((t, i) => (
                <circle key={i} cx={x(t.at)} cy={py(t.price)} r={Math.min(3 + t.z, 9)} fill="none" stroke="#fb923c" strokeWidth={1.5} vectorEffect="non-scaling-stroke">
                  <title>{`Large volume ${compact(t.volume)} (${t.z}σ), ${t.bias}-biased`}</title>
                </circle>
              ))
            : null}

          {/* profile */}
          <line x1={PX0} x2={PX0} y1={0} y2={PRICE_H} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />
          {mode === "delta" ? <line x1={PX0 + PW / 2} x2={PX0 + PW / 2} y1={0} y2={PRICE_H} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
          {prof.bins.map((bn, i) => {
            const y0 = py(bn.hi);
            const h = Math.max(py(bn.lo) - py(bn.hi) - 0.6, 0.8);
            const inVa = bn.mid >= prof.val && bn.mid <= prof.vah;
            const isPoc = Math.abs(bn.mid - prof.poc) < 1e-9;
            if (mode === "delta") {
              const w = (Math.abs(bn.delta) / maxD) * (PW / 2);
              const pos = bn.delta >= 0;
              return <rect key={i} x={pos ? PX0 + PW / 2 : PX0 + PW / 2 - w} y={y0} width={Math.max(w, 0.5)} height={h} fill={pos ? "hsl(var(--up))" : "hsl(var(--down))"} fillOpacity={inVa ? 0.85 : 0.45} />;
            }
            const wb = (bn.buy / maxV) * PW;
            const ws = (bn.sell / maxV) * PW;
            return (
              <g key={i} opacity={inVa ? 1 : 0.5}>
                <rect x={PX0} y={y0} width={Math.max(wb, 0)} height={h} fill="hsl(var(--up))" fillOpacity={0.8} />
                <rect x={PX0 + wb} y={y0} width={Math.max(ws, 0)} height={h} fill="hsl(var(--down))" fillOpacity={0.8} />
                {isPoc ? <rect x={PX0} y={y0} width={wb + ws} height={h} fill="none" stroke="#fbbf24" strokeWidth={1.2} vectorEffect="non-scaling-stroke" /> : null}
              </g>
            );
          })}

          <line x1={crossX} x2={crossX} y1={0} y2={PRICE_H} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* labels are HTML so they do not stretch with the SVG */}
        {[
          { v: prof.poc, text: `POC ${fmt(prof.poc)}`, color: "#fbbf24" },
          { v: prof.vah, text: `VAH ${fmt(prof.vah)}`, color: "hsl(var(--accent))" },
          { v: prof.val, text: `VAL ${fmt(prof.val)}`, color: "hsl(var(--accent))" },
        ].map((l) => (
          <span key={l.text} className="pointer-events-none absolute whitespace-nowrap font-mono text-2xs" style={{ left: `${((CHART_W - 4) / W) * 100}%`, transform: "translate(-100%, -100%)", top: `${(py(l.v) / PRICE_H) * 100}%`, color: l.color }}>
            {l.text}
          </span>
        ))}
        <span className="pointer-events-none absolute right-1 top-1 font-mono text-2xs text-muted-foreground">{mode === "volume" ? "Volume profile" : "Delta profile"}</span>
      </div>

      <div className="relative mt-1 border-t border-border">
        <div className="pointer-events-none absolute left-2 top-1 z-10 text-2xs text-muted-foreground">
          <span className="font-medium text-foreground">Delta</span> <span>estimated buy − sell per bar</span>
        </div>
        <svg viewBox={`0 0 ${W} ${PANE_H}`} preserveAspectRatio="none" className="block w-full" style={{ height: PANE_H }} role="img" aria-label="Estimated delta per bar">
          <line x1={0} x2={CHART_W} y1={PANE_H / 2} y2={PANE_H / 2} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />
          {data.bars.map((b, i) => {
            const h = (Math.abs(b.delta) / maxBarD) * (PANE_H / 2 - 6);
            const w = Math.max(step * 0.62, 0.8);
            return <rect key={i} x={x(i) - w / 2} y={b.delta >= 0 ? PANE_H / 2 - h : PANE_H / 2} width={w} height={Math.max(h, 0.5)} fill={b.delta >= 0 ? "hsl(var(--up))" : "hsl(var(--down))"} fillOpacity={0.75} />;
          })}
          <line x1={crossX} x2={crossX} y1={0} y2={PANE_H} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="relative mt-1 border-t border-border">
        <div className="pointer-events-none absolute left-2 top-1 z-10 flex gap-3 text-2xs text-muted-foreground">
          <span className="font-medium text-foreground">CVD</span>
          <span className={cn("font-mono", cvd[idx] >= 0 ? "text-up" : "text-down")}>{compact(cvd[idx])}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${PANE_H}`} preserveAspectRatio="none" className="block w-full" style={{ height: PANE_H }} role="img" aria-label="Cumulative volume delta">
          <path d={cvdPath} fill="none" stroke="hsl(var(--accent))" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          <line x1={crossX} x2={crossX} y1={0} y2={PANE_H} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

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
