"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Calendar, Clock, Info, ShieldAlert, Sparkles, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiIpoLockinResponse, ApiIpoLockinEvent } from "@/lib/api/types";

export function IpoLockinCalendar({
  initialData,
}: {
  initialData: ApiIpoLockinResponse;
}) {
  const [filter, setFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const events = initialData.events ?? [];

  const displayed = filter === "ACTIVE"
    ? events.filter((e) => e.status !== "EXPIRED")
    : events;

  return (
    <div className="space-y-3 font-sans rounded-none">
      {/* Top filter and summary header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-2xs text-muted-foreground border-b border-border/60 pb-2 font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-foreground font-semibold">
            <Unlock className="h-3.5 w-3.5 text-gold" />
            <span>Upcoming Unlocks:</span>
            <strong className="text-foreground font-bold">{initialData.upcomingCount} tranches</strong>
          </div>
          <span className="text-border">|</span>
          <span className="text-down font-bold">
            Imminent (&le;14d): {initialData.imminentCount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("ACTIVE")}
            className={cn(
              "rounded-none px-2 py-0.5 text-3xs font-mono font-bold uppercase tracking-wider transition-all duration-150 border",
              filter === "ACTIVE"
                ? "bg-accent text-accent-foreground border-accent shadow-xs"
                : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            Active &amp; Upcoming ({initialData.upcomingCount})
          </button>
          <button
            onClick={() => setFilter("ALL")}
            className={cn(
              "rounded-none px-2 py-0.5 text-3xs font-mono font-bold uppercase tracking-wider transition-all duration-150 border",
              filter === "ALL"
                ? "bg-accent text-accent-foreground border-accent shadow-xs"
                : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            All Tranches ({events.length})
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="overflow-x-auto rounded-none border border-border bg-surface">
        <table className="w-full text-left text-2xs border-collapse font-mono tabular-nums">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-3xs text-muted-foreground uppercase tracking-wider">
              <th className="px-2 py-1.5 font-bold font-sans">Company &amp; Scrip</th>
              <th className="px-2 py-1.5 font-bold font-sans">Listing Date</th>
              <th className="px-2 py-1.5 font-bold font-sans">Lock-in Tranche</th>
              <th className="px-2 py-1.5 font-bold font-sans">Unlock Date</th>
              <th className="px-2 py-1.5 text-right font-bold">Shares Unlocking</th>
              <th className="px-2 py-1.5 text-right font-bold">Est Value (₹ Cr)</th>
              <th className="px-2 py-1.5 text-right font-bold">Supply Ratio</th>
              <th className="px-2 py-1.5 text-center font-bold font-sans">Supply Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {displayed.map((e, idx) => {
              const isImminent = e.status === "IMMINENT";
              const isExpired = e.status === "EXPIRED";

              return (
                <tr
                  key={`${e.symbol}-${e.lockinCategory}-${idx}`}
                  className={cn(
                    "hover:bg-surface-muted/60 transition-colors",
                    isImminent && "bg-down/5",
                  )}
                >
                  <td className="px-2 py-1.5 font-sans whitespace-nowrap">
                    <Link
                      href={`/company/${e.symbol}`}
                      className="font-bold text-foreground hover:text-accent transition-colors inline-flex items-center gap-1 font-mono text-xs"
                    >
                      {e.symbol}
                      <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" />
                    </Link>
                    <div className="text-3xs text-muted-foreground line-clamp-1 max-w-[130px]">{e.companyName}</div>
                  </td>

                  <td className="px-2 py-1.5 text-muted-foreground font-sans text-3xs whitespace-nowrap">
                    {e.listingDate}
                  </td>

                  <td className="px-2 py-1.5 font-sans whitespace-nowrap">
                    <span className="font-bold text-foreground text-3xs uppercase tracking-wider">{e.lockinCategory}</span>
                  </td>

                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-foreground font-semibold">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                      <span>{e.unlockDate}</span>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 inline-block text-4xs font-mono font-bold uppercase",
                        isExpired
                          ? "text-muted-foreground"
                          : isImminent
                          ? "text-down animate-pulse"
                          : "text-gold",
                      )}
                    >
                      {isExpired ? "Expired" : `${e.daysRemaining}d left`}
                    </span>
                  </td>

                  <td className="px-2 py-1.5 text-right text-foreground font-semibold cell-glow">
                    {e.sharesUnlocking.toLocaleString("en-IN")}
                  </td>

                  <td className="px-2 py-1.5 text-right text-foreground font-bold cell-glow">
                    {e.unlockValueCr ? `₹${e.unlockValueCr.toLocaleString("en-IN")} Cr` : "—"}
                  </td>

                  <td className="px-2 py-1.5 text-right cell-glow whitespace-nowrap">
                    <span
                      className={cn(
                        "rounded-none px-1 py-0.2 text-3xs font-bold border",
                        e.supplyImpactRatio && e.supplyImpactRatio >= 5.0
                          ? "bg-down/15 text-down border-down/40 shadow-xs"
                          : e.supplyImpactRatio && e.supplyImpactRatio >= 2.0
                          ? "bg-gold/15 text-gold border-gold/40"
                          : "bg-surface-raised text-muted-foreground border-border/60",
                      )}
                    >
                      {e.supplyImpactRatio ? `${e.supplyImpactRatio.toFixed(1)}x ADV` : "—"}
                    </span>
                  </td>

                  <td className="px-2 py-1.5 font-sans text-center whitespace-nowrap">
                    <span
                      className={cn(
                        "rounded-none px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider border",
                        e.riskLevel === "High Selling Pressure"
                          ? "bg-down/10 text-down border-down/30"
                          : e.riskLevel === "Moderate Selling Pressure"
                          ? "bg-gold/10 text-gold border-gold/30"
                          : "bg-surface-raised text-muted-foreground border-border",
                      )}
                    >
                      {e.riskLevel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rules explainer card */}
      <div className="rounded-none border border-border/80 bg-surface p-2.5 text-3xs text-muted-foreground space-y-0.5 font-sans">
        <div className="font-bold text-foreground flex items-center gap-1.5 text-3xs uppercase tracking-wider font-mono">
          <Info className="h-3 w-3 text-gold" /> SEBI ICDR Anchor &amp; Pre-IPO Lock-in Framework
        </div>
        <p className="text-3xs leading-relaxed">
          {initialData.rules?.anchor30d} {initialData.rules?.anchor90d} {initialData.rules?.supplyRatio}
        </p>
      </div>
    </div>
  );
}
