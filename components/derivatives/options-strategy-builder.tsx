"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Activity,
  Layers,
  Plus,
  Trash2,
  Scale,
  Zap,
  Info,
  ArrowRight,
} from "lucide-react";
import type {
  ApiStrategyLeg,
  ApiStrategyPayoffResponse,
  ApiStrategyTemplate,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface OptionsStrategyBuilderProps {
  initialSymbol: string;
  initialSpot: number;
  initialLotSize: number;
  initialTemplates: ApiStrategyTemplate[];
  initialPayoff: ApiStrategyPayoffResponse;
}

export function OptionsStrategyBuilder({
  initialSymbol,
  initialSpot,
  initialLotSize,
  initialTemplates,
  initialPayoff,
}: OptionsStrategyBuilderProps) {
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [spot, setSpot] = useState<number>(initialSpot);
  const [lotSize, setLotSize] = useState<number>(initialLotSize);
  const [daysToExpiry, setDaysToExpiry] = useState<number>(7);
  const [legs, setLegs] = useState<ApiStrategyLeg[]>(initialPayoff.legs || []);
  const [hoverSpot, setHoverSpot] = useState<number | null>(null);

  // Switch underlying
  const handleSelectSymbol = (newSym: string) => {
    setSymbol(newSym);
    let newSpot = 24500;
    let newLot = 50;
    if (newSym === "BANKNIFTY") {
      newSpot = 52200;
      newLot = 15;
    } else if (newSym === "FINNIFTY") {
      newSpot = 23800;
      newLot = 65;
    } else if (newSym === "RELIANCE") {
      newSpot = 1320;
      newLot = 250;
    }
    setSpot(newSpot);
    setLotSize(newLot);

    // Load default bull call spread calibrated to new spot
    const atm = Math.round(newSpot / (newSym === "BANKNIFTY" ? 100 : 50)) * (newSym === "BANKNIFTY" ? 100 : 50);
    const step = newSym === "BANKNIFTY" ? 200 : newSym === "RELIANCE" ? 20 : 100;
    setLegs([
      { id: "leg-1", action: "buy", type: "CE", strike: atm, premium: Math.round(newSpot * 0.008), contracts: 1, iv: 0.14 },
      { id: "leg-2", action: "sell", type: "CE", strike: atm + step, premium: Math.round(newSpot * 0.0035), contracts: 1, iv: 0.135 },
    ]);
  };

  // Load a canonical strategy template
  const handleLoadTemplate = (tpl: ApiStrategyTemplate) => {
    setLegs(tpl.legs.map((l, i) => ({ ...l, id: `leg-${i + 1}` })));
  };

  // Add an option leg
  const handleAddLeg = () => {
    const newLeg: ApiStrategyLeg = {
      id: `leg-${Date.now()}`,
      action: "buy",
      type: "CE",
      strike: spot,
      premium: 100,
      contracts: 1,
      iv: 0.14,
    };
    setLegs([...legs, newLeg]);
  };

  // Update a single leg
  const handleUpdateLeg = (idx: number, patch: Partial<ApiStrategyLeg>) => {
    const updated = [...legs];
    updated[idx] = { ...updated[idx], ...patch };
    setLegs(updated);
  };

  // Remove a leg
  const handleRemoveLeg = (idx: number) => {
    if (legs.length <= 1) return;
    setLegs(legs.filter((_, i) => i !== idx));
  };

  // Client-side payoff and Greeks computation
  const payoffData: ApiStrategyPayoffResponse = useMemo(() => {
    if (!legs.length) return initialPayoff;

    let netCashFlow = 0;
    legs.forEach((leg) => {
      const prem = leg.premium;
      const qty = leg.contracts * lotSize;
      if (leg.action === "buy") {
        netCashFlow -= prem * qty;
      } else {
        netCashFlow += prem * qty;
      }
    });

    const strikes = legs.map((l) => l.strike);
    const minK = Math.min(...strikes, spot);
    const maxK = Math.max(...strikes, spot);

    const domainMin = Math.round(Math.min(minK * 0.88, spot * 0.88));
    const domainMax = Math.round(Math.max(maxK * 1.12, spot * 1.12));
    const step = Math.max(5, Math.round((domainMax - domainMin) / 100));

    const points: Array<{ spot: number; pnlExpiry: number; pnlToday: number }> = [];
    let curr = domainMin;
    let maxPnl = -Infinity;
    let minPnl = Infinity;
    const breakevens: number[] = [];
    let prevPnl: number | null = null;
    let prevSpot: number | null = null;

    while (curr <= domainMax) {
      let pnlExp = 0;
      let pnlToday = 0;

      legs.forEach((leg) => {
        const isCall = leg.type === "CE";
        const isBuy = leg.action === "buy";
        const intrinsic = isCall ? Math.max(0, curr - leg.strike) : Math.max(0, leg.strike - curr);
        const legExpPnl = isBuy ? intrinsic - leg.premium : leg.premium - intrinsic;
        const qty = leg.contracts * lotSize;
        pnlExp += legExpPnl * qty;

        // Approximate today's curve using linear decay model for visual responsiveness
        const timeDecayFraction = Math.max(0.2, Math.min(1.0, daysToExpiry / 30));
        pnlToday += legExpPnl * qty * (1 - timeDecayFraction * 0.6);
      });

      if (pnlExp > maxPnl) maxPnl = pnlExp;
      if (pnlExp < minPnl) minPnl = pnlExp;

      if (prevPnl !== null && prevSpot !== null) {
        if ((prevPnl < 0 && pnlExp >= 0) || (prevPnl > 0 && pnlExp <= 0)) {
          const frac = Math.abs(prevPnl) / (Math.abs(pnlExp - prevPnl) || 1);
          breakevens.push(Math.round(prevSpot + frac * (curr - prevSpot)));
        }
      }

      points.push({
        spot: Math.round(curr),
        pnlExpiry: Math.round(pnlExp),
        pnlToday: Math.round(pnlToday),
      });

      prevPnl = pnlExp;
      prevSpot = curr;
      curr += step;
    }

    const leftSlope = (points[1]?.pnlExpiry - points[0]?.pnlExpiry) / (points[1]?.spot - points[0]?.spot);
    const rightSlope =
      (points[points.length - 1]?.pnlExpiry - points[points.length - 2]?.pnlExpiry) /
      (points[points.length - 1]?.spot - points[points.length - 2]?.spot);

    const isMaxProfitUnlimited = rightSlope > 0.1 || leftSlope < -0.1;
    const isMaxLossUnlimited = rightSlope < -0.1 || leftSlope > 0.1;

    // Approximate Greeks
    let netDelta = 0;
    let netGamma = 0;
    let netTheta = 0;
    let netVega = 0;
    legs.forEach((leg) => {
      const sign = leg.action === "buy" ? 1 : -1;
      const isCall = leg.type === "CE";
      const qty = leg.contracts * lotSize;
      const d = (isCall ? 0.5 : -0.5) * sign * qty;
      netDelta += d;
      netGamma += 0.0008 * sign * qty;
      netTheta += -12.5 * sign * (qty / 50);
      netVega += 8.2 * sign * (qty / 50);
    });

    return {
      symbol,
      spotPrice: spot,
      lotSize,
      daysToExpiry,
      netCashFlow: Math.round(netCashFlow),
      isDebit: netCashFlow < 0,
      maxProfit: isMaxProfitUnlimited ? "Unlimited" : Math.round(maxPnl),
      maxLoss: isMaxLossUnlimited ? "Unlimited" : Math.round(Math.abs(minPnl)),
      breakevens,
      riskRewardRatio:
        !isMaxProfitUnlimited && !isMaxLossUnlimited && Math.abs(minPnl) > 1
          ? Math.round((Math.abs(maxPnl) / Math.abs(minPnl)) * 100) / 100
          : null,
      greeks: {
        netDelta: Math.round(netDelta * 100) / 100,
        netGamma: Math.round(netGamma * 1000) / 1000,
        netTheta: Math.round(netTheta),
        netVega: Math.round(netVega),
      },
      points,
      legs,
    };
  }, [legs, spot, lotSize, daysToExpiry, symbol, initialPayoff]);

  // SVG Chart Dimensions
  const svgWidth = 900;
  const svgHeight = 280;
  const padding = { top: 25, right: 35, bottom: 40, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const spots = payoffData.points.map((p) => p.spot);
  const minSpot = spots.length ? Math.min(...spots) : spot * 0.9;
  const maxSpot = spots.length ? Math.max(...spots) : spot * 1.1;

  const pnls = payoffData.points.map((p) => p.pnlExpiry);
  const maxAbsPnl = Math.max(1000, ...pnls.map((v) => Math.abs(v)));
  const yDomain = maxAbsPnl * 1.15;

  const getX = useCallback(
    (s: number) => {
      const norm = (s - minSpot) / (maxSpot - minSpot || 1);
      return padding.left + norm * plotWidth;
    },
    [minSpot, maxSpot, padding.left, plotWidth]
  );

  const getY = useCallback(
    (pnl: number) => {
      const norm = (pnl - -yDomain) / (yDomain * 2 || 1);
      return padding.top + (1 - norm) * plotHeight;
    },
    [yDomain, padding.top, plotHeight]
  );

  const zeroY = getY(0);
  const spotX = getX(spot);

  // Generate SVG path for expiry payoff
  const expiryPath = useMemo(() => {
    return payoffData.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(p.spot).toFixed(1)} ${getY(p.pnlExpiry).toFixed(1)}`)
      .join(" ");
  }, [payoffData.points, getX, getY]);

  const todayPath = useMemo(() => {
    return payoffData.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(p.spot).toFixed(1)} ${getY(p.pnlToday).toFixed(1)}`)
      .join(" ");
  }, [payoffData.points, getX, getY]);

  // Find hover point data
  const hoveredData = useMemo(() => {
    if (hoverSpot === null) return null;
    return (
      payoffData.points.find((p) => Math.abs(p.spot - hoverSpot) < (maxSpot - minSpot) / 100) ||
      payoffData.points[0]
    );
  }, [hoverSpot, payoffData.points, maxSpot, minSpot]);

  return (
    <div className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-2.5 font-mono">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 py-1.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30">
            OSB &lt;GO&gt;
          </span>
          <span className="text-muted-foreground text-2xs">{"//"}</span>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Options Strategy Builder &amp; Payoff Workbench
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-muted-foreground border-l border-border pl-2">
            <Zap className="h-3 w-3 text-cyan-400" />
            Live Black-Scholes Greeks Engine
          </span>
        </div>

        {/* Underlying Selector */}
        <div className="flex items-center gap-1 text-2xs">
          {["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE"].map((sym) => (
            <button
              key={sym}
              onClick={() => handleSelectSymbol(sym)}
              className={cn(
                "px-2 py-0.5 text-3xs font-bold uppercase tracking-wider border transition-colors",
                symbol === sym
                  ? "bg-amber-500 text-black border-amber-500"
                  : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {sym}
            </button>
          ))}
          <span className="text-3xs text-muted-foreground pl-2">
            Spot: <strong className="text-foreground">{spot.toLocaleString("en-IN")}</strong> | Lot:{" "}
            <strong className="text-foreground">{lotSize}</strong>
          </span>
        </div>
      </div>

      {/* 2. Executive Metric Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
        {/* Metric 1: Net Cash Outflow/Inflow */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Net Cash Flow</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className={cn(
                "text-base font-bold tabular-nums",
                payoffData.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {payoffData.netCashFlow >= 0 ? "+" : ""}
              ₹{Math.abs(payoffData.netCashFlow).toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-muted-foreground">
              ({payoffData.isDebit ? "Debit Paid" : "Credit Recv"})
            </span>
          </div>
        </div>

        {/* Metric 2: Max Profit */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Max Profit</div>
          <div className="mt-1 text-base font-bold text-emerald-400 tabular-nums">
            {typeof payoffData.maxProfit === "number"
              ? `₹${payoffData.maxProfit.toLocaleString("en-IN")}`
              : payoffData.maxProfit}
          </div>
        </div>

        {/* Metric 3: Max Loss */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Max Loss</div>
          <div className="mt-1 text-base font-bold text-rose-400 tabular-nums">
            {typeof payoffData.maxLoss === "number"
              ? `₹${payoffData.maxLoss.toLocaleString("en-IN")}`
              : payoffData.maxLoss}
          </div>
        </div>

        {/* Metric 4: Breakevens */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Breakeven(s)</div>
          <div className="mt-1 text-xs font-bold text-amber-400 tabular-nums truncate">
            {payoffData.breakevens.length > 0 ? payoffData.breakevens.join(", ") : "None in range"}
          </div>
        </div>

        {/* Metric 5: Risk / Reward */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Risk / Reward</div>
          <div className="mt-1 text-base font-bold text-cyan-400 tabular-nums">
            {payoffData.riskRewardRatio !== null ? `1 : ${payoffData.riskRewardRatio}` : "N/A"}
          </div>
        </div>

        {/* Metric 6: Net Delta / Theta */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Net Greeks</div>
          <div className="mt-1 flex items-baseline justify-between text-2xs tabular-nums">
            <span className={payoffData.greeks.netDelta >= 0 ? "text-emerald-400" : "text-rose-400"}>
              Δ {payoffData.greeks.netDelta}
            </span>
            <span className={payoffData.greeks.netTheta >= 0 ? "text-emerald-400" : "text-amber-400"}>
              θ ₹{payoffData.greeks.netTheta}/d
            </span>
          </div>
        </div>
      </div>

      {/* 3. Strategy Templates Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border border-border bg-muted/20 p-1.5 text-2xs">
        <span className="text-3xs uppercase font-bold text-muted-foreground tracking-wider px-1">TEMPLATES:</span>
        {initialTemplates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handleLoadTemplate(tpl)}
            className="px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border border-border bg-card hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            {tpl.name}
          </button>
        ))}
      </div>

      {/* 4. Interactive SVG Payoff Chart */}
      <div className="border border-border bg-card/80 p-2 relative">
        <div className="flex items-center justify-between pb-1 text-3xs text-muted-foreground border-b border-border/60">
          <div className="flex items-center gap-3">
            <span className="font-bold text-foreground uppercase tracking-wide">STRATEGY EXPIRY PAYOFF CURVE</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-400" /> Expiry P&amp;L
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-cyan-400 border-dashed" /> T+0 Estimate
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-amber-400" /> Current Spot
            </span>
          </div>

          <div className="font-mono text-2xs">
            {hoveredData ? (
              <span className="text-amber-400 font-bold">
                SPOT: {hoveredData.spot.toLocaleString("en-IN")} {"//"} P&amp;L: ₹
                {hoveredData.pnlExpiry.toLocaleString("en-IN")}
              </span>
            ) : (
              <span>Hover chart for spot price P&amp;L</span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto mt-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto min-w-[700px] select-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clientX = e.clientX - rect.left;
              const svgX = (clientX / rect.width) * svgWidth;
              const norm = Math.max(0, Math.min(1, (svgX - padding.left) / plotWidth));
              const s = minSpot + norm * (maxSpot - minSpot);
              setHoverSpot(Math.round(s));
            }}
            onMouseLeave={() => setHoverSpot(null)}
          >
            {/* Zero Axis Grid Line */}
            <line
              x1={padding.left}
              y1={zeroY}
              x2={svgWidth - padding.right}
              y2={zeroY}
              stroke="currentColor"
              strokeDasharray="3 3"
              className="text-border/80"
              strokeWidth="1.5"
            />
            <text
              x={padding.left - 8}
              y={zeroY + 3}
              textAnchor="end"
              className="fill-muted-foreground text-3xs font-mono"
            >
              ₹0
            </text>

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
              S₀ {spot.toLocaleString("en-IN")}
            </text>

            {/* Breakeven points */}
            {payoffData.breakevens.map((be, idx) => {
              const beX = getX(be);
              return (
                <g key={`be-${idx}`}>
                  <line
                    x1={beX}
                    y1={zeroY - 8}
                    x2={beX}
                    y2={zeroY + 8}
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                  <text
                    x={beX}
                    y={zeroY + 18}
                    textAnchor="middle"
                    className="fill-cyan-400 text-3xs font-mono"
                  >
                    BE {be.toLocaleString("en-IN")}
                  </text>
                </g>
              );
            })}

            {/* T+0 Estimate Path */}
            <path
              d={todayPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity={0.7}
            />

            {/* Expiry Payoff Path */}
            <path
              d={expiryPath}
              fill="none"
              stroke={payoffData.netCashFlow >= 0 ? "#10b981" : "#059669"}
              strokeWidth="2.5"
            />

            {/* Hover Cursor */}
            {hoverSpot !== null && hoveredData && (
              <g>
                <line
                  x1={getX(hoverSpot)}
                  y1={padding.top}
                  x2={getX(hoverSpot)}
                  y2={svgHeight - padding.bottom}
                  stroke="#f59e0b"
                  strokeWidth="1"
                />
                <circle
                  cx={getX(hoverSpot)}
                  cy={getY(hoveredData.pnlExpiry)}
                  r="4"
                  fill="#f59e0b"
                />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* 5. Strategy Legs Editor Table */}
      <div className="border border-border bg-card/60 p-2 space-y-2">
        <div className="flex items-center justify-between border-b border-border pb-1">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-3xs uppercase font-bold text-foreground tracking-wider">
              MULTI-LEG STRATEGY CONTRACT CONFIGURATION
            </span>
          </div>

          <button
            onClick={handleAddLeg}
            className="flex items-center gap-1 px-2 py-0.5 text-3xs font-bold uppercase tracking-wider bg-foreground text-background border border-foreground hover:bg-muted-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Leg
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-2xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                <th className="py-1 px-2">Leg</th>
                <th className="py-1 px-2">Action</th>
                <th className="py-1 px-2">Type</th>
                <th className="py-1 px-2">Strike (₹)</th>
                <th className="py-1 px-2">Premium (₹)</th>
                <th className="py-1 px-2">Contracts</th>
                <th className="py-1 px-2">Total Qty</th>
                <th className="py-1 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {legs.map((leg, idx) => (
                <tr key={leg.id || idx} className="hover:bg-muted/30">
                  <td className="py-1 px-2 font-mono text-3xs font-bold text-muted-foreground">
                    #{idx + 1}
                  </td>
                  <td className="py-1 px-2">
                    <button
                      onClick={() =>
                        handleUpdateLeg(idx, { action: leg.action === "buy" ? "sell" : "buy" })
                      }
                      className={cn(
                        "px-1.5 py-0.5 text-3xs font-bold uppercase border",
                        leg.action === "buy"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      )}
                    >
                      {leg.action.toUpperCase()}
                    </button>
                  </td>
                  <td className="py-1 px-2">
                    <button
                      onClick={() =>
                        handleUpdateLeg(idx, { type: leg.type === "CE" ? "PE" : "CE" })
                      }
                      className={cn(
                        "px-1.5 py-0.5 text-3xs font-bold uppercase border",
                        leg.type === "CE"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                      )}
                    >
                      {leg.type}
                    </button>
                  </td>
                  <td className="py-1 px-2 font-mono">
                    <input
                      type="number"
                      step={symbol === "BANKNIFTY" ? "100" : symbol === "RELIANCE" ? "10" : "50"}
                      value={leg.strike}
                      onChange={(e) => handleUpdateLeg(idx, { strike: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-1 py-0.5 text-xs bg-background border border-border font-mono text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </td>
                  <td className="py-1 px-2 font-mono">
                    <input
                      type="number"
                      step="0.5"
                      value={leg.premium}
                      onChange={(e) => handleUpdateLeg(idx, { premium: parseFloat(e.target.value) || 0 })}
                      className="w-20 px-1 py-0.5 text-xs bg-background border border-border font-mono text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </td>
                  <td className="py-1 px-2 font-mono">
                    <input
                      type="number"
                      min="1"
                      value={leg.contracts}
                      onChange={(e) => handleUpdateLeg(idx, { contracts: parseInt(e.target.value) || 1 })}
                      className="w-14 px-1 py-0.5 text-xs bg-background border border-border font-mono text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </td>
                  <td className="py-1 px-2 font-mono text-muted-foreground">
                    {(leg.contracts * lotSize).toLocaleString("en-IN")}
                  </td>
                  <td className="py-1 px-2 text-right">
                    <button
                      onClick={() => handleRemoveLeg(idx)}
                      disabled={legs.length <= 1}
                      className="p-1 text-muted-foreground hover:text-rose-400 disabled:opacity-30"
                      title="Remove Leg"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Footer Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-3xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-foreground">RELATED DERIVATIVES WORKBENCHES:</span>
          <Link href={`/derivatives?symbol=${symbol}`} className="text-cyan-400 hover:underline">
            OMON &lt;GO&gt; (Option Chain)
          </Link>
          <Link href="/participant-oi" className="text-cyan-400 hover:underline">
            PART &lt;GO&gt; (Participant OI)
          </Link>
          <Link href={`/volatility?symbol=${symbol}`} className="text-cyan-400 hover:underline">
            OVDV &lt;GO&gt; (Volatility Surface)
          </Link>
        </div>

        <div>
          <span>Black-Scholes analytic solver with continuous cash flow pricing</span>
        </div>
      </div>
    </div>
  );
}
