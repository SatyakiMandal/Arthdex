"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  AlertTriangle,
  Scale,
  Search,
  Filter,
  Flame,
  ArrowUpRight,
  Info,
} from "lucide-react";
import type { ApiSurveillanceOverview, ApiSurveillanceSecurity } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface SurveillanceDeskProps {
  initialData: ApiSurveillanceOverview;
}

export function SurveillanceDesk({ initialData }: SurveillanceDeskProps) {
  const [activeMeasure, setActiveMeasure] = useState<string>("ALL");
  const [activeBand, setActiveBand] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredSecurities = useMemo(() => {
    return initialData.securities.filter((sec) => {
      // Measure filter
      if (activeMeasure !== "ALL") {
        if (activeMeasure === "ASM-LT" && sec.measure !== "ASM-LT") return false;
        if (activeMeasure === "ASM-ST" && sec.measure !== "ASM-ST") return false;
        if (activeMeasure === "GSM" && sec.measure !== "GSM") return false;
        if (activeMeasure === "T2T" && sec.measure !== "T2T") return false;
      }

      // Circuit band filter
      if (activeBand !== "ALL") {
        const bandVal = parseFloat(activeBand);
        if (sec.priceBandPct !== bandVal) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toUpperCase();
        return sec.symbol.toUpperCase().includes(q) || sec.name.toUpperCase().includes(q);
      }

      return true;
    });
  }, [initialData.securities, activeMeasure, activeBand, searchQuery]);

  const { counts, circuitDistribution } = initialData;

  return (
    <div className="w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4 space-y-2 font-mono">
      {/* TERMINAL TOP STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-surface px-2.5 py-1.5 rounded-none shadow-xs text-2xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-accent">
            <ShieldAlert className="h-4 w-4" />
            <span>SURV &lt;GO&gt; · SEBI & NSE SURVEILLANCE & PRICE BANDS DESK</span>
          </span>
          <span className="text-3xs text-muted-foreground border-l border-border/60 pl-2">
            REGULATORY RISK RADAR
          </span>
        </div>
        <div className="flex items-center gap-3 text-3xs text-muted-foreground">
          <span>Active Monitored: <strong className="text-foreground">{initialData.totalSecurities}</strong></span>
          <span>Feed: <strong className="text-foreground">Official NSE Archives</strong></span>
          <span>Corridor: <strong className="text-up">100% Margin Enforced</strong></span>
        </div>
      </div>

      {/* METRIC COMMAND RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-muted-foreground uppercase tracking-wider">Total Surveillance</div>
          <div className="text-base font-bold text-foreground tabular-nums">{initialData.totalSecurities}</div>
          <div className="text-3xs text-muted-foreground">Restricted Trading Universe</div>
        </div>

        <div className="border border-amber-500/40 bg-amber-500/[0.02] p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-amber-500 uppercase tracking-wider">ASM Long-Term</div>
          <div className="text-base font-bold text-amber-500 tabular-nums">{counts.asmLongTerm}</div>
          <div className="text-3xs text-muted-foreground">100% Margin · 5% Band</div>
        </div>

        <div className="border border-blue-500/40 bg-blue-500/[0.02] p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-blue-500 uppercase tracking-wider">ASM Short-Term</div>
          <div className="text-base font-bold text-blue-500 tabular-nums">{counts.asmShortTerm}</div>
          <div className="text-3xs text-muted-foreground">50%–100% Upfront Margin</div>
        </div>

        <div className="border border-down/40 bg-down/[0.02] p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-down uppercase tracking-wider">GSM Framework</div>
          <div className="text-base font-bold text-down tabular-nums">{counts.gsm}</div>
          <div className="text-3xs text-muted-foreground">Stages I–IV · Up to 200% ASD</div>
        </div>

        <div className="border border-purple-500/40 bg-purple-500/[0.02] p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-purple-400 uppercase tracking-wider">T2T (Series BE)</div>
          <div className="text-base font-bold text-purple-400 tabular-nums">{counts.t2t}</div>
          <div className="text-3xs text-muted-foreground">Trade-for-Trade · 0 Intraday</div>
        </div>

        <div className="border border-red-500/40 bg-red-500/[0.02] p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-red-400 uppercase tracking-wider flex items-center gap-1">
            <Flame className="h-3 w-3" />
            <span>Severe Penalties</span>
          </div>
          <div className="text-base font-bold text-red-400 tabular-nums">{counts.severePenalties}</div>
          <div className="text-3xs text-muted-foreground">ASD Surcharge or Weekly Run</div>
        </div>
      </div>

      {/* CIRCUIT FILTER DISTRIBUTION & SEBI POLICY CORRIDOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Left 2 Cols: Circuit Band Distribution Breakdown */}
        <div className="lg:col-span-2 border border-border bg-surface p-2.5 rounded-none space-y-2">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5 text-2xs">
            <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-accent" />
              <span>Exchange Price Band Distribution Matrix</span>
            </span>
            <span className="text-3xs text-muted-foreground">Volatility Cap Floors</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs">
            <div className="border border-down/30 bg-down/[0.03] p-2 rounded-none">
              <div className="text-3xs text-down font-bold uppercase">2% Circuit Band</div>
              <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                {circuitDistribution.band2Pct} <span className="text-3xs text-muted-foreground font-normal">stocks</span>
              </div>
              <div className="text-3xs text-muted-foreground mt-0.5">Deep GSM / Critical Volatility</div>
            </div>

            <div className="border border-amber-500/30 bg-amber-500/[0.03] p-2 rounded-none">
              <div className="text-3xs text-amber-500 font-bold uppercase">5% Circuit Band</div>
              <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                {circuitDistribution.band5Pct} <span className="text-3xs text-muted-foreground font-normal">stocks</span>
              </div>
              <div className="text-3xs text-muted-foreground mt-0.5">Standard ASM &amp; T2T Segment</div>
            </div>

            <div className="border border-blue-500/30 bg-blue-500/[0.03] p-2 rounded-none">
              <div className="text-3xs text-blue-500 font-bold uppercase">10% Circuit Band</div>
              <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                {circuitDistribution.band10Pct} <span className="text-3xs text-muted-foreground font-normal">stocks</span>
              </div>
              <div className="text-3xs text-muted-foreground mt-0.5">Mid-Tier Price Variation Filter</div>
            </div>

            <div className="border border-up/30 bg-up/[0.03] p-2 rounded-none">
              <div className="text-3xs text-up font-bold uppercase">20% Circuit Band</div>
              <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                {circuitDistribution.band20Pct} <span className="text-3xs text-muted-foreground font-normal">stocks</span>
              </div>
              <div className="text-3xs text-muted-foreground mt-0.5">Standard Equity Cap Limit</div>
            </div>
          </div>
        </div>

        {/* Right Col: SEBI Penalty Framework Guide */}
        <div className="border border-border bg-surface p-2.5 rounded-none space-y-1.5 text-2xs">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-accent border-b border-border/70 pb-1">
            <Info className="h-3.5 w-3.5" />
            <span>SEBI Margin &amp; Deposit Penalties</span>
          </div>
          <ul className="text-3xs space-y-1 text-muted-foreground leading-relaxed">
            <li>
              <strong className="text-foreground">GSM Stage II:</strong> 50% Additional Surveillance Deposit (ASD) on buyer value.
            </li>
            <li>
              <strong className="text-foreground">GSM Stage III:</strong> 100% ASD surcharge + trading allowed only 1 day/week.
            </li>
            <li>
              <strong className="text-foreground">GSM Stage IV:</strong> 200% ASD surcharge + 1 day/week trading window.
            </li>
            <li>
              <strong className="text-foreground">Trade-to-Trade (T2T):</strong> 100% upfront delivery required; intraday squaring prohibited.
            </li>
          </ul>
        </div>
      </div>

      {/* FILTER CONTROLS & UNIVERSAL SEARCH BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface p-2 rounded-none text-2xs">
        {/* Measure Chips */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground uppercase font-bold text-3xs mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            <span>Measure:</span>
          </span>
          {[
            { id: "ALL", label: "All Lists" },
            { id: "ASM-LT", label: "ASM Long-Term" },
            { id: "ASM-ST", label: "ASM Short-Term" },
            { id: "GSM", label: "GSM Framework" },
            { id: "T2T", label: "T2T / BE Series" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMeasure(m.id)}
              className={cn(
                "px-2 py-0.5 font-bold uppercase transition-colors rounded-none border text-3xs",
                activeMeasure === m.id
                  ? "bg-foreground text-background border-foreground shadow-xs"
                  : "bg-surface-muted/60 border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Circuit Band Chips */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground uppercase font-bold text-3xs mr-1">Band:</span>
          {[
            { id: "ALL", label: "All" },
            { id: "2", label: "2%" },
            { id: "5", label: "5%" },
            { id: "10", label: "10%" },
            { id: "20", label: "20%" },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBand(b.id)}
              className={cn(
                "px-1.5 py-0.5 font-bold uppercase transition-colors rounded-none border text-3xs",
                activeBand === b.id
                  ? "bg-accent text-accent-foreground border-accent shadow-xs"
                  : "bg-surface-muted/60 border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticker or company..."
            className="w-44 sm:w-56 bg-surface-muted border border-border pl-7 pr-2 py-1 text-2xs uppercase outline-none focus:border-accent text-foreground rounded-none"
          />
        </div>
      </div>

      {/* SURVEILLANCE DIRECTORY TABLE */}
      <div className="overflow-x-auto border border-border bg-surface rounded-none">
        <table className="w-full min-w-[980px] border-collapse text-2xs font-mono">
          <caption className="sr-only">SEBI and NSE surveillance directory</caption>
          <thead>
            <tr className="border-b border-border bg-surface-muted/80 text-3xs uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-2.5 py-1.5 text-left font-bold text-foreground">Symbol / Series</th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Company Name</th>
              <th scope="col" className="px-2 py-1.5 text-center font-bold text-foreground">Measure</th>
              <th scope="col" className="px-2 py-1.5 text-center font-medium">Stage</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Price Band</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Margin Req</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Buyer ASD</th>
              <th scope="col" className="px-2 py-1.5 text-center font-medium">Trading Window</th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Regulatory Framework Reason</th>
              <th scope="col" className="px-2 py-1.5 text-center font-bold text-accent">Terminal &lt;GO&gt;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filteredSecurities.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No securities matching active filters &quot;{activeMeasure}&quot; / Band &quot;{activeBand}&quot; / Query &quot;{searchQuery}&quot;
                </td>
              </tr>
            ) : (
              filteredSecurities.map((sec) => {
                const isGsm = sec.measure === "GSM";
                const isAsm = sec.measure.startsWith("ASM");
                const hasAsd = sec.asdRatePct > 0;
                const isWeekly = sec.tradingWindow.includes("Weekly");

                return (
                  <tr
                    key={sec.symbol}
                    className={cn(
                      "hover:bg-surface-muted/60 transition-colors group",
                      hasAsd && "bg-red-500/[0.03]",
                      isWeekly && "bg-amber-500/[0.02]",
                    )}
                  >
                    <td className="px-2.5 py-1.5 font-bold text-foreground cell-glow whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground hover:text-accent font-extrabold">{sec.symbol}</span>
                        <span className={cn(
                          "px-1 py-0.2 text-3xs font-bold border rounded-none",
                          sec.series === "BE" ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "bg-surface-muted text-muted-foreground border-border",
                        )}>
                          {sec.series}
                        </span>
                      </div>
                    </td>

                    <td className="px-2.5 py-1.5 text-muted-foreground truncate max-w-[200px]" title={sec.name}>
                      {sec.name}
                    </td>

                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      <span className={cn(
                        "px-1.5 py-0.5 text-3xs font-extrabold border rounded-none uppercase",
                        isGsm && "bg-down/20 text-down border-down/40",
                        isAsm && "bg-amber-500/20 text-amber-500 border-amber-500/40",
                        sec.measure === "T2T" && "bg-purple-500/20 text-purple-400 border-purple-500/40",
                      )}>
                        {sec.measure}
                      </span>
                    </td>

                    <td className="px-2 py-1.5 text-center text-3xs font-semibold text-muted-foreground whitespace-nowrap">
                      {sec.stage || "—"}
                    </td>

                    <td className="px-2 py-1.5 text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                      <span className={cn(
                        sec.priceBandPct === 2 && "text-down",
                        sec.priceBandPct === 5 && "text-amber-500",
                        sec.priceBandPct === 10 && "text-blue-500",
                        sec.priceBandPct === 20 && "text-up",
                      )}>
                        ±{sec.priceBandPct.toFixed(0)}%
                      </span>
                    </td>

                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground whitespace-nowrap font-semibold">
                      {sec.marginRequiredPct.toFixed(0)}%
                    </td>

                    <td className="px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                      {hasAsd ? (
                        <span className="font-extrabold text-down px-1 py-0.2 bg-down/20 border border-down/40 rounded-none text-3xs">
                          +{sec.asdRatePct.toFixed(0)}% ASD
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-3xs">0%</span>
                      )}
                    </td>

                    <td className="px-2 py-1.5 text-center text-3xs whitespace-nowrap">
                      <span className={cn(
                        "font-semibold",
                        isWeekly ? "text-red-400 font-bold" : "text-muted-foreground",
                      )}>
                        {sec.tradingWindow}
                      </span>
                    </td>

                    <td className="px-2.5 py-1.5 text-3xs text-muted-foreground truncate max-w-[280px]" title={sec.reason}>
                      {sec.reason}
                    </td>

                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      <Link
                        href={`/company/${encodeURIComponent(sec.symbol)}`}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-accent/10 hover:bg-accent hover:text-accent-foreground text-accent text-3xs font-bold border border-accent/30 rounded-none transition-colors"
                      >
                        <span>DES</span>
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTNOTE */}
      <div className="flex flex-wrap items-center justify-between text-3xs text-muted-foreground pt-1 border-t border-border/40">
        <span>SEBI Circulars: SEBI/HO/ISD/ISD/CIR/P/2018/50 (ASM Framework) &amp; SEBI/HO/ISD/CIR/P/2017/47 (GSM Framework).</span>
        <span>Showing {filteredSecurities.length} of {initialData.totalSecurities} monitored securities.</span>
      </div>
    </div>
  );
}
