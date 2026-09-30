import type { Candle, Delta, ISODate, Period } from "./common";

export interface Ticker {
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE" | "MSEI";
  sector: string;
  industry: string;
  isin?: string;
}

export interface Quote extends Ticker {
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
  asOf: ISODate;
}

/** Candle series keyed by the horizon it backs. */
export interface PriceSeries {
  symbol: string;
  period: Period;
  candles: Candle[];
}

export type SearchEntityKind = "listed" | "unlisted" | "ipo";

export interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  kind: SearchEntityKind;
  href: string;
}
