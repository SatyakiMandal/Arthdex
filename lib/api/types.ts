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
  /** Delivered share of traded quantity in the last completed session. */
  deliveryPct?: number | null;
  deliveryDate?: string | null;
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
  kind: "listed" | "unlisted";
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
  insights?: DeskInsights | null;
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

export interface BhavRow {
  symbol: string;
  close: number | null;
  changePct: number | null;
  turnoverCr: number | null;
  volume: number | null;
  deliveryPct: number | null;
  volumeMultiple?: number;
  band?: number;
}

export interface ApiBhavcopy {
  insights?: DeskInsights | null;
  date: string;
  kpis: {
    securities: number;
    advances: number;
    declines: number;
    unchanged: number;
    advanceDeclineRatio: number | null;
    turnoverCr: number;
    weightedDeliveryPct: number | null;
    averageDeliveryPct: number | null;
  };
  narrative: string;
  accumulation: BhavRow[];
  volumeAnomalies: BhavRow[];
  bandMoves: { upper: BhavRow[]; lower: BhavRow[] };
  criteria: {
    minTurnoverCr: number;
    accumulationDeliveryPct: number;
    anomalyVolumeMultiple: number;
    baselineSessions: number;
  };
}

export type TechInterval = "5m" | "15m" | "1h" | "1d";

export interface TechSignal {
  label: string;
  tone: "up" | "down" | "flat";
  detail: string;
}

export interface OrderBlock {
  type: "bullish" | "bearish";
  start: number;
  formed: number;
  mitigated: number | null;
  high: number;
  low: number;
}

export interface FairValueGap {
  type: "bullish" | "bearish";
  start: number;
  end: number;
  filled: number | null;
  high: number;
  low: number;
}

export interface LiquiditySweep {
  type: "bullish" | "bearish";
  at: number;
  level: number;
  wick: number;
}

export interface ApiTechnicals {
  symbol: string;
  interval: TechInterval;
  intervalLabel: string;
  intraday: boolean;
  barsAvailable: number;
  lastClose: number;
  asOf: string;
  bars: { t: string; o: number; h: number; l: number; c: number; v: number }[];
  series: Record<string, (number | null)[]>;
  levels: { support: { price: number; touches: number }[]; resistance: { price: number; touches: number }[] };
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  liquiditySweeps: LiquiditySweep[];
  signals: Record<string, TechSignal>;
  tally: { bullish: number; bearish: number; neutral: number };
  lastCrossover: { direction: "above" | "below"; at: string; barsAgo: number } | null;
}

export interface MacdScreenRow {
  symbol: string;
  name: string;
  industry: string;
  price: number | null;
  changePct: number | null;
  crossedAt: string;
  barsAgo: number;
  macd: number | null;
  signal: number | null;
  hist: number | null;
  rsi: number | null;
  adx?: number | null;
  score?: number;
}

export interface ApiMacdScreen {
  insights?: DeskInsights | null;
  interval: TechInterval;
  intervalLabel: string;
  direction: "above" | "below";
  within: number;
  scanned: number;
  universeSize: number;
  asOf: string | null;
  index: string;
  results: MacdScreenRow[];
}

export interface ApiCommodity {
  id: string;
  symbol: string;
  name: string;
  unit: string;
  group: string;
  driver: string;
  price: number;
  change: Record<"1D" | "1W" | "1M" | "3M" | "1Y", number | null>;
  high52w: number | null;
  low52w: number | null;
  rangePosition: number | null;
  spark: (number | null)[];
  asOf: string;
}

export interface ApiCommodities {
  insights?: DeskInsights | null;
  rows: ApiCommodity[];
  usdinr: number | null;
  indicativeInr: { goldPer10g?: number; silverPerKg?: number };
}

export interface ShareholdingTable {
  labels: string[];
  promoters?: (number | null)[];
  fiis?: (number | null)[];
  diis?: (number | null)[];
  government?: (number | null)[];
  public?: (number | null)[];
  shareholders?: (number | null)[];
}

export interface ShareholdingCategory {
  key: "promoters" | "fiis" | "diis" | "government" | "public";
  label: string;
  latest: number | null;
  qoq: number | null;
  yoy: number | null;
  signal: "increasing" | "decreasing" | "stable" | "unknown";
  yoySignal: "increasing" | "decreasing" | "stable" | "unknown";
  streak: number;
  high: number | null;
  low: number | null;
}

export interface ApiShareholding {
  symbol: string;
  pattern: { quarterly: ShareholdingTable; yearly: ShareholdingTable; url: string } | null;
  pledge: { asOf: string | null; pledgedPct: number | null; promoterPct: number | null; sharesPledged: number | null; totalShares: number | null } | null;
  largeHolders: {
    name: string | null;
    action: "Acquired" | "Sold";
    period: string | null;
    shares: number | null;
    pctChange: number | null;
    sharesAfter: number | null;
    pctAfter: number | null;
    promoterGroup: boolean;
    mode: string | null;
    regulation: string | null;
    filedOn: string | null;
  }[];
  insiders: {
    name: string | null;
    category: string | null;
    action: string;
    mode: string | null;
    securities: number | null;
    valueInr: number | null;
    afterPct: number | null;
    tradedOn: string | null;
    filedOn: string | null;
  }[];
  yahoo: { insidersPct: number | null; institutionsPct: number | null; institutionsOfFloatPct: number | null } | null;
  analytics: {
    asOf: string | null;
    categories: ShareholdingCategory[];
    institutionalPct: number;
    institutionalYoy: number;
    freeFloatPct: number;
    shareholderCount?: { latest: number; yoyPct: number | null };
    pledgeTier?: string;
    insiderFlow?: { buyValueInr: number; sellValueInr: number; net: string; count: number; window: string };
    notes: string[];
  } | null;
  notes: string[];
}

