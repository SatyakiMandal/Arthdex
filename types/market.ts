/**
 * Contracts for market indices, commodities, macro indicators, and market movers.
 * Covers Indian equity benchmark families (broad, sectoral, thematic, exchange),
 * commodity spot prices, and statistical factor screeners.
 */

import type { Delta, ISODate, MoverWindow } from "./common";
import type { CompanyFilingItem, CompanyFilingsPayload } from "@/lib/api/types";

export type { CompanyFilingItem, CompanyFilingsPayload };

/**
 * Classification of Indian market indices:
 * - broad: Headline indices (Nifty 50, Nifty Next 50, Nifty 500, BSE Sensex)
 * - sectoral: Industry sector benchmarks (Nifty Bank, Nifty IT, Nifty Auto, Nifty Pharma)
 * - thematic: Investment themes (Nifty Energy, Nifty CPSE, Nifty Infrastructure)
 * - exchange: Exchange-level composite benchmarks (e.g. MSEI SX40)
 */
export type IndexFamily =
  | "broad"
  | "sectoral"
  | "thematic"
  | "exchange";

/**
 * Real-time or delayed market index state from exchange feeds.
 */
export interface MarketIndex {
  id: string;
  name: string; // e.g. "Nifty 50"
  family: IndexFamily;
  exchange: "NSE" | "BSE" | "MSEI";
  level: number;
  change: Delta;
  asOf: ISODate;
}

/**
 * Macroeconomic tracking indicators monitored by the macro desk:
 * - brent-crude: Brent crude spot in $/barrel
 * - repo-fed-spread: RBI Repo Rate minus US Federal Funds Rate in basis points (bps)
 * - cpi-inflation: Year-on-year headline retail CPI (%)
 * - iip-growth: Index of Industrial Production growth (%)
 * - manufacturing-pmi: HSBC India Manufacturing Purchasing Managers' Index (expansion > 50)
 */
export type MacroIndicatorId =
  | "brent-crude"
  | "repo-fed-spread"
  | "cpi-inflation"
  | "iip-growth"
  | "manufacturing-pmi";

/**
 * Key macroeconomic indicator value and monthly rate of change.
 */
export interface MacroIndicator {
  id: MacroIndicatorId;
  label: string;
  value: number;
  unit: string; // e.g. "$/bbl" | "bps" | "%" | "index"
  oneMonthChangePct: number;
  asOf: ISODate;
}

/** Supported commodities traded on MCX or international benchmark exchanges. */
export type CommodityId = "gold" | "silver" | "copper" | "zinc" | "aluminium";

/**
 * Physical commodity benchmark quote and 30-day price momentum.
 */
export interface Commodity {
  id: CommodityId;
  label: string;
  price: number;
  unit: string; // e.g. "₹/10g" | "₹/kg" | "₹/tonne"
  oneMonthMomentumPct: number;
  asOf: ISODate;
}

/**
 * Single constituent row in the gainers / losers market-watch table.
 */
export interface MoverRow {
  /** NSE equity ticker symbol */
  symbol: string;
  /** Full corporate name */
  name: string;
  /** Current Market Price (CMP) in INR */
  cmp: number;
  /** Absolute and percentage change */
  change: Delta;
  /** 52-week trailing high price */
  high52w: number;
  /** 52-week trailing low price */
  low52w: number;
  /** Calculation window: daily, weekly, or monthly */
  window: MoverWindow;
}

/** Factor screening strategies supported on the market desk. */
export type ScreenerFactor = "high-volatility" | "low-volatility" | "alpha";

/**
 * Constituent security passing factor screener filters.
 */
export interface FactorScreenRow {
  symbol: string;
  name: string;
  cmp: number;
  /** Beta vs Nifty 50 over a 1-year estimation window */
  beta: number;
  /** Annualized standard deviation of daily log-returns (%) */
  annualisedVolPct: number;
  /** Annualized Jensen's Alpha vs capital asset pricing model (%) */
  jensensAlphaPct: number;
  /** Factor bucket matched */
  factor: ScreenerFactor;
}
