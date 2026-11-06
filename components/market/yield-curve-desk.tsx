"use client";

import { useState, useMemo, useCallback } from "react";
import {
  TrendingUp,
  Landmark,
  Scale,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { ApiYieldCurveResponse, ApiYieldTenor } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface YieldCurveDeskProps {
  initialData: ApiYieldCurveResponse;
}

export function YieldCurveDesk({ initialData }: YieldCurveDeskProps) {
  const [activeOverlay, setActiveOverlay] = useState<"none" | "1w" | "1m" | "1y">("1w");
  const [showModelFit, setShowModelFit] = useState<boolean>(true);
  const [selectedTenor, setSelectedTenor] = useState<string>("10Y");

  const { spreads, rbiCorridor, tenors, spreadMatrix, benchmark10y, benchmarkPaper } = initialData;

  // Compute SVG dimensions and coordinates for par yield curve
  const svgWidth = 900;
  const svgHeight = 280;
  const padding = { top: 25, right: 30, bottom: 40, left: 50 };

  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Min and max yields across current, historical, and corridor
  const allYields = useMemo(() => {
    const list: number[] = [
      rbiCorridor.sdfRate,
      rbiCorridor.repoRate,
      rbiCorridor.msfRate,
    ];
    tenors.forEach((t) => {
      list.push(t.yieldPct);
      list.push(t.modelYieldPct);
      list.push(t.history.oneWeekAgo);
      list.push(t.history.oneMonthAgo);
      list.push(t.history.oneYearAgo);
    });
    return list;
  }, [tenors, rbiCorridor]);

  const minY = Math.floor((Math.min(...allYields) - 0.25) * 4) / 4;
  const maxY = Math.ceil((Math.max(...allYields) + 0.25) * 4) / 4;

  // Mapping functions
  // Logarithmic-like tenor spacing for financial maturity visualization (0.25y to 40y)
  const getX = useCallback((years: number) => {
    const logMin = Math.log10(0.25);
    const logMax = Math.log10(40);
    const logVal = Math.log10(Math.max(0.25, Math.min(40, years)));
    const normalized = (logVal - logMin) / (logMax - logMin);
    return padding.left + normalized * plotWidth;
  }, [padding.left, plotWidth]);

  const getY = useCallback((val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    const normalized = (clamped - minY) / (maxY - minY);
    return padding.top + (1 - normalized) * plotHeight;
  }, [minY, maxY, padding.top, plotHeight]);

  // Generate SVG path strings
  const currentPath = useMemo(() => {
    return tenors
      .map((t, i) => `${i === 0 ? "M" : "L"} ${getX(t.years).toFixed(1)} ${getY(t.yieldPct).toFixed(1)}`)
      .join(" ");
  }, [tenors, getX, getY]);

  const overlayPath = useMemo(() => {
    if (activeOverlay === "none") return "";
    return tenors
      .map((t, i) => {
        const val =
          activeOverlay === "1w"
            ? t.history.oneWeekAgo
            : activeOverlay === "1m"
            ? t.history.oneMonthAgo
            : t.history.oneYearAgo;
        return `${i === 0 ? "M" : "L"} ${getX(t.years).toFixed(1)} ${getY(val).toFixed(1)}`;
      })
      .join(" ");
  }, [tenors, activeOverlay, getX, getY]);

  const modelFitPath = useMemo(() => {
    if (!showModelFit) return "";
    // Sample 50 points along Nelson-Siegel curve for perfectly smooth curve
    const points: string[] = [];
    const count = 50;
    for (let i = 0; i <= count; i++) {
      const frac = i / count;
      const yrs = 0.25 * Math.pow(40 / 0.25, frac);
      const x = getX(yrs);
      const yVal = initialData.nelsonSiegelFit.beta0 +
        initialData.nelsonSiegelFit.beta1 * ((1 - Math.exp(-yrs / initialData.nelsonSiegelFit.lambda)) / (yrs / initialData.nelsonSiegelFit.lambda)) +
        initialData.nelsonSiegelFit.beta2 * (((1 - Math.exp(-yrs / initialData.nelsonSiegelFit.lambda)) / (yrs / initialData.nelsonSiegelFit.lambda)) - Math.exp(-yrs / initialData.nelsonSiegelFit.lambda));
      const y = getY(yVal);
      points.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join(" ");
  }, [showModelFit, initialData.nelsonSiegelFit, getX, getY]);

  const activeTenorDetail = tenors.find((t) => t.tenor === selectedTenor) || tenors[7]; // default 10Y

  return (
    <div className="w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4 space-y-2 font-mono">
      {/* TERMINAL TOP STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-surface px-2.5 py-1.5 rounded-none shadow-xs text-2xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-accent">
            <TrendingUp className="h-4 w-4" />
            <span>GC IN &lt;GO&gt; · INDIA SOVEREIGN PAR YIELD CURVE DESK</span>
          </span>
          <span className="text-3xs text-muted-foreground border-l border-border/60 pl-2">
            GOVERNMENT OF INDIA BENCHMARK SECURITIES
          </span>
        </div>
        <div className="flex items-center gap-3 text-3xs text-muted-foreground">
          <span>Benchmark Paper: <strong className="text-foreground">{benchmarkPaper}</strong></span>
          <span>10Y Benchmark: <strong className="text-accent">{benchmark10y.toFixed(2)}%</strong></span>
          <span>2s10s Slope: <strong className={spreads.spread2s10sBps >= 0 ? "text-up" : "text-down"}>
            {spreads.spread2s10sBps >= 0 ? "+" : ""}{spreads.spread2s10sBps.toFixed(1)} bps
          </strong></span>
        </div>
      </div>

      {/* 6-METRIC FIXED INCOME COMMAND RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-muted-foreground uppercase tracking-wider">10Y Benchmark G-Sec</div>
          <div className="text-base font-bold text-accent tabular-nums">{benchmark10y.toFixed(2)}%</div>
          <div className="text-3xs text-muted-foreground truncate">{benchmarkPaper}</div>
        </div>

        <div className={cn(
          "border p-2 rounded-none cell-glow space-y-0.5",
          spreads.spread2s10sBps >= 0 ? "border-up/40 bg-up/[0.02]" : "border-down/40 bg-down/[0.02]"
        )}>
          <div className="text-3xs text-muted-foreground uppercase tracking-wider">2s10s Slope Spread</div>
          <div className={cn("text-base font-bold tabular-nums", spreads.spread2s10sBps >= 0 ? "text-up" : "text-down")}>
            {spreads.spread2s10sBps >= 0 ? "+" : ""}{spreads.spread2s10sBps.toFixed(1)} bps
          </div>
          <div className="text-3xs text-muted-foreground">
            {spreads.inverted2s10s ? "Curve Inverted" : "Normal Upward Slope"}
          </div>
        </div>

        <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-muted-foreground uppercase tracking-wider">5s10s Slope Spread</div>
          <div className="text-base font-bold text-foreground tabular-nums">
            {spreads.spread5s10sBps >= 0 ? "+" : ""}{spreads.spread5s10sBps.toFixed(1)} bps
          </div>
          <div className="text-3xs text-muted-foreground">Medium Horizon Steepness</div>
        </div>

        <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-muted-foreground uppercase tracking-wider">3M10Y Term Premium</div>
          <div className="text-base font-bold text-foreground tabular-nums">
            {spreads.spread3m10yBps >= 0 ? "+" : ""}{spreads.spread3m10yBps.toFixed(1)} bps
          </div>
          <div className="text-3xs text-muted-foreground">91D T-Bill vs 10Y Benchmark</div>
        </div>

        <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-muted-foreground uppercase tracking-wider">Repo Policy Spread</div>
          <div className="text-base font-bold text-foreground tabular-nums">
            {spreads.termPremiumRepoBps >= 0 ? "+" : ""}{spreads.termPremiumRepoBps.toFixed(1)} bps
          </div>
          <div className="text-3xs text-muted-foreground">10Y Benchmark over 6.50% Repo</div>
        </div>

        <div className="border border-amber-500/40 bg-amber-500/[0.02] p-2 rounded-none cell-glow space-y-0.5">
          <div className="text-3xs text-amber-500 uppercase tracking-wider">Curve Architecture</div>
          <div className="text-xs font-bold text-foreground truncate mt-1">{initialData.curveShape}</div>
          <div className="text-3xs text-muted-foreground">Nelson-Siegel R² &gt; 0.99</div>
        </div>
      </div>

      {/* YIELD CURVE INTERACTIVE CHART & CONTROL BANNER */}
      <div className="border border-border bg-surface p-2.5 rounded-none space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2 text-2xs">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-accent" />
              <span>Sovereign Par Curve (CCIL &amp; RBI NDS-OM Secondary Feeds)</span>
            </span>
          </div>

          {/* Curve Overlay Controls */}
          <div className="flex flex-wrap items-center gap-2 text-3xs font-mono">
            <div className="flex items-center border border-border bg-surface-muted p-0.5 rounded-none">
              <span className="text-muted-foreground uppercase font-semibold px-1.5">Overlay:</span>
              {[
                { id: "none", label: "None" },
                { id: "1w", label: "1W Ago" },
                { id: "1m", label: "1M Ago" },
                { id: "1y", label: "1Y Ago" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveOverlay(m.id as "none" | "1w" | "1m" | "1y")}
                  className={cn(
                    "px-2 py-0.5 font-bold uppercase rounded-none transition-colors",
                    activeOverlay === m.id
                      ? "bg-foreground text-background shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowModelFit(!showModelFit)}
              className={cn(
                "px-2 py-1 border rounded-none font-bold uppercase transition-colors text-3xs",
                showModelFit
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface-muted/60 border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Nelson-Siegel Fit
            </button>
          </div>
        </div>

        {/* SVG Curve Plot */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-[280px] select-none font-mono"
            role="img"
            aria-label="Indian Sovereign Par Yield Curve Chart"
          >
            {/* Grid Lines & Y-Axis Labels */}
            {[minY, (minY + maxY) / 2, maxY].map((yVal, i) => {
              const yPos = getY(yVal);
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={svgWidth - padding.right}
                    y2={yPos}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="2 2"
                  />
                  <text
                    x={padding.left - 8}
                    y={yPos + 4}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-[10px] fill-muted-foreground"
                  >
                    {yVal.toFixed(2)}%
                  </text>
                </g>
              );
            })}

            {/* RBI Policy Corridor Reference Lines */}
            <g>
              {/* MSF Ceiling */}
              <line
                x1={padding.left}
                y1={getY(rbiCorridor.msfRate)}
                x2={svgWidth - padding.right}
                y2={getY(rbiCorridor.msfRate)}
                stroke="rgb(239, 68, 68)"
                strokeOpacity={0.4}
                strokeDasharray="3 3"
              />
              <text
                x={svgWidth - padding.right - 4}
                y={getY(rbiCorridor.msfRate) - 4}
                textAnchor="end"
                className="text-[9px] fill-red-400 font-bold"
              >
                MSF Ceiling {rbiCorridor.msfRate.toFixed(2)}%
              </text>

              {/* Repo Policy Rate */}
              <line
                x1={padding.left}
                y1={getY(rbiCorridor.repoRate)}
                x2={svgWidth - padding.right}
                y2={getY(rbiCorridor.repoRate)}
                stroke="rgb(245, 158, 11)"
                strokeOpacity={0.6}
                strokeDasharray="4 2"
              />
              <text
                x={svgWidth - padding.right - 4}
                y={getY(rbiCorridor.repoRate) - 4}
                textAnchor="end"
                className="text-[9px] fill-amber-500 font-bold"
              >
                Policy Repo {rbiCorridor.repoRate.toFixed(2)}%
              </text>

              {/* SDF Floor */}
              <line
                x1={padding.left}
                y1={getY(rbiCorridor.sdfRate)}
                x2={svgWidth - padding.right}
                y2={getY(rbiCorridor.sdfRate)}
                stroke="rgb(16, 185, 129)"
                strokeOpacity={0.4}
                strokeDasharray="3 3"
              />
              <text
                x={svgWidth - padding.right - 4}
                y={getY(rbiCorridor.sdfRate) + 10}
                textAnchor="end"
                className="text-[9px] fill-emerald-400 font-bold"
              >
                SDF Floor {rbiCorridor.sdfRate.toFixed(2)}%
              </text>
            </g>

            {/* Historical Overlay Path */}
            {activeOverlay !== "none" && overlayPath && (
              <path
                d={overlayPath}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.4}
                strokeWidth={1.8}
                strokeDasharray="4 3"
              />
            )}

            {/* Nelson-Siegel Theoretical Fit Path */}
            {showModelFit && modelFitPath && (
              <path
                d={modelFitPath}
                fill="none"
                stroke="rgb(56, 189, 248)"
                strokeOpacity={0.45}
                strokeWidth={1.5}
              />
            )}

            {/* Current Yield Curve Primary Path */}
            <path
              d={currentPath}
              fill="none"
              stroke="rgb(250, 204, 21)"
              strokeWidth={2.5}
            />

            {/* Tenor Dots and Labels */}
            {tenors.map((t) => {
              const xPos = getX(t.years);
              const yPos = getY(t.yieldPct);
              const isSelected = t.tenor === selectedTenor;

              return (
                <g
                  key={t.tenor}
                  className="cursor-pointer group"
                  onClick={() => setSelectedTenor(t.tenor)}
                >
                  {/* Vertical guide on hover / selection */}
                  {isSelected && (
                    <line
                      x1={xPos}
                      y1={padding.top}
                      x2={xPos}
                      y2={svgHeight - padding.bottom}
                      stroke="rgb(250, 204, 21)"
                      strokeOpacity={0.3}
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Dot */}
                  <circle
                    cx={xPos}
                    cy={yPos}
                    r={isSelected ? 5.5 : t.benchmark ? 4.5 : 3.5}
                    fill={t.benchmark ? "rgb(250, 204, 21)" : "rgb(255, 255, 255)"}
                    stroke={isSelected ? "rgb(56, 189, 248)" : "rgb(0, 0, 0)"}
                    strokeWidth={isSelected ? 2 : 1}
                  />

                  {/* Yield Label over Dot */}
                  <text
                    x={xPos}
                    y={yPos - 8}
                    textAnchor="middle"
                    className={cn(
                      "text-[9px] font-mono tabular-nums font-bold",
                      isSelected ? "fill-accent" : t.benchmark ? "fill-gold font-extrabold" : "fill-foreground"
                    )}
                  >
                    {t.yieldPct.toFixed(2)}%
                  </text>

                  {/* Tenor Label on X-Axis */}
                  <text
                    x={xPos}
                    y={svgHeight - padding.bottom + 14}
                    textAnchor="middle"
                    className={cn(
                      "text-[10px] font-mono",
                      isSelected ? "fill-accent font-bold" : t.benchmark ? "fill-gold font-extrabold" : "fill-muted-foreground"
                    )}
                  >
                    {t.tenor}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-3xs text-muted-foreground pt-1 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1 w-4 bg-gold" />
              <strong className="text-foreground">Current Par Curve</strong>
            </span>
            {activeOverlay !== "none" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-4 bg-muted-foreground/60 border-t border-dashed" />
                <span>{activeOverlay === "1w" ? "1-Week Ago" : activeOverlay === "1m" ? "1-Month Ago" : "1-Year Ago"}</span>
              </span>
            )}
            {showModelFit && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-4 bg-sky-400" />
                <span className="text-sky-400">Nelson-Siegel Model Curve</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1 w-3 bg-amber-500" />
              <span>RBI Operating Corridor (SDF 6.25% – Repo 6.50% – MSF 6.75%)</span>
            </span>
          </div>
          <span>Click any tenor dot to inspect horizon telemetry</span>
        </div>
      </div>

      {/* ACTIVE TENOR INSPECTOR & SPREAD CORRIDORS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Selected Tenor Inspector Card */}
        <div className="border border-border bg-surface p-2.5 rounded-none space-y-2">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5 text-2xs">
            <span className="font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" />
              <span>Tenor Telemetry: {activeTenorDetail.label}</span>
            </span>
            <span className="text-3xs text-muted-foreground">{activeTenorDetail.category}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-2xs">
            <div className="border border-border/80 bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase">Current Par Yield</span>
              <div className="text-base font-bold text-accent font-mono">
                {activeTenorDetail.yieldPct.toFixed(2)}%
              </div>
              <div className="text-3xs text-muted-foreground">Nelson-Siegel: {activeTenorDetail.modelYieldPct.toFixed(2)}%</div>
            </div>

            <div className="border border-border/80 bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase">1-Week Delta</span>
              <div className={cn("text-base font-bold font-mono", activeTenorDetail.change1wBps > 0 ? "text-down" : activeTenorDetail.change1wBps < 0 ? "text-up" : "")}>
                {activeTenorDetail.change1wBps > 0 ? "+" : ""}{activeTenorDetail.change1wBps.toFixed(1)} bps
              </div>
              <div className="text-3xs text-muted-foreground">Previous: {activeTenorDetail.history.oneWeekAgo.toFixed(2)}%</div>
            </div>

            <div className="border border-border/80 bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase">1-Month Delta</span>
              <div className={cn("text-base font-bold font-mono", activeTenorDetail.change1mBps > 0 ? "text-down" : activeTenorDetail.change1mBps < 0 ? "text-up" : "")}>
                {activeTenorDetail.change1mBps > 0 ? "+" : ""}{activeTenorDetail.change1mBps.toFixed(1)} bps
              </div>
              <div className="text-3xs text-muted-foreground">Previous: {activeTenorDetail.history.oneMonthAgo.toFixed(2)}%</div>
            </div>

            <div className="border border-border/80 bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase">1-Year Delta</span>
              <div className={cn("text-base font-bold font-mono", activeTenorDetail.change1yBps > 0 ? "text-down" : activeTenorDetail.change1yBps < 0 ? "text-up" : "")}>
                {activeTenorDetail.change1yBps > 0 ? "+" : ""}{activeTenorDetail.change1yBps.toFixed(1)} bps
              </div>
              <div className="text-3xs text-muted-foreground">Previous: {activeTenorDetail.history.oneYearAgo.toFixed(2)}%</div>
            </div>
          </div>

          <div className="text-3xs text-muted-foreground border-t border-border/60 pt-1.5">
            <strong>Traded Paper:</strong> {activeTenorDetail.paper}
          </div>
        </div>

        {/* Sovereign vs SDL vs AAA Corporate Spread Matrix */}
        <div className="lg:col-span-2 border border-border bg-surface p-2.5 rounded-none space-y-2">
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5 text-2xs">
            <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-accent" />
              <span>Credit &amp; Sub-Sovereign Spread Differentials (Over 10Y G-Sec)</span>
            </span>
            <span className="text-3xs text-muted-foreground">Primary Auction &amp; Traded Secondary</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-2xs font-mono">
              <thead>
                <tr className="border-b border-border bg-surface-muted/70 text-3xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-2 py-1 text-left font-bold text-foreground">Asset Class</th>
                  <th scope="col" className="px-2 py-1 text-left font-medium">Issuer / Sector</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Indicative Yield</th>
                  <th scope="col" className="px-2 py-1 text-right font-bold text-accent">Spread over G-Sec</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Credit Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {spreadMatrix.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-2 py-1.5 font-bold text-foreground whitespace-nowrap">{item.assetClass}</td>
                    <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[220px]">{item.issuer}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums font-semibold text-foreground">
                      {item.indicativeYield.toFixed(2)}%
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums font-extrabold text-accent">
                      {item.spreadOverGsecBps > 0 ? `+${item.spreadOverGsecBps.toFixed(1)} bps` : "PAR BENCHMARK"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-3xs text-muted-foreground whitespace-nowrap">
                      {item.creditRating}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FULL PAR TENOR SHIFT DIRECTORY TABLE */}
      <div className="overflow-x-auto border border-border bg-surface rounded-none">
        <table className="w-full min-w-[880px] border-collapse text-2xs font-mono">
          <caption className="sr-only">India sovereign par yield curve full tenor table</caption>
          <thead>
            <tr className="border-b border-border bg-surface-muted/80 text-3xs uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-2.5 py-1.5 text-left font-bold text-foreground">Tenor Horizon</th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Instrument Label</th>
              <th scope="col" className="px-2 py-1.5 text-center font-medium">Maturity (Yrs)</th>
              <th scope="col" className="px-2 py-1.5 text-right font-bold text-accent">Current Yield</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Nelson-Siegel Model</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">1W Change</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">1M Change</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">1Y Change</th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Traded Benchmark Paper</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {tenors.map((t) => {
              const isSelected = t.tenor === selectedTenor;
              return (
                <tr
                  key={t.tenor}
                  onClick={() => setSelectedTenor(t.tenor)}
                  className={cn(
                    "hover:bg-surface-muted/60 transition-colors cursor-pointer group",
                    isSelected && "bg-accent/10 border-l-2 border-l-accent",
                    t.benchmark && "bg-gold/[0.03]",
                  )}
                >
                  <td className="px-2.5 py-1.5 font-bold text-foreground whitespace-nowrap">
                    <span className={cn(t.benchmark ? "text-gold font-extrabold" : "text-foreground")}>
                      {t.tenor}
                    </span>
                    {t.benchmark && (
                      <span className="ml-1.5 px-1 py-0.2 text-3xs font-extrabold bg-gold/20 text-gold border border-gold/40 rounded-none">
                        BENCHMARK
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground whitespace-nowrap">{t.label}</td>
                  <td className="px-2 py-1.5 text-center font-mono tabular-nums text-muted-foreground">{t.years.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums font-bold text-accent">
                    {t.yieldPct.toFixed(2)}%
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                    {t.modelYieldPct.toFixed(2)}%
                  </td>
                  <td className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums font-semibold",
                    t.change1wBps > 0 ? "text-down" : t.change1wBps < 0 ? "text-up" : "text-muted-foreground"
                  )}>
                    {t.change1wBps > 0 ? "+" : ""}{t.change1wBps.toFixed(1)} bps
                  </td>
                  <td className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums font-semibold",
                    t.change1mBps > 0 ? "text-down" : t.change1mBps < 0 ? "text-up" : "text-muted-foreground"
                  )}>
                    {t.change1mBps > 0 ? "+" : ""}{t.change1mBps.toFixed(1)} bps
                  </td>
                  <td className={cn(
                    "px-2 py-1.5 text-right font-mono tabular-nums font-semibold",
                    t.change1yBps > 0 ? "text-down" : t.change1yBps < 0 ? "text-up" : "text-muted-foreground"
                  )}>
                    {t.change1yBps > 0 ? "+" : ""}{t.change1yBps.toFixed(1)} bps
                  </td>
                  <td className="px-2.5 py-1.5 text-3xs text-muted-foreground truncate max-w-[200px]" title={t.paper}>
                    {t.paper}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTNOTE */}
      <div className="flex flex-wrap items-center justify-between text-3xs text-muted-foreground pt-1 border-t border-border/40">
        <span>Source: Reserve Bank of India (RBI NDS-OM), Clearing Corporation of India (CCIL) &amp; FIMMDA Sovereign Benchmark.</span>
        <span>All yields reported in par annual basis (semi-annual coupon convention scaled). Nelson-Siegel 4-factor parameters calibrated to live par curve.</span>
      </div>
    </div>
  );
}
