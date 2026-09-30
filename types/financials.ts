import type { ISODate } from "./common";

/** One reported quarter of the P&L, in ₹ crore unless noted. */
export interface QuarterlyPnL {
  quarter: string; // "Q3 FY25"
  periodEnd: ISODate;
  revenue: number;
  operatingExpenses: number;
  operatingProfit: number;
  opmPct: number;
  netProfit: number;
  eps: number;
}

export interface BalanceSheetHighlight {
  period: string; // "FY25"
  periodEnd: ISODate;
  borrowings: number;
  equityCapital: number;
  reserves: number;
  totalAssets: number;
  debtToEquity: number;
}

export interface KeyRatios {
  period: string;
  roePct: number;
  rocePct: number;
  currentRatio: number;
  nopat: number;
  orderBacklogCr: number;
  orderBacklogToMarketCap: number;
}

export interface FinancialsBundle {
  symbol: string;
  quarterly: QuarterlyPnL[];
  balanceSheet: BalanceSheetHighlight[];
  ratios: KeyRatios;
}

export type ValuationVerdict =
  | "RELATIVELY_UNDERVALUED"
  | "FAIR_VALUE_BASELINE"
  | "RELATIVELY_OVERVALUED";

export interface PeerValuationRow {
  symbol: string;
  name: string;
  cmp: number;
  peRatio: number;
  pbRatio: number;
  evToEbitda: number;
  evToSales: number;
  roePct: number;
  oneYearReturnPct: number;
  isSubject: boolean;
}

export interface PeerValuationMatrix {
  symbol: string;
  peers: PeerValuationRow[];
  verdict: ValuationVerdict;
  /** Composite z-score against the peer median that produced the verdict. */
  compositeZScore: number;
}
