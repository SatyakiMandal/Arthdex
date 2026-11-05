"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Layers, ShieldCheck, Zap, ArrowDownToLine, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiBhavScanner, ApiBhavScannerStock } from "@/lib/api/types";

type SignalTab = "ALL" | "ACCUMULATION" | "SURGE" | "ABSORPTION" | "DISTRIBUTION";

const SIGNAL_LABELS: Record<string, { label: string; badge: string; desc: string; icon: typeof ShieldCheck }> = {
  ACCUMULATION: {
    label: "Institutional Accumulation",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    desc: "Delivery ≥60%, Volume ≥1.6x 20D Avg, Price Up. Institutional buyers taking physical delivery.",
    icon: ShieldCheck,
  },
  SURGE: {
    label: "Volume Surge",
    badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    desc: "Volume ≥2.5x 20D Avg with positive momentum. Massive market participation.",
    icon: Zap,
  },
  ABSORPTION: {
    label: "Supply Absorption",
    badge: "bg-purple-500/20 text-purple-400 border-purple-500/40",
    desc: "High delivery with muted price movement (-1% to +0.2%). Institutional desks absorbing large selling pressure.",
    icon: ArrowDownToLine,
  },
  DISTRIBUTION: {
    label: "Institutional Distribution",
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    desc: "High delivery on sharp price decline (<-1.5%). High volume institutional offloading.",
    icon: Flame,
  },
};

