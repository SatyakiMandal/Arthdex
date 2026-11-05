"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Calculator, CheckCircle2, Coins, HelpCircle, Info, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiBuybackResponse, ApiBuybackItem } from "@/lib/api/types";

export function BuybackArbitrageDesk({
  initialData,
}: {
  initialData: ApiBuybackResponse;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const buybacks = initialData.buybacks ?? [];

  const activeBuyback = buybacks.find((b) => b.symbol === selectedSymbol) || buybacks[0];

  return (
    <div className="space-y-3 font-sans rounded-none">
      {/* Simulation Notice */}
      <div className="rounded-none border border-primary/30 bg-primary/5 p-2 text-2xs text-muted-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-foreground text-3xs uppercase tracking-wider font-mono">
            SCENARIO SIMULATION DESK · MODELLED PAYOFFS
          </span>
          <p className="text-3xs leading-relaxed text-muted-foreground">
            Tender offer sizes, record dates, and SEBI small shareholder rules (holding &le; ₹2,00,000) are compiled from exchange filings. Net returns across 20%, 35%, and 50% acceptance ratios are <strong>interactive &quot;what-if&quot; simulations</strong> modeling post-buyback price drift.
          </p>
        </div>
      </div>

      {/* Top explainer banner */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-2xs text-muted-foreground border-b border-border/60 pb-2 font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-foreground font-semibold">
            <Coins className="h-3.5 w-3.5 text-gold" />
            <span>SEBI Small Shareholder Quota:</span>
            <strong className="text-foreground">15% Reserved</strong>
          </div>
          <span className="text-border">|</span>
          <span>Max Retail Limit: <strong className="text-foreground">₹2,00,000 as on Record Date</strong></span>
        </div>
        <div className="text-3xs font-mono">
          Tracked Active Buybacks: <strong className="text-foreground font-bold">{buybacks.length} Companies</strong>
        </div>
      </div>

      {/* Buybacks Overview Table */}
      <div className="overflow-x-auto rounded-none border border-border bg-surface">
        <table className="w-full text-left text-2xs border-collapse font-mono tabular-nums">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-3xs text-muted-foreground uppercase tracking-wider">
              <th className="px-2 py-1.5 font-bold font-sans">Company &amp; Scrip</th>
              <th className="px-2 py-1.5 text-right font-bold">CMP (₹)</th>
              <th className="px-2 py-1.5 text-right font-bold">Buyback Price (₹)</th>
              <th className="px-2 py-1.5 text-right font-bold">Premium (%)</th>
              <th className="px-2 py-1.5 text-right font-bold">Offer Size (₹ Cr)</th>
              <th className="px-2 py-1.5 font-bold font-sans">Record Date</th>
              <th className="px-2 py-1.5 font-bold font-sans">Tender Closes</th>
              <th className="px-2 py-1.5 text-center font-bold font-sans">Offer Status</th>
              <th className="px-2 py-1.5 text-center font-bold font-sans">Arbitrage Simulator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {buybacks.map((b) => {
              const isSelected = activeBuyback?.symbol === b.symbol;
              const hasPremium = b.premiumPct !== null && b.premiumPct > 0;

              return (
                <tr
                  key={b.symbol}
                  className={cn(
                    "hover:bg-surface-muted/60 transition-colors",
                    isSelected && "bg-accent/5",
                  )}
                >
                  <td className="px-2 py-1.5 font-sans whitespace-nowrap">
                    <Link
                      href={`/company/${b.symbol}`}
                      className="font-bold text-foreground hover:text-accent transition-colors inline-flex items-center gap-1 font-mono text-xs"
                    >
                      {b.symbol}
                      <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" />
                    </Link>
                    <div className="text-3xs text-muted-foreground line-clamp-1 max-w-[130px]">{b.name}</div>
                  </td>

                  <td className="px-2 py-1.5 text-right text-foreground font-semibold cell-glow">
                    {b.cmp ? `₹${b.cmp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
                  </td>

                  <td className="px-2 py-1.5 text-right text-up font-bold cell-glow">
                    ₹{b.buybackPrice.toLocaleString("en-IN")}
                  </td>

                  <td className="px-2 py-1.5 text-right cell-glow">
                    <span
                      className={cn(
                        "rounded-none px-1 py-0.2 text-3xs font-bold border",
                        hasPremium ? "bg-up/10 text-up border-up/30" : "bg-surface-raised text-muted-foreground border-border",
                      )}
                    >
                      {b.premiumPct ? `+${b.premiumPct.toFixed(1)}%` : "—"}
                    </span>
                  </td>

                  <td className="px-2 py-1.5 text-right text-foreground cell-glow">
                    ₹{b.totalSizeCr.toLocaleString("en-IN")} Cr
                  </td>

                  <td className="px-2 py-1.5 text-muted-foreground font-sans text-3xs whitespace-nowrap">
                    {b.recordDate}
                  </td>

                  <td className="px-2 py-1.5 text-muted-foreground font-sans text-3xs whitespace-nowrap">
                    {b.tenderEndDate}
                  </td>

                  <td className="px-2 py-1.5 text-center font-sans whitespace-nowrap">
                    <span
                      className={cn(
                        "rounded-none px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider border",
                        b.status === "ACTIVE"
                          ? "bg-up/10 text-up border-up/30"
                          : b.status === "UPCOMING"
                          ? "bg-gold/10 text-gold border-gold/30"
                          : "bg-surface-raised text-muted-foreground border-border",
                      )}
                    >
                      {b.status}
                    </span>
                  </td>

                  <td className="px-2 py-1.5 text-center whitespace-nowrap">
                    <button
                      onClick={() => setSelectedSymbol(b.symbol)}
                      className={cn(
                        "rounded-none px-2 py-0.5 text-3xs font-mono font-bold uppercase tracking-wider transition-colors border",
                        isSelected
                          ? "bg-accent text-accent-foreground border-accent shadow-xs"
                          : "border-border/80 bg-surface-raised text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      Simulate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Buyback Retail Arbitrage Simulation (₹2,00,000 Allocation) */}
      {activeBuyback && activeBuyback.arbitrageSimulation && (
        <div className="rounded-none border border-accent/40 bg-surface p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-accent" />
                <h4 className="font-bold text-xs text-foreground font-mono">
                  {activeBuyback.name} ({activeBuyback.symbol}) — Retail Arbitrage Calculator
                </h4>
              </div>
              <p className="text-3xs text-muted-foreground mt-0.5">
                Simulated net yield for small shareholder allocation of ₹2,00,000 (qualifying for the 15% reserved retail quota).
              </p>
            </div>
            <div className="flex items-center gap-2.5 text-3xs font-mono">
              <span>Buyback: <strong className="text-foreground">₹{activeBuyback.buybackPrice}</strong></span>
              <span>CMP: <strong className="text-foreground">₹{activeBuyback.cmp}</strong></span>
              <span className="text-up font-bold">Premium: +{activeBuyback.premiumPct?.toFixed(1)}%</span>
            </div>
          </div>

          {/* Scenario Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {activeBuyback.arbitrageSimulation.scenarios.map((sc, i) => (
              <div
                key={i}
                className="rounded-none border border-border bg-surface-muted/30 p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-bold uppercase text-accent tracking-wider font-mono">
                    {sc.acceptanceRatioPct}% Acceptance
                  </span>
                  <span className="text-3xs font-mono text-muted-foreground">
                    {i === 0 ? "Conservative" : i === 1 ? "Base Case" : "Optimistic"}
                  </span>
                </div>

                <div className="space-y-0.5 font-mono text-2xs border-t border-border/40 pt-1.5 tabular-nums">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Accepted Shares:</span>
                    <strong className="text-foreground">{sc.acceptedShares} shares</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Unaccepted Shares:</span>
                    <strong className="text-foreground">{sc.unacceptedShares} shares</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Proceeds from Buyback:</span>
                    <strong className="text-up">₹{sc.cashFromAccepted.toLocaleString("en-IN")}</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Residual Value (at CMP):</span>
                    <strong className="text-foreground">₹{sc.residualSharesValue.toLocaleString("en-IN")}</strong>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-1.5 flex items-baseline justify-between font-mono">
                  <span className="text-3xs font-sans text-muted-foreground">Net Gain:</span>
                  <div className="text-right">
                    <span className="font-bold text-xs text-up">
                      +₹{sc.netProfitINR.toLocaleString("en-IN")}
                    </span>
                    <span className="ml-1 text-3xs text-up font-semibold">
                      (+{sc.returnPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legal & Regulatory notes */}
      <div className="rounded-none border border-border/80 bg-surface p-2.5 text-3xs text-muted-foreground space-y-0.5 font-sans">
        <div className="font-bold text-foreground flex items-center gap-1.5 text-3xs uppercase tracking-wider font-mono">
          <HelpCircle className="h-3 w-3 text-gold" /> Key Indian Buyback Regulations
        </div>
        <p className="text-3xs leading-relaxed">
          {initialData.rules?.smallShareholderLimit} {initialData.rules?.tenderOffer} {initialData.rules?.taxation}
        </p>
      </div>
    </div>
  );
}
