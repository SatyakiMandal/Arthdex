"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScenarioModel {
  name: string;
  bear: number;
  base: number;
  bull: number;
  bear_pct: number;
  base_pct: number;
  bull_pct: number;
  prob_bear: number;
  prob_base: number;
  prob_bull: number;
  rationale: string;
}

interface ConsensusData {
  consensus_bear: number;
  consensus_base: number;
  consensus_bull: number;
  consensus_bear_pct: number;
  consensus_base_pct: number;
  consensus_bull_pct: number;
  ahci_score: number;
  directional_bias: string;
  recommended_action: string;
  confidence_pct: number;
  dispersion_pct: number;
}

interface BuyTranche {
  tranche: string;
  price: number;
  pct_from_spot: number;
  quantity: number;
  weight_pct: number;
  capital_inr: number;
  rationale: string;
}

interface SellTranche {
  target: string;
  price: number;
  pct_gain: number;
  quantity: number;
  expected_profit_inr: number;
  action: string;
}

interface ExecutionPlan {
  portfolio_capital: number;
  risk_pct: number;
  max_risk_inr: number;
  total_quantity: number;
  required_capital_inr: number;
  capital_allocation_pct: number;
  blended_entry: number;
  structural_stop_loss: number;
  trailing_stop_loss: number;
  stop_loss_pct: number;
  risk_per_share: number;
  risk_reward_ratio: number;
  buy_tranches: BuyTranche[];
  sell_tranches: SellTranche[];
}

interface HorizonData {
  code: string;
  label: string;
  days: number;
  models: ScenarioModel[];
  consensus: ConsensusData;
  execution_plan: ExecutionPlan;
}

interface ScenarioForecastResponse {
  symbol: string;
  exchange: string;
  spot: number;
  asOf: string;
  market_regime: string;
  parameters: {
    annualized_drift_pct: number;
    annualized_realized_vol_pct: number;
    parkinson_vol_pct: number;
    atr_14: number;
    active_algorithms_count: number;
  };
  ahci_summary: {
    score: number;
    bias: string;
    action: string;
    confidence_pct: number;
    dispersion_pct: number;
    reference_horizon: string;
    bear_target: number;
    base_target: number;
    bull_target: number;
  };
  horizons: HorizonData[];
}

const BELLWETHERS = [
  "RELIANCE",
  "TCS",
  "HDFCBANK",
  "INFY",
  "ICICIBANK",
  "LT",
  "SBIN",
  "TATAMOTORS",
  "BHARTIARTL",
  "ITC",
];

interface ScenarioForecastCockpitProps {
  initialSymbol?: string;
}

