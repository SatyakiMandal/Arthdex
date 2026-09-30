import type { Delta, ISODate, MoverWindow } from "./common";

export type IndexFamily =
  | "broad"
  | "sectoral"
  | "thematic"
  | "exchange"; // e.g. MSEI composite

export interface MarketIndex {
  id: string;
  name: string; // "Nifty 50"
  family: IndexFamily;
  exchange: "NSE" | "BSE" | "MSEI";
  level: number;
  change: Delta;
  asOf: ISODate;
}

export type MacroIndicatorId =
  | "brent-crude"
  | "repo-fed-spread"
  | "cpi-inflation"
  | "iip-growth"
  | "manufacturing-pmi";

export interface MacroIndicator {
  id: MacroIndicatorId;
  label: string;
  value: number;
  unit: string; // "$/bbl" | "bps" | "%" | "index"
  oneMonthChangePct: number;
  asOf: ISODate;
}

export type CommodityId = "gold" | "silver" | "copper" | "zinc" | "aluminium";

export interface Commodity {
  id: CommodityId;
  label: string;
  price: number;
  unit: string; // "₹/10g" | "₹/kg" | "₹/tonne"
  oneMonthMomentumPct: number;
  asOf: ISODate;
}

/** A row in the gainers / losers market-watch table. */
export interface MoverRow {
  symbol: string;
  name: string;
  cmp: number;
  change: Delta;
  high52w: number;
  low52w: number;
  window: MoverWindow;
}

export type ScreenerFactor = "high-volatility" | "low-volatility" | "alpha";

export interface FactorScreenRow {
  symbol: string;
  name: string;
  cmp: number;
  beta: number;
  annualisedVolPct: number;
  jensensAlphaPct: number;
  factor: ScreenerFactor;
}
