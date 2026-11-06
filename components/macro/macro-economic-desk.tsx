"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Landmark,
  Scale,
  ShieldAlert,
  ArrowRight,
  BarChart3,
  Layers,
} from "lucide-react";
import type { ApiMacroDashboardResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface MacroEconomicDeskProps {
  initialData: ApiMacroDashboardResponse;
}

export function MacroEconomicDesk({ initialData }: MacroEconomicDeskProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "inflation" | "activity" | "calendar">("overview");

  const { asOf, headline, inflationBreakdown, activityIndicators, calendar } = initialData;

  return (
    <div className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-2.5 font-mono">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 py-1.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30">
            ECO &lt;GO&gt;
          </span>
          <span className="text-muted-foreground text-2xs">{"//"}</span>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            India Macroeconomic Telemetry &amp; RBI Central Bank Monitor
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-muted-foreground border-l border-border pl-2">
            <Landmark className="h-3 w-3 text-cyan-400" />
            Official MOSPI · RBI DBIE · Ministry of Finance
          </span>
        </div>

        <div className="flex items-center gap-2 text-3xs text-muted-foreground">
          <span>DATA AS OF: {new Date(asOf).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      {/* 2. Executive Headline Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {/* Card 1: CPI Inflation */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">CPI Headline Inflation</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground tabular-nums">
              {headline.cpiInflation.value.toFixed(2)}%
            </span>
            <span className="text-3xs text-muted-foreground">YoY</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            RBI Band: {headline.cpiInflation.rbiTarget}
          </div>
          <div className="mt-1 text-3xs text-amber-400 font-semibold truncate">
            {headline.cpiInflation.status}
          </div>
        </div>

        {/* Card 2: Real GDP Growth */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Real GDP Growth (YoY)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-emerald-400 tabular-nums">
              {headline.gdpGrowth.value.toFixed(1)}%
            </span>
            <span className="text-3xs text-muted-foreground">({headline.gdpGrowth.period})</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            Nominal GDP: {headline.gdpGrowth.nominalGdp}%
          </div>
          <div className="mt-1 text-3xs text-emerald-400 font-semibold truncate">
            {headline.gdpGrowth.status}
          </div>
        </div>

        {/* Card 3: Gross GST Collections */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Gross GST Revenue</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-cyan-400 tabular-nums">
              ₹{headline.gstCollections.value.toFixed(2)}L Cr
            </span>
            <span className="text-3xs text-emerald-400 font-bold">
              +{headline.gstCollections.growthYoY}% YoY
            </span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            Period: {headline.gstCollections.period}
          </div>
          <div className="mt-1 text-3xs text-cyan-400 font-semibold truncate">
            {headline.gstCollections.status}
          </div>
        </div>

        {/* Card 4: Forex Reserves */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">RBI Forex Reserves</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-emerald-400 tabular-nums">
              ${headline.forexReserves.value.toFixed(1)}B
            </span>
            <span className="text-3xs text-muted-foreground">ATH</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">
            FCA: ${headline.forexReserves.fcaBillion}B | Gold: ${headline.forexReserves.goldBillion}B
          </div>
          <div className="mt-1 text-3xs text-emerald-400 font-semibold truncate">
            {headline.forexReserves.status}
          </div>
        </div>
      </div>

      {/* 3. Tab Selector Bar */}
      <div className="flex items-center justify-between border-b border-border pb-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "overview"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Executive Overview
          </button>
          <button
            onClick={() => setActiveTab("inflation")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "inflation"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Inflation Basket (CPI / WPI)
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "activity"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            High-Frequency Activity
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "calendar"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Economic Calendar
          </button>
        </div>

        <div className="text-3xs text-muted-foreground">
          <span>Official Government Datasets</span>
        </div>
      </div>

      {/* 4. Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {/* Left: Key Inflation & Growth Drivers */}
          <div className="border border-border bg-card/60 p-2 space-y-2">
            <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
              INFLATION DECOMPOSITION (MOSPI CPI &amp; DPIIT WPI)
            </div>
            <table className="w-full text-left text-2xs border-collapse">
              <thead>
                <tr className="border-b border-border text-3xs text-muted-foreground uppercase">
                  <th className="py-1 px-1.5">Component</th>
                  <th className="py-1 px-1.5 text-right">Weight</th>
                  <th className="py-1 px-1.5 text-right">Latest</th>
                  <th className="py-1 px-1.5 text-right">Prior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {inflationBreakdown.map((row) => (
                  <tr key={row.category} className="hover:bg-muted/30">
                    <td className="py-1 px-1.5 font-sans font-medium text-foreground">
                      {row.category}
                    </td>
                    <td className="py-1 px-1.5 text-right text-muted-foreground">
                      {row.weight}%
                    </td>
                    <td
                      className={cn(
                        "py-1 px-1.5 text-right font-bold tabular-nums",
                        row.current > 6.0
                          ? "text-rose-400"
                          : row.current < 2.0
                          ? "text-cyan-400"
                          : "text-emerald-400"
                      )}
                    >
                      {row.current.toFixed(2)}%
                    </td>
                    <td className="py-1 px-1.5 text-right text-muted-foreground tabular-nums">
                      {row.previous.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: Real Economy Activity Indicators */}
          <div className="border border-border bg-card/60 p-2 space-y-2">
            <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
              REAL ECONOMY ACTIVITY &amp; BANKING LIQUIDITY
            </div>
            <div className="space-y-1.5">
              {activityIndicators.slice(0, 5).map((act) => (
                <div
                  key={act.indicator}
                  className="border border-border/60 bg-muted/10 p-1.5 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-3xs font-bold text-foreground uppercase">
                        {act.indicator}
                      </span>
                      <span className="text-3xs text-muted-foreground">({act.source})</span>
                    </div>
                    <p className="text-3xs text-muted-foreground mt-0.5">{act.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold font-mono text-cyan-400">{act.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "inflation" && (
        <div className="border border-border bg-card/60 p-2 space-y-2">
          <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
            FULL INFLATION BASKET (WEIGHTS, HISTORICAL TRENDS &amp; TOLERANCE BOUNDS)
          </div>
          <table className="w-full text-left text-2xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                <th className="py-1 px-2">Category</th>
                <th className="py-1 px-2 text-right">Basket Weight</th>
                <th className="py-1 px-2 text-right">Current Rate</th>
                <th className="py-1 px-2 text-right">Previous Rate</th>
                <th className="py-1 px-2 text-right">Net YoY Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {inflationBreakdown.map((row) => (
                <tr key={row.category} className="hover:bg-muted/30">
                  <td className="py-1 px-2 font-sans font-medium text-foreground">{row.category}</td>
                  <td className="py-1 px-2 text-right text-muted-foreground">{row.weight}%</td>
                  <td
                    className={cn(
                      "py-1 px-2 text-right font-bold tabular-nums",
                      row.current > 6.0 ? "text-rose-400" : "text-emerald-400"
                    )}
                  >
                    {row.current.toFixed(2)}%
                  </td>
                  <td className="py-1 px-2 text-right text-muted-foreground tabular-nums">
                    {row.previous.toFixed(2)}%
                  </td>
                  <td className="py-1 px-2 text-right text-foreground font-semibold">
                    {row.changeYoY}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="border border-border bg-card/60 p-2 space-y-2">
          <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
            HIGH-FREQUENCY ECONOMIC GAUGES &amp; TRADE BALANCE
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activityIndicators.map((act) => (
              <div
                key={act.indicator}
                className="border border-border/60 bg-muted/20 p-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase">
                      {act.indicator}
                    </span>
                    <span className="text-3xs text-muted-foreground uppercase font-bold">
                      {act.source}
                    </span>
                  </div>
                  <p className="text-3xs text-muted-foreground mt-1 leading-relaxed">
                    {act.detail}
                  </p>
                </div>
                <div className="mt-2 pt-1 border-t border-border/40 flex justify-between items-baseline font-mono">
                  <span className="text-3xs text-muted-foreground">REPORTED:</span>
                  <span className="text-sm font-bold text-cyan-400">{act.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="border border-border bg-card/60 p-2 space-y-2">
          <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
            HIGH-IMPACT ECONOMIC &amp; POLICY RELEASE SCHEDULE
          </div>
          <table className="w-full text-left text-2xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                <th className="py-1 px-2">Release Date</th>
                <th className="py-1 px-2">Economic Event</th>
                <th className="py-1 px-2 text-center">Impact</th>
                <th className="py-1 px-2 text-right">Consensus Forecast</th>
                <th className="py-1 px-2 text-right">Prior Figure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {calendar.map((ev) => (
                <tr key={ev.event} className="hover:bg-muted/30">
                  <td className="py-1.5 px-2 font-bold text-foreground">{ev.date}</td>
                  <td className="py-1.5 px-2 font-sans font-medium text-foreground">
                    {ev.event}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span
                      className={cn(
                        "px-1.5 py-0.2 text-3xs font-bold uppercase border",
                        ev.impact === "HIGH"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      )}
                    >
                      {ev.impact}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-cyan-400 font-bold">
                    {ev.consensus}
                  </td>
                  <td className="py-1.5 px-2 text-right text-muted-foreground">
                    {ev.previous}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Quick Terminal Function Navigators */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-3xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-foreground">RELATED MACRO &amp; RATES DESKS:</span>
          <Link href="/yield-curve" className="text-cyan-400 hover:underline">
            GC &lt;GO&gt; (Sovereign Yield Curve)
          </Link>
          <Link href="/fx" className="text-cyan-400 hover:underline">
            FXM &lt;GO&gt; (Foreign Exchange &amp; INR)
          </Link>
          <Link href="/catalysts" className="text-cyan-400 hover:underline">
            CAT &lt;GO&gt; (Market Catalysts)
          </Link>
          <Link href="/briefing" className="text-cyan-400 hover:underline">
            BRIEF &lt;GO&gt; (Morning Briefing)
          </Link>
        </div>

        <div>
          <span>MOSPI &amp; Reserve Bank of India primary releases</span>
        </div>
      </div>
    </div>
  );
}
