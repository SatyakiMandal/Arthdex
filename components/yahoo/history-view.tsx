"use client";

import { useMemo, useState } from "react";
import { Download, GitCompare, History } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ApiYCompare, ApiYHistory } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { LineChart, num } from "./shared";

type Mode = "price" | "compare";
type Range = "1M" | "3M" | "6M" | "1Y" | "5Y";
const DAYS: Record<Range, number> = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366, "5Y": 1830 };
const COLORS = ["hsl(var(--accent))", "#fb923c", "#22d3ee", "#a78bfa", "#f472b6", "#facc15", "#34d399"];

export function HistoryView({ history, compare }: { history: ApiYHistory; compare: ApiYCompare | null }) {
  const [range, setRange] = useState<Range>("1Y");
  const [mode, setMode] = useState<Mode>("price");

  const rows = useMemo(() => {
    const cut = new Date(Date.now() - DAYS[range] * 86_400_000).toISOString().slice(0, 10);
    return history.rows.filter((r) => r.date >= cut);
  }, [history, range]);
  const asc = useMemo(() => [...rows].reverse(), [rows]);

  // rebase every compared series to 100 at the first date inside the selected range
  const cmp = useMemo(() => {
    if (!compare) return null;
    const cut = new Date(Date.now() - DAYS[range] * 86_400_000).toISOString().slice(0, 10);
    const start = compare.dates.findIndex((d) => d >= cut);
    if (start < 0) return null;
    return {
      dates: compare.dates.slice(start),
      series: compare.series.map((sr, i) => {
        const vals = sr.values.slice(start);
        const base = vals.find((v): v is number => v != null);
        const rebased = vals.map((v) => (v == null || !base ? null : (v / base) * 100));
        const end = rebased.filter((v): v is number => v != null).at(-1);
        return {
          label: `${sr.label}${end != null ? ` (${end - 100 > 0 ? "+" : ""}${(end - 100).toFixed(1)}%)` : ""}`,
          color: COLORS[i % COLORS.length],
          values: rebased,
          bold: sr.key === compare.symbol,
        };
      }),
    };
  }, [compare, range]);

  const first = asc[0]?.close;
  const last = asc.at(-1)?.close;
  const ret = first && last ? (last / first - 1) * 100 : null;
  const hi = asc.length ? Math.max(...asc.map((r) => r.high ?? r.close)) : null;
  const lo = asc.length ? Math.min(...asc.map((r) => r.low ?? r.close)) : null;

  function csv() {
    const head = "Date,Open,High,Low,Close,Adj Close,Volume,Dividend,Split";
    const body = rows.map((r) => [r.date, r.open, r.high, r.low, r.close, r.adjClose, r.volume, r.dividend ?? "", r.split ?? ""].join(","));
    const url = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${history.symbol}-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <DataCard
        title={mode === "price" ? "Price history" : "Performance vs Nifty 50"}
        subtitle={mode === "price" ? "Daily close, ₹" : "Rebased to 100 at the start of the selected range"}
        icon={mode === "price" ? History : GitCompare}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            {compare ? (
              <SegmentedControl<Mode> layoutGroupId="hist-mode" value={mode} onChange={setMode} options={[{ id: "price", label: "Price" }, { id: "compare", label: "vs Nifty 50" }]} />
            ) : null}
            <SegmentedControl<Range> layoutGroupId="hist-range" value={range} onChange={setRange} options={(Object.keys(DAYS) as Range[]).map((r) => ({ id: r, label: r }))} />
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-px border-b border-border bg-border/60 sm:grid-cols-4">
          {[
            ["Change over range", ret != null ? `${ret > 0 ? "+" : ""}${ret.toFixed(2)}%` : "—", ret],
            ["High", num(hi), null],
            ["Low", num(lo), null],
            ["Sessions", String(asc.length), null],
          ].map(([k, v, tone]) => (
            <div key={String(k)} className="bg-surface px-3 py-2">
              <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className={cn("font-mono text-base font-semibold tabular-nums", tone != null && ((tone as number) >= 0 ? "text-up" : "text-down"))}>{v}</p>
            </div>
          ))}
        </div>
        <div className="px-2 pt-3">
          {mode === "compare" && cmp ? (
            <LineChart dates={cmp.dates} baseline={100} series={cmp.series} />
          ) : (
            <LineChart dates={asc.map((r) => r.date)} fmt={(v) => v.toFixed(0)} series={[{ label: `${history.symbol} close`, color: "hsl(var(--accent))", values: asc.map((r) => r.close), bold: true }]} />
          )}
        </div>
      </DataCard>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="text-sm font-semibold">Historical data</h3>
          <button type="button" onClick={csv} className="btn inline-flex items-center gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </header>
        <div className="max-h-[560px] overflow-auto">
          <table className="data-table yf-table w-full text-left text-[0.8125rem]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                <th>Date</th>
                {["Open", "High", "Low", "Close", "Adj close", "Volume"].map((h) => (
                  <th key={h} className="text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td className="whitespace-nowrap">
                    {r.date}
                    {r.dividend ? <span className="ml-2 rounded bg-accent/15 px-1.5 text-2xs text-accent">Div {r.dividend}</span> : null}
                    {r.split ? <span className="ml-2 rounded bg-flat/20 px-1.5 text-2xs">Split {r.split}</span> : null}
                  </td>
                  {[r.open, r.high, r.low, r.close, r.adjClose].map((v, i) => (
                    <td key={i} className="text-right font-mono tabular-nums">
                      {num(v)}
                    </td>
                  ))}
                  <td className="text-right font-mono tabular-nums">{r.volume != null ? r.volume.toLocaleString("en-IN") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
