import type { LucideIcon } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn } from "@/lib/utils";
import { dash, inr, num, pct } from "@/components/analyzer/dossier/shared";

export type Any = any;

/** Safe deep read: g(obj, "a", "b") is obj?.a?.b. */
export const g = (o: Any, ...path: string[]): Any => path.reduce((x, k) => (x == null ? undefined : x[k]), o);

export const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One line of a comparison: a label, what each side shows, and (optionally) which direction is better. */
export interface CmpRow {
  label: string;
  a: React.ReactNode;
  b: React.ReactNode;
  av?: number | null;
  bv?: number | null;
  /** "high" if a larger number is the stronger reading, "low" if a smaller one is. Omit when neither is clearly better. */
  better?: "high" | "low";
  hint?: string;
}

export const numRow = (label: string, av: unknown, bv: unknown, fmt: (v: number | null) => string, better?: "high" | "low", hint?: string): CmpRow => ({
  label,
  a: fmt(n(av)),
  b: fmt(n(bv)),
  av: n(av),
  bv: n(bv),
  better,
  hint,
});

export const txtRow = (label: string, a: unknown, b: unknown, hint?: string): CmpRow => ({
  label,
  a: a == null || a === "" ? dash : String(a),
  b: b == null || b === "" ? dash : String(b),
  hint,
});

// Common formatters, all returning an em dash for a missing value
export const fInr = (d = 2) => (v: number | null) => inr(v, d);
export const fNum = (d = 2) => (v: number | null) => num(v, d);
/** A figure already expressed in percent. */
export const fPct = (d = 1) => (v: number | null) => pct(v, d);
/** A fraction (0.12) shown as percent. */
export const fFrac = (d = 1) => (v: number | null) => (v == null ? dash : `${(v * 100).toFixed(d)}%`);
/** Whole numbers with Indian digit grouping, for large reported amounts. */
export const fBig = (v: number | null) => (v == null ? dash : Math.round(v).toLocaleString("en-IN"));
export const fPlain = (v: number | null) => (v == null ? dash : String(v));
export const fX = (d = 1) => (v: number | null) => (v == null ? dash : `${v.toFixed(d)}x`);

function winner(r: CmpRow): "a" | "b" | null {
  if (!r.better || r.av == null || r.bv == null || r.av === r.bv) return null;
  const aHigher = r.av > r.bv;
  return (r.better === "high") === aHigher ? "a" : "b";
}

/** Two companies down a list of measures, with the stronger reading marked where that has a clear meaning. */
export function CompareSection({
  title,
  subtitle,
  icon,
  rows,
  nameA,
  nameB,
  footnote,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  rows: CmpRow[];
  nameA: string;
  nameB: string;
  footnote?: string;
}) {
  const shown = rows.filter((r) => !(r.a === dash && r.b === dash));
  if (shown.length === 0) return null;
  return (
    <DataCard title={title} subtitle={subtitle} icon={icon} footnote={footnote}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Measure</th>
              <th className="px-4 py-2 text-right font-medium text-accent">{nameA}</th>
              <th className="px-4 py-2 text-right font-medium text-flat">{nameB}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const w = winner(r);
              return (
                <tr key={`${r.label}-${i}`} className="border-b border-border/60 align-top last:border-0">
                  <td className="px-4 py-2">
                    {r.label}
                    {r.hint ? <span className="mt-0.5 block text-2xs text-muted-foreground">{r.hint}</span> : null}
                  </td>
                  <td className={cn("px-4 py-2 text-right font-mono tabular-nums", w === "a" && "font-semibold text-foreground")}>
                    {w === "a" ? <span aria-label="stronger" className="mr-1.5 text-accent">▲</span> : null}
                    {r.a}
                  </td>
                  <td className={cn("px-4 py-2 text-right font-mono tabular-nums", w === "b" && "font-semibold text-foreground")}>
                    {w === "b" ? <span aria-label="stronger" className="mr-1.5 text-flat">▲</span> : null}
                    {r.b}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}

/** The union of two indicator tables, matched by name, showing each side's signal. */
export function indicatorRows(a: Any[] | undefined, b: Any[] | undefined, nameKey = "Indicator", signalKey = "Signal", valueKey = "Value"): CmpRow[] {
  const names: string[] = [];
  for (const t of [a ?? [], b ?? []]) for (const r of t) if (r?.[nameKey] && !names.includes(r[nameKey])) names.push(r[nameKey]);
  const find = (t: Any[] | undefined, name: string) => (t ?? []).find((r) => r?.[nameKey] === name);
  return names.map((name) => {
    const ra = find(a, name);
    const rb = find(b, name);
    const f = (r: Any) => (r ? `${r[valueKey] ?? ""} ${r[signalKey] ? `· ${r[signalKey]}` : ""}`.trim() || dash : dash);
    return { label: name, a: f(ra), b: f(rb) };
  });
}
