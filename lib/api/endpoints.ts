import "server-only";

import { apiGet, apiGetOrNull, REVALIDATE, type ApiResult } from "./client";
import type {
  ApiCalendar,
  ApiDeals,
  ApiMoverExplained,
  ApiPreIpo,
  ApiStatus,
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
} from "./types";

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
    `/api/v1/market/movers?direction=${direction}&universe=${universe}&limit=${limit}`,
    REVALIDATE.movers,
  );

export const getMoverUniverses = () =>
  apiGetOrNull<{ default: string; universes: { id: string; label: string }[] }>(
    "/api/v1/market/mover-universes",
    REVALIDATE.universe,
  );

// -- company ----------------------------------------------------------------

export const getQuote = (symbol: string) =>
  apiGet<ApiQuote>(`/api/v1/company/${symbol}/quote`, REVALIDATE.quote);

export const getProfile = (symbol: string) =>
  apiGetOrNull<ApiProfile>(`/api/v1/company/${symbol}/profile`, REVALIDATE.fundamentals);

export const getCandles = (symbol: string, period: string) =>
  apiGet<ApiCandleSeries>(
    `/api/v1/company/${symbol}/candles?period=${period}`,
    REVALIDATE.candles,
  );

export const getFinancials = (symbol: string) =>
  apiGetOrNull<ApiFinancials>(`/api/v1/company/${symbol}/financials`, REVALIDATE.fundamentals);

export const getValuation = (symbol: string) =>
  apiGetOrNull<ApiValuation>(`/api/v1/company/${symbol}/valuation`, REVALIDATE.fundamentals);

export const getQuant = (symbol: string) =>
  apiGetOrNull<ApiQuant>(`/api/v1/company/${symbol}/quant`, REVALIDATE.quant);

export const getSensitivity = (symbol: string) =>
  apiGetOrNull<ApiSensitivity>(`/api/v1/company/${symbol}/sensitivity`, REVALIDATE.quant);

// -- search -----------------------------------------------------------------

export const searchCompanies = (query: string, limit = 12) =>
  apiGetOrNull<ApiSearchResult[]>(
    `/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`,
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
  apiGet<ApiMoverExplained[]>(`/api/v1/market/movers-explained?direction=${direction}&limit=${limit}`, REVALIDATE.movers);

export const getStatus = () => apiGet<ApiStatus>("/api/v1/status", 10);

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
    `/api/v1/screener/factors?index=${index}&limit=${limit}`,
    REVALIDATE.quant,
  );

export const getWindowedMovers = (window: string, index = "nifty100", limit = 15) =>
  apiGetOrNull<ApiWindowedMovers>(
    `/api/v1/screener/movers?window=${window}&index=${index}&limit=${limit}`,
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
  apiGet<ApiTechnicals>(`/api/v1/company/${symbol}/technicals?interval=${interval}`, 60);

export const getMacdScreen = (params: { direction: string; interval: string; within: number; index: string }) =>
  apiGet<ApiMacdScreen>(
    `/api/v1/screener/macd-crossover?direction=${params.direction}&interval=${params.interval}&within=${params.within}&index=${params.index}`,
    60,
  );

// -- commodities ------------------------------------------------------------

export const getCommodities = () => apiGet<ApiCommodities>("/api/v1/market/commodities?v=2", 600);

// -- shareholding -----------------------------------------------------------

export const getShareholding = (symbol: string) =>
  apiGet<ApiShareholding>(`/api/v1/company/${symbol}/shareholding`, 3600);

// -- Yahoo Finance company sections -----------------------------------------

export const getYStats = (symbol: string) => apiGet<ApiYStats>(`/api/v1/company/${symbol}/statistics?v=1`, 3600);
export const getYStatements = (symbol: string) => apiGet<ApiYStatements>(`/api/v1/company/${symbol}/statements?v=1`, 3600);
export const getYAnalysts = (symbol: string) => apiGet<ApiYAnalysts>(`/api/v1/company/${symbol}/analysts?v=1`, 3600);
export const getYHistory = (symbol: string, range = "5Y", interval = "1d") =>
  apiGet<ApiYHistory>(`/api/v1/company/${symbol}/history?range=${range}&interval=${interval}&v=1`, 900);
export const getYCompare = (symbol: string, peers: string[], period = "1Y") =>
  apiGet<ApiYCompare>(`/api/v1/company/${symbol}/compare?peers=${peers.join(",")}&period=${period}&v=1`, 900);
