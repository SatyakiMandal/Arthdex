"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Activity,
  Layers,
  Scale,
  Percent,
  PieChart,
  ArrowRight,
  Filter,
} from "lucide-react";
import type {
  ApiFundScheme,
  ApiFundScreenerResponse,
  ApiFundOverlapResponse,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface FundScreenerDeskProps {
  initialData: ApiFundScreenerResponse;
  initialOverlap: ApiFundOverlapResponse;
  initialTab?: "screener" | "overlap";
}

export function FundScreenerDesk({
  initialData,
  initialOverlap,
  initialTab = "screener",
}: FundScreenerDeskProps) {
  const [activeTab, setActiveTab] = useState<"screener" | "overlap">(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedFundA, setSelectedFundA] = useState<string>(initialOverlap.fundA.code);
  const [selectedFundB, setSelectedFundB] = useState<string>(initialOverlap.fundB.code);

  const { asOf, funds, categories } = initialData;

  // Filtered funds list
  const filteredFunds = useMemo(() => {
    if (selectedCategory === "All") return funds;
    return funds.filter((f) => f.category === selectedCategory);
  }, [funds, selectedCategory]);

  // Client-side Overlap calculation for instant interactivity
  const overlapData = useMemo(() => {
    const fa = funds.find((f) => f.schemeCode === selectedFundA) || funds[0];
    const fb = funds.find((f) => f.schemeCode === selectedFundB) || funds[1];

    const weightsA: Record<string, { weight: number; name: string }> = {};
    const weightsB: Record<string, { weight: number; name: string }> = {};

    (fa.topHoldings || []).forEach((h) => {
      weightsA[h.symbol] = { weight: h.weight, name: h.name };
    });
    (fb.topHoldings || []).forEach((h) => {
      weightsB[h.symbol] = { weight: h.weight, name: h.name };
    });

    const commonKeys = Object.keys(weightsA).filter((k) => k in weightsB);
    let totalOverlap = 0;
    const commonList = commonKeys.map((sym) => {
      const wa = weightsA[sym].weight;
      const wb = weightsB[sym].weight;
      const ov = Math.min(wa, wb);
      totalOverlap += ov;
      return {
        symbol: sym,
        name: weightsA[sym].name,
        weightInA: wa,
        weightInB: wb,
        overlapPct: Math.round(ov * 10) / 10,
      };
    });

    commonList.sort((a, b) => b.overlapPct - a.overlapPct);

    return {
      fundA: { code: fa.schemeCode, name: fa.schemeName, category: fa.category },
      fundB: { code: fb.schemeCode, name: fb.schemeName, category: fb.category },
      totalOverlapPct: Math.round(totalOverlap * 10) / 10,
      commonHoldingsCount: commonList.length,
      holdings: commonList,
    };
  }, [funds, selectedFundA, selectedFundB]);

  return (
    <div className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-2.5 font-mono">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 py-1.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30">
            MF &lt;GO&gt;
          </span>
          <span className="text-muted-foreground text-2xs">{"//"}</span>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            AMFI Mutual Fund Master Screener &amp; Portfolio Overlap Desk
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-muted-foreground border-l border-border pl-2">
            <PieChart className="h-3 w-3 text-cyan-400" />
            Official AMFI NAVs &amp; Statutory Holdings
          </span>
        </div>

        <div className="flex items-center gap-2 text-3xs text-muted-foreground">
          <span>AS OF: {new Date(asOf).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      {/* 2. Executive Headline Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {/* Card 1: Tracked Schemes */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Tracked Direct Schemes</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground tabular-nums">
              {funds.length} Schemes
            </span>
            <span className="text-3xs text-muted-foreground">Across {categories.length} Categories</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Direct-Growth NAV master</div>
        </div>

        {/* Card 2: Category Top Performer */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Top 1Y Return</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-emerald-400 tabular-nums">+38.5%</span>
            <span className="text-3xs text-muted-foreground">Nippon Small Cap</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">3Y CAGR: 29.8%</div>
        </div>

        {/* Card 3: Median Expense Ratio (TER) */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Median TER (Direct)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-cyan-400 tabular-nums">0.61%</span>
            <span className="text-3xs text-muted-foreground">vs 1.8% Regular</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Substantial fee savings</div>
        </div>

        {/* Card 4: Top Sharpe Ratio */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Top Sharpe Ratio</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-amber-400 tabular-nums">2.15</span>
            <span className="text-3xs text-muted-foreground">Risk-Adjusted Alpha</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Sortino: 3.45</div>
        </div>
      </div>

      {/* 3. Tab Switcher */}
      <div className="flex items-center justify-between border-b border-border pb-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("screener")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "screener"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Scheme Master Screener (MFS)
          </button>
          <button
            onClick={() => setActiveTab("overlap")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "overlap"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Portfolio Overlap Engine (OVLP)
          </button>
        </div>

        {activeTab === "screener" && (
          <div className="flex items-center gap-1 text-3xs">
            <span className="text-muted-foreground">CATEGORY:</span>
            {["All", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-1.5 py-0.2 border transition-colors",
                  selectedCategory === cat
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Tab 1: Scheme Master Screener Table */}
      {activeTab === "screener" && (
        <div className="border border-border bg-card/60 p-2 space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-2xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-1.5 px-2">Scheme Name</th>
                  <th className="py-1.5 px-2">Category</th>
                  <th className="py-1.5 px-2 text-right">NAV (₹)</th>
                  <th className="py-1.5 px-2 text-right">1D (%)</th>
                  <th className="py-1.5 px-2 text-right">1Y Return</th>
                  <th className="py-1.5 px-2 text-right">3Y CAGR</th>
                  <th className="py-1.5 px-2 text-right">5Y CAGR</th>
                  <th className="py-1.5 px-2 text-right">AUM (₹ Cr)</th>
                  <th className="py-1.5 px-2 text-right">TER (%)</th>
                  <th className="py-1.5 px-2 text-right">Sharpe</th>
                  <th className="py-1.5 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredFunds.map((fund) => (
                  <tr key={fund.schemeCode} className="hover:bg-muted/40 transition-colors">
                    <td className="py-1.5 px-2 font-medium text-foreground">
                      <div className="truncate max-w-[260px] font-sans text-xs">
                        {fund.schemeName}
                      </div>
                      <span className="text-3xs text-muted-foreground font-mono">
                        {fund.amc} · AMFI: {fund.schemeCode}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-3xs text-muted-foreground">
                      <span className="px-1.5 py-0.5 border border-border bg-muted/20">
                        {fund.category}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-foreground tabular-nums">
                      ₹{fund.nav.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 px-2 text-right tabular-nums",
                        fund.change1dPct >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {fund.change1dPct >= 0 ? "+" : ""}
                      {fund.change1dPct.toFixed(2)}%
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-emerald-400 tabular-nums">
                      +{fund.returns1y.toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-emerald-400 tabular-nums">
                      +{fund.returns3y.toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">
                      +{fund.returns5y.toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-2 text-right text-foreground tabular-nums">
                      ₹{fund.aumCr.toLocaleString("en-IN")}
                    </td>
                    <td className="py-1.5 px-2 text-right text-cyan-400 tabular-nums">
                      {fund.expenseRatio.toFixed(2)}%
                    </td>
                    <td className="py-1.5 px-2 text-right text-amber-400 font-bold tabular-nums">
                      {fund.sharpeRatio.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <button
                        onClick={() => {
                          setSelectedFundA(fund.schemeCode);
                          setActiveTab("overlap");
                        }}
                        className="px-1.5 py-0.5 text-3xs font-bold uppercase border border-border bg-card hover:bg-muted text-foreground transition-colors"
                      >
                        Overlap
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Tab 2: Portfolio Overlap Analyzer */}
      {activeTab === "overlap" && (
        <div className="space-y-2">
          {/* Overlap Scheme Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-border bg-card/60 p-2">
            <div>
              <label className="text-3xs uppercase text-muted-foreground font-bold">SELECT FUND A:</label>
              <select
                value={selectedFundA}
                onChange={(e) => setSelectedFundA(e.target.value)}
                className="w-full mt-1 px-2 py-1 text-xs bg-background border border-border font-mono text-foreground focus:outline-none focus:border-amber-500"
              >
                {funds.map((f) => (
                  <option key={f.schemeCode} value={f.schemeCode}>
                    {f.schemeName} ({f.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-3xs uppercase text-muted-foreground font-bold">SELECT FUND B:</label>
              <select
                value={selectedFundB}
                onChange={(e) => setSelectedFundB(e.target.value)}
                className="w-full mt-1 px-2 py-1 text-xs bg-background border border-border font-mono text-foreground focus:outline-none focus:border-amber-500"
              >
                {funds.map((f) => (
                  <option key={f.schemeCode} value={f.schemeCode}>
                    {f.schemeName} ({f.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Overlap Summary Card */}
          <div className="border border-border bg-card/80 p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-3xs uppercase tracking-wider text-muted-foreground">PAIRWISE PORTFOLIO OVERLAP</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                  {overlapData.totalOverlapPct}%
                </span>
                <span className="text-2xs text-muted-foreground">
                  ({overlapData.commonHoldingsCount} common stock constituents)
                </span>
              </div>
            </div>

            <div className="max-w-md text-3xs text-muted-foreground leading-relaxed border-l border-border pl-3">
              <strong className="text-foreground">DUPLICATION ASSESSMENT: </strong>
              {overlapData.totalOverlapPct > 50 ? (
                <span className="text-rose-400 font-bold">High Overlap ({">"}50%). </span>
              ) : overlapData.totalOverlapPct > 25 ? (
                <span className="text-amber-400 font-bold">Moderate Overlap (25%-50%). </span>
              ) : (
                <span className="text-emerald-400 font-bold">Low Overlap ({"<"}25%). </span>
              )}
              Holding both schemes means you pay duplicate TER management fees on {overlapData.totalOverlapPct}% of your capital.
            </div>
          </div>

          {/* Common Constituents Table */}
          <div className="border border-border bg-card/60 p-2 space-y-2">
            <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
              COMMON UNDERLYING STOCKS IN BOTH SCHEMES
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-2xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                    <th className="py-1 px-2">Constituent</th>
                    <th className="py-1 px-2 text-right">Weight in Fund A (%)</th>
                    <th className="py-1 px-2 text-right">Weight in Fund B (%)</th>
                    <th className="py-1 px-2 text-right">Common Overlap Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {overlapData.holdings.map((h) => (
                    <tr key={h.symbol} className="hover:bg-muted/40 transition-colors">
                      <td className="py-1.5 px-2 font-medium text-foreground">
                        <span className="font-bold">{h.symbol}</span>
                        <span className="ml-1.5 text-3xs text-muted-foreground font-sans">
                          {h.name}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-foreground">
                        {h.weightInA.toFixed(1)}%
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-foreground">
                        {h.weightInB.toFixed(1)}%
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-bold text-amber-400">
                        {h.overlapPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Footer Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-3xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-foreground">RELATED TERMINAL WORKBENCHES:</span>
          <Link href="/portfolio" className="text-cyan-400 hover:underline">
            PORT &lt;GO&gt; (Portfolio &amp; XIRR)
          </Link>
          <Link href="/screener" className="text-cyan-400 hover:underline">
            EQS &lt;GO&gt; (Equity Screener)
          </Link>
          <Link href="/yield-curve" className="text-cyan-400 hover:underline">
            GC &lt;GO&gt; (Sovereign Yield Curve)
          </Link>
        </div>

        <div>
          <span>AMFI official daily NAV &amp; AMC monthly portfolio holdings</span>
        </div>
      </div>
    </div>
  );
}
