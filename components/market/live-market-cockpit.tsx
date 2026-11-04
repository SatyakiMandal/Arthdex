"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Compass,
  Filter,
  Flame,
  Gauge,
  Layers,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiPulse, ApiPulseSector, ApiPulseStock } from "@/lib/api/types";

interface LiveMarketCockpitProps {
  initialPulse: ApiPulse;
  initialIndex?: string;
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

type MarketSession = "OPEN" | "PRE_OPEN" | "CLOSED";

function getMarketSession(): { session: MarketSession; label: string; detail: string } {
  // Compute in Asia/Kolkata
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 3600000 * 5.5);

  const day = istDate.getDay();
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const totalMin = hour * 60 + minute;

  // Weekend
  if (day === 0 || day === 6) {
    return {
      session: "CLOSED",
      label: "MARKET CLOSED",
      detail: "Weekend · Showing Friday Last Traded Session Closes",
    };
  }

  // Pre-open: 09:00 - 09:08
  if (totalMin >= 540 && totalMin < 548) {
    return {
      session: "PRE_OPEN",
      label: "PRE-OPEN SESSION",
      detail: "Order collection & discovery (09:00 - 09:08 IST)",
    };
  }

  // Regular Trading Session: 09:15 - 15:30
  if (totalMin >= 555 && totalMin < 930) {
    return {
      session: "OPEN",
      label: "LIVE MARKET OPEN",
      detail: "Continuous trading session (09:15 - 15:30 IST)",
    };
  }

  // Post market or before pre-open
  return {
    session: "CLOSED",
    label: "MARKET CLOSED",
    detail: "Showing Last Session Official Closes",
  };
}

