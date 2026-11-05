"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Compass, Info, ShieldAlert, Sparkles, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiIndexRebalance, ApiIndexRebalanceCandidate } from "@/lib/api/types";

export function IndexRebalanceTable({
  initialData,
}: {
  initialData: ApiIndexRebalance;
}) {
  const [selectedIndex, setSelectedIndex] = useState<string>("ALL");
  const candidates = initialData.candidates ?? [];

  const filtered = selectedIndex === "ALL"
    ? candidates
    : candidates.filter((c) => c.index === selectedIndex);

  return (
    <div className="space-y-4">
      {/* Modelled Forecast Disclaimer */}
      <div className="rounded-none border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground text-2xs uppercase tracking-wider">
            QUANTITATIVE MODEL FORECAST · PREDICTIVE ESTIMATES
          </span>
          <p className="text-3xs leading-relaxed text-muted-foreground">
            Inclusions, exclusions, and passive fund flow estimates are algorithmically modelled from NSE Indices&apos; semi-annual review criteria (6-month average free-float market capitalization, F&amp;O segment eligibility, and liquidity). They are quantitative predictions and <strong>not official exchange circulars</strong>.
          </p>
        </div>
      </div>

      {/* Index review overview bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span>
            Upcoming Cycle: <strong className="text-foreground">{initialData.reviewName}</strong>
          </span>
          <span className="text-border">|</span>
          <span>Effective Date: <strong className="text-foreground">{initialData.effectiveDate}</strong></span>
          <span className="text-border">|</span>
          <span>Data Cutoff: <strong className="text-foreground">{initialData.dataCutoffDate}</strong></span>
        </div>
        <div className="text-2xs font-mono">
          Passive ETF AUM Tracked: <strong>₹{(initialData.totalPassiveAumTrackedCr / 1000).toFixed(1)}k Cr</strong>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5">
        {["ALL", "NIFTY 50", "BANK NIFTY", "NIFTY NEXT 50"].map((idx) => (
          <button
            key={idx}
            onClick={() => setSelectedIndex(idx)}
            className={cn(
              "rounded-none px-2.5 py-1 text-2xs font-mono font-semibold uppercase tracking-wider transition-colors duration-150",
              selectedIndex === idx
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {idx === "ALL" ? `All Candidates (${candidates.length})` : idx}
          </button>
        ))}
      </div>

      {/* Candidates Table */}
      <div className="overflow-x-auto rounded-none border border-border bg-card">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-2xs text-muted-foreground uppercase tracking-wider">
              <th className="p-3 font-semibold">Index</th>
              <th className="p-3 font-semibold">Scrip</th>
              <th className="p-3 text-center font-semibold">Action</th>
              <th className="p-3 text-center font-semibold">Probability</th>
              <th className="p-3 text-right font-semibold">Est Weight</th>
              <th className="p-3 text-right font-semibold">Est Flow (₹ Cr)</th>
              <th className="p-3 text-right font-semibold">Days to Cover</th>
              <th className="p-3 text-left font-semibold">Catalyst &amp; Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 font-mono">
            {filtered.map((c) => {
              const isInclusion = c.direction === "INCLUSION";
              return (
                <tr key={`${c.index}-${c.symbol}`} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-sans">
                    <span className="rounded bg-secondary px-2 py-0.5 text-3xs font-semibold text-secondary-foreground">
                      {c.index}
                    </span>
                  </td>
                  <td className="p-3 font-sans">
                    <Link
                      href={`/company/${c.symbol}`}
                      className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      {c.symbol}
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                    <div className="text-3xs text-muted-foreground line-clamp-1">{c.name}</div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border",
                        isInclusion
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-400 border-rose-500/40",
                      )}
                    >
                      {c.direction}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="inline-flex items-center gap-1.5 font-bold">
                      <span className={cn(c.probabilityPct >= 85 ? "text-emerald-500" : "text-amber-500")}>
                        {c.probabilityPct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-foreground font-medium">
                    {c.estWeightPct.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={cn(
                        "font-bold text-xs",
                        c.estFlowCr > 0 ? "text-emerald-500" : "text-rose-500",
                      )}
                    >
                      {c.estFlowCr > 0 ? "+" : ""}₹{Math.abs(c.estFlowCr).toLocaleString("en-IN")} Cr
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-2xs font-bold",
                        c.daysToCover && c.daysToCover >= 5.0
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.daysToCover ? `${c.daysToCover.toFixed(1)} days` : "—"}
                    </span>
                  </td>
                  <td className="p-3 font-sans text-2xs text-muted-foreground max-w-xs">
                    {c.catalyst}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rules Footnote */}
      <div className="rounded-none border border-border/80 bg-muted/20 p-3 text-2xs text-muted-foreground space-y-1 font-sans">
        <div className="font-semibold text-foreground flex items-center gap-1.5 text-2xs uppercase tracking-wider">
          <Zap className="h-3.5 w-3.5 text-primary" /> NSE Indices Methodology Guide
        </div>
        <ul className="list-disc pl-4 space-y-0.5 text-2xs">
          {initialData.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
