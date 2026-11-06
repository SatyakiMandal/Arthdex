"use client";

import { useState } from "react";
import {
  Calculator,
  Sliders,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
  Table,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DcfWorkbenchProps {
  symbol?: string;
  defaultPrice?: number;
}

export function DcfWorkbench({ symbol = "RELIANCE", defaultPrice = 2950 }: DcfWorkbenchProps) {
  // Inputs
  const [currentPrice, setCurrentPrice] = useState<number>(defaultPrice);
  const [baseFcffCr, setBaseFcffCr] = useState<number>(45200); // Reliance FCFF
  const [growthYears1_5, setGrowthYears1_5] = useState<number>(14.0); // 14% CAGR
  const [terminalGrowth, setTerminalGrowth] = useState<number>(5.5); // 5.5% Indian GDP nominal
  const [sharesCr, setSharesCr] = useState<number>(676.5); // Total shares
  const [netDebtCr, setNetDebtCr] = useState<number>(112400); // Net debt

  // CAPM WACC sliders
  const [riskFreeRate, setRiskFreeRate] = useState<number>(7.18); // 10Y G-Sec
  const [erp, setErp] = useState<number>(6.0); // Indian ERP
  const [beta, setBeta] = useState<number>(1.05);
  const [costOfDebtPreTax, setCostOfDebtPreTax] = useState<number>(8.25);
  const [taxRate, setTaxRate] = useState<number>(25.17); // Sec 115BAA corporate tax
  const [debtRatio, setDebtRatio] = useState<number>(20.0); // 20% debt, 80% equity

  // Calculations
  const costOfEquity = riskFreeRate + beta * erp;
  const costOfDebtPostTax = costOfDebtPreTax * (1 - taxRate / 100);
  const wacc = (costOfEquity * (100 - debtRatio)) / 100 + (costOfDebtPostTax * debtRatio) / 100;

  // Project 5-year FCFFs
  const projectedYears: { year: number; fcff: number; pv: number }[] = [];
  let pvExplicit = 0;
  for (let yr = 1; yr <= 5; yr++) {
    const fcff = baseFcffCr * Math.pow(1 + growthYears1_5 / 100, yr);
    const pv = fcff / Math.pow(1 + wacc / 100, yr);
    projectedYears.push({ year: yr, fcff, pv });
    pvExplicit += pv;
  }

  // Terminal Value using Gordon Growth Model
  const terminalYearFcff = projectedYears[4].fcff * (1 + terminalGrowth / 100);
  const terminalValue = (wacc > terminalGrowth)
    ? terminalYearFcff / ((wacc - terminalGrowth) / 100)
    : 0;
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc / 100, 5);

  // Enterprise Value & Equity Value
  const enterpriseValue = pvExplicit + pvTerminalValue;
  const equityValue = enterpriseValue - netDebtCr;
  const fairValuePerShare = sharesCr > 0 ? (equityValue / sharesCr) : 0;
  const marginOfSafetyPct = fairValuePerShare > 0
    ? ((fairValuePerShare - currentPrice) / fairValuePerShare) * 100
    : 0;

  // Reverse DCF calculation: Implied growth from current price
  // Current Equity Market Cap = currentPrice * sharesCr
  const targetEquityValue = currentPrice * sharesCr;
  const targetEV = targetEquityValue + netDebtCr;
  // Simple heuristic reverse growth solver approximation:
  const impliedGrowthRatePct = Math.max(0, ((targetEV / (baseFcffCr * 12)) - 1) * 100 / 5 + 4.5);

  // Sensitivity Matrix (WACC vs Terminal Growth)
  const waccVariations = [wacc - 1.0, wacc - 0.5, wacc, wacc + 0.5, wacc + 1.0];
  const gVariations = [terminalGrowth - 1.0, terminalGrowth - 0.5, terminalGrowth, terminalGrowth + 0.5, terminalGrowth + 1.0];

  const getFairValueForRates = (w: number, g: number) => {
    if (w <= g) return 0;
    let sumPv = 0;
    for (let yr = 1; yr <= 5; yr++) {
      const f = baseFcffCr * Math.pow(1 + growthYears1_5 / 100, yr);
      sumPv += f / Math.pow(1 + w / 100, yr);
    }
    const tFcff = baseFcffCr * Math.pow(1 + growthYears1_5 / 100, 5) * (1 + g / 100);
    const tv = tFcff / ((w - g) / 100);
    const pvTv = tv / Math.pow(1 + w / 100, 5);
    const ev = sumPv + pvTv;
    const eq = ev - netDebtCr;
    return Math.max(0, eq / sharesCr);
  };

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      {/* Disclaimer Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border/80 bg-surface-muted/30 p-2.5 rounded-none text-2xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-accent shrink-0" />
          <span className="font-bold uppercase tracking-wider text-foreground">
            SEBI NON-ADVISORY COMPLIANCE: 2-STAGE FCFF VALUATION LAB (M6)
          </span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground text-3xs">
          <span>ALGORITHMIC FAIR VALUE ESTIMATE • NOT AN INVESTMENT RECOMMENDATION</span>
          <span className="border border-flat/40 bg-flat/10 text-flat px-1.5 py-0.5 font-bold uppercase">
            [MODELLED / ALGORITHMIC]
          </span>
        </div>
      </div>

      {/* Top Value Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        <div className="p-3 border border-border bg-surface">
          <span className="text-3xs text-muted-foreground uppercase font-bold">Current Market Price</span>
          <div className="text-lg font-bold text-foreground mt-1">₹{currentPrice.toFixed(2)}</div>
          <span className="text-3xs text-muted-foreground">Symbol: {symbol}</span>
        </div>

        <div className={cn(
          "p-3 border flex flex-col justify-between",
          fairValuePerShare >= currentPrice
            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
            : "border-destructive/40 bg-destructive/5 text-destructive"
        )}>
          <span className="text-3xs font-bold uppercase">Estimated DCF Fair Value</span>
          <div className="text-lg font-bold mt-1">₹{fairValuePerShare.toFixed(2)}</div>
          <span className="text-3xs text-muted-foreground">
            WACC: {wacc.toFixed(2)}% • Terminal g: {terminalGrowth.toFixed(1)}%
          </span>
        </div>

        <div className="p-3 border border-border bg-surface">
          <span className="text-3xs text-muted-foreground uppercase font-bold">Margin of Safety</span>
          <div className={cn(
            "text-lg font-bold mt-1 flex items-baseline gap-1",
            marginOfSafetyPct >= 0 ? "text-emerald-400" : "text-destructive"
          )}>
            <span>{marginOfSafetyPct >= 0 ? `+${marginOfSafetyPct.toFixed(1)}%` : `${marginOfSafetyPct.toFixed(1)}%`}</span>
            {marginOfSafetyPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          </div>
          <span className="text-3xs text-muted-foreground">
            {marginOfSafetyPct >= 20 ? "Undervalued (Safe)" : marginOfSafetyPct >= 0 ? "Fairly Valued" : "Premium Valuation"}
          </span>
        </div>

        <div className="p-3 border border-border bg-surface">
          <span className="text-3xs text-muted-foreground uppercase font-bold">Reverse DCF Implied Growth</span>
          <div className="text-lg font-bold text-accent mt-1">{impliedGrowthRatePct.toFixed(1)}% p.a.</div>
          <span className="text-3xs text-muted-foreground">Priced into CMP for next 5 years</span>
        </div>
      </div>

      {/* Main Interactive Controls & Projection Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sliders & Assumptions Panel */}
        <div className="border border-border bg-surface p-3 space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">
            <span>VALUATION ASSUMPTIONS</span>
            <button
              type="button"
              onClick={() => {
                setGrowthYears1_5(14.0);
                setTerminalGrowth(5.5);
                setBeta(1.05);
                setRiskFreeRate(7.18);
              }}
              className="hover:text-foreground flex items-center gap-1"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>RESET</span>
            </button>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-2xs mb-1">
                <span className="text-muted-foreground">5-Year FCFF Growth:</span>
                <span className="font-bold text-accent">{growthYears1_5.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={growthYears1_5}
                onChange={(e) => setGrowthYears1_5(parseFloat(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-2xs mb-1">
                <span className="text-muted-foreground">Terminal Growth Rate (g):</span>
                <span className="font-bold text-accent">{terminalGrowth.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="2"
                max="7"
                step="0.25"
                value={terminalGrowth}
                onChange={(e) => setTerminalGrowth(parseFloat(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-2xs mb-1">
                <span className="text-muted-foreground">Asset Beta (vs Nifty):</span>
                <span className="font-bold text-foreground">{beta.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={beta}
                onChange={(e) => setBeta(parseFloat(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-2xs mb-1">
                <span className="text-muted-foreground">Risk-Free Rate (10Y G-Sec):</span>
                <span className="font-bold text-foreground">{riskFreeRate.toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="6.0"
                max="8.5"
                step="0.1"
                value={riskFreeRate}
                onChange={(e) => setRiskFreeRate(parseFloat(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-border/60 text-3xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Cost of Equity (Ke):</span>
                <span className="font-bold text-foreground">{costOfEquity.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Post-Tax Cost of Debt (Kd):</span>
                <span className="font-bold text-foreground">{costOfDebtPostTax.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between font-bold text-accent">
                <span>Calculated WACC:</span>
                <span>{wacc.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5-Year Cash Flow Projection Table & Sensitivity Matrix */}
        <div className="lg:col-span-2 border border-border bg-surface p-3 space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">
              <span>PROJECTED 5-YEAR FREE CASH FLOW TO FIRM (₹ CR)</span>
              <span>BASE FCFF: ₹{baseFcffCr.toLocaleString()} CR</span>
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-2xs">
                <thead>
                  <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                    <th className="py-1.5 px-2">YEAR</th>
                    <th className="py-1.5 px-2 text-right">PROJECTED FCFF</th>
                    <th className="py-1.5 px-2 text-right">DISCOUNT FACTOR</th>
                    <th className="py-1.5 px-2 text-right">PRESENT VALUE (PV)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {projectedYears.map((item) => (
                    <tr key={item.year} className="hover:bg-surface-muted/50">
                      <td className="py-1.5 px-2 font-bold text-foreground">FY +{item.year}</td>
                      <td className="py-1.5 px-2 text-right text-foreground">₹{item.fcff.toFixed(0)} Cr</td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground">
                        {(1 / Math.pow(1 + wacc / 100, item.year)).toFixed(3)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-accent">
                        ₹{item.pv.toFixed(0)} Cr
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-bold">
                    <td className="py-1.5 px-2 text-foreground">PV of Explicit Period (5Y)</td>
                    <td colSpan={2} />
                    <td className="py-1.5 px-2 text-right text-foreground">₹{pvExplicit.toFixed(0)} Cr</td>
                  </tr>
                  <tr className="font-bold text-accent">
                    <td className="py-1.5 px-2">PV of Terminal Value ({terminalGrowth}%)</td>
                    <td colSpan={2} />
                    <td className="py-1.5 px-2 text-right">₹{pvTerminalValue.toFixed(0)} Cr</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 5x5 Sensitivity Matrix */}
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">
              <span>SENSITIVITY MATRIX: FAIR VALUE (₹) ACROSS WACC &amp; TERMINAL GROWTH</span>
              <span>HIGHLIGHT: BASE CASE</span>
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-center text-3xs font-mono">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 px-1 text-left">WACC \ g</th>
                    {gVariations.map((g) => (
                      <th key={g} className={cn("py-1 px-1", Math.abs(g - terminalGrowth) < 0.1 && "text-accent font-bold")}>
                        {g.toFixed(1)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {waccVariations.map((w) => {
                    const isBaseWacc = Math.abs(w - wacc) < 0.1;
                    return (
                      <tr key={w} className={cn(isBaseWacc && "bg-surface-muted/40 font-bold")}>
                        <td className="py-1 px-1 text-left text-muted-foreground font-bold">
                          {w.toFixed(1)}%
                        </td>
                        {gVariations.map((g) => {
                          const fv = getFairValueForRates(w, g);
                          const isCenter = isBaseWacc && Math.abs(g - terminalGrowth) < 0.1;
                          return (
                            <td
                              key={g}
                              className={cn(
                                "py-1 px-1",
                                isCenter
                                  ? "bg-accent text-accent-foreground font-bold"
                                  : fv >= currentPrice
                                  ? "text-emerald-400"
                                  : "text-destructive"
                              )}
                            >
                              ₹{fv.toFixed(0)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
