"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Check,
  ChevronRight,
  Eye,
  Flame,
  Info,
  Layers,
  LineChart,
  Maximize2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiOrderflow, OrderflowInterval } from "@/lib/api/types";

interface LiveVolumeProfileProps {
  initialSymbol?: string;
  initialInterval?: OrderflowInterval;
}

const BELLWETHERS = [
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy / Conglomerate" },
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT Services" },
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Banking & Finance" },
  { symbol: "INFY", name: "Infosys", sector: "IT Services" },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Banking & Finance" },
  { symbol: "LT", name: "Larsen & Toubro", sector: "Capital Goods & Infra" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Public Sector Banking" },
  { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Automobile" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom" },
  { symbol: "ITC", name: "ITC Ltd", sector: "FMCG / Diversified" },
];

const TIMEFRAMES: { id: OrderflowInterval; label: string; sub: string }[] = [
  { id: "5m", label: "5m", sub: "Scalp (30d)" },
  { id: "15m", label: "15m", sub: "Structure (60d)" },
  { id: "1h", label: "1h", sub: "Swing (6mo)" },
  { id: "1d", label: "1d", sub: "Macro (2y)" },
];

function fmtINR(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `₹${val.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function fmtCompact(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const a = Math.abs(val);
  if (a >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
  if (a >= 100000) return `${(val / 100000).toFixed(2)} L`;
  if (a >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toLocaleString("en-IN");
}

function fmtDateLabel(ts: string, intraday: boolean): string {
  if (!ts) return "";
  if (intraday) {
    // "2026-11-04T15:15:00+05:30" -> "04 Nov 15:15"
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts.slice(5, 16).replace("T", " ");
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return ts;
}

export function LiveVolumeProfile({
  initialSymbol = "RELIANCE",
  initialInterval = "15m",
}: LiveVolumeProfileProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [customInput, setCustomInput] = useState("");
  const [interval, setInterval] = useState<OrderflowInterval>(initialInterval);
  const [data, setData] = useState<ApiOrderflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Interactive View Toggles
  const [profileMode, setProfileMode] = useState<"tradingview" | "delta">("tradingview");
  const [showValueArea, setShowValueArea] = useState(true);
  const [showPocLine, setShowPocLine] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showSessions, setShowSessions] = useState(true);

  // Crosshair / Hover state
  const [hoverBarIdx, setHoverBarIdx] = useState<number | null>(null);
  const [hoverBinIdx, setHoverBinIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG Chart Dimensions
  const W = 1100;
  const H = 500;
  const PROFILE_WIDTH = 260; // Right volume profile zone
  const CHART_WIDTH = W - PROFILE_WIDTH - 60; // Main candlestick canvas
  const PADDING_TOP = 25;
  const PADDING_BOTTOM = 35;
  const USABLE_H = H - PADDING_TOP - PADDING_BOTTOM;

  // Load Orderflow Data
  const refreshLiveProfile = useCallback(async (sym = symbol, intv = interval) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orderflow?symbol=${encodeURIComponent(sym)}&market=nse&interval=${encodeURIComponent(intv)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to fetch live profile for ${sym}`);
      }
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading volume profile");
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  useEffect(() => {
    let ignore = false;
    const fetchProfile = async () => {
      try {
        const res = await fetch(
          `/api/orderflow?symbol=${encodeURIComponent(symbol)}&market=nse&interval=${encodeURIComponent(interval)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to fetch live profile for ${symbol}`);
        }
        const json = await res.json();
        if (!ignore) {
          setData(json);
          setLoading(false);
          setLastRefreshed(new Date());
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Error loading volume profile");
          setLoading(false);
        }
      }
    };
    void fetchProfile();
    return () => {
      ignore = true;
    };
  }, [symbol, interval]);

  // Candle Bars and Calculations
  const bars = useMemo(() => data?.bars ?? [], [data?.bars]);
  const nBars = bars.length;
  const profile = data?.profile;

  // Price Extents
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (bars.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    let mn = Infinity;
    let mx = -Infinity;
    for (const b of bars) {
      if (b.l < mn) mn = b.l;
      if (b.h > mx) mx = b.h;
    }
    const pad = (mx - mn) * 0.04 || mx * 0.01;
    const finalMin = mn - pad;
    const finalMax = mx + pad;
    return { minPrice: finalMin, maxPrice: finalMax, priceRange: finalMax - finalMin || 1 };
  }, [bars]);

  // Coordinate transforms
  const priceToY = useCallback(
    (p: number) => {
      const frac = (maxPrice - p) / priceRange;
      return PADDING_TOP + frac * USABLE_H;
    },
    [maxPrice, priceRange, PADDING_TOP, USABLE_H],
  );

  const yToPrice = useCallback(
    (y: number) => {
      const frac = (y - PADDING_TOP) / USABLE_H;
      return maxPrice - frac * priceRange;
    },
    [maxPrice, priceRange, PADDING_TOP, USABLE_H],
  );

  const stepX = useMemo(() => {
    return nBars > 0 ? CHART_WIDTH / nBars : 10;
  }, [nBars, CHART_WIDTH]);

  const indexToX = useCallback(
    (i: number) => {
      return 15 + (i + 0.5) * stepX;
    },
    [stepX],
  );

  // Volume Profile Metrics
  const maxBinVolume = useMemo(() => {
    if (!profile?.bins || profile.bins.length === 0) return 1;
    return Math.max(1, ...profile.bins.map((b) => b.v));
  }, [profile]);

  const maxBinDelta = useMemo(() => {
    if (!profile?.bins || profile.bins.length === 0) return 1;
    return Math.max(1, ...profile.bins.map((b) => Math.abs(b.delta)));
  }, [profile]);

  // Identify High Volume Nodes (HVN) and Low Volume Nodes (LVN)
  const { hvnBin, lvnBin } = useMemo(() => {
    if (!profile?.bins || profile.bins.length < 5) return { hvnBin: null, lvnBin: null };
    let highestV = -1;
    let lowestV = Infinity;
    let hvn = profile.bins[0];
    let lvn = profile.bins[0];

    // Exclude outer boundary bins which naturally have low counts
    const innerBins = profile.bins.slice(3, -3);
    for (const b of innerBins) {
      if (b.v > highestV) {
        highestV = b.v;
        hvn = b;
      }
      if (b.v < lowestV && b.v > 0) {
        lowestV = b.v;
        lvn = b;
      }
    }
    return { hvnBin: hvn, lvnBin: lvn };
  }, [profile]);

  // Active Bar for HUD (defaults to latest bar)
  const activeBarIdx = hoverBarIdx !== null && hoverBarIdx < nBars ? hoverBarIdx : nBars - 1;
  const activeBar = bars[activeBarIdx];

  // Current Price and Market Structure Status
  const lastClose = data?.lastClose ?? activeBar?.c ?? null;
  const pocPrice = profile?.poc ?? null;
  const vahPrice = profile?.vah ?? null;
  const valPrice = profile?.val ?? null;

  const marketStructure = useMemo(() => {
    if (lastClose === null || pocPrice === null || vahPrice === null || valPrice === null) {
      return {
        regime: "CALCULATING",
        label: "Analyzing Profile",
        color: "text-muted-foreground",
        badgeBg: "bg-muted text-muted-foreground border-border",
        desc: "Compiling visible range auction volume...",
        distancePoc: 0,
        distancePocPct: 0,
      };
    }

    const distPoc = lastClose - pocPrice;
    const distPocPct = (distPoc / pocPrice) * 100;

    if (lastClose > vahPrice) {
      return {
        regime: "ABOVE_VALUE",
        label: "ABOVE VALUE AREA (VAH)",
        color: "text-emerald-400",
        badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        desc: "Bullish imbalance / premium extension. Acceptance above VAH searches for higher liquidity; rejection risks swift mean-reversion back to POC.",
        distancePoc: distPoc,
        distancePocPct: distPocPct,
      };
    }
    if (lastClose < valPrice) {
      return {
        regime: "BELOW_VALUE",
        label: "BELOW VALUE AREA (VAL)",
        color: "text-rose-400",
        badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        desc: "Bearish auction / discount territory. Heavy selling pressure below VAL; watch for responsive buyer absorption back into value.",
        distancePoc: distPoc,
        distancePocPct: distPocPct,
      };
    }
    return {
      regime: "INSIDE_VALUE",
      label: "INSIDE VALUE AREA (FAIR VALUE)",
      color: "text-amber-400",
      badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      desc: "Rotational balance. 70% of market volume transacted here; price is rotating around the high-liquidity Point of Control (POC).",
      distancePoc: distPoc,
      distancePocPct: distPocPct,
    };
  }, [lastClose, pocPrice, vahPrice, valPrice]);

  // Session markers (group bars by day)
  const sessionDivisions = useMemo(() => {
    if (!bars.length || !data?.intraday) return [];
    const divisions: { idx: number; label: string }[] = [];
    let lastDay = "";

    bars.forEach((b, i) => {
      const day = b.t.slice(0, 10);
      if (day !== lastDay) {
        if (lastDay !== "") {
          divisions.push({ idx: i, label: day.slice(5) });
        }
        lastDay = day;
      }
    });
    return divisions;
  }, [bars, data?.intraday]);

  // Handle Mouse Events for Crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || nBars === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const svgX = relX * W;

    // Check if within candlestick zone
    if (svgX >= 15 && svgX <= CHART_WIDTH + 15) {
      const barIndex = Math.floor((svgX - 15) / stepX);
      setHoverBarIdx(Math.max(0, Math.min(nBars - 1, barIndex)));
      setHoverBinIdx(null);
    } else if (svgX > CHART_WIDTH + 15) {
      // Hovering volume profile
      setHoverBarIdx(null);
      const relY = (e.clientY - rect.top) / rect.height;
      const svgY = relY * H;
      const priceAtY = yToPrice(svgY);
      if (profile?.bins) {
        const binIndex = profile.bins.findIndex(
          (b) => priceAtY >= b.lo && priceAtY <= b.hi,
        );
        setHoverBinIdx(binIndex !== -1 ? binIndex : null);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverBarIdx(null);
    setHoverBinIdx(null);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInput.trim().toUpperCase();
    if (clean) {
      setSymbol(clean);
      setCustomInput("");
    }
  };

  // Profile X Offsets
  const profileStartX = CHART_WIDTH + 20;

  return (
    <div className="space-y-4 rounded-none">
      {/* 1. Header Toolbar & Quick Ticker Selector */}
      <div className="border border-neutral-800 bg-[#090b0e] p-3 sm:p-4 rounded-none shadow-xl space-y-3">
        {/* Top bar: Title + Bellwether Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 px-2.5 py-1 text-2xs font-mono font-bold text-primary rounded-none">
              <BarChart2 className="h-3.5 w-3.5" />
              <span>TRADINGVIEW VRVP</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-serif font-bold text-white tracking-tight flex items-center gap-2">
                <span>{symbol}</span>
                <span className="text-xs font-mono font-normal text-neutral-400">
                  {BELLWETHERS.find((b) => b.symbol === symbol)?.name ?? "NSE Live Equities"}
                </span>
              </h2>
            </div>
          </div>

          {/* Timeframe Chips */}
          <div className="flex items-center gap-1 bg-[#131722] border border-neutral-800 p-0.5 rounded-none">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setInterval(tf.id)}
                className={cn(
                  "px-2.5 py-1 text-2xs font-mono font-semibold transition-all rounded-none",
                  interval === tf.id
                    ? "bg-primary text-black font-bold shadow-xs"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/60",
                )}
                title={tf.sub}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bellwethers Quick Selector Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-3xs font-mono uppercase tracking-wider text-neutral-400 mr-1 flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-400" /> Bellwethers:
            </span>
            {BELLWETHERS.map((b) => (
              <button
                key={b.symbol}
                onClick={() => setSymbol(b.symbol)}
                className={cn(
                  "border px-2 py-0.5 text-2xs font-mono font-semibold transition-all rounded-none",
                  symbol === b.symbol
                    ? "border-primary bg-primary/20 text-primary font-bold"
                    : "border-neutral-800 bg-[#131722] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200",
                )}
              >
                {b.symbol}
              </button>
            ))}
          </div>

          {/* Search Custom Ticker Form */}
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="NSE Ticker (e.g. INFY)"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="h-7 w-32 sm:w-40 bg-[#131722] border border-neutral-800 pl-7 pr-2 font-mono text-2xs uppercase text-white placeholder:text-neutral-600 focus:border-primary focus:outline-none rounded-none"
              />
            </div>
            <button
              type="submit"
              className="h-7 border border-neutral-700 bg-neutral-800 px-2.5 font-mono text-2xs text-white hover:bg-neutral-700 rounded-none transition-colors"
            >
              Load
            </button>
            <button
              type="button"
              onClick={() => void refreshLiveProfile(symbol, interval)}
              disabled={loading}
              className="h-7 border border-neutral-800 bg-[#131722] px-2 text-neutral-400 hover:text-white rounded-none transition-colors"
              title="Refresh Live Data"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin text-primary")} />
            </button>
          </form>
        </div>

        {/* Display Toggles & Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800/80 pt-2 text-2xs font-mono text-neutral-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xs uppercase tracking-wider text-neutral-400">Terminals:</span>
            {/* Profile Mode Toggle */}
            <div className="flex items-center border border-neutral-800 bg-[#131722] rounded-none p-0.5">
              <button
                onClick={() => setProfileMode("tradingview")}
                className={cn(
                  "px-2 py-0.5 text-3xs font-semibold rounded-none transition-colors",
                  profileMode === "tradingview"
                    ? "bg-neutral-800 text-amber-400 font-bold"
                    : "text-neutral-400 hover:text-white",
                )}
              >
                VRVP (Buy Gold / Sell Blue)
              </button>
              <button
                onClick={() => setProfileMode("delta")}
                className={cn(
                  "px-2 py-0.5 text-3xs font-semibold rounded-none transition-colors",
                  profileMode === "delta"
                    ? "bg-neutral-800 text-cyan-400 font-bold"
                    : "text-neutral-400 hover:text-white",
                )}
              >
                Net Delta Profile
              </button>
            </div>

            {/* Feature Toggles */}
            <label className="flex items-center gap-1.5 cursor-pointer text-3xs hover:text-white">
              <input
                type="checkbox"
                checked={showPocLine}
                onChange={(e) => setShowPocLine(e.target.checked)}
                className="accent-amber-400 rounded-none"
              />
              <span className="text-amber-400 font-bold">POC Line</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-3xs hover:text-white">
              <input
                type="checkbox"
                checked={showValueArea}
                onChange={(e) => setShowValueArea(e.target.checked)}
                className="accent-primary rounded-none"
              />
              <span>Value Area (70%)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-3xs hover:text-white">
              <input
                type="checkbox"
                checked={showVwap}
                onChange={(e) => setShowVwap(e.target.checked)}
                className="accent-purple-400 rounded-none"
              />
              <span>VWAP</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-3xs hover:text-white">
              <input
                type="checkbox"
                checked={showSessions}
                onChange={(e) => setShowSessions(e.target.checked)}
                className="accent-blue-400 rounded-none"
              />
              <span>Session Boxes</span>
            </label>
          </div>

          <div className="flex items-center gap-2 text-3xs font-mono">
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <ShieldCheck className="h-3 w-3" /> 100% Genuine Live Exchange Bars
            </span>
            <span className="text-neutral-700">|</span>
            <span className="text-neutral-400">
              Sync: {lastRefreshed.toLocaleTimeString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Pitch-Black TradingView Profile Terminal Canvas */}
      <div className="relative border border-neutral-800 bg-[#06080a] p-1 rounded-none shadow-2xl overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-xs font-mono text-xs text-primary">
            <div className="flex items-center gap-2 border border-neutral-800 bg-[#0c0d10] px-4 py-2 rounded-none shadow-lg">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span>Fetching live {symbol} tick stream &amp; order-flow bins...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-8 text-center font-mono text-xs text-rose-400 bg-rose-950/20 border border-rose-900/40 rounded-none m-3">
            <p className="font-bold text-sm">Failed to Load Profile for {symbol}</p>
            <p className="mt-1 text-neutral-400">{error}</p>
            <button
              onClick={() => {
                setSymbol("RELIANCE");
                void refreshLiveProfile("RELIANCE", interval);
              }}
              className="mt-3 border border-neutral-700 bg-neutral-800 px-3 py-1 text-2xs text-white hover:bg-neutral-700 rounded-none"
            >
              Reset to Reliance Industries
            </button>
          </div>
        )}

        {/* Top Candlestick Readout HUD */}
        {activeBar && (
          <div className="absolute top-2 left-3 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 bg-black/90 border border-neutral-800/80 px-2.5 py-1 text-2xs font-mono text-neutral-300 rounded-none shadow-md pointer-events-none">
            <span className="text-white font-bold">{symbol}</span>
            <span className="text-neutral-400">{fmtDateLabel(activeBar.t, data?.intraday ?? true)}</span>
            <span>
              O: <strong className="text-white">{fmtINR(activeBar.o)}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-400">{fmtINR(activeBar.h)}</strong>
            </span>
            <span>
              L: <strong className="text-rose-400">{fmtINR(activeBar.l)}</strong>
            </span>
            <span>
              C:{" "}
              <strong className={activeBar.c >= activeBar.o ? "text-emerald-400" : "text-rose-400"}>
                {fmtINR(activeBar.c)}
              </strong>
            </span>
            <span>
              Vol: <strong className="text-amber-400">{fmtCompact(activeBar.v)}</strong>
            </span>
            <span>
              Δ:{" "}
              <strong className={activeBar.delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {activeBar.delta >= 0 ? "+" : ""}
                {fmtCompact(activeBar.delta)}
              </strong>
            </span>
          </div>
        )}

        {/* Profile Stats HUD Overlay (Top-Right) */}
        {profile && (
          <div className="absolute top-2 right-3 z-20 hidden md:flex items-center gap-3 bg-black/90 border border-neutral-800/80 px-2.5 py-1 text-2xs font-mono text-neutral-400 rounded-none shadow-md pointer-events-none">
            <span>
              Rows: <strong className="text-neutral-200">{profile.bins.length}</strong>
            </span>
            <span>
              VA: <strong className="text-primary">70%</strong>
            </span>
            <span>
              POC: <strong className="text-amber-400 font-bold">{fmtINR(profile.poc)}</strong>
            </span>
            <span>
              Total Vol: <strong className="text-white">{fmtCompact(profile.total)}</strong>
            </span>
          </div>
        )}

        {/* SVG Interactive Canvas */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative w-full cursor-crosshair select-none overflow-x-auto"
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto min-h-[460px] max-h-[620px] block"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Value Area Gradient Fill */}
              <linearGradient id="tv-value-area-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2962ff" stopOpacity="0.04" />
                <stop offset="70%" stopColor="#2962ff" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#f5c518" stopOpacity="0.12" />
              </linearGradient>

              {/* Grid pattern */}
              <pattern id="tv-grid" width="60" height="40" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 40" fill="none" stroke="#161b22" strokeWidth="0.8" />
              </pattern>
            </defs>

            {/* Background Grid */}
            <rect width={W} height={H} fill="#090b0e" />
            <rect width={W} height={H} fill="url(#tv-grid)" />

            {/* Session Delimiters and Shaded Boxes */}
            {showSessions &&
              sessionDivisions.map((sd) => {
                const sx = indexToX(sd.idx);
                return (
                  <g key={sd.idx}>
                    <line
                      x1={sx}
                      y1={PADDING_TOP}
                      x2={sx}
                      y2={H - PADDING_BOTTOM}
                      stroke="#222b38"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={sx + 4}
                      y={PADDING_TOP + 12}
                      fill="#4b5563"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {sd.label}
                    </text>
                  </g>
                );
              })}

            {/* 70% Value Area Shaded Zone (VAH to VAL) */}
            {showValueArea && vahPrice !== null && valPrice !== null && (
              <g>
                <rect
                  x={15}
                  y={priceToY(vahPrice)}
                  width={CHART_WIDTH}
                  height={Math.max(priceToY(valPrice) - priceToY(vahPrice), 2)}
                  fill="url(#tv-value-area-grad)"
                />
                {/* VAH Boundary Line */}
                <line
                  x1={15}
                  y1={priceToY(vahPrice)}
                  x2={CHART_WIDTH + 15}
                  y2={priceToY(vahPrice)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                {/* VAL Boundary Line */}
                <line
                  x1={15}
                  y1={priceToY(valPrice)}
                  x2={CHART_WIDTH + 15}
                  y2={priceToY(valPrice)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
              </g>
            )}

            {/* Candlestick Bars */}
            {bars.map((b, i) => {
              const xPos = indexToX(i);
              const openY = priceToY(b.o);
              const closeY = priceToY(b.c);
              const highY = priceToY(b.h);
              const lowY = priceToY(b.l);
              const isBull = b.c >= b.o;
              const color = isBull ? "#089981" : "#f23645"; // TradingView green / red
              const candleW = Math.max(stepX * 0.65, 1.2);
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(Math.abs(openY - closeY), 1.2);

              return (
                <g key={i}>
                  {/* Needle Wick */}
                  <line
                    x1={xPos}
                    y1={highY}
                    x2={xPos}
                    y2={lowY}
                    stroke={color}
                    strokeWidth="1"
                  />
                  {/* Candle Body: STRICT ZERO ROUNDED EDGES */}
                  <rect
                    x={xPos - candleW / 2}
                    y={bodyTop}
                    width={candleW}
                    height={bodyHeight}
                    fill={color}
                    stroke={color}
                    strokeWidth="0.5"
                    rx="0"
                    ry="0"
                  />
                </g>
              );
            })}

            {/* VWAP Curve */}
            {showVwap && data?.vwap && data.vwap.length > 0 && (
              <path
                d={data.vwap
                  .map((v, i) => {
                    if (v === null || v === undefined) return "";
                    const ptX = indexToX(i);
                    const ptY = priceToY(v);
                    return `${i === 0 ? "M" : "L"}${ptX.toFixed(1)} ${ptY.toFixed(1)}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#c084fc"
                strokeWidth="1.2"
                strokeDasharray="5 3"
              />
            )}

            {/* Point of Control (POC) Bold Horizontal Line Stretching Across Chart */}
            {showPocLine && pocPrice !== null && (
              <g>
                <line
                  x1={15}
                  y1={priceToY(pocPrice)}
                  x2={W - 60}
                  y2={priceToY(pocPrice)}
                  stroke="#f5a623"
                  strokeWidth="1.8"
                />
                {/* Micro Dash highlight */}
                <line
                  x1={15}
                  y1={priceToY(pocPrice)}
                  x2={CHART_WIDTH + 15}
                  y2={priceToY(pocPrice)}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                  strokeDasharray="2 6"
                  opacity="0.8"
                />
              </g>
            )}

            {/* Current Price / LTP Horizontal Line */}
            {lastClose !== null && (
              <line
                x1={15}
                y1={priceToY(lastClose)}
                x2={W - 60}
                y2={priceToY(lastClose)}
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity="0.85"
              />
            )}

            {/* Divider Line between Candlestick Canvas and Volume Profile */}
            <line
              x1={profileStartX - 5}
              y1={PADDING_TOP}
              x2={profileStartX - 5}
              y2={H - PADDING_BOTTOM}
              stroke="#21262d"
              strokeWidth="1.2"
            />

            {/* ======================================================== */}
            {/* TRADINGVIEW VOLUME PROFILE (VRVP) HISTOGRAM (Right Zone)  */}
            {/* ======================================================== */}
            {profile?.bins &&
              profile.bins.map((bin, i) => {
                const binTopY = priceToY(bin.hi);
                const binBotY = priceToY(bin.lo);
                const barH = Math.max(binBotY - binTopY - 0.8, 1);
                const isInsideVA =
                  vahPrice !== null &&
                  valPrice !== null &&
                  bin.mid >= valPrice &&
                  bin.mid <= vahPrice;
                const isPocBin = pocPrice !== null && Math.abs(bin.mid - pocPrice) < 1e-4;
                const isHovered = hoverBinIdx === i;

                if (profileMode === "tradingview") {
                  // Up-Volume (Buy) in Gold/Yellow + Down-Volume (Sell) in Royal Blue
                  // Exactly as in TradingView Screenshot
                  const buyWidth = (bin.buy / maxBinVolume) * PROFILE_WIDTH;
                  const sellWidth = (bin.sell / maxBinVolume) * PROFILE_WIDTH;
                  const totalW = buyWidth + sellWidth;
                  const opacity = isInsideVA ? 0.95 : 0.45;

                  return (
                    <g
                      key={i}
                      className="cursor-pointer transition-opacity"
                      opacity={isHovered ? 1 : opacity}
                    >
                      {/* Buy Volume Bar (TradingView Gold/Yellow) - Strict Zero Rounded Edges */}
                      <rect
                        x={profileStartX}
                        y={binTopY}
                        width={Math.max(buyWidth, 0)}
                        height={barH}
                        fill="#f5a623"
                        rx="0"
                        ry="0"
                      />
                      {/* Sell Volume Bar (TradingView Royal Blue) - Strict Zero Rounded Edges */}
                      <rect
                        x={profileStartX + buyWidth}
                        y={binTopY}
                        width={Math.max(sellWidth, 0)}
                        height={barH}
                        fill="#2962ff"
                        rx="0"
                        ry="0"
                      />
                      {/* POC Highlight border if peak bin */}
                      {isPocBin && (
                        <rect
                          x={profileStartX}
                          y={binTopY}
                          width={Math.min(totalW + 6, PROFILE_WIDTH)}
                          height={barH}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.2"
                          rx="0"
                          ry="0"
                        />
                      )}
                    </g>
                  );
                } else {
                  // Delta Profile Mode: Positive Delta (Green) vs Negative Delta (Red)
                  const deltaW = (Math.abs(bin.delta) / maxBinDelta) * (PROFILE_WIDTH * 0.8);
                  const isPos = bin.delta >= 0;
                  const color = isPos ? "#089981" : "#f23645";
                  const opacity = isInsideVA ? 0.9 : 0.45;

                  return (
                    <g key={i} opacity={isHovered ? 1 : opacity}>
                      <rect
                        x={profileStartX}
                        y={binTopY}
                        width={Math.max(deltaW, 0.5)}
                        height={barH}
                        fill={color}
                        rx="0"
                        ry="0"
                      />
                    </g>
                  );
                }
              })}

            {/* Vertical Crosshair Line */}
            {hoverBarIdx !== null && activeBar && (
              <line
                x1={indexToX(hoverBarIdx)}
                y1={PADDING_TOP}
                x2={indexToX(hoverBarIdx)}
                y2={H - PADDING_BOTTOM}
                stroke="#6e7681"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* Horizontal Price Axis on Far Right */}
            <g transform={`translate(${W - 60}, 0)`}>
              {/* Vertical Scale Border */}
              <line
                x1={0}
                y1={PADDING_TOP}
                x2={0}
                y2={H - PADDING_BOTTOM}
                stroke="#21262d"
                strokeWidth="1"
              />

              {/* Price Ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const tickPrice = minPrice + (1 - pct) * priceRange;
                const tickY = PADDING_TOP + pct * USABLE_H;
                return (
                  <g key={pct}>
                    <line x1={0} y1={tickY} x2={5} y2={tickY} stroke="#30363d" strokeWidth="1" />
                    <text
                      x={8}
                      y={tickY + 3}
                      fill="#8b949e"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {fmtINR(tickPrice, 0)}
                    </text>
                  </g>
                );
              })}

              {/* VAH Price Tag */}
              {showValueArea && vahPrice !== null && (
                <g transform={`translate(0, ${priceToY(vahPrice)})`}>
                  <rect
                    x={0}
                    y={-7}
                    width={56}
                    height={14}
                    fill="#0284c7"
                    rx="0"
                    ry="0"
                  />
                  <text
                    x={4}
                    y={3}
                    fill="#ffffff"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    VAH {vahPrice.toFixed(1)}
                  </text>
                </g>
              )}

              {/* POC Price Tag (High Contrast Gold) */}
              {showPocLine && pocPrice !== null && (
                <g transform={`translate(0, ${priceToY(pocPrice)})`}>
                  <rect
                    x={0}
                    y={-8}
                    width={58}
                    height={16}
                    fill="#d97706"
                    rx="0"
                    ry="0"
                  />
                  <text
                    x={4}
                    y={3.5}
                    fill="#ffffff"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    POC {pocPrice.toFixed(1)}
                  </text>
                </g>
              )}

              {/* VAL Price Tag */}
              {showValueArea && valPrice !== null && (
                <g transform={`translate(0, ${priceToY(valPrice)})`}>
                  <rect
                    x={0}
                    y={-7}
                    width={56}
                    height={14}
                    fill="#0284c7"
                    rx="0"
                    ry="0"
                  />
                  <text
                    x={4}
                    y={3}
                    fill="#ffffff"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    VAL {valPrice.toFixed(1)}
                  </text>
                </g>
              )}

              {/* Current LTP Badge */}
              {lastClose !== null && (
                <g transform={`translate(0, ${priceToY(lastClose)})`}>
                  <rect
                    x={0}
                    y={-8}
                    width={58}
                    height={16}
                    fill="#ffffff"
                    rx="0"
                    ry="0"
                  />
                  <text
                    x={4}
                    y={3.5}
                    fill="#000000"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    LTP {lastClose.toFixed(1)}
                  </text>
                </g>
              )}
            </g>
          </svg>

          {/* Hover Volume Bin Tooltip Popup */}
          {hoverBinIdx !== null && profile?.bins && profile.bins[hoverBinIdx] && (
            <div
              className="pointer-events-none absolute z-30 border border-neutral-700 bg-black/95 p-2 font-mono text-xs text-white shadow-xl rounded-none"
              style={{
                right: "120px",
                top: `${priceToY(profile.bins[hoverBinIdx].mid) - 30}px`,
              }}
            >
              <div className="font-bold text-amber-400">
                Level: {fmtINR(profile.bins[hoverBinIdx].mid)}
              </div>
              <div className="mt-1 flex items-center gap-3 text-3xs text-neutral-300">
                <span>Total: <strong className="text-white">{fmtCompact(profile.bins[hoverBinIdx].v)}</strong></span>
                <span>Buy: <strong className="text-[#f5a623]">{fmtCompact(profile.bins[hoverBinIdx].buy)}</strong></span>
                <span>Sell: <strong className="text-[#2962ff]">{fmtCompact(profile.bins[hoverBinIdx].sell)}</strong></span>
                <span>Δ: <strong className={profile.bins[hoverBinIdx].delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {fmtCompact(profile.bins[hoverBinIdx].delta)}
                </strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Legend & Scale Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 bg-[#080a0d] px-3 py-2 text-2xs font-mono text-neutral-400 rounded-none">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-[#f5a623] inline-block rounded-none" />
              <span>Up-Volume (Buy)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-[#2962ff] inline-block rounded-none" />
              <span>Down-Volume (Sell)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 border-t-2 border-[#f5a623] inline-block" />
              <span className="text-amber-400 font-bold">POC Line</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 border-t-2 border-dashed border-[#38bdf8] inline-block" />
              <span className="text-[#38bdf8]">VAH / VAL (70%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 border-t-2 border-dashed border-[#c084fc] inline-block" />
              <span className="text-[#c084fc]">VWAP</span>
            </span>
          </div>

          <div className="text-3xs text-neutral-500">
            Visible Window: {bars.length} {data?.intervalLabel ?? interval} bars · All sharp rectangular geometries
          </div>
        </div>
      </div>

      {/* 3. Microstructure Intelligence & Auction Theory Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Regime Status Card */}
        <div className="border border-neutral-800 bg-[#0c0d10] p-3.5 rounded-none space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono uppercase tracking-wider text-neutral-400">
            <span>Market Regime</span>
            <span className="text-3xs text-neutral-500">Auction Market Theory</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 text-xs font-mono font-bold rounded-none border", marketStructure.badgeBg)}>
              {marketStructure.label}
            </span>
          </div>
          <p className="text-3xs text-neutral-400 leading-relaxed">
            {marketStructure.desc}
          </p>
        </div>

        {/* POC Proximity Card */}
        <div className="border border-neutral-800 bg-[#0c0d10] p-3.5 rounded-none space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono uppercase tracking-wider text-neutral-400">
            <span>Point of Control (POC) Anchor</span>
            <span className="text-amber-400 font-bold">{fmtINR(pocPrice)}</span>
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-sm text-neutral-300">Distance to POC:</span>
            <span
              className={cn(
                "text-base font-bold",
                marketStructure.distancePoc >= 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {marketStructure.distancePoc >= 0 ? "+" : ""}
              {fmtINR(marketStructure.distancePoc)} ({marketStructure.distancePocPct >= 0 ? "+" : ""}
              {marketStructure.distancePocPct.toFixed(2)}%)
            </span>
          </div>
          <div className="text-3xs text-neutral-400 leading-tight">
            POC serves as the primary magnetic attractor during balanced consolidation periods.
          </div>
        </div>

        {/* High Volume Node (HVN) vs Low Volume Node (LVN) */}
        <div className="border border-neutral-800 bg-[#0c0d10] p-3.5 rounded-none space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono uppercase tracking-wider text-neutral-400">
            <span>Volume Nodes (Structure)</span>
            <span className="text-primary font-mono text-3xs">Liquidity Profiler</span>
          </div>
          <div className="space-y-1 font-mono text-2xs">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-semibold">HVN (Support Shelf):</span>
              <span className="text-white font-bold">{hvnBin ? fmtINR(hvnBin.mid) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-rose-400 font-semibold">LVN (Fast Vacuum):</span>
              <span className="text-white font-bold">{lvnBin ? fmtINR(lvnBin.mid) : "—"}</span>
            </div>
          </div>
          <div className="text-3xs text-neutral-400 leading-tight">
            HVNs represent strong institutional absorption; LVNs are low-volume voids prone to rapid slippage.
          </div>
        </div>
      </div>
    </div>
  );
}
