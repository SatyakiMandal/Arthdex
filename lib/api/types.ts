/**
 * Payload shapes returned by the Arthdex data service.
 *
 * These mirror the backend exactly. Fields are nullable wherever the upstream
 * can genuinely fail to supply them — Yahoo omits return-on-equity for most
 * Indian tickers, sector indices lack history, and models do not always
 * converge. A null here means "not available", and the UI says so rather than
 * rendering a zero.
 */

export interface Delta {
  absolute: number;
  percent: number;
}

export interface ApiQuote {
  symbol: string;
  exchange: string;
  cmp: number;
  change: Delta;
  open: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  high52w: number;
  low52w: number;
  volume: number;
  marketCapCr: number;
  currency: string;
  asOf: string;
}

export interface ApiProfile {
  name: string;
  sector: string;
  industry: string;
  isin: string | null;
  website: string | null;
  summary: string | null;
  employees: number | null;
}

export interface ApiCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ApiCandleSeries {
  symbol: string;
  period: string;
  candles: ApiCandle[];
}

export interface ApiIndex {
  id: string;
  name: string;
  family: "broad" | "sectoral" | "thematic" | "exchange";
  exchange: string;
  level: number;
  change: Delta;
  peRatio: number | null;
  pbRatio: number | null;
  dividendYieldPct: number | null;
  advances: number;
  declines: number;
  oneMonthChangePct: number | null;
  oneYearChangePct: number | null;
  high52w: number | null;
  low52w: number | null;
  asOf: string;
}

export interface ApiMover {
  symbol: string;
  name: string;
  cmp: number;
  change: Delta;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number;
  turnoverLakh: number | null;
  bucket: string;
  universe: string;
}

export interface GlobalIndexCard {
  id: string;
  name: string;
  region: string;
  level: number;
  changePct: number;
  asOf: string;
}

// -- fundamentals -----------------------------------------------------------

export interface ApiQuarter {
  quarter: string;
  periodEnd: string;
  revenue: number | null;
  operatingExpenses: number | null;
  operatingProfit: number | null;
  opmPct: number | null;
  ebitda: number | null;
  netProfit: number | null;
  netMarginPct: number | null;
  eps: number | null;
}

export interface ApiAnnual {
  period: string;
  periodEnd: string;
  revenue: number | null;
  operatingProfit: number | null;
  opmPct: number | null;
  netProfit: number | null;
}

export interface ApiBalanceSheet {
  period: string;
  periodEnd: string;
  borrowings: number | null;
  equityCapital: number | null;
  reserves: number | null;
  netWorth: number | null;
  totalAssets: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
}

export interface ApiRatios {
  /** "TTM" when four consecutive quarters exist, otherwise a fiscal-year label. */
  period: string;
  /** Human-readable description of the window the ratios actually cover. */
  basis: string;
  revenueCr: number | null;
  netProfitCr: number | null;
  roePct: number | null;
  rocePct: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  nopatCr: number | null;
  marketCapCr: number | null;
  ttmComplete: boolean;
  ttmNote: string | null;
  quartersAvailable: number;
}

export interface ApiFinancials {
  symbol: string;
  quarterly: ApiQuarter[];
  annual: ApiAnnual[];
  balanceSheet: ApiBalanceSheet[];
  ratios: ApiRatios;
}

export interface ApiValuation {
  peRatio: number | null;
  pbRatio: number | null;
  evToEbitda: number | null;
  evToSales: number | null;
  roePct: number | null;
  profitMarginPct: number | null;
  eps: number | null;
  bookValue: number | null;
  dividendYieldPct: number | null;
}

// -- quant ------------------------------------------------------------------

export interface ApiVolModel {
  model: string;
  annualisedVolPct: number;
  weight: number;
}

export interface ApiVolatility {
  models: ApiVolModel[];
  consensusAnnualisedVolPct: number | null;
  realisedAnnualisedVolPct: number | null;
  observations: number;
  weighting?: string;
  note: string | null;
}

export interface ApiVaR {
  confidencePct?: number;
  horizonDays?: number;
  parametricVaRPct?: number | null;
  historicalVaRPct?: number | null;
  monteCarloVaRPct?: number | null;
  expectedShortfallPct?: number | null;
  esBasis?: string;
  monteCarloDistribution?: string | null;
  observations?: number;
  note?: string | null;
}

