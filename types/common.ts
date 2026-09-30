/** Shared primitives used across every Arthdex data contract. */

export type ISODate = string; // YYYY-MM-DD
export type Currency = "INR" | "USD";

export type Direction = "up" | "down" | "flat";

export type Period = "1D" | "5D" | "1M" | "6M" | "1Y" | "3Y" | "5Y" | "MAX";

export type MoverWindow = "daily" | "weekly" | "monthly";

/** A value paired with its change over a window. */
export interface Delta {
  absolute: number;
  percent: number;
}

/** Generic point on a time series. */
export interface TimePoint {
  date: ISODate;
  value: number;
}

/**
 * OHLCV candle used by the price charts.
 *
 * `date` is `YYYY-MM-DD` at daily granularity and coarser. For the intraday
 * horizons (1D, 5D) it carries a full ISO timestamp instead, so the crosshair
 * tooltip can report the exact bar time.
 */
export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