export interface DeskInsights {
  headline: string;
  metrics: { label: string; value: string; sub: string | null; tone: "up" | "down" | "flat" | "info" }[];
  findings: { tone: "up" | "down" | "flat" | "info"; title: string; text: string }[];
  tables: { title: string; columns: string[]; rows: (string | number | null)[][] }[];
  method: string;
}

// -- Yahoo Finance company sections ------------------------------------------

type N = number | null;

export interface ApiYStats {
  symbol: string;
  about: {
    name: string | null; summary: string | null; sector: string | null; industry: string | null; website: string | null;
    city: string | null; state: string | null; country: string | null; address: string | null; phone: string | null; employees: N;
  };
  officers: { name: string | null; title: string | null; age: N; pay: N; yearBorn: N }[];
  valuation: Record<"marketCap" | "enterpriseValue" | "trailingPE" | "forwardPE" | "pegRatio" | "priceToSales" | "priceToBook" | "evToRevenue" | "evToEbitda", N>;
  highlights: Record<
    "profitMargin" | "operatingMargin" | "grossMargin" | "returnOnAssets" | "returnOnEquity" | "revenue" | "revenueGrowth" | "grossProfit" | "ebitda" | "netIncome" | "eps" | "forwardEps" | "earningsGrowth" | "cash" | "debt" | "debtToEquity" | "currentRatio" | "bookValue" | "operatingCashflow" | "freeCashflow",
    N
  >;
  trading: Record<"beta" | "high52w" | "low52w" | "change52w" | "ma50" | "ma200" | "avgVolume" | "avgVolume10d" | "sharesOutstanding" | "floatShares" | "heldByInsiders" | "heldByInstitutions" | "shortRatio", N>;
  dividends: {
    rate: N; yieldPct: N; payoutRatio: N; fiveYearAvgYieldPct: N; exDividendDate: string | null; lastValue: N; lastDate: string | null;
    lastSplitFactor: string | null; lastSplitDate: string | null;
    byYear: { year: number; amount: number }[]; recent: { date: string; amount: number }[]; splits: { date: string; ratio: number }[];
  };
  calendar: { earningsDates: string[]; exDividendDate: string | null; dividendDate: string | null };
}

export interface YStatementFrame {
  dates: string[];
  rows: { label: string; values: N[]; perShare: boolean }[];
}
export interface ApiYStatements {
  income: { annual: YStatementFrame | null; quarterly: YStatementFrame | null };
  balance: { annual: YStatementFrame | null; quarterly: YStatementFrame | null };
  cashflow: { annual: YStatementFrame | null; quarterly: YStatementFrame | null };
}

export type YEstimateRow = { period: string; key: string } & Record<string, string | number | null>;
export interface ApiYAnalysts {
  symbol: string;
  currentPrice: N;
  targets: { mean: N; median: N; high: N; low: N; analysts: N; key: string | null; meanRating: N };
  recommendations: { period: string; strongBuy?: N; buy?: N; hold?: N; sell?: N; strongSell?: N }[];
  earningsEstimate: YEstimateRow[];
  revenueEstimate: YEstimateRow[];
  epsTrend: YEstimateRow[];
  epsRevisions: YEstimateRow[];
  growthEstimates: YEstimateRow[];
  earningsHistory: { date: string; estimate: N; actual: N; surprisePct: N }[];
  nextEarnings: { date: string; epsEstimate: N } | null;
}

export interface ApiYHistory {
  symbol: string;
  range: string;
  interval: string;
  rows: { date: string; open: N; high: N; low: N; close: number; adjClose: N; volume: N; dividend: N; split: N }[];
}

export interface ApiYCompare {
  symbol: string;
  period: string;
  dates: string[];
  series: { key: string; label: string; values: N[]; returnPct: number }[];
}

// -- unlisted ---------------------------------------------------------------

export interface ApiUnlistedListing {
  id: string;
  name: string;
  sector: string | null;
  /** Indicative price in rupees; null where the source shows none. */
  price: number | null;
}

export interface ApiUnlistedDirectory {
  companies: ApiUnlistedListing[];
  sectors: string[];
  total: number;
}

export interface ApiUnlistedRevision {
  date: string;
  price: number;
  /** Move from the previous revision; null for the first. */
  changePct: number | null;
}

