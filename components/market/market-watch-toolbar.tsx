"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Radio, RefreshCw, Layers, TrendingUp, TrendingDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketWatchToolbarProps {
  currentUniverse: string;
  currentWindow: string;
  currentPrice: string;
  advances?: number;
  declines?: number;
}

const UNIVERSES = [
  { id: "gt20", label: "> ₹20" },
  { id: "nifty50", label: "Nifty 50" },
  { id: "niftynext50", label: "Next 50" },
  { id: "banknifty", label: "Bank Nifty" },
  { id: "fo", label: "F&O" },
  { id: "all", label: "All" },
];

const WINDOWS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const PRICE_BANDS = [
  { id: "all", label: "All" },
  { id: "penny", label: "< ₹50" },
  { id: "small", label: "₹50–500" },
  { id: "mid", label: "₹500–2k" },
  { id: "large", label: "> ₹2k" },
];

export function MarketWatchToolbar({
  currentUniverse,
  currentWindow,
  currentPrice,
  advances = 0,
  declines = 0,
}: MarketWatchToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(3); // 3s default live cadence
  const [countdown, setCountdown] = useState<number>(3);
  const [pollSeq, setPollSeq] = useState<number>(1);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>(() =>
    new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  );

  const totalBreadth = advances + declines;
  const advPct = totalBreadth > 0 ? (advances / totalBreadth) * 100 : 50;

  // Auto-refresh cadence loop
  useEffect(() => {
    if (autoRefreshSecs === 0) return;

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setIsSyncing(true);
          router.refresh();
          setPollSeq((s) => s + 1);
          setLastRefreshedTime(
            new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            }),
          );
          setTimeout(() => setIsSyncing(false), 600);
          return autoRefreshSecs;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshSecs, router]);

  function handleFilterChange(key: "universe" | "window" | "price", val: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set(key, val);
    router.push(`/market-watch?${params.toString()}`);
  }

  return (
    <div className="space-y-2 font-mono text-2xs rounded-none">
      {/* 1. Real-Time Telemetry & Whole-Market Breadth Ribbon */}
      <div className="border border-border bg-surface px-2.5 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-2.5 rounded-none shadow-xs">
        {/* Left: Breadth Proportional Bar & Stats */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
              Market Breadth:
            </span>
            <div className="flex items-center gap-1.5 font-bold tabular-nums">
              <span className="text-up flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> ▲ {advances} Adv
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-down flex items-center gap-0.5">
                <TrendingDown className="h-3 w-3" /> ▼ {declines} Dec
              </span>
            </div>
          </div>

          {/* Proportional Breadth Bar Gauge */}
          {totalBreadth > 0 && (
            <div
              className="hidden md:flex items-center gap-1.5 w-36 h-2 bg-surface-muted border border-border/80 overflow-hidden"
              title={`Breadth: ${advPct.toFixed(1)}% Advances vs ${(100 - advPct).toFixed(1)}% Declines`}
            >
              <div
                className="h-full bg-up transition-all duration-300"
                style={{ width: `${advPct}%` }}
              />
              <div
                className="h-full bg-down transition-all duration-300"
                style={{ width: `${100 - advPct}%` }}
              />
            </div>
          )}

          {totalBreadth > 0 && (
            <span className="text-3xs text-muted-foreground font-semibold hidden lg:inline">
              Ratio: {(advances / Math.max(1, declines)).toFixed(2)}x
            </span>
          )}
        </div>

        {/* Right: Live Cadence Selector & Sequence Meter */}
        <div className="flex items-center gap-2">
          {/* Live Cadence Selector */}
          <div className="flex items-center border border-border bg-surface-muted p-0.5 text-xs font-mono rounded-none">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground px-1 hidden sm:inline flex items-center gap-1">
              <Radio className="h-3 w-3 text-accent animate-pulse" /> Cadence:
            </span>
            {[
              { label: "3s LIVE", val: 3 },
              { label: "5s", val: 5 },
              { label: "10s", val: 10 },
              { label: "Pause", val: 0 },
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => {
                  setAutoRefreshSecs(opt.val);
                  setCountdown(opt.val);
                }}
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

          {/* Countdown & Sequence */}
          {autoRefreshSecs > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground bg-surface-muted/60 px-1.5 py-0.5 border border-border/60 text-2xs font-mono rounded-none">
              <span>Next:</span>
              <span className="font-bold text-accent tabular-nums">{countdown}s</span>
              <span className="inline-block h-2 w-0.5 bg-accent animate-pulse" />
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-surface-raised border border-border px-2 py-0.5 text-2xs font-mono rounded-none">
            <span className="font-bold text-foreground tabular-nums">LIVE #{pollSeq}</span>
            <span className="text-muted-foreground text-3xs hidden sm:inline">({lastRefreshedTime})</span>
          </div>

          <button
            onClick={() => {
              setIsSyncing(true);
              router.refresh();
              setTimeout(() => setIsSyncing(false), 600);
            }}
            disabled={isSyncing}
            className="flex items-center gap-1 border border-border bg-surface-raised px-2 py-0.5 text-3xs font-mono font-semibold text-foreground hover:bg-surface-muted transition-colors rounded-none disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3 text-accent", isSyncing && "animate-spin")} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Consolidated Bloomberg Single-Row Filter Ribbon */}
      <div className="border border-border bg-surface px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 rounded-none">
        {/* Universe Segment */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold mr-1">
            Universe:
          </span>
          {UNIVERSES.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleFilterChange("universe", opt.id)}
              className={cn(
                "px-2 py-0.5 text-2xs font-mono transition-colors rounded-none border",
                currentUniverse === opt.id
                  ? "border-accent bg-accent/15 text-accent font-bold shadow-2xs"
                  : "border-border/70 bg-surface-muted/50 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Window & Price Segments */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Window */}
          <div className="flex items-center gap-1">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold mr-1">
              Window:
            </span>
            {WINDOWS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleFilterChange("window", opt.id)}
                className={cn(
                  "px-1.5 py-0.5 text-2xs font-mono transition-colors rounded-none border",
                  currentWindow === opt.id
                    ? "border-accent bg-accent text-accent-foreground font-bold shadow-2xs"
                    : "border-border/70 bg-surface-muted/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Price Bands */}
          <div className="flex items-center gap-1 border-l border-border/70 pl-2.5">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold mr-1">
              Price:
            </span>
            {PRICE_BANDS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleFilterChange("price", opt.id)}
                className={cn(
                  "px-1.5 py-0.5 text-2xs font-mono transition-colors rounded-none border",
                  currentPrice === opt.id
                    ? "border-accent bg-accent/15 text-accent font-bold shadow-2xs"
                    : "border-border/70 bg-surface-muted/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
