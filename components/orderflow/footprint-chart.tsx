"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ApiOrderflow } from "@/lib/api/types";

function short(v: number): string {
  const a = Math.abs(v);
  return a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : `${a}`;
}

function stamp(t: string, intraday: boolean): string {
  return intraday ? t.slice(11, 16) : t.slice(5);
}

/**
 * Bid x ask footprint. Cells are modelled from bars (see the page note), so the
 * grid shows where each bar's volume most plausibly traded, not recorded fills.
 */
export function FootprintChart({ data }: { data: ApiOrderflow }) {
  const { bars, step } = data.footprint;
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;

  const { rows, maxCell, stacked } = useMemo(() => {
    const set = new Map<number, number>();
    let mx = 1;
    for (const b of bars)
      for (const l of b.levels) {
        const key = Math.round(l.p / step);
        set.set(key, l.p);
        mx = Math.max(mx, l.buy + l.sell);
      }
    const rowsDesc = [...set.entries()].sort((a, b) => b[0] - a[0]);
    const stackedSet = new Set<string>();
    // three or more imbalanced rows in a row on one side is a stacked imbalance
    for (const b of bars) {
      for (const side of ["bImb", "sImb"] as const) {
        let run: number[] = [];
        const flush = () => {
          if (run.length >= 3) run.forEach((k) => stackedSet.add(`${b.i}:${k}`));
          run = [];
        };
        for (const [key] of [...rowsDesc].reverse()) {
          const lv = b.levels.find((l) => Math.round(l.p / step) === key);
          if (lv && lv[side]) run.push(key);
          else flush();
        }
        flush();
      }
    }
    return { rows: rowsDesc, maxCell: mx, stacked: stackedSet };
  }, [bars, step]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 font-mono text-[10px] leading-none">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-right font-medium text-muted-foreground">Price</th>
            {bars.map((b) => (
              <th key={b.i} className={cn("min-w-[74px] px-1 py-1.5 text-center font-medium", b.c >= b.o ? "text-up" : "text-down")}>
                {stamp(b.t, data.intraday)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, price]) => (
            <tr key={key}>
              <td className="sticky left-0 z-10 bg-surface px-2 py-[3px] text-right text-muted-foreground">{price.toFixed(decimals)}</td>
              {bars.map((b) => {
                const lv = b.levels.find((l) => Math.round(l.p / step) === key);
                if (!lv) return <td key={b.i} className="border-l border-border/40" />;
                const heat = Math.min((lv.buy + lv.sell) / maxCell, 1);
                const isPoc = b.poc != null && Math.round(b.poc / step) === key;
                const isStacked = stacked.has(`${b.i}:${key}`);
                return (
                  <td
                    key={b.i}
                    className={cn("border-l border-border/40 px-1 py-[3px] text-center", isPoc && "outline outline-1 -outline-offset-1 outline-[#fbbf24]")}
                    style={{ background: `hsl(var(--accent) / ${(0.05 + heat * 0.3).toFixed(3)})` }}
                    title={`${price.toFixed(decimals)}  sell ${lv.sell.toLocaleString("en-IN")} × buy ${lv.buy.toLocaleString("en-IN")}`}
                  >
                    <span className={cn(lv.sImb ? "font-bold text-down" : "text-muted-foreground")}>{short(lv.sell)}</span>
                    <span className="mx-0.5 text-muted-foreground/50">×</span>
                    <span className={cn(lv.bImb ? "font-bold text-up" : "text-muted-foreground")}>{short(lv.buy)}</span>
                    {isStacked ? <span className="ml-0.5 text-flat">▮</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-right text-muted-foreground">Δ</td>
            {bars.map((b) => (
              <td key={b.i} className={cn("border-l border-border/40 px-1 py-1.5 text-center font-semibold", b.delta >= 0 ? "text-up" : "text-down")}>
                {b.delta >= 0 ? "+" : "-"}
                {short(b.delta)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-right text-muted-foreground">Vol</td>
            {bars.map((b) => (
              <td key={b.i} className="border-l border-border/40 px-1 py-1.5 text-center text-muted-foreground">
                {short(b.volume)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
