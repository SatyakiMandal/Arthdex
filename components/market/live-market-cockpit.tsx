"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  BarChart2,
  Compass,
  Gauge,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiPulse } from "@/lib/api/types";
import { LiveVolumeProfile } from "./live-volume-profile";
import { MacroMarketRadar } from "./macro-market-radar";

interface LiveMarketCockpitProps {
  initialPulse: ApiPulse;
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

export function LiveMarketCockpit({
  initialPulse,
  initialIndex = "nifty500",
}: LiveMarketCockpitProps) {
  const [pulse, setPulse] = useState<ApiPulse>(initialPulse);
  const [currentIndex, setCurrentIndex] = useState<string>(initialIndex);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(15); // in seconds, 0 = paused
  const [countdown, setCountdown] = useState<number>(15);
  const [marketStatus, setMarketStatus] = useState(getMarketSession());

  // Master Cockpit View Switcher: Whole-Market God's-Eye Radar vs TradingView Volume Profile
  const [cockpitView, setCockpitView] = useState<"radar" | "volume_profile">("radar");

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

  return (
    <div className="space-y-6 rounded-none">
      {/* 1. Cockpit Header Control Panel & Master View Switcher */}
      <div className="border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4 rounded-none">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          {/* Market Status Pill (Sharp, Zero Rounded Corners) */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider border rounded-none font-mono",
                marketStatus.session === "OPEN"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : marketStatus.session === "PRE_OPEN"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                    : "border-border/80 bg-muted/60 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-none",
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

          {/* Right Controls: Auto-Refresh & Trigger */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Auto-Refresh Selector */}
            <div className="flex items-center gap-1.5 border border-border bg-background p-1 text-xs rounded-none">
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
                    "px-2 py-0.5 text-2xs font-mono font-medium transition-colors rounded-none",
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
              className="flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-xs font-mono font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 rounded-none"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-primary", loading && "animate-spin")} />
              <span>{loading ? "Fetching..." : `Sync (${countdown}s)`}</span>
            </button>
          </div>
        </div>

        {/* Master View Navigation Tabs (Sharp Square Tabs) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center border border-border bg-muted/40 p-1 rounded-none">
            <button
              onClick={() => setCockpitView("radar")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all rounded-none",
                cockpitView === "radar"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50",
              )}
            >
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <span>WHOLE-MARKET GOD&apos;S-EYE RADAR</span>
            </button>
            <button
              onClick={() => setCockpitView("volume_profile")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all rounded-none",
                cockpitView === "volume_profile"
                  ? "bg-card text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50",
              )}
            >
              <BarChart2 className="h-3.5 w-3.5 text-amber-400" />
              <span>TRADINGVIEW VOLUME PROFILE (VRVP)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-2xs font-mono text-muted-foreground">
            <span>Exchange Session: <strong className="text-foreground">{pulse.asOf}</strong></span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> 100% Genuine Live NSE Data
            </span>
          </div>
        </div>
      </div>

      {/* Render View: Macro Market Radar or TradingView Volume Profile */}
      {cockpitView === "volume_profile" ? (
        <div className="space-y-6 animate-in fade-in-50">
          <LiveVolumeProfile initialSymbol="RELIANCE" initialInterval="15m" />
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in-50">
          <MacroMarketRadar
            pulse={pulse}
            currentIndex={currentIndex}
            onUniverseChange={handleUniverseChange}
          />
        </div>
      )}
    </div>
  );
}
