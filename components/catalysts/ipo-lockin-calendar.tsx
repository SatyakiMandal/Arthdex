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
    <div className="space-y-4">
      {/* Top filter and summary header */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Unlock className="h-4 w-4 text-amber-500" />
          <span>
            Upcoming Unlocks: <strong className="text-foreground">{initialData.upcomingCount} tranches</strong>
          </span>
          <span className="text-border">|</span>
          <span className="text-rose-400 font-semibold">
            Imminent (&le;14d): {initialData.imminentCount}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("ACTIVE")}
            className={cn(
              "rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wider transition-colors",
              filter === "ACTIVE"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Active &amp; Upcoming ({initialData.upcomingCount})
          </button>
          <button
            onClick={() => setFilter("ALL")}
            className={cn(
              "rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wider transition-colors",
              filter === "ALL"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            All Tranches ({events.length})
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-2xs text-muted-foreground uppercase tracking-wider">
              <th className="p-3 font-semibold">Company &amp; Scrip</th>
              <th className="p-3 font-semibold">Listing Date</th>
              <th className="p-3 font-semibold">Lock-in Tranche</th>
              <th className="p-3 font-semibold">Unlock Date</th>
              <th className="p-3 text-right font-semibold">Shares Unlocking</th>
              <th className="p-3 text-right font-semibold">Est Value (₹ Cr)</th>
              <th className="p-3 text-right font-semibold">Supply Ratio (vs ADV)</th>
              <th className="p-3 text-left font-semibold">Supply Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 font-mono">
            {displayed.map((e, idx) => {
              const isImminent = e.status === "IMMINENT";
              const isExpired = e.status === "EXPIRED";

              return (
                <tr
                  key={`${e.symbol}-${e.lockinCategory}-${idx}`}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    isImminent && "bg-amber-500/5",
                  )}
                >
                  <td className="p-3 font-sans">
                    <Link
                      href={`/company/${e.symbol}`}
                      className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      {e.symbol}
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                    <div className="text-3xs text-muted-foreground line-clamp-1">{e.companyName}</div>
                  </td>

                  <td className="p-3 text-muted-foreground">
                    {e.listingDate}
                  </td>

                  <td className="p-3 font-sans">
                    <span className="font-semibold text-foreground text-xs">{e.lockinCategory}</span>
                  </td>

                  <td className="p-3">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>{e.unlockDate}</span>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 inline-block text-3xs font-sans font-bold uppercase",
                        isExpired
                          ? "text-muted-foreground"
                          : isImminent
                          ? "text-rose-400 animate-pulse"
                          : "text-amber-400",
                      )}
                    >
                      {isExpired ? "Expired" : `${e.daysRemaining} days left`}
                    </span>
                  </td>

                  <td className="p-3 text-right text-foreground font-medium">
                    {e.sharesUnlocking.toLocaleString("en-IN")}
                  </td>

                  <td className="p-3 text-right text-foreground font-bold">
                    {e.unlockValueCr ? `₹${e.unlockValueCr.toLocaleString("en-IN")} Cr` : "—"}
                  </td>

                  <td className="p-3 text-right">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-2xs font-bold",
                        e.supplyImpactRatio && e.supplyImpactRatio >= 5.0
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : e.supplyImpactRatio && e.supplyImpactRatio >= 2.0
                          ? "bg-amber-500/20 text-amber-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {e.supplyImpactRatio ? `${e.supplyImpactRatio.toFixed(1)}x ADV` : "—"}
                    </span>
                  </td>

                  <td className="p-3 font-sans">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border",
                        e.riskLevel === "High Selling Pressure"
                          ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          : e.riskLevel === "Moderate Selling Pressure"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          : "bg-muted text-muted-foreground border-border",
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
      <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 text-2xs text-muted-foreground space-y-1 font-sans">
        <div className="font-semibold text-foreground flex items-center gap-1.5 text-2xs uppercase tracking-wider">
          <Info className="h-3.5 w-3.5 text-primary" /> SEBI ICDR Lock-in Framework
        </div>
        <p className="text-2xs leading-relaxed">
          {initialData.rules?.anchor30d} {initialData.rules?.anchor90d} {initialData.rules?.supplyRatio}
        </p>
      </div>
    </div>
  );
}
