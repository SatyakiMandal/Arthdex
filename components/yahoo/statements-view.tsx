"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ApiYStatements, YStatementFrame } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { BarChart } from "./shared";

type Kind = "income" | "balance" | "cashflow";
type Freq = "annual" | "quarterly";

const HEADLINE: Record<Kind, string[]> = {
  income: ["Total Revenue", "Gross Profit", "Operating Income", "EBITDA", "Net Income"],
  balance: ["Total Assets", "Total Debt", "Stockholders Equity", "Cash And Cash Equivalents"],
  cashflow: ["Operating Cash Flow", "Investing Cash Flow", "Financing Cash Flow", "Free Cash Flow"],
};

const fmt = (v: number | null, perShare: boolean) =>
  v == null ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: perShare ? 2 : 0 });

export function StatementsView({ data }: { data: ApiYStatements }) {
  const [kind, setKind] = useState<Kind>("income");
  const [freq, setFreq] = useState<Freq>("annual");
  const [pick, setPick] = useState<string | null>(null);

  const frame: YStatementFrame | null = data[kind][freq] ?? data[kind][freq === "annual" ? "quarterly" : "annual"];
  const shownFreq: Freq = data[kind][freq] ? freq : freq === "annual" ? "quarterly" : "annual";

  const headline = useMemo(() => (frame ? HEADLINE[kind].find((l) => frame.rows.some((r) => r.label === l)) ?? frame.rows[0]?.label : undefined), [frame, kind]);
  const chartLabel = pick && frame?.rows.some((r) => r.label === pick) ? pick : headline;
  const row = frame?.rows.find((r) => r.label === chartLabel);

  const dates = frame ? [...frame.dates].reverse() : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Kind>
          layoutGroupId="stmt-kind"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPick(null);
          }}
          options={[
            { id: "income", label: "Income statement" },
            { id: "balance", label: "Balance sheet" },
            { id: "cashflow", label: "Cash flow" },
          ]}
        />
        <SegmentedControl<Freq>
          layoutGroupId="stmt-freq"
          value={shownFreq}
          onChange={setFreq}
          options={[
            { id: "annual", label: "Annual" },
            { id: "quarterly", label: "Quarterly" },
          ]}
        />
        <span className="text-2xs text-muted-foreground">₹ crore unless a row is per-share. Click a row to chart it.</span>
      </div>

      {!frame ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">Yahoo Finance has no {kind === "cashflow" ? "cash flow" : kind === "balance" ? "balance sheet" : "income statement"} for this company.</p>
      ) : (
        <>
          {row ? (
            <DataCard title={row.label} subtitle={`${shownFreq === "annual" ? "Annual" : "Quarterly"}, oldest to latest`} icon={FileSpreadsheet}>
              <div className="p-4">
                <BarChart
                  items={[...row.values].reverse().map((v, i) => ({
                    label: dates[i]?.slice(shownFreq === "annual" ? 0 : 2, 7) ?? "",
                    value: v ?? 0,
                    color: (v ?? 0) >= 0 ? "hsl(var(--accent))" : "hsl(var(--down))",
                  }))}
                  fmt={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(row.perShare ? 1 : 0))}
                />
              </div>
            </DataCard>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="data-table yf-table w-full text-left text-[0.8125rem]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface">Breakdown</th>
                    {frame.dates.map((d) => (
                      <th key={d} className="whitespace-nowrap text-right">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {frame.rows.map((r) => (
                    <tr key={r.label} onClick={() => setPick(r.label)} className={cn("cursor-pointer", r.label === chartLabel && "bg-accent/10")}>
                      <td className={cn("sticky left-0 whitespace-nowrap bg-surface font-medium", HEADLINE[kind].includes(r.label) && "text-foreground", r.label === chartLabel && "bg-accent/10")}>{r.label}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className={cn("whitespace-nowrap text-right font-mono tabular-nums", v != null && v < 0 && "text-down")}>
                          {fmt(v, r.perShare)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
