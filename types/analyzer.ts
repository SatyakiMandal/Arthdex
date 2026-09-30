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
}

export interface AnalyzerSearchHit {
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
}

export type AnalyzerSummary = ListedSummary | UnlistedSummary;
