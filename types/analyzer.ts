/** Contracts for the event-impact analyzer (mirrors backend/app/services/analyzer.py). */

export type AnalyzerKind = "listed" | "unlisted";
export type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface AnalyzerRun {
  id: string;
  kind: AnalyzerKind;
  company: string;
  ticker: string | null;
  start: string | null;
  end: string | null;
  status: RunStatus;
  stage: string | null;
  error: string | null;
  origin: "run" | "sample";
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  hasReport: boolean;
  hasWorkbook: boolean;
  /** Present on the single-run endpoint only. */
  log?: string[];
  progress?: AnalyzerProgress;
}

export interface AnalyzerProgress {
  steps: string[];
  step: number;
  fraction: number;
  detail: string | null;
}

export interface AnalyzerSearchHit {
  kind: AnalyzerKind;
  sector: string | null;
  name: string;
  ticker: string | null;
  symbol: string | null;
  url: string | null;
}

export interface Pillar {
  name: string | null;
  weight: number | null;
  score: number | null;
  stance: string | null;
  highlight: string | null;
}

export interface ListedSummary {
  kind: "listed";
  company: string;
  ticker: string;
  benchmark: string;
  start: string;
  end: string;
  verdict: {
    call: string | null;
    conviction: number | null;
    summary: string | null;
    thesis: string | null;
    price: number | null;
    entryLow: number | null;
    entryHigh: number | null;
    target1: number | null;
    target1Pct: number | null;
    target2: number | null;
    target2Pct: number | null;
    stop: number | null;
    stopPct: number | null;
    riskReward: string | null;
    asOf: string | null;
    pillars: Pillar[];
  } | null;
  market: {
    alpha: number | null;
    beta: number | null;
    rSquared: number | null;
    model: string | null;
    tradingDays: number | null;
  };
  news: {
    items: number | null;
    duplicates: number | null;
    paywalled: number | null;
    sentimentReturnR: number | null;
    sentimentReturnN: number | null;
  };
  incidents: {
    day: string;
    abnormalReturn: number | null;
    z: number | null;
    coverageZ: number | null;
    items: number | null;
    sentiment: number | null;
    event: string | null;
    emotion: string | null;
  }[];
  incidentCount: number;
  forecast: {
    bias: string | null;
    confidence: string | null;
    annualisedVol: number | null;
    horizons: { days: number; p10: number | null; p50: number | null; p90: number | null }[];
    inferences: string[];
  };
  risk: {
    var1d95: Record<string, number | null>;
    var1d99: Record<string, number | null>;
    annualisedVol: number | null;
    consensusVol: number | null;
    recommendedVolModel: string | null;
    distanceToDefault: number | null;
    defaultProbabilityPct: number | null;
    regime: string | null;
    regimeProbability: number | null;
    regimeGuidance: string | null;
  };
  technical: {
    rating: string | null;
    score: number | null;
    rsi: number | null;
    adx: number | null;
    macd: string | null;
    trend: string | null;
    verdict: string | null;
  };
  fundamental: {
    unit: string | null;
    asOf: string | null;
    revenue: number | null;
    revenueYoY: number | null;
    netProfit: number | null;
    netProfitYoY: number | null;
    pe: number | null;
    pb: number | null;
    evEbitda: number | null;
    valuationRating: string | null;
    valuationStance: string | null;
  };
  backtest: {
    events: number | null;
    winRatePct: number | null;
    profitFactor: number | null;
    conformalCoveragePct: number | null;
  };
  caveats: string[];
  detail: ListedDetail;
}

