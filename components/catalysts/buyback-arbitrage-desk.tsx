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
    <div className="space-y-6">
      {/* Simulation Notice */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground text-2xs uppercase tracking-wider">
            SCENARIO SIMULATION DESK · MODELLED PAYOFFS
          </span>
          <p className="text-3xs leading-relaxed text-muted-foreground">
            Tender offer sizes, record dates, and SEBI small shareholder rules (holding &le; ₹2,00,000) are compiled from exchange filings. Net returns across 20%, 35%, and 50% acceptance ratios are <strong>interactive &quot;what-if&quot; simulations</strong> modeling post-buyback price drift.
          </p>
        </div>
      </div>

      {/* Top explainer banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-emerald-500" />
          <span>
            SEBI Small Shareholder Reservation: <strong className="text-foreground">15% Quota</strong>
          </span>
          <span className="text-border">|</span>
          <span>Max Value for Retail: <strong className="text-foreground">₹2,00,000 as on Record Date</strong></span>
        </div>
        <div className="text-2xs font-mono">
          Tracked Buybacks: <strong>{buybacks.length} Companies</strong>
        </div>
      </div>

      {/* Buybacks Overview Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-2xs text-muted-foreground uppercase tracking-wider">
              <th className="p-3 font-semibold">Company &amp; Scrip</th>
              <th className="p-3 text-right font-semibold">CMP (₹)</th>
              <th className="p-3 text-right font-semibold">Buyback Price (₹)</th>
              <th className="p-3 text-right font-semibold">Premium (%)</th>
              <th className="p-3 text-right font-semibold">Offer Size (₹ Cr)</th>
              <th className="p-3 font-semibold">Record Date</th>
              <th className="p-3 font-semibold">Tender Closes</th>
              <th className="p-3 text-center font-semibold">Offer Status</th>
              <th className="p-3 text-center font-semibold">Arbitrage Simulator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 font-mono">
            {buybacks.map((b) => {
              const isSelected = activeBuyback?.symbol === b.symbol;
              const hasPremium = b.premiumPct !== null && b.premiumPct > 0;

              return (
                <tr
                  key={b.symbol}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    isSelected && "bg-primary/5",
                  )}
                >
                  <td className="p-3 font-sans">
                    <Link
                      href={`/company/${b.symbol}`}
                      className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      {b.symbol}
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                    <div className="text-3xs text-muted-foreground line-clamp-1">{b.name}</div>
                  </td>

                  <td className="p-3 text-right text-foreground font-semibold">
                    {b.cmp ? `₹${b.cmp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
                  </td>

                  <td className="p-3 text-right text-emerald-400 font-bold">
                    ₹{b.buybackPrice.toLocaleString("en-IN")}
                  </td>

                  <td className="p-3 text-right">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-2xs font-bold",
                        hasPremium ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground",
                      )}
                    >
                      {b.premiumPct ? `+${b.premiumPct.toFixed(1)}%` : "—"}
                    </span>
                  </td>

                  <td className="p-3 text-right text-foreground">
                    ₹{b.totalSizeCr.toLocaleString("en-IN")} Cr
                  </td>

                  <td className="p-3 text-muted-foreground font-sans text-2xs">
                    {b.recordDate}
                  </td>

                  <td className="p-3 text-muted-foreground font-sans text-2xs">
                    {b.tenderEndDate}
                  </td>

                  <td className="p-3 text-center font-sans">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border",
                        b.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : b.status === "UPCOMING"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          : "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {b.status}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelectedSymbol(b.symbol)}
                      className={cn(
                        "rounded px-2.5 py-1 text-2xs font-sans font-semibold transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-primary/40 text-primary hover:bg-primary/10",
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
        <div className="rounded-xl border border-primary/40 bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <h4 className="font-bold text-sm text-foreground">
                  {activeBuyback.name} ({activeBuyback.symbol}) — Retail Arbitrage Calculator
                </h4>
              </div>
              <p className="text-3xs text-muted-foreground mt-0.5">
                Simulated net yield for small shareholder allocation of ₹2,00,000 (qualifying for the 15% reserved retail quota).
              </p>
            </div>
            <div className="flex items-center gap-3 text-2xs font-mono">
              <span>Buyback: <strong>₹{activeBuyback.buybackPrice}</strong></span>
              <span>CMP: <strong>₹{activeBuyback.cmp}</strong></span>
              <span className="text-emerald-400 font-bold">Premium: +{activeBuyback.premiumPct?.toFixed(1)}%</span>
            </div>
          </div>

          {/* Scenario Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeBuyback.arbitrageSimulation.scenarios.map((sc, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase text-primary tracking-wider">
                    {sc.acceptanceRatioPct}% Acceptance
                  </span>
                  <span className="text-3xs font-mono text-muted-foreground">
                    {i === 0 ? "Conservative" : i === 1 ? "Base Case" : "Optimistic"}
                  </span>
                </div>

                <div className="space-y-1 font-mono text-xs border-t border-border/40 pt-2">
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
                    <strong className="text-emerald-400">₹{sc.cashFromAccepted.toLocaleString("en-IN")}</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Residual Value (at CMP):</span>
                    <strong className="text-foreground">₹{sc.residualSharesValue.toLocaleString("en-IN")}</strong>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-2 flex items-baseline justify-between">
                  <span className="text-2xs font-sans text-muted-foreground">Net Arbitrage Gain:</span>
                  <div className="text-right font-mono">
                    <span className="font-bold text-sm text-emerald-400">
                      +₹{sc.netProfitINR.toLocaleString("en-IN")}
                    </span>
                    <span className="ml-1 text-2xs text-emerald-400 font-semibold">
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
      <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 text-2xs text-muted-foreground space-y-1 font-sans">
        <div className="font-semibold text-foreground flex items-center gap-1.5 text-2xs uppercase tracking-wider">
          <HelpCircle className="h-3.5 w-3.5 text-primary" /> Key Indian Buyback Regulations
        </div>
        <p className="text-2xs leading-relaxed">
          {initialData.rules?.smallShareholderLimit} {initialData.rules?.tenderOffer} {initialData.rules?.taxation}
        </p>
      </div>
    </div>
  );
}
