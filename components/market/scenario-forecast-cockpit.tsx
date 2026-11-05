"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Check,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  Layers,
  Percent,
  Radio,
  Receipt,
  RefreshCw,
  Scale,
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
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScenarioForecastResponse | null>(null);
  const [copiedSlip, setCopiedSlip] = useState<boolean>(false);

  // Live Auto-Polling and Sub-Second Tick Engine
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(3); // 3s ultra-live polling
  const [countdown, setCountdown] = useState<number>(3);
  const [pollSeq, setPollSeq] = useState<number>(1);
  const [tickFlash, setTickFlash] = useState<"up" | "down" | "sync" | null>(null);
  const prevSpotRef = useRef<number | null>(null);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>(() =>
    new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  );

  // Model Visibility Toggles in Visualizer
  const [showVisualizer, setShowVisualizer] = useState<boolean>(true);
  const [soloModel, setSoloModel] = useState<string | null>(null);
  const [enabledModels, setEnabledModels] = useState<Record<string, boolean>>({});
  const [hoveredModelIdx, setHoveredModelIdx] = useState<number | null>(null);

  const fetchData = useCallback(
    async (sym: string, capital: number, rPct: number, isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setIsSyncing(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/forecast/scenarios?symbol=${encodeURIComponent(
            sym.toUpperCase(),
          )}&exchange=NSE&capital=${encodeURIComponent(
            capital,
          )}&risk_pct=${encodeURIComponent(rPct)}&_t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(`Engine returned status ${res.status}`);
        }
        const json = await res.json();
        if (json.data) {
          const newSpot = json.data.spot;
          if (newSpot && prevSpotRef.current !== null) {
            if (newSpot > prevSpotRef.current) {
              setTickFlash("up");
              setTimeout(() => setTickFlash(null), 1400);
            } else if (newSpot < prevSpotRef.current) {
              setTickFlash("down");
              setTimeout(() => setTickFlash(null), 1400);
            } else {
              setTickFlash("sync");
              setTimeout(() => setTickFlash(null), 1400);
            }
          }
          if (newSpot) prevSpotRef.current = newSpot;

          setData(json.data);
          setPollSeq((s) => s + 1);
          setLastRefreshedTime(
            new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            }),
          );
        } else {
          throw new Error("No forecast data returned");
        }
      } catch (err: any) {
        if (!isSilent) setError(err.message || "Failed to load forecast engine");
      } finally {
        setLoading(false);
        setIsSyncing(false);
      }
    },
    [],
  );

  // Initial load or symbol/settings change
  useEffect(() => {
    void fetchData(symbol, portfolioCapital, riskPct, false);
    setCountdown(autoRefreshSecs);
  }, [symbol, portfolioCapital, riskPct, fetchData, autoRefreshSecs]);

  // Live Auto-Refresh Countdown Loop
  useEffect(() => {
    if (autoRefreshSecs === 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void fetchData(symbol, portfolioCapital, riskPct, true);
          return autoRefreshSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshSecs, symbol, portfolioCapital, riskPct, fetchData]);

  const activeHorizon =
    data?.horizons.find((h) => h.code === selectedHorizonCode) ||
    data?.horizons[2] ||
    null;

  // Initialize all models enabled by default
  useEffect(() => {
    if (activeHorizon?.models) {
      const initial: Record<string, boolean> = {};
      activeHorizon.models.forEach((m) => {
        initial[m.name] = true;
      });
      setEnabledModels((prev) => (Object.keys(prev).length === 0 ? initial : prev));
    }
  }, [activeHorizon?.models]);

  // Pulse glow styling helper for consistent terminal update animation
  const pulseClass =
    tickFlash === "up"
      ? "border-up/60 shadow-[0_0_12px_rgba(16,185,129,0.22)] transition-all duration-300"
      : tickFlash === "down"
      ? "border-down/60 shadow-[0_0_12px_rgba(239,68,68,0.22)] transition-all duration-300"
      : tickFlash === "sync"
      ? "border-accent/60 shadow-[0_0_12px_rgba(6,182,212,0.22)] transition-all duration-300"
      : "border-border transition-all duration-300";

  // Quantitative Sizing: Fractional Kelly & Round-Trip Statutory Calculations
  const quantSizing = useMemo(() => {
    if (!activeHorizon || !data) return null;

    const plan = activeHorizon.execution_plan;
    const cons = activeHorizon.consensus;
    const spot = data.spot;
    const qty = plan.total_quantity;
    const entry = plan.blended_entry;
    const exitTp1 = plan.sell_tranches[0]?.price ?? entry * 1.02;

    // Fractional Kelly Calculation:
    // Win rate probability derived from confidence and consensus bias
    const winRate = Math.min(
      0.85,
      Math.max(0.40, (cons.confidence_pct / 100.0) * 0.70 + 0.15)
    );
    const rrr = Math.max(1.0, plan.risk_reward_ratio);
    // Kelly Formula: f* = (p * b - q) / b
    const fullKellyFrac = Math.max(0, (winRate * rrr - (1 - winRate)) / rrr);
    const halfKellyFrac = fullKellyFrac * 0.5;
    const quarterKellyFrac = fullKellyFrac * 0.25;

    const quarterKellyCap = Math.min(portfolioCapital, Math.max(10000, portfolioCapital * quarterKellyFrac));
    const quarterKellyQty = Math.max(1, Math.floor(quarterKellyCap / entry));

    const halfKellyCap = Math.min(portfolioCapital, Math.max(10000, portfolioCapital * halfKellyFrac));
    const halfKellyQty = Math.max(1, Math.floor(halfKellyCap / entry));

    const fullKellyCap = Math.min(portfolioCapital, Math.max(10000, portfolioCapital * fullKellyFrac));
    const fullKellyQty = Math.max(1, Math.floor(fullKellyCap / entry));

    // Indian Statutory Round-Trip Friction (NSE Cash Equity Delivery):
    // Buy Turnover: Qty * Entry | Sell Turnover: Qty * Exit
    const buyTurnover = qty * entry;
    const sellTurnover = qty * exitTp1;
    const totalTurnover = buyTurnover + sellTurnover;

    const brokerage = 40.0; // Standard flat ₹20 buy + ₹20 sell
    const stt = 0.001 * totalTurnover; // 0.1% buy + 0.1% sell delivery STT
    const exchangeTxn = 0.0000297 * totalTurnover; // 0.00297% NSE txn charges
    const sebiCharges = 0.000001 * totalTurnover; // ₹10/crore SEBI turnover fee
    const stampDuty = 0.00015 * buyTurnover; // 0.015% buy stamp duty
    const gst = 0.18 * (brokerage + exchangeTxn + sebiCharges); // 18% GST on services
    const dpCharges = 15.93; // ₹13.50 + 18% GST depository participant charge on sell
    const totalFriction = brokerage + stt + exchangeTxn + sebiCharges + stampDuty + gst + dpCharges;

    const breakevenHurdlePts = qty > 0 ? totalFriction / qty : 0;
    const grossTp1Profit = qty * (exitTp1 - entry);
    const netTp1Profit = grossTp1Profit - totalFriction;
    const frictionDragPct = grossTp1Profit > 0 ? (totalFriction / grossTp1Profit) * 100 : 0;

    // Risk Parameters
    const dailyVol = (data.parameters.annualized_realized_vol_pct / 100.0) / Math.sqrt(252);
    const parametricVar95 = 1.645 * dailyVol * plan.required_capital_inr;
    const parametricCvar95 = 2.063 * dailyVol * plan.required_capital_inr;

    return {
      winRate: (winRate * 100).toFixed(1),
      fullKellyFrac: (fullKellyFrac * 100).toFixed(1),
      halfKellyFrac: (halfKellyFrac * 100).toFixed(1),
      quarterKellyFrac: (quarterKellyFrac * 100).toFixed(1),
      quarterKellyQty,
      quarterKellyCap,
      halfKellyQty,
      halfKellyCap,
      fullKellyQty,
      fullKellyCap,
      statutory: {
        brokerage,
        stt,
        exchangeTxn,
        sebiCharges,
        stampDuty,
        gst,
        dpCharges,
        totalFriction,
        breakevenHurdlePts,
        grossTp1Profit,
        netTp1Profit,
        frictionDragPct,
      },
      risk: {
        dailyVolPct: (dailyVol * 100).toFixed(2),
        parametricVar95,
        parametricCvar95,
      },
    };
  }, [activeHorizon, data, portfolioCapital]);

  // Visualizer Coordinate Calculations
  const visualizerData = useMemo(() => {
    if (!activeHorizon || !data) return null;

    const spot = data.spot;
    const visibleModels = activeHorizon.models.filter(
      (m) => enabledModels[m.name] !== false
    );
    const cons = activeHorizon.consensus;

    const allPrices = [
      spot,
      cons.consensus_bear,
      cons.consensus_base,
      cons.consensus_bull,
      ...visibleModels.flatMap((m) => [m.bear, m.base, m.bull]),
    ].filter((p) => typeof p === "number" && !isNaN(p));

    const minP = Math.min(...allPrices) * 0.995;
    const maxP = Math.max(...allPrices) * 1.005;
    const spanP = Math.max(1, maxP - minP);

    const svgW = 900;
    const svgH = 260;
    const padTop = 26;
    const padBottom = 40;
    const padLeft = 45;
    const padRight = 70;
    const usableW = svgW - padLeft - padRight;
    const usableH = svgH - padTop - padBottom;

    const pToY = (p: number) =>
      padTop + (1.0 - (p - minP) / spanP) * usableH;

    // Total columns = visible models count + 1 (for AHCI consensus)
    const nCols = visibleModels.length + 1;
    const colStep = usableW / nCols;

    return {
      svgW,
      svgH,
      minP,
      maxP,
      pToY,
      padLeft,
      padRight,
      colStep,
      usableW,
      usableH,
      visibleModels,
      spotY: pToY(spot),
    };
  }, [activeHorizon, data, enabledModels]);

  function handleCopyExecutionTicket() {
    if (!activeHorizon || !data || !quantSizing) return;
    const plan = activeHorizon.execution_plan;
    const cons = activeHorizon.consensus;
    const stat = quantSizing.statutory;

    const ticket = `[ARTHDEX INSTITUTIONAL EXECUTION SLIP]
Symbol: ${data.symbol} (NSE) | CMP: ₹${data.spot}
Horizon: ${activeHorizon.label} (${activeHorizon.days} Trading Days)
AHCI Score: ${cons.ahci_score} | Bias: ${cons.directional_bias} | Action: ${cons.recommended_action}
Confidence: ${cons.confidence_pct}% | Model Dispersion: ${cons.dispersion_pct}%
--------------------------------------------------
CONSENSUS TARGET SCENARIOS:
- Bear: ₹${cons.consensus_bear} (Δ ${(cons.consensus_bear - data.spot).toFixed(1)} pts / ${cons.consensus_bear_pct}%)
- Base: ₹${cons.consensus_base} (Δ ${(cons.consensus_base - data.spot).toFixed(1)} pts / ${cons.consensus_base_pct}%)
- Bull: ₹${cons.consensus_bull} (Δ +${(cons.consensus_bull - data.spot).toFixed(1)} pts / +${cons.consensus_bull_pct}%)
--------------------------------------------------
QUANTITATIVE SIZING & ACCUMULATION:
- Fixed Risk Allocation: ${plan.total_quantity} shares (₹${plan.required_capital_inr.toLocaleString("en-IN")})
- Quarter-Kelly Suggestion: ${quantSizing.quarterKellyQty} shares (₹${quantSizing.quarterKellyCap.toLocaleString("en-IN")})
- Blended Avg Entry: ₹${plan.blended_entry}
- Tranche 1 (40% POC Pullback): Buy ${plan.buy_tranches[0]?.quantity} shares @ ₹${plan.buy_tranches[0]?.price}
- Tranche 2 (60% Deep VAL Block): Buy ${plan.buy_tranches[1]?.quantity} shares @ ₹${plan.buy_tranches[1]?.price}
--------------------------------------------------
STATUTORY FRICTION & BREAKEVEN HURDLE (NSE):
- Total Round-Trip Friction: ₹${stat.totalFriction.toFixed(2)} (STT: ₹${stat.stt.toFixed(2)}, Exch: ₹${stat.exchangeTxn.toFixed(2)})
- Breakeven Hurdle: +₹${stat.breakevenHurdlePts.toFixed(2)} / share
- Net TP1 Profit Expectation: ₹${stat.netTp1Profit.toFixed(2)} (Gross: ₹${stat.grossTp1Profit.toFixed(2)})
- Friction Drag: ${stat.frictionDragPct.toFixed(1)}% of Gross Target
--------------------------------------------------
RISK MITIGATION & SL:
- Structural Hard SL: ₹${plan.structural_stop_loss} (${plan.stop_loss_pct}%)
- Trailing Vol SL: ₹${plan.trailing_stop_loss} (1.2x ATR)
- Max Downside Risk: ₹${plan.max_risk_inr.toLocaleString("en-IN")} (${plan.risk_pct}%)
- Risk/Reward Ratio: 1 : ${plan.risk_reward_ratio}
--------------------------------------------------
TARGET EXITS:
- TP 1 (50% scale-out): ₹${plan.sell_tranches[0]?.price} (Move SL to Breakeven)
- TP 2 (30% scale-out): ₹${plan.sell_tranches[1]?.price}
- TP 3 (20% runner): ₹${plan.sell_tranches[2]?.price}
Timestamp: ${new Date().toLocaleString("en-IN")}`;

    void navigator.clipboard.writeText(ticket);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2000);
  }

  return (
    <div className="space-y-3 font-sans rounded-none">
      {/* 1. TOP TELEMETRY RIBBON & BELLWETHER CONTROLS */}
      <div className={cn("bg-surface p-2.5 sm:p-3 shadow-xs rounded-none space-y-2.5 border", pulseClass)}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-2.5">
          {/* Left: Active Ticker, Live Spot, Directional Flash */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-surface-muted px-2 py-1 border border-border rounded-none">
              <Cpu className="h-3.5 w-3.5 text-accent animate-pulse" />
              <span className="font-mono text-xs font-black tracking-wide text-foreground uppercase">
                {symbol}
              </span>
              <span className="text-3xs font-mono text-muted-foreground uppercase">
                NSE
              </span>
            </div>

            {/* Live Exchange CMP with Tick Flash */}
            {data && (
              <div
                className={cn(
                  "flex items-baseline gap-1.5 px-2 py-0.5 border font-mono transition-all duration-200 rounded-none",
                  tickFlash === "up"
                    ? "bg-up/25 border-up text-up shadow-[0_0_8px_rgba(16,185,129,0.35)]"
                    : tickFlash === "down"
                    ? "bg-down/25 border-down text-down shadow-[0_0_8px_rgba(239,68,68,0.35)]"
                    : tickFlash === "sync"
                    ? "bg-accent/25 border-accent text-accent shadow-[0_0_8px_rgba(6,182,212,0.35)]"
                    : "bg-surface-raised border-border text-foreground",
                )}
              >
                <span className="text-sm sm:text-base font-black tabular-nums">
                  ₹{data.spot.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
                  CMP · {data.asOf}
                </span>
              </div>
            )}

            {/* Live Sequence & Sync Meter */}
            <div className="flex items-center gap-1.5 bg-surface-raised border border-border px-2 py-0.5 text-2xs font-mono rounded-none">
              <div className="flex items-end gap-0.5 h-3" title="Real-Time Exchange Data Stream">
                <span className="w-0.5 h-3 bg-up animate-pulse" />
                <span className="w-0.5 h-2 bg-up animate-pulse" style={{ animationDelay: "150ms" }} />
                <span className="w-0.5 h-2.5 bg-up animate-pulse" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="font-bold text-foreground tracking-wide tabular-nums">
                LIVE #{pollSeq}
              </span>
              <span className="text-muted-foreground text-3xs hidden sm:inline">
                ({lastRefreshedTime})
              </span>
            </div>
          </div>

          {/* Right: Live Cadence Selector & Recalculate */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Auto-Refresh Cadence */}
            <div className="flex items-center border border-border bg-surface-muted rounded-none p-0.5 text-xs font-mono">
              <span className="text-3xs uppercase tracking-wider text-muted-foreground px-1.5 hidden sm:inline flex items-center gap-1">
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

            {/* Countdown Badge */}
            {autoRefreshSecs > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground bg-surface-muted/60 px-1.5 py-0.5 border border-border/60 text-2xs font-mono rounded-none">
                <span>Next:</span>
                <span className="font-bold text-accent tabular-nums">{countdown}s</span>
                <span className="inline-block h-2 w-0.5 bg-accent animate-pulse" />
              </div>
            )}

            {/* Manual Sync Button */}
            <button
              onClick={() => void fetchData(symbol, portfolioCapital, riskPct, false)}
              disabled={loading || isSyncing}
              className="flex items-center gap-1 border border-border bg-surface-raised px-2 py-1 text-2xs font-mono font-medium text-foreground hover:bg-surface-muted transition-colors rounded-none disabled:opacity-50"
            >
              <RefreshCw
                className={cn("h-3 w-3 text-accent", (loading || isSyncing) && "animate-spin")}
              />
              <span className="hidden sm:inline">
                {isSyncing ? "Adjusting..." : "Sync"}
              </span>
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

      {/* 3. MASTER ARTHDEX HYBRID CONSENSUS INDEX (AHCI) HERO & SCENARIO CARDS */}
      {activeHorizon && (
        <div className={cn("bg-surface p-3 sm:p-4 rounded-none shadow-sm space-y-3 border", pulseClass)}>
          {/* Header Row: AHCI Score & Bias */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-accent/10 border border-accent/30 rounded-none">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 font-mono">
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
            <div className="flex flex-wrap items-center gap-2 font-mono text-2xs">
              <div className="border border-border bg-surface-muted px-2.5 py-1 text-right rounded-none">
                <div className="text-3xs text-muted-foreground uppercase font-semibold">AHCI Score</div>
                <div
                  className={cn(
                    "font-black text-sm tabular-nums",
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
                <div className="font-black text-sm text-foreground tabular-nums">
                  {activeHorizon.consensus.confidence_pct}%
                </div>
              </div>

              <div className="border border-border bg-surface-muted px-2.5 py-1 text-right rounded-none">
                <div className="text-3xs text-muted-foreground uppercase font-semibold">Model Dispersion</div>
                <div className="font-black text-sm text-muted-foreground tabular-nums">
                  {activeHorizon.consensus.dispersion_pct}%
                </div>
              </div>
            </div>
          </div>

          {/* 3-COLUMN SCENARIO FORECAST CARDS WITH EXPLICIT DELTAS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono">
            {/* BEAR SCENARIO */}
            {(() => {
              const diff = (activeHorizon.consensus.consensus_bear - (data?.spot ?? 0));
              return (
                <div className="border border-down/30 bg-down/5 p-3 rounded-none relative overflow-hidden cell-glow">
                  <div className="flex items-center justify-between text-3xs text-down font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3.5 w-3.5" /> BEAR SCENARIO
                    </span>
                    <span>P(Bear) ≈ 20%</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums">
                    ₹{activeHorizon.consensus.consensus_bear.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>

                  {/* Explicit Delta Display */}
                  <div className="mt-1.5 flex items-center justify-between text-2xs font-bold border-t border-down/20 pt-1.5">
                    <span className="text-down flex items-center gap-1 tabular-nums">
                      Δ {diff < 0 ? "-" : "+"}₹{Math.abs(diff).toFixed(2)} pts
                    </span>
                    <span className="text-down bg-down/15 px-1.5 py-0.2 rounded-none border border-down/30 tabular-nums">
                      {activeHorizon.consensus.consensus_bear_pct}%
                    </span>
                  </div>
                  <div className="text-3xs text-muted-foreground mt-1.5 leading-relaxed">
                    Downside liquidation limit below Value Area Low & -1.6σ dispersion band.
                  </div>
                </div>
              );
            })()}

            {/* BASE SCENARIO */}
            {(() => {
              const diff = (activeHorizon.consensus.consensus_base - (data?.spot ?? 0));
              const isUp = diff >= 0;
              return (
                <div className="border border-accent/40 bg-accent/5 p-3 rounded-none relative overflow-hidden cell-glow">
                  <div className="flex items-center justify-between text-3xs text-accent font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" /> BASE SCENARIO (MEDIAN)
                    </span>
                    <span>P(Base) ≈ 50%</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums">
                    ₹{activeHorizon.consensus.consensus_base.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>

                  {/* Explicit Delta Display */}
                  <div className="mt-1.5 flex items-center justify-between text-2xs font-bold border-t border-accent/20 pt-1.5">
                    <span
                      className={cn(
                        "flex items-center gap-1 tabular-nums",
                        isUp ? "text-up" : "text-down",
                      )}
                    >
                      Δ {isUp ? "+" : "-"}₹{Math.abs(diff).toFixed(2)} pts
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-none border tabular-nums",
                        isUp ? "text-up bg-up/15 border-up/30" : "text-down bg-down/15 border-down/30",
                      )}
                    >
                      {activeHorizon.consensus.consensus_base_pct > 0 ? "+" : ""}
                      {activeHorizon.consensus.consensus_base_pct}%
                    </span>
                  </div>
                  <div className="text-3xs text-muted-foreground mt-1.5 leading-relaxed">
                    Central statistical drift reverting toward Volume Weighted Average Price (VWAP) equilibrium.
                  </div>
                </div>
              );
            })()}

            {/* BULL SCENARIO */}
            {(() => {
              const diff = (activeHorizon.consensus.consensus_bull - (data?.spot ?? 0));
              return (
                <div className="border border-up/30 bg-up/5 p-3 rounded-none relative overflow-hidden cell-glow">
                  <div className="flex items-center justify-between text-3xs text-up font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> BULL SCENARIO
                    </span>
                    <span>P(Bull) ≈ 30%</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums">
                    ₹{activeHorizon.consensus.consensus_bull.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>

                  {/* Explicit Delta Display */}
                  <div className="mt-1.5 flex items-center justify-between text-2xs font-bold border-t border-up/20 pt-1.5">
                    <span className="text-up flex items-center gap-1 tabular-nums">
                      Δ +₹{diff.toFixed(2)} pts
                    </span>
                    <span className="text-up bg-up/15 px-1.5 py-0.2 rounded-none border border-up/30 tabular-nums">
                      +{activeHorizon.consensus.consensus_bull_pct}%
                    </span>
                  </div>
                  <div className="text-3xs text-muted-foreground mt-1.5 leading-relaxed">
                    Upside expansion target with options gamma squeeze above Value Area High & +1.6σ band.
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. MULTI-ALGORITHM INTERACTIVE LIVE VISUALIZER & TOGGLE DESK */}
      {activeHorizon && data && (
        <div className={cn("bg-surface p-3 sm:p-3.5 rounded-none shadow-sm space-y-2.5 border transition-all duration-500", pulseClass)}>
          {/* Header & Controls: Title, Live Pulse Pill, Filters & Master Show/Hide Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
            <div className="flex items-center gap-2">
              <Zap className={cn("h-3.5 w-3.5 transition-colors", tickFlash === "up" ? "text-up" : tickFlash === "down" ? "text-down" : "text-gold")} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                Multi-Algorithm Live Visualizer & Dispersion Desk
              </span>
              {/* Live Color Pulse Badge */}
              <span
                className={cn(
                  "px-2 py-0.5 text-3xs font-mono font-black uppercase tracking-wider border rounded-none transition-all duration-300 flex items-center gap-1.5",
                  tickFlash === "up"
                    ? "bg-up/20 border-up text-up shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    : tickFlash === "down"
                    ? "bg-down/20 border-down text-down shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    : "bg-surface-raised border-border text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-none",
                    tickFlash === "up" ? "bg-up animate-pulse" : tickFlash === "down" ? "bg-down animate-pulse" : "bg-accent",
                  )}
                />
                <span>
                  {tickFlash === "up"
                    ? "▲ LIVE TICK EXPANSION"
                    : tickFlash === "down"
                    ? "▼ LIVE TICK CONTRACTION"
                    : "● LIVE SYNC ACTIVE"}
                </span>
              </span>
            </div>

            {/* Master Show/Hide Toggle & Action Chips */}
            <div className="flex items-center gap-1.5 font-mono text-3xs">
              {soloModel && (
                <button
                  onClick={() => setSoloModel(null)}
                  className="px-2 py-0.5 bg-accent/20 border border-accent text-accent font-bold hover:bg-accent hover:text-black transition-colors rounded-none"
                >
                  EXIT SOLO ({soloModel.split(" ")[0]})
                </button>
              )}

              <button
                onClick={() => {
                  setSoloModel(null);
                  const allOn = activeHorizon.models.every((m) => enabledModels[m.name] !== false);
                  const next: Record<string, boolean> = {};
                  activeHorizon.models.forEach((m) => {
                    next[m.name] = !allOn;
                  });
                  setEnabledModels(next);
                }}
                className="px-2 py-0.5 border border-border bg-surface-muted hover:bg-surface-raised text-foreground font-semibold rounded-none transition-colors"
              >
                TOGGLE ALL ({activeHorizon.models.length})
              </button>

              <button
                onClick={() => setShowVisualizer((prev) => !prev)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-0.5 border font-bold rounded-none transition-all",
                  showVisualizer
                    ? "bg-accent/15 border-accent text-accent"
                    : "bg-surface-raised border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {showVisualizer ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span>{showVisualizer ? "HIDE VISUALIZER" : "SHOW VISUALIZER"}</span>
              </button>
            </div>
          </div>

          {/* VISUALIZER BODY (HIGH DENSITY HORIZONTAL RANGE CORRIDORS - ZERO WASTED BLANK SPACE) */}
          {showVisualizer ? (
            <div className="space-y-1.5 font-mono">
              {/* Benchmark Reference Banner: Current CMP & Value Spread */}
              <div className="flex items-center justify-between bg-surface-muted/60 border border-border/80 px-2.5 py-1 text-3xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">BENCHMARK CMP:</span>
                  <strong className="text-foreground text-xs font-black">
                    ₹{data.spot.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>
                  <span>· Horizon: {activeHorizon.label} ({activeHorizon.days} Trading Days)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-1 bg-down inline-block" /> Bear Corridor
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-1 bg-up inline-block" /> Bull Corridor
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-foreground inline-block" /> Base Projection
                  </span>
                </div>
              </div>

              {/* DENSE HORIZONTAL RANGE CORRIDOR ROWS (ONE PER MODEL + CONSENSUS) */}
              <div className="border border-border divide-y divide-border/60 bg-black/40">
                {/* 1. INDIVIDUAL ALGORITHMIC MODELS */}
                {(() => {
                  // Compute min and max across all enabled models and consensus for uniform 100% horizontal scale
                  const visible = activeHorizon.models.filter(
                    (m) => (soloModel ? m.name === soloModel : enabledModels[m.name] !== false)
                  );
                  const cons = activeHorizon.consensus;
                  const allP = [
                    data.spot,
                    cons.consensus_bear,
                    cons.consensus_bull,
                    ...visible.flatMap((m) => [m.bear, m.base, m.bull]),
                  ];
                  const minScale = Math.min(...allP) * 0.995;
                  const maxScale = Math.max(...allP) * 1.005;
                  const span = Math.max(1, maxScale - minScale);

                  const pctOf = (p: number) => Math.max(0, Math.min(100, ((p - minScale) / span) * 100));
                  const spotPct = pctOf(data.spot);

                  return (
                    <>
                      {activeHorizon.models.map((m) => {
                        const isVisible = soloModel ? soloModel === m.name : enabledModels[m.name] !== false;
                        const isSolo = soloModel === m.name;
                        const bearPct = pctOf(m.bear);
                        const basePct = pctOf(m.base);
                        const bullPct = pctOf(m.bull);
                        const bearDiff = m.bear - data.spot;
                        const baseDiff = m.base - data.spot;
                        const bullDiff = m.bull - data.spot;

                        return (
                          <div
                            key={m.name}
                            className={cn(
                              "p-2 flex flex-col md:flex-row md:items-center justify-between gap-2 transition-colors",
                              isVisible ? "hover:bg-surface-raised/40" : "opacity-40 bg-surface-muted/20",
                              isSolo && "bg-accent/[0.04] ring-1 ring-accent/40",
                            )}
                          >
                            {/* Left: Full Untruncated Algorithm Name & Controls */}
                            <div className="w-full md:w-56 shrink-0 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() =>
                                    setEnabledModels((prev) => ({
                                      ...prev,
                                      [m.name]: !isVisible,
                                    }))
                                  }
                                  className={cn(
                                    "px-1 py-0.2 border text-3xs font-bold rounded-none",
                                    isVisible ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground line-through"
                                  )}
                                  title="Toggle visibility"
                                >
                                  {isVisible ? "✓" : "×"}
                                </button>
                                <button
                                  onClick={() => setSoloModel(isSolo ? null : m.name)}
                                  className={cn(
                                    "px-1 py-0.2 border text-3xs font-black rounded-none transition-colors",
                                    isSolo ? "bg-accent text-black border-accent" : "border-border/80 text-muted-foreground hover:text-foreground"
                                  )}
                                  title="Isolate / Solo this algorithm"
                                >
                                  S
                                </button>
                                <span className="font-bold text-foreground text-2xs truncate" title={m.name}>
                                  {m.name}
                                </span>
                              </div>
                              <div className="text-3xs text-muted-foreground line-clamp-1 pl-7">
                                {m.rationale}
                              </div>
                            </div>

                            {/* Center: Full-Width Continuous Horizontal Range Bar */}
                            <div className="relative flex-1 h-7 bg-surface-muted/50 border border-border/70 flex items-center px-1">
                              {/* Global CMP Vertical Benchmark Hairline */}
                              <div
                                className="absolute top-0 bottom-0 w-[1.5px] bg-foreground/60 z-10"
                                style={{ left: `${spotPct}%` }}
                                title={`CMP Spot: ₹${data.spot.toFixed(1)}`}
                              />

                              {/* Range Bar: Bear to Bull Corridor */}
                              <div
                                className="absolute h-2.5 bg-down/30 border-y border-down/50"
                                style={{
                                  left: `${Math.min(bearPct, basePct)}%`,
                                  width: `${Math.abs(basePct - bearPct)}%`,
                                }}
                              />
                              <div
                                className="absolute h-2.5 bg-up/30 border-y border-up/50"
                                style={{
                                  left: `${Math.min(basePct, bullPct)}%`,
                                  width: `${Math.abs(bullPct - basePct)}%`,
                                }}
                              />

                              {/* Bear Point Marker */}
                              <div
                                className="absolute -translate-x-1/2 w-1.5 h-3.5 bg-down border border-down/80 z-10"
                                style={{ left: `${bearPct}%` }}
                                title={`Bear Target: ₹${m.bear.toFixed(1)}`}
                              />

                              {/* Base Point Marker (White Diamond/Square) */}
                              <div
                                className="absolute -translate-x-1/2 w-2.5 h-2.5 bg-foreground border border-background z-20"
                                style={{ left: `${basePct}%` }}
                                title={`Base Target: ₹${m.base.toFixed(1)}`}
                              />

                              {/* Bull Point Marker */}
                              <div
                                className="absolute -translate-x-1/2 w-1.5 h-3.5 bg-up border border-up/80 z-10"
                                style={{ left: `${bullPct}%` }}
                                title={`Bull Target: ₹${m.bull.toFixed(1)}`}
                              />
                            </div>

                            {/* Right: Explicit Forecast Values with Deltas (Wide Grid - Zero Clipping) */}
                            <div className="w-full md:min-w-[320px] md:w-80 shrink-0 grid grid-cols-3 gap-1.5 text-2xs tabular-nums">
                              {/* Bear */}
                              <div className="text-right pr-2">
                                <div className="text-down font-bold whitespace-nowrap">
                                  ₹{m.bear.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </div>
                                <div className="text-3xs text-down/90 whitespace-nowrap">
                                  {bearDiff < 0 ? "" : "+"}₹{bearDiff.toFixed(1)} ({m.bear_pct}%)
                                </div>
                              </div>

                              {/* Base */}
                              <div className="text-center px-2 border-x border-border/40">
                                <div className="font-bold text-foreground whitespace-nowrap">
                                  ₹{m.base.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </div>
                                <div className={cn("text-3xs whitespace-nowrap", baseDiff >= 0 ? "text-up" : "text-down")}>
                                  {baseDiff >= 0 ? "+" : ""}₹{baseDiff.toFixed(1)} ({baseDiff >= 0 ? `+${m.base_pct}` : m.base_pct}%)
                                </div>
                              </div>

                              {/* Bull */}
                              <div className="text-left pl-2">
                                <div className="text-up font-bold whitespace-nowrap">
                                  ₹{m.bull.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </div>
                                <div className="text-3xs text-up/90 whitespace-nowrap">
                                  +₹{bullDiff.toFixed(1)} (+{m.bull_pct}%)
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* 2. CONSOLIDATED AHCI CONSENSUS MASTER HERO ROW */}
                      {(() => {
                        const bearPct = pctOf(cons.consensus_bear);
                        const basePct = pctOf(cons.consensus_base);
                        const bullPct = pctOf(cons.consensus_bull);
                        const bearDiff = cons.consensus_bear - data.spot;
                        const baseDiff = cons.consensus_base - data.spot;
                        const bullDiff = cons.consensus_bull - data.spot;

                        return (
                          <div className="p-2.5 bg-gold/[0.06] border-t-2 border-gold/60 flex flex-col md:flex-row md:items-center justify-between gap-2 cell-glow">
                            {/* Left: Full Name & Bias Pill */}
                            <div className="w-full md:w-56 shrink-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.2 bg-gold text-black font-black text-3xs uppercase">
                                  ★ AHCI
                                </span>
                                <span className="font-black text-gold text-2xs">
                                  Consolidated Consensus Index
                                </span>
                              </div>
                              <div className="text-3xs text-muted-foreground pl-1">
                                Score: <strong className="text-gold">{cons.ahci_score}</strong> · Action: <strong className="text-foreground">{cons.recommended_action}</strong>
                              </div>
                            </div>

                            {/* Center: Highlighted Consensus Range Bar */}
                            <div className="relative flex-1 h-8 bg-surface border border-gold/40 flex items-center px-1 shadow-inner">
                              {/* Global CMP Benchmark */}
                              <div
                                className="absolute top-0 bottom-0 w-[2px] bg-foreground z-10"
                                style={{ left: `${spotPct}%` }}
                              />

                              {/* Shaded Corridor */}
                              <div
                                className="absolute h-4 bg-down/40 border-y border-down"
                                style={{
                                  left: `${Math.min(bearPct, basePct)}%`,
                                  width: `${Math.abs(basePct - bearPct)}%`,
                                }}
                              />
                              <div
                                className="absolute h-4 bg-up/40 border-y border-up"
                                style={{
                                  left: `${Math.min(basePct, bullPct)}%`,
                                  width: `${Math.abs(bullPct - basePct)}%`,
                                }}
                              />

                              {/* Master Bear Whisker */}
                              <div
                                className="absolute -translate-x-1/2 w-2 h-5 bg-down border border-white z-10"
                                style={{ left: `${bearPct}%` }}
                              />

                              {/* Master Consensus Base Diamond (Gold) */}
                              <div
                                className="absolute -translate-x-1/2 w-3.5 h-3.5 bg-gold border border-black shadow-[0_0_8px_rgba(245,158,11,0.8)] z-20"
                                style={{ left: `${basePct}%` }}
                              />

                              {/* Master Bull Whisker */}
                              <div
                                className="absolute -translate-x-1/2 w-2 h-5 bg-up border border-white z-10"
                                style={{ left: `${bullPct}%` }}
                              />
                            </div>

                            {/* Right: Master Target Numbers & Deltas (Wide Grid - Zero Clipping) */}
                            <div className="w-full md:min-w-[320px] md:w-80 shrink-0 grid grid-cols-3 gap-1.5 text-2xs tabular-nums font-black">
                              <div className="text-right pr-2">
                                <div className="text-down text-xs font-black whitespace-nowrap">
                                  ₹{cons.consensus_bear.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </div>
                                <div className="text-3xs text-down font-bold whitespace-nowrap">
                                  {bearDiff < 0 ? "" : "+"}₹{bearDiff.toFixed(1)} ({cons.consensus_bear_pct}%)
                                </div>
                              </div>

                              <div className="text-center px-2 border-x border-gold/40">
                                <div className="text-gold text-xs sm:text-sm font-black whitespace-nowrap">
                                  ₹{cons.consensus_base.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </div>
                                <div className={cn("text-3xs font-bold whitespace-nowrap", baseDiff >= 0 ? "text-up" : "text-down")}>
                                  {baseDiff >= 0 ? "+" : ""}₹{baseDiff.toFixed(1)} ({baseDiff >= 0 ? `+${cons.consensus_base_pct}` : cons.consensus_base_pct}%)
                                </div>
                              </div>

                              <div className="text-left pl-2">
                                <div className="text-up text-xs font-black whitespace-nowrap">
                                  ₹{cons.consensus_bull.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </div>
                                <div className="text-3xs text-up font-bold whitespace-nowrap">
                                  +₹{bullDiff.toFixed(1)} (+{cons.consensus_bull_pct}%)
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* COLLAPSED EXECUTIVE SUMMARY ROW (TAKES ZERO SPACE) */
            <div className="flex items-center justify-between bg-surface-muted/60 border border-border/80 px-3 py-1.5 font-mono text-2xs">
              <div className="flex items-center gap-2.5">
                <span className="px-1.5 py-0.2 bg-gold text-black font-bold text-3xs uppercase">
                  AHCI CONSENSUS
                </span>
                <span className="font-bold text-foreground">
                  Target: ₹{activeHorizon.consensus.consensus_base.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                </span>
                <span className="text-up font-semibold text-3xs tabular-nums">
                  (Δ +₹{(activeHorizon.consensus.consensus_base - data.spot).toFixed(1)} pts / +{activeHorizon.consensus.consensus_base_pct}%)
                </span>
                <span className="text-muted-foreground text-3xs hidden sm:inline">
                  · Active Models: {activeHorizon.models.length} Quantitative Algorithms
                </span>
              </div>
              <button
                onClick={() => setShowVisualizer(true)}
                className="flex items-center gap-1 px-2 py-0.5 border border-accent bg-accent/10 text-accent font-bold text-3xs rounded-none hover:bg-accent hover:text-black transition-colors"
              >
                <Eye className="h-3 w-3" />
                <span>EXPAND VISUALIZER</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. MULTI-ALGORITHM BREAKDOWN MATRIX */}
      {activeHorizon && data && (
        <div className={cn("bg-surface p-3 rounded-none shadow-xs space-y-2.5 border", pulseClass)}>
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
            <table className="w-full min-w-[720px] text-left font-mono text-2xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-surface-muted/50 text-muted-foreground text-3xs uppercase tracking-wider">
                  <th className="py-2 px-2.5 font-semibold">Algorithm / Model Specification</th>
                  <th className="py-2 px-2.5 font-semibold text-right text-down">Bear Prediction & Δ</th>
                  <th className="py-2 px-2.5 font-semibold text-right text-foreground">Base Prediction & Δ</th>
                  <th className="py-2 px-2.5 font-semibold text-right text-up">Bull Prediction & Δ</th>
                  <th className="py-2 px-2.5 font-semibold">Mathematical Catalyst / Volatility Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {activeHorizon.models.map((m, idx) => {
                  const bearDiff = m.bear - data.spot;
                  const baseDiff = m.base - data.spot;
                  const bullDiff = m.bull - data.spot;

                  return (
                    <tr key={idx} className="hover:bg-surface-muted/60 transition-colors">
                      <td className="py-2 px-2.5 font-bold text-foreground cell-glow">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 bg-accent rounded-none" />
                          <span>{m.name}</span>
                        </div>
                      </td>

                      {/* Bear Target & Delta */}
                      <td className="py-2 px-2.5 text-right font-medium text-down cell-glow tabular-nums">
                        <div>₹{m.bear.toLocaleString("en-IN", { minimumFractionDigits: 1 })}</div>
                        <div className="text-3xs font-semibold text-down/90 flex items-center justify-end gap-1">
                          <span>Δ {bearDiff < 0 ? "-" : "+"}₹{Math.abs(bearDiff).toFixed(1)}</span>
                          <span className="bg-down/10 px-1 py-0.2 border border-down/30">
                            {m.bear_pct}%
                          </span>
                        </div>
                      </td>

                      {/* Base Target & Delta */}
                      <td className="py-2 px-2.5 text-right font-medium text-foreground cell-glow tabular-nums">
                        <div>₹{m.base.toLocaleString("en-IN", { minimumFractionDigits: 1 })}</div>
                        <div
                          className={cn(
                            "text-3xs font-semibold flex items-center justify-end gap-1",
                            baseDiff >= 0 ? "text-up/90" : "text-down/90",
                          )}
                        >
                          <span>Δ {baseDiff >= 0 ? "+" : "-"}₹{Math.abs(baseDiff).toFixed(1)}</span>
                          <span
                            className={cn(
                              "px-1 py-0.2 border",
                              baseDiff >= 0 ? "bg-up/10 border-up/30 text-up" : "bg-down/10 border-down/30 text-down",
                            )}
                          >
                            {m.base_pct > 0 ? "+" : ""}{m.base_pct}%
                          </span>
                        </div>
                      </td>

                      {/* Bull Target & Delta */}
                      <td className="py-2 px-2.5 text-right font-medium text-up cell-glow tabular-nums">
                        <div>₹{m.bull.toLocaleString("en-IN", { minimumFractionDigits: 1 })}</div>
                        <div className="text-3xs font-semibold text-up/90 flex items-center justify-end gap-1">
                          <span>Δ +₹{bullDiff.toFixed(1)}</span>
                          <span className="bg-up/10 px-1 py-0.2 border border-up/30">
                            +{m.bull_pct}%
                          </span>
                        </div>
                      </td>

                      <td className="py-2 px-2.5 text-3xs text-muted-foreground leading-relaxed">
                        {m.rationale}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. QUANTITATIVE RISK & VOLATILITY ANALYTICS STRIP */}
      {data && quantSizing && (
        <div className={cn("bg-surface p-2.5 rounded-none shadow-xs border", pulseClass)}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 font-mono text-2xs">
            <div className="border border-border bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase font-semibold">Annual Drift (μ)</span>
              <div className="font-bold text-foreground mt-0.5 tabular-nums">
                {data.parameters.annualized_drift_pct > 0 ? "+" : ""}
                {data.parameters.annualized_drift_pct}%
              </div>
            </div>

            <div className="border border-border bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase font-semibold">Realized Vol (σ)</span>
              <div className="font-bold text-foreground mt-0.5 tabular-nums">
                {data.parameters.annualized_realized_vol_pct}%
              </div>
            </div>

            <div className="border border-border bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase font-semibold">Parkinson Vol</span>
              <div className="font-bold text-accent mt-0.5 tabular-nums">
                {data.parameters.parkinson_vol_pct}%
              </div>
            </div>

            <div className="border border-border bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase font-semibold">ATR-14 Range</span>
              <div className="font-bold text-foreground mt-0.5 tabular-nums">
                ₹{data.parameters.atr_14} ({((data.parameters.atr_14 / data.spot) * 100).toFixed(1)}%)
              </div>
            </div>

            <div className="border border-border bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase font-semibold text-down">1D 95% Parametric VaR</span>
              <div className="font-bold text-down mt-0.5 tabular-nums">
                ₹{quantSizing.risk.parametricVar95.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="border border-border bg-surface-muted/50 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase font-semibold text-down">1D 95% CVaR (Shortfall)</span>
              <div className="font-bold text-down mt-0.5 tabular-nums">
                ₹{quantSizing.risk.parametricCvar95.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. INSTITUTIONAL EXECUTION SIZING, FRACTIONAL KELLY & ROUND-TRIP FRICTION DESK */}
      {activeHorizon && data && quantSizing && (
        <div className={cn("bg-surface p-3 sm:p-4 rounded-none shadow-sm space-y-3.5 border", pulseClass)}>
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
                  Fractional Kelly sizing, round-trip statutory friction calculations, stop-loss, and multi-tranche exits.
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
                  className="w-24 bg-transparent text-foreground font-bold focus:outline-none tabular-nums"
                />
              </div>

              <div className="flex items-center gap-1 border border-border bg-surface-muted px-2 py-1 rounded-none">
                <span className="text-3xs text-muted-foreground uppercase font-semibold">Max Risk:</span>
                {[0.5, 1.0, 1.5, 2.0].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRiskPct(r)}
                    className={cn(
                      "px-1.5 py-0.5 text-3xs font-bold transition-all rounded-none tabular-nums",
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
            <div className="border border-border bg-surface-muted p-2 rounded-none cell-glow">
              <div className="text-3xs text-muted-foreground uppercase font-semibold">Total Quantity</div>
              <div className="text-sm sm:text-base font-black text-accent mt-0.5 tabular-nums">
                {activeHorizon.execution_plan.total_quantity} shares
              </div>
              <div className="text-3xs text-muted-foreground tabular-nums">
                {activeHorizon.execution_plan.capital_allocation_pct}% Portfolio Cap
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none cell-glow">
              <div className="text-3xs text-muted-foreground uppercase font-semibold">Blended Entry</div>
              <div className="text-sm sm:text-base font-black text-foreground mt-0.5 tabular-nums">
                ₹{activeHorizon.execution_plan.blended_entry.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
              </div>
              <div className="text-3xs text-muted-foreground">
                Weighted across 2 tranches
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none cell-glow">
              <div className="text-3xs text-muted-foreground uppercase font-semibold text-down">Structural Hard SL</div>
              <div className="text-sm sm:text-base font-black text-down mt-0.5 tabular-nums">
                ₹{activeHorizon.execution_plan.structural_stop_loss.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
              </div>
              <div className="text-3xs text-down font-medium tabular-nums">
                {activeHorizon.execution_plan.stop_loss_pct}% Below Entry
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none cell-glow">
              <div className="text-3xs text-muted-foreground uppercase font-semibold">Max Downside Risk</div>
              <div className="text-sm sm:text-base font-black text-down mt-0.5 tabular-nums">
                ₹{activeHorizon.execution_plan.max_risk_inr.toLocaleString("en-IN")}
              </div>
              <div className="text-3xs text-muted-foreground tabular-nums">
                ₹{activeHorizon.execution_plan.risk_per_share} risk/share
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none cell-glow">
              <div className="text-3xs text-muted-foreground uppercase font-semibold text-up">Risk/Reward (RRR)</div>
              <div className="text-sm sm:text-base font-black text-up mt-0.5 tabular-nums">
                1 : {activeHorizon.execution_plan.risk_reward_ratio}
              </div>
              <div className="text-3xs text-up font-medium">
                Positive Expectancy
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-2 rounded-none cell-glow">
              <div className="text-3xs text-muted-foreground uppercase font-semibold">Trailing Vol SL</div>
              <div className="text-sm sm:text-base font-black text-foreground mt-0.5 tabular-nums">
                ₹{activeHorizon.execution_plan.trailing_stop_loss.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
              </div>
              <div className="text-3xs text-muted-foreground">
                Dynamic 1.2x ATR
              </div>
            </div>
          </div>

          {/* TWO-COLUMN QUANTITATIVE DEEP-DIVE: FRACTIONAL KELLY VS ROUND-TRIP STATUTORY FRICTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 font-mono text-2xs">
            {/* FRACTIONAL KELLY SIZING ANALYSIS */}
            <div className="border border-border/80 bg-surface-muted/40 p-3 rounded-none space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="font-bold uppercase tracking-wider text-accent text-3xs flex items-center gap-1">
                  <Scale className="h-3 w-3" /> FRACTIONAL KELLY VOLUME SIZING COMPARATOR
                </span>
                <span className="text-3xs text-muted-foreground tabular-nums">
                  Model Win Probability: <strong className="text-foreground">{quantSizing.winRate}%</strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="border border-border/60 bg-surface p-2 rounded-none space-y-1">
                  <div className="text-3xs text-muted-foreground uppercase font-semibold">Quarter-Kelly (Conservative)</div>
                  <div className="text-xs font-bold text-foreground tabular-nums">
                    {quantSizing.quarterKellyQty} shares
                  </div>
                  <div className="text-3xs text-accent tabular-nums">
                    ₹{quantSizing.quarterKellyCap.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({quantSizing.quarterKellyFrac}%)
                  </div>
                </div>

                <div className="border border-border/60 bg-surface p-2 rounded-none space-y-1">
                  <div className="text-3xs text-muted-foreground uppercase font-semibold">Half-Kelly (Moderate)</div>
                  <div className="text-xs font-bold text-foreground tabular-nums">
                    {quantSizing.halfKellyQty} shares
                  </div>
                  <div className="text-3xs text-gold tabular-nums">
                    ₹{quantSizing.halfKellyCap.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({quantSizing.halfKellyFrac}%)
                  </div>
                </div>

                <div className="border border-border/60 bg-surface p-2 rounded-none space-y-1">
                  <div className="text-3xs text-muted-foreground uppercase font-semibold">Full Kelly (Theoretical Limit)</div>
                  <div className="text-xs font-bold text-foreground tabular-nums">
                    {quantSizing.fullKellyQty} shares
                  </div>
                  <div className="text-3xs text-muted-foreground tabular-nums">
                    ₹{quantSizing.fullKellyCap.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({quantSizing.fullKellyFrac}%)
                  </div>
                </div>
              </div>

              <div className="text-3xs text-muted-foreground border-t border-border/40 pt-1 leading-relaxed">
                Desk Principle: Quarter-Kelly mitigates variance tail-risk in equity swing regimes while locking positive geometric growth rate.
              </div>
            </div>

            {/* ROUND-TRIP STATUTORY FRICTION & BREAKEVEN HURDLE */}
            <div className="border border-border/80 bg-surface-muted/40 p-3 rounded-none space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="font-bold uppercase tracking-wider text-gold text-3xs flex items-center gap-1">
                  <Receipt className="h-3 w-3" /> ROUND-TRIP STATUTORY FRICTION & BREAKEVEN HURDLE (NSE)
                </span>
                <span className="text-3xs text-muted-foreground tabular-nums">
                  Friction Drag: <strong className="text-down">{quantSizing.statutory.frictionDragPct.toFixed(1)}%</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-3xs">
                <div className="border border-border/60 bg-surface p-1.5 rounded-none">
                  <span className="text-muted-foreground block">Brokerage (Buy/Sell):</span>
                  <span className="font-bold text-foreground">₹{quantSizing.statutory.brokerage.toFixed(2)}</span>
                </div>
                <div className="border border-border/60 bg-surface p-1.5 rounded-none">
                  <span className="text-muted-foreground block">STT (0.1% Deliv):</span>
                  <span className="font-bold text-foreground">₹{quantSizing.statutory.stt.toFixed(2)}</span>
                </div>
                <div className="border border-border/60 bg-surface p-1.5 rounded-none">
                  <span className="text-muted-foreground block">Exch Txn (0.00297%):</span>
                  <span className="font-bold text-foreground">₹{quantSizing.statutory.exchangeTxn.toFixed(2)}</span>
                </div>
                <div className="border border-border/60 bg-surface p-1.5 rounded-none">
                  <span className="text-muted-foreground block">SEBI + Stamp + GST:</span>
                  <span className="font-bold text-foreground">
                    ₹{(quantSizing.statutory.sebiCharges + quantSizing.statutory.stampDuty + quantSizing.statutory.gst + quantSizing.statutory.dpCharges).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-1 text-3xs">
                <div>
                  Total Round-Trip Friction: <strong className="text-down font-bold">₹{quantSizing.statutory.totalFriction.toFixed(2)}</strong>
                </div>
                <div>
                  Breakeven Hurdle: <strong className="text-gold font-bold">+₹{quantSizing.statutory.breakevenHurdlePts.toFixed(2)}/share</strong>
                </div>
                <div>
                  Net TP1 Profit: <strong className="text-up font-bold">₹{quantSizing.statutory.netTp1Profit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong>
                </div>
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
                <span className="text-3xs text-muted-foreground tabular-nums">
                  Total Capital: ₹{activeHorizon.execution_plan.required_capital_inr.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="space-y-2">
                {activeHorizon.execution_plan.buy_tranches.map((b, i) => {
                  const entryDiff = b.price - data.spot;
                  return (
                    <div
                      key={i}
                      className="border border-border/60 bg-surface p-2 rounded-none space-y-1 cell-glow"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {b.tranche}
                        </span>
                        <span className="text-accent font-bold tabular-nums">
                          {b.quantity} shares ({b.weight_pct}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-3xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Buy Price:</span>
                          <strong className="text-foreground text-xs tabular-nums">
                            ₹{b.price.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                          </strong>
                          <span className="text-down font-bold tabular-nums">
                            (Δ {entryDiff < 0 ? "-" : "+"}₹{Math.abs(entryDiff).toFixed(1)} / {b.pct_from_spot}%)
                          </span>
                        </div>
                        <span className="text-muted-foreground tabular-nums">
                          Allocation: ₹{b.capital_inr.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="text-3xs text-muted-foreground border-t border-border/40 pt-1">
                        Trigger: {b.rationale}
                      </div>
                    </div>
                  );
                })}
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
                {activeHorizon.execution_plan.sell_tranches.map((s, i) => {
                  const profitPts = s.price - data.spot;
                  return (
                    <div
                      key={i}
                      className="border border-border/60 bg-surface p-2 rounded-none space-y-1 cell-glow"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {s.target}
                        </span>
                        <span className="text-up font-bold tabular-nums">
                          +{s.pct_gain}% (+₹{s.expected_profit_inr.toLocaleString("en-IN")})
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-3xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Sell Price:</span>
                          <strong className="text-up text-xs tabular-nums">
                            ₹{s.price.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                          </strong>
                          <span className="text-up font-semibold tabular-nums">
                            (Δ +₹{profitPts.toFixed(1)} pts)
                          </span>
                        </div>
                        <span className="text-accent tabular-nums">
                          Volume: {s.quantity} shares
                        </span>
                      </div>

                      <div className="text-3xs text-muted-foreground border-t border-border/40 pt-1">
                        Action Rule: <strong className="text-foreground">{s.action}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
