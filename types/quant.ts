/**
 * Contracts for the Arthdex Quantitative Engine (Phase 3).
 *
 * This module defines the mathematical contracts, parameter shapes, and
 * probabilistic bounds used across risk modeling, volatility ensembles,
 * structural credit default estimation, and microstructure toxicity analytics.
 */

/**
 * Standard forward forecasting horizons:
 * - 1D: Next-day trading horizon
 * - 5D: Weekly swing horizon (5 trading sessions)
 * - 21D: Monthly derivative expiry cycle (~21 trading sessions)
 */
export type ForecastHorizon = "1D" | "5D" | "21D";

/**
 * Machine learning return forecast paired with split-conformal prediction intervals.
 * Unlike Gaussian standard error assumptions, conformal prediction intervals guarantee
 * exact finite-sample marginal coverage at the 95% confidence level.
 */
export interface ReturnForecast {
  /** Target trading window */
  horizon: ForecastHorizon;
  /** Human-readable display label ("1 Day" | "1 Week" | "1 Month") */
  label: string;
  /** Point expectation of percentage price change (+/- %) */
  expectedReturnPct: number;
  /** 95% conformal prediction lower bound (conservative worst-case) */
  lowerBoundPct: number;
  /** 95% conformal prediction upper bound (optimistic best-case) */
  upperBoundPct: number;
  /** Historical calibration signal confidence in [0, 100] */
  signalConfidencePct: number;
}

/**
 * Supported volatility models:
 * - GARCH(1,1): Standard generalized autoregressive conditional heteroskedasticity (Bollerslev 1986).
 * - EGARCH(1,1): Exponential GARCH capturing asymmetric leverage effect (bad news increases volatility more than good news).
 * - HAR-RV: Heterogeneous Autoregressive Realized Volatility capturing daily, weekly, and monthly market volatility components.
 * - FIGARCH(1,d,1): Fractionally integrated GARCH modeling long-memory persistence in volatility shocks.
 */
export type VolatilityModel = "GARCH(1,1)" | "EGARCH(1,1)" | "HAR-RV" | "FIGARCH(1,d,1)";

/**
 * Single volatility model specification within the ensemble.
 */
export interface VolatilityModelRow {
  /** Quantitative volatility model specification */
  model: VolatilityModel;
  /** Model estimated annualized volatility in percentage (%) */
  annualisedVolPct: number;
  /** Inverse-variance Bayesian ensemble weight in [0, 1]; rows sum to 1.0 */
  weight: number;
}

/**
 * Multi-model volatility ensemble consolidating multiple econometric specifications.
 */
export interface VolatilityEnsemble {
  /** NSE equity ticker symbol */
  symbol: string;
  /** Array of individual model estimates and ensemble weights */
  models: VolatilityModelRow[];
  /** Weighted consensus annualized volatility in percentage (%) */
  consensusAnnualisedVolPct: number;
}

/**
 * Robert C. Merton (1974) Structural Credit Default Risk Model.
 * Treats equity as a European call option on firm total assets with strike price equal to debt face value.
 *
 * Distance to Default (DD):
 *   DD = [ln(V / D) + (μ - 0.5 * σ_V^2) * T] / (σ_V * sqrt(T))
 *
 * Default Probability:
 *   PD = N(-DD) where N(·) is the cumulative standard normal distribution.
 */
export interface MertonDefaultRisk {
  /** Distance to default expressed in standard deviations (sigma) */
  distanceToDefault: number;
  /** Risk-neutral or empirical cumulative default probability (%) */
  defaultProbabilityPct: number;
  /** Total unobserved underlying firm asset value (₹ Cr) */
  assetValueCr: number;
  /** Short-term debt + 50% of long-term debt barrier (₹ Cr) */
  debtBarrierCr: number;
  /** Annualized volatility of firm underlying assets (%) */
  assetVolPct: number;
}

/**
 * Value at Risk (VaR) and Expected Shortfall (CVaR) risk suite.
 * Quantifies maximum potential capital loss over a specified horizon under three distinct methodologies:
 * 1. Parametric: Assumes Student-t or Normal log-returns
 * 2. Historical: Empirical quantile from historical returns distribution
 * 3. Monte Carlo: Geometric Brownian Motion (GBM) simulation with jump diffusion
 */
export interface VaRSuite {
  /** Confidence coefficient, typically 99% (Basel III / SEBI margin standard) */
  confidencePct: number;
  /** Forward horizon in trading days, typically 1D */
  horizonDays: number;
  /** Parametric VaR estimate (% of capital) */
  parametricVaRPct: number;
  /** Historical simulation VaR (% of capital) */
  historicalVaRPct: number;
  /** Monte Carlo simulation VaR (% of capital) */
  monteCarloVaRPct: number;
  /** Expected Shortfall (Conditional VaR): average loss when loss exceeds VaR threshold */
  expectedShortfallPct: number;
}

/**
 * Market microstructure liquidity and order flow toxicity indicators.
 */
export interface MicrostructureMetrics {
  /** Kyle's Lambda (Kyle 1985): Price impact in basis points per ₹1 Crore of net directional order flow */
  kylesLambdaBps: number;
  /** Volume-Synchronized Probability of Toxicity (VPIN - Easley et al. 2012), bounded in [0, 1] */
  vpin: number;
  /** Human-readable toxicity classification: "Benign" (<0.3), "Elevated" (0.3-0.7), or "Toxic" (>0.7) */
  vpinLabel: "Benign" | "Elevated" | "Toxic";
}

/**
 * Discrete market volatility and trend regimes:
 * - BULL_LOW_VOL: Favorable equity expansion phase with contained volatility
 * - BEAR_HIGH_VOL: Turbulent contraction phase characterized by volatility clusters and risk-off flows
 */
export type RegimeState = "BULL_LOW_VOL" | "BEAR_HIGH_VOL";

/**
 * Hamilton 2-state Markov Switching Regime model probabilities.
 */
export interface MarkovRegime {
  /** Currently classified regime state */
  currentState: RegimeState;
  /** Filtered probability of being in Bull / Low-Vol regime [0, 1] */
  bullLowVolProbability: number;
  /** Filtered probability of being in Bear / High-Vol regime [0, 1] */
  bearHighVolProbability: number;
  /** Expected regime duration in trading days */
  expectedDurationDays: number;
}

/**
 * Asset return sensitivity across 8 macro benchmarks via Ordinary Least Squares (OLS) regression:
 * R_asset = alpha + beta * R_benchmark + epsilon
 */
export interface QuantBenchmarkSensitivity {
  /** Benchmark code (e.g. NIFTY50, BANKNIFTY, USDINR, CRUDE, US10Y) */
  benchmark: string;
  /** Human-readable benchmark display name */
  label: string;
  /** Systematic regression slope (Beta) */
  beta: number;
  /** Jensen's annualized alpha (%) */
  alphaPct: number;
  /** Coefficient of determination (R-squared): proportion of variance explained [0, 1] */
  rSquared: number;
}

/**
 * Master quantitative dossier returned for a listed entity.
 */
export interface CompanyQuantDossier {
  symbol: string;
  forecasts: ReturnForecast[];
  volatility: VolatilityEnsemble;
  merton: MertonDefaultRisk;
  varSuite: VaRSuite;
  microstructure: MicrostructureMetrics;
  regime: MarkovRegime;
  sensitivities: QuantBenchmarkSensitivity[];
}