export interface ApiMerton {
  distanceToDefault?: number | null;
  defaultProbabilityPct?: number | null;
  assetValueCr?: number | null;
  debtBarrierCr?: number | null;
  assetVolPct?: number | null;
  barrierBasis?: string;
  note?: string | null;
}

export interface ApiRegime {
  currentState?: "BULL_LOW_VOL" | "BEAR_HIGH_VOL";
  lowVolProbability?: number;
  highVolProbability?: number;
  lowVolAnnualisedPct?: number | null;
  highVolAnnualisedPct?: number | null;
  expectedDurationDays?: number | null;
  transitionMatrix?: number[][];
  transitionOrder?: string[];
  converged?: boolean;
  note?: string | null;
}

export interface ApiForecast {
  horizon: string;
  label: string;
  expectedReturnPct: number | null;
  lowerBoundPct: number | null;
  upperBoundPct: number | null;
  signalConfidencePct: number | null;
}

export interface ApiMicrostructure {
  illustrative: boolean;
  note: string;
  kylesLambdaBps: number | null;
  vpin: number | null;
}

export interface ApiQuant {
  symbol: string;
  volatility: ApiVolatility;
  var: ApiVaR;
  merton: ApiMerton;
  regime: ApiRegime;
  forecasts: ApiForecast[];
  microstructure: ApiMicrostructure;
}

export interface ApiSensitivityRow {
  benchmarkId: string;
  benchmarkName: string;
  beta: number | null;
  alphaPct: number | null;
  rSquared: number | null;
  abnormalReturnPct: number | null;
  indexReturnPct: number | null;
  stockReturnPct: number | null;
  observationWindowDays: number;
  tStatBeta: number | null;
  pValueAlpha: number | null;
}

export interface ApiSensitivity {
  rows: ApiSensitivityRow[];
  primary: string | null;
  riskFreePct?: number;
  unavailableBenchmarks: string[];
  note: string | null;
}

// -- search, IPO, news ------------------------------------------------------

export interface ApiSearchResult {
  id: string;
  symbol: string;
  name: string;
  series: string;
  isin: string | null;
  kind: "listed";
  href: string;
}

export interface ApiIpoIssue {
  id: string;
  symbol: string | null;
  name: string | null;
  segment: "mainboard" | "sme";
  status: "ongoing" | "upcoming" | "closed" | "listed";
  priceBandLow: number | null;
  priceBandHigh: number | null;
  issueStartDate: string | null;
  issueEndDate: string | null;
  listingDate: string | null;
  sharesOffered: number | null;
  subscriptionTimes: number | null;
  subscription?: {
    totalX: number | null;
    sharesOffered: number | null;
    sharesBid: number | null;
  };
  listingOpen?: number;
  listingClose?: number;
  cmp?: number;
  sessionsSinceListing?: number;
  listingGainPct?: number;
  cmpVsIssuePct?: number;
  sinceListingPct?: number;
}

export interface ApiIpoPipeline {
  issues: ApiIpoIssue[];
  counts: Record<string, number>;
  segments: Record<string, number>;
  performanceEnriched: number;
  errors: string[] | null;
  unavailable: Record<string, string>;
}

export interface ApiNewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  symbols: string[];
  flags: string[];
  kind: "filing" | "press";
  category: string | null;
}

export interface ApiNewsFeed {
  items: ApiNewsItem[];
  counts: { filings: number; press: number };
  errors: string[] | null;
}

// -- screener ---------------------------------------------------------------

export interface ApiScreenRow {
  symbol: string;
  name: string;
  industry: string;
  cmp: number;
  beta: number;
  rSquared: number;
  annualisedVolPct: number;
  jensensAlphaPct: number;
  observations: number;
  changePct: Record<string, number | null>;
  high52w: number;
  low52w: number;
}

export interface ApiFactorScreens {
  highVolatility: ApiScreenRow[];
  lowVolatility: ApiScreenRow[];
  alpha: ApiScreenRow[];
  index: string;
  indexLabel: string;
  benchmark: string;
  computed: number;
  universeSize: number;
}

export interface ApiWindowedMovers {
  window: string;
  sessions: number;
  gainers: ApiScreenRow[];
  losers: ApiScreenRow[];
  universeCovered: number;
  index: string;
  indexLabel: string;
}
