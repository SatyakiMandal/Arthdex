import "server-only";

import { apiGet, apiGetOrNull, apiPost, REVALIDATE, type ApiResult } from "./client";
import type {
  ApiCalendar,
  ApiDeals,
  ApiMoverExplained,
  ApiPreIpo,
  ApiStatus,
  FeedHealth,
  ApiPulse,
  ApiUnlistedCompany,
  ApiUnlistedDirectory,
  ApiBhavcopy,
  ApiCandleSeries,
  ApiShareholding,
  ApiYStats,
  ApiYStatements,
  ApiYAnalysts,
  ApiYHistory,
  ApiYCompare,
  ApiCommodities,
  ApiMacdScreen,
  ApiTechnicals,
  ApiOrderflow,
  ApiGex,
  ApiRisk,
  ApiDecisions,
  ApiFinancials,
  ApiIndex,
  ApiIpoPipeline,
  ApiMover,
  ApiNewsFeed,
  ApiProfile,
  ApiQuant,
  ApiQuote,
  ApiSearchResult,
  ApiFactorScreens,
  ApiSensitivity,
  ApiWindowedMovers,
  ApiValuation,
  GlobalIndexCard,
  ApiFlows,
  ApiPeers,
  ApiPeBand,
  ApiForensics,
  ApiOptionChain,
  ApiBuildUp,
  ApiFundamentalScreen,
  ApiResultsSeason,
  CompanyFilingItem,
  CompanyFilingsPayload,
  ApiFnoBan,
  ApiEarningsMovesResponse,
  ApiBhavScanner,
  ApiSectorRotation,
  ApiCompanyCompare,
  ApiPortfolioAnalysis,
  ApiIndexRebalance,
  ApiIpoLockinResponse,
  ApiBuybackResponse,
  ApiSurveillanceOverview,
  ApiYieldCurveResponse,
  ApiParticipantOiResponse,
  ApiStrategyTemplate,
  ApiStrategyPayoffResponse,
  ApiStrategyLeg,
  ApiVolSurfaceResponse,
} from "./types";

export type { CompanyFilingItem, CompanyFilingsPayload };

// -- market -----------------------------------------------------------------

export const getIndices = () => apiGet<ApiIndex[]>("/api/v1/market/indices", REVALIDATE.indices);

export const getGlobalIndices = () =>
  apiGet<GlobalIndexCard[]>("/api/v1/market/global", REVALIDATE.indices);

export const getMovers = (
  direction: "gainers" | "losers",
  universe = "gt20",
  limit = 15,
): Promise<ApiResult<ApiMover[]>> =>
  apiGet<ApiMover[]>(
    `/api/v1/market/movers?direction=${encodeURIComponent(direction)}&universe=${encodeURIComponent(universe)}&limit=${encodeURIComponent(String(limit))}`,
    REVALIDATE.movers,
  );

export const getMoverUniverses = () =>
  apiGetOrNull<{ default: string; universes: { id: string; label: string }[] }>(
    "/api/v1/market/mover-universes",
    REVALIDATE.universe,
  );

// -- company ----------------------------------------------------------------

export const getQuote = (symbol: string) =>
  apiGet<ApiQuote>(`/api/v1/company/${encodeURIComponent(symbol)}/quote?v=2`, REVALIDATE.quote);

export const getProfile = (symbol: string) =>
  apiGetOrNull<ApiProfile>(`/api/v1/company/${encodeURIComponent(symbol)}/profile?v=2`, REVALIDATE.fundamentals);

export const getCandles = (symbol: string, period: string) =>
  apiGet<ApiCandleSeries>(
    `/api/v1/company/${encodeURIComponent(symbol)}/candles?period=${encodeURIComponent(period)}&v=3`,
    REVALIDATE.candles,
  );

export const getFinancials = (symbol: string) =>
  apiGetOrNull<ApiFinancials>(`/api/v1/company/${encodeURIComponent(symbol)}/financials?v=4`, REVALIDATE.fundamentals);

export const getValuation = (symbol: string) =>
  apiGetOrNull<ApiValuation>(`/api/v1/company/${encodeURIComponent(symbol)}/valuation?v=3`, REVALIDATE.fundamentals);