/**
 * Pass-through engine blocks. Field names are the engine's own snake_case;
 * blocks whose shape varies by run (regime, XAI, macro) stay loosely typed and
 * are read defensively in the dossier tabs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Blk = Record<string, any>;

export interface SizingTier {
  portfolio_name: string;
  portfolio_capital_inr: number;
  allocation_pct: number;
  allocated_capital_inr: number;
  prescribed_shares: number;
  risk_at_stop_loss_inr: number;
  portfolio_risk_pct: number;
}

export interface IncidentHeadline {
  source: string | null;
  headline: string | null;
  url: string | null;
  sentiment_label: string | null;
  summary: string | null;
  published: string | null;
}

export interface IncidentDetail {
  day: string;
  abnormal_return: number | null;
  abnormal_return_z: number | null;
  coverage_z: number | null;
  volume_z: number | null;
  item_count: number | null;
  mean_sentiment: number | null;
  dominant_event: string | null;
  dominant_emotion: string | null;
  direction_agrees: boolean | null;
  trajectory_type: string | null;
  car: number | null;
  car_days: number | null;
  t_stat: number | null;
  p_value: number | null;
  headlines: IncidentHeadline[];
}

export interface TimelineData {
  benchmark: string | null;
  dates: string[];
  price: (number | null)[];
  priceRebased: (number | null)[];
  benchRebased: (number | null)[];
  abnormal: (number | null)[];
  volume: (number | null)[];
  hurdle: number | null;
}

export interface ListedDetail {
  timeline: TimelineData | null;
  valuation: Blk | null;
  factor?: Blk;
  execution?: Blk;
  forecast: { horizons: Blk | null; har: Blk | null; sixSigma: Blk | null; macroRidge: Blk | null };
  var_six_sigma: Blk | null;
  portfolio: Blk | null;
  spillover: Blk | null;
  backtests: { conformal: Blk | null; volatility: Blk | null; technical: Blk | null; trades: Blk[]; score: number | null; status: string | null; summary: string | null };
  sizing: {
    tiers: SizingTier[];
    prescribed_pct: number | null;
    raw_kelly_pct: number | null;
    half_kelly_pct: number | null;
    cap_pct: number | null;
  };
  holding: {
    core: string | null;
    tactical: string | null;
    profit_booking: string[];
    invalidation: string[];
  };
  pillar_rationales: (string | null)[];
  event_study: {
    incidents: IncidentDetail[];
    robustness: {
      note: string | null;
      multipliers: number[] | null;
      combos: number | null;
      days: { day: string; flagged_in: number | null; of: number | null; fraction: number | null }[];
    };
    diagnostics: Blk | null;
    unattributed: { source: string | null; headline: string | null; url: string | null; reason: string | null }[];
    sentiment_return: Blk | null;
    emotion_return: Blk | null;
  };
  technical: {
    moving_averages?: Blk;
    adx?: Blk;
    macd?: Blk;
    rsi?: Blk;
    bollinger?: Blk;
    stochastic?: Blk;
    pivots?: Blk;
    indicators_table?: Blk[];
    weekly_playbook?: Blk[];
    backtest: Blk;
  };
  fundamental: {
    statement_kind: string | null;
    unit: string | null;
    as_of: string | null;
    screener_url: string | null;
    lines: Record<string, { label: string; latest: number | null; qoq_change: number | null; yoy_change: number | null } | null>;
    tax_rate_pct: number | null;
    nopat: number | null;
    nopat_note: string | null;
    order_book: Blk | null;
    order_book_note: string | null;
    balance_sheet: Blk | null;
    ratios: Blk | null;
    surprise: Blk | null;
    peers: [string, string][];
  };
  quant: {
    conformal: Blk | null;
    volatility: Blk | null;
    distance_to_default: Blk | null;
    var: Blk | null;
    microstructure: Blk | null;
    regime: Blk | null;
    xai: Blk | null;
  };
  macro: {
    backdrop: Blk | null;
    metals: {
      name: string;
      symbol: string;
      unit: string;
      current_price: number | null;
      change_pct: number | null;
      momentum_1w_pct: number | null;
      annualized_volatility_pct: number | null;
      transmission_channel: string | null;
    }[];
    metals_summary: string | null;
    nifty: Record<string, { ticker: string; window_return: number | null; beta: number | null; r_squared: number | null; note: string | null }>;
    global: Record<string, { ticker: string; window_return: number | null; note: string | null }>;
  };
  peers: {
    sector: string | null;
    rating: string | null;
    stance: string | null;
    composite_score: number | null;
    target_price: number | null;
    implied_upside_pct: number | null;
    table: {
      multiple: string | null;
      value: number | null;
      sector_median: number | null;
      variance_pct: number | null;
      verdict: string | null;
      role: string | null;
    }[];
  };
}

export interface UnlistedSummary {
  kind: "unlisted";
  company: string;
  ticker: null;
  start: string;
  end: string;
  url: string | null;
  price: {
    first: number | null;
    firstDate: string | null;
    last: number | null;
    lastDate: string | null;
    changePct: number | null;
    high: number | null;
    low: number | null;
    observations: number;
  };
  moves: {
    from: string;
    to: string;
    startPrice: number | null;
    endPrice: number | null;
    changePct: number;
    headlines: { source: string | null; headline: string | null; url: string | null }[];
  }[];
  moveCount: number;
  news: { items: number | null; perSource: Record<string, number> };
  /** The investment call, in the same shape as a listed run. Null on runs made before the research layer. */
  verdict: ListedSummary["verdict"];
  research: UnlistedResearch | null;
  /** Why there is no research block, when the layer ran but could not produce one. */
  researchNote?: string | null;
  macro: Blk | null;
}

/** Valuation, risk, trend and execution detail for an unlisted run (see backend ceia/unlisted_research.py). */
export interface UnlistedResearch {
  sector: string | null;
  sector_index: { key: string; yahoo: string; nse_id: string; name: string } | null;
  facts: Record<string, number | null>;
  price_profile: Blk;
  risk: Blk;
  market_model: Blk;
  technical: Blk | null;
  forecast: Blk | null;
  valuation: Blk | null;
  news_signal: Blk;
  data_quality: { daily_points: number; revisions: number; months: number | null; weeks: number | null; thin: boolean; notes: string[] };
  sizing: ListedSummary["detail"]["sizing"];
  holding: ListedSummary["detail"]["holding"];
  pillar_rationales: (string | null)[];
}

export type AnalyzerSummary = ListedSummary | UnlistedSummary;
