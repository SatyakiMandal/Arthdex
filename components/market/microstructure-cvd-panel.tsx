"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Flame, Layers, ShieldAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiOrderflow } from "@/lib/api/types";

interface MicrostructureCvdPanelProps {
  symbol: string;
}

function fmtCompact(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${abs.toFixed(0)}`;
}

export function MicrostructureCvdPanel({ symbol }: MicrostructureCvdPanelProps) {
  const [data, setData] = useState<ApiOrderflow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/orderflow?symbol=${encodeURIComponent(symbol)}&interval=5m`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!isCancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err.message || "Failed to load orderflow");
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className="border border-border/80 bg-surface-muted/30 p-2 text-3xs font-mono text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
          Computing Cumulative Volume Delta (CVD) for {symbol}...
        </span>
        <span>5m Granularity</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border border-border/80 bg-surface-muted/20 p-2 text-3xs font-mono text-muted-foreground flex items-center justify-between">
        <span>Microstructure CVD unavailable for {symbol}</span>
        <span className="text-border">| Level-1 Depth</span>
      </div>
    );
  }

  const cvdSeries = data.cvd || [];
  const recentCvd = cvdSeries.slice(-24);
  const latestCvd = cvdSeries.length > 0 ? cvdSeries[cvdSeries.length - 1] : 0;
  const initialCvd = recentCvd.length > 0 ? recentCvd[0] : 0;
  const cvdDelta = latestCvd - initialCvd;

  const minCvd = Math.min(...recentCvd, 0);
  const maxCvd = Math.max(...recentCvd, 1);
  const range = maxCvd - minCvd || 1;

  // Build SVG polyline points (240x28px)
  const svgW = 220;
  const svgH = 26;
  const points = recentCvd
    .map((val, idx) => {
      const x = ((idx / (recentCvd.length - 1 || 1)) * svgW).toFixed(1);
      const y = (svgH - 2 - ((val - minCvd) / range) * (svgH - 6)).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");

  // Recent absorption events (last 2)
  const recentAbsorption = (data.absorption || []).slice(-2);
  const latestBigTrade = (data.bigTrades || []).slice(-1)[0];

  return (
    <div className="border border-accent/40 bg-surface-muted/30 p-2 font-mono text-2xs space-y-1.5 rounded-none">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1">
        <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
          <Zap className="h-3 w-3 text-gold" />
          <span>Intraday CVD Microstructure & Passive Absorption (MF-01)</span>
        </span>
        <span className="text-3xs text-muted-foreground">
          POC: <strong className="text-foreground">₹{data.profile?.poc}</strong> · VAH: <strong className="text-foreground">₹{data.profile?.vah}</strong> · VAL: <strong className="text-foreground">₹{data.profile?.val}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
        {/* Metric A (4 of 12 cols): Net Cumulative Volume Delta */}
        <div className="sm:col-span-4 bg-surface p-1.5 border border-border/70 rounded-none">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground flex justify-between">
            <span>Net Session CVD</span>
            <span className={cn("font-bold text-3xs", cvdDelta >= 0 ? "text-up" : "text-down")}>
              {cvdDelta >= 0 ? "+" : ""}{fmtCompact(cvdDelta)}
            </span>
          </div>
          <div className={cn("text-xs font-bold mt-0.5", latestCvd >= 0 ? "text-up" : "text-down")}>
            {latestCvd >= 0 ? "+" : ""}{fmtCompact(latestCvd)} shares
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5 truncate">
            {latestCvd >= 0 ? "Aggressive Buyer Pressure Dominant" : "Aggressive Seller Pressure Dominant"}
          </div>
        </div>

        {/* Metric B (5 of 12 cols): 24-Bar CVD Trendline */}
        <div className="sm:col-span-5 bg-surface p-1.5 border border-border/70 rounded-none flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-3xs text-muted-foreground mb-0.5">
            <span>5m CVD Trajectory (Last 2h)</span>
            <span className={cvdDelta >= 0 ? "text-up font-semibold" : "text-down font-semibold"}>
              {cvdDelta >= 0 ? "Accumulating ↑" : "Distributing ↓"}
            </span>
          </div>
          <div className="w-full flex items-center justify-center">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-6 overflow-visible"
              preserveAspectRatio="none"
            >
              <polyline
                fill="none"
                stroke={cvdDelta >= 0 ? "hsl(var(--up))" : "hsl(var(--down))"}
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points}
              />
            </svg>
          </div>
        </div>

        {/* Metric C (3 of 12 cols): Recent Absorption & Large Deals */}
        <div className="sm:col-span-3 bg-surface p-1.5 border border-border/70 rounded-none text-3xs space-y-1">
          <div className="text-muted-foreground uppercase tracking-wider font-semibold">
            Institutional Absorption
          </div>
          {recentAbsorption.length > 0 ? (
            recentAbsorption.map((ab, i) => (
              <div key={i} className="flex items-center justify-between truncate">
                <span
                  className={cn(
                    "px-1 py-0.2 font-bold uppercase rounded-none border text-3xs",
                    ab.type === "bullish"
                      ? "bg-up/15 text-up border-up/30"
                      : "bg-down/15 text-down border-down/30",
                  )}
                >
                  {ab.type === "bullish" ? "Iceberg Buy" : "Sell Absorb"}
                </span>
                <span className="text-foreground font-semibold">₹{ab.price}</span>
              </div>
            ))
          ) : latestBigTrade ? (
            <div className="flex items-center justify-between truncate">
              <span className="text-gold font-bold">Vol Z: {latestBigTrade.z}σ</span>
              <span className="text-foreground">₹{latestBigTrade.price}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-3xs">No active absorption prints</span>
          )}
        </div>
      </div>
    </div>
  );
}