export const getQuant = (symbol: string) =>
  apiGetOrNull<ApiQuant>(`/api/v1/company/${encodeURIComponent(symbol)}/quant`, REVALIDATE.quant);

export const getSensitivity = (symbol: string) =>
  apiGetOrNull<ApiSensitivity>(`/api/v1/company/${encodeURIComponent(symbol)}/sensitivity`, REVALIDATE.quant);

export const getCompanyFilings = (symbol: string, limit = 40) =>
  apiGetOrNull<CompanyFilingsPayload>(
    `/api/v1/company/${encodeURIComponent(symbol)}/filings?limit=${encodeURIComponent(String(limit))}`,
    REVALIDATE.news,
  );

// -- search -----------------------------------------------------------------

export const searchCompanies = (query: string, limit = 12) =>
  apiGetOrNull<ApiSearchResult[]>(
    `/api/v1/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`,
    REVALIDATE.universe,
  );

// -- primary markets --------------------------------------------------------

export const getIpoPipeline = () =>
  apiGet<ApiIpoPipeline>("/api/v1/ipo?v=2", REVALIDATE.ipo);

// -- unlisted ---------------------------------------------------------------

export const getUnlistedDirectory = () =>
  apiGet<ApiUnlistedDirectory>("/api/v1/unlisted", REVALIDATE.unlisted);

export const getUnlistedCompany = (id: string) =>
  apiGet<ApiUnlistedCompany>(`/api/v1/unlisted/${encodeURIComponent(id)}`, REVALIDATE.unlisted);

// -- research desk ----------------------------------------------------------

export const getDeals = () => apiGet<ApiDeals>("/api/v1/deals", 300);

export const getCalendar = () => apiGet<ApiCalendar>("/api/v1/calendar", 900);

export const getMoversExplained = (direction: "gainers" | "losers", limit = 8) =>
  apiGet<ApiMoverExplained[]>(
    `/api/v1/market/movers-explained?direction=${encodeURIComponent(direction)}&limit=${encodeURIComponent(String(limit))}`,
    REVALIDATE.movers,
  );

export const getStatus = () => apiGet<ApiStatus>("/api/v1/status", 10);
export const getFeedHealth = () => apiGet<FeedHealth>("/api/v1/health/feeds", 10);
export const getPulse = (index = "nifty50") =>
  apiGet<ApiPulse>(`/api/v1/market/pulse?index=${encodeURIComponent(index)}`, REVALIDATE.movers);

export const getPreIpo = (symbol: string) =>
  apiGetOrNull<ApiPreIpo>(`/api/v1/company/${encodeURIComponent(symbol)}/pre-ipo`, REVALIDATE.unlisted);

// -- news -------------------------------------------------------------------

export const getNews = (params: { symbol?: string; kind?: string; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.symbol) query.set("symbol", params.symbol);
  if (params.kind) query.set("kind", params.kind);
  query.set("limit", String(params.limit ?? 60));
  return apiGet<ApiNewsFeed>(`/api/v1/news?${query.toString()}`, REVALIDATE.news);
};

// -- screener ---------------------------------------------------------------

export const getFactorScreens = (index = "nifty100", limit = 10) =>
  apiGetOrNull<ApiFactorScreens>(
    `/api/v1/screener/factors?index=${encodeURIComponent(index)}&limit=${encodeURIComponent(String(limit))}`,
    REVALIDATE.quant,
  );

export const getWindowedMovers = (window: string, index = "nifty100", limit = 15) =>
  apiGetOrNull<ApiWindowedMovers>(
    `/api/v1/screener/movers?window=${encodeURIComponent(window)}&index=${encodeURIComponent(index)}&limit=${encodeURIComponent(String(limit))}`,
    REVALIDATE.quant,
  );

export const getUniverseStats = () =>
  apiGetOrNull<{ total: number; bySeries: Record<string, number> }>(
    "/api/v1/universe/stats",
    REVALIDATE.universe,
  );

// -- bhavcopy ---------------------------------------------------------------

