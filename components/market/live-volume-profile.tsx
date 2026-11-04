"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  { id: "1m", label: "1m", sub: "Ultra-High Frequency (5d)" },
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
  const H = 480;
  const PROFILE_WIDTH = 250;
  const CHART_WIDTH = W - PROFILE_WIDTH - 60;
  const PADDING_TOP = 25;
  const PADDING_BOTTOM = 30;
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
        badgeBg: "bg-surface-muted text-muted-foreground border-border",
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
        badgeBg: "bg-up/10 text-up border-up/30",
        desc: "Bullish imbalance / premium extension. Acceptance above VAH searches for higher liquidity; rejection risks swift mean-reversion back to POC.",
        distancePoc: distPoc,
        distancePocPct: distPocPct,
      };
    }
    if (lastClose < valPrice) {
      return {
        regime: "BELOW_VALUE",
        label: "BELOW VALUE AREA (VAL)",
        badgeBg: "bg-down/10 text-down border-down/30",
        desc: "Bearish auction / discount territory. Heavy selling pressure below VAL; watch for responsive buyer absorption back into value.",
        distancePoc: distPoc,
        distancePocPct: distPocPct,
      };
    }
    return {
      regime: "INSIDE_VALUE",
      label: "INSIDE VALUE AREA (FAIR VALUE)",
      badgeBg: "bg-gold/10 text-gold border-gold/30",
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

    if (svgX >= 15 && svgX <= CHART_WIDTH + 15) {
      const barIndex = Math.floor((svgX - 15) / stepX);
      setHoverBarIdx(Math.max(0, Math.min(nBars - 1, barIndex)));
      setHoverBinIdx(null);
    } else if (svgX > CHART_WIDTH + 15) {
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

  const profileStartX = CHART_WIDTH + 20;

  return (
    <div className="space-y-4 rounded-none font-sans">
      {/* 1. Header Toolbar & Quick Ticker Selector (Arthdex Theme) */}
      <div className="border border-border bg-surface p-3 sm:p-3.5 rounded-none shadow-sm space-y-2.5">
        {/* Top bar: Title + Bellwether Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-accent/10 border border-accent/30 px-2 py-0.5 text-2xs font-mono font-bold text-accent rounded-none">
              <BarChart2 className="h-3.5 w-3.5" />
              <span>VOLUME PROFILE VRVP</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-serif font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>{symbol}</span>
                <span className="text-xs font-mono font-normal text-muted-foreground">
                  {BELLWETHERS.find((b) => b.symbol === symbol)?.name ?? "NSE Equities"}
                </span>
              </h2>
            </div>
          </div>

          {/* Timeframe Chips */}
          <div className="flex items-center gap-1 bg-surface-muted border border-border p-0.5 rounded-none">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setInterval(tf.id)}
                className={cn(
                  "px-2 py-0.5 text-2xs font-mono font-semibold transition-all rounded-none",
                  interval === tf.id
                    ? "bg-accent text-accent-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title={tf.sub}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bellwethers Quick Selector Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-3xs font-mono uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
              <Zap className="h-3 w-3 text-gold" /> Bellwethers:
            </span>
            {BELLWETHERS.map((b) => (
              <button
                key={b.symbol}
                onClick={() => setSymbol(b.symbol)}
                className={cn(
                  "border px-2 py-0.5 text-2xs font-mono font-semibold transition-all rounded-none",
                  symbol === b.symbol
                    ? "border-accent bg-accent/15 text-accent font-bold"
                    : "border-border/80 bg-surface-muted/50 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {b.symbol}
              </button>
            ))}
          </div>

          {/* Search Custom Ticker Form */}
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ticker (e.g. INFY)"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="h-6.5 w-28 sm:w-36 bg-surface-muted/70 border border-border pl-6 pr-2 font-mono text-2xs uppercase text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none rounded-none"
              />
            </div>
            <button
              type="submit"
              className="h-6.5 border border-border bg-surface-raised px-2 font-mono text-2xs text-foreground hover:bg-surface-muted rounded-none transition-colors"
            >
              Load
            </button>
            <button
              type="button"
              onClick={() => void refreshLiveProfile(symbol, interval)}
              disabled={loading}
              className="h-6.5 border border-border bg-surface-raised px-1.5 text-muted-foreground hover:text-foreground rounded-none transition-colors"
              title="Refresh Live Data"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin text-accent")} />
            </button>
          </form>
        </div>

        {/* Display Toggles & Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-2 text-2xs font-mono text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground">Terminals:</span>
            {/* Profile Mode Toggle */}
            <div className="flex items-center border border-border bg-surface-muted rounded-none p-0.5">
              <button
                onClick={() => setProfileMode("tradingview")}
                className={cn(
                  "px-2 py-0.5 text-3xs font-semibold rounded-none transition-colors",
                  profileMode === "tradingview"
                    ? "bg-surface text-gold font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                VRVP (Buy Gold / Sell Blue)
              </button>
              <button
                onClick={() => setProfileMode("delta")}
                className={cn(
                  "px-2 py-0.5 text-3xs font-semibold rounded-none transition-colors",
                  profileMode === "delta"
                    ? "bg-surface text-accent font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Net Delta Profile
              </button>
            </div>

            {/* Feature Toggles */}
            <label className="flex items-center gap-1 cursor-pointer text-3xs hover:text-foreground">
              <input
                type="checkbox"
                checked={showPocLine}
                onChange={(e) => setShowPocLine(e.target.checked)}
                className="accent-gold rounded-none"
              />
              <span className="text-gold font-bold">POC Line</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer text-3xs hover:text-foreground">
              <input
                type="checkbox"
                checked={showValueArea}
                onChange={(e) => setShowValueArea(e.target.checked)}
                className="accent-accent rounded-none"
              />
              <span>Value Area (70%)</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer text-3xs hover:text-foreground">
              <input
                type="checkbox"
                checked={showVwap}
                onChange={(e) => setShowVwap(e.target.checked)}
                className="accent-accent rounded-none"
              />
              <span>VWAP</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer text-3xs hover:text-foreground">
              <input
                type="checkbox"
                checked={showSessions}
                onChange={(e) => setShowSessions(e.target.checked)}
                className="accent-accent rounded-none"
              />
              <span>Session Boxes</span>
            </label>
          </div>

          <div className="flex items-center gap-2 text-3xs font-mono">
            <span className="text-up flex items-center gap-1 font-semibold">
              <ShieldCheck className="h-3 w-3" /> 100% Genuine Live Exchange Bars
            </span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground">
              Sync: {lastRefreshed.toLocaleTimeString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Profile Terminal Canvas (Arthdex Palette) */}
      <div className="relative border border-border bg-surface p-1 rounded-none shadow-sm overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-xs font-mono text-xs text-accent">
            <div className="flex items-center gap-2 border border-border bg-surface px-4 py-2 rounded-none shadow-sm">
              <RefreshCw className="h-4 w-4 animate-spin text-accent" />
              <span>Fetching live {symbol} order-flow stream...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-6 text-center font-mono text-xs text-down bg-down/5 border border-down/30 rounded-none m-3">
            <p className="font-bold text-sm">Failed to Load Profile for {symbol}</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <button
              onClick={() => {
                setSymbol("RELIANCE");
                void refreshLiveProfile("RELIANCE", interval);
              }}
              className="mt-3 border border-border bg-surface px-3 py-1 text-2xs text-foreground hover:bg-surface-muted rounded-none"
            >
              Reset to Reliance Industries
            </button>
          </div>
        )}

        {/* Top Candlestick Readout HUD */}
        {activeBar && (
          <div className="absolute top-2 left-3 z-20 flex flex-wrap items-center gap-x-3.5 gap-y-1 bg-surface-raised/95 border border-border px-2.5 py-1 text-2xs font-mono text-foreground rounded-none shadow-xs pointer-events-none">
            <span className="font-bold">{symbol}</span>
            <span className="text-muted-foreground">{fmtDateLabel(activeBar.t, data?.intraday ?? true)}</span>
            <span>O: <strong>{fmtINR(activeBar.o)}</strong></span>
            <span>H: <strong className="text-up">{fmtINR(activeBar.h)}</strong></span>
            <span>L: <strong className="text-down">{fmtINR(activeBar.l)}</strong></span>
            <span>
              C:{" "}
              <strong className={activeBar.c >= activeBar.o ? "text-up" : "text-down"}>
                {fmtINR(activeBar.c)}
              </strong>
            </span>
            <span>Vol: <strong className="text-gold">{fmtCompact(activeBar.v)}</strong></span>
            <span>
              Δ:{" "}
              <strong className={activeBar.delta >= 0 ? "text-up" : "text-down"}>
                {activeBar.delta >= 0 ? "+" : ""}
                {fmtCompact(activeBar.delta)}
              </strong>
            </span>
          </div>
        )}

        {/* Profile Stats HUD Overlay (Top-Right) */}
        {profile && (
          <div className="absolute top-2 right-3 z-20 hidden md:flex items-center gap-3 bg-surface-raised/95 border border-border px-2.5 py-1 text-2xs font-mono text-muted-foreground rounded-none shadow-xs pointer-events-none">
            <span>Rows: <strong className="text-foreground">{profile.bins.length}</strong></span>
            <span>VA: <strong className="text-accent">70%</strong></span>
            <span>POC: <strong className="text-gold font-bold">{fmtINR(profile.poc)}</strong></span>
            <span>Total Vol: <strong className="text-foreground">{fmtCompact(profile.total)}</strong></span>
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
            className="w-full h-auto min-h-[440px] max-h-[580px] block"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="tv-value-area-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.04" />
                <stop offset="70%" stopColor="hsl(var(--accent))" stopOpacity="0.08" />
                <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0.12" />
              </linearGradient>

              <pattern id="tv-grid" width="60" height="40" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeOpacity="0.5" strokeWidth="0.8" />
              </pattern>
            </defs>

            {/* Background Canvas & Grid */}
            <rect width={W} height={H} fill="hsl(var(--surface))" />
            <rect width={W} height={H} fill="url(#tv-grid)" />

            {/* Session Delimiters */}
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
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={sx + 4}
                      y={PADDING_TOP + 12}
                      fill="hsl(var(--muted-foreground))"
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
                  stroke="hsl(var(--accent))"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                {/* VAL Boundary Line */}
                <line
                  x1={15}
                  y1={priceToY(valPrice)}
                  x2={CHART_WIDTH + 15}
                  y2={priceToY(valPrice)}
                  stroke="hsl(var(--accent))"
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
              const color = isBull ? "hsl(var(--up))" : "hsl(var(--down))";
              const candleW = Math.max(stepX * 0.65, 1.2);
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(Math.abs(openY - closeY), 1.2);

              return (
                <g key={i}>
                  <line
                    x1={xPos}
                    y1={highY}
                    x2={xPos}
                    y2={lowY}
                    stroke={color}
                    strokeWidth="1"
                  />
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
                stroke="hsl(var(--chart-clay))"
                strokeWidth="1.2"
                strokeDasharray="5 3"
              />
            )}

            {/* Point of Control (POC) Bold Horizontal Line */}
            {showPocLine && pocPrice !== null && (
              <g>
                <line
                  x1={15}
                  y1={priceToY(pocPrice)}
                  x2={W - 60}
                  y2={priceToY(pocPrice)}
                  stroke="hsl(var(--gold))"
                  strokeWidth="1.8"
                />
                <line
                  x1={15}
                  y1={priceToY(pocPrice)}
                  x2={CHART_WIDTH + 15}
                  y2={priceToY(pocPrice)}
                  stroke="hsl(var(--surface))"
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
                stroke="hsl(var(--foreground))"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity="0.75"
              />
            )}

            {/* Divider Line between Candlestick Canvas and Volume Profile */}
            <line
              x1={profileStartX - 5}
              y1={PADDING_TOP}
              x2={profileStartX - 5}
              y2={H - PADDING_BOTTOM}
              stroke="hsl(var(--border))"
              strokeWidth="1.2"
            />

            {/* ======================================================== */}
            {/* VOLUME PROFILE (VRVP) HISTOGRAM (Right Zone)             */}
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
                      <rect
                        x={profileStartX}
                        y={binTopY}
                        width={Math.max(buyWidth, 0)}
                        height={barH}
                        fill="hsl(var(--gold))"
                        rx="0"
                        ry="0"
                      />
                      <rect
                        x={profileStartX + buyWidth}
                        y={binTopY}
                        width={Math.max(sellWidth, 0)}
                        height={barH}
                        fill="hsl(var(--accent))"
                        rx="0"
                        ry="0"
                      />
                      {isPocBin && (
                        <rect
                          x={profileStartX}
                          y={binTopY}
                          width={Math.min(totalW + 6, PROFILE_WIDTH)}
                          height={barH}
                          fill="none"
                          stroke="hsl(var(--foreground))"
                          strokeWidth="1.2"
                          rx="0"
                          ry="0"
                        />
                      )}
                    </g>
                  );
                } else {
                  const deltaW = (Math.abs(bin.delta) / maxBinDelta) * (PROFILE_WIDTH * 0.8);
                  const isPos = bin.delta >= 0;
                  const color = isPos ? "hsl(var(--up))" : "hsl(var(--down))";
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
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* Horizontal Price Axis on Far Right */}
            <g transform={`translate(${W - 60}, 0)`}>
              <line
                x1={0}
                y1={PADDING_TOP}
                x2={0}
                y2={H - PADDING_BOTTOM}
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />

              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const tickPrice = minPrice + (1 - pct) * priceRange;
                const tickY = PADDING_TOP + pct * USABLE_H;
                return (
                  <g key={pct}>
                    <line x1={0} y1={tickY} x2={5} y2={tickY} stroke="hsl(var(--border))" strokeWidth="1" />
                    <text
                      x={8}
                      y={tickY + 3}
                      fill="hsl(var(--muted-foreground))"
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
                  <rect x={0} y={-7} width={56} height={14} fill="hsl(var(--accent))" rx="0" ry="0" />
                  <text x={4} y={3} fill="hsl(var(--accent-foreground))" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    VAH {vahPrice.toFixed(1)}
                  </text>
                </g>
              )}

              {/* POC Price Tag */}
              {showPocLine && pocPrice !== null && (
                <g transform={`translate(0, ${priceToY(pocPrice)})`}>
                  <rect x={0} y={-8} width={58} height={16} fill="hsl(var(--gold))" rx="0" ry="0" />
                  <text x={4} y={3.5} fill="hsl(var(--surface-raised))" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    POC {pocPrice.toFixed(1)}
                  </text>
                </g>
              )}

              {/* VAL Price Tag */}
              {showValueArea && valPrice !== null && (
                <g transform={`translate(0, ${priceToY(valPrice)})`}>
                  <rect x={0} y={-7} width={56} height={14} fill="hsl(var(--accent))" rx="0" ry="0" />
                  <text x={4} y={3} fill="hsl(var(--accent-foreground))" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    VAL {valPrice.toFixed(1)}
                  </text>
                </g>
              )}

              {/* Current LTP Badge */}
              {lastClose !== null && (
                <g transform={`translate(0, ${priceToY(lastClose)})`}>
                  <rect x={0} y={-8} width={58} height={16} fill="hsl(var(--foreground))" rx="0" ry="0" />
                  <text x={4} y={3.5} fill="hsl(var(--background))" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    LTP {lastClose.toFixed(1)}
                  </text>
                </g>
              )}
            </g>
          </svg>

          {/* Hover Volume Bin Tooltip Popup */}
          {hoverBinIdx !== null && profile?.bins && profile.bins[hoverBinIdx] && (
            <div
              className="pointer-events-none absolute z-30 border border-border bg-surface-raised p-2 font-mono text-xs text-foreground shadow-md rounded-none"
              style={{
                right: "120px",
                top: `${priceToY(profile.bins[hoverBinIdx].mid) - 30}px`,
              }}
            >
              <div className="font-bold text-gold">
                Level: {fmtINR(profile.bins[hoverBinIdx].mid)}
              </div>
              <div className="mt-1 flex items-center gap-3 text-3xs text-muted-foreground">
                <span>Total: <strong className="text-foreground">{fmtCompact(profile.bins[hoverBinIdx].v)}</strong></span>
                <span>Buy: <strong className="text-gold">{fmtCompact(profile.bins[hoverBinIdx].buy)}</strong></span>
                <span>Sell: <strong className="text-accent">{fmtCompact(profile.bins[hoverBinIdx].sell)}</strong></span>
                <span>Δ: <strong className={profile.bins[hoverBinIdx].delta >= 0 ? "text-up" : "text-down"}>
                  {fmtCompact(profile.bins[hoverBinIdx].delta)}
                </strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Legend & Scale Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-3 py-2 text-2xs font-mono text-muted-foreground rounded-none">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-gold inline-block rounded-none" />
              <span>Up-Volume (Buy)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-accent inline-block rounded-none" />
              <span>Down-Volume (Sell)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 border-t-2 border-gold inline-block" />
              <span className="text-gold font-bold">POC Line</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 border-t-2 border-dashed border-accent inline-block" />
              <span className="text-accent">VAH / VAL (70%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 border-t-2 border-dashed border-chart-clay inline-block" />
              <span>VWAP</span>
            </span>
          </div>

          <div className="text-3xs text-muted-foreground">
            Visible Window: {bars.length} {data?.intervalLabel ?? interval} bars · Sharp rectangular geometry
          </div>
        </div>
      </div>

      {/* 3. Microstructure Intelligence & Auction Theory Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Regime Status Card */}
        <div className="border border-border bg-surface p-3 rounded-none space-y-1.5 font-sans">
          <div className="flex items-center justify-between text-2xs font-mono uppercase tracking-wider text-muted-foreground">
            <span>Market Regime</span>
            <span className="text-3xs">Auction Theory</span>
          </div>
          <div>
            <span className={cn("px-2 py-0.5 text-xs font-mono font-bold rounded-none border", marketStructure.badgeBg)}>
              {marketStructure.label}
            </span>
          </div>
          <p className="text-3xs text-muted-foreground leading-relaxed">
            {marketStructure.desc}
          </p>
        </div>

        {/* POC Proximity Card */}
        <div className="border border-border bg-surface p-3 rounded-none space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-muted-foreground">
            <span>Point of Control Anchor</span>
            <span className="text-gold font-bold">{fmtINR(pocPrice)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Distance to POC:</span>
            <span
              className={cn(
                "text-sm font-bold",
                marketStructure.distancePoc >= 0 ? "text-up" : "text-down",
              )}
            >
              {marketStructure.distancePoc >= 0 ? "+" : ""}
              {fmtINR(marketStructure.distancePoc)} ({marketStructure.distancePocPct >= 0 ? "+" : ""}
              {marketStructure.distancePocPct.toFixed(2)}%)
            </span>
          </div>
          <div className="text-3xs text-muted-foreground leading-tight">
            POC serves as the primary magnetic attractor during balanced consolidation periods.
          </div>
        </div>

        {/* High Volume Node (HVN) vs Low Volume Node (LVN) */}
        <div className="border border-border bg-surface p-3 rounded-none space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-muted-foreground">
            <span>Volume Nodes (Structure)</span>
            <span className="text-accent text-3xs">Liquidity Shelf</span>
          </div>
          <div className="space-y-1 text-2xs">
            <div className="flex items-center justify-between">
              <span className="text-up font-semibold">HVN (Support Shelf):</span>
              <span className="text-foreground font-bold">{hvnBin ? fmtINR(hvnBin.mid) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-down font-semibold">LVN (Fast Vacuum):</span>
              <span className="text-foreground font-bold">{lvnBin ? fmtINR(lvnBin.mid) : "—"}</span>
            </div>
          </div>
          <div className="text-3xs text-muted-foreground leading-tight">
            HVNs represent strong institutional absorption; LVNs are low-volume voids prone to rapid slippage.
          </div>
        </div>
      </div>
    </div>
  );
}
