import type { ISODate } from "./common";
import type { AlertCategory, AlertComparator } from "./ipo";

/** Regression of a ticker against a benchmark index (Phase 6). */
export interface BenchmarkSensitivity {
  benchmarkId: string;
  benchmarkName: string; // "Nifty Bank"
  beta: number;
  alphaPct: number;
  rSquared: number;
  abnormalReturnPct: number;
  observationWindowDays: number;
}

export interface GlobalIndexCard {
  id: string;
  name: string; // "S&P 500"
  region: string;
  level: number;
  changePct: number;
  asOf: ISODate;
}

export type NewsFlag =
  | "lodr-disclosure"
  | "institutional-stake-sale"
  | "earnings-surprise"
  | "rating-action"
  | "order-win";

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string; // ISO datetime
  symbols: string[];
  flags: NewsFlag[];
}

export interface CustomAlert {
  id: string;
  symbol: string;
  category: AlertCategory;
  metric: string; // "pe" | "cmp" | "result-date"
  comparator: AlertComparator;
  threshold: number;
  note?: string;
  enabled: boolean;
  createdOn: ISODate;
}
