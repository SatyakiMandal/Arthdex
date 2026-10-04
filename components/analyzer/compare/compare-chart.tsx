"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface CmpSeries {
  name: string;
  /** Tailwind-independent CSS colour, so the line matches the legend in both themes. */
  color: string;
  points: { date: string; value: number }[];
  /** Draw as a step (a dealer price that is revised, not traded). */
  step?: boolean;
  dashed?: boolean;
}

const W = 760;
const H = 300;
const PAD = 14;

/**
 * Each series rebased to 100 on the first date they all cover, on one time axis.
 * Hovering reads every line at the same date.
 */
export function CompareChart({ series, title }: { series: CmpSeries[]; title?: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const live = series.filter((s) => s.points.length >= 2);
    if (live.length === 0) return null;
    const t = (d: string) => new Date(d).getTime();
    const start = Math.max(...live.map((s) => t(s.points[0].date)));
    const end = Math.min(...live.map((s) => t(s.points[s.points.length - 1].date)));
    if (!(end > start)) return null;

    const valueAt = (s: CmpSeries, time: number) => {
      let v = s.points[0].value;
      for (const p of s.points) {
        if (t(p.date) <= time) v = p.value;
        else break;
      }
      return v;
    };
    const rebased = live.map((s) => {
      const base = valueAt(s, start);
      const pts = [
        { time: start, v: 100 },
        ...s.points.filter((p) => t(p.date) > start && t(p.date) <= end).map((p) => ({ time: t(p.date), v: (p.value / base) * 100 })),
      ];
      return { s, base, pts };
    });
    const all = rebased.flatMap((r) => r.pts.map((p) => p.v));
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const span = hi - lo || 1;
    const x = (time: number) => ((time - start) / (end - start)) * W;
    const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
    const paths = rebased.map((r) => {
      let d = "";
      r.pts.forEach((p, i) => {
        const px = x(p.time).toFixed(1);
        const py = y(p.v).toFixed(1);
        d += i === 0 ? `M ${px} ${py}` : r.s.step ? ` H ${px} V ${py}` : ` L ${px} ${py}`;
      });
      return { s: r.s, d, base: r.base };
    });
    return { start, end, lo, hi, x, y, paths, valueAt, rebased, t };
  }, [series]);

  if (!model) {
    return <p className="p-4 text-sm text-muted-foreground">The two companies share no overlapping price history to chart.</p>;
  }

  const atTime = hover === null ? model.end : model.start + hover * (model.end - model.start);
  const readout = model.rebased.map((r) => ({ s: r.s, v: (model.valueAt(r.s, atTime) / r.base) * 100 }));
  const dateLabel = new Date(atTime).toISOString().slice(0, 10);

  return (
    <figure className="p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{title ?? "Price, rebased to 100"}</span>
        <span className="font-mono text-2xs text-muted-foreground">{dateLabel}</span>
      </figcaption>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {readout.map(({ s, v }) => (
          <span key={s.name} className="inline-flex items-center gap-2 text-xs">
            <span className="h-0.5 w-5 rounded" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />
            <span className="text-muted-foreground">{s.name}</span>
            <span className={cn("font-mono tabular-nums", v >= 100 ? "text-up" : "text-down")}>{v.toFixed(1)}</span>
          </span>
        ))}
      </div>

      <div
        className="relative mt-3 cursor-crosshair touch-pan-y"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-64 w-full" role="img" aria-label="Rebased price comparison">
          <line x1="0" x2={W} y1={model.y(100)} y2={model.y(100)} stroke="hsl(var(--border))" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          {model.paths.map(({ s, d }) => (
            <path
              key={s.name}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 1.4 : 2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {hover !== null ? <span className="pointer-events-none absolute inset-y-0 w-px bg-foreground/25" style={{ left: `${hover * 100}%` }} aria-hidden /> : null}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-between py-1">
          {[model.hi, model.lo].map((v, i) => (
            <span key={i} className="rounded bg-surface/80 px-1 font-mono text-2xs text-muted-foreground">
              {v.toFixed(0)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
