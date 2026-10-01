import { cn, formatCrore } from "@/lib/utils";

export const num = (v: number | null | undefined, d = 2) =>
  v == null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v: number | null | undefined, d = 2) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
export const cr = (v: number | null | undefined) => (v == null ? "—" : formatCrore(v));
export const big = (v: number | null | undefined) => {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  return v.toLocaleString("en-IN");
};

export function StatList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-border/60 text-[0.8125rem]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3 px-4 py-1.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className={cn("text-right font-mono tabular-nums", v === "—" && "text-muted-foreground")}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Dated multi-series line chart. Hand-rolled SVG so it follows the theme tokens. */
export function LineChart({
  dates,
  series,
  height = 260,
  baseline,
  fmt = (v: number) => v.toFixed(0),
}: {
  dates: string[];
  series: { label: string; color: string; values: (number | null)[]; bold?: boolean }[];
  height?: number;
  baseline?: number;
  fmt?: (v: number) => string;
}) {
  const W = 800;
  const padL = 46;
  const padB = 20;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (all.length < 2 || dates.length < 2) return <p className="p-4 text-sm text-muted-foreground">Not enough history to chart.</p>;
  let lo = Math.min(...all, baseline ?? Infinity);
  let hi = Math.max(...all, baseline ?? -Infinity);
  const m = (hi - lo) * 0.05 || 1;
  lo -= m;
  hi += m;
  const x = (i: number) => padL + (i / (dates.length - 1)) * (W - padL - 6);
  const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo)) * (height - padB - 6);
  const ticks = [0, 1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 4);
  const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (dates.length - 1)));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Line chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 6} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
              {fmt(t)}
            </text>
          </g>
        ))}
        {baseline != null ? <line x1={padL} x2={W - 6} y1={y(baseline)} y2={y(baseline)} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1} /> : null}
        {xt.map((i) => (
          <text key={i} x={x(i)} y={height - 5} textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"} className="fill-muted-foreground" fontSize={10}>
            {dates[i]}
          </text>
        ))}
        {series.map((s) => {
          let d = "";
          let pen = false;
          s.values.forEach((v, i) => {
            if (v == null) {
              pen = false;
              return;
            }
            d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
            pen = true;
          });
          return <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth={s.bold ? 2 : 1.4} strokeLinejoin="round" />;
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-2xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  items,
  height = 160,
  fmt = (v: number) => v.toFixed(0),
}: {
  items: { label: string; value: number; color?: string; ghost?: number | null }[];
  height?: number;
  fmt?: (v: number) => string;
}) {
  const vals = items.flatMap((i) => [i.value, i.ghost ?? 0]);
  const hi = Math.max(...vals, 0);
  const lo = Math.min(...vals, 0);
  const span = hi - lo || 1;
  const W = 800;
  const bw = Math.min(40, (W / items.length) * 0.55);
  const y = (v: number) => 12 + (1 - (v - lo) / span) * (height - 36);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Bar chart">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="hsl(var(--border))" />
      {items.map((it, i) => {
        const cx = ((i + 0.5) / items.length) * W;
        const top = Math.min(y(it.value), y(0));
        return (
          <g key={it.label + i}>
            {it.ghost != null ? <rect x={cx - bw / 2 - 4} width={bw + 8} y={Math.min(y(it.ghost), y(0))} height={Math.abs(y(it.ghost) - y(0))} rx={3} fill="none" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" /> : null}
            <rect x={cx - bw / 2} width={bw} y={top} height={Math.max(Math.abs(y(it.value) - y(0)), 1)} rx={3} fill={it.color ?? "hsl(var(--accent))"} opacity={0.9} />
            <text x={cx} y={it.value >= 0 ? top - 3 : top + Math.abs(y(it.value) - y(0)) + 11} textAnchor="middle" className="fill-foreground" fontSize={10}>
              {fmt(it.value)}
            </text>
            <text x={cx} y={height - 4} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
