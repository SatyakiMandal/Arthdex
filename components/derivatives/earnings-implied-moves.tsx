"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Calendar, Calculator, Sparkles, TrendingUp, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiEarningsMovesResponse, ApiEarningsMove } from "@/lib/api/types";

const VERDICT_STYLES: Record<string, { badge: string; text: string }> = {
  "High Volatility Priced": {
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    text: "Market pricing wide swing (>6%). Straddle premium elevated.",
  },
  "Normal Volatility Priced": {
    badge: "bg-primary/20 text-primary border-primary/40",
    text: "Moderate expectation (3% – 6%). Consistent with historical post-earnings move.",
  },
  "Low Volatility Priced": {
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    text: "Tight expected range (<3%). Straddle premium relatively subdued.",
  },
};

export function EarningsImpliedMoves({
  initialData,
}: {
  initialData: ApiEarningsMovesResponse;
}) {
  const [filter, setFilter] = useState<"ALL" | "UPCOMING">("ALL");
  const moves = initialData.moves ?? [];

  const displayed = filter === "UPCOMING" ? moves.filter((m) => m.status === "upcoming") : moves;

  return (
    <div className="space-y-6">
      {/* Intro info bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <span>
            ATM Straddle Implied Move Formula:{" "}
            <strong className="text-foreground font-mono">
              (CE_atm + PE_atm) / Spot × 100%
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("ALL")}
            className={cn(
              "rounded-none px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider transition-colors",
              filter === "ALL"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            All Results ({moves.length})
          </button>
          <button
            onClick={() => setFilter("UPCOMING")}
            className={cn(
              "rounded-none px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider transition-colors",
              filter === "UPCOMING"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            Upcoming Only
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-none border border-border bg-card">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-2xs text-muted-foreground uppercase tracking-wider">
              <th className="p-3 font-semibold">Symbol &amp; Company</th>
              <th className="p-3 font-semibold">Result Date</th>
              <th className="p-3 text-right font-semibold">Spot Price</th>
              <th className="p-3 text-right font-semibold">ATM Straddle</th>
              <th className="p-3 text-center font-semibold min-w-36">Implied Move (±%)</th>
              <th className="p-3 text-right font-semibold">Call IV / Put IV</th>
              <th className="p-3 text-left font-semibold">Market Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 font-mono">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground font-sans">
                  No upcoming results with active option chains found in current cycle.
                </td>
              </tr>
            ) : (
              displayed.map((m) => {
                const verdictStyle = VERDICT_STYLES[m.pricingVerdict] || VERDICT_STYLES["Normal Volatility Priced"];
                const isUpcoming = m.status === "upcoming";

                return (
                  <tr key={m.symbol} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-sans">
                      <Link
                        href={`/company/${m.symbol}`}
                        className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {m.symbol}
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                      <div className="text-2xs text-muted-foreground line-clamp-1">{m.companyName}</div>
                    </td>

                    <td className="p-3 font-sans">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{m.resultDate}</span>
                      </div>
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded px-1.5 py-0.2 text-3xs uppercase tracking-wider font-semibold",
                          isUpcoming ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isUpcoming ? "Upcoming" : "Reported"}
                      </span>
                    </td>

                    <td className="p-3 text-right text-foreground font-semibold">
                      {m.spotPrice !== null
                        ? `₹${m.spotPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>

                    <td className="p-3 text-right text-foreground font-medium">
                      {m.straddleAtmPrice !== null
                        ? `₹${m.straddleAtmPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>

                    <td className="p-3 text-center">
                      {m.impliedMovePct !== null ? (
                        <div className="inline-flex items-center justify-center gap-1.5 rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>±{m.impliedMovePct.toFixed(2)}%</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="p-3 text-right text-muted-foreground">
                      {m.callIv !== null && m.putIv !== null
                        ? `${m.callIv.toFixed(1)}% / ${m.putIv.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td className="p-3 font-sans">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border",
                          verdictStyle.badge,
                        )}
                      >
                        {m.pricingVerdict}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Explainer card */}
      <div className="rounded-none border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5 font-sans">
        <div className="font-semibold text-foreground flex items-center gap-1.5 text-2xs uppercase tracking-wider">
          <HelpCircle className="h-3.5 w-3.5 text-primary" /> Understanding Pre-Earnings Implied Moves
        </div>
        <p className="text-2xs leading-relaxed">
          The At-The-Money (ATM) straddle price reflects the combined cost of buying the closest ATM Call and ATM Put option expiring right after the board meeting. Because option buyers need the underlying stock to move by more than the total straddle premium to break even, this percentage is the market’s collective consensus pricing of the post-earnings swing.
        </p>
      </div>
    </div>
  );
}
