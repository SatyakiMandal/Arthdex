# Analytics Methods

How each computed figure on the site is produced, and the limits stated alongside it. Code references are in `backend/app/services/` unless noted. The event-impact engine is documented separately in [event-impact-analyzer.md](event-impact-analyzer.md).

General rules: nothing is back-filled; a model that cannot be fitted returns `null` with a `note`; every payload that has a "reading" ships with a `method` string stating how it was computed and its limits.

## 1. Quant engine (`quant.py`, `/company/{symbol}/quant`)

Input: 3 years of **daily** log returns (percent) from Yahoo, at least 180 observations (`MIN_OBSERVATIONS`), 252 trading days per year, risk-free 6.5%. The quant engine calls `fetch_daily_history`, not the chart period map: the chart's 3Y period deliberately coarsens to weekly bars, which once produced a 126% "realised volatility".

| Output | Method |
|---|---|
| **Volatility ensemble** | GARCH(1,1), EGARCH(1,1), FIGARCH(1,d,1) (via `arch`) and HAR-RV (OLS on realised variance via statsmodels). Weights are inverse out-of-sample MSE over the last 20% of the sample, each model fitted on the training window and evaluated with frozen parameters. Consensus = weight × volatility sum. Akaike weights were rejected because HAR-RV is not a likelihood fit on returns, so its AIC is not comparable |
| **VaR (1-day, 99%)** | Parametric (Gaussian, using consensus volatility), historical (empirical 1st percentile) and Monte Carlo (200k draws from a Student-t fitted to the returns). **Expected Shortfall** is the empirical conditional mean beyond the *historical* VaR, reported as that matched pair. No artificial ordering is imposed across methods, so Monte Carlo VaR can exceed ES when the fitted t tail is fatter than the sample |
| **Merton distance to default** | Default point = current liabilities + 0.5 × total debt (KMV convention) from the latest reported balance sheet; equity from market cap; asset volatility ≈ σ_E × E/V; returns distance to default (σ), default probability and the barrier in ₹ crore. UI tone: ≥ 4 Remote, ≥ 2.5 Contained, below Stressed |
| **Regime** | Hamilton two-state Markov switching with regime-dependent variance. States are labelled by fitted volatility (not statsmodels' arbitrary numbering); the transition matrix is transposed to row-stochastic and ordered `[lowVol, highVol]`; reports current regime probability, per-regime annualised volatility, expected duration and a convergence flag |
| **Forecasts (1D, 5D, 21D)** | AR(1) point estimate with **split-conformal** intervals: half-width is the 95th percentile of absolute residuals on a held-out calibration window. Cumulative expectation `h·μ + (r_t − μ)·φ(1 − φ^h)/(1 − φ)`. "Signal confidence" is drift ÷ interval width; it rises with horizon because drift scales with h and the interval with √h. That is a property of the ratio, not a claim that long forecasts are more reliable |
| **Kyle's λ, VPIN** | **Not estimated.** They need tick-level order flow, which no free feed exposes. Returned as `null` with `illustrative: true` and shown behind an explanatory card |

Note the contrast with the analyzer's engine, which uses a 3-state regime model and a different volatility pipeline.

## 2. Benchmark sensitivity (`sensitivity.py`, `/company/{symbol}/sensitivity`)

OLS regression of the stock's daily excess returns (over 6.5% annual risk-free) on each index's excess returns over overlapping trading days, with at least 120 overlapping observations. Output per benchmark: β, α (the annualised regression intercept, i.e. Jensen's alpha), R², β t-statistic, α p-value, and abnormal return (the stock's cumulative log-return less the index's, a different quantity from α). Benchmarks with real Yahoo history: Nifty 50, Next 50, 100, 500, Bank, IT, Pharma, Midcap 50. **Nifty Auto, Energy, Metal, FMCG, Realty and PSU Bank return a single row upstream** and are listed under `unavailableBenchmarks` instead of being regressed. The primary benchmark is the best-R² fit. The UI labels fit (Strong ≥ 0.6, Partial ≥ 0.3, Weak) and warns that α/β from a weak fit deserve caution.

## 3. Factor screens and windowed movers (`screener.py`)

One batch download of constituent history (about 4 s for 100 names) plus `^NSEI` backs both. Per symbol: beta and alpha against Nifty 50, annualised volatility, and 5-/21-session returns. A symbol with fewer than 150 overlapping observations (`MIN_OVERLAP`) is **excluded**, not defaulted to beta 1. Screens: high beta, low volatility, positive alpha. Windowed movers rank the 5-session (weekly) and 21-session (monthly) returns. Default universe Nifty 100. Weekly/monthly exist only because NSE publishes daily variations alone.

## 4. Technicals (`indicators.py`, `technicals.py`)

Pure pandas/numpy indicators following textbook definitions (Wilder's RMA for RSI/ATR/ADX, standard EMAs for MACD) so values line up with charting tools: SMA 20/50/200, EMA 20/50, RSI 14, MACD 12/26/9, Stochastic 14/3/3, MFI 14, ATR 14, Bollinger 20/2σ (with %B and bandwidth), ADX 14 (+DI/−DI), Supertrend 10/3, VWAP (resets per session intraday; anchored at first bar on daily), support/resistance from swing highs/lows merged when close.

| Interval | Yahoo period / bar | Bars returned |
|---|---|---|
| 5m | 30d / 5m | 375 |
| 15m | 60d / 15m | 400 |
| 1h | 6mo / 60m | 400 |
| 1d | 2y / 1d | 400 |

Signal tones: price vs each MA; ADX ≥ 25 strong, < 20 ranging, with DI lean; RSI > 70 / < 30; Stochastic and MFI 80/20; Bollinger %B outside 0 to 1. The bull/bear/neutral tally is a simple count, not a recommendation. The in-progress bar (NaN OHLC) is dropped.

**MACD crossover screener.** For each constituent, a bullish cross inside the last `within` bars counts only if MACD is still above signal now (a reversed cross is dropped). Each hit gets a 0 to 4 **confirmation score**: MACD on the right side of zero, price on the right side of its 50-bar EMA, ADX ≥ 20, RSI not already stretched (< 70 for bullish, > 30 for bearish). Results sort by score, recency, histogram size. The analysis panel reports bullish vs bearish cross counts, breadth of MACD above signal/zero, stretched-RSI crosses, and sector concentration of crosses against the sector's share of the universe. Intraday data is delayed and the latest bar can flip before it closes.

## 5. Bhavcopy (`bhavcopy.py`)

Source: NSE security-wise delivery file, EQ and BE series only. KPIs: securities, advances/declines/unchanged, A/D ratio, turnover (₹ crore), weighted delivery % (delivered ÷ traded quantity) and simple mean delivery %. Thresholds:

| Block | Rule |
|---|---|
| Accumulation radar | Turnover ≥ ₹5 Cr **and** delivery > 68%, ranked by turnover. High delivery is consistent with accumulation but the file cannot say who bought |
| Volume anomalies | Turnover ≥ ₹5 Cr and traded quantity > 2× the mean of the previous 5 sessions (needs ≥ 3 prior sessions); top 25 |
| Band closes | Move within 0.05 of 20%, 10% or 5% **and** close at the day's high (upper) or low (lower). Bands are inferred from move size, because the file does not carry each stock's price band; top 40 per side |

A generated one-paragraph narrative states breadth tone (> 1.5× broad strength, < 0.67× weakness, else mixed), turnover leader and delivery.

## 6. Commodities (`commodities.py`)

One batch download of a year of daily bars for 19 front-month futures plus `USDINR=X`: gold, silver, platinum, palladium, copper, aluminium, zinc, Brent, WTI, natural gas, heating oil, gasoline, wheat, corn, soybeans, cotton, sugar, coffee, cocoa. Horizons are session counts: 1W=5, 1M=21, 3M=63, 1Y=252. Indicative INR gold per 10 g and silver per kg convert at spot using 31.1034768 g per troy ounce and exclude duty, GST and premiums. Prices are COMEX/NYMEX/CBOT/ICE USD contracts, not MCX.

## 7. IPO pipeline (`ipo.py`)

Facts come from NSE's IPO desk (`ipo-current-issue`, `all-upcoming-issues`, `public-past-issues`, about 1,500 rows filtered to EQ/BE/SME). Status: `upcoming` before the start date, `closed` after the end date, `ongoing` when NSE marks it active within dates. Segment: series `SME`/`ST` is SME, else mainboard. Price band is parsed from NSE's free-text field.

Listing performance is **reconstructed** for the 45 most recent listings: the first traded session on or after the listing date supplies listing open/close; the latest session supplies CMP. Computed against the **upper price band** as issue price: `listingGainPct` uses the listing **close**, `cmpVsIssuePct` uses CMP, `sinceListingPct` is CMP versus listing close. Final subscription multiples come from `ipo-detail` ("Total" row). Enrichment runs on 5 worker threads. Many recent SME listings have no Yahoo history, so they stay unenriched. Grey-market premium and DRHP-stage issues are not available and are declared in the `unavailable` block.

## 8. News and filings (`news.py`)

- **Filings** (`kind: filing`): NSE corporate announcements. Every one carries the `lodr-disclosure` flag. Further flags come from NSE's own category taxonomy (orders → `order-win`, credit rating → `rating-action`, financial results → `earnings`, board outcome → `board-outcome`, change in management/resignation → `management-change`, trading window → `insider-window`, acquisition/investment, fund raising/allotment, dividend, shareholder meeting → `governance`, analyst meet, Reg 30 → `material-event`).
- **Press** (`kind: press`): four RSS feeds. Flags come from keyword rules (`order-win`, `earnings`, `stake-sale`, `rating-action`, `ipo`, `capital-return`, `macro`). Tickers are matched from the real universe with a three-character floor and an ambiguous-word blocklist; company names are not matched.
- Timestamps are normalised to ISO (NSE's `30-Sep-2026 01:18:34` is treated as IST) and sorted newest first. Press is de-duplicated on a punctuation- and case-normalised headline fingerprint. Filings are **not** de-duplicated by headline: two "Outcome of Board Meeting" filings can be separate disclosures with different attachments.
- Flags encode disclosure type, not sentiment.

## 9. Shareholding (`shareholding.py`)

screener.in supplies promoter/FII/DII/government/public holdings by quarter and year plus shareholder counts; NSE supplies promoter pledge, SEBI Reg 29 large-holder disclosures and insider (PIT) trades; Yahoo supplies insider/institutional share of float. Derived signals: a holder-group change beyond ±0.25 percentage points (`SIGNAL_THRESHOLD_PP`) is flagged, with streaks and net insider flow computed from filings. Nothing is estimated. Each source is guarded independently; failures are listed in `notes`.

## 10. Desk analysis payloads (`insights.py`)

Pages with large tables get one shape: `{headline, metrics[{label,value,sub,tone}], findings[{tone,title,text}], tables[], method}`. Each finding is a rule over a number shown next to it, not free text, so a reader can check the claim. Producers: `commodity_insights`, `ipo_insights`, `bhav_insights`, and the MACD screener's own block.

## 11. Fundamentals and ratios (`fundamentals.py`, `yahoo_company.py`)

Money is converted from rupees to ₹ crore (÷ 1e7); per-share figures, ratios and share counts are left alone. ROE and ROCE are derived from reported statements instead of Yahoo's summary fields. TTM ratios require four **contiguous** quarters; otherwise the latest fiscal year is used and `ratios.basis` says so. Yahoo exposes about four to six quarters for most Indian issuers, not eight.
