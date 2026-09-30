import "server-only";

import { apiGet, apiGetOrNull, REVALIDATE, type ApiResult } from "./client";
import type {
  ApiCandleSeries,
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
  apiGet<ApiIpoPipeline>("/api/v1/ipo", REVALIDATE.ipo);

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