export function LiveMarketCockpit({
  initialPulse,
  initialIndex = "nifty500",
}: LiveMarketCockpitProps) {
  const [pulse, setPulse] = useState<ApiPulse>(initialPulse);
  const [currentIndex, setCurrentIndex] = useState<string>(initialIndex);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshInterval, setRefreshInterval] = useState<number>(15); // in seconds, 0 = paused
  const [countdown, setCountdown] = useState<number>(15);
  const [marketStatus, setMarketStatus] = useState(getMarketSession());

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [movementFilter, setMovementFilter] = useState<
    "ALL" | "BUYING" | "SELLING" | "UNMOVED" | "SURGE"
  >("ALL");
  const [sortBy, setSortBy] = useState<"changeDesc" | "changeAsc" | "turnover" | "mcap">("changeDesc");

  // Keep market status updated every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getMarketSession());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch updated data from API
  const refreshData = useCallback(async (idx = currentIndex) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pulse?index=${encodeURIComponent(idx)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setPulse(json.data);
          setLastUpdated(new Date());
        }
      }
    } catch {
      // Retain active state
    } finally {
      setLoading(false);
      setCountdown(refreshInterval);
    }
  }, [currentIndex, refreshInterval]);

  // Auto-refresh countdown loop
  useEffect(() => {
    if (refreshInterval === 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void refreshData();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [refreshInterval, refreshData]);

  // Handle universe switch
  function handleUniverseChange(newIdx: string) {
    setCurrentIndex(newIdx);
    startTransition(() => {
      void refreshData(newIdx);
    });
  }

  const stocks = useMemo(() => pulse.stocks ?? [], [pulse.stocks]);
  const sectors = useMemo(() => pulse.sectors ?? [], [pulse.sectors]);
  const marketBreadth = pulse.market ?? { advances: 0, declines: 0, unchanged: 0, total: 0 };

  // Spectrum Distribution Calculations
  const distribution = useMemo(() => {
    let strongGain = 0; // >= 3%
    let modGain = 0; // 1% to 3%
    let mildGain = 0; // 0.15% to 1%
    let flat = 0; // -0.15% to +0.15% (What is not moving)
    let mildLoss = 0; // -1% to -0.15%
    let modLoss = 0; // -3% to -1%
    let strongLoss = 0; // <= -3%

    stocks.forEach((s) => {
      const p = s.changePct;
      if (p >= 3.0) strongGain++;
      else if (p >= 1.0) modGain++;
      else if (p > 0.15) mildGain++;
      else if (p >= -0.15 && p <= 0.15) flat++;
      else if (p > -1.0) mildLoss++;
      else if (p > -3.0) modLoss++;
      else strongLoss++;
    });

    return { strongGain, modGain, mildGain, flat, mildLoss, modLoss, strongLoss };
  }, [stocks]);

  // Filtered stocks list
  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.industry.toLowerCase().includes(q),
      );
    }

    // Sector filter
    if (selectedSector) {
      result = result.filter((s) => s.industry === selectedSector);
    }

    // Movement Filter
    if (movementFilter === "BUYING") {
      result = result.filter((s) => s.changePct > 0.5);
    } else if (movementFilter === "SELLING") {
      result = result.filter((s) => s.changePct < -0.5);
    } else if (movementFilter === "UNMOVED") {
      // What is not moving (flat)
      result = result.filter((s) => Math.abs(s.changePct) <= 0.15);
    } else if (movementFilter === "SURGE") {
      result = result.filter((s) => (s.turnoverCr ?? 0) > 100 || Math.abs(s.changePct) >= 2.5);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "changeDesc") return b.changePct - a.changePct;
      if (sortBy === "changeAsc") return a.changePct - b.changePct;
      if (sortBy === "turnover") return (b.turnoverCr ?? 0) - (a.turnoverCr ?? 0);
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
    <div className="space-y-6">
      {/* 1. Cockpit Header Control Panel */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          {/* Market Status Pill */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border",
                marketStatus.session === "OPEN"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : marketStatus.session === "PRE_OPEN"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                    : "border-border/80 bg-muted/60 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  marketStatus.session === "OPEN"
                    ? "bg-emerald-400 animate-pulse"
                    : marketStatus.session === "PRE_OPEN"
                      ? "bg-amber-400 animate-ping"
                      : "bg-muted-foreground",
                )}
              />
              {marketStatus.label}
            </div>

            <span className="text-xs text-muted-foreground hidden sm:inline">
              {marketStatus.detail}
            </span>
          </div>

          {/* Right Controls: Auto-Refresh & Universe */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Auto-Refresh Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background p-1 text-xs">
              <span className="px-2 text-2xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Radio className="h-3 w-3 text-primary animate-pulse" /> Refresh:
              </span>
              {[
                { sec: 10, label: "10s" },
                { sec: 15, label: "15s" },
                { sec: 30, label: "30s" },
                { sec: 0, label: "Pause" },
              ].map((opt) => (
                <button
                  key={opt.sec}
                  onClick={() => {
                    setRefreshInterval(opt.sec);
                    setCountdown(opt.sec);
                  }}
                  className={cn(
                    "rounded px-2 py-0.5 text-2xs font-medium transition-colors",
                    refreshInterval === opt.sec
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Manual Trigger */}
            <button
              onClick={() => void refreshData()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-primary", loading && "animate-spin")} />
              <span>{loading ? "Fetching..." : `Sync (${countdown}s)`}</span>
            </button>
          </div>
        </div>

        {/* Universe Selector & Meta Provenance Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              Index Universe:
            </span>
            {UNIVERSES.map((u) => (
              <button
                key={u.id}
                onClick={() => handleUniverseChange(u.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wider transition-colors",
                  currentIndex === u.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {u.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-2xs font-mono">
            <span>Exchange Session: <strong className="text-foreground">{pulse.asOf}</strong></span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> 100% Genuine Live NSE Data
            </span>
          </div>
        </div>
      </div>

      {/* 2. God's-Eye Market Breadth Bar & A/D Spectrum */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Whole Market Advances / Declines */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Whole-Market Breadth</span>
            <span className="font-mono text-foreground font-bold">A/D: {adRatio}</span>
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-lg font-bold text-emerald-400">+{totalBreadthAdv}</span>
            <span className="text-xs text-muted-foreground">{totalBreadthUnch} unch</span>
            <span className="text-lg font-bold text-rose-400">-{totalBreadthDec}</span>
          </div>
          {/* Proportion Bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${(totalBreadthAdv / (totalMarketTrades || 1)) * 100}%` }}
            />
            <div
              className="bg-muted-foreground/30 transition-all duration-500"
              style={{ width: `${(totalBreadthUnch / (totalMarketTrades || 1)) * 100}%` }}
            />
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{ width: `${(totalBreadthDec / (totalMarketTrades || 1)) * 100}%` }}
            />
          </div>
          <div className="text-3xs text-muted-foreground font-mono">
            Across {totalMarketTrades.toLocaleString("en-IN")} total NSE traded stocks
          </div>
        </div>

        {/* Current Index Universe Advances */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>{pulse.label} Breadth</span>
            <span className="font-mono text-foreground font-bold">
              {((pulse.advances / (pulse.stocks.length || 1)) * 100).toFixed(0)}% Adv
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-lg font-bold text-emerald-400">+{pulse.advances} Adv</span>
            <span className="text-xs text-muted-foreground">{pulse.unchanged} flat</span>
            <span className="text-lg font-bold text-rose-400">-{pulse.declines} Dec</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${(pulse.advances / (pulse.stocks.length || 1)) * 100}%` }}
            />
            <div
              className="bg-muted-foreground/30 transition-all duration-500"
              style={{ width: `${(pulse.unchanged / (pulse.stocks.length || 1)) * 100}%` }}
            />
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{ width: `${(pulse.declines / (pulse.stocks.length || 1)) * 100}%` }}
            />
          </div>
          <div className="text-3xs text-muted-foreground font-mono">
            Constituents: {pulse.stocks.length} tracked
          </div>
        </div>

        {/* "What is Not Moving" Stagnation Counter */}
        <div
          onClick={() => setMovementFilter(movementFilter === "UNMOVED" ? "ALL" : "UNMOVED")}
          className={cn(
            "rounded-xl border p-4 space-y-2 cursor-pointer transition-all",
            movementFilter === "UNMOVED"
              ? "border-primary bg-primary/10 shadow-xs"
              : "border-border bg-card hover:border-primary/40",
          )}
        >
          <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-cyan-400" /> What is Not Moving
            </span>
            <span className="text-2xs font-mono text-cyan-400 font-bold">&plusmn;0.15%</span>
          </div>
          <div className="font-mono text-lg font-bold text-cyan-400">
            {distribution.flat} Scrips
          </div>
          <div className="text-3xs text-muted-foreground leading-tight">
            Consolidating in tight flat ranges. Click to isolate stagnant counter setups.
          </div>
        </div>

        {/* Buying vs Selling Intensity Ratio */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-500" /> Velocity Breakdown
            </span>
            <span className="text-2xs font-mono text-amber-400 font-bold">
              {distribution.strongGain} vs {distribution.strongLoss}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-semibold">&ge; +1%: {distribution.strongGain + distribution.modGain}</span>
            <span className="text-border">|</span>
            <span className="text-rose-400 font-semibold">&le; -1%: {distribution.modLoss + distribution.strongLoss}</span>
          </div>
          <div className="text-3xs text-muted-foreground leading-tight">
            Scrips surging over 1% vs slipping over 1%.
          </div>
        </div>
      </div>

      {/* 3. Seven-Bucket Price Velocity Distribution Spectrum */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-xs border-b border-border/60 pb-2">
          <span className="font-semibold text-foreground uppercase tracking-wider text-2xs flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-primary" /> Intraday Price Distribution Spectrum ({stocks.length} scrips)
          </span>
          <span className="text-3xs text-muted-foreground">Click any bucket to filter the ledger</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center font-mono">
          {/* >= +3% */}
          <button
            onClick={() => {
              setMovementFilter("BUYING");
              setSortBy("changeDesc");
            }}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 hover:bg-emerald-500/20 transition-all"
          >
            <div className="text-2xs font-bold text-emerald-400">&ge; +3%</div>
            <div className="text-base font-bold text-emerald-300 mt-1">{distribution.strongGain}</div>
            <div className="text-3xs text-emerald-400/80 mt-0.5">Surge</div>
          </button>

          {/* +1% to +3% */}
          <button
            onClick={() => {
              setMovementFilter("BUYING");
              setSortBy("changeDesc");
            }}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 hover:bg-emerald-500/15 transition-all"
          >
            <div className="text-2xs font-bold text-emerald-400/90">+1% to +3%</div>
            <div className="text-base font-bold text-emerald-400 mt-1">{distribution.modGain}</div>
            <div className="text-3xs text-muted-foreground mt-0.5">Gainers</div>
          </button>

          {/* +0.15% to +1% */}
          <button
            onClick={() => {
              setMovementFilter("BUYING");
              setSortBy("changeDesc");
            }}
            className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-2 hover:bg-emerald-500/10 transition-all"
          >
            <div className="text-2xs font-bold text-emerald-400/70">0 to +1%</div>
            <div className="text-base font-bold text-emerald-400/80 mt-1">{distribution.mildGain}</div>
            <div className="text-3xs text-muted-foreground mt-0.5">Mild Up</div>
          </button>

          {/* Flat: -0.15% to +0.15% (What is not moving) */}
          <button
            onClick={() => setMovementFilter(movementFilter === "UNMOVED" ? "ALL" : "UNMOVED")}
            className={cn(
              "rounded-lg border p-2 transition-all",
              movementFilter === "UNMOVED"
                ? "border-cyan-400 bg-cyan-500/20 shadow-xs"
                : "border-border bg-card/60 hover:bg-muted",
            )}
          >
            <div className="text-2xs font-bold text-cyan-400">Flat (0.0%)</div>
            <div className="text-base font-bold text-foreground mt-1">{distribution.flat}</div>
            <div className="text-3xs text-cyan-400 mt-0.5 font-semibold">Not Moving</div>
          </button>

          {/* 0 to -1% */}
          <button
            onClick={() => {
              setMovementFilter("SELLING");
              setSortBy("changeAsc");
            }}
            className="rounded-lg border border-rose-500/10 bg-rose-500/5 p-2 hover:bg-rose-500/10 transition-all"
          >
            <div className="text-2xs font-bold text-rose-400/70">0 to -1%</div>
            <div className="text-base font-bold text-rose-400/80 mt-1">{distribution.mildLoss}</div>
            <div className="text-3xs text-muted-foreground mt-0.5">Mild Down</div>
          </button>

          {/* -1% to -3% */}
          <button
            onClick={() => {
              setMovementFilter("SELLING");
              setSortBy("changeAsc");
            }}
            className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 hover:bg-rose-500/15 transition-all"
          >
            <div className="text-2xs font-bold text-rose-400/90">-1% to -3%</div>
            <div className="text-base font-bold text-rose-400 mt-1">{distribution.modLoss}</div>
            <div className="text-3xs text-muted-foreground mt-0.5">Decliners</div>
          </button>

          {/* <= -3% */}
          <button
            onClick={() => {
              setMovementFilter("SELLING");
              setSortBy("changeAsc");
            }}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 hover:bg-rose-500/20 transition-all"
          >
            <div className="text-2xs font-bold text-rose-400">&le; -3%</div>
            <div className="text-base font-bold text-rose-300 mt-1">{distribution.strongLoss}</div>
            <div className="text-3xs text-rose-400/80 mt-0.5">Dumping</div>
          </button>
        </div>
      </div>

      {/* 4. What is Being Bought & What is Being Sold: Interactive Sector Flow Treemap */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" /> Sector Flow Matrix: What is Being Bought vs Sold
            </h3>
            <p className="text-3xs text-muted-foreground mt-0.5">
              20 sector classifications weighted by market capitalization and real-time capital flow. Click any sector to isolate stocks.
            </p>
          </div>

          {selectedSector && (
            <button
              onClick={() => setSelectedSector(null)}
              className="text-2xs text-primary hover:underline font-medium"
            >
              Reset Sector Filter ({selectedSector}) &times;
            </button>
          )}
        </div>

        {/* Sector Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {sectors.map((sec) => {
            const isSelected = selectedSector === sec.industry;
            const isPositive = sec.changePct >= 0;

            return (
              <button
                key={sec.industry}
                onClick={() => setSelectedSector(isSelected ? null : sec.industry)}
                className={cn(
                  "flex flex-col justify-between rounded-lg border p-2.5 text-left transition-all",
                  isSelected
                    ? "ring-2 ring-primary border-primary bg-primary/10 shadow-sm"
                    : isPositive
                      ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
                      : "border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40",
                )}
              >
                <div className="text-2xs font-medium text-foreground truncate w-full" title={sec.industry}>
                  {sec.industry}
                </div>
                <div className="mt-2 flex items-baseline justify-between w-full font-mono">
                  <span
                    className={cn(
                      "text-sm font-bold flex items-center",
                      isPositive ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {isPositive ? "+" : ""}{sec.changePct.toFixed(2)}%
                  </span>
                  <span className="text-3xs text-muted-foreground">
                    {sec.count} stocks
                  </span>
                </div>
                <div className="mt-1 text-3xs text-muted-foreground font-mono truncate">
                  ₹{(sec.marketCapCr / 1000).toFixed(1)}k Cr
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Live Filterable Stock Ledger */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              Filter Desk:
            </span>
            {[
              { id: "ALL", label: `All (${stocks.length})` },
              { id: "BUYING", label: `Being Bought (${distribution.strongGain + distribution.modGain})` },
              { id: "SELLING", label: `Being Sold (${distribution.modLoss + distribution.strongLoss})` },
              { id: "UNMOVED", label: `Not Moving (${distribution.flat})` },
              { id: "SURGE", label: "Volume / Momentum Surge" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setMovementFilter(f.id as any)}
                className={cn(
                  "rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wider transition-colors",
                  movementFilter === f.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
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
                className="h-8 w-44 sm:w-56 rounded-md border border-border bg-background pl-8 pr-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 rounded-md border border-border bg-background px-2 font-mono text-2xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="changeDesc">Sort: Top Gainers %</option>
              <option value="changeAsc">Sort: Top Losers %</option>
              <option value="turnover">Sort: Highest Turnover</option>
              <option value="mcap">Sort: Market Cap</option>
            </select>
          </div>
        </div>

        {/* Stock Rows Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-2xs text-muted-foreground uppercase tracking-wider font-semibold">
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
                  <td colSpan={8} className="p-8 text-center text-xs text-muted-foreground">
                    No scrips match the active filter criteria.
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
                            "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-2xs font-bold",
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
                      <td className="p-3 text-right text-foreground font-medium">
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-3xs text-muted-foreground">
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