export function ScenarioForecastCockpit({
  initialSymbol = "RELIANCE",
}: ScenarioForecastCockpitProps) {
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [customSymbol, setCustomSymbol] = useState<string>("");
  const [selectedHorizonCode, setSelectedHorizonCode] = useState<string>("T5");
  const [portfolioCapital, setPortfolioCapital] = useState<number>(500000);
  const [riskPct, setRiskPct] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScenarioForecastResponse | null>(null);
  const [copiedSlip, setCopiedSlip] = useState<boolean>(false);

  const fetchData = useCallback(
    async (sym: string, capital: number, rPct: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/forecast/scenarios?symbol=${encodeURIComponent(
            sym.toUpperCase(),
          )}&exchange=NSE&capital=${encodeURIComponent(
            capital,
          )}&risk_pct=${encodeURIComponent(rPct)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(`Engine returned status ${res.status}`);
        }
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        } else {
          throw new Error("No forecast data returned");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load forecast engine");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchData(symbol, portfolioCapital, riskPct);
  }, [symbol, portfolioCapital, riskPct, fetchData]);

  const activeHorizon =
    data?.horizons.find((h) => h.code === selectedHorizonCode) ||
    data?.horizons[2] ||
    null;

  function handleCopyExecutionTicket() {
    if (!activeHorizon || !data) return;
    const plan = activeHorizon.execution_plan;
    const cons = activeHorizon.consensus;

    const ticket = `[ARTHDEX INSTITUTIONAL EXECUTION SLIP]
Symbol: ${data.symbol} (NSE) | Spot: ₹${data.spot}
Horizon: ${activeHorizon.label} (${activeHorizon.days} Trading Days)
AHCI Score: ${cons.ahci_score} | Bias: ${cons.directional_bias}
--------------------------------------------------
ACCUMULATION PLAN:
- Tranche 1 (40%): Buy ${plan.buy_tranches[0]?.quantity} shares @ ₹${plan.buy_tranches[0]?.price}
- Tranche 2 (60%): Buy ${plan.buy_tranches[1]?.quantity} shares @ ₹${plan.buy_tranches[1]?.price}
- Blended Avg Entry: ₹${plan.blended_entry}
- Total Quantity: ${plan.total_quantity} shares (Capital: ₹${plan.required_capital_inr.toLocaleString("en-IN")})
--------------------------------------------------
RISK PROTECTION:
- Structural Hard SL: ₹${plan.structural_stop_loss} (${plan.stop_loss_pct}%)
- Volatility Trailing SL: ₹${plan.trailing_stop_loss}
- Max Capital Risk: ₹${plan.max_risk_inr.toLocaleString("en-IN")} (${plan.risk_pct}%)
--------------------------------------------------
TARGET EXITS:
- TP 1 (50% scale-out): ₹${plan.sell_tranches[0]?.price} (+${plan.sell_tranches[0]?.pct_gain}%) -> Move SL to Breakeven
- TP 2 (30% scale-out): ₹${plan.sell_tranches[1]?.price} (+${plan.sell_tranches[1]?.pct_gain}%)
- TP 3 (20% runner): ₹${plan.sell_tranches[2]?.price} (+${plan.sell_tranches[2]?.pct_gain}%) -> Trail 1.5x ATR
--------------------------------------------------
Risk/Reward Ratio: 1 : ${plan.risk_reward_ratio}
Generated: ${new Date().toLocaleString("en-IN")}`;

    void navigator.clipboard.writeText(ticket);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2000);
  }

  return (
    <div className="space-y-3 font-sans rounded-none">
      {/* 1. TOP HEADER & BELLWETHER CONTROLS */}
      <div className="border border-border bg-surface p-2.5 sm:p-3 shadow-xs rounded-none space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-2.5">
          {/* Left: Active Ticker & Live Spot */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-surface-muted px-2 py-1 border border-border rounded-none">
              <Cpu className="h-3.5 w-3.5 text-accent animate-pulse" />
              <span className="font-mono text-xs font-black tracking-wide text-foreground uppercase">
                {symbol}
              </span>
              <span className="text-3xs font-mono text-muted-foreground uppercase">
                NSE
              </span>
            </div>

            {data && (
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-sm sm:text-base font-black text-foreground">
                  ₹{data.spot.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
                  CMP · {data.asOf}
                </span>
              </div>
            )}
          </div>

          {/* Right: Refresh & Engine Parameters */}
          <div className="flex items-center gap-2">
            {data && (
              <div className="hidden md:flex items-center gap-2 font-mono text-3xs text-muted-foreground">
                <span className="border border-border bg-surface-muted px-1.5 py-0.5 rounded-none">
                  Drift: <strong className="text-foreground">+{data.parameters.annualized_drift_pct}%</strong>
                </span>
                <span className="border border-border bg-surface-muted px-1.5 py-0.5 rounded-none">
                  Vol: <strong className="text-foreground">{data.parameters.annualized_realized_vol_pct}%</strong>
                </span>
                <span className="border border-border bg-surface-muted px-1.5 py-0.5 rounded-none">
                  ATR(14): <strong className="text-foreground">₹{data.parameters.atr_14}</strong>
                </span>
                <span className="border border-border bg-surface-muted px-1.5 py-0.5 text-accent font-semibold rounded-none">
                  {data.parameters.active_algorithms_count} Algos Active
                </span>
              </div>
            )}

            <button
              onClick={() => void fetchData(symbol, portfolioCapital, riskPct)}
              disabled={loading}
              className="flex items-center gap-1 border border-border bg-surface-raised px-2 py-1 text-2xs font-mono font-medium text-foreground hover:bg-surface-muted transition-colors rounded-none disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3 text-accent", loading && "animate-spin")} />
              <span>{loading ? "Calculating..." : "Recalculate"}</span>
            </button>
          </div>
        </div>

        {/* Bellwether Quick Select & Custom Ticker Input */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-3xs uppercase tracking-wider font-mono text-muted-foreground font-semibold mr-1">
              BELLWETHERS:
            </span>
            {BELLWETHERS.map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={cn(
                  "px-2 py-0.5 text-3xs font-mono uppercase tracking-wider transition-all rounded-none",
                  symbol === s
                    ? "bg-accent/15 text-accent font-bold border border-accent/40 shadow-xs"
                    : "border border-border bg-surface-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Custom Ticker Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customSymbol.trim()) {
                setSymbol(customSymbol.trim().toUpperCase());
                setCustomSymbol("");
              }
            }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              placeholder="Custom NSE Ticker..."
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              className="border border-border bg-surface-muted px-2 py-0.5 text-3xs font-mono uppercase placeholder:text-muted-foreground text-foreground focus:outline-none focus:border-accent w-32 rounded-none"
            />
            <button
              type="submit"
              className="border border-border bg-surface-raised px-1.5 py-0.5 text-3xs font-mono font-semibold text-foreground hover:bg-surface-muted rounded-none"
            >
              Load
            </button>
          </form>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="border border-down/40 bg-down/10 p-3 rounded-none text-2xs font-mono text-down flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Error in scenario modeling engine: {error}</span>
        </div>
      )}

      {/* 2. PROPORTIONAL TIME FRAME SELECTOR */}
      {data && (
        <div className="border border-border bg-surface p-2 rounded-none shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-3xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Layers className="h-3 w-3 text-gold" /> Proportional Horizon:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 font-mono">
              {data.horizons.map((h) => (
                <button
                  key={h.code}
                  onClick={() => setSelectedHorizonCode(h.code)}
                  className={cn(
                    "px-2.5 py-1 text-2xs uppercase tracking-wider transition-all rounded-none flex items-center gap-1",
                    selectedHorizonCode === h.code
                      ? "bg-surface-raised text-foreground font-bold border border-accent shadow-xs"
                      : "border border-border/80 bg-surface-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-none",
                      selectedHorizonCode === h.code ? "bg-accent" : "bg-muted-foreground/50",
                    )}
                  />
                  <span>{h.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. ARTHDEX HYBRID CONSENSUS INDEX (AHCI) MASTER HERO & SCENARIOS */}
      {activeHorizon && (
        <div className="border border-border bg-surface p-3 sm:p-4 rounded-none shadow-sm space-y-3">
          {/* Header Row: AHCI Score & Bias */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-accent/10 border border-accent/30 rounded-none">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wide">
                    Arthdex Hybrid Consensus Index (AHCI)
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 text-3xs font-black uppercase tracking-wider border rounded-none",
                      activeHorizon.consensus.ahci_score > 20
                        ? "border-up/40 bg-up/10 text-up"
                        : activeHorizon.consensus.ahci_score < -20
                          ? "border-down/40 bg-down/10 text-down"
                          : "border-gold/40 bg-gold/10 text-gold",
                    )}
                  >
                    {activeHorizon.consensus.directional_bias}
                  </span>
                </div>
                <div className="text-3xs font-mono text-muted-foreground mt-0.5">
                  Consensus Action: <strong className="text-foreground">{activeHorizon.consensus.recommended_action}</strong>
                </div>
              </div>
            </div>

            {/* Score & Confidence Badges */}
            <div className="flex items-center gap-3 font-mono text-2xs">
              <div className="border border-border bg-surface-muted px-2.5 py-1 text-right rounded-none">
                <div className="text-3xs text-muted-foreground uppercase font-semibold">AHCI Score</div>
                <div
                  className={cn(
                    "font-black text-sm",
                    activeHorizon.consensus.ahci_score > 0
                      ? "text-up"
                      : activeHorizon.consensus.ahci_score < 0
                        ? "text-down"
                        : "text-foreground",
                  )}
                >
                  {activeHorizon.consensus.ahci_score > 0 ? "+" : ""}
                  {activeHorizon.consensus.ahci_score}
                </div>
              </div>

              <div className="border border-border bg-surface-muted px-2.5 py-1 text-right rounded-none">
                <div className="text-3xs text-muted-foreground uppercase font-semibold">Model Confidence</div>
                <div className="font-black text-sm text-foreground">
                  {activeHorizon.consensus.confidence_pct}%
                </div>
              </div>

              <div className="border border-border bg-surface-muted px-2.5 py-1 text-right rounded-none">
                <div className="text-3xs text-muted-foreground uppercase font-semibold">Model Dispersion</div>
                <div className="font-black text-sm text-muted-foreground">
                  {activeHorizon.consensus.dispersion_pct}%
                </div>
              </div>
            </div>
          </div>

          {/* 3-COLUMN SCENARIO FORECAST CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono">
            {/* BEAR SCENARIO */}
            <div className="border border-down/30 bg-down/5 p-3 rounded-none relative overflow-hidden">
              <div className="flex items-center justify-between text-3xs text-down font-bold uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" /> BEAR SCENARIO
                </span>
                <span>P(Bear) ≈ 20%</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground">
                ₹{activeHorizon.consensus.consensus_bear.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between text-2xs font-semibold text-down mt-1">
                <span>
                  {activeHorizon.consensus.consensus_bear_pct}% from Spot
                </span>
                <span className="text-muted-foreground font-normal text-3xs">
                  -₹{(data?.spot ? data.spot - activeHorizon.consensus.consensus_bear : 0).toFixed(1)} pts
                </span>
              </div>
              <div className="text-3xs text-muted-foreground mt-2 border-t border-down/20 pt-1.5 leading-relaxed">
                Acceptance below Point of Control / Value Area Low liquidity exhaust.
              </div>
            </div>

            {/* BASE SCENARIO */}
            <div className="border border-accent/40 bg-accent/5 p-3 rounded-none relative overflow-hidden">
              <div className="flex items-center justify-between text-3xs text-accent font-bold uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" /> BASE SCENARIO (MEDIAN)
                </span>
                <span>P(Base) ≈ 50%</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground">
                ₹{activeHorizon.consensus.consensus_base.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between text-2xs font-semibold text-foreground mt-1">
                <span
                  className={cn(
                    activeHorizon.consensus.consensus_base_pct > 0
                      ? "text-up"
                      : activeHorizon.consensus.consensus_base_pct < 0
                        ? "text-down"
                        : "text-muted-foreground",
                  )}
                >
                  {activeHorizon.consensus.consensus_base_pct > 0 ? "+" : ""}
                  {activeHorizon.consensus.consensus_base_pct}% from Spot
                </span>
                <span className="text-muted-foreground font-normal text-3xs">
                  {activeHorizon.consensus.consensus_base >= (data?.spot ?? 0) ? "+" : "-"}
                  ₹{Math.abs((data?.spot ?? 0) - activeHorizon.consensus.consensus_base).toFixed(1)} pts
                </span>
              </div>
              <div className="text-3xs text-muted-foreground mt-2 border-t border-accent/20 pt-1.5 leading-relaxed">
                Central drift reversion toward Volume Weighted Average Price (VWAP) equilibrium.
              </div>
            </div>

            {/* BULL SCENARIO */}
            <div className="border border-up/30 bg-up/5 p-3 rounded-none relative overflow-hidden">
              <div className="flex items-center justify-between text-3xs text-up font-bold uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> BULL SCENARIO
                </span>
                <span>P(Bull) ≈ 30%</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground">
                ₹{activeHorizon.consensus.consensus_bull.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between text-2xs font-semibold text-up mt-1">
                <span>
                  +{activeHorizon.consensus.consensus_bull_pct}% from Spot
                </span>
                <span className="text-muted-foreground font-normal text-3xs">
                  +₹{(data?.spot ? activeHorizon.consensus.consensus_bull - data.spot : 0).toFixed(1)} pts
                </span>
              </div>
              <div className="text-3xs text-muted-foreground mt-2 border-t border-up/20 pt-1.5 leading-relaxed">
                Value Area High breakout with straddle gamma expansion beyond +1.5σ.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MULTI-ALGORITHM BREAKDOWN MATRIX */}
      {activeHorizon && (
        <div className="border border-border bg-surface p-3 rounded-none shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                Multi-Algorithm Convergence Matrix ({activeHorizon.models.length} Quantitative Models)
              </span>
            </div>
            <span className="text-3xs font-mono text-muted-foreground">
              Horizon: {activeHorizon.label}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-2xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-surface-muted/50 text-muted-foreground text-3xs uppercase tracking-wider">
                  <th className="py-1.5 px-2 font-semibold">Algorithm / Model Specification</th>
                  <th className="py-1.5 px-2 font-semibold text-right text-down">Bear Scenario</th>
                  <th className="py-1.5 px-2 font-semibold text-right text-foreground">Base (Median)</th>
                  <th className="py-1.5 px-2 font-semibold text-right text-up">Bull Scenario</th>
                  <th className="py-1.5 px-2 font-semibold">Algorithmic Formulation / Catalyst Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {activeHorizon.models.map((m, idx) => (
                  <tr key={idx} className="hover:bg-surface-muted/60 transition-colors cell-glow">
                    <td className="py-1.5 px-2 font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 bg-accent rounded-none" />
                        <span>{m.name}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right font-medium text-down">
                      ₹{m.bear.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                      <span className="text-3xs text-down/80 ml-1">({m.bear_pct}%)</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-medium text-foreground">
                      ₹{m.base.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                      <span className="text-3xs text-muted-foreground ml-1">({m.base_pct}%)</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-medium text-up">
                      ₹{m.bull.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                      <span className="text-3xs text-up/80 ml-1">(+{m.bull_pct}%)</span>
                    </td>
                    <td className="py-1.5 px-2 text-3xs text-muted-foreground">
                      {m.rationale}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. INSTITUTIONAL EXECUTION SIZING & ORDER LADDER TERMINAL */}
      {activeHorizon && (
        <div className="border border-border bg-surface p-3 sm:p-4 rounded-none shadow-sm space-y-3.5">
          {/* Header & Capital Settings */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gold/10 border border-gold/30 rounded-none">
                <Calculator className="h-4 w-4 text-gold" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-foreground">
                  Institutional Trade Execution Ticket & Quantity Sizer
                </span>
                <div className="text-3xs font-mono text-muted-foreground">
                  Exact future accumulation price points, fractional Kelly volume sizing, stop-loss, and multi-tranche exits.
                </div>
              </div>
            </div>

            {/* Interactive Capital & Risk Configurator */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-2xs">
              <div className="flex items-center gap-1 border border-border bg-surface-muted px-2 py-1 rounded-none">
                <span className="text-3xs text-muted-foreground uppercase font-semibold">Capital:</span>
                <span className="text-foreground font-bold">₹</span>
                <input
                  type="number"
                  step="50000"
                  min="10000"
                  max="100000000"
                  value={portfolioCapital}
                  onChange={(e) => setPortfolioCapital(Number(e.target.value) || 500000)}
                  className="w-24 bg-transparent text-foreground font-bold focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 border border-border bg-surface-muted px-2 py-1 rounded-none">
                <span className="text-3xs text-muted-foreground uppercase font-semibold">Max Risk:</span>
                {[0.5, 1.0, 1.5, 2.0].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRiskPct(r)}
                    className={cn(
                      "px-1.5 py-0.5 text-3xs font-bold transition-all rounded-none",
                      riskPct === r
                        ? "bg-surface text-accent border border-border shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r}%
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopyExecutionTicket}
                className="flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-mono font-bold text-accent hover:bg-accent/20 transition-all rounded-none shadow-xs"
              >
                {copiedSlip ? (
                  <>
                    <Check className="h-3 w-3 text-up" />
                    <span className="text-up">Copied Ticket!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Execution Ticket</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Master Execution Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 font-mono text-2xs">
            <div className="border border-border bg-surface-muted p-2 rounded-none">
              <div className="text-3xs text-muted-foreground uppercase font-semibold">Total Quantity</div>
              <div className="text-sm sm:text-base font-black text-accent mt-0.5">
                {activeHorizon.execution_plan.total_quantity} shares
              </div>
              <div className="text-3xs text-muted-foreground">
                {activeHorizon.execution_plan.capital_allocation_pct}% Portfolio Cap
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none">
              <div className="text-3xs text-muted-foreground uppercase font-semibold">Blended Entry</div>
              <div className="text-sm sm:text-base font-black text-foreground mt-0.5">
                ₹{activeHorizon.execution_plan.blended_entry.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
              </div>
              <div className="text-3xs text-muted-foreground">
                Weighted across 2 tranches
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none">
              <div className="text-3xs text-muted-foreground uppercase font-semibold text-down">Structural Hard SL</div>
              <div className="text-sm sm:text-base font-black text-down mt-0.5">
                ₹{activeHorizon.execution_plan.structural_stop_loss.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
              </div>
              <div className="text-3xs text-down font-medium">
                {activeHorizon.execution_plan.stop_loss_pct}% Below Entry
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none">
              <div className="text-3xs text-muted-foreground uppercase font-semibold">Max Downside Risk</div>
              <div className="text-sm sm:text-base font-black text-down mt-0.5">
                ₹{activeHorizon.execution_plan.max_risk_inr.toLocaleString("en-IN")}
              </div>
              <div className="text-3xs text-muted-foreground">
                ₹{activeHorizon.execution_plan.risk_per_share} risk/share
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none">
              <div className="text-3xs text-muted-foreground uppercase font-semibold text-up">Risk/Reward (RRR)</div>
              <div className="text-sm sm:text-base font-black text-up mt-0.5">
                1 : {activeHorizon.execution_plan.risk_reward_ratio}
              </div>
              <div className="text-3xs text-up font-medium">
                Positive Expectancy
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none">
              <div className="text-3xs text-muted-foreground uppercase font-semibold">Trailing Vol SL</div>
              <div className="text-sm sm:text-base font-black text-foreground mt-0.5">
                ₹{activeHorizon.execution_plan.trailing_stop_loss.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
              </div>
              <div className="text-3xs text-muted-foreground">
                Dynamic 1.2x ATR
              </div>
            </div>
          </div>

          {/* TWO-COLUMN DETAILS: ACCUMULATION LADDER VS EXIT TARGETS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 font-mono text-2xs">
            {/* BUY ACCUMULATION LADDER */}
            <div className="border border-border/80 bg-surface-muted/40 p-3 rounded-none space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="font-bold uppercase tracking-wider text-accent text-3xs flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3" /> FUTURE ACCUMULATION ORDER LADDER (ENTRY POINTS)
                </span>
                <span className="text-3xs text-muted-foreground">
                  Total Capital: ₹{activeHorizon.execution_plan.required_capital_inr.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="space-y-2">
                {activeHorizon.execution_plan.buy_tranches.map((b, i) => (
                  <div
                    key={i}
                    className="border border-border/60 bg-surface p-2 rounded-none space-y-1 cell-glow"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">
                        {b.tranche}
                      </span>
                      <span className="text-accent font-bold">
                        {b.quantity} shares ({b.weight_pct}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-3xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Buy Price:</span>
                        <strong className="text-foreground text-xs">
                          ₹{b.price.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                        </strong>
                        <span className="text-muted-foreground">
                          ({b.pct_from_spot >= 0 ? "+" : ""}{b.pct_from_spot}% vs CMP)
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        Allocation: ₹{b.capital_inr.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="text-3xs text-muted-foreground border-t border-border/40 pt-1">
                      Trigger: {b.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SELL PROFIT-TAKING TARGETS */}
            <div className="border border-border/80 bg-surface-muted/40 p-3 rounded-none space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="font-bold uppercase tracking-wider text-up text-3xs flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> MULTI-TRANCHE TAKE-PROFIT EXIT LADDER (SELL POINTS)
                </span>
                <span className="text-3xs text-up font-semibold">
                  Disciplined Profit Booking
                </span>
              </div>

              <div className="space-y-2">
                {activeHorizon.execution_plan.sell_tranches.map((s, i) => (
                  <div
                    key={i}
                    className="border border-border/60 bg-surface p-2 rounded-none space-y-1 cell-glow"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">
                        {s.target}
                      </span>
                      <span className="text-up font-bold">
                        +{s.pct_gain}% (+₹{s.expected_profit_inr.toLocaleString("en-IN")})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-3xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Sell Price:</span>
                        <strong className="text-up text-xs">
                          ₹{s.price.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                        </strong>
                      </div>
                      <span className="text-accent">
                        Volume: {s.quantity} shares
                      </span>
                    </div>

                    <div className="text-3xs text-muted-foreground border-t border-border/40 pt-1">
                      Action Rule: <strong className="text-foreground">{s.action}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
