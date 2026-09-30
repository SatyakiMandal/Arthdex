/** Contracts for the quantitative engine (Phase 3). */

export type ForecastHorizon = "1D" | "5D" | "21D";

export interface ReturnForecast {
  horizon: ForecastHorizon;
  label: string; // "1 Day" | "1 Week" | "1 Month"
  expectedReturnPct: number;
  /** 95% conformal prediction interval. */
  lowerBoundPct: number;
  upperBoundPct: number;
  signalConfidencePct: number;
}

export type VolatilityModel = "GARCH(1,1)" | "EGARCH(1,1)" | "HAR-RV" | "FIGARCH(1,d,1)";

export interface VolatilityModelRow {
  model: VolatilityModel;
  annualisedVolPct: number;
  /** Ensemble weight in [0, 1]; weights across rows sum to 1. */
  weight: number;
}

export interface VolatilityEnsemble {
  symbol: string;
  models: VolatilityModelRow[];
  consensusAnnualisedVolPct: number;
}

export interface MertonDefaultRisk {
  distanceToDefault: number; // in sigma
  defaultProbabilityPct: number;
  assetValueCr: number;
  debtBarrierCr: number;
  assetVolPct: number;
}

export interface VaRSuite {
  confidencePct: number; // typically 99
  horizonDays: number; // typically 1
  parametricVaRPct: number;
  historicalVaRPct: number;
  monteCarloVaRPct: number;
  expectedShortfallPct: number;
}

export interface MicrostructureMetrics {
  /** Price impact in bps per ₹10M (₹1 crore) of order flow. */
  kylesLambdaBps: number;
  /** Volume-synchronised probability of informed trading, [0, 1]. */
  vpin: number;
  vpinLabel: "Benign" | "Elevated" | "Toxic";
}

export type RegimeState = "BULL_LOW_VOL" | "BEAR_HIGH_VOL";

export interface MarkovRegime {
  currentState: RegimeState;
  bullLowVolProbability: number;
  bearHighVolProbability: number;
  expectedDurationDays: number;
  transitionMatrix: [[number, number], [number, number]];
}

export type ShapleyFactor =
  | "sentiment-shock"
  | "lodr-filings"
  | "volatility-impulse"
  | "macro-yield-shift"
  | "default-risk";

export interface ShapleyAttribution {
  factor: ShapleyFactor;
  label: string;
  /** Signed contribution to the forecast, in percentage points. */
  contributionPct: number;
}

export interface QuantBundle {
  symbol: string;
  forecasts: ReturnForecast[];
  volatility: VolatilityEnsemble;
  merton: MertonDefaultRisk;
  var: VaRSuite;
  microstructure: MicrostructureMetrics;
  regime: MarkovRegime;
  attribution: ShapleyAttribution[];
}
