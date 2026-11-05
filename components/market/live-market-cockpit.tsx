"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Compass,
  Cpu,
  Gauge,
  Radio,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiBuildUp, ApiFlows, ApiFnoBan, ApiIndex, ApiOptionChain, ApiPulse } from "@/lib/api/types";
import { LiveVolumeProfile } from "./live-volume-profile";
import { MacroMarketRadar } from "./macro-market-radar";
import { ScenarioForecastCockpit } from "./scenario-forecast-cockpit";
import { TickerTapeRibbon } from "./ticker-tape-ribbon";

interface LiveMarketCockpitProps {
  initialPulse: ApiPulse;
  initialIndices?: ApiIndex[];
  initialBuildUp?: ApiBuildUp | null;
  initialFnoBan?: ApiFnoBan | null;
  initialFlows?: ApiFlows | null;
  initialOptionChain?: ApiOptionChain | null;
  initialIndex?: string;
}

type MarketSession = "OPEN" | "PRE_OPEN" | "CLOSED";

function getMarketSession(): { session: MarketSession; label: string; detail: string } {
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

const KEY_INDEX_IDS = [
  "nifty-50",
  "nifty-bank",
  "nifty-it",
  "india-vix",
  "nifty-midcap-100",
  "nifty-smallcap-100",
];

export function LiveMarketCockpit({
  initialPulse,
  initialIndices = [],
  initialBuildUp = null,
  initialFnoBan = null,
  initialFlows = null,
  initialOptionChain = null,
  initialIndex = "nifty500",
}: LiveMarketCockpitProps) {
  const [pulse, setPulse] = useState<ApiPulse>(initialPulse);
  const [indices, setIndices] = useState<ApiIndex[]>(initialIndices);
  const [buildup, setBuildup] = useState<ApiBuildUp | null>(initialBuildUp);
  const [fnoBan, setFnoBan] = useState<ApiFnoBan | null>(initialFnoBan);
  const [flows, setFlows] = useState<ApiFlows | null>(initialFlows);
  const [optionChain, setOptionChain] = useState<ApiOptionChain | null>(initialOptionChain);
  const [derivSymbol, setDerivSymbol] = useState<string>("NIFTY");
  const [currentIndex, setCurrentIndex] = useState<string>(initialIndex);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(5);
  const [countdown, setCountdown] = useState<number>(5);
  const [marketStatus, setMarketStatus] = useState(getMarketSession());
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  const prevVolumesRef = useRef<Map<string, number>>(new Map());
  const [priceTicks, setPriceTicks] = useState<Map<string, "up" | "down">>(new Map());
  const [volumeTicks, setVolumeTicks] = useState<Set<string>>(new Set());
  const [tickCount, setTickCount] = useState<number>(1);
  const [justSynced, setJustSynced] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  );

  // Master Cockpit View Switcher
  const [cockpitView, setCockpitView] = useState<"radar" | "volume_profile" | "scenario_engine">("radar");
  const [activeProfileSymbol, setActiveProfileSymbol] = useState<string>("RELIANCE");

  // Keep market status updated every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getMarketSession());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch updated data from API (both pulse and indices)
  const refreshData = useCallback(async (idx = currentIndex) => {
    setLoading(true);
    try {
      const [pulseRes, indicesRes, buildupRes, fnoBanRes, flowsRes, chainRes] = await Promise.all([
        fetch(`/api/pulse?index=${encodeURIComponent(idx)}`, { cache: "no-store" }),
        fetch("/api/indices", { cache: "no-store" }),
        fetch("/api/derivatives/buildup", { cache: "no-store" }),
        fetch("/api/derivatives/fno-ban", { cache: "no-store" }),
        fetch("/api/flows?days=5", { cache: "no-store" }),
        fetch(`/api/derivatives/chain?symbol=${encodeURIComponent(derivSymbol)}`, { cache: "no-store" }),
      ]);

      if (pulseRes.ok) {
        const json = await pulseRes.json();
        if (json.data) {
          if (json.data.stocks) {
            const newTicks = new Map<string, "up" | "down">();
            json.data.stocks.forEach((s: any) => {
              const prev = prevPricesRef.current.get(s.symbol);
              if (prev !== undefined && s.last !== prev) {
                newTicks.set(s.symbol, s.last > prev ? "up" : "down");
              }
              prevPricesRef.current.set(s.symbol, s.last);
            });
            const newVolTicks = new Set<string>();
            json.data.stocks.forEach((s: any) => {
              const prevV = prevVolumesRef.current.get(s.symbol);
              if (prevV !== undefined && s.volume && s.volume > prevV) {
                newVolTicks.add(s.symbol);
              }
              if (s.volume) prevVolumesRef.current.set(s.symbol, s.volume);
            });

            if (newTicks.size > 0) {
              setPriceTicks(newTicks);
              setTimeout(() => setPriceTicks(new Map()), 1500);
            }
            if (newVolTicks.size > 0) {
              setVolumeTicks(newVolTicks);
              setTimeout(() => setVolumeTicks(new Set()), 1500);
            }
            setTickCount((prev) => prev + 1);
            setJustSynced(true);
            setTimeout(() => setJustSynced(false), 900);
          }
          setPulse(json.data);
          setLastSyncTime(
            new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            }),
          );
        }
      }
      if (indicesRes.ok) {
        const json = await indicesRes.json();
        if (json.data) setIndices(json.data);
      }
      if (buildupRes.ok) {
        const json = await buildupRes.json();
        if (json.data) setBuildup(json.data);
      }
      if (fnoBanRes.ok) {
        const json = await fnoBanRes.json();
        if (json.data) setFnoBan(json.data);
      }
      if (flowsRes.ok) {
        const json = await flowsRes.json();
        if (json.data) setFlows(json.data);
      }
      if (chainRes.ok) {
        const json = await chainRes.json();
        if (json.data) setOptionChain(json.data);
      }
    } catch {
      // Retain active state
    } finally {
      setLoading(false);
      setCountdown(refreshInterval);
    }
  }, [currentIndex, refreshInterval, derivSymbol]);

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

  function handleUniverseChange(newIdx: string) {
    setCurrentIndex(newIdx);
    startTransition(() => {
      void refreshData(newIdx);
    });
  }

  function handleOpenVolumeProfile(sym: string) {
    setActiveProfileSymbol(sym);
    setCockpitView("volume_profile");
  }

  // Filter key benchmark indices for ribbon
  const ribbonIndices = indices.length > 0
    ? indices.filter((idx) => KEY_INDEX_IDS.includes(idx.id))
    : [];

  return (
    <div className="space-y-4 rounded-none font-sans">
      {/* 1. TOP MACRO INDEX HUD RIBBON (Zero dead space, high-density live ticker) */}
      {ribbonIndices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 font-mono text-xs">
          {ribbonIndices.map((idx) => {
            const pct = idx.change?.percent ?? 0;
            const pts = idx.change?.absolute ?? 0;
            const isUp = pct > 0;
            const isDown = pct < 0;

            return (
              <div
                key={idx.id}
                className="border border-border bg-surface p-2 rounded-none shadow-xs flex flex-col justify-between"
              >
                <div className="text-3xs text-muted-foreground uppercase tracking-wider font-semibold truncate">
                  {idx.name}
                </div>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  {idx.level.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
                <div className="flex items-center justify-between text-3xs mt-0.5">
                  <span className={cn("font-bold", isUp ? "text-up" : isDown ? "text-down" : "text-flat")}>
                    {isUp ? "+" : ""}{pct.toFixed(2)}%
                  </span>
                  <span className="text-muted-foreground">
                    {pts > 0 ? "+" : ""}{pts.toFixed(1)} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Cockpit Master Header & View Switcher */}
      <div className="border border-border bg-surface p-3 sm:p-3.5 shadow-sm space-y-3 rounded-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          {/* Market Status Pill */}
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-2xs font-bold uppercase tracking-wider border rounded-none font-mono",
                marketStatus.session === "OPEN"
                  ? "border-up/40 bg-up/10 text-up"
                  : marketStatus.session === "PRE_OPEN"
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-border bg-surface-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-none",
                  marketStatus.session === "OPEN"
                    ? "bg-up animate-pulse"
                    : marketStatus.session === "PRE_OPEN"
                      ? "bg-gold animate-ping"
                      : "bg-muted-foreground",
                )}
              />
              {marketStatus.label}
            </div>

            <span className="text-2xs text-muted-foreground hidden sm:inline">
              {marketStatus.detail}
            </span>
          </div>

          {/* Right Controls: Auto-Refresh & Trigger */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Auto-Refresh Selector */}
            <div className="flex items-center gap-1 border border-border bg-surface-muted p-0.5 text-xs rounded-none">
              <span className="px-1.5 text-3xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1 font-mono">
                <Radio className="h-3 w-3 text-accent animate-pulse" /> Sync:
              </span>
              {[
                { sec: 3, label: "3s Live" },
                { sec: 5, label: "5s" },
                { sec: 10, label: "10s" },
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
                    "px-2 py-0.5 text-3xs font-mono font-medium transition-colors rounded-none",
                    refreshInterval === opt.sec
                      ? "bg-surface text-foreground font-bold shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Manual Sync */}
            <button
              onClick={() => void refreshData()}
              disabled={loading}
              className="flex items-center gap-1.5 border border-border bg-surface-raised px-2.5 py-1 text-2xs font-mono font-medium text-foreground hover:bg-surface-muted transition-colors disabled:opacity-50 rounded-none shadow-xs"
            >
              <RefreshCw className={cn("h-3 w-3 text-accent", loading && "animate-spin")} />
              <span>{loading ? "Syncing..." : `Sync (${countdown}s)`}</span>
            </button>
          </div>
        </div>

        {/* Bloomberg-Grade Compact Multi-Ticker Tape Ribbon (UX-01) */}
        <TickerTapeRibbon indices={indices} />

        {/* Master Navigation Switcher: Whole Market Radar vs TradingView Volume Profile */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center border border-border bg-surface-muted p-0.5 rounded-none">
            <button
              onClick={() => setCockpitView("radar")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-2xs font-mono font-bold uppercase tracking-wider transition-all rounded-none",
                cockpitView === "radar"
                  ? "bg-surface text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Gauge className="h-3.5 w-3.5 text-accent" />
              <span>WHOLE-MARKET GOD&apos;S-EYE RADAR</span>
            </button>
            <button
              onClick={() => setCockpitView("volume_profile")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-2xs font-mono font-bold uppercase tracking-wider transition-all rounded-none",
                cockpitView === "volume_profile"
                  ? "bg-surface text-gold shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BarChart2 className="h-3.5 w-3.5 text-gold" />
              <span>TRADINGVIEW VOLUME PROFILE (VRVP)</span>
            </button>
            <button
              onClick={() => setCockpitView("scenario_engine")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-2xs font-mono font-bold uppercase tracking-wider transition-all rounded-none",
                cockpitView === "scenario_engine"
                  ? "bg-surface text-accent shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Cpu className="h-3.5 w-3.5 text-accent" />
              <span>MULTI-ALGO SCENARIOS & TRADE SIZER</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-3xs font-mono text-muted-foreground">
            <span>Exchange Session: <strong className="text-foreground">{pulse.asOf}</strong></span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1 text-up font-semibold">
              <ShieldCheck className="h-3 w-3" /> 100% Genuine Official NSE Data
            </span>
          </div>
        </div>
      </div>

      {/* Render Active View */}
      {cockpitView === "scenario_engine" ? (
        <div className="animate-in fade-in-50">
          <ScenarioForecastCockpit
            initialSymbol={activeProfileSymbol}
          />
        </div>
      ) : cockpitView === "volume_profile" ? (
        <div className="animate-in fade-in-50">
          <LiveVolumeProfile
            initialSymbol={activeProfileSymbol}
            initialInterval="15m"
          />
        </div>
      ) : (
        <div className="animate-in fade-in-50">
          <MacroMarketRadar
            pulse={pulse}
            indices={indices}
            buildup={buildup}
            fnoBan={fnoBan}
            flows={flows}
            optionChain={optionChain}
            priceTicks={priceTicks}
            volumeTicks={volumeTicks}
            tickCount={tickCount}
            justSynced={justSynced}
            lastSyncTime={lastSyncTime}
            countdown={countdown}
            isSyncing={loading}
            onManualSync={() => refreshData()}
            derivSymbol={derivSymbol}
            onDerivSymbolChange={(sym) => {
              setDerivSymbol(sym);
              void fetch(`/api/derivatives/chain?symbol=${encodeURIComponent(sym)}`, { cache: "no-store" })
                .then((r) => r.json())
                .then((j) => {
                  if (j.data) setOptionChain(j.data);
                })
                .catch(() => {});
            }}
            currentIndex={currentIndex}
            onUniverseChange={handleUniverseChange}
            onSelectStock={handleOpenVolumeProfile}
          />
        </div>
      )}
    </div>
  );
}
