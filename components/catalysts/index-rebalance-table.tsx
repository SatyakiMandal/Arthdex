"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Compass, Globe, Info, ShieldAlert, Sparkles, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiIndexRebalance, ApiIndexRebalanceCandidate } from "@/lib/api/types";

const INDEX_TABS = [
  { id: "ALL", label: "All Candidates" },
  { id: "NIFTY 50", label: "NIFTY 50", scope: "Domestic" },
  { id: "BANK NIFTY", label: "BANK NIFTY", scope: "Domestic" },
  { id: "NIFTY NEXT 50", label: "NIFTY NEXT 50", scope: "Domestic" },
  { id: "MSCI INDIA", label: "MSCI INDIA", scope: "Global" },
  { id: "FTSE EMERGING", label: "FTSE EMERGING", scope: "Global" },
];

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
    <div className="space-y-3 font-sans rounded-none">
      {/* Modelled Forecast & Scope Indicator */}
      <div className="rounded-none border border-primary/30 bg-primary/5 p-2 text-2xs text-muted-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-3xs uppercase tracking-wider font-mono">
              QUANTITATIVE REBALANCE PREDICTOR · DUAL DOMESTIC &amp; GLOBAL DESK
            </span>
            <span className="bg-primary/20 text-primary text-3xs font-mono font-bold px-1 py-0.2 border border-primary/40 rounded-none">
              OPTION B ACTIVE
            </span>
          </div>
          <p className="text-3xs leading-relaxed text-muted-foreground">
            Inclusions, exclusions, and passive fund flow estimates are algorithmically modelled from official <strong>NSE Indices</strong> semi-annual rules and <strong>MSCI/FTSE</strong> free-float market capitalization cutoffs and foreign inclusion factors (FIF). Predictions are mathematical quantitative forecasts, not official circulars.
          </p>
        </div>
      </div>

      {/* Index review overview bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-2xs text-muted-foreground border-b border-border/60 pb-2 font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-foreground font-semibold">
            <Compass className="h-3.5 w-3.5 text-primary" />
            <span>Cycle:</span>
            <strong className="text-foreground">{initialData.reviewName}</strong>
          </div>
          <span className="text-border">|</span>
          <span>Effective: <strong className="text-foreground">{initialData.effectiveDate}</strong></span>
          <span className="text-border">|</span>
          <span>Cutoff: <strong className="text-foreground">{initialData.dataCutoffDate}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-3xs">
          <span>Tracked Passive AUM:</span>
          <strong className="text-foreground font-bold">₹{(initialData.totalPassiveAumTrackedCr / 1000).toFixed(1)}k Cr</strong>
          <span className="text-border">|</span>
          <span className="text-accent font-bold">Domestic + Global ETFs</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {INDEX_TABS.map((tab) => {
          const count = tab.id === "ALL" ? candidates.length : candidates.filter((c) => c.index === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedIndex(tab.id)}
              className={cn(
                "rounded-none px-2 py-0.5 text-3xs font-mono font-bold uppercase tracking-wider transition-all duration-150 border flex items-center gap-1",
                selectedIndex === tab.id
                  ? "bg-accent text-accent-foreground border-accent shadow-xs"
                  : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {tab.scope === "Global" && <Globe className="h-2.5 w-2.5 text-gold shrink-0" />}
              <span>{tab.id === "ALL" ? tab.label : tab.id}</span>
              <span className={cn(
                "text-4xs px-1 py-0.2 rounded-none",
                selectedIndex === tab.id ? "bg-accent-foreground/20 text-accent-foreground" : "bg-surface-muted text-muted-foreground"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Candidates Table */}
      <div className="overflow-x-auto rounded-none border border-border bg-surface">
        <table className="w-full text-left text-2xs border-collapse font-mono tabular-nums">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-3xs text-muted-foreground uppercase tracking-wider">
              <th className="px-2 py-1.5 font-bold">Index</th>
              <th className="px-2 py-1.5 font-bold">Scrip</th>
              <th className="px-2 py-1.5 text-center font-bold">Action</th>
              <th className="px-2 py-1.5 text-center font-bold">Probability</th>
              <th className="px-2 py-1.5 text-right font-bold">Est Weight</th>
              <th className="px-2 py-1.5 text-right font-bold">Est Flow (₹ Cr)</th>
              <th className="px-2 py-1.5 text-right font-bold">Days to Cover</th>
              <th className="px-2 py-1.5 text-left font-bold font-sans">Catalyst &amp; Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.map((c) => {
              const isInclusion = c.direction === "INCLUSION";
              const isGlobal = c.index.includes("MSCI") || c.index.includes("FTSE");
              return (
                <tr key={`${c.index}-${c.symbol}`} className="hover:bg-surface-muted/60 transition-colors">
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={cn(
                      "rounded-none px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider border",
                      isGlobal
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-surface-raised text-foreground border-border/80",
                    )}>
                      {c.index}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-sans whitespace-nowrap">
                    <Link
                      href={`/company/${c.symbol}`}
                      className="font-bold text-foreground hover:text-accent transition-colors inline-flex items-center gap-1 font-mono text-xs"
                    >
                      {c.symbol}
                      <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" />
                    </Link>
                    <div className="text-3xs text-muted-foreground line-clamp-1 max-w-[140px]">{c.name}</div>
                  </td>
                  <td className="px-2 py-1.5 text-center whitespace-nowrap">
                    <span
                      className={cn(
                        "rounded-none px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider border inline-block",
                        isInclusion
                          ? "bg-up/10 text-up border-up/30"
                          : "bg-down/10 text-down border-down/30",
                      )}
                    >
                      {c.direction}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center cell-glow whitespace-nowrap">
                    <span className={cn("font-bold text-xs", c.probabilityPct >= 85 ? "text-up" : "text-gold")}>
                      {c.probabilityPct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-foreground font-semibold cell-glow">
                    {c.estWeightPct.toFixed(2)}%
                  </td>
                  <td className="px-2 py-1.5 text-right cell-glow whitespace-nowrap">
                    <span
                      className={cn(
                        "font-bold text-xs",
                        c.estFlowCr > 0 ? "text-up" : "text-down",
                      )}
                    >
                      {c.estFlowCr > 0 ? "+" : ""}₹{Math.abs(c.estFlowCr).toLocaleString("en-IN")} Cr
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right cell-glow whitespace-nowrap">
                    <span
                      className={cn(
                        "rounded-none px-1.5 py-0.5 text-3xs font-bold border",
                        c.daysToCover && c.daysToCover >= 5.0
                          ? "bg-down/15 text-down border-down/40 shadow-xs"
                          : "bg-surface-raised text-muted-foreground border-border/60",
                      )}
                    >
                      {c.daysToCover ? `${c.daysToCover.toFixed(1)}d` : "—"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-sans text-3xs text-muted-foreground max-w-sm leading-tight">
                    {c.catalyst}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rules Footnote */}
      <div className="rounded-none border border-border/80 bg-surface p-2.5 text-3xs text-muted-foreground space-y-1 font-sans">
        <div className="font-bold text-foreground flex items-center gap-1.5 text-3xs uppercase tracking-wider font-mono">
          <Zap className="h-3 w-3 text-gold" /> Institutional Index Methodology Guidelines
        </div>
        <ul className="list-disc pl-4 space-y-0.5 text-3xs">
          {initialData.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
