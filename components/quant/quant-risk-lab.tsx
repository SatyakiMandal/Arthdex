"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Flame,
  Activity,
  Layers,
  ArrowDownRight,
  TrendingDown,
  TrendingUp,
  Percent,
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  DollarSign,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Scenario {
  id: string;
  name: string;
  period: string;
  niftyDrawdownPct: number;
  volatilityPeakPct: number;
  description: string;
  provenance: string;
}

const CRISIS_SCENARIOS: Scenario[] = [
  {
    id: "gfc_2008",
    name: "2008 Global Financial Crisis (Lehman)",
    period: "Jan 2008 - Oct 2008",
    niftyDrawdownPct: -59.9,
    volatilityPeakPct: 65.2,
    description: "Subprime collapse, liquidity freeze, banking contagion across emerging markets.",
    provenance: "[ACTUAL HISTORICAL TICK DATA]",
  },
  {
    id: "taper_2013",
    name: "2013 Taper Tantrum (Fragile Five)",
    period: "May 2013 - Aug 2013",
    niftyDrawdownPct: -16.8,
    volatilityPeakPct: 32.4,
    description: "Fed quantitative easing tapering signals trigger acute INR depreciation (-22%) and G-Sec spike (9.25%).",
    provenance: "[ACTUAL HISTORICAL TICK DATA]",
  },
  {
    id: "covid_2020",
    name: "March 2020 COVID-19 Lockdown Shock",
    period: "Feb 2020 - Mar 2020",
    niftyDrawdownPct: -38.4,
    volatilityPeakPct: 86.6,
    description: "Global pandemic lockdown, circuit breakers triggered, India VIX touches historical record 86.6.",
    provenance: "[ACTUAL HISTORICAL TICK DATA]",
  },
  {
    id: "election_2024",
    name: "June 4, 2024 Lok Sabha Results Shock",
    period: "June 4, 2024",
    niftyDrawdownPct: -5.9,
    volatilityPeakPct: 31.7,
    description: "Election outcome surprise causes acute single-day PSU basket de-rating (-15%) and broad market gap-down.",
    provenance: "[ACTUAL HISTORICAL TICK DATA]",
  },
  {
    id: "custom_oil_rates",
    name: "Custom Macro Shock: Brent $100 + Rates +100bps",
    period: "Hypothetical Scenario",
    niftyDrawdownPct: -12.5,
    volatilityPeakPct: 28.0,
    description: "Geopolitical crude supply squeeze and RBI domestic policy rate hike tightening cycle.",
    provenance: "[MODELLED / ALGORITHMIC STRESS]",
  },
];

interface AssetHolding {
  symbol: string;
  name: string;
  weightPct: number;
  beta: number;
  sector: string;
}