export const getBhavcopy = (date?: string) =>
  apiGet<ApiBhavcopy>(`/api/v1/bhavcopy?v=2${date ? `&on=${encodeURIComponent(date)}` : ""}`, 3600);

// -- technicals -------------------------------------------------------------

export const getTechnicals = (symbol: string, interval: string) =>
  apiGet<ApiTechnicals>(
    `/api/v1/company/${encodeURIComponent(symbol)}/technicals?interval=${encodeURIComponent(interval)}`,
    60,
  );

export const getOrderflow = (symbol: string, market: string, interval: string) =>
  apiGet<ApiOrderflow>(
    `/api/v1/orderflow/${encodeURIComponent(symbol)}?market=${encodeURIComponent(market)}&interval=${encodeURIComponent(interval)}`,
    REVALIDATE.quote,
  );

export const getRisk = (symbol: string) =>
  apiGet<ApiRisk>(`/api/v1/company/${encodeURIComponent(symbol)}/risk`, 300);

export const getDecisions = () => apiGet<ApiDecisions>("/api/v1/decisions", 30);

export const getGex = (symbol: string) =>
  apiGet<ApiGex>(`/api/v1/options/${encodeURIComponent(symbol)}/gex`, 120);

export const getMacdScreen = (params: { direction: string; interval: string; within: number; index: string }) =>
  apiGet<ApiMacdScreen>(
    `/api/v1/screener/macd-crossover?direction=${encodeURIComponent(params.direction)}&interval=${encodeURIComponent(params.interval)}&within=${encodeURIComponent(String(params.within))}&index=${encodeURIComponent(params.index)}`,
    60,
  );

// -- commodities ------------------------------------------------------------

export const getCommodities = () => apiGet<ApiCommodities>("/api/v1/market/commodities?v=2", 600);

// -- shareholding -----------------------------------------------------------

export const getShareholding = (symbol: string) =>
  apiGet<ApiShareholding>(`/api/v1/company/${encodeURIComponent(symbol)}/shareholding?v=2`, 3600);

// -- Yahoo Finance company sections -----------------------------------------

export const getYStats = (symbol: string) =>
  apiGet<ApiYStats>(`/api/v1/company/${encodeURIComponent(symbol)}/statistics?v=3`, 3600);
export const getYStatements = (symbol: string) =>
  apiGet<ApiYStatements>(`/api/v1/company/${encodeURIComponent(symbol)}/statements?v=2`, 3600);
export const getYAnalysts = (symbol: string) =>
  apiGet<ApiYAnalysts>(`/api/v1/company/${encodeURIComponent(symbol)}/analysts?v=2`, 3600);
export const getYHistory = (symbol: string, range = "5Y", interval = "1d") =>
  apiGet<ApiYHistory>(
    `/api/v1/company/${encodeURIComponent(symbol)}/history?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&v=1`,
    900,
  );
export const getYCompare = (symbol: string, peers: string[], period = "1Y") =>
  apiGet<ApiYCompare>(
    `/api/v1/company/${encodeURIComponent(symbol)}/compare?peers=${encodeURIComponent(peers.join(","))}&period=${encodeURIComponent(period)}&v=1`,
    900,
  );

export const getFlows = (days = 90) =>
  apiGetOrNull<ApiFlows>(`/api/v1/market/flows?days=${encodeURIComponent(String(days))}`, 1800);

export const getPeers = (symbol: string) =>
  apiGetOrNull<ApiPeers>(`/api/v1/company/${encodeURIComponent(symbol)}/peers?v=2`, REVALIDATE.fundamentals);

export const getPeBand = (symbol: string) =>
  apiGetOrNull<ApiPeBand>(`/api/v1/company/${encodeURIComponent(symbol)}/valuation-bands`, REVALIDATE.fundamentals);

export const getForensics = (symbol: string) =>
  apiGetOrNull<ApiForensics>(`/api/v1/company/${encodeURIComponent(symbol)}/forensics`, REVALIDATE.fundamentals);

