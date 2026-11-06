"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Layers,
  TrendingUp,
  TrendingDown,
  Scale,
  Sparkles,
  Info,
  Calendar,
} from "lucide-react";
import type { ApiVolSurfaceResponse, ApiVolSurfaceRow } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface VolatilitySurfaceDeskProps {
  initialData: ApiVolSurfaceResponse;
}

export function VolatilitySurfaceDesk({ initialData }: VolatilitySurfaceDeskProps) {
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);

  const {
    symbol,
    spotPrice,
    asOf,
    skewSummary,
    termStructure,
    surface,
    nearSmile,
  } = initialData;

  // Chart coordinate calculations for Near Expiry Smile
  const svgWidth = 900;
  const svgHeight = 260;
  const padding = { top: 25, right: 35, bottom: 40, left: 55 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const minStrike = nearSmile.length ? nearSmile[0].strike : spotPrice * 0.9;
  const maxStrike = nearSmile.length ? nearSmile[nearSmile.length - 1].strike : spotPrice * 1.1;

  const ivValues = nearSmile.map((s) => s.iv);
  const minIv = Math.floor(Math.min(...ivValues) * 0.9);
  const maxIv = Math.ceil(Math.max(...ivValues) * 1.1);

  const getX = useCallback(
    (k: number) => {
      const norm = (k - minStrike) / (maxStrike - minStrike || 1);
      return padding.left + norm * plotWidth;
    },
    [minStrike, maxStrike, padding.left, plotWidth]
  );

  const getY = useCallback(
    (iv: number) => {
      const norm = (iv - minIv) / (maxIv - minIv || 1);
      return padding.top + (1 - norm) * plotHeight;
    },
    [minIv, maxIv, padding.top, plotHeight]
  );

  const smilePath = useMemo(() => {
    return nearSmile
      .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(p.strike).toFixed(1)} ${getY(p.iv).toFixed(1)}`)
      .join(" ");
  }, [nearSmile, getX, getY]);

  const spotX = getX(spotPrice);

  return (
    <div className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-2.5 font-mono">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 py-1.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30">
            OVDV &lt;GO&gt;
          </span>
          <span className="text-muted-foreground text-2xs">{"//"}</span>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Implied Volatility Surface, Skew &amp; Term Structure
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-muted-foreground border-l border-border pl-2">
            <Activity className="h-3 w-3 text-cyan-400" />
            Parametric SVI Smile Model
          </span>
        </div>

        {/* Underlying Selector */}
        <div className="flex items-center gap-1 text-2xs">
          {["NIFTY", "BANKNIFTY", "FINNIFTY"].map((sym) => (
            <Link
              key={sym}
              href={`/volatility?symbol=${sym}`}
              className={cn(
                "px-2 py-0.5 text-3xs font-bold uppercase tracking-wider border transition-colors",
                symbol === sym
                  ? "bg-amber-500 text-black border-amber-500"
                  : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {sym}
            </Link>
          ))}
          <span className="text-3xs text-muted-foreground pl-2">
            Spot: <strong className="text-foreground">{spotPrice.toLocaleString("en-IN")}</strong>
          </span>
        </div>
      </div>

      {/* 2. Executive Metric Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {/* Metric 1: Near ATM IV */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">ATM Implied Volatility</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground tabular-nums">
              {skewSummary.nearAtmIv.toFixed(2)}%
            </span>
            <span className="text-3xs text-muted-foreground">annualized</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Near expiry baseline</div>
        </div>

        {/* Metric 2: 25-Delta Risk Reversal */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">25Δ Risk Reversal (RR₂₅)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-rose-400 tabular-nums">
              +{skewSummary.riskReversal25D.toFixed(2)}%
            </span>
            <span className="text-3xs text-muted-foreground">IV Put − IV Call</span>
          </div>
          <div className="text-3xs text-rose-400/80 mt-0.5">Heavy downside put bid</div>
        </div>

        {/* Metric 3: 25-Delta Butterfly (Smile Curvature) */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">25Δ Butterfly (BF₂₅)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-cyan-400 tabular-nums">
              +{skewSummary.butterfly25D.toFixed(2)}%
            </span>
            <span className="text-3xs text-muted-foreground">Smile Kurtosis</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Fat tail risk pricing</div>
        </div>

        {/* Metric 4: Term Structure Regime */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Term Structure</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-xs font-bold uppercase",
                skewSummary.isContango ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {skewSummary.isContango ? "Contango" : "Backwardation"}
            </span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5 truncate">
            {skewSummary.termStructureRegime}
          </div>
        </div>
      </div>

      {/* 3. Skew Insight Banner */}
      <div className="border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-1.5 flex items-start gap-2 text-2xs">
        <Scale className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-3xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">SKEW INTERPRETATION: </strong>
          {skewSummary.skewInterpretation}
        </p>
      </div>

      {/* 4. Two-Column Visualizer: Smile Curve & Term Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Left: Volatility Smile Chart (2 Cols) */}
        <div className="lg:col-span-2 border border-border bg-card/80 p-2">
          <div className="flex items-center justify-between pb-1 border-b border-border/60 text-3xs text-muted-foreground">
            <span className="font-bold text-foreground uppercase tracking-wide">
              NEAR EXPIRY IMPLIED VOLATILITY SMILE &amp; SKEW
            </span>
            <span>Strike (₹) vs IV (%)</span>
          </div>

          <div className="overflow-x-auto mt-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[550px] select-none"
            >
              {/* Horizontal Grid lines */}
              {[minIv, (minIv + maxIv) / 2, maxIv].map((val) => (
                <g key={`grid-${val}`}>
                  <line
                    x1={padding.left}
                    y1={getY(val)}
                    x2={svgWidth - padding.right}
                    y2={getY(val)}
                    stroke="currentColor"
                    strokeDasharray="2 2"
                    className="text-border/60"
                  />
                  <text
                    x={padding.left - 6}
                    y={getY(val) + 3}
                    textAnchor="end"
                    className="fill-muted-foreground text-3xs font-mono"
                  >
                    {val.toFixed(1)}%
                  </text>
                </g>
              ))}

              {/* Current Spot Vertical Line */}
              <line
                x1={spotX}
                y1={padding.top}
                x2={spotX}
                y2={svgHeight - padding.bottom}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                strokeWidth="1.5"
              />
              <text
                x={spotX}
                y={padding.top - 6}
                textAnchor="middle"
                className="fill-amber-400 text-3xs font-mono font-bold"
              >
                ATM S₀ ({spotPrice.toLocaleString("en-IN")})
              </text>

              {/* Smile Curve */}
              <path
                d={smilePath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />

              {/* Data points */}
              {nearSmile.map((pt) => (
                <circle
                  key={`pt-${pt.strike}`}
                  cx={getX(pt.strike)}
                  cy={getY(pt.iv)}
                  r={Math.abs(pt.strike - spotPrice) < 50 ? "4" : "2.5"}
                  fill={Math.abs(pt.strike - spotPrice) < 50 ? "#f59e0b" : "#38bdf8"}
                />
              ))}

              {/* X Axis Labels */}
              {nearSmile
                .filter((_, idx) => idx % 3 === 0)
                .map((pt) => (
                  <text
                    key={`label-${pt.strike}`}
                    x={getX(pt.strike)}
                    y={svgHeight - padding.bottom + 15}
                    textAnchor="middle"
                    className="fill-muted-foreground text-3xs font-mono"
                  >
                    {pt.strike.toLocaleString("en-IN")}
                  </text>
                ))}
            </svg>
          </div>
        </div>

        {/* Right: Expiry Term Structure Progression */}
        <div className="border border-border bg-card/80 p-2 space-y-2">
          <div className="pb-1 border-b border-border/60 text-3xs font-bold text-foreground uppercase tracking-wide">
            EXPIRY TERM STRUCTURE
          </div>

          <div className="space-y-1.5">
            {termStructure.map((item, idx) => (
              <div
                key={item.label}
                className="border border-border/60 bg-muted/20 p-2 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-3xs font-bold text-foreground uppercase">{item.label}</span>
                    <span className="text-3xs text-muted-foreground">({item.daysToExpiry}D)</span>
                  </div>
                  <div className="text-3xs text-muted-foreground">{item.expiryDate}</div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-cyan-400 tabular-nums">
                    {item.atmIv.toFixed(2)}%
                  </span>
                  <div className="text-3xs text-muted-foreground">ATM IV</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-border/60 bg-muted/10 p-2 text-3xs text-muted-foreground">
            <strong className="text-foreground">Term Spread: </strong>
            Far ({termStructure[termStructure.length - 1]?.label}) − Near ({termStructure[0]?.label}) ={" "}
            <span
              className={cn(
                "font-bold font-mono",
                skewSummary.isContango ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {(
                (termStructure[termStructure.length - 1]?.atmIv || 0) -
                (termStructure[0]?.atmIv || 0)
              ).toFixed(2)}
              %
            </span>
          </div>
        </div>
      </div>

      {/* 5. 2D Strike x Expiry Heatmap Table */}
      <div className="border border-border bg-card/60 p-2 space-y-2">
        <div className="flex items-center justify-between border-b border-border pb-1">
          <span className="text-3xs uppercase font-bold text-foreground tracking-wider">
            2D VOLATILITY SURFACE MATRIX (STRIKE × EXPIRY IV %)
          </span>
          <span className="text-3xs text-muted-foreground">
            Highlight indicates At-The-Money (ATM)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-2xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                <th className="py-1 px-2">Strike (₹)</th>
                <th className="py-1 px-2 text-right">Moneyness</th>
                {termStructure.map((t) => (
                  <th key={t.label} className="py-1 px-2 text-right">
                    {t.label} ({t.daysToExpiry}D)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {surface.map((row) => (
                <tr
                  key={row.strike}
                  className={cn(
                    "hover:bg-muted/40 transition-colors font-mono",
                    row.isAtm ? "bg-amber-500/10 font-bold" : ""
                  )}
                >
                  <td className="py-1 px-2">
                    <span className={row.isAtm ? "text-amber-400" : "text-foreground"}>
                      {row.strike.toLocaleString("en-IN")}
                    </span>
                    {row.isAtm && (
                      <span className="ml-1 text-3xs bg-amber-500 text-black px-1 py-0.2 font-bold">
                        ATM
                      </span>
                    )}
                  </td>
                  <td className="py-1 px-2 text-right text-muted-foreground tabular-nums">
                    {Number(row.moneynessPct) > 0 ? "+" : ""}
                    {row.moneynessPct}%
                  </td>
                  {termStructure.map((t) => {
                    const val = Number(row[t.label] || 0);
                    return (
                      <td
                        key={t.label}
                        className={cn(
                          "py-1 px-2 text-right tabular-nums",
                          val > 20
                            ? "text-rose-400 font-semibold"
                            : val > 15
                            ? "text-amber-300"
                            : "text-cyan-400"
                        )}
                      >
                        {val.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Footer Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-3xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-foreground">RELATED TERMINAL WORKBENCHES:</span>
          <Link href={`/derivatives?symbol=${symbol}`} className="text-cyan-400 hover:underline">
            OMON &lt;GO&gt; (Option Chain)
          </Link>
          <Link href={`/strategy-builder?symbol=${symbol}`} className="text-cyan-400 hover:underline">
            OSB &lt;GO&gt; (Strategy Builder)
          </Link>
          <Link href="/participant-oi" className="text-cyan-400 hover:underline">
            PART &lt;GO&gt; (Participant OI)
          </Link>
        </div>

        <div>
          <span>Calibrated to NSE option contracts and closing IV settlement</span>
        </div>
      </div>
    </div>
  );
}