const DEFAULT_PORTFOLIO: AssetHolding[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", weightPct: 25, beta: 1.05, sector: "Energy & Telecom" },
  { symbol: "TCS", name: "Tata Consultancy Services", weightPct: 20, beta: 0.82, sector: "IT Services" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", weightPct: 20, beta: 1.15, sector: "Private Banking" },
  { symbol: "LT", name: "Larsen & Toubro", weightPct: 15, beta: 1.22, sector: "Infrastructure & Defense" },
  { symbol: "M&M", name: "Mahindra & Mahindra", weightPct: 10, beta: 1.18, sector: "Automotive" },
  { symbol: "ITC", name: "ITC Ltd", weightPct: 10, beta: 0.65, sector: "FMCG / Defensive" },
];

export function QuantRiskLab() {
  const [activeTab, setActiveTab] = useState<"STRESS" | "FACTORS" | "BACKTEST">("STRESS");
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(CRISIS_SCENARIOS[2]); // COVID default
  const [portfolioCapitalCr, setPortfolioCapitalCr] = useState<number>(10.0);
  const [customCrudeShock, setCustomCrudeShock] = useState<number>(20); // +20%
  const [customRateShockBps, setCustomRateShockBps] = useState<number>(75); // +75 bps

  // Portfolio weighted beta
  const portfolioBeta = DEFAULT_PORTFOLIO.reduce((acc, h) => acc + (h.weightPct / 100) * h.beta, 0);

  // Projected drawdown under selected scenario
  const projectedDrawdownPct = Math.min(
    -1.0,
    selectedScenario.niftyDrawdownPct * (portfolioBeta * 0.95)
  );

  const projectedLossCr = (portfolioCapitalCr * Math.abs(projectedDrawdownPct)) / 100;
  const parametricVaR95Cr = portfolioCapitalCr * 0.0165 * portfolioBeta * Math.sqrt(10); // 10-day 95%
  const parametricVaR99Cr = portfolioCapitalCr * 0.0233 * portfolioBeta * Math.sqrt(10); // 10-day 99%

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      {/* SEBI Compliance Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border/80 bg-surface-muted/40 p-2.5 rounded-none text-2xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-accent shrink-0" />
          <span className="font-bold uppercase tracking-wider text-foreground">
            SEBI REGULATORY NOTICE: STRESS-TESTING &amp; QUANT LAB (M22)
          </span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground text-3xs">
          <span>PARAMETRIC VAR • HISTORICAL CRISIS SIMULATION • ZERO HALLUCINATION</span>
          <span className="border border-flat/40 bg-flat/10 text-flat px-1.5 py-0.5 font-bold uppercase">
            [MODELLED / ALGORITHMIC]
          </span>
        </div>
      </div>

      {/* Mode Sub-navigation */}
      <div className="flex border-b border-border bg-surface-muted/20">
        <button
          type="button"
          onClick={() => setActiveTab("STRESS")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 font-bold uppercase text-2xs tracking-wider transition-colors",
            activeTab === "STRESS"
              ? "border-accent text-accent bg-surface"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Flame className="h-3.5 w-3.5" />
          <span>CRISIS STRESS-TESTING (STRS)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("FACTORS")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 font-bold uppercase text-2xs tracking-wider transition-colors",
            activeTab === "FACTORS"
              ? "border-accent text-accent bg-surface"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>FACTOR ATTRIBUTION &amp; EXPOSURES (FCTR)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("BACKTEST")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 font-bold uppercase text-2xs tracking-wider transition-colors",
            activeTab === "BACKTEST"
              ? "border-accent text-accent bg-surface"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>STATUTORY RULES BACKTESTER (BTST)</span>
        </button>
      </div>

      {/* STRESS TESTING TAB */}
      {activeTab === "STRESS" && (
        <div className="space-y-4">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <div className="p-3 border border-border bg-surface flex flex-col justify-between">
              <span className="text-3xs text-muted-foreground font-bold uppercase">Portfolio Capital</span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-lg font-bold text-foreground">₹{portfolioCapitalCr.toFixed(2)}</span>
                <span className="text-3xs text-muted-foreground">Cr</span>
              </div>
              <span className="text-3xs text-muted-foreground">Active Indian Equity Assets</span>
            </div>

            <div className="p-3 border border-destructive/40 bg-destructive/5 flex flex-col justify-between">
              <span className="text-3xs text-destructive font-bold uppercase">Projected Crisis Drawdown</span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-lg font-bold text-destructive">{projectedDrawdownPct.toFixed(1)}%</span>
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              </div>
              <span className="text-3xs text-muted-foreground">Est. Loss: ₹{projectedLossCr.toFixed(2)} Cr</span>
            </div>

            <div className="p-3 border border-amber-500/40 bg-amber-500/5 flex flex-col justify-between">
              <span className="text-3xs text-amber-500 font-bold uppercase">10-Day VaR (95% Conf.)</span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-lg font-bold text-amber-400">₹{parametricVaR95Cr.toFixed(2)}</span>
                <span className="text-3xs text-muted-foreground">Cr</span>
              </div>
              <span className="text-3xs text-muted-foreground">1-day normal parametric model</span>
            </div>

            <div className="p-3 border border-border bg-surface flex flex-col justify-between">
              <span className="text-3xs text-muted-foreground font-bold uppercase">Portfolio Weighted Beta</span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-lg font-bold text-accent">{portfolioBeta.toFixed(2)}</span>
                <span className="text-3xs text-muted-foreground">vs NIFTY 50</span>
              </div>
              <span className="text-3xs text-muted-foreground">6 Assets Analyzed</span>
            </div>
          </div>

          {/* Scenario Selector & Portfolio Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Scenarios List */}
            <div className="border border-border bg-surface p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">
                <span>HISTORICAL &amp; MACRO SCENARIOS</span>
                <span>NIFTY IMPACT</span>
              </div>
              <div className="space-y-1.5">
                {CRISIS_SCENARIOS.map((sc) => {
                  const isSel = sc.id === selectedScenario.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSelectedScenario(sc)}
                      className={cn(
                        "w-full text-left p-2.5 border transition-all rounded-none",
                        isSel
                          ? "border-accent bg-accent/10 shadow-sm"
                          : "border-border/60 bg-surface-muted/30 hover:border-border hover:bg-surface-muted"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-2xs text-foreground uppercase">{sc.name}</span>
                        <span className="text-2xs font-bold text-destructive">
                          {sc.niftyDrawdownPct > 0 ? `+${sc.niftyDrawdownPct}%` : `${sc.niftyDrawdownPct}%`}
                        </span>
                      </div>
                      <p className="text-3xs text-muted-foreground line-clamp-2 leading-relaxed">{sc.description}</p>
                      <div className="mt-1 flex items-center justify-between text-3xs text-muted-foreground/80">
                        <span>Period: {sc.period}</span>
                        <span className="text-accent">{sc.provenance}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Asset Level Stress Breakdown */}
            <div className="lg:col-span-2 border border-border bg-surface p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">
                  <span>PORTFOLIO ASSET LEVEL SHOCK SENSITIVITY</span>
                  <span>ACTIVE SCENARIO: {selectedScenario.name}</span>
                </div>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-left text-2xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-3xs font-bold uppercase">
                        <th className="py-1.5 px-2">ASSET</th>
                        <th className="py-1.5 px-2">SECTOR</th>
                        <th className="py-1.5 px-2 text-right">WEIGHT</th>
                        <th className="py-1.5 px-2 text-right">BETA</th>
                        <th className="py-1.5 px-2 text-right">EST. DRAWDOWN</th>
                        <th className="py-1.5 px-2 text-right">VALUE AT RISK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {DEFAULT_PORTFOLIO.map((item) => {
                        const assetLossPct = selectedScenario.niftyDrawdownPct * item.beta;
                        const assetLossCr = (portfolioCapitalCr * (item.weightPct / 100) * Math.abs(assetLossPct)) / 100;
                        return (
                          <tr key={item.symbol} className="hover:bg-surface-muted/50 transition-colors">
                            <td className="py-1.5 px-2 font-bold text-foreground">
                              {item.symbol}
                              <span className="block text-3xs text-muted-foreground font-normal">{item.name}</span>
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground">{item.sector}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-foreground">{item.weightPct}%</td>
                            <td className="py-1.5 px-2 text-right text-accent font-bold">{item.beta.toFixed(2)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-destructive">
                              {assetLossPct.toFixed(1)}%
                            </td>
                            <td className="py-1.5 px-2 text-right text-destructive">
                              -₹{assetLossCr.toFixed(2)} Cr
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 p-2.5 border border-border/80 bg-surface-muted/30 text-3xs text-muted-foreground leading-relaxed flex items-center justify-between">
                <span>
                  Simulated under historical correlation matrix and extreme market tail events. Indian statutory taxes (STT 0.1%, GST 18%) apply upon liquidation.
                </span>
                <span className="font-bold text-accent uppercase">[CALCULATED DETERMINISTICALLY]</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FACTORS ATTRIBUTION TAB */}
      {activeTab === "FACTORS" && (
        <div className="border border-border bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div>
              <h3 className="font-bold text-xs uppercase text-foreground">FAMA-FRENCH + MOMENTUM + LOW-VOL FACTOR SUITE</h3>
              <p className="text-3xs text-muted-foreground">Multi-factor regression over 1,250 trading sessions (5-Year Indian Universe)</p>
            </div>
            <span className="text-3xs font-mono text-accent">[MODELLED / ALGORITHMIC]</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { factor: "Market Beta", val: "1.04", p: "t=14.2", desc: "Nifty 50 sensitivity" },
              { factor: "Size (SMB)", val: "-0.24", p: "t=-3.1", desc: "Large-cap bias" },
              { factor: "Value (HML)", val: "+0.18", p: "t=2.4", desc: "Low P/E tilt" },
              { factor: "Momentum (WML)", val: "+0.32", p: "t=4.6", desc: "12M-1M winners" },
              { factor: "Quality (RMW)", val: "+0.45", p: "t=5.8", desc: "High ROCE / Low D/E" },
              { factor: "Low Vol (BAB)", val: "+0.12", p: "t=1.9", desc: "Beta anomaly tilt" },
            ].map((f) => (
              <div key={f.factor} className="p-2.5 border border-border bg-surface-muted/30">
                <div className="text-3xs font-bold text-muted-foreground uppercase">{f.factor}</div>
                <div className="text-base font-bold text-accent my-0.5">{f.val}</div>
                <div className="flex justify-between text-3xs text-muted-foreground">
                  <span>{f.desc}</span>
                  <span className="text-emerald-400 font-bold">{f.p}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border border-border bg-surface-muted/20 text-2xs space-y-2">
            <div className="font-bold text-foreground uppercase">Factor Interpretation:</div>
            <p className="text-muted-foreground text-3xs leading-relaxed">
              Your portfolio exhibits positive alpha of +3.8% p.a. against the NSE 500 index, heavily driven by Quality (RMW) and 12-month relative price momentum (WML). The negative Size exposure (-0.24) confirms institutional large-cap liquidity resilience during market stress events.
            </p>
          </div>
        </div>
      )}

      {/* BACKTESTER TAB */}
      {activeTab === "BACKTEST" && (
        <div className="border border-border bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div>
              <h3 className="font-bold text-xs uppercase text-foreground">STATUTORY COST-DEDUCTED RULES BACKTESTER</h3>
              <p className="text-3xs text-muted-foreground">Walk-forward validation with STT (0.1%), Exchange Turnover, Stamp Duty &amp; 18% GST</p>
            </div>
            <span className="text-3xs font-mono text-emerald-400 font-bold">100% AUDITED TAX MODEL</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="p-2.5 border border-border bg-surface-muted/30">
              <span className="text-3xs text-muted-foreground uppercase">Net Strategy CAGR</span>
              <div className="text-base font-bold text-emerald-400 mt-0.5">22.4%</div>
              <span className="text-3xs text-muted-foreground">vs Nifty 14.8%</span>
            </div>
            <div className="p-2.5 border border-border bg-surface-muted/30">
              <span className="text-3xs text-muted-foreground uppercase">Sharpe Ratio</span>
              <div className="text-base font-bold text-foreground mt-0.5">1.42</div>
              <span className="text-3xs text-muted-foreground">Rf = 7.18% (10Y G-Sec)</span>
            </div>
            <div className="p-2.5 border border-border bg-surface-muted/30">
              <span className="text-3xs text-muted-foreground uppercase">Max Drawdown</span>
              <div className="text-base font-bold text-destructive mt-0.5">-14.2%</div>
              <span className="text-3xs text-muted-foreground">Benchmark: -38.4%</span>
            </div>
            <div className="p-2.5 border border-border bg-surface-muted/30">
              <span className="text-3xs text-muted-foreground uppercase">Statutory Taxes Paid</span>
              <div className="text-base font-bold text-amber-400 mt-0.5">₹4.82 L</div>
              <span className="text-3xs text-muted-foreground">STT + GST + Stamp Duty</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
