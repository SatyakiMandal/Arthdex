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
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiPulse, ApiPulseSector, ApiPulseStock } from "@/lib/api/types";

interface MacroMarketRadarProps {
  pulse: ApiPulse;
  currentIndex: string;
  onUniverseChange: (idx: string) => void;
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
}: MacroMarketRadarProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [movementFilter, setMovementFilter] = useState<
    "ALL" | "BUYING" | "SELLING" | "UNMOVED" | "SURGE"
  >("ALL");
  const [sortBy, setSortBy] = useState<"changeDesc" | "changeAsc" | "turnover" | "mcap">("turnover");

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
  // 2. MACRO VOLUME PROFILE BY RETURN / VELOCITY TIERS (VRVP ACROSS WHOLE MARKET)
  // =========================================================================
  const velocityTiers = useMemo(() => {
    const tiers = [
      { id: "surge", label: "Surge (> +3%)", min: 3.0, max: Infinity, color: "#10b981", isBuy: true },
      { id: "mod_up", label: "Gainers (+1% to +3%)", min: 1.0, max: 3.0, color: "#059669", isBuy: true },
      { id: "mild_up", label: "Mild Up (+0.15% to +1%)", min: 0.15, max: 1.0, color: "#34d399", isBuy: true },
      { id: "flat", label: "Flat / Stagnant (±0.15%)", min: -0.15, max: 0.15, color: "#22d3ee", isBuy: null },
      { id: "mild_down", label: "Mild Down (-1% to -0.15%)", min: -1.0, max: -0.15, color: "#f87171", isBuy: false },
      { id: "mod_down", label: "Decliners (-3% to -1%)", min: -3.0, max: -1.0, color: "#dc2626", isBuy: false },
      { id: "dump", label: "Dumping (< -3%)", min: -Infinity, max: -3.0, color: "#b91c1c", isBuy: false },
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

    // Identify Point of Control (POC): Tier with the maximum traded turnover
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
  // 3. MACRO SECTOR VOLUME PROFILE (VRVP BY SECTOR - 20 SECTORS)
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

    const list = Array.from(map.values());
    // Sort descending by total traded turnover (Macro Volume Rank)
    list.sort((a, b) => b.turnoverCr - a.turnoverCr);

    const maxSectorTurnover = list.length > 0 ? list[0].turnoverCr : 1;
    const pocSector = list.length > 0 ? list[0].industry : "";

    // 70% Value Area: Cumulative sum of turnover until 70% of total market turnover is reached
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
  // 4. INSTITUTIONAL ACCUMULATION / "STEALTH CHURN" DETECTOR
  // =========================================================================
  const stealthChurnScrips = useMemo(() => {
    // Scrips with turnover >= ₹80 Cr but price moving within ±0.15% (Institutional Absorptions)
    return stocks
      .filter((s) => (s.turnoverCr ?? 0) >= 80 && Math.abs(s.changePct) <= 0.15)
      .sort((a, b) => (b.turnoverCr ?? 0) - (a.turnoverCr ?? 0));
  }, [stocks]);

  // =========================================================================
  // 5. MARKET CAP TIER LIQUIDITY BREAKDOWN
  // =========================================================================
  const marketCapTiers = useMemo(() => {
    const tiers = [
      { id: "mega", label: "Mega Caps (> ₹1,00,000 Cr)", min: 100000, max: Infinity },
      { id: "large", label: "Large Caps (₹30k - ₹100k Cr)", min: 30000, max: 100000 },
      { id: "mid", label: "Mid Caps (₹10k - ₹30k Cr)", min: 10000, max: 30000 },
      { id: "small", label: "Small Caps (< ₹10,000 Cr)", min: 0, max: 10000 },
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
      if (sortBy === "changeDesc") return b.changePct - a.changePct;
      if (sortBy === "changeAsc") return a.changePct - b.changePct;
      if (sortBy === "turnover") return (b.turnoverCr ?? 0) - (a.turnoverCr ?? 0);
      if (sortBy === "mcap") return (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0);
      return 0;
    });

    return result;
  }, [stocks, searchQuery, selectedSector, movementFilter, sortBy]);

  const adRatio =
    marketBreadth.declines > 0
      ? (marketBreadth.advances / marketBreadth.declines).toFixed(2)
      : "—";

  return (
    <div className="space-y-5 rounded-none">
      {/* 1. Universe Selection Bar & Provenance */}
      <div className="border border-border bg-card p-3 rounded-none flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-semibold font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Macro Radar Universe:
          </span>
          {UNIVERSES.map((u) => (
            <button
              key={u.id}
              onClick={() => onUniverseChange(u.id)}
              className={cn(
                "px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider transition-colors rounded-none",
                currentIndex === u.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {u.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-2xs font-mono text-muted-foreground">
          <span>Tracking: <strong className="text-foreground">{stocks.length} scrips</strong></span>
          <span className="text-border">|</span>
          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" /> 100% Genuine Live Exchange Feed
          </span>
        </div>
      </div>

      {/* 2. Top Macro Traded Capital & Volume Breadth Cockpit Card */}
      <div className="border border-neutral-800 bg-[#090b0e] p-4 sm:p-5 rounded-none shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-serif font-bold text-white tracking-tight flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              <span>Whole-Market Traded Capital &amp; Volume Breadth</span>
            </h2>
            <p className="text-3xs font-mono text-neutral-400 mt-0.5">
              Macro capital flow: exactly how much real money is buying vs selling across the entire market today
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-2.5 py-1 text-2xs font-mono font-bold uppercase tracking-wider border rounded-none",
                macroVolumeBreadth.netFlowCr >= 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-400",
              )}
            >
              Net Flow: {macroVolumeBreadth.netFlowCr >= 0 ? "+" : ""}
              {fmtINR(macroVolumeBreadth.netFlowCr)} Cr{" "}
              ({macroVolumeBreadth.netFlowCr >= 0 ? "Buyers Dominating" : "Sellers Dominating"})
            </span>
          </div>
        </div>

        {/* 4 Macro Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono">
          {/* Total Market Turnover */}
          <div className="border border-neutral-800 bg-[#131722] p-3 rounded-none space-y-1">
            <div className="text-3xs uppercase tracking-wider text-neutral-400">
              Total Market Turnover
            </div>
            <div className="text-xl font-bold text-white">
              {fmtINR(macroVolumeBreadth.totalTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-neutral-500">
              {fmtCompact(macroVolumeBreadth.totalVolumeShares)} shares traded today
            </div>
          </div>

          {/* Advancing Volume (Gold) */}
          <div className="border border-amber-500/30 bg-[#131722] p-3 rounded-none space-y-1">
            <div className="text-3xs uppercase tracking-wider text-[#f5a623] font-bold flex items-center justify-between">
              <span>Buying Capital (Gold)</span>
              <span>{macroVolumeBreadth.buyRatio.toFixed(1)}%</span>
            </div>
            <div className="text-xl font-bold text-[#f5a623]">
              {fmtINR(macroVolumeBreadth.buyTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-neutral-400">
              Across {marketBreadth.advances} advancing scrips
            </div>
          </div>

          {/* Declining Volume (Blue) */}
          <div className="border border-blue-500/30 bg-[#131722] p-3 rounded-none space-y-1">
            <div className="text-3xs uppercase tracking-wider text-[#38bdf8] font-bold flex items-center justify-between">
              <span>Selling Capital (Blue)</span>
              <span>{macroVolumeBreadth.sellRatio.toFixed(1)}%</span>
            </div>
            <div className="text-xl font-bold text-[#38bdf8]">
              {fmtINR(macroVolumeBreadth.sellTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-neutral-400">
              Across {marketBreadth.declines} declining scrips
            </div>
          </div>

          {/* Consolidation / Unmoved Volume */}
          <div className="border border-cyan-500/30 bg-[#131722] p-3 rounded-none space-y-1">
            <div className="text-3xs uppercase tracking-wider text-cyan-400 font-bold flex items-center justify-between">
              <span>Stagnant / Flat Flow</span>
              <span>{macroVolumeBreadth.flatRatio.toFixed(1)}%</span>
            </div>
            <div className="text-xl font-bold text-cyan-300">
              {fmtINR(macroVolumeBreadth.flatTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-neutral-400">
              Tight range (±0.05%) institutional churn
            </div>
          </div>
        </div>

        {/* Master Macro Capital Split Bar (TradingView Gold & Blue) */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-3xs font-mono text-neutral-400">
            <span className="text-[#f5a623] font-bold">
              BUY TURNOVER: {macroVolumeBreadth.buyRatio.toFixed(1)}% ({fmtINR(macroVolumeBreadth.buyTurnoverCr)} Cr)
            </span>
            <span className="text-[#38bdf8] font-bold">
              SELL TURNOVER: {macroVolumeBreadth.sellRatio.toFixed(1)}% ({fmtINR(macroVolumeBreadth.sellTurnoverCr)} Cr)
            </span>
          </div>
          {/* Horizontal Stacked Bar: Zero Rounded Edges */}
          <div className="flex h-3 w-full overflow-hidden bg-neutral-900 rounded-none border border-neutral-800">
            <div
              className="bg-[#f5a623] transition-all duration-500 rounded-none"
              style={{ width: `${macroVolumeBreadth.buyRatio}%` }}
              title={`Buy Capital: ${macroVolumeBreadth.buyRatio.toFixed(1)}%`}
            />
            <div
              className="bg-cyan-400/60 transition-all duration-500 rounded-none"
              style={{ width: `${macroVolumeBreadth.flatRatio}%` }}
              title={`Flat Capital: ${macroVolumeBreadth.flatRatio.toFixed(1)}%`}
            />
            <div
              className="bg-[#2962ff] transition-all duration-500 rounded-none"
              style={{ width: `${macroVolumeBreadth.sellRatio}%` }}
              title={`Sell Capital: ${macroVolumeBreadth.sellRatio.toFixed(1)}%`}
            />
          </div>
        </div>
      </div>

      {/* 3. WHOLE-MARKET MACRO VOLUME PROFILE (VRVP BY RETURN TIERS) */}
      <div className="border border-neutral-800 bg-[#090b0e] p-4 sm:p-5 rounded-none shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
          <div>
            <h3 className="text-sm font-serif font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>Whole-Market Volume Profile (VRVP by Price Velocity Tier)</span>
            </h3>
            <p className="text-3xs font-mono text-neutral-400 mt-0.5">
              Aggregated capital distribution: where the highest traded volume is anchored across return tiers
            </p>
          </div>

          <div className="flex items-center gap-3 text-2xs font-mono text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-[#f5a623] inline-block rounded-none" />
              <span>Advancing Capital</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-[#2962ff] inline-block rounded-none" />
              <span>Declining Capital</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-cyan-400 inline-block rounded-none" />
              <span>Flat Range</span>
            </span>
          </div>
        </div>

        {/* Horizontal Volume Rows for each velocity tier */}
        <div className="space-y-2 font-mono">
          {velocityTiers.results.map((tier) => {
            const isPoc = tier.id === velocityTiers.pocTierId;
            const barW =
              velocityTiers.maxTurnover > 0
                ? (tier.turnoverCr / velocityTiers.maxTurnover) * 100
                : 0;

            const barColor =
              tier.isBuy === true
                ? "#f5a623"
                : tier.isBuy === false
                  ? "#2962ff"
                  : "#22d3ee";

            return (
              <div
                key={tier.id}
                onClick={() => {
                  if (tier.isBuy === true) setMovementFilter("BUYING");
                  else if (tier.isBuy === false) setMovementFilter("SELLING");
                  else setMovementFilter("UNMOVED");
                }}
                className={cn(
                  "border p-2 sm:p-2.5 transition-all cursor-pointer rounded-none",
                  isPoc
                    ? "border-amber-500 bg-[#141923] shadow-md"
                    : "border-neutral-800/80 bg-[#0e1218] hover:border-neutral-700",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-2xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{tier.label}</span>
                    {isPoc && (
                      <span className="bg-[#f5a623] text-black px-1.5 py-0.2 text-3xs font-bold rounded-none">
                        MACRO POC (Highest Capital Concentration)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-3xs">
                    <span className="text-neutral-400">{tier.count} scrips</span>
                    <span className="text-white font-bold">{fmtINR(tier.turnoverCr)} Cr</span>
                    <span className="text-neutral-400">({tier.turnoverPct.toFixed(1)}% of market)</span>
                  </div>
                </div>

                {/* Horizontal Volume Profile Bar */}
                <div className="h-3 w-full bg-neutral-900 rounded-none overflow-hidden relative border border-neutral-800/80">
                  <div
                    className="h-full transition-all duration-500 rounded-none"
                    style={{
                      width: `${barW}%`,
                      backgroundColor: barColor,
                    }}
                  />
                  {/* Subtle inner grid marker */}
                  <div className="absolute inset-0 flex justify-between pointer-events-none px-2 opacity-20">
                    <span className="border-r border-white h-full" />
                    <span className="border-r border-white h-full" />
                    <span className="border-r border-white h-full" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. WHOLE-MARKET SECTOR VOLUME PROFILE (20 SECTORS HORIZONTAL VRVP) */}
      <div className="border border-neutral-800 bg-[#090b0e] p-4 sm:p-5 rounded-none shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
          <div>
            <h3 className="text-sm font-serif font-bold text-white tracking-tight flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              <span>Macro Sector Volume Profile (Horizontal VRVP by Industry)</span>
            </h3>
            <p className="text-3xs font-mono text-neutral-400 mt-0.5">
              Ranked by institutional traded turnover. Gold indicates buying turnover; Blue indicates selling turnover.
            </p>
          </div>

          {selectedSector && (
            <button
              onClick={() => setSelectedSector(null)}
              className="text-2xs font-mono text-primary hover:underline font-bold rounded-none"
            >
              Reset Sector Filter ({selectedSector}) &times;
            </button>
          )}
        </div>

        {/* 20 Sectors Horizontal Volume Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono">
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
                  "border p-2.5 transition-all cursor-pointer rounded-none text-left",
                  isSelected
                    ? "ring-2 ring-primary border-primary bg-primary/10"
                    : isPoc
                      ? "border-amber-500/80 bg-[#141923]"
                      : isValueArea
                        ? "border-neutral-700 bg-[#0e1218] hover:border-neutral-600"
                        : "border-neutral-800/60 bg-[#0a0d12] opacity-75 hover:opacity-100",
                )}
              >
                <div className="flex items-center justify-between text-2xs mb-1">
                  <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <span className="font-bold text-white truncate" title={sec.industry}>
                      {sec.industry}
                    </span>
                    {isPoc && (
                      <span className="bg-[#f5a623] text-black px-1 py-0.1 text-3xs font-bold shrink-0">
                        POC
                      </span>
                    )}
                    {isValueArea && !isPoc && (
                      <span className="border border-sky-500/60 text-sky-400 px-1 py-0.1 text-3xs shrink-0">
                        VA 70%
                      </span>
                    )}
                  </div>
                  <div className="text-3xs text-neutral-300">
                    <strong className="text-white">{fmtINR(sec.turnoverCr)} Cr</strong>{" "}
                    <span className="text-neutral-500">({sec.count} stocks)</span>
                  </div>
                </div>

                {/* Horizontal Volume Bar with Gold/Blue Split */}
                <div className="h-2.5 w-full bg-neutral-900 rounded-none overflow-hidden relative border border-neutral-800/80">
                  <div
                    className="h-full flex rounded-none"
                    style={{ width: `${barW}%` }}
                  >
                    <div
                      className="bg-[#f5a623] h-full"
                      style={{ width: `${buyRatio}%` }}
                      title={`Buy Turnover: ${buyRatio.toFixed(0)}%`}
                    />
                    <div
                      className="bg-[#2962ff] h-full"
                      style={{ width: `${sellRatio}%` }}
                      title={`Sell Turnover: ${sellRatio.toFixed(0)}%`}
                    />
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between text-3xs text-neutral-500">
                  <span className="text-[#f5a623]">+{sec.advances} Adv</span>
                  <span>₹{(sec.marketCapCr / 1000).toFixed(1)}k Cr Mcap</span>
                  <span className="text-[#38bdf8]">-{sec.declines} Dec</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. INSTITUTIONAL ACCUMULATION & "STEALTH CHURN" RADAR */}
      {stealthChurnScrips.length > 0 && (
        <div className="border border-cyan-500/40 bg-[#081318] p-4 rounded-none shadow-md space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Institutional Accumulation &amp; Stealth Churn Radar
              </h4>
            </div>
            <span className="text-3xs text-cyan-400/80">
              High Turnover (&gt; ₹80 Cr) with Stagnant Price Movement (±0.15%)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-2xs">
            {stealthChurnScrips.slice(0, 8).map((scrip) => (
              <Link
                key={scrip.symbol}
                href={`/company/${encodeURIComponent(scrip.symbol)}`}
                className="border border-cyan-500/30 bg-[#0c1c24] p-2 hover:border-cyan-400 transition-colors rounded-none block"
              >
                <div className="flex items-center justify-between font-bold text-white">
                  <span>{scrip.symbol}</span>
                  <span className="text-cyan-400">{scrip.changePct.toFixed(2)}%</span>
                </div>
                <div className="text-3xs text-neutral-400 truncate mt-0.5">{scrip.name}</div>
                <div className="mt-1 flex items-baseline justify-between text-3xs text-neutral-300">
                  <span>LTP: {fmtINR(scrip.last)}</span>
                  <span className="text-white font-bold">{fmtINR(scrip.turnoverCr)} Cr</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 6. MARKET CAP TIER LIQUIDITY BREAKDOWN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        {marketCapTiers.map((tier) => (
          <div
            key={tier.id}
            className="border border-neutral-800 bg-[#0c0d10] p-3 rounded-none space-y-1.5"
          >
            <div className="text-3xs uppercase tracking-wider text-neutral-400 font-semibold truncate">
              {tier.label}
            </div>
            <div className="text-lg font-bold text-white flex items-baseline justify-between">
              <span>{fmtINR(tier.turnoverCr)} Cr</span>
              <span className="text-2xs text-neutral-400 font-normal">
                {tier.sharePct.toFixed(1)}% share
              </span>
            </div>
            <div className="flex h-1.5 w-full bg-neutral-900 rounded-none overflow-hidden">
              <div
                className="bg-[#f5a623]"
                style={{
                  width: `${tier.turnoverCr > 0 ? (tier.buyCr / tier.turnoverCr) * 100 : 50}%`,
                }}
              />
              <div
                className="bg-[#2962ff]"
                style={{
                  width: `${tier.turnoverCr > 0 ? (tier.sellCr / tier.turnoverCr) * 100 : 50}%`,
                }}
              />
            </div>
            <div className="text-3xs text-neutral-500 flex justify-between">
              <span>Buy: {fmtINR(tier.buyCr)} Cr</span>
              <span>Sell: {fmtINR(tier.sellCr)} Cr</span>
            </div>
          </div>
        ))}
      </div>

      {/* 7. LIVE FILTERABLE CONSTITUENT LEDGER */}
      <div className="border border-border bg-card p-4 sm:p-5 space-y-4 rounded-none">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs font-semibold uppercase font-mono tracking-wider text-muted-foreground mr-1">
              Filter Desk:
            </span>
            {[
              { id: "ALL", label: `All (${stocks.length})` },
              { id: "BUYING", label: `Being Bought` },
              { id: "SELLING", label: `Being Sold` },
              { id: "UNMOVED", label: `Not Moving (±0.15%)` },
              { id: "SURGE", label: "Turnover / Volume Surge" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setMovementFilter(f.id as any)}
                className={cn(
                  "border px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider transition-colors rounded-none",
                  movementFilter === f.id
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box & Sort */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search symbol, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-44 sm:w-56 border border-border bg-background pl-8 pr-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary rounded-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 border border-border bg-background px-2 font-mono text-2xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded-none"
            >
              <option value="turnover">Sort: Highest Turnover</option>
              <option value="changeDesc">Sort: Top Gainers %</option>
              <option value="changeAsc">Sort: Top Losers %</option>
              <option value="mcap">Sort: Market Cap</option>
            </select>
          </div>
        </div>

        {/* Stock Rows Table */}
        <div className="overflow-x-auto border border-border rounded-none">
          <table className="w-full text-left text-xs border-collapse rounded-none">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-2xs text-muted-foreground uppercase tracking-wider font-semibold font-mono">
                <th className="p-3">Scrip / Company</th>
                <th className="p-3">Sector</th>
                <th className="p-3 text-right">LTP (₹)</th>
                <th className="p-3 text-right">Change (₹)</th>
                <th className="p-3 text-right">Change (%)</th>
                <th className="p-3 text-right">Traded Volume</th>
                <th className="p-3 text-right">Turnover (₹ Cr)</th>
                <th className="p-3 text-right">Market Cap (₹ Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-muted-foreground font-mono">
                    No scrips match active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((s) => {
                  const isUp = s.changePct > 0;
                  const isFlat = Math.abs(s.changePct) <= 0.15;

                  return (
                    <tr
                      key={s.symbol}
                      className="hover:bg-muted/30 transition-colors font-mono"
                    >
                      <td className="p-3">
                        <Link
                          href={`/company/${encodeURIComponent(s.symbol)}`}
                          className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <span>{s.symbol}</span>
                          <span className="text-3xs text-muted-foreground font-normal truncate max-w-[140px]">
                            {s.name}
                          </span>
                        </Link>
                      </td>
                      <td className="p-3 font-sans text-2xs text-muted-foreground truncate max-w-[150px]">
                        {s.industry}
                      </td>
                      <td className="p-3 text-right font-bold text-foreground">
                        {fmtINR(s.last)}
                      </td>
                      <td
                        className={cn(
                          "p-3 text-right",
                          isFlat
                            ? "text-muted-foreground"
                            : isUp
                              ? "text-emerald-400"
                              : "text-rose-400",
                        )}
                      >
                        {s.change !== undefined && s.change !== null
                          ? `${s.change > 0 ? "+" : ""}${s.change.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-2xs font-bold rounded-none",
                            isFlat
                              ? "bg-muted text-muted-foreground"
                              : isUp
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/30",
                          )}
                        >
                          {isFlat ? "" : isUp ? "+" : ""}
                          {s.changePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {s.volume ? fmtCompact(s.volume) : "—"}
                      </td>
                      <td className="p-3 text-right text-foreground font-bold">
                        {s.turnoverCr ? fmtINR(s.turnoverCr, "₹") : "—"}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {s.marketCapCr ? fmtINR(s.marketCapCr, "₹") : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Provenance and Real Data Guarantee */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-3xs text-muted-foreground font-mono rounded-none">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              <strong>Authentic Live Feed:</strong> Direct official NSE stocksTraded JSON payload. Zero synthetic interpolation or simulated orders.
            </span>
          </div>
          <div>
            Showing <strong>{filteredStocks.length}</strong> of <strong>{stocks.length}</strong> {pulse.label} scrips
          </div>
        </div>
      </div>
    </div>
  );
}
