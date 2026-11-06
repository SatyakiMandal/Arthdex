"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Globe,
  Scale,
  ArrowRight,
  ShieldCheck,
  Landmark,
} from "lucide-react";
import type { ApiForexMonitorResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface FxMonitorDeskProps {
  initialData: ApiForexMonitorResponse;
}

export function FxMonitorDesk({ initialData }: FxMonitorDeskProps) {
  const [selectedPair, setSelectedPair] = useState<string>("USD/INR");

  const { asOf, baseCurrency, pairs, forwardPremia, reerIndices } = initialData;

  const usdPair = pairs.find((p) => p.pair === "USD/INR") || pairs[0];
  const eurPair = pairs.find((p) => p.pair === "EUR/INR") || pairs[1];
  const gbpPair = pairs.find((p) => p.pair === "GBP/INR") || pairs[2];

  return (
    <div className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-2.5 font-mono">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 py-1.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30">
            FXM &lt;GO&gt;
          </span>
          <span className="text-muted-foreground text-2xs">{"//"}</span>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Foreign Exchange Cross-Rates &amp; INR Monitor
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-muted-foreground border-l border-border pl-2">
            <Globe className="h-3 w-3 text-cyan-400" />
            Official FBIL Reference Rates · Forward Premia
          </span>
        </div>

        <div className="flex items-center gap-2 text-3xs text-muted-foreground">
          <span>BASE CURRENCY: {baseCurrency}</span>
          <span>·</span>
          <span>AS OF: {new Date(asOf).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST</span>
        </div>
      </div>

      {/* 2. Executive Headline Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {/* Card 1: USD/INR */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">USD / INR Spot</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground tabular-nums">
              ₹{usdPair.rate.toFixed(2)}
            </span>
            <span
              className={cn(
                "text-3xs font-bold",
                usdPair.changePct >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {usdPair.changePct >= 0 ? "+" : ""}
              {usdPair.changePct.toFixed(2)}%
            </span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            FBIL Ref: ₹{usdPair.fbilRef.toFixed(3)}
          </div>
        </div>

        {/* Card 2: EUR/INR */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">EUR / INR Spot</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground tabular-nums">
              ₹{eurPair.rate.toFixed(2)}
            </span>
            <span
              className={cn(
                "text-3xs font-bold",
                eurPair.changePct >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {eurPair.changePct >= 0 ? "+" : ""}
              {eurPair.changePct.toFixed(2)}%
            </span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            FBIL Ref: ₹{eurPair.fbilRef.toFixed(3)}
          </div>
        </div>

        {/* Card 3: GBP/INR */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">GBP / INR Spot</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground tabular-nums">
              ₹{gbpPair.rate.toFixed(2)}
            </span>
            <span
              className={cn(
                "text-3xs font-bold",
                gbpPair.changePct >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {gbpPair.changePct >= 0 ? "+" : ""}
              {gbpPair.changePct.toFixed(2)}%
            </span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            FBIL Ref: ₹{gbpPair.fbilRef.toFixed(3)}
          </div>
        </div>

        {/* Card 4: 1-Year Forward Premia */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">1-Year Forward Premia</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-cyan-400 tabular-nums">
              {forwardPremia[forwardPremia.length - 1]?.points.toFixed(1)}p
            </span>
            <span className="text-3xs text-muted-foreground">
              ({forwardPremia[forwardPremia.length - 1]?.annualizedPct.toFixed(2)}% p.a.)
            </span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            Annualized USD/INR hedge cost
          </div>
        </div>
      </div>

      {/* 3. REER Valuation Banner */}
      <div className="border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-1.5 flex items-start gap-2 text-2xs">
        <Scale className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-3xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">RBI 40-CURRENCY TRADE-WEIGHTED REER ({reerIndices.reer40Basket}): </strong>
          {reerIndices.valuation}. Real Effective Exchange Rate base year 2015-16 = 100. NEER: {reerIndices.neer40Basket}.
        </p>
      </div>

      {/* 4. Two-Column Layout: Cross-Rates Matrix & Forward Premia */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Left: Cross-Rates Table (2 Cols) */}
        <div className="lg:col-span-2 border border-border bg-card/60 p-2 space-y-2">
          <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
            INR SPOT CROSS-RATES MATRIX &amp; FBIL BENCHMARKS
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-2xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-1 px-2">Currency Pair</th>
                  <th className="py-1 px-2 text-right">LTP (₹)</th>
                  <th className="py-1 px-2 text-right">Net Change</th>
                  <th className="py-1 px-2 text-right">% Change</th>
                  <th className="py-1 px-2 text-right">Day High</th>
                  <th className="py-1 px-2 text-right">Day Low</th>
                  <th className="py-1 px-2 text-right">FBIL Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pairs.map((p) => {
                  const isSelected = p.pair === selectedPair;
                  return (
                    <tr
                      key={p.pair}
                      onClick={() => setSelectedPair(p.pair)}
                      className={cn(
                        "cursor-pointer hover:bg-muted/40 transition-colors",
                        isSelected ? "bg-muted/30 font-semibold" : ""
                      )}
                    >
                      <td className="py-1.5 px-2 font-bold text-foreground flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-none" />
                        {p.pair}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-foreground tabular-nums">
                        ₹{p.rate.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right tabular-nums",
                          p.change >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {p.change >= 0 ? "+" : ""}
                        {p.change.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right tabular-nums font-bold",
                          p.changePct >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {p.changePct >= 0 ? "+" : ""}
                        {p.changePct.toFixed(2)}%
                      </td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">
                        ₹{p.high.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">
                        ₹{p.low.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-cyan-400 tabular-nums">
                        ₹{p.fbilRef.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Forward Premia Term Structure */}
        <div className="border border-border bg-card/60 p-2 space-y-2">
          <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
            USD/INR FORWARD PREMIA &amp; ANNUALIZED YIELD
          </div>

          <div className="space-y-1.5">
            {forwardPremia.map((fp) => (
              <div
                key={fp.tenor}
                className="border border-border/60 bg-muted/20 p-2 flex items-center justify-between font-mono"
              >
                <div>
                  <div className="text-3xs font-bold text-foreground uppercase">{fp.tenor}</div>
                  <div className="text-3xs text-muted-foreground mt-0.5">
                    +{fp.points.toFixed(1)} paise premia
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-cyan-400 tabular-nums">
                    {fp.annualizedPct.toFixed(2)}%
                  </span>
                  <div className="text-3xs text-muted-foreground">Annualized Cost</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-border/60 bg-muted/10 p-2 text-3xs text-muted-foreground">
            <strong className="text-foreground">Hedging Note: </strong>
            Indian corporate exporters lock in forward premia to hedge dollar receivables; importers pay this carry.
          </div>
        </div>
      </div>

      {/* 5. Footer Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-3xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-foreground">RELATED MACRO WORKBENCHES:</span>
          <Link href="/macro" className="text-cyan-400 hover:underline">
            ECO &lt;GO&gt; (India Macro &amp; CPI)
          </Link>
          <Link href="/yield-curve" className="text-cyan-400 hover:underline">
            GC &lt;GO&gt; (Sovereign Yield Curve)
          </Link>
          <Link href="/commodities" className="text-cyan-400 hover:underline">
            CMKT &lt;GO&gt; (Commodities Desk)
          </Link>
        </div>

        <div>
          <span>Financial Benchmarks India Pvt Ltd (FBIL) &amp; RBI daily data</span>
        </div>
      </div>
    </div>
  );
}
