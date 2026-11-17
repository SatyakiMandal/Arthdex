/**
 * Which exchange a reader prefers to see prices from, for companies listed on both.
 *
 * Kept in a cookie rather than local storage so the server renders the chosen view on
 * the first paint. Companies listed on only one exchange always show that exchange.
 */
export type ExchangeView = "NSE" | "BSE" | "BOTH";

export const EXCHANGE_VIEW_COOKIE = "arthdex-exchange";

export function parseExchangeView(value: string | undefined | null): ExchangeView {
  return value === "BSE" || value === "BOTH" ? value : "NSE";
}

/** The exchange to fetch a quote or chart from: the comparison view leads with NSE. */
export function priceExchange(view: ExchangeView): "NSE" | "BSE" {
  return view === "BSE" ? "BSE" : "NSE";
}
