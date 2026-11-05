"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Calendar, Calculator, Sparkles, TrendingUp, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiEarningsMovesResponse, ApiEarningsMove } from "@/lib/api/types";

const VERDICT_STYLES: Record<string, { badge: string; text: string }> = {
  "High Volatility Priced": {
    badge: "bg-down/15 text-down border-down/40",
    text: "Market pricing wide swing (>6%). Straddle premium elevated.",
  },
  "Normal Volatility Priced": {
    badge: "bg-accent/15 text-accent border-accent/40",
    text: "Moderate expectation (3% – 6%). Consistent with historical post-earnings move.",
  },
  "Low Volatility Priced": {
    badge: "bg-up/15 text-up border-up/40",
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
    <div className="space-y-3 font-sans rounded-none">
      {/* Intro info bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-2xs text-muted-foreground border-b border-border/60 pb-2 font-mono">
        <div className="flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-accent" />
          <span>
            ATM Straddle Implied Move:{" "}
            <strong className="text-foreground font-mono">
              (CE_atm + PE_atm) / Spot × 100%
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("ALL")}
            className={cn(
              "rounded-none px-2 py-0.5 text-3xs font-mono font-bold uppercase tracking-wider transition-all border",
              filter === "ALL"
                ? "bg-accent text-accent-foreground border-accent shadow-xs"
                : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            All Results ({moves.length})
          </button>
          <button
            onClick={() => setFilter("UPCOMING")}
            className={cn(
              "rounded-none px-2 py-0.5 text-3xs font-mono font-bold uppercase tracking-wider transition-all border",
              filter === "UPCOMING"
                ? "bg-accent text-accent-foreground border-accent shadow-xs"
                : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            Upcoming Only
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-none border border-border bg-surface">
        <table className="w-full text-left text-2xs border-collapse font-mono tabular-nums">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-3xs text-muted-foreground uppercase tracking-wider">
              <th className="px-2 py-1.5 font-bold font-sans">Symbol &amp; Company</th>
              <th className="px-2 py-1.5 font-bold font-sans">Result Date</th>
              <th className="px-2 py-1.5 text-right font-bold">Spot Price</th>
              <th className="px-2 py-1.5 text-right font-bold">ATM Straddle</th>
              <th className="px-2 py-1.5 text-center font-bold min-w-32">Implied Move (±%)</th>
              <th className="px-2 py-1.5 text-right font-bold">Call IV / Put IV</th>
              <th className="px-2 py-1.5 text-left font-bold font-sans">Market Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-3xs text-muted-foreground font-sans">
                  No upcoming results with active option chains found in current cycle.
                </td>
              </tr>
            ) : (
              displayed.map((m) => {
                const verdictStyle = VERDICT_STYLES[m.pricingVerdict] || VERDICT_STYLES["Normal Volatility Priced"];
                const isUpcoming = m.status === "upcoming";

                return (
                  <tr key={m.symbol} className="hover:bg-surface-muted/60 transition-colors">
                    <td className="px-2 py-1.5 font-sans whitespace-nowrap">
                      <Link
                        href={`/company/${m.symbol}`}
                        className="font-bold text-foreground hover:text-accent transition-colors inline-flex items-center gap-1 font-mono text-xs"
                      >
                        {m.symbol}
                        <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" />
                      </Link>
                      <div className="text-3xs text-muted-foreground line-clamp-1 max-w-[130px]">{m.companyName}</div>
                    </td>

                    <td className="px-2 py-1.5 font-sans whitespace-nowrap">
                      <div className="flex items-center gap-1 font-semibold text-foreground text-3xs">
                        <Calendar className="h-2.5 w-2.5 text-muted-foreground" />
                        <span>{m.resultDate}</span>
                      </div>
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded-none px-1 py-0.2 text-4xs uppercase tracking-wider font-bold border",
                          isUpcoming ? "bg-gold/15 text-gold border-gold/40" : "bg-surface-raised text-muted-foreground border-border/60",
                        )}
                      >
                        {isUpcoming ? "Upcoming" : "Reported"}
                      </span>
                    </td>

                    <td className="px-2 py-1.5 text-right text-foreground font-semibold cell-glow">
                      {m.spotPrice !== null
                        ? `₹${m.spotPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>

                    <td className="px-2 py-1.5 text-right text-foreground font-medium cell-glow">
                      {m.straddleAtmPrice !== null
                        ? `₹${m.straddleAtmPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>

                    <td className="px-2 py-1.5 text-center whitespace-nowrap cell-glow">
                      {m.impliedMovePct !== null ? (
                        <div className="inline-flex items-center justify-center gap-1 rounded-none border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                          <TrendingUp className="h-3 w-3" />
                          <span>±{m.impliedMovePct.toFixed(2)}%</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-2 py-1.5 text-right text-muted-foreground cell-glow">
                      {m.callIv !== null && m.putIv !== null
                        ? `${m.callIv.toFixed(1)}% / ${m.putIv.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td className="px-2 py-1.5 font-sans whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded-none px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider border",
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
      <div className="rounded-none border border-border/80 bg-surface p-2.5 text-3xs text-muted-foreground space-y-0.5 font-sans">
        <div className="font-bold text-foreground flex items-center gap-1.5 text-3xs uppercase tracking-wider font-mono">
          <HelpCircle className="h-3 w-3 text-gold" /> Institutional ATM Straddle Volatility Pricing
        </div>
        <p className="text-3xs leading-relaxed">
          The At-The-Money (ATM) straddle price reflects the combined cost of buying the closest ATM Call and ATM Put option expiring immediately post-results. Because straddle buyers require the underlying stock to move beyond the premium paid to break even, this percentage serves as the option market&apos;s collective consensus pricing of post-earnings volatility.
        </p>
      </div>
    </div>
  );
}
