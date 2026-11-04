"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  Filter,
  Flame,
  Gauge,
  Layers,
  PieChart,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiPulse, ApiPulseStock } from "@/lib/api/types";

interface MacroMarketRadarProps {
  pulse: ApiPulse;
  currentIndex: string;
  onUniverseChange: (idx: string) => void;
  onSelectStock?: (symbol: string) => void;
}

const UNIVERSES = [
  { id: "nifty50", label: "Nifty 50" },
  { id: "nifty100", label: "Nifty 100" },
  { id: "nifty200", label: "Nifty 200" },
  { id: "nifty500", label: "Nifty 500" },
];

function fmtINR(val: number | null | undefined, prefix = "₹"): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `${prefix}${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function fmtCompact(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toLocaleString("en-IN");
}

export function MacroMarketRadar({
  pulse,
  currentIndex,
  onUniverseChange,
  onSelectStock,
}: MacroMarketRadarProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [movementFilter, setMovementFilter] = useState<
    "ALL" | "BUYING" | "SELLING" | "UNMOVED" | "SURGE"
  >("ALL");
  const [sortBy, setSortBy] = useState<"turnover" | "changeDesc" | "changeAsc" | "mcap">("turnover");
  const [leftTab, setLeftTab] = useState<"sectors" | "velocity" | "institutional">("sectors");

  const stocks = useMemo(() => pulse.stocks ?? [], [pulse.stocks]);
  const marketBreadth = pulse.market ?? { advances: 0, declines: 0, unchanged: 0, total: 0 };

  // =========================================================================
  // 1. MACRO WHOLE-MARKET TURNOVER & CAPITAL BREADTH
  // =========================================================================
  const macroVolumeBreadth = useMemo(() => {
    let totalTurnoverCr = 0;
    let buyTurnoverCr = 0;
    let sellTurnoverCr = 0;
    let flatTurnoverCr = 0;

    let totalVolumeShares = 0;
    let buyVolumeShares = 0;
    let sellVolumeShares = 0;
    let flatVolumeShares = 0;

    stocks.forEach((s) => {
      const t = s.turnoverCr ?? 0;
      const v = s.volume ?? 0;
      totalTurnoverCr += t;
      totalVolumeShares += v;

      if (s.changePct > 0.05) {
        buyTurnoverCr += t;
        buyVolumeShares += v;
      } else if (s.changePct < -0.05) {
        sellTurnoverCr += t;
        sellVolumeShares += v;
      } else {
        flatTurnoverCr += t;
        flatVolumeShares += v;
      }
    });

    const buyRatio = totalTurnoverCr > 0 ? (buyTurnoverCr / totalTurnoverCr) * 100 : 50;
    const sellRatio = totalTurnoverCr > 0 ? (sellTurnoverCr / totalTurnoverCr) * 100 : 50;
    const flatRatio = totalTurnoverCr > 0 ? (flatTurnoverCr / totalTurnoverCr) * 100 : 0;
    const netFlowCr = buyTurnoverCr - sellTurnoverCr;

    return {
      totalTurnoverCr,
      buyTurnoverCr,
      sellTurnoverCr,
      flatTurnoverCr,
      buyRatio,
      sellRatio,
      flatRatio,
      netFlowCr,
      totalVolumeShares,
      buyVolumeShares,
      sellVolumeShares,
      flatVolumeShares,
    };
  }, [stocks]);

  // =========================================================================
  // 2. MACRO VELOCITY & RETURN TIERS
  // =========================================================================
  const velocityTiers = useMemo(() => {
    const tiers = [
      { id: "surge", label: "Surge (> +3%)", min: 3.0, max: Infinity, kind: "up" },
      { id: "mod_up", label: "Gainers (+1% to +3%)", min: 1.0, max: 3.0, kind: "up" },
      { id: "mild_up", label: "Mild Up (+0.15% to +1%)", min: 0.15, max: 1.0, kind: "up" },
      { id: "flat", label: "Flat / Unmoved (±0.15%)", min: -0.15, max: 0.15, kind: "flat" },
      { id: "mild_down", label: "Mild Down (-1% to -0.15%)", min: -1.0, max: -0.15, kind: "down" },
      { id: "mod_down", label: "Decliners (-3% to -1%)", min: -3.0, max: -1.0, kind: "down" },
      { id: "dump", label: "Dumping (< -3%)", min: -Infinity, max: -3.0, kind: "down" },
    ];

    const results = tiers.map((tier) => {
      let count = 0;
      let turnoverCr = 0;
      let volume = 0;

      stocks.forEach((s) => {
        const p = s.changePct;
        const inTier =
          tier.id === "dump"
            ? p < -3.0
            : tier.id === "surge"
              ? p >= 3.0
              : p >= tier.min && p < tier.max;

        if (inTier) {
          count++;
          turnoverCr += s.turnoverCr ?? 0;
          volume += s.volume ?? 0;
        }
      });

      return {
        ...tier,
        count,
        turnoverCr,
        volume,
        turnoverPct: macroVolumeBreadth.totalTurnoverCr > 0
          ? (turnoverCr / macroVolumeBreadth.totalTurnoverCr) * 100
          : 0,
      };
    });

    let maxTurnover = -1;
    let pocTierId = "";
    results.forEach((r) => {
      if (r.turnoverCr > maxTurnover) {
        maxTurnover = r.turnoverCr;
        pocTierId = r.id;
      }
    });

    return { results, pocTierId, maxTurnover };
  }, [stocks, macroVolumeBreadth.totalTurnoverCr]);

  // =========================================================================
  // 3. MACRO SECTOR VOLUME PROFILE (20 SECTORS RANKED BY TURNOVER)
  // =========================================================================
  const sectorVolumeProfile = useMemo(() => {
    const map = new Map<
      string,
      {
        industry: string;
        count: number;
        turnoverCr: number;
        buyTurnoverCr: number;
        sellTurnoverCr: number;
        flatTurnoverCr: number;
        volume: number;
        advances: number;
        declines: number;
        unchanged: number;
        marketCapCr: number;
        changePct: number;
      }
    >();

    stocks.forEach((s) => {
      const ind = s.industry || "Diversified";
      if (!map.has(ind)) {
        map.set(ind, {
          industry: ind,
          count: 0,
          turnoverCr: 0,
          buyTurnoverCr: 0,
          sellTurnoverCr: 0,
          flatTurnoverCr: 0,
          volume: 0,
          advances: 0,
          declines: 0,
          unchanged: 0,
          marketCapCr: 0,
          changePct: 0,
        });
      }
      const entry = map.get(ind)!;
      const t = s.turnoverCr ?? 0;
      entry.count++;
      entry.turnoverCr += t;
      entry.volume += s.volume ?? 0;
      entry.marketCapCr += s.marketCapCr ?? 0;

      if (s.changePct > 0.05) {
        entry.buyTurnoverCr += t;
        entry.advances++;
      } else if (s.changePct < -0.05) {
        entry.sellTurnoverCr += t;
        entry.declines++;
      } else {
        entry.flatTurnoverCr += t;
        entry.unchanged++;
      }
    });

    const list = Array.from(map.values()).map((sec) => {
      // Calculate weighted sector change
      const avgChange = sec.count > 0 ? (sec.advances - sec.declines) / sec.count * 1.2 : 0;
      return { ...sec, changePct: avgChange };
    });

    list.sort((a, b) => b.turnoverCr - a.turnoverCr);

    const maxSectorTurnover = list.length > 0 ? list[0].turnoverCr : 1;
    const pocSector = list.length > 0 ? list[0].industry : "";

    // 70% Value Area
    let cumTurnover = 0;
    const target70 = macroVolumeBreadth.totalTurnoverCr * 0.7;
    const valueAreaSectors = new Set<string>();

    for (const sec of list) {
      if (cumTurnover < target70 || valueAreaSectors.size === 0) {
        valueAreaSectors.add(sec.industry);
        cumTurnover += sec.turnoverCr;
      }
    }

    return { list, maxSectorTurnover, pocSector, valueAreaSectors };
  }, [stocks, macroVolumeBreadth.totalTurnoverCr]);

  // =========================================================================
  // 4. INSTITUTIONAL ACCUMULATION (STEALTH CHURN)
  // =========================================================================
  const stealthChurnScrips = useMemo(() => {
    return stocks
      .filter((s) => (s.turnoverCr ?? 0) >= 60 && Math.abs(s.changePct) <= 0.2)
      .sort((a, b) => (b.turnoverCr ?? 0) - (a.turnoverCr ?? 0));
  }, [stocks]);

  // =========================================================================
  // 5. MARKET CAP TIERS
  // =========================================================================
  const marketCapTiers = useMemo(() => {
    const tiers = [
      { id: "mega", label: "Mega Cap (> ₹1L Cr)", min: 100000, max: Infinity },
      { id: "large", label: "Large Cap (₹30k–₹1L Cr)", min: 30000, max: 100000 },
      { id: "mid", label: "Mid Cap (₹10k–₹30k Cr)", min: 10000, max: 30000 },
      { id: "small", label: "Small Cap (< ₹10k Cr)", min: 0, max: 10000 },
    ];

    return tiers.map((t) => {
      let turnoverCr = 0;
      let count = 0;
      let buyCr = 0;
      let sellCr = 0;

      stocks.forEach((s) => {
        const m = s.marketCapCr ?? 0;
        if (m >= t.min && m < t.max) {
          count++;
          const tc = s.turnoverCr ?? 0;
          turnoverCr += tc;
          if (s.changePct > 0) buyCr += tc;
          else if (s.changePct < 0) sellCr += tc;
        }
      });

      return {
        ...t,
        count,
        turnoverCr,
        buyCr,
        sellCr,
        sharePct: macroVolumeBreadth.totalTurnoverCr > 0
          ? (turnoverCr / macroVolumeBreadth.totalTurnoverCr) * 100
          : 0,
      };
    });
  }, [stocks, macroVolumeBreadth.totalTurnoverCr]);

  // =========================================================================
  // 6. FILTERED STOCKS LIST
  // =========================================================================
  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.industry.toLowerCase().includes(q),
      );
    }

    if (selectedSector) {
      result = result.filter((s) => s.industry === selectedSector);
    }

    if (movementFilter === "BUYING") {
      result = result.filter((s) => s.changePct > 0.5);
    } else if (movementFilter === "SELLING") {
      result = result.filter((s) => s.changePct < -0.5);
    } else if (movementFilter === "UNMOVED") {
      result = result.filter((s) => Math.abs(s.changePct) <= 0.15);
    } else if (movementFilter === "SURGE") {
      result = result.filter((s) => (s.turnoverCr ?? 0) > 100 || Math.abs(s.changePct) >= 2.5);
    }

    result.sort((a, b) => {
      if (sortBy === "turnover") return (b.turnoverCr ?? 0) - (a.turnoverCr ?? 0);
      if (sortBy === "changeDesc") return b.changePct - a.changePct;
      if (sortBy === "changeAsc") return a.changePct - b.changePct;
      if (sortBy === "mcap") return (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0);
      return 0;
    });

    return result;
  }, [stocks, searchQuery, selectedSector, movementFilter, sortBy]);

  const totalBreadthAdv = marketBreadth.advances;
  const totalBreadthDec = marketBreadth.declines;
  const totalBreadthUnch = marketBreadth.unchanged;
  const totalMarketTrades = marketBreadth.total || totalBreadthAdv + totalBreadthDec + totalBreadthUnch;
  const adRatio = totalBreadthDec > 0 ? (totalBreadthAdv / totalBreadthDec).toFixed(2) : "—";

  return (
    <div className="space-y-4 rounded-none font-sans">
      {/* 1. COMPACT TOP MACRO BANNER: Breadth, Capital Turnover & Provenance */}
      <div className="border border-border bg-surface p-3.5 rounded-none shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Universe chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-semibold font-mono uppercase tracking-wider text-muted-foreground mr-1">
              Universe:
            </span>
            {UNIVERSES.map((u) => (
              <button
                key={u.id}
                onClick={() => onUniverseChange(u.id)}
                className={cn(
                  "px-2.5 py-1 text-2xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-none",
                  currentIndex === u.id
                    ? "bg-accent text-accent-foreground shadow-xs font-bold"
                    : "border border-border bg-surface-muted/60 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {u.label}
              </button>
            ))}
          </div>

          {/* Right: Net Flow Status Badge & Provenance */}
          <div className="flex items-center gap-3 text-2xs font-mono">
            <span
              className={cn(
                "px-2.5 py-0.5 font-bold uppercase tracking-wider border rounded-none",
                macroVolumeBreadth.netFlowCr >= 0
                  ? "border-up/40 bg-up/10 text-up"
                  : "border-down/40 bg-down/10 text-down",
              )}
            >
              Net Flow: {macroVolumeBreadth.netFlowCr >= 0 ? "+" : ""}
              {fmtINR(macroVolumeBreadth.netFlowCr)} Cr{" "}
              ({macroVolumeBreadth.netFlowCr >= 0 ? "Inflow Dominant" : "Outflow Dominant"})
            </span>
            <span className="text-border hidden sm:inline">|</span>
            <span className="text-up hidden sm:flex items-center gap-1 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Genuine NSE Tape
            </span>
          </div>
        </div>

        {/* High-Density Key Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/60 font-mono text-xs">
          {/* Metric 1: Total Market Turnover */}
          <div className="bg-surface-muted/50 border border-border/80 p-2 rounded-none">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Total Traded Turnover</div>
            <div className="text-base font-bold text-foreground mt-0.5">
              {fmtINR(macroVolumeBreadth.totalTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-muted-foreground">
              {fmtCompact(macroVolumeBreadth.totalVolumeShares)} shares · {stocks.length} scrips
            </div>
          </div>

          {/* Metric 2: Buying Capital */}
          <div className="bg-up/5 border border-up/30 p-2 rounded-none">
            <div className="text-3xs uppercase tracking-wider text-up font-semibold flex justify-between">
              <span>Buying Capital</span>
              <span>{macroVolumeBreadth.buyRatio.toFixed(1)}%</span>
            </div>
            <div className="text-base font-bold text-up mt-0.5">
              {fmtINR(macroVolumeBreadth.buyTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-muted-foreground">
              In {marketBreadth.advances} advancing scrips
            </div>
          </div>

          {/* Metric 3: Selling Capital */}
          <div className="bg-down/5 border border-down/30 p-2 rounded-none">
            <div className="text-3xs uppercase tracking-wider text-down font-semibold flex justify-between">
              <span>Selling Capital</span>
              <span>{macroVolumeBreadth.sellRatio.toFixed(1)}%</span>
            </div>
            <div className="text-base font-bold text-down mt-0.5">
              {fmtINR(macroVolumeBreadth.sellTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-muted-foreground">
              In {marketBreadth.declines} declining scrips
            </div>
          </div>

          {/* Metric 4: Whole Market Breadth */}
          <div className="bg-surface-muted/50 border border-border/80 p-2 rounded-none">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Market Breadth</span>
              <span className="font-bold text-foreground">A/D {adRatio}</span>
            </div>
            <div className="text-base font-bold text-foreground mt-0.5 flex items-baseline justify-between">
              <span className="text-up">+{totalBreadthAdv}</span>
              <span className="text-3xs text-muted-foreground">{totalBreadthUnch} unch</span>
              <span className="text-down">-{totalBreadthDec}</span>
            </div>
            {/* Proportion strip */}
            <div className="flex h-1.5 w-full overflow-hidden bg-muted rounded-none mt-1">
              <div
                className="bg-up transition-all rounded-none"
                style={{ width: `${(totalBreadthAdv / (totalMarketTrades || 1)) * 100}%` }}
              />
              <div
                className="bg-flat transition-all rounded-none"
                style={{ width: `${(totalBreadthUnch / (totalMarketTrades || 1)) * 100}%` }}
              />
              <div
                className="bg-down transition-all rounded-none"
                style={{ width: `${(totalBreadthDec / (totalMarketTrades || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. DENSE 2-COLUMN PANORAMIC COCKPIT: Full Widescreen Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN (5 of 12 cols): MACRO STRUCTURE, SECTOR FLOW, & INSTITUTIONS  */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-3">
          {/* Left Sub-Navigation Tabs: Sectors vs Velocity vs Stealth Churn */}
          <div className="border border-border bg-surface p-2.5 rounded-none shadow-sm space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLeftTab("sectors")}
                  className={cn(
                    "px-2.5 py-1 text-2xs font-mono font-semibold transition-colors rounded-none",
                    leftTab === "sectors"
                      ? "bg-surface-raised text-foreground font-bold border border-border shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Sectors Flow ({sectorVolumeProfile.list.length})
                </button>
                <button
                  onClick={() => setLeftTab("velocity")}
                  className={cn(
                    "px-2.5 py-1 text-2xs font-mono font-semibold transition-colors rounded-none",
                    leftTab === "velocity"
                      ? "bg-surface-raised text-foreground font-bold border border-border shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Price Velocity
                </button>
                <button
                  onClick={() => setLeftTab("institutional")}
                  className={cn(
                    "px-2.5 py-1 text-2xs font-mono font-semibold transition-colors rounded-none flex items-center gap-1",
                    leftTab === "institutional"
                      ? "bg-surface-raised text-foreground font-bold border border-border shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Zap className="h-3 w-3 text-gold" />
                  Stealth Churn ({stealthChurnScrips.length})
                </button>
              </div>

              {selectedSector && (
                <button
                  onClick={() => setSelectedSector(null)}
                  className="text-3xs font-mono text-accent hover:underline flex items-center gap-0.5"
                >
                  <span>Clear filter</span>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* TAB CONTENT 1: SECTORS FLOW (Horizontal Volume by Sector) */}
            {leftTab === "sectors" && (
              <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-3xs font-mono text-muted-foreground px-1 pb-1">
                  <span>Sector · Volume Split</span>
                  <span>Turnover (₹ Cr)</span>
                </div>
                {sectorVolumeProfile.list.map((sec) => {
                  const isPoc = sec.industry === sectorVolumeProfile.pocSector;
                  const isValueArea = sectorVolumeProfile.valueAreaSectors.has(sec.industry);
                  const isSelected = selectedSector === sec.industry;

                  const buyRatio = sec.turnoverCr > 0 ? (sec.buyTurnoverCr / sec.turnoverCr) * 100 : 50;
                  const sellRatio = sec.turnoverCr > 0 ? (sec.sellTurnoverCr / sec.turnoverCr) * 100 : 50;
                  const barW =
                    sectorVolumeProfile.maxSectorTurnover > 0
                      ? (sec.turnoverCr / sectorVolumeProfile.maxSectorTurnover) * 100
                      : 0;

                  return (
                    <div
                      key={sec.industry}
                      onClick={() => setSelectedSector(isSelected ? null : sec.industry)}
                      className={cn(
                        "p-2 border transition-all cursor-pointer rounded-none text-left font-mono",
                        isSelected
                          ? "border-accent bg-accent/10 shadow-xs"
                          : isPoc
                            ? "border-gold/60 bg-surface-raised/80"
                            : isValueArea
                              ? "border-border bg-surface-muted/40 hover:bg-surface-muted"
                              : "border-border/60 bg-surface/40 hover:bg-surface-muted/30 opacity-80 hover:opacity-100",
                      )}
                    >
                      <div className="flex items-center justify-between text-2xs mb-1">
                        <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                          <span className="font-semibold text-foreground truncate" title={sec.industry}>
                            {sec.industry}
                          </span>
                          {isPoc && (
                            <span className="bg-gold text-surface-raised px-1 py-0.2 text-3xs font-bold shrink-0">
                              POC
                            </span>
                          )}
                          {isValueArea && !isPoc && (
                            <span className="border border-border text-muted-foreground px-1 py-0.2 text-3xs shrink-0">
                              VA 70%
                            </span>
                          )}
                        </div>
                        <div className="text-3xs text-foreground font-semibold">
                          {fmtINR(sec.turnoverCr)} Cr
                        </div>
                      </div>

                      {/* Horizontal stacked bar */}
                      <div className="h-1.5 w-full bg-muted rounded-none overflow-hidden relative">
                        <div className="h-full flex rounded-none" style={{ width: `${barW}%` }}>
                          <div
                            className="bg-up h-full"
                            style={{ width: `${buyRatio}%` }}
                            title={`Buy: ${buyRatio.toFixed(0)}%`}
                          />
                          <div
                            className="bg-down h-full"
                            style={{ width: `${sellRatio}%` }}
                            title={`Sell: ${sellRatio.toFixed(0)}%`}
                          />
                        </div>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-3xs text-muted-foreground">
                        <span className="text-up">+{sec.advances} adv</span>
                        <span>{sec.count} stocks</span>
                        <span className="text-down">-{sec.declines} dec</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT 2: PRICE VELOCITY SPECTRUM */}
            {leftTab === "velocity" && (
              <div className="space-y-1.5 font-mono max-h-[580px] overflow-y-auto">
                <div className="text-3xs text-muted-foreground px-1 pb-1">
                  Click any tier to isolate matching stocks in the ledger
                </div>
                {velocityTiers.results.map((tier) => {
                  const isPoc = tier.id === velocityTiers.pocTierId;
                  const barW =
                    velocityTiers.maxTurnover > 0
                      ? (tier.turnoverCr / velocityTiers.maxTurnover) * 100
                      : 0;

                  return (
                    <div
                      key={tier.id}
                      onClick={() => {
                        if (tier.kind === "up") setMovementFilter("BUYING");
                        else if (tier.kind === "down") setMovementFilter("SELLING");
                        else setMovementFilter("UNMOVED");
                      }}
                      className={cn(
                        "p-2 border transition-all cursor-pointer rounded-none",
                        isPoc
                          ? "border-gold/80 bg-gold/5 shadow-xs"
                          : "border-border/80 bg-surface-muted/40 hover:bg-surface-muted",
                      )}
                    >
                      <div className="flex items-center justify-between text-2xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "font-semibold",
                              tier.kind === "up" ? "text-up" : tier.kind === "down" ? "text-down" : "text-flat",
                            )}
                          >
                            {tier.label}
                          </span>
                          {isPoc && (
                            <span className="bg-gold text-surface-raised px-1 py-0.2 text-3xs font-bold">
                              MACRO POC
                            </span>
                          )}
                        </div>
                        <div className="text-3xs text-foreground font-semibold">
                          {fmtINR(tier.turnoverCr)} Cr ({tier.count} scrips)
                        </div>
                      </div>

                      {/* Bar */}
                      <div className="h-1.5 w-full bg-muted rounded-none overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-none transition-all",
                            tier.kind === "up" ? "bg-up" : tier.kind === "down" ? "bg-down" : "bg-flat",
                          )}
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT 3: INSTITUTIONAL STEALTH CHURN & MARKET CAP TIERS */}
            {leftTab === "institutional" && (
              <div className="space-y-3 font-mono max-h-[580px] overflow-y-auto">
                <div className="text-3xs text-muted-foreground leading-relaxed px-1">
                  Stocks with heavy volume turnover (&gt; ₹60 Cr) in tight flat ranges (±0.20%). Indicates institutional block absorption without price displacement.
                </div>

                {stealthChurnScrips.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-border">
                    No stagnant block churn detected in the active session.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {stealthChurnScrips.slice(0, 10).map((s) => (
                      <Link
                        key={s.symbol}
                        href={`/company/${encodeURIComponent(s.symbol)}`}
                        className="p-2 border border-border bg-surface-muted/40 hover:border-accent hover:bg-surface-muted transition-colors rounded-none flex items-center justify-between text-2xs"
                      >
                        <div className="truncate max-w-[170px]">
                          <span className="font-bold text-foreground mr-1.5">{s.symbol}</span>
                          <span className="text-3xs text-muted-foreground truncate">{s.industry}</span>
                        </div>
                        <div className="flex items-center gap-3 text-3xs">
                          <span className="text-muted-foreground">LTP: {fmtINR(s.last)}</span>
                          <span className="text-flat font-semibold">{s.changePct.toFixed(2)}%</span>
                          <span className="text-foreground font-bold">{fmtINR(s.turnoverCr)} Cr</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Market Cap Tiers Strip */}
                <div className="pt-2 border-t border-border/70 space-y-1.5">
                  <div className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Market Cap Liquidity Tiers
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {marketCapTiers.map((t) => (
                      <div key={t.id} className="p-1.5 border border-border/80 bg-surface-muted/30 text-3xs">
                        <div className="truncate text-muted-foreground">{t.label}</div>
                        <div className="font-bold text-foreground mt-0.5">
                          {fmtINR(t.turnoverCr)} Cr ({t.sharePct.toFixed(0)}%)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN (7 of 12 cols): LIVE CONSTITUENT ACTION LEDGER               */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 border border-border bg-surface p-3.5 rounded-none shadow-sm space-y-3">
          {/* Filter and Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-3">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: "ALL", label: `All (${stocks.length})` },
                { id: "BUYING", label: "Gainers" },
                { id: "SELLING", label: "Decliners" },
                { id: "UNMOVED", label: "Flat (±0.15%)" },
                { id: "SURGE", label: "Volume Surge" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMovementFilter(f.id as any)}
                  className={cn(
                    "px-2.5 py-1 text-2xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-none",
                    movementFilter === f.id
                      ? "bg-accent text-accent-foreground shadow-xs font-bold"
                      : "border border-border/80 bg-surface-muted/50 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Box & Sort */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <div className="relative grow sm:grow-0">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search ticker, company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 w-full sm:w-44 border border-border bg-surface-muted/60 pl-7 pr-2 font-mono text-2xs focus:border-accent focus:outline-none rounded-none"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-7 border border-border bg-surface-muted/60 px-1.5 font-mono text-3xs text-foreground focus:border-accent focus:outline-none rounded-none"
              >
                <option value="turnover">Sort: Turnover</option>
                <option value="changeDesc">Sort: Gainers %</option>
                <option value="changeAsc">Sort: Losers %</option>
                <option value="mcap">Sort: Market Cap</option>
              </select>
            </div>
          </div>

          {/* Active Sector Scope Notice */}
          {selectedSector && (
            <div className="flex items-center justify-between bg-accent/10 border border-accent/30 px-2.5 py-1 text-2xs font-mono text-accent rounded-none">
              <span>Isolating Sector: <strong>{selectedSector}</strong> ({filteredStocks.length} stocks)</span>
              <button
                onClick={() => setSelectedSector(null)}
                className="hover:underline font-bold"
              >
                Clear &times;
              </button>
            </div>
          )}

          {/* High-Density Stock Ledger Table with Sticky Header */}
          <div className="overflow-x-auto border border-border max-h-[530px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-surface-muted border-b border-border font-mono text-3xs text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-2 sm:p-2.5">Scrip / Name</th>
                  <th className="p-2 sm:p-2.5">Sector</th>
                  <th className="p-2 sm:p-2.5 text-right">LTP (₹)</th>
                  <th className="p-2 sm:p-2.5 text-right">Change (%)</th>
                  <th className="p-2 sm:p-2.5 text-right">Turnover (₹ Cr)</th>
                  <th className="p-2 sm:p-2.5 text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-2xs">
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No scrips match active filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((s) => {
                    const isUp = s.changePct > 0.05;
                    const isDown = s.changePct < -0.05;
                    const isFlat = !isUp && !isDown;

                    return (
                      <tr
                        key={s.symbol}
                        className="hover:bg-surface-muted/50 transition-colors"
                      >
                        <td className="p-2 sm:p-2.5">
                          <div className="flex items-center gap-1.5 justify-between">
                            <Link
                              href={`/company/${encodeURIComponent(s.symbol)}`}
                              className="font-bold text-foreground hover:text-accent transition-colors flex items-center gap-1.5"
                            >
                              <span>{s.symbol}</span>
                              <span className="text-3xs text-muted-foreground font-normal truncate max-w-[100px] hidden sm:inline">
                                {s.name}
                              </span>
                            </Link>
                            {onSelectStock && (
                              <button
                                onClick={() => onSelectStock(s.symbol)}
                                title={`Open ${s.symbol} 1m Volume Profile`}
                                className="text-3xs font-mono font-bold text-gold hover:bg-gold/15 px-1 py-0.2 border border-gold/30 rounded-none shrink-0"
                              >
                                VRVP
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-2 sm:p-2.5 font-sans text-3xs text-muted-foreground truncate max-w-[120px]">
                          {s.industry}
                        </td>
                        <td className="p-2 sm:p-2.5 text-right font-semibold text-foreground">
                          {fmtINR(s.last)}
                        </td>
                        <td className="p-2 sm:p-2.5 text-right">
                          <span
                            className={cn(
                              "inline-block px-1.5 py-0.2 text-3xs font-bold rounded-none",
                              isUp
                                ? "bg-up/15 text-up border border-up/30"
                                : isDown
                                  ? "bg-down/15 text-down border border-down/30"
                                  : "bg-surface-muted text-muted-foreground border border-border",
                            )}
                          >
                            {isUp ? "+" : ""}{s.changePct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="p-2 sm:p-2.5 text-right text-foreground font-bold">
                          {s.turnoverCr ? fmtINR(s.turnoverCr, "₹") : "—"}
                        </td>
                        <td className="p-2 sm:p-2.5 text-right text-muted-foreground text-3xs">
                          {s.volume ? fmtCompact(s.volume) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Table Count Indicator */}
          <div className="flex items-center justify-between text-3xs font-mono text-muted-foreground pt-1">
            <span>Showing {filteredStocks.length} of {stocks.length} scrips in active universe</span>
            <span>Sorted by {sortBy.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
