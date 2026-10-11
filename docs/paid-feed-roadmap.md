# Paid-feed roadmap

Features that are modelled, approximated or missing today because the free data (Yahoo Finance and public NSE files) is too coarse. Each one is to be built or upgraded once Arthdex has a real paid or broker feed. Until then the site stays as it is and labels modelled figures as modelled.

Keep this file current: add an item when a feature is deliberately held back for data reasons, and tick it off when it ships.

## Order flow (page `/orderflow`, tab `/company/{symbol}/orderflow`)

Today: `backend/app/services/orderflow.py` splits each bar's volume into buy and sell by where the close sits in the bar's range, and the footprint spreads that across price rows. The banner on the page says so. Volume profile, value area, absorption and large-volume bars are exact functions of the bars and need no change.

| # | Item | Needs | Replaces |
|---|---|---|---|
| 1 | Real delta, CVD, footprint cells and imbalances | Tick trades with aggressor side (or bid/ask at trade time). If the feed has no flag, classify with the Lee-Ready rule and label it "classified", not "exact" | The bar-based estimate in `split_volume` and `footprint` |
| 2 | Real big trades (single prints above a size threshold, with the price reaction after) | Tick trade tape | `big_volume_bars`, which can only see the bar a trade printed in |
| 3 | Liquidity heatmap | Level 2 depth snapshots, recorded by us over time (brokers give current depth only, so history builds forward from the day recording starts) | The "needs a depth feed" placeholder card |
| 4 | Absorption confirmed against the tape (large aggressive volume at a level that fails to move price, and a hit on resting size in the book) | Items 1 and 3 | The volume-versus-range screen in `absorption` |
| 5 | Per-session CVD and delta, with proper session boundaries | Item 1 | Window-long CVD |

Candidate sources, not yet evaluated for price or terms:
- **US futures (NQ, MNQ, NNQ, ES, MES):** Databento (trades and market-by-order with a side flag, live and historical), or a broker feed such as Rithmic or IBKR.
- **NSE:** broker websocket APIs (Zerodha Kite, Dhan, Angel One, Fyers). These give depth and last-traded quantity but usually no aggressor flag.

Build plan:
1. A provider interface in `backend/app/providers` with two implementations, "tape" and "bars".
2. An always-on collector that subscribes to the websocket, aggregates trades into per-bar price rows and stores them (SQLite or Parquet). It needs somewhere to run continuously, which request-only hosting (the Hugging Face deployment) does not give.
3. `orderflow.py` reads stored tape when it exists and falls back to the modelled version otherwise. The banner switches per symbol between "Exchange tape" and "Modelled from bars".
4. A depth recorder, then the heatmap view.
5. For futures, backfill history from the vendor so charts are not empty on day one. NSE has no cheap tick history.

## Options exposure (`backend/app/services/options_gex.py`, panel on `/orderflow`)

Today: Black-Scholes greeks from each contract's own implied volatility on the SPY and QQQ chains from Yahoo. NQ, MNQ and NNQ use QQQ, and ES and MES use SPY, with levels scaled to the futures price by the live ratio. Open interest is end-of-day and often blank outside market hours.

| # | Item | Needs |
|---|---|---|
| 6 | GEX, delta, theta, open interest and 0DTE for NSE (Nifty, Bank Nifty, stocks) | A live NSE option chain with OI and IV. Dhan's option chain API and Kite's per-contract OI are candidates |
| 7 | Futures-options chains for NQ, MNQ and ES instead of ETF proxies, which removes the scaling step | CME options data (for example from Databento) |
| 8 | Intraday-fresh open interest and volume so 0DTE reflects the current session | A feed with live OI updates |
| 9 | Replace the modelled dealer-positioning assumption where possible | Trade-level options flow with who initiated each trade. Even then positioning stays an inference |

## Open questions

- **NNQ:** Yahoo returns data for `NNQ=F`, but the exact contract was never confirmed. Position sizing is left out for it in `risk-plan.tsx`, and it is mapped to QQQ for options. Confirm what it is before wiring a real feed.
- **Contract multipliers** used by the risk plan (NQ 20, MNQ 2, ES 50, MES 5) should be checked against the vendor's contract specs.

## Other data-gated items already on record

- **Unlisted company prices:** currently a hand-maintained `data/unlisted.json` with per-record source and date. Real data means authorised access from UnlistedZone, a licensed feed, or dealer quotes keyed in. See `PROJECT_PROGRESS.md`, Phase 10.
- **Intraday history depth:** Yahoo limits 1-minute bars to about 5 days and 5- and 15-minute bars to about 60 days. A paid feed lifts that for profiles, footprints and backtests.

## Deferred for other reasons (not feed-dependent)

Ideas taken from reviewing TradingAgents at concept level (the review read the landing page only, not the code or licence):

- Parallel analyst reports per stock (technicals, fundamentals, FinBERT news sentiment, macro and sector), each as typed JSON with a score and rationale.
- A bull-versus-bear synthesis card. This needs an LLM provider decision.
- A deterministic risk layer in the quant engine (volatility, stops, drawdown, liquidity, concentration), with an LLM only explaining the result.
- A decision log that records each recommendation with date and price and scores it against Nifty at 1, 5 and 20 trading days.
- A walk-forward backtest with an out-of-sample promotion gate before any signal is shown. Yahoo data is not point-in-time, so look-ahead bias has to be handled.