export interface ApiUnlistedCompany {
  id: string;
  name: string;
  sector: string | null;
  isin: string | null;
  cin: string | null;
  summary: string | null;
  price: number | null;
  asOf: string | null;
  change: { pct: number | null; window: string | null };
  /** The source's own ratios, verbatim (P/E may be "N/A"). */
  facts: Record<string, string>;
  /** One point per real revision, oldest first, plus the latest day. */
  series: { date: string; price: number }[];
  /** Real revisions only, newest first. */
  revisions: ApiUnlistedRevision[];
  lifecycle: {
    listedSymbol: string | null;
    listedName: string | null;
    ipo: {
      status: string | null;
      segment: string | null;
      priceBandLow: number | null;
      priceBandHigh: number | null;
      issueStartDate: string | null;
      issueEndDate: string | null;
      listingDate: string | null;
    } | null;
  };
  sinceFirstPct: number | null;
  firstDate: string | null;
  /** Daily points the source shows, most of which just repeat the last revision. */
  dailyPoints: number;
  url: string;
}

// -- research desk ----------------------------------------------------------

export interface ApiDeal {
  kind: "bulk" | "block" | "short";
  symbol: string | null;
  name: string;
  client: string;
  side: string;
  quantity: number | null;
  price: number | null;
  valueCr: number | null;
  remarks: string | null;
  date: string | null;
}

export interface ApiDeals {
  asOn: string | null;
  bulk: ApiDeal[];
  block: ApiDeal[];
  short: ApiDeal[];
}

export interface ApiCalendarMeeting {
  symbol: string;
  name: string;
  date: string | null;
  purpose: string;
  detail: string;
  isResults: boolean;
}

export interface ApiCorporateAction {
  symbol: string;
  name: string;
  subject: string;
  kind: "dividend" | "split" | "bonus" | "rights" | "other";
  exDate: string | null;
  recordDate: string | null;
}

export interface ApiCalendar {
  meetings: ApiCalendarMeeting[];
  actions: ApiCorporateAction[];
  errors: string[] | null;
  from: string;
  to: string;
}

export interface ApiMoverExplained {
  symbol: string;
  name: string | null;
  cmp: number;
  changePct: number;
  labels: string[];
  news: { headline: string; source: string; url: string | null; publishedAt: string | null; kind: "filing" | "press" }[];
}

export interface ApiStatus {
  service: string;
  uptimeSeconds: number;
  feeds: {
    label: string;
    source: string;
    state: "fresh" | "stale" | "idle";
    ageSeconds: number | null;
    ttlSeconds: number;
    entries: number;
  }[];
}

export interface ApiPreIpo {
  id: string | null;
  name: string | null;
}

// -- order flow & options exposure -------------------------------------------

export type OrderflowMarket = "nse" | "futures" | "us";
export type OrderflowInterval = "1m" | "5m" | "15m" | "1h" | "1d";

export interface ProfileBin {
  lo: number;
  hi: number;
  mid: number;
  v: number;
  buy: number;
  sell: number;
  delta: number;
}

export interface FootprintLevel {
  p: number;
  buy: number;
  sell: number;
  bImb: boolean;
  sImb: boolean;
}

export interface FootprintBar {
  i: number;
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  volume: number;
  delta: number;
  poc: number | null;
  levels: FootprintLevel[];
}

export interface ApiOrderflow {
  symbol: string;
  market: OrderflowMarket;
  interval: OrderflowInterval;
  intervalLabel: string;
  intraday: boolean;
  asOf: string;
  lastClose: number;
  atr: number | null;
  estimated: boolean;
  method: string;
  bars: { t: string; o: number; h: number; l: number; c: number; v: number; delta: number }[];
  cvd: number[];
  profile: { bins: ProfileBin[]; poc: number; vah: number; val: number; total: number; valueAreaPct: number };
  footprint: { step: number; bars: FootprintBar[] };
  imbalances: { i: number; t: string; price: number; side: "buy" | "sell"; ratio: number }[];
  absorption: { at: number; type: "bullish" | "bearish"; volume: number; volRatio: number; rangeAtr: number; location: number; delta: number; price: number }[];
  bigTrades: { at: number; volume: number; z: number; delta: number; bias: "buy" | "sell"; price: number; fwdPct: number | null }[];
  heatmap: { available: boolean; reason: string };
}

export interface GexStrike {
  strike: number;
  callOi: number;
  putOi: number;
  gex: number;
  callGex: number;
  putGex: number;
  dex: number;
  tex: number;
}

export interface ApiGex {
  symbol: string;
  underlying: string;
  spot: number;
  asOf: string;
  expiries: string[];
  nearestExpiry: string;
  proxy: { etf: string; futures: string | null; ratio: number | null };
  totals: { gexMillions: number; callOi: number; putOi: number; putCallOi: number; dexMillions: number; thetaPerDay: number; vegaPerPoint: number };
  regime: "positive" | "negative";
  levels: {
    gammaFlip: number | null;
    callWall: number | null;
    putWall: number | null;
    maxPain: number | null;
    scaled: { gammaFlip: number | null; callWall: number | null; putWall: number | null; maxPain: number | null; spot: number | null };
  };
  zeroDte: { expiry: string; oiShare: number; gexMillions: number; gexShare: number } | null;
  strikes: GexStrike[];
  assumption: string;
}
