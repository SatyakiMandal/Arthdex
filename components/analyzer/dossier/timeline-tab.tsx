"use client";

import { useMemo, useState } from "react";
import { BarChart3, LineChart } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn } from "@/lib/utils";
import type { ListedSummary } from "@/types/analyzer";
import { Empty, num } from "./shared";

const W = 1000;

function pathOf(v: (number | null)[], x: (i: number) => number, y: (n: number) => number) {
  let d = "";
  let pen = false;
  v.forEach((n, i) => {
    if (n == null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(n).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/** The report's Timeline: rebased price against its benchmark, and the day-by-day abnormal return. */
export function TimelineTab({ s }: { s: ListedSummary }) {
  const t = s.detail.timeline;
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (!t) return null;
    const n = t.dates.length;
    const vals = [...t.priceRebased, ...t.benchRebased].filter((v): v is number => v != null);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || 1;
    const ab = t.abnormal.filter((v): v is number => v != null).map((v) => v * 100);
    const abMax = Math.max(Math.abs(Math.min(...ab)), Math.abs(Math.max(...ab)), (t.hurdle ?? 0) * 100 * 1.15, 0.5);
    return { n, lo: lo - pad, hi: hi + pad, abMax };
  }, [t]);

  if (!t || !geo) {
    return (
      <DataCard title="Timeline" icon={LineChart}>
        <Empty>No daily price series was stored for this run.</Empty>
      </DataCard>
    );
  }

  const { n, lo, hi, abMax } = geo;
  const step = W / n;
  const x = (i: number) => (i + 0.5) * step;
  const H1 = 300;
  const H2 = 190;
  const y1 = (v: number) => 14 + (1 - (v - lo) / (hi - lo)) * (H1 - 28);
  const y2 = (v: number) => H2 / 2 - (v / abMax) * (H2 / 2 - 14);
  const idx = hover ?? n - 1;
  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };
  const cx = x(idx);
  const hurdle = (t.hurdle ?? 0) * 100;
  const rel = (t.priceRebased[idx] ?? 0) - (t.benchRebased[idx] ?? 0);
  const ticks = Array.from({ length: 6 }, (_, k) => Math.round((k / 5) * (n - 1)));

  return (
    <div className="space-y-4" onMouseMove={move} onMouseLeave={() => setHover(null)}>
      <DataCard
        title={`${s.company} vs ${t.benchmark ?? "benchmark"}`}
        subtitle="Both rebased to 100 at the start of the window"
        icon={LineChart}
        badge={
          <span className="font-mono text-2xs text-muted-foreground">
            {t.dates[idx]} · stock {num(t.priceRebased[idx], 1)} · index {num(t.benchRebased[idx], 1)} ·{" "}
            <span className={rel >= 0 ? "text-up" : "text-down"}>{rel >= 0 ? "+" : ""}{rel.toFixed(1)} pts vs index</span>
          </span>
        }
        footnote="The gap between the two lines is the stock's performance relative to the market over the window."
      >
        <div className="relative px-2 pb-6 pt-2">
          <svg viewBox={`0 0 ${W} ${H1}`} preserveAspectRatio="none" className="block w-full" style={{ height: H1 }} role="img" aria-label="Rebased price against benchmark">
            {[0.2, 0.4, 0.6, 0.8].map((g) => (
              <line key={g} x1={0} x2={W} y1={H1 * g} y2={H1 * g} stroke="hsl(var(--border))" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={W} y1={y1(100)} y2={y1(100)} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={`${pathOf(t.priceRebased, x, y1)} L${x(n - 1)} ${H1} L${x(0)} ${H1} Z`} fill="hsl(var(--accent))" fillOpacity={0.07} stroke="none" />
            <path d={pathOf(t.benchRebased, x, y1)} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.4} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            <path d={pathOf(t.priceRebased, x, y1)} fill="none" stroke="hsl(var(--accent))" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1={cx} x2={cx} y1={0} y2={H1} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((g) => (
            <span key={g} className="pointer-events-none absolute right-3 font-mono text-2xs text-muted-foreground" style={{ top: `calc(${g * 100}% * ${(H1 - 28) / H1} + 10px)` }}>
              {(hi - g * (hi - lo)).toFixed(0)}
            </span>
          ))}
          <div className="absolute bottom-0 left-2 right-2 h-5">
            {ticks.map((i) => (
              <span key={i} className={cn("absolute font-mono text-2xs text-muted-foreground", i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${(x(i) / W) * 100}%` }}>
                {t.dates[i].slice(5)}
              </span>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-4 px-2 text-2xs text-muted-foreground">
            <span><span className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: "hsl(var(--accent))" }} />{s.company}</span>
            <span><span className="mr-1.5 inline-block h-0 w-4 border-t border-dashed border-muted-foreground align-middle" />{t.benchmark}</span>
          </div>
        </div>
      </DataCard>

      <DataCard
        title="Abnormal return"
        subtitle="The stock's daily move with the market's move removed (%)"
        icon={BarChart3}
        badge={<span className="font-mono text-2xs text-muted-foreground">±{hurdle.toFixed(1)}% = 1.5σ hurdle</span>}
        footnote="Bars outside the dashed hurdle lines are unusually large moves for this stock, whatever the market did that day."
      >
        <div className="relative px-2 pb-6 pt-2">
          <svg viewBox={`0 0 ${W} ${H2}`} preserveAspectRatio="none" className="block w-full" style={{ height: H2 }} role="img" aria-label="Abnormal returns">
            <line x1={0} x2={W} y1={y2(0)} y2={y2(0)} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />
            {[hurdle, -hurdle].map((h) => (
              <line key={h} x1={0} x2={W} y1={y2(h)} y2={y2(h)} stroke="hsl(var(--flat))" strokeOpacity={0.8} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            ))}
            {t.abnormal.map((v, i) => {
              if (v == null) return null;
              const p = v * 100;
              const big = Math.abs(p) >= hurdle;
              return (
                <rect
                  key={i}
                  x={x(i) - Math.max(step * 0.66, 0.8) / 2}
                  y={Math.min(y2(p), y2(0))}
                  width={Math.max(step * 0.66, 0.8)}
                  height={Math.max(Math.abs(y2(p) - y2(0)), 0.6)}
                  fill={p >= 0 ? "hsl(var(--up))" : "hsl(var(--down))"}
                  fillOpacity={big ? 1 : 0.55}
                  stroke={big ? "hsl(var(--flat))" : "none"}
                  strokeWidth={big ? 1 : 0}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            <line x1={cx} x2={cx} y1={0} y2={H2} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="pointer-events-none absolute left-4 top-2 font-mono text-2xs text-muted-foreground">
            {t.dates[idx]} · {t.abnormal[idx] == null ? "—" : `${(t.abnormal[idx]! * 100 >= 0 ? "+" : "")}${(t.abnormal[idx]! * 100).toFixed(2)}%`}
          </p>
        </div>
      </DataCard>

      {t.volume.length > 0 ? (
        <DataCard title="Traded volume" subtitle="Shares traded each day" icon={BarChart3}>
          <div className="px-2 py-2">
            <svg viewBox={`0 0 ${W} 90`} preserveAspectRatio="none" className="block w-full" style={{ height: 90 }} role="img" aria-label="Daily volume">
              {(() => {
                const mx = Math.max(...t.volume.map((v) => v ?? 0), 1);
                return t.volume.map((v, i) => (
                  <rect key={i} x={x(i) - Math.max(step * 0.66, 0.8) / 2} y={86 - ((v ?? 0) / mx) * 80} width={Math.max(step * 0.66, 0.8)} height={((v ?? 0) / mx) * 80} fill="hsl(var(--accent))" fillOpacity={0.45} />
                ));
              })()}
            </svg>
          </div>
        </DataCard>
      ) : null}
    </div>
  );
}