export function DeliveryScanner({
  initialData,
}: {
  initialData: ApiBhavScanner;
}) {
  const [activeTab, setActiveTab] = useState<SignalTab>("ALL");
  const [search, setSearch] = useState("");

  const stocks = initialData.stocks ?? [];
  const counts = initialData.counts ?? {
    accumulation: 0,
    volume_surges: 0,
    absorption: 0,
    distribution: 0,
    total_screened: stocks.length,
  };

  const filtered = stocks.filter((s) => {
    if (activeTab !== "ALL" && !s.signals.includes(activeTab)) {
      return false;
    }
    if (search.trim()) {
      return s.symbol.toUpperCase().includes(search.trim().toUpperCase());
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Signal summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab(activeTab === "ACCUMULATION" ? "ALL" : "ACCUMULATION")}
          className={cn(
            "rounded-none border p-2 sm:p-2.5 text-left transition-all cell-glow",
            activeTab === "ACCUMULATION"
              ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40"
              : "border-border/80 bg-card hover:border-emerald-500/40",
          )}
        >
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Accumulation
            </span>
            <span className="font-mono text-xs font-bold text-foreground">{counts.accumulation}</span>
          </div>
          <p className="mt-1.5 text-3xs text-muted-foreground line-clamp-1">
            Delivery ≥60% &amp; Volume &gt;1.6x on green candle
          </p>
        </button>

        <button
          onClick={() => setActiveTab(activeTab === "SURGE" ? "ALL" : "SURGE")}
          className={cn(
            "rounded-none border p-2 sm:p-2.5 text-left transition-all cell-glow",
            activeTab === "SURGE"
              ? "border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/40"
              : "border-border/80 bg-card hover:border-cyan-500/40",
          )}
        >
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-cyan-500 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Volume Surge
            </span>
            <span className="font-mono text-xs font-bold text-foreground">{counts.volume_surges}</span>
          </div>
          <p className="mt-1.5 text-3xs text-muted-foreground line-clamp-1">
            Volume &gt;2.5x 20D average on price up
          </p>
        </button>

        <button
          onClick={() => setActiveTab(activeTab === "ABSORPTION" ? "ALL" : "ABSORPTION")}
          className={cn(
            "rounded-none border p-2 sm:p-2.5 text-left transition-all cell-glow",
            activeTab === "ABSORPTION"
              ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/40"
              : "border-border/80 bg-card hover:border-purple-500/40",
          )}
        >
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1">
              <ArrowDownToLine className="h-3.5 w-3.5" /> Absorption
            </span>
            <span className="font-mono text-xs font-bold text-foreground">{counts.absorption}</span>
          </div>
          <p className="mt-1.5 text-3xs text-muted-foreground line-clamp-1">
            High delivery with flat price action
          </p>
        </button>

        <button
          onClick={() => setActiveTab(activeTab === "DISTRIBUTION" ? "ALL" : "DISTRIBUTION")}
          className={cn(
            "rounded-none border p-2 sm:p-2.5 text-left transition-all cell-glow",
            activeTab === "DISTRIBUTION"
              ? "border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/40"
              : "border-border/80 bg-card hover:border-rose-500/40",
          )}
        >
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-rose-500 flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" /> Distribution
            </span>
            <span className="font-mono text-xs font-bold text-foreground">{counts.distribution}</span>
          </div>
          <p className="mt-1.5 text-3xs text-muted-foreground line-clamp-1">
            High delivery on sharp price drops
          </p>
        </button>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["ALL", "ACCUMULATION", "SURGE", "ABSORPTION", "DISTRIBUTION"] as SignalTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-none px-3 py-1 text-2xs font-semibold uppercase tracking-wider transition-all",
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab === "ALL" ? `All Signals (${stocks.length})` : tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by symbol..."
            className="rounded-none border border-border/80 bg-card px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-52"
          />
        </div>
      </div>

      {/* Screened Stocks Table */}
      <div className="overflow-x-auto rounded-none border border-border bg-card">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-2xs text-muted-foreground uppercase tracking-wider">
              <th className="px-2.5 py-1.5 font-semibold">Symbol</th>
              <th className="px-2 py-1.5 text-right font-semibold">Close</th>
              <th className="px-2 py-1.5 text-right font-semibold">% Chg</th>
              <th className="px-2 py-1.5 text-left font-semibold min-w-32">Delivery %</th>
              <th className="px-2 py-1.5 text-right font-semibold">Delivery Vol</th>
              <th className="px-2 py-1.5 text-right font-semibold">Total Vol</th>
              <th className="px-2 py-1.5 text-right font-semibold">Turnover</th>
              <th className="px-2 py-1.5 text-right font-semibold">Vol vs 20D</th>
              <th className="px-2.5 py-1.5 text-left font-semibold">Signals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-xs text-muted-foreground font-sans">
                  No stocks match the current filter criteria for trade date {initialData.tradeDate}.
                </td>
              </tr>
            ) : (
              filtered.map((stock) => (
                <tr key={stock.symbol} className="hover:bg-muted/30 transition-colors">
                  <td className="px-2.5 py-1 font-sans cell-glow">
                    <Link
                      href={`/company/${stock.symbol}`}
                      className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      {stock.symbol}
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-right text-foreground font-semibold cell-glow font-mono tabular-nums text-xs">
                    ₹{stock.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1 text-right cell-glow">
                    <span
                      className={cn(
                        "inline-flex items-center text-xs font-semibold font-mono tabular-nums",
                        stock.changePct >= 0 ? "text-emerald-500" : "text-rose-500",
                      )}
                    >
                      {stock.changePct >= 0 ? (
                        <ArrowUpRight className="h-3 w-3 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 mr-0.5" />
                      )}
                      {stock.changePct >= 0 ? "+" : ""}
                      {stock.changePct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-none bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-none",
                            stock.deliveryPct >= 70
                              ? "bg-emerald-500"
                              : stock.deliveryPct >= 50
                              ? "bg-primary"
                              : "bg-muted-foreground",
                          )}
                          style={{ width: `${Math.min(100, stock.deliveryPct)}%` }}
                        />
                      </div>
                      <span className="font-semibold text-xs text-foreground font-mono tabular-nums">
                        {stock.deliveryPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right text-muted-foreground cell-glow font-mono tabular-nums text-xs">
                    {stock.deliveryVolume.toLocaleString("en-IN")}
                  </td>
                  <td className="px-2 py-1 text-right text-muted-foreground cell-glow font-mono tabular-nums text-xs">
                    {stock.totalVolume.toLocaleString("en-IN")}
                  </td>
                  <td className="px-2 py-1 text-right text-foreground font-medium cell-glow font-mono tabular-nums text-xs">
                    ₹{stock.turnoverCr.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr
                  </td>
                  <td className="px-2 py-1 text-right cell-glow">
                    <span
                      className={cn(
                        "rounded-none px-1.5 py-0.5 text-3xs font-bold font-mono",
                        stock.volumeVs20dAvg >= 2.5
                          ? "bg-cyan-500/20 text-cyan-400"
                          : stock.volumeVs20dAvg >= 1.6
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {stock.volumeVs20dAvg.toFixed(1)}x
                    </span>
                  </td>
                  <td className="px-2.5 py-1 font-sans cell-glow">
                    <div className="flex flex-wrap gap-1">
                      {stock.signals.map((sig) => {
                        const meta = SIGNAL_LABELS[sig];
                        return (
                          <span
                            key={sig}
                            className={cn(
                              "rounded-none px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider border",
                              meta ? meta.badge : "bg-muted text-muted-foreground border-border",
                            )}
                          >
                            {sig}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between text-2xs text-muted-foreground border-t border-border/40 pt-3">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Screened from official NSE Bhavcopy for session: {initialData.tradeDate}.</span>
        </div>
        <div>
          <span>Liquid counters only (Turnover ≥ ₹3 Cr). Delivery % indicates percentage of trades taken for holding.</span>
        </div>
      </div>
    </div>
  );
}
