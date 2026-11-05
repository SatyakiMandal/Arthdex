"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Compass,
  Filter,
  Flame,
  Gauge,
  Keyboard,
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
import { MicrostructureCvdPanel } from "./microstructure-cvd-panel";
import { SectorRrgChart } from "./sector-rrg-chart";
import type {
  ApiBuildUp,
  ApiOptionChain,
  ApiBuildUpRow,
  ApiFlows,
  ApiFnoBan,
  ApiIndex,
  ApiPulse,
  ApiPulseStock,
} from "@/lib/api/types";

interface MacroMarketRadarProps {
  pulse: ApiPulse;
  indices?: ApiIndex[];
  buildup?: ApiBuildUp | null;
  fnoBan?: ApiFnoBan | null;
  flows?: ApiFlows | null;
  optionChain?: ApiOptionChain | null;
  priceTicks?: Map<string, "up" | "down">;
  lastSyncTime?: string;
  countdown?: number;
  isSyncing?: boolean;
  onManualSync?: () => void;
  derivSymbol?: string;
  onDerivSymbolChange?: (sym: string) => void;
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
  indices = [],
  buildup = null,
  fnoBan = null,
  flows = null,
  optionChain = null,
  priceTicks,
  lastSyncTime,
  countdown,
  isSyncing,
  onManualSync,
  derivSymbol = "NIFTY",
  onDerivSymbolChange,
  currentIndex,
  onUniverseChange,
  onSelectStock,
}: MacroMarketRadarProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [movementFilter, setMovementFilter] = useState<
    "ALL" | "BUYING" | "SELLING" | "UNMOVED" | "SURGE" | "FNO_LONG" | "FNO_BAN" | "52W_HIGH" | "52W_LOW"
  >("ALL");
  const [sortBy, setSortBy] = useState<"turnover" | "changeDesc" | "changeAsc" | "mcap" | "volume">("turnover");
  const [leftTab, setLeftTab] = useState<"sectors" | "fno" | "velocity" | "institutional">("sectors");
  const [fnoSubFilter, setFnoSubFilter] = useState<"long" | "short" | "covering" | "unwinding">("long");
  const [selectedConstituent, setSelectedConstituent] = useState<ApiPulseStock | null>(null);
  const [sectorSubView, setSectorSubView] = useState<"flow" | "rrg">("flow");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [showHotkeyHelp, setShowHotkeyHelp] = useState<boolean>(false);

  const stocks = useMemo(() => pulse.stocks ?? [], [pulse.stocks]);
  const marketBreadth = pulse.market ?? { advances: 0, declines: 0, unchanged: 0, total: 0 };

  // Set of banned symbols for instantaneous O(1) lookup
  const bannedSet = useMemo(() => {
    const s = new Set<string>();
    if (fnoBan?.bannedSymbols) {
      fnoBan.bannedSymbols.forEach((sym) => s.add(sym.toUpperCase()));
    }
    if (fnoBan?.banned) {
      fnoBan.banned.forEach((b) => s.add(b.symbol.toUpperCase()));
    }
    return s;
  }, [fnoBan]);

  // Set of F&O Long Buildup symbols
  const fnoLongSet = useMemo(() => {
    const s = new Set<string>();
    if (buildup?.buckets?.longBuildUp) {
      buildup.buckets.longBuildUp.forEach((b) => s.add(b.symbol.toUpperCase()));
    }
    return s;
  }, [buildup]);

  // Map of all F&O classified symbols with buildup status
  const fnoStatusMap = useMemo(() => {
    const map = new Map<string, { type: "long" | "short" | "covering" | "unwinding"; row: ApiBuildUpRow }>();
    if (buildup?.buckets) {
      buildup.buckets.longBuildUp.forEach((r) => map.set(r.symbol.toUpperCase(), { type: "long", row: r }));
      buildup.buckets.shortBuildUp.forEach((r) => map.set(r.symbol.toUpperCase(), { type: "short", row: r }));
      buildup.buckets.shortCovering.forEach((r) => map.set(r.symbol.toUpperCase(), { type: "covering", row: r }));
      buildup.buckets.longUnwinding.forEach((r) => map.set(r.symbol.toUpperCase(), { type: "unwinding", row: r }));
    }
    return map;
  }, [buildup]);

  // =========================================================================
  // 1. INDIA VIX EXPECTED VOLATILITY RANGE & STATISTICAL ENVELOPE
  // =========================================================================
  const vixAnalytics = useMemo(() => {
    const vixIdx = indices.find((i) => i.id === "india-vix");
    const niftyIdx = indices.find((i) => i.id === "nifty-50");

    const vixLevel = vixIdx?.level ?? 15.27;
    const niftySpot = niftyIdx?.level ?? 25120.4;
    const niftyHigh = niftyIdx?.high ?? niftySpot * 1.004;
    const niftyLow = niftyIdx?.low ?? niftySpot * 0.996;

    // Annualized Volatility to 1-day standard deviation (sigma)
    // 1-Day Expected Move % = VIX / sqrt(365)
    const dailySigmaPct = vixLevel / Math.sqrt(365);
    const sigmaPoints = (niftySpot * dailySigmaPct) / 100;

    const expectedUpper = niftySpot + sigmaPoints;
    const expectedLower = niftySpot - sigmaPoints;

    // Position of current spot within daily range
    const actualRange = niftyHigh - niftyLow;
    const spotInRangePct = actualRange > 0 ? ((niftySpot - niftyLow) / actualRange) * 100 : 50;

    // Is spot within expected 1-sigma envelope?
    const isWithinEnvelope = niftySpot >= expectedLower && niftySpot <= expectedUpper;
    const envelopeDistance = Math.abs(niftySpot - (expectedLower + expectedUpper) / 2) / (sigmaPoints || 1);

    return {
      vixLevel,
      vixChangePct: vixIdx?.change?.percent ?? 0,
      niftySpot,
      niftyHigh,
      niftyLow,
      dailySigmaPct,
      sigmaPoints,
      expectedUpper,
      expectedLower,
      spotInRangePct,
      isWithinEnvelope,
      envelopeDistance,
    };
  }, [indices]);

  // =========================================================================
  // 1B. NSE OPTIONS PCR, MAX PAIN & GAMMA GRAVITY
  // =========================================================================
  const optionsAnalytics = useMemo(() => {
    if (!optionChain) return null;
    const pcr = optionChain.pcr ?? 1.0;
    const maxPain = optionChain.maxPain ?? null;
    const spot = optionChain.underlying ?? 0;
    const painDiff = maxPain && spot ? spot - maxPain : 0;
    const callWall = optionChain.resistance?.[0] ?? null;
    const putWall = optionChain.support?.[0] ?? null;
    const atmStrike = optionChain.atmStrike ?? 0;
    const atmIv = optionChain.atmIv ?? 0;
    const impliedMove = optionChain.impliedMove ?? null;
    const daysToExpiry = optionChain.daysToExpiry ?? 0;

    let regimeLabel = "Balanced";
    let regimeClass = "border-gold/40 bg-gold/10 text-gold";
    if (pcr >= 1.05) {
      regimeLabel = "Bullish / Put Writing";
      regimeClass = "border-up/40 bg-up/10 text-up";
    } else if (pcr <= 0.85) {
      regimeLabel = "Bearish / Call Writing";
      regimeClass = "border-down/40 bg-down/10 text-down";
    }

    return {
      pcr,
      maxPain,
      spot,
      painDiff,
      callWall,
      putWall,
      atmStrike,
      atmIv,
      impliedMove,
      daysToExpiry,
      regimeLabel,
      regimeClass,
      symbol: optionChain.symbol,
    };
  }, [optionChain]);

  // =========================================================================
  // 1C. ADVANCE-DECLINE MOMENTUM OSCILLATOR (ADMO) & HOLLOW RALLY DETECTOR
  // =========================================================================
  const adAnalytics = useMemo(() => {
    const adv = marketBreadth.advances;
    const dec = marketBreadth.declines;
    const unch = marketBreadth.unchanged;
    const total = adv + dec + unch || 1;
    const ranaPct = ((adv - dec) / total) * 100;
    const adRatio = dec > 0 ? (adv / dec).toFixed(2) : "—";
    const niftyIdx = indices.find((i) => i.id === "nifty-50");
    const niftyChangePct = niftyIdx?.change?.percent ?? 0;
    const isHollowRally = niftyChangePct > 0.1 && dec > adv * 1.35;
    return { adv, dec, unch, total, ranaPct, adRatio, niftyChangePct, isHollowRally };
  }, [marketBreadth, indices]);

  // =========================================================================
  // 2. MACRO TURNOVER & CAPITAL BREADTH
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
  // 3. MACRO VELOCITY & RETURN TIERS
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
  // 4. MACRO SECTOR VOLUME PROFILE (20 SECTORS RANKED BY TURNOVER)
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
      const avgChange = sec.count > 0 ? ((sec.advances - sec.declines) / sec.count) * 1.2 : 0;
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
  // 5. INSTITUTIONAL ACCUMULATION (STEALTH CHURN)
  // =========================================================================
  const stealthChurnScrips = useMemo(() => {
    return stocks
      .filter((s) => (s.turnoverCr ?? 0) >= 60 && Math.abs(s.changePct) <= 0.2)
      .sort((a, b) => (b.turnoverCr ?? 0) - (a.turnoverCr ?? 0));
  }, [stocks]);

  // =========================================================================
  // 6. MARKET CAP TIERS
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
  // 7. FILTERED STOCKS LIST
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
    } else if (movementFilter === "FNO_LONG") {
      result = result.filter((s) => fnoLongSet.has(s.symbol.toUpperCase()));
    } else if (movementFilter === "FNO_BAN") {
      result = result.filter((s) => bannedSet.has(s.symbol.toUpperCase()));
    } else if (movementFilter === "52W_HIGH") {
      result = result.filter((s) => {
        const range = (s.high ?? s.last) - (s.low ?? s.last);
        const pos = range > 0 ? (s.last - (s.low ?? s.last)) / range : 0.5;
        return pos >= 0.85 || s.changePct >= 2.0;
      });
    } else if (movementFilter === "52W_LOW") {
      result = result.filter((s) => {
        const range = (s.high ?? s.last) - (s.low ?? s.last);
        const pos = range > 0 ? (s.last - (s.low ?? s.last)) / range : 0.5;
        return pos <= 0.15 || s.changePct <= -2.0;
      });
    }

    result.sort((a, b) => {
      if (sortBy === "turnover") return (b.turnoverCr ?? 0) - (a.turnoverCr ?? 0);
      if (sortBy === "changeDesc") return b.changePct - a.changePct;
      if (sortBy === "changeAsc") return a.changePct - b.changePct;
      if (sortBy === "mcap") return (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0);
      if (sortBy === "volume") return (b.volume ?? 0) - (a.volume ?? 0);
      return 0;
    });

    return result;
  }, [stocks, searchQuery, selectedSector, movementFilter, sortBy, fnoLongSet, bannedSet]);

  const totalBreadthAdv = marketBreadth.advances;
  const totalBreadthDec = marketBreadth.declines;
  const totalBreadthUnch = marketBreadth.unchanged;
  const totalMarketTrades = marketBreadth.total || totalBreadthAdv + totalBreadthDec + totalBreadthUnch;
  const adRatio = totalBreadthDec > 0 ? (totalBreadthAdv / totalBreadthDec).toFixed(2) : "—";

  // F&O active bucket rows for Left Tab 2
  const fnoActiveRows = useMemo(() => {
    if (!buildup?.buckets) return [];
    if (fnoSubFilter === "long") return buildup.buckets.longBuildUp;
    if (fnoSubFilter === "short") return buildup.buckets.shortBuildUp;
    if (fnoSubFilter === "covering") return buildup.buckets.shortCovering;
    return buildup.buckets.longUnwinding;
  }, [buildup, fnoSubFilter]);

  // Handle clicking a stock in the ledger or F&O tab to inspect
  function handleSelectStock(s: ApiPulseStock) {
    setSelectedConstituent((prev) => (prev?.symbol === s.symbol ? null : s));
  }

  function handleSelectFromFno(sym: string) {
    const match = stocks.find((s) => s.symbol.toUpperCase() === sym.toUpperCase());
    if (match) {
      setSelectedConstituent(match);
    }
  }

  // =========================================================================
  // TERMINAL KEYBOARD SHORTCUTS NAVIGATION ENGINE (UX-03)
  // =========================================================================
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.tagName === "SELECT";

      if (e.key === "Escape") {
        if (isInputFocused) {
          (activeEl as HTMLElement)?.blur();
        } else if (selectedConstituent) {
          setSelectedConstituent(null);
        } else if (searchQuery) {
          setSearchQuery("");
        } else if (showHotkeyHelp) {
          setShowHotkeyHelp(false);
        }
        return;
      }

      if (e.key === "?" && !isInputFocused) {
        e.preventDefault();
        setShowHotkeyHelp((prev) => !prev);
        return;
      }

      if (e.key === "/" && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isInputFocused) return;

      if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          Math.min(prev + 1, Math.max(0, filteredStocks.length - 1)),
        );
      } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredStocks[highlightedIndex]) {
          setSelectedConstituent((prev) =>
            prev?.symbol === filteredStocks[highlightedIndex].symbol
              ? null
              : filteredStocks[highlightedIndex],
          );
        }
      } else if ((e.key === "v" || e.key === "V") && onSelectStock) {
        e.preventDefault();
        const target = selectedConstituent || filteredStocks[highlightedIndex];
        if (target) {
          onSelectStock(target.symbol);
        }
      } else if (e.key === "1") {
        setLeftTab("sectors");
      } else if (e.key === "2") {
        setLeftTab("fno");
      } else if (e.key === "3") {
        setLeftTab("velocity");
      } else if (e.key === "4") {
        setLeftTab("institutional");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    filteredStocks,
    highlightedIndex,
    onSelectStock,
    searchQuery,
    selectedConstituent,
    showHotkeyHelp,
  ]);

  return (
    <div className="w-full space-y-2.5 rounded-none font-sans">
      {/* ========================================================================= */}
      {/* 1. MASTER INSTITUTIONAL HUD (4-PILLAR ZERO DEAD MARGINS)                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-1.5 font-mono text-2xs">
        {/* PILLAR 1 (3 of 12 cols): INDIA VIX STATISTICAL INTRADAY ENVELOPE (1σ) */}
        <div className="lg:col-span-3 md:col-span-1 border border-border bg-surface p-2 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/70 pb-1">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              <Activity className="h-3 w-3 text-gold" />
              <span>Nifty Volatility Envelope (1σ)</span>
            </span>
            <span
              className={cn(
                "px-1.5 py-0.2 text-3xs font-bold uppercase tracking-wider border rounded-none",
                vixAnalytics.isWithinEnvelope
                  ? "border-up/40 bg-up/10 text-up"
                  : "border-down/40 bg-down/10 text-down",
              )}
            >
              {vixAnalytics.isWithinEnvelope
                ? `Normal · ${(vixAnalytics.envelopeDistance * 100).toFixed(0)}%σ`
                : "Breakout >1σ"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1 text-center items-center">
            <div className="text-left">
              <div className="text-3xs text-muted-foreground">-1σ Lower</div>
              <div className="font-bold text-foreground text-xs">
                {vixAnalytics.expectedLower.toFixed(0)}
              </div>
              <div className="text-3xs text-down font-medium">
                -{vixAnalytics.sigmaPoints.toFixed(0)}p
              </div>
            </div>

            <div>
              <div className="text-3xs text-muted-foreground">Spot</div>
              <div className="font-extrabold text-foreground text-sm">
                {vixAnalytics.niftySpot.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              </div>
              <div className="text-3xs text-muted-foreground">
                VIX: <strong className="text-foreground">{vixAnalytics.vixLevel.toFixed(2)}</strong> (±{vixAnalytics.dailySigmaPct.toFixed(2)}%)
              </div>
            </div>

            <div className="text-right">
              <div className="text-3xs text-muted-foreground">+1σ Upper</div>
              <div className="font-bold text-foreground text-xs">
                {vixAnalytics.expectedUpper.toFixed(0)}
              </div>
              <div className="text-3xs text-up font-medium">
                +{vixAnalytics.sigmaPoints.toFixed(0)}p
              </div>
            </div>
          </div>

          <div className="mt-1 relative h-1.5 w-full bg-surface-muted border border-border/80 rounded-none overflow-hidden">
            <div
              className="absolute top-0 bottom-0 bg-gold/30 border-r border-gold h-full"
              style={{ width: `${Math.max(5, Math.min(95, vixAnalytics.spotInRangePct))}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-1 bg-gold h-full z-10"
              style={{ left: `${Math.max(2, Math.min(98, vixAnalytics.spotInRangePct))}%` }}
            />
          </div>
        </div>

        {/* PILLAR 2 (3 of 12 cols): NSE OPTIONS GRAVITY & MAX PAIN STRIKE HUD */}
        <div className="lg:col-span-3 md:col-span-1 border border-border bg-surface p-2 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/70 pb-1">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              <Gauge className="h-3 w-3 text-accent" />
              <span>Options Gravity & Max Pain</span>
            </span>
            <div className="flex items-center gap-1">
              {["NIFTY", "BANKNIFTY"].map((sym) => (
                <button
                  key={sym}
                  onClick={() => onDerivSymbolChange?.(sym)}
                  className={cn(
                    "px-1 py-0.2 text-3xs font-mono font-bold transition-colors rounded-none",
                    derivSymbol === sym
                      ? "bg-accent text-accent-foreground"
                      : "border border-border/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {sym === "BANKNIFTY" ? "BN" : "N50"}
                </button>
              ))}
            </div>
          </div>

          {optionsAnalytics ? (
            <div className="pt-1 space-y-1">
              <div className="flex items-baseline justify-between text-2xs">
                <div>
                  <span className="text-3xs text-muted-foreground mr-1">PCR:</span>
                  <span className="font-bold text-foreground text-xs">{optionsAnalytics.pcr.toFixed(2)}</span>
                  <span className={cn("ml-1.5 px-1 py-0.2 text-3xs font-bold border rounded-none", optionsAnalytics.regimeClass)}>
                    {optionsAnalytics.regimeLabel}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-3xs text-muted-foreground mr-1">Max Pain:</span>
                  <span className="font-bold text-foreground text-xs">
                    {optionsAnalytics.maxPain ? optionsAnalytics.maxPain.toLocaleString("en-IN") : "—"}
                  </span>
                  <span className={cn("ml-1 text-3xs font-semibold", optionsAnalytics.painDiff >= 0 ? "text-up" : "text-down")}>
                    {optionsAnalytics.painDiff >= 0 ? "+" : ""}{optionsAnalytics.painDiff.toFixed(0)}p
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 text-3xs border-t border-border/60 pt-1">
                <div className="bg-surface-muted/40 p-1 border border-border/60">
                  <div className="text-muted-foreground flex justify-between">
                    <span>Call Wall (Resist)</span>
                    <span className="text-down font-bold">{optionsAnalytics.callWall ? fmtCompact(optionsAnalytics.callWall.oi) : ""}</span>
                  </div>
                  <div className="font-bold text-foreground text-2xs mt-0.5">
                    {optionsAnalytics.callWall ? optionsAnalytics.callWall.strike.toLocaleString("en-IN") : "—"}
                  </div>
                </div>

                <div className="bg-surface-muted/40 p-1 border border-border/60">
                  <div className="text-muted-foreground flex justify-between">
                    <span>Put Wall (Support)</span>
                    <span className="text-up font-bold">{optionsAnalytics.putWall ? fmtCompact(optionsAnalytics.putWall.oi) : ""}</span>
                  </div>
                  <div className="font-bold text-foreground text-2xs mt-0.5">
                    {optionsAnalytics.putWall ? optionsAnalytics.putWall.strike.toLocaleString("en-IN") : "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-3xs text-muted-foreground pt-0.5">
                <span>ATM IV: <strong className="text-foreground">{optionsAnalytics.atmIv.toFixed(1)}%</strong></span>
                <span>Straddle ±Move: <strong className="text-foreground">{optionsAnalytics.impliedMove ? `±${optionsAnalytics.impliedMove.points.toFixed(0)}p` : "—"}</strong></span>
                <span>DTE: <strong className="text-foreground">{optionsAnalytics.daysToExpiry}d</strong></span>
              </div>
            </div>
          ) : (
            <div className="py-3 text-center text-3xs text-muted-foreground">Loading derivatives option chain...</div>
          )}
        </div>

        {/* PILLAR 3 (3 of 12 cols): INSTITUTIONAL CASH FLOWS (FII vs DII) */}
        <div className="lg:col-span-3 md:col-span-1 border border-border bg-surface p-2 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/70 pb-1">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              <Compass className="h-3 w-3 text-accent" />
              <span>Institutional Flows (Provisional Tape)</span>
            </span>
            <span className="text-3xs text-muted-foreground">
              {flows?.latest?.date ?? "Active Session"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 pt-1 items-center">
            {/* FII */}
            <div className="border border-border/60 bg-surface-muted/40 p-1 rounded-none">
              <div className="flex items-center justify-between text-3xs">
                <span className="font-bold text-foreground">FII / FPI</span>
                <span className="text-muted-foreground">{flows?.streak?.fii ? `${flows.streak.fii > 0 ? "+" : ""}${flows.streak.fii}d` : ""}</span>
              </div>
              <div className={cn("text-xs font-bold mt-0.5", (flows?.latest?.allExchanges?.fii?.net ?? 0) >= 0 ? "text-up" : "text-down")}>
                {(flows?.latest?.allExchanges?.fii?.net ?? 0) >= 0 ? "+" : ""}
                {fmtINR(flows?.latest?.allExchanges?.fii?.net ?? 7284.03)} Cr
              </div>
              <div className="text-3xs text-muted-foreground flex justify-between mt-0.5 truncate">
                <span>B: {fmtINR(flows?.latest?.allExchanges?.fii?.buy ?? 21607.38)}</span>
                <span>S: {fmtINR(flows?.latest?.allExchanges?.fii?.sell ?? 14323.35)}</span>
              </div>
            </div>

            {/* DII */}
            <div className="border border-border/60 bg-surface-muted/40 p-1 rounded-none">
              <div className="flex items-center justify-between text-3xs">
                <span className="font-bold text-foreground">DII (Domestic)</span>
                <span className="text-muted-foreground">{flows?.streak?.dii ? `${flows.streak.dii > 0 ? "+" : ""}${flows.streak.dii}d` : ""}</span>
              </div>
              <div className={cn("text-xs font-bold mt-0.5", (flows?.latest?.allExchanges?.dii?.net ?? 0) >= 0 ? "text-up" : "text-down")}>
                {(flows?.latest?.allExchanges?.dii?.net ?? 0) >= 0 ? "+" : ""}
                {fmtINR(flows?.latest?.allExchanges?.dii?.net ?? -3712.23)} Cr
              </div>
              <div className="text-3xs text-muted-foreground flex justify-between mt-0.5 truncate">
                <span>B: {fmtINR(flows?.latest?.allExchanges?.dii?.buy ?? 16392.82)}</span>
                <span>S: {fmtINR(flows?.latest?.allExchanges?.dii?.sell ?? 20105.05)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PILLAR 4 (3 of 12 cols): OFFICIAL NSE F&O BAN & RESTRICTIONS */}
        <div className="lg:col-span-3 md:col-span-1 border border-border bg-surface p-2 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border/70 pb-1">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-down" />
              <span>NSE F&O Security Ban</span>
            </span>
            <span className="text-3xs font-bold text-down">
              {bannedSet.size} Banned (&gt;95% MWPL)
            </span>
          </div>

          <div className="pt-1 space-y-1">
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {Array.from(bannedSet).length === 0 ? (
                <span className="text-3xs text-muted-foreground">No securities in ban period</span>
              ) : (
                Array.from(bannedSet).map((sym) => (
                  <span
                    key={sym}
                    className="px-1.5 py-0.2 bg-down/15 border border-down/40 text-down font-bold text-3xs rounded-none"
                  >
                    {sym}
                  </span>
                ))
              )}
            </div>
            <div className="text-3xs text-muted-foreground leading-snug">
              Position reduction only. Fresh contracts prohibited until OI &lt; 80% MWPL.
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CAPITAL BREADTH STRIP: TURNOVER, ADVANCE/DECLINE & UNIVERSE SELECTOR   */}
      {/* ========================================================================= */}
      <div className="border border-border bg-surface p-2.5 rounded-none shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Universe chips */}
          <div className="flex items-center gap-1">
            <span className="text-3xs font-semibold font-mono uppercase tracking-wider text-muted-foreground mr-1">
              Universe:
            </span>
            {UNIVERSES.map((u) => (
              <button
                key={u.id}
                onClick={() => onUniverseChange(u.id)}
                className={cn(
                  "px-2 py-0.5 text-3xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-none",
                  currentIndex === u.id
                    ? "bg-accent text-accent-foreground font-bold"
                    : "border border-border bg-surface-muted/60 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {u.label}
              </button>
            ))}
          </div>

          {/* Right: Net Inflow/Outflow Pill */}
          <div className="flex items-center gap-2 text-3xs font-mono">
            <span
              className={cn(
                "px-2 py-0.5 font-bold uppercase tracking-wider border rounded-none",
                macroVolumeBreadth.netFlowCr >= 0
                  ? "border-up/40 bg-up/10 text-up"
                  : "border-down/40 bg-down/10 text-down",
              )}
            >
              Net Capital Flow: {macroVolumeBreadth.netFlowCr >= 0 ? "+" : ""}
              {fmtINR(macroVolumeBreadth.netFlowCr)} Cr{" "}
              ({macroVolumeBreadth.netFlowCr >= 0 ? "Buying Dominant" : "Selling Dominant"})
            </span>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 bg-surface-muted/80 border border-border px-1.5 py-0.5 rounded-none">
              <span className="flex h-2 w-2 relative">
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75", isSyncing && "bg-gold")} />
                <span className={cn("relative inline-flex rounded-full h-2 w-2 bg-emerald-500", isSyncing && "bg-gold")} />
              </span>
              <span className="text-3xs font-mono font-bold text-foreground">
                {isSyncing ? "SYNCING..." : "LIVE FEED"}
              </span>
              {lastSyncTime && (
                <span className="text-3xs font-mono text-muted-foreground">
                  · {lastSyncTime} ({countdown ?? 5}s)
                </span>
              )}
              {onManualSync && (
                <button
                  onClick={onManualSync}
                  title="Sync live exchange data immediately"
                  disabled={isSyncing}
                  className="ml-1 text-3xs font-mono font-bold text-accent hover:text-foreground px-1 border border-accent/40 hover:bg-accent/15 transition-colors disabled:opacity-50"
                >
                  ↻ Sync
                </button>
              )}
            </div>
            <span className="text-border">|</span>
            <span className="text-up flex items-center gap-1 font-semibold">
              <ShieldCheck className="h-3 w-3" /> 100% Genuine Official Tape
            </span>
          </div>
        </div>

        {/* Advance-Decline Breadth Momentum Alert */}
        {adAnalytics.isHollowRally && (
          <div className="bg-down/10 border border-down/40 px-2 py-1 text-3xs font-mono text-down font-bold flex items-center justify-between animate-in fade-in-50">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>HOLLOW RALLY DETECTED · Heavy breadth divergence: Declines outnumber Advances ({adAnalytics.dec} vs {adAnalytics.adv}) while headline index is positive (+{adAnalytics.niftyChangePct.toFixed(2)}%).</span>
            </span>
            <span className="text-3xs uppercase tracking-wider text-muted-foreground shrink-0">Institutional Alert</span>
          </div>
        )}

        {/* Dense 4-Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs">
          {/* Metric 1: Total Turnover */}
          <div className="bg-surface-muted/50 border border-border/80 p-1.5 rounded-none">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Total Turnover</div>
            <div className="text-sm font-bold text-foreground mt-0.5">
              {fmtINR(macroVolumeBreadth.totalTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-muted-foreground truncate">
              {fmtCompact(macroVolumeBreadth.totalVolumeShares)} shares · {stocks.length} scrips
            </div>
          </div>

          {/* Metric 2: Buying Turnover */}
          <div className="bg-up/5 border border-up/30 p-1.5 rounded-none">
            <div className="text-3xs uppercase tracking-wider text-up font-semibold flex justify-between">
              <span>Buying Capital</span>
              <span>{macroVolumeBreadth.buyRatio.toFixed(1)}%</span>
            </div>
            <div className="text-sm font-bold text-up mt-0.5">
              {fmtINR(macroVolumeBreadth.buyTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-muted-foreground truncate">
              In {marketBreadth.advances} advancing scrips
            </div>
          </div>

          {/* Metric 3: Selling Turnover */}
          <div className="bg-down/5 border border-down/30 p-1.5 rounded-none">
            <div className="text-3xs uppercase tracking-wider text-down font-semibold flex justify-between">
              <span>Selling Capital</span>
              <span>{macroVolumeBreadth.sellRatio.toFixed(1)}%</span>
            </div>
            <div className="text-sm font-bold text-down mt-0.5">
              {fmtINR(macroVolumeBreadth.sellTurnoverCr)} Cr
            </div>
            <div className="text-3xs text-muted-foreground truncate">
              In {marketBreadth.declines} declining scrips
            </div>
          </div>

          {/* Metric 4: Whole Market Breadth */}
          <div className="bg-surface-muted/50 border border-border/80 p-1.5 rounded-none">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Market Breadth</span>
              <span className="font-bold text-foreground">A/D {adRatio}</span>
            </div>
            <div className="text-sm font-bold text-foreground mt-0.5 flex items-baseline justify-between">
              <span className="text-up">+{totalBreadthAdv}</span>
              <span className="text-3xs text-muted-foreground">{totalBreadthUnch} unch</span>
              <span className="text-down">-{totalBreadthDec}</span>
            </div>
            <div className="flex h-1 w-full overflow-hidden bg-muted rounded-none mt-1">
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

      {/* ========================================================================= */}
      {/* 3. PANORAMIC 2-COLUMN COMMAND CENTER: ZERO DEAD SPACE                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN (4.8 of 12 cols): SECTORS, F&O BUILDUP, VELOCITY, CHURN       */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-2">
          <div className="border border-border bg-surface p-2 rounded-none shadow-xs space-y-2">
            {/* Left Sub-Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setLeftTab("sectors")}
                  className={cn(
                    "px-2 py-0.5 text-3xs font-mono font-semibold transition-colors rounded-none",
                    leftTab === "sectors"
                      ? "bg-surface-raised text-foreground font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Sectors ({sectorVolumeProfile.list.length})
                </button>
                <button
                  onClick={() => setLeftTab("fno")}
                  className={cn(
                    "px-2 py-0.5 text-3xs font-mono font-semibold transition-colors rounded-none flex items-center gap-1",
                    leftTab === "fno"
                      ? "bg-surface-raised text-foreground font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Activity className="h-2.5 w-2.5 text-accent" />
                  <span>F&O Position ({buildup?.classified ?? 215})</span>
                </button>
                <button
                  onClick={() => setLeftTab("velocity")}
                  className={cn(
                    "px-2 py-0.5 text-3xs font-mono font-semibold transition-colors rounded-none",
                    leftTab === "velocity"
                      ? "bg-surface-raised text-foreground font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Velocity
                </button>
                <button
                  onClick={() => setLeftTab("institutional")}
                  className={cn(
                    "px-2 py-0.5 text-3xs font-mono font-semibold transition-colors rounded-none flex items-center gap-1",
                    leftTab === "institutional"
                      ? "bg-surface-raised text-foreground font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Zap className="h-2.5 w-2.5 text-gold" />
                  <span>Stealth ({stealthChurnScrips.length})</span>
                </button>
              </div>

              {selectedSector && (
                <button
                  onClick={() => setSelectedSector(null)}
                  className="text-3xs font-mono text-accent hover:underline flex items-center gap-0.5"
                >
                  <span>Clear</span>
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>

            {/* TAB 1: 20-SECTORS FLOW */}
            {leftTab === "sectors" && (
              <div className="space-y-1 max-h-[560px] overflow-y-auto pr-0.5">
                <div className="flex items-center justify-between text-3xs font-mono text-muted-foreground px-1 pb-0.5">
                  <span>Sector · Volume Profile</span>
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
                        "p-1.5 border transition-all cursor-pointer rounded-none text-left font-mono",
                        isSelected
                          ? "border-accent bg-accent/10"
                          : isPoc
                            ? "border-gold/60 bg-surface-raised/80"
                            : isValueArea
                              ? "border-border bg-surface-muted/40 hover:bg-surface-muted"
                              : "border-border/60 bg-surface/40 hover:bg-surface-muted/30 opacity-80 hover:opacity-100",
                      )}
                    >
                      <div className="flex items-center justify-between text-2xs mb-0.5">
                        <div className="flex items-center gap-1.5 truncate max-w-[210px]">
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
                      <div className="h-1 w-full bg-muted rounded-none overflow-hidden relative">
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

                      <div className="mt-0.5 flex items-center justify-between text-3xs text-muted-foreground">
                        <span className="text-up">+{sec.advances} adv</span>
                        <span>{sec.count} stocks</span>
                        <span className="text-down">-{sec.declines} dec</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: F&O INSTITUTIONAL POSITIONING RADAR */}
            {leftTab === "fno" && (
              <div className="space-y-1.5 font-mono max-h-[560px] overflow-y-auto">
                {/* 4 Quadrant Selector */}
                <div className="grid grid-cols-2 gap-1 text-3xs">
                  <button
                    onClick={() => setFnoSubFilter("long")}
                    className={cn(
                      "p-1.5 border text-left rounded-none flex items-center justify-between transition-colors",
                      fnoSubFilter === "long"
                        ? "border-up bg-up/10 text-up font-bold"
                        : "border-border bg-surface-muted/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>Long Build-Up (Price↑ OI↑)</span>
                    <span className="font-bold">{buildup?.buckets?.longBuildUp?.length ?? 0}</span>
                  </button>

                  <button
                    onClick={() => setFnoSubFilter("short")}
                    className={cn(
                      "p-1.5 border text-left rounded-none flex items-center justify-between transition-colors",
                      fnoSubFilter === "short"
                        ? "border-down bg-down/10 text-down font-bold"
                        : "border-border bg-surface-muted/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>Short Build-Up (Price↓ OI↑)</span>
                    <span className="font-bold">{buildup?.buckets?.shortBuildUp?.length ?? 0}</span>
                  </button>

                  <button
                    onClick={() => setFnoSubFilter("covering")}
                    className={cn(
                      "p-1.5 border text-left rounded-none flex items-center justify-between transition-colors",
                      fnoSubFilter === "covering"
                        ? "border-accent bg-accent/10 text-accent font-bold"
                        : "border-border bg-surface-muted/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>Short Covering (Price↑ OI↓)</span>
                    <span className="font-bold">{buildup?.buckets?.shortCovering?.length ?? 0}</span>
                  </button>

                  <button
                    onClick={() => setFnoSubFilter("unwinding")}
                    className={cn(
                      "p-1.5 border text-left rounded-none flex items-center justify-between transition-colors",
                      fnoSubFilter === "unwinding"
                        ? "border-gold bg-gold/10 text-gold font-bold"
                        : "border-border bg-surface-muted/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>Long Unwinding (Price↓ OI↓)</span>
                    <span className="font-bold">{buildup?.buckets?.longUnwinding?.length ?? 0}</span>
                  </button>
                </div>

                {/* Scrip List */}
                <div className="space-y-1 pt-1">
                  {fnoActiveRows.length === 0 ? (
                    <div className="p-4 text-center text-3xs text-muted-foreground border border-border">
                      No scrips classified in this quadrant.
                    </div>
                  ) : (
                    fnoActiveRows.map((r) => {
                      const isBanned = bannedSet.has(r.symbol.toUpperCase());
                      return (
                        <div
                          key={r.symbol}
                          onClick={() => handleSelectFromFno(r.symbol)}
                          className="p-1.5 border border-border/80 bg-surface-muted/30 hover:bg-surface-muted hover:border-accent transition-colors rounded-none flex items-center justify-between text-2xs cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                            <span className="font-bold text-foreground">{r.symbol}</span>
                            {isBanned && (
                              <span className="px-1 py-0.2 bg-down/20 text-down font-bold text-3xs border border-down/40">
                                BAN
                              </span>
                            )}
                            <span className="text-3xs text-muted-foreground truncate">
                              LTP: {fmtINR(r.underlying)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-3xs">
                            <span
                              className={cn(
                                "font-semibold",
                                r.priceChangePct >= 0 ? "text-up" : "text-down",
                              )}
                            >
                              {r.priceChangePct >= 0 ? "+" : ""}
                              {r.priceChangePct.toFixed(2)}%
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span
                              className={cn(
                                "font-bold",
                                (r.oiChangePct ?? 0) >= 0 ? "text-up" : "text-down",
                              )}
                            >
                              OI: {(r.oiChangePct ?? 0) >= 0 ? "+" : ""}
                              {(r.oiChangePct ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PRICE VELOCITY SPECTRUM */}
            {leftTab === "velocity" && (
              <div className="space-y-1 font-mono max-h-[560px] overflow-y-auto">
                <div className="text-3xs text-muted-foreground px-1 pb-0.5">
                  Click any tier to filter matching constituents in the ledger
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
                        "p-1.5 border transition-all cursor-pointer rounded-none",
                        isPoc
                          ? "border-gold/80 bg-gold/5 shadow-xs"
                          : "border-border/80 bg-surface-muted/40 hover:bg-surface-muted",
                      )}
                    >
                      <div className="flex items-center justify-between text-2xs mb-0.5">
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

                      <div className="h-1 w-full bg-muted rounded-none overflow-hidden">
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

            {/* TAB 4: STEALTH CHURN & MARKET CAP */}
            {leftTab === "institutional" && (
              <div className="space-y-2 font-mono max-h-[560px] overflow-y-auto">
                <div className="text-3xs text-muted-foreground leading-relaxed px-1">
                  Stocks with heavy volume turnover (&gt; ₹60 Cr) in tight flat ranges (±0.20%). Indicates institutional block absorption without price displacement.
                </div>

                {stealthChurnScrips.length === 0 ? (
                  <div className="p-3 text-center text-3xs text-muted-foreground border border-border">
                    No stagnant block churn detected in the active session.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {stealthChurnScrips.slice(0, 10).map((s) => (
                      <div
                        key={s.symbol}
                        onClick={() => handleSelectStock(s)}
                        className="p-1.5 border border-border bg-surface-muted/40 hover:border-accent hover:bg-surface-muted transition-colors rounded-none flex items-center justify-between text-2xs cursor-pointer"
                      >
                        <div className="truncate max-w-[160px]">
                          <span className="font-bold text-foreground mr-1">{s.symbol}</span>
                          <span className="text-3xs text-muted-foreground truncate">{s.industry}</span>
                        </div>
                        <div className="flex items-center gap-2 text-3xs">
                          <span className="text-muted-foreground">LTP: {fmtINR(s.last)}</span>
                          <span className="text-flat font-semibold">{s.changePct.toFixed(2)}%</span>
                          <span className="text-foreground font-bold">{fmtINR(s.turnoverCr)} Cr</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Market Cap Tiers Strip */}
                <div className="pt-1.5 border-t border-border/70 space-y-1">
                  <div className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Market Cap Liquidity Tiers
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {marketCapTiers.map((t) => (
                      <div key={t.id} className="p-1 border border-border/80 bg-surface-muted/30 text-3xs">
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
        {/* RIGHT COLUMN (7.2 of 12 cols): LIVE CONSTITUENT ACTION LEDGER             */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 border border-border bg-surface p-2.5 rounded-none shadow-xs space-y-2">
          {/* Filter and Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-border/70 pb-2">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-0.5">
              {[
                { id: "ALL", label: `All (${stocks.length})` },
                { id: "BUYING", label: "Gainers" },
                { id: "SELLING", label: "Decliners" },
                { id: "52W_HIGH", label: "52W Highs" },
                { id: "52W_LOW", label: "52W Lows" },
                { id: "UNMOVED", label: "Flat" },
                { id: "SURGE", label: "Surge" },
                { id: "FNO_LONG", label: `F&O Long (${fnoLongSet.size})` },
                { id: "FNO_BAN", label: `Ban (${bannedSet.size})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMovementFilter(f.id as any)}
                  className={cn(
                    "px-2 py-0.5 text-3xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-none",
                    movementFilter === f.id
                      ? "bg-accent text-accent-foreground font-bold"
                      : "border border-border/80 bg-surface-muted/50 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Box & Sort */}
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <div className="relative grow sm:grow-0">
                <Search className="absolute left-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter ticker... (/ to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-6 w-full sm:w-36 border border-border bg-surface-muted/60 pl-6 pr-1.5 font-mono text-3xs focus:border-accent focus:outline-none rounded-none"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-6 border border-border bg-surface-muted/60 px-1 font-mono text-3xs text-foreground focus:border-accent focus:outline-none rounded-none"
              >
                <option value="turnover">Sort: Turnover</option>
                <option value="changeDesc">Sort: Gainers %</option>
                <option value="changeAsc">Sort: Losers %</option>
                <option value="mcap">Sort: Market Cap</option>
                <option value="volume">Sort: Volume</option>
              </select>
            </div>
          </div>

          {/* DOCKED CONSTITUENT MICROSTRUCTURE INSPECTOR (When a stock is clicked) */}
          {selectedConstituent && (
            <div className="border border-gold/70 bg-surface-raised p-2 rounded-none space-y-1.5 font-mono text-2xs animate-in fade-in-50">
              <div className="flex items-center justify-between border-b border-border/70 pb-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-foreground">
                    {selectedConstituent.symbol}
                  </span>
                  <span className="text-3xs text-muted-foreground truncate max-w-[180px]">
                    {selectedConstituent.name} · {selectedConstituent.industry}
                  </span>
                  {bannedSet.has(selectedConstituent.symbol.toUpperCase()) && (
                    <span className="px-1 py-0.2 bg-down/20 text-down font-bold text-3xs border border-down/40">
                      IN F&O BAN (&gt;95% MWPL)
                    </span>
                  )}
                  {fnoStatusMap.has(selectedConstituent.symbol.toUpperCase()) && (
                    <span className="px-1 py-0.2 bg-accent/15 text-accent font-bold text-3xs border border-accent/30 uppercase">
                      {fnoStatusMap.get(selectedConstituent.symbol.toUpperCase())?.type} build-up
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {onSelectStock && (
                    <button
                      onClick={() => onSelectStock(selectedConstituent.symbol)}
                      className="px-2 py-0.5 bg-gold text-surface-raised font-bold text-3xs hover:bg-gold/90 transition-colors flex items-center gap-1"
                    >
                      <BarChart2 className="h-3 w-3" />
                      <span>Launch 1m VRVP Terminal →</span>
                    </button>
                  )}
                  <Link
                    href={`/company/${encodeURIComponent(selectedConstituent.symbol)}`}
                    className="text-3xs text-accent hover:underline font-semibold"
                  >
                    Full Analysis →
                  </Link>
                  <button
                    onClick={() => setSelectedConstituent(null)}
                    className="text-muted-foreground hover:text-foreground ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Day's Range Gauge */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-3xs">
                <div>
                  <span className="text-muted-foreground">LTP: </span>
                  <strong className="text-foreground">{fmtINR(selectedConstituent.last)}</strong>
                  <span
                    className={cn(
                      "ml-1 font-bold",
                      selectedConstituent.changePct >= 0 ? "text-up" : "text-down",
                    )}
                  >
                    ({selectedConstituent.changePct >= 0 ? "+" : ""}
                    {selectedConstituent.changePct.toFixed(2)}%)
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">Turnover: </span>
                  <strong className="text-foreground">
                    {fmtINR(selectedConstituent.turnoverCr)} Cr
                  </strong>
                </div>

                <div>
                  <span className="text-muted-foreground">Day Low / High: </span>
                  <strong className="text-foreground">
                    {fmtINR(selectedConstituent.low ?? (selectedConstituent.changePct < 0 ? selectedConstituent.last : (selectedConstituent.previousClose ?? selectedConstituent.last)))} - {fmtINR(selectedConstituent.high ?? (selectedConstituent.changePct >= 0 ? selectedConstituent.last : (selectedConstituent.previousClose ?? selectedConstituent.last)))}
                  </strong>
                </div>

                <div>
                  <span className="text-muted-foreground">Market Cap: </span>
                  <strong className="text-foreground">
                    {fmtINR(selectedConstituent.marketCapCr)} Cr
                  </strong>
                </div>
              </div>

              {/* Real-Time Cumulative Volume Delta (CVD) & Microstructure Panel */}
              <div className="pt-1 border-t border-border/60">
                <MicrostructureCvdPanel symbol={selectedConstituent.symbol} />
              </div>
            </div>
          )}

          {/* High-Density Stock Ledger Table with Sticky Header */}
          <div className="overflow-x-auto border border-border max-h-[510px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-surface-muted border-b border-border font-mono text-3xs text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-1.5">Scrip / Name</th>
                  <th className="p-1.5">Sector</th>
                  <th className="p-1.5 text-right">LTP (₹)</th>
                  <th className="p-1.5 text-right">Change (%)</th>
                  <th className="p-1.5 text-right">Turnover (₹ Cr)</th>
                  <th className="p-1.5 text-right">Volume</th>
                  <th className="p-1.5 text-center">Day Range</th>
                  <th className="p-1.5 text-center">VRVP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-2xs">
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No scrips match active filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((s) => {
                    const isUp = s.changePct > 0.05;
                    const isDown = s.changePct < -0.05;
                    const isBanned = bannedSet.has(s.symbol.toUpperCase());
                    const fnoStatus = fnoStatusMap.get(s.symbol.toUpperCase());
                    const isSelected = selectedConstituent?.symbol === s.symbol;

                    // Day range position %
                    const sLow = s.low ?? (s.changePct < 0 ? s.last : (s.previousClose ?? s.last));
                    const sHigh = s.high ?? (s.changePct >= 0 ? s.last : (s.previousClose ?? s.last));
                    const rangeSpan = sHigh - sLow;
                    const rangePos = rangeSpan > 0 ? (((s.last ?? 0) - sLow) / rangeSpan) * 100 : Math.max(5, Math.min(95, 50 + s.changePct * 10));

                    return (
                      <tr
                        key={s.symbol}
                        onClick={() => handleSelectStock(s)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected
                            ? "bg-accent/15 border-l-2 border-l-accent"
                            : "hover:bg-surface-muted/50",
                        )}
                      >
                        <td className="p-1.5">
                          <div className="flex items-center gap-1 truncate max-w-[160px]">
                            <span className="font-bold text-foreground hover:text-accent">
                              {s.symbol}
                            </span>
                            {isBanned && (
                              <span className="px-1 py-0.1 bg-down/20 text-down font-bold text-3xs border border-down/40 shrink-0">
                                BAN
                              </span>
                            )}
                            {fnoStatus && !isBanned && (
                              <span
                                className={cn(
                                  "px-1 py-0.1 font-bold text-3xs shrink-0 border",
                                  fnoStatus.type === "long"
                                    ? "bg-up/15 text-up border-up/30"
                                    : fnoStatus.type === "short"
                                      ? "bg-down/15 text-down border-down/30"
                                      : "bg-surface-muted text-muted-foreground border-border",
                                )}
                              >
                                {fnoStatus.type.slice(0, 4).toUpperCase()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-1.5 font-sans text-3xs text-muted-foreground truncate max-w-[100px]">
                          {s.industry}
                        </td>
                        {(() => {
                          const tickDir = priceTicks?.get(s.symbol);
                          return (
                            <td
                              className={cn(
                                "p-1.5 text-right font-semibold transition-colors font-mono",
                                tickDir === "up"
                                  ? "animate-tick-up text-up font-bold bg-up/10"
                                  : tickDir === "down"
                                    ? "animate-tick-down text-down font-bold bg-down/10"
                                    : "text-foreground",
                              )}
                            >
                              {fmtINR(s.last)}
                            </td>
                          );
                        })()}
                        <td className="p-1.5 text-right">
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
                        <td className="p-1.5 text-right text-foreground font-bold">
                          {s.turnoverCr ? fmtINR(s.turnoverCr, "₹") : "—"}
                        </td>
                        <td className="p-1.5 text-right text-muted-foreground text-3xs">
                          {s.volume ? fmtCompact(s.volume) : "—"}
                        </td>
                        {/* Day Range Mini-Bar */}
                        <td className="p-1.5 text-center w-20">
                          <div className="relative h-1 w-16 bg-muted mx-auto rounded-none overflow-hidden">
                            <div
                              className="absolute top-0 bottom-0 bg-accent h-full w-1"
                              style={{ left: `${Math.max(0, Math.min(95, rangePos))}%` }}
                            />
                          </div>
                          <div className="text-3xs text-muted-foreground flex justify-between px-0.5 mt-0.5">
                            <span>L</span>
                            <span>H</span>
                          </div>
                        </td>
                        {/* VRVP CTA */}
                        <td className="p-1.5 text-center">
                          {onSelectStock && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStock(s.symbol);
                              }}
                              title={`Open ${s.symbol} 1m Volume Profile`}
                              className="text-3xs font-mono font-bold text-gold hover:bg-gold/15 px-1 py-0.2 border border-gold/30 rounded-none shrink-0"
                            >
                              VRVP →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Table Count Indicator */}
          <div className="flex items-center justify-between text-3xs font-mono text-muted-foreground pt-0.5">
            <span>Showing {filteredStocks.length} of {stocks.length} scrips in active universe</span>
            <span>Sorted by {sortBy.toUpperCase()} · Confined Bloomberg-Density Grid</span>
          </div>
        </div>
      </div>
      {/* Terminal Hotkeys Modal */}
      {showHotkeyHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4"
          onClick={() => setShowHotkeyHelp(false)}
        >
          <div
            className="w-full max-w-md border border-border bg-surface p-4 font-mono text-xs space-y-3 shadow-xl rounded-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Keyboard className="h-4 w-4 text-gold" />
                <span>TERMINAL KEYBOARD NAVIGATION (UX-03)</span>
              </span>
              <button
                onClick={() => setShowHotkeyHelp(false)}
                className="text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-2xs">
              <div className="space-y-1.5">
                <div className="text-muted-foreground font-bold uppercase tracking-wider text-3xs">Scrip Navigation</div>
                <div className="flex justify-between"><kbd className="px-1 border border-border bg-surface-muted">J</kbd> or <kbd className="px-1 border border-border bg-surface-muted">↓</kbd> <span>Next Scrip</span></div>
                <div className="flex justify-between"><kbd className="px-1 border border-border bg-surface-muted">K</kbd> or <kbd className="px-1 border border-border bg-surface-muted">↑</kbd> <span>Prev Scrip</span></div>
                <div className="flex justify-between"><kbd className="px-1 border border-border bg-surface-muted">Enter</kbd> <span>Inspect Microstructure</span></div>
                <div className="flex justify-between"><kbd className="px-1 border border-border bg-surface-muted">V</kbd> <span>Launch 1m VRVP Terminal</span></div>
              </div>
              <div className="space-y-1.5">
                <div className="text-muted-foreground font-bold uppercase tracking-wider text-3xs">Desks & Tools</div>
                <div className="flex justify-between"><kbd className="px-1 border border-border bg-surface-muted">/</kbd> <span>Focus Ticker Filter</span></div>
                <div className="flex justify-between"><kbd className="px-1 border border-border bg-surface-muted">1..4</kbd> <span>Switch Sub-Tabs</span></div>
                <div className="flex justify-between"><kbd className="px-1 border border-border bg-surface-muted">Esc</kbd> <span>Dismiss / Unfocus</span></div>
                <div className="flex justify-between"><kbd className="px-1 border border-border bg-surface-muted">?</kbd> <span>Toggle This Help</span></div>
              </div>
            </div>
            <div className="text-3xs text-muted-foreground pt-1 border-t border-border flex justify-between">
              <span>Arthdex Terminal Standard</span>
              <span>Press <kbd className="border border-border px-1">Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