export const getOptionChain = (symbol: string, expiry?: string) =>
  apiGetOrNull<ApiOptionChain>(
    `/api/v1/derivatives/chain?symbol=${encodeURIComponent(symbol)}${expiry ? `&expiry=${encodeURIComponent(expiry)}` : ""}`,
    120,
  );

export const getBuildUp = () => apiGetOrNull<ApiBuildUp>("/api/v1/derivatives/buildup", 300);

/** Returns the API's own error message on a bad formula, so the page can show it. */
export const getFundamentalScreen = (params: { q?: string; preset?: string; sort?: string; order?: string }) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  return apiGet<ApiFundamentalScreen>(`/api/v1/screener/fundamental?${qs.toString()}`, 300);
};

export const getResultsSeason = () => apiGet<ApiResultsSeason>("/api/v1/market/results-season", 900);


// -- sprint features: ban, earnings moves, bhavcopy scanner, sector rotation, compare --

export const getFnoBan = () =>
  apiGet<ApiFnoBan>("/api/v1/derivatives/fno-ban", 300);

export const getEarningsMoves = () =>
  apiGet<ApiEarningsMovesResponse>("/api/v1/derivatives/earnings-moves", 900);

export const getBhavScanner = (date?: string) => {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiGet<ApiBhavScanner>(`/api/v1/bhavcopy/scanner${qs}`, 300);
};

export const getSectorRotation = () =>
  apiGet<ApiSectorRotation>("/api/v1/market/sector-rotation", 900);

export const getCompanyCompare = (symbols: string[]) => {
  const symParam = symbols
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .join(",");
  return apiGet<ApiCompanyCompare>(
    `/api/v1/company/compare?symbols=${encodeURIComponent(symParam)}`,
    300,
  );
};


// -- Phase 1: Portfolio, Catalysts, Lock-in & Buyback endpoints --------------

export const postPortfolioAnalyze = (holdings: Array<{
  symbol: string;
  quantity: number;
  buyPrice: number;
  buyDate?: string;
  currentPrice?: number;
}>) =>
  apiPost<ApiPortfolioAnalysis>("/api/v1/portfolio/analyze", { holdings });

export const getIndexRebalance = () =>
  apiGet<ApiIndexRebalance>("/api/v1/catalysts/index-rebalance", 3600);

export const getIpoLockins = () =>
  apiGet<ApiIpoLockinResponse>("/api/v1/catalysts/ipo-lockins", 3600);

export const getBuybacks = () =>
  apiGet<ApiBuybackResponse>("/api/v1/catalysts/buybacks", 3600);


export const getSurveillance = (params?: { measure?: string; band?: string; q?: string }) => {
  const qp = new URLSearchParams();
  if (params?.measure && params.measure !== "all") qp.set("measure", params.measure);
  if (params?.band && params.band !== "all") qp.set("band", params.band);
  if (params?.q) qp.set("q", params.q);
  const qs = qp.toString();
  return apiGet<ApiSurveillanceOverview>(`/api/v1/market/surveillance${qs ? `?${qs}` : ""}`, 3600);
};


export const getYieldCurve = () =>
  apiGet<ApiYieldCurveResponse>("/api/v1/market/yield-curve", 3600);

export const getParticipantOi = () =>
  apiGet<ApiParticipantOiResponse>("/api/v1/derivatives/participant-oi", 1800);

export const getStrategyTemplates = (symbol: string = "NIFTY", spot: number = 24500) =>
  apiGet<ApiStrategyTemplate[]>(`/api/v1/derivatives/strategy/templates?symbol=${encodeURIComponent(symbol)}&spot=${spot}`, 3600);

export const postStrategyPayoff = (payload: {
  symbol: string;
  spotPrice: number;
  lotSize: number;
  legs: ApiStrategyLeg[];
  daysToExpiry?: number;
  riskFreeRate?: number;
}) =>
  apiPost<ApiStrategyPayoffResponse>("/api/v1/derivatives/strategy/payoff", payload);

export const getVolatilitySurface = (symbol: string = "NIFTY") =>
  apiGet<ApiVolSurfaceResponse>(`/api/v1/derivatives/${encodeURIComponent(symbol)}/vol-surface`, 300);

