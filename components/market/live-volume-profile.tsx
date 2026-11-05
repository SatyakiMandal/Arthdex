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
  Clock,
  Eye,
  Flame,
  Info,
  Keyboard,
  Layers,
  LineChart,
  Maximize2,
  Play,
  Pause,
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

interface LiveQuoteState {
  cmp: number;
  change: { absolute: number; percent: number } | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  asOf: string | null;
  source: string | null;
}

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
  const [timeframe, setTimeframe] = useState<OrderflowInterval>(initialInterval);
  const [data, setData] = useState<ApiOrderflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Live Engine Auto-Polling & Tick Motion States
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(3); // 3s ultra-live polling
  const [countdown, setCountdown] = useState<number>(3);
  const [pollSeq, setPollSeq] = useState<number>(1);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [tickFlash, setTickFlash] = useState<"up" | "down" | null>(null);
  const [volFlash, setVolFlash] = useState<boolean>(false);
  const [showHotkeysModal, setShowHotkeysModal] = useState<boolean>(false);

  const [liveQuote, setLiveQuote] = useState<LiveQuoteState | null>(null);
  const prevLastCloseRef = useRef<number | null>(null);
  const prevTotalVolRef = useRef<number | null>(null);
  const prevCmpRef = useRef<number | null>(null);
  const prevLiveVolRef = useRef<number | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);
  const volTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if initialSymbol prop changes from parent
  useEffect(() => {
    if (initialSymbol && initialSymbol !== symbol) {
      setSymbol(initialSymbol);
      prevLastCloseRef.current = null;
      prevTotalVolRef.current = null;
      prevCmpRef.current = null;
      prevLiveVolRef.current = null;
      setLiveQuote(null);
    }
  }, [initialSymbol]);

  // Interactive View Toggles
  const [profileMode, setProfileMode] = useState<"tradingview" | "delta">("tradingview");
  const [showValueArea, setShowValueArea] = useState(true);
  const [showPocLine, setShowPocLine] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [showCvd, setShowCvd] = useState(true);
  const [showAbsorption, setShowAbsorption] = useState(true);

  // Crosshair / Hover state
  const [hoverBarIdx, setHoverBarIdx] = useState<number | null>(null);
  const [hoverBinIdx, setHoverBinIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG Chart Dimensions (Dynamic for CVD Sub-Pane)
  const W = 1100;
  const H = showCvd ? 580 : 480;
  const PROFILE_WIDTH = 250;
  const CHART_WIDTH = W - PROFILE_WIDTH - 60;
  const PADDING_TOP = 25;
  const PADDING_BOTTOM = 30;
  const PRICE_USABLE_H = showCvd ? 340 : 425;
  const CVD_TOP = 395;
  const CVD_USABLE_H = 130;
  const USABLE_H = PRICE_USABLE_H;

  // Load Orderflow Data with Live Tick Detection
  const refreshLiveProfile = useCallback(
    async (sym = symbol, intv = timeframe, isSilent = false) => {
      if (!isSilent) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }
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
        const json: ApiOrderflow = await res.json();

        // Detect price tick direction
        const currentClose =
          json.lastClose ?? (json.bars.length > 0 ? json.bars[json.bars.length - 1].c : null);
        if (currentClose !== null && prevLastCloseRef.current !== null) {
          if (currentClose > prevLastCloseRef.current) {
            setTickFlash("up");
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setTickFlash(null), 1400);
          } else if (currentClose < prevLastCloseRef.current) {
            setTickFlash("down");
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setTickFlash(null), 1400);
          }
        }
        if (currentClose !== null) {
          prevLastCloseRef.current = currentClose;
        }

        // Detect volume change
        const currentTotalVol = json.profile?.total ?? 0;
        if (prevTotalVolRef.current !== null && currentTotalVol > prevTotalVolRef.current) {
          setVolFlash(true);
          if (volTimerRef.current) clearTimeout(volTimerRef.current);
          volTimerRef.current = setTimeout(() => setVolFlash(false), 900);
        }
        prevTotalVolRef.current = currentTotalVol;

        setData(json);
        setLastRefreshed(new Date());
        setPollSeq((p) => p + 1);
      } catch (err) {
        if (!isSilent) {
          setError(err instanceof Error ? err.message : "Error loading volume profile");
        }
      } finally {
        setLoading(false);
        setIsSyncing(false);
      }
    },
    [symbol, timeframe],
  );

  // Initial load or symbol/interval changes
  useEffect(() => {
    void refreshLiveProfile(symbol, timeframe, false);
  }, [symbol, timeframe, refreshLiveProfile]);

  // Live Auto-Refresh Countdown Timer
  useEffect(() => {
    if (autoRefreshSecs === 0) return;
    setCountdown(autoRefreshSecs);

    const intervalTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void refreshLiveProfile(symbol, timeframe, true);
          return autoRefreshSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalTimer);
  }, [autoRefreshSecs, symbol, timeframe, refreshLiveProfile]);

  // Real-Time High-Frequency Live Exchange Tick Engine (1.5s sub-interval)
  // Polls authentic exchange quote to animate the horizontal LTP beam and tick flashes
  useEffect(() => {
    let isCancelled = false;
    let tickTimer: NodeJS.Timeout | null = null;

    const pollLiveQuote = async () => {
      if (autoRefreshSecs === 0) return; // paused
      try {
        const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store" },
        });
        if (!res.ok) return;
        const payload = await res.json();
        if (isCancelled || !payload?.ok || !payload.data) return;

        const q = payload.data;
        const newCmp: number | null = typeof q.cmp === "number" ? q.cmp : null;
        if (newCmp !== null) {
          if (prevCmpRef.current !== null && newCmp !== prevCmpRef.current) {
            const dir = newCmp > prevCmpRef.current ? "up" : "down";
            setTickFlash(dir);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setTickFlash(null), 1200);
          }
          prevCmpRef.current = newCmp;

          if (
            typeof q.volume === "number" &&
            prevLiveVolRef.current !== null &&
            q.volume > prevLiveVolRef.current
          ) {
            setVolFlash(true);
            if (volTimerRef.current) clearTimeout(volTimerRef.current);
            volTimerRef.current = setTimeout(() => setVolFlash(false), 900);
          }
          if (typeof q.volume === "number") {
            prevLiveVolRef.current = q.volume;
          }

          setLiveQuote({
            cmp: newCmp,
            change: q.change ?? null,
            dayHigh: q.dayHigh ?? null,
            dayLow: q.dayLow ?? null,
            volume: q.volume ?? null,
            asOf: q.asOf ?? null,
            source: q.sources?.used ?? "NSE",
          });
          setPollSeq((s) => s + 1);
        }
      } catch {
        // network/abort silence
      }
    };

    void pollLiveQuote();
    tickTimer = setInterval(pollLiveQuote, 1500);

    return () => {
      isCancelled = true;
      if (tickTimer) clearInterval(tickTimer);
    };
  }, [symbol, autoRefreshSecs]);

  // Keyboard Shortcuts Engine (Space/R to refresh, 1..5 for TF, P for profile mode, [/] for scrips)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === " " || e.key === "r" || e.key === "R") {
        e.preventDefault();
        void refreshLiveProfile(symbol, timeframe, false);
      } else if (e.key === "1") {
        setTimeframe("1m");
      } else if (e.key === "2") {
        setTimeframe("5m");
      } else if (e.key === "3") {
        setTimeframe("15m");
      } else if (e.key === "4") {
        setTimeframe("1h");
      } else if (e.key === "5") {
        setTimeframe("1d");
      } else if (e.key === "p" || e.key === "P") {
        setProfileMode((prev) => (prev === "tradingview" ? "delta" : "tradingview"));
      } else if (e.key === "c" || e.key === "C") {
        setShowCvd((prev) => !prev);
      } else if (e.key === "a" || e.key === "A") {
        setShowAbsorption((prev) => !prev);
      } else if (e.key === "[") {
        const idx = BELLWETHERS.findIndex((b) => b.symbol === symbol);
        const prevIdx = (idx - 1 + BELLWETHERS.length) % BELLWETHERS.length;
        setSymbol(BELLWETHERS[prevIdx].symbol);
      } else if (e.key === "]") {
        const idx = BELLWETHERS.findIndex((b) => b.symbol === symbol);
        const nextIdx = (idx + 1) % BELLWETHERS.length;
        setSymbol(BELLWETHERS[nextIdx].symbol);
      } else if (e.key === "?") {
        setShowHotkeysModal((s) => !s);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [symbol, timeframe, refreshLiveProfile]);

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

  // CVD (Cumulative Volume Delta) Extents and Path
  const cvdSeries = useMemo(() => data?.cvd ?? [], [data?.cvd]);
  const { minCvd, maxCvd, cvdRange } = useMemo(() => {
    if (cvdSeries.length === 0) return { minCvd: 0, maxCvd: 1, cvdRange: 1 };
    let mn = Infinity;
    let mx = -Infinity;
    for (const val of cvdSeries) {
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    const pad = (mx - mn) * 0.08 || 100;
    return { minCvd: mn - pad, maxCvd: mx + pad, cvdRange: mx - mn + 2 * pad || 1 };
  }, [cvdSeries]);

  const cvdToY = useCallback(
    (val: number) => {
      const frac = (maxCvd - val) / cvdRange;
      return CVD_TOP + frac * CVD_USABLE_H;
    },
    [maxCvd, cvdRange, CVD_TOP, CVD_USABLE_H],
  );

  const zeroCvdY = useMemo(() => {
    return Math.max(CVD_TOP, Math.min(CVD_TOP + CVD_USABLE_H, cvdToY(0)));
  }, [cvdToY, CVD_TOP, CVD_USABLE_H]);

  const cvdPath = useMemo(() => {
    if (cvdSeries.length === 0) return "";
    return cvdSeries
      .map((val, i) => {
        const x = indexToX(i);
        const y = cvdToY(val);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [cvdSeries, indexToX, cvdToY]);

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

  // Current Price and Market Structure Status (Real-time live exchange quote prioritized)
  const lastClose = liveQuote?.cmp ?? data?.lastClose ?? activeBar?.c ?? null;
  const pocPrice = profile?.poc ?? null;
  const vahPrice = profile?.vah ?? null;
  const valPrice = profile?.val ?? null;

  // Active Auction Bin (bin containing current lastClose)
  const activePriceBinIdx = useMemo(() => {
    if (lastClose === null || !profile?.bins || profile.bins.length === 0) return -1;
    return profile.bins.findIndex((b) => lastClose >= b.lo && lastClose <= b.hi);
  }, [lastClose, profile?.bins]);

  // Price change relative to authentic live quote or first bar in visible range
  const priceChangeStats = useMemo(() => {
    if (
      liveQuote?.change &&
      typeof liveQuote.change.absolute === "number" &&
      typeof liveQuote.change.percent === "number"
    ) {
      return {
        diff: liveQuote.change.absolute,
        pct: liveQuote.change.percent,
        isPositive: liveQuote.change.absolute >= 0,
      };
    }
    if (!bars || bars.length < 2 || lastClose === null) {
      return { diff: 0, pct: 0, isPositive: true };
    }
    const firstBar = bars[0];
    const diff = lastClose - firstBar.o;
    const pct = (diff / firstBar.o) * 100;
    return { diff, pct, isPositive: diff >= 0 };
  }, [liveQuote?.change, bars, lastClose]);

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
    <div className="space-y-3 rounded-none font-sans">
      {/* ========================================================================= */}
      {/* 1. BLOOMBERG LIVE TELEMETRY RIBBON (High-Frequency Real-Time Cockpit Bar) */}
      {/* ========================================================================= */}
      <div className="border border-border bg-surface px-3 py-2 rounded-none shadow-sm flex flex-wrap items-center justify-between gap-3 text-2xs font-mono">
        {/* Left: Active Live Status & Polling Engine */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-surface-raised border border-border px-2 py-0.5 rounded-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-up opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-up"></span>
            </span>
            <span className="font-bold text-foreground tracking-wide">
              LIVE #{pollSeq}
            </span>
          </div>

          <div className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-gold" />
            <span>Synced:</span>
            <span className="text-foreground font-semibold">
              {lastRefreshed.toLocaleTimeString("en-IN")}
            </span>
          </div>

          {autoRefreshSecs > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground bg-surface-muted/60 px-1.5 py-0.5 border border-border/60 rounded-none">
              <span>Next poll:</span>
              <span className="font-bold text-accent">{countdown}s</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse"></span>
            </div>
          )}

          {/* Live Price Flash Pill with Sub-Second Tick Animation */}
          {lastClose !== null && (
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 border font-mono font-bold transition-all duration-200 rounded-none",
                tickFlash === "up"
                  ? "bg-up/25 border-up text-up animate-tick-up shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                  : tickFlash === "down"
                  ? "bg-down/25 border-down text-down animate-tick-down shadow-[0_0_10px_rgba(239,68,68,0.35)]"
                  : priceChangeStats.isPositive
                  ? "bg-up/10 border-up/30 text-up"
                  : "bg-down/10 border-down/30 text-down",
              )}
            >
              <span>{symbol}:</span>
              <span>{fmtINR(lastClose, 2)}</span>
              <span>
                {priceChangeStats.isPositive ? "▲ +" : "▼ "}
                {Math.abs(priceChangeStats.diff).toFixed(2)} ({priceChangeStats.pct >= 0 ? "+" : ""}{priceChangeStats.pct.toFixed(2)}%)
              </span>
            </div>
          )}

          {/* Real-time Day Range & Exchange Quote Provenance */}
          {liveQuote && liveQuote.dayHigh != null && liveQuote.dayLow != null && (
            <div className="hidden xl:flex items-center gap-1.5 text-3xs font-mono text-muted-foreground bg-surface-muted/70 px-2 py-0.5 border border-border/60 rounded-none">
              <span>L: <span className="text-down font-bold">{fmtINR(liveQuote.dayLow, 2)}</span></span>
              <span className="text-border">|</span>
              <span>H: <span className="text-up font-bold">{fmtINR(liveQuote.dayHigh, 2)}</span></span>
              {liveQuote.volume && (
                <>
                  <span className="text-border">|</span>
                  <span>Vol: <span className="text-foreground font-semibold">{fmtCompact(liveQuote.volume)}</span></span>
                </>
              )}
              <span className="text-border">|</span>
              <span className="text-accent font-bold uppercase tracking-wider">{liveQuote.source ?? "NSE"} LIVE</span>
            </div>
          )}

          {/* POC Anchor Pill */}
          {pocPrice !== null && (
            <div className="hidden lg:flex items-center gap-1 text-muted-foreground bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-none">
              <span className="text-gold font-bold">POC:</span>
              <span className="text-foreground font-semibold">{fmtINR(pocPrice)}</span>
              <span className={marketStructure.distancePoc >= 0 ? "text-up" : "text-down"}>
                ({marketStructure.distancePoc >= 0 ? "+" : ""}
                {marketStructure.distancePocPct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Right: Refresh Rate Selectors, Hotkeys & Sync Button */}
        <div className="flex items-center gap-2">
          {/* Polling Interval Selector Chips */}
          <div className="flex items-center border border-border bg-surface-muted rounded-none p-0.5">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground px-1.5 hidden sm:inline">
              Cadence:
            </span>
            {[
              { label: "3s LIVE", val: 3 },
              { label: "5s", val: 5 },
              { label: "10s", val: 10 },
              { label: "30s", val: 30 },
              { label: "Pause", val: 0 },
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setAutoRefreshSecs(opt.val)}
                className={cn(
                  "px-1.5 py-0.5 text-3xs font-mono font-semibold transition-all rounded-none",
                  autoRefreshSecs === opt.val
                    ? "bg-accent text-accent-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Immediate Sync Button */}
          <button
            onClick={() => void refreshLiveProfile(symbol, timeframe, false)}
            disabled={loading || isSyncing}
            className="flex items-center gap-1.5 border border-border bg-surface-raised px-2 py-1 text-2xs font-mono font-semibold text-foreground hover:bg-surface-muted transition-colors rounded-none disabled:opacity-50"
            title="Trigger immediate live synchronization (Space / R)"
          >
            <RefreshCw
              className={cn("h-3 w-3", (loading || isSyncing) && "animate-spin text-accent")}
            />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {/* Hotkey Helper Trigger */}
          <button
            onClick={() => setShowHotkeysModal(true)}
            className="border border-border bg-surface-raised px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors rounded-none"
            title="Keyboard Navigation Shortcuts (?)"
          >
            <Keyboard className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TICKER SELECTOR & VIEW CONTROLS TOOLBAR                               */}
      {/* ========================================================================= */}
      <div className="border border-border bg-surface p-2.5 rounded-none shadow-sm space-y-2">
        {/* Top row: Bellwethers & Custom Search */}
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

          {/* Timeframe Chips */}
          <div className="flex items-center gap-1 bg-surface-muted border border-border p-0.5 rounded-none">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={cn(
                  "px-2 py-0.5 text-2xs font-mono font-semibold transition-all rounded-none",
                  timeframe === tf.id
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

        {/* Bottom row: Search Ticker + Profile Mode & Overlay Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/70 pt-2 text-2xs font-mono text-muted-foreground">
          {/* Custom Ticker Search */}
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
          </form>

          {/* Profile Mode & Overlay Toggles */}
          <div className="flex flex-wrap items-center gap-3">
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
              <span>Sessions</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer text-3xs hover:text-foreground">
              <input
                type="checkbox"
                checked={showCvd}
                onChange={(e) => setShowCvd(e.target.checked)}
                className="accent-accent rounded-none"
              />
              <span className={cn(showCvd && "text-accent font-bold")}>CVD Sub-Pane</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer text-3xs hover:text-foreground">
              <input
                type="checkbox"
                checked={showAbsorption}
                onChange={(e) => setShowAbsorption(e.target.checked)}
                className="accent-gold rounded-none"
              />
              <span className={cn(showAbsorption && "text-gold font-bold")}>Absorption Signals</span>
            </label>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN INTERACTIVE SVG VRVP & CANDLESTICK CANVAS                        */}
      {/* ========================================================================= */}
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
                void refreshLiveProfile("RELIANCE", timeframe);
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
            <span className="text-muted-foreground">
              {fmtDateLabel(activeBar.t, data?.intraday ?? true)}
            </span>
            <span>
              O: <strong>{fmtINR(activeBar.o)}</strong>
            </span>
            <span>
              H: <strong className="text-up">{fmtINR(activeBar.h)}</strong>
            </span>
            <span>
              L: <strong className="text-down">{fmtINR(activeBar.l)}</strong>
            </span>
            <span>
              C:{" "}
              <strong className={activeBar.c >= activeBar.o ? "text-up" : "text-down"}>
                {fmtINR(activeBar.c)}
              </strong>
            </span>
            <span>
              Vol:{" "}
              <strong className={cn("text-gold transition-colors duration-300", volFlash && "bg-gold/20 px-1")}>
                {fmtCompact(activeBar.v)}
              </strong>
            </span>
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
            <span>
              Rows: <strong className="text-foreground">{profile.bins.length}</strong>
            </span>
            <span>
              VA: <strong className="text-accent">70%</strong>
            </span>
            <span>
              POC: <strong className="text-gold font-bold">{fmtINR(profile.poc)}</strong>
            </span>
            <span>
              Total Vol:{" "}
              <strong className={cn("text-foreground transition-colors duration-300", volFlash && "text-gold")}>
                {fmtCompact(profile.total)}
              </strong>
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
                <path
                  d="M 60 0 L 0 0 0 40"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeOpacity="0.5"
                  strokeWidth="0.8"
                />
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
              const isLastBar = i === nBars - 1;
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
                    className={cn(
                      isLastBar && tickFlash === "up" && "animate-tick-up",
                      isLastBar && tickFlash === "down" && "animate-tick-down",
                    )}
                  />

                  {/* Institutional Absorption & Big Volume Trade Markers */}
                  {showAbsorption && data?.absorption && (
                    <>
                      {data.absorption
                        .filter((a) => a.at === i)
                        .map((a, aIdx) => (
                          <g key={`abs-${aIdx}`}>
                            {a.type === "bullish" ? (
                              <g transform={`translate(${xPos}, ${lowY + 9})`}>
                                <path
                                  d="M 0 -4 L 4 3 L -4 3 Z"
                                  fill="hsl(var(--up))"
                                  stroke="hsl(var(--background))"
                                  strokeWidth="0.5"
                                />
                                <text
                                  x={0}
                                  y={10}
                                  fill="hsl(var(--up))"
                                  fontSize="6.5"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  ABS
                                </text>
                              </g>
                            ) : (
                              <g transform={`translate(${xPos}, ${highY - 9})`}>
                                <path
                                  d="M 0 4 L 4 -3 L -4 -3 Z"
                                  fill="hsl(var(--down))"
                                  stroke="hsl(var(--background))"
                                  strokeWidth="0.5"
                                />
                                <text
                                  x={0}
                                  y={-6}
                                  fill="hsl(var(--down))"
                                  fontSize="6.5"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  REJ
                                </text>
                              </g>
                            )}
                          </g>
                        ))}
                    </>
                  )}

                  {showAbsorption && data?.bigTrades && (
                    <>
                      {data.bigTrades
                        .filter((bt) => bt.at === i)
                        .map((bt, bIdx) => (
                          <g key={`bt-${bIdx}`} transform={`translate(${xPos}, ${openY})`}>
                            <rect
                              x={-3}
                              y={-3}
                              width={6}
                              height={6}
                              fill="hsl(var(--gold))"
                              transform="rotate(45)"
                              stroke="hsl(var(--background))"
                              strokeWidth="0.5"
                            />
                          </g>
                        ))}
                    </>
                  )}

                  {/* Active Live Candle Indicator Badge on Latest Bar */}
                  {isLastBar && (
                    <g>
                      <circle
                        cx={xPos}
                        cy={highY - 8}
                        r="3"
                        fill="hsl(var(--gold))"
                        className="animate-ping"
                        opacity="0.8"
                      />
                      <circle cx={xPos} cy={highY - 8} r="2" fill="hsl(var(--gold))" />
                      <text
                        x={xPos}
                        y={highY - 14}
                        fill="hsl(var(--gold))"
                        fontSize="7.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        LIVE
                      </text>
                    </g>
                  )}
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

            {/* =================================================================== */}
            {/* REAL-TIME LIVE MARKET PRICE (LTP) CURSOR BEAM & RADAR BEACON        */}
            {/* =================================================================== */}
            {lastClose !== null && (
              <g>
                {/* Horizontal Live LTP Beam */}
                <line
                  x1={15}
                  y1={priceToY(lastClose)}
                  x2={W - 60}
                  y2={priceToY(lastClose)}
                  stroke={
                    tickFlash === "up"
                      ? "hsl(var(--up))"
                      : tickFlash === "down"
                      ? "hsl(var(--down))"
                      : "hsl(var(--foreground))"
                  }
                  strokeWidth={tickFlash ? "1.8" : "1.2"}
                  strokeDasharray={tickFlash ? "none" : "3 3"}
                  className={cn("transition-colors duration-300", tickFlash && "animate-pulse")}
                />

                {/* Pulsating Radar Beacon at Volume Profile Frontier */}
                <circle
                  cx={profileStartX - 5}
                  cy={priceToY(lastClose)}
                  r="6"
                  className="animate-ping"
                  fill={
                    tickFlash === "up"
                      ? "hsl(var(--up))"
                      : tickFlash === "down"
                      ? "hsl(var(--down))"
                      : "hsl(var(--accent))"
                  }
                  opacity="0.85"
                />
                <circle
                  cx={profileStartX - 5}
                  cy={priceToY(lastClose)}
                  r="3.5"
                  fill="hsl(var(--foreground))"
                />

                {/* Floating POC Distance Pill on Live Beam */}
                {pocPrice !== null && (
                  <g transform={`translate(${CHART_WIDTH - 135}, ${priceToY(lastClose) - 9})`}>
                    <rect
                      x={0}
                      y={0}
                      width={130}
                      height={16}
                      fill="hsl(var(--surface-raised))"
                      stroke="hsl(var(--border))"
                      strokeWidth="0.8"
                    />
                    <text
                      x={5}
                      y={11}
                      fill="hsl(var(--foreground))"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      Δ POC: {lastClose >= pocPrice ? "+" : ""}
                      {(lastClose - pocPrice).toFixed(2)} (
                      {(((lastClose - pocPrice) / pocPrice) * 100).toFixed(2)}%)
                    </text>
                  </g>
                )}
              </g>
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
                const isActiveBin = i === activePriceBinIdx;

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
                      {/* Active Auction Frontier Indicator */}
                      {isActiveBin && (
                        <rect
                          x={profileStartX}
                          y={binTopY}
                          width={PROFILE_WIDTH}
                          height={barH}
                          fill="none"
                          stroke="hsl(var(--accent))"
                          strokeWidth="1.4"
                          strokeDasharray="3 2"
                          className="animate-pulse"
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
                      {isActiveBin && (
                        <rect
                          x={profileStartX}
                          y={binTopY}
                          width={PROFILE_WIDTH * 0.85}
                          height={barH}
                          fill="none"
                          stroke="hsl(var(--accent))"
                          strokeWidth="1.4"
                          strokeDasharray="3 2"
                          className="animate-pulse"
                          rx="0"
                          ry="0"
                        />
                      )}
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
                    <line
                      x1={0}
                      y1={tickY}
                      x2={5}
                      y2={tickY}
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                    />
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
                  <rect
                    x={0}
                    y={-7}
                    width={58}
                    height={14}
                    fill="hsl(var(--accent))"
                    rx="0"
                    ry="0"
                  />
                  <text
                    x={4}
                    y={3}
                    fill="hsl(var(--accent-foreground))"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    VAH {vahPrice.toFixed(2)}
                  </text>
                </g>
              )}

              {/* POC Price Tag */}
              {showPocLine && pocPrice !== null && (
                <g transform={`translate(0, ${priceToY(pocPrice)})`}>
                  <rect
                    x={0}
                    y={-8}
                    width={64}
                    height={16}
                    fill="hsl(var(--gold))"
                    rx="0"
                    ry="0"
                  />
                  <text
                    x={4}
                    y={3.5}
                    fill="hsl(var(--surface-raised))"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    POC {pocPrice.toFixed(2)}
                  </text>
                </g>
              )}

              {/* VAL Price Tag */}
              {showValueArea && valPrice !== null && (
                <g transform={`translate(0, ${priceToY(valPrice)})`}>
                  <rect
                    x={0}
                    y={-7}
                    width={58}
                    height={14}
                    fill="hsl(var(--accent))"
                    rx="0"
                    ry="0"
                  />
                  <text
                    x={4}
                    y={3}
                    fill="hsl(var(--accent-foreground))"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    VAL {valPrice.toFixed(2)}
                  </text>
                </g>
              )}

              {/* Dynamic Live LTP Badge (Flashes with tick updates) */}
              {lastClose !== null && (
                <g transform={`translate(0, ${priceToY(lastClose)})`}>
                  <rect
                    x={0}
                    y={-8}
                    width={68}
                    height={16}
                    fill={
                      tickFlash === "up"
                        ? "hsl(var(--up))"
                        : tickFlash === "down"
                        ? "hsl(var(--down))"
                        : "hsl(var(--foreground))"
                    }
                    className="transition-colors duration-200"
                    rx="0"
                    ry="0"
                  />
                  <text
                    x={4}
                    y={3.5}
                    fill="hsl(var(--background))"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {tickFlash === "up" ? "▲ " : tickFlash === "down" ? "▼ " : ""}LTP {lastClose.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
            {/* =================================================================== */}
            {/* CVD (CUMULATIVE VOLUME DELTA) SUB-PANE                             */}
            {/* =================================================================== */}
            {showCvd && cvdSeries.length > 0 && (
              <g>
                {/* Sub-pane separator */}
                <line
                  x1={15}
                  y1={CVD_TOP - 15}
                  x2={CHART_WIDTH + 15}
                  y2={CVD_TOP - 15}
                  stroke="hsl(var(--border))"
                  strokeWidth="1.2"
                />

                {/* Sub-pane Title */}
                <text
                  x={20}
                  y={CVD_TOP - 3}
                  fill="hsl(var(--muted-foreground))"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  CUMULATIVE VOLUME DELTA (CVD) · INTRADAY NET AGGRESSION
                </text>

                {/* Zero Delta Baseline */}
                <line
                  x1={15}
                  y1={zeroCvdY}
                  x2={CHART_WIDTH + 15}
                  y2={zeroCvdY}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={CHART_WIDTH + 10}
                  y={zeroCvdY - 2}
                  fill="hsl(var(--muted-foreground))"
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  0
                </text>

                {/* CVD Curve Line */}
                <path
                  d={cvdPath}
                  fill="none"
                  stroke={
                    cvdSeries[cvdSeries.length - 1] >= 0
                      ? "hsl(var(--up))"
                      : "hsl(var(--down))"
                  }
                  strokeWidth="1.6"
                />

                {/* Live Current CVD Dot */}
                {cvdSeries.length > 0 && (
                  <circle
                    cx={indexToX(cvdSeries.length - 1)}
                    cy={cvdToY(cvdSeries[cvdSeries.length - 1])}
                    r="3.5"
                    fill={
                      cvdSeries[cvdSeries.length - 1] >= 0
                        ? "hsl(var(--up))"
                        : "hsl(var(--down))"
                    }
                    className="animate-ping"
                    opacity="0.8"
                  />
                )}

                {/* Crosshair Dot on CVD when Bar is Hovered */}
                {hoverBarIdx !== null && cvdSeries[hoverBarIdx] !== undefined && (
                  <g>
                    <circle
                      cx={indexToX(hoverBarIdx)}
                      cy={cvdToY(cvdSeries[hoverBarIdx])}
                      r="4"
                      fill="hsl(var(--foreground))"
                      stroke="hsl(var(--background))"
                      strokeWidth="1"
                    />
                    <g transform={`translate(${indexToX(hoverBarIdx) + 6}, ${cvdToY(cvdSeries[hoverBarIdx]) - 5})`}>
                      <rect x={0} y={-8} width={64} height={14} fill="hsl(var(--surface-raised))" stroke="hsl(var(--border))" strokeWidth="0.8" />
                      <text x={3} y={2.5} fill="hsl(var(--foreground))" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                        {fmtCompact(cvdSeries[hoverBarIdx])}
                      </text>
                    </g>
                  </g>
                )}
              </g>
            )}

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
                <span>
                  Total:{" "}
                  <strong className="text-foreground">
                    {fmtCompact(profile.bins[hoverBinIdx].v)}
                  </strong>
                </span>
                <span>
                  Buy:{" "}
                  <strong className="text-gold">
                    {fmtCompact(profile.bins[hoverBinIdx].buy)}
                  </strong>
                </span>
                <span>
                  Sell:{" "}
                  <strong className="text-accent">
                    {fmtCompact(profile.bins[hoverBinIdx].sell)}
                  </strong>
                </span>
                <span>
                  Δ:{" "}
                  <strong
                    className={
                      profile.bins[hoverBinIdx].delta >= 0 ? "text-up" : "text-down"
                    }
                  >
                    {fmtCompact(profile.bins[hoverBinIdx].delta)}
                  </strong>
                </span>
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
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-up animate-ping" />
              <span className="text-foreground font-semibold">Live LTP Cursor</span>
            </span>
          </div>

          <div className="text-3xs text-muted-foreground">
            Window: {bars.length} {data?.intervalLabel ?? timeframe} bars · Razor-sharp Bloomberg geometry
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MICROSTRUCTURE AUCTION HUD & VOLUMETRIC METRICS (4 Bloomberg Tiles)    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Regime Status Card */}
        <div className="border border-border bg-surface p-3 rounded-none space-y-1.5 font-sans">
          <div className="flex items-center justify-between text-2xs font-mono uppercase tracking-wider text-muted-foreground">
            <span>Market Regime</span>
            <span className="text-3xs">Auction Theory</span>
          </div>
          <div>
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-mono font-bold rounded-none border",
                marketStructure.badgeBg,
              )}
            >
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
            <span>Point of Control</span>
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
            POC acts as the high-liquidity magnetic attractor during rotational auction phases.
          </div>
        </div>

        {/* Volume Nodes (HVN vs LVN) */}
        <div className="border border-border bg-surface p-3 rounded-none space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-muted-foreground">
            <span>Volume Nodes</span>
            <span className="text-accent text-3xs">Liquidity Shelf</span>
          </div>
          <div className="space-y-1 text-2xs">
            <div className="flex items-center justify-between">
              <span className="text-up font-semibold">HVN (Absorption Shelf):</span>
              <span className="text-foreground font-bold">
                {hvnBin ? fmtINR(hvnBin.mid) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-down font-semibold">LVN (Fast Vacuum):</span>
              <span className="text-foreground font-bold">
                {lvnBin ? fmtINR(lvnBin.mid) : "—"}
              </span>
            </div>
          </div>
          <div className="text-3xs text-muted-foreground leading-tight">
            HVN reflects strong two-sided liquidity; LVN is a low-volume void vulnerable to fast runs.
          </div>
        </div>

        {/* Live Delta & Auction Velocity */}
        <div className="border border-border bg-surface p-3 rounded-none space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-muted-foreground">
            <span>Auction Velocity</span>
            <span className="text-gold text-3xs">Order-Flow Flow</span>
          </div>
          <div className="space-y-1 text-2xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Latest Bar Delta:</span>
              <span
                className={cn(
                  "font-bold",
                  activeBar && activeBar.delta >= 0 ? "text-up" : "text-down",
                )}
              >
                {activeBar && activeBar.delta >= 0 ? "+" : ""}
                {activeBar ? fmtCompact(activeBar.delta) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cumulative Delta (CVD):</span>
              <span
                className={cn(
                  "font-bold",
                  data?.cvd && data.cvd.length > 0 && data.cvd[data.cvd.length - 1] >= 0
                    ? "text-up"
                    : "text-down",
                )}
              >
                {data?.cvd && data.cvd.length > 0
                  ? fmtCompact(data.cvd[data.cvd.length - 1])
                  : "—"}
              </span>
            </div>
          </div>
          <div className="text-3xs text-muted-foreground leading-tight">
            Real-time delta indicates aggressive market order pressure versus passive limit absorption.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. KEYBOARD HOTKEYS MODAL                                                 */}
      {/* ========================================================================= */}
      {showHotkeysModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowHotkeysModal(false)}
        >
          <div
            className="w-full max-w-md border border-border bg-surface p-5 rounded-none shadow-xl space-y-4 font-mono text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-accent" />
                <h3 className="font-bold text-foreground text-sm">VRVP Cockpit Hotkeys</h3>
              </div>
              <button
                onClick={() => setShowHotkeysModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-2xs">
              <div className="flex items-center justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Live Instant Sync</span>
                <kbd className="border border-border bg-surface-raised px-1.5 py-0.5 font-bold text-foreground">
                  Space / R
                </kbd>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Timeframe: 1m / 5m / 15m / 1h / 1d</span>
                <kbd className="border border-border bg-surface-raised px-1.5 py-0.5 font-bold text-foreground">
                  1 / 2 / 3 / 4 / 5
                </kbd>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Toggle Profile / Delta Mode</span>
                <kbd className="border border-border bg-surface-raised px-1.5 py-0.5 font-bold text-foreground">
                  P
                </kbd>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Toggle CVD Sub-Pane</span>
                <kbd className="border border-border bg-surface-raised px-1.5 py-0.5 font-bold text-foreground">
                  C
                </kbd>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Toggle Absorption Signals</span>
                <kbd className="border border-border bg-surface-raised px-1.5 py-0.5 font-bold text-foreground">
                  A
                </kbd>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Cycle Bellwether Stocks</span>
                <kbd className="border border-border bg-surface-raised px-1.5 py-0.5 font-bold text-foreground">
                  [ / ]
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Toggle this hotkey reference</span>
                <kbd className="border border-border bg-surface-raised px-1.5 py-0.5 font-bold text-foreground">
                  ?
                </kbd>
              </div>
            </div>

            <div className="border-t border-border pt-3 text-right">
              <button
                onClick={() => setShowHotkeysModal(false)}
                className="border border-border bg-surface-raised px-3 py-1 text-2xs text-foreground hover:bg-surface-muted transition-colors rounded-none"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
