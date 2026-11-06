# Backend: the Arthdex Data Service

FastAPI app in `backend/app`. Title "Arthdex Data Service", version 0.1.0. Interactive docs at `/docs`. All routes live under `/api/v1` except `GET /`, which returns `{service, docs, health}`.

## 1. Layers

```
routers/    HTTP surface, validation, caching calls, envelope wrapping
services/   Computation and orchestration (quant, screener, technicals, bhavcopy, ipo, news, …)
providers/  Raw upstream access (yahoo, nse, rss, universe, constituents, fundamentals)
cache.py    In-process TTL cache        schemas.py  envelope()        config.py  Settings
```

`main.py` wires eleven routers (health, market, company, quant, ipo, news, search, screener, analyzer, bhavcopy, unlisted), enables CORS for `http://localhost:3000` and `http://127.0.0.1:3000` (methods GET and POST), and on startup creates `analyzer_data/runs`, marks interrupted analyzer runs failed, and seeds the sample reports. A second startup hook starts building the unlisted directory in a background thread (a cold build is a dozen or so rate-limited fetches, roughly 30 to 55 seconds). A background thread also pre-builds the IPO pipeline at import time, since the first build takes about a minute of upstream calls.

## 2. Conventions

### Envelope
Every route except the analyzer's returns:

```json
{ "data": { }, "meta": {
    "source": "Yahoo Finance",
    "delayedMinutes": 15,
    "cacheAgeSeconds": 0.0,
    "fetchedAt": "2026-09-30T06:13:27Z",
    "illustrative": false,
    "note": null } }
```

`delayedMinutes` is the upstream's own delay (separate from cache age). `illustrative: true` marks data with no live source at all.

### Cache (`cache.py`)
`CACHE.get_or_fetch(key, ttl, fetch)` returns `(value, age_seconds)`. Fresh entries are served directly. If a refresh **fails and a stale entry exists, the stale value is served** with its true age; with no entry the error propagates. `expire(key)` marks an entry stale but keeps it as a fallback. The cache is per process and unbounded; a restart empties it. `GET /api/v1/cache` lists keys and ages.

### Errors
`404` unknown symbol, no data or unknown run; `400` bad `period`/`interval`/`index`/`universe`; `422` FastAPI validation (e.g. `limit=2` on factor screens, where `ge=3`); `409` run state conflicts; `429` analyzer queue full; `503` upstream failure ("X unavailable: …").

### Symbols
Company routes take the NSE symbol (`GRSE`). `exchange=NSE|BSE` is accepted on some routes and maps to Yahoo's `.NS` / `.BO` suffix. Indices use Yahoo symbols such as `^NSEI`.

## 3. Endpoint reference

### Health and cache
| Route | Description |
|---|---|
| `GET /api/v1/health` | `{status, service, time}` |
| `GET /api/v1/cache` | `{entries, ageSeconds{key: s}}` |
| `POST /api/v1/cache/refresh` | Body `{prefixes: string[≤12], symbol?}`. Expires entries whose key starts with a prefix or contains the symbol as a `:`-separated segment. Skips `analyzer:` keys and entries younger than 10 s. Returns `{expired}` |

### Market
| Route | Params | Source / TTL | Returns |
|---|---|---|---|
| `GET /market/indices` | | NSE `allIndices`, 60 s | Broad, sectoral and thematic indices: level, change, advances/declines, P/E, 52-week band, 30-day and 365-day change |
| `GET /market/mover-universes` | | static | `{default: "gt20", universes[]}` |
| `GET /market/movers` | `direction=gainers\|losers`, `universe`, `limit` 1 to 50 | NSE live analysis, 120 s | Rows plus `deliveryPct` and `deliveryDate` from the latest Bhavcopy. Universes: `gt20` (default), `nifty50`, `niftynext50`, `banknifty`, `fo`, `lt20`, `all` |
| `GET /market/global` | | Yahoo, 60 s | Six world indices |
| `GET /market/commodities` | | Yahoo futures, 600 s | 19 commodities, 1D/1W/1M/3M/1Y change, sparkline, 52-week range, driver note, USD/INR, indicative INR gold/silver, `insights` |

### Company (`/company/{symbol}/…`)
| Route | Params | TTL | Returns |
|---|---|---|---|
| `quote` | `exchange` | 60 s | Price, day range, 52-week band, market cap (₹ crore) |
| `profile` | `exchange` | 24 h | Name, sector, industry, website, headcount |
| `candles` | `period` = `1D 5D 1M 6M 1Y 3Y 5Y MAX`, `exchange` | 900 s | OHLCV. Bar sizes: 1D=5m, 5D=15m, 1M/6M/1Y=daily, 3Y/5Y=weekly, MAX=monthly |
| `financials` | `exchange` | 24 h | Quarterly P&L, annual P&L, balance-sheet highlights, TTM ratios with `ratios.basis` |
| `valuation` | `exchange` | 24 h | P/E, P/B, EV multiples, margins, dividend yield, ROE (where reported) |
| `quant` | `exchange` | 1 h | Volatility ensemble, VaR suite, Merton, Markov regime, forecasts, microstructure placeholder |
| `sensitivity` | `exchange` | 1 h | OLS beta/alpha/R² against benchmarks with history; `unavailableBenchmarks` |
| `technicals` | `interval=5m\|15m\|1h\|1d` | 120 s intraday, 900 s daily | Bars, ~22 indicator series, support/resistance levels, per-indicator signals, bull/bear/neutral tally, last MACD crossover |
| `shareholding` | | 6 h | Pattern (screener.in), promoter pledge, SEBI Reg 29 holders, insider trades (NSE), Yahoo holder summary, derived analytics, `notes` for failed sources |
| `statistics` | | 6 h | Profile and statistics (valuation measures, share stats, trading, dividends, executives) |
| `statements` | | 6 h | Income statement, balance sheet, cash flow, annual and quarterly |
| `analysts` | | 3 h | Price targets, recommendations, estimates, EPS trend/revisions, growth, earnings history |
| `history` | `range=1M 3M 6M 1Y 5Y MAX`, `interval=1d\|1wk\|1mo` | 900 s | Historical rows |
| `compare` | `peers` (comma list, max 6), `period` (same set as range) | 900 s | Rebased price comparison against `^NSEI` and peers |

### Screener
| Route | Params | Description |
|---|---|---|
| `GET /screener/indices` | | Available indices (`nifty50`, `nifty100` default, `nifty200`, `nifty500`) |
| `GET /screener/factors` | `index`, `limit` 3 to 30 | High beta, low volatility and alpha screens. Beta/alpha regressed on Nifty 50 over one year of daily returns; symbols with fewer than 150 overlapping observations are excluded |
| `GET /screener/movers` | `window=daily\|weekly\|monthly`, `index`, `limit` | Windowed gainers/losers (5- and 21-session windows) from constituent history |
| `GET /screener/macd-crossover` | `direction=above\|below`, `interval`, `within` 1 to 50, `index` | MACD (12, 26, 9) crossover scan with confirmation score and `insights`. Cached 120 s intraday, 900 s daily |

The factor and mover screens share one cached batch download per index (`screener:universe:{index}`, 1 h).

### Search
| Route | Description |
|---|---|
| `GET /search?q=&limit=` | Autocomplete over the NSE equity master (about 2,600 rows; cached 24 h) **plus** the unlisted directory. Listed ranking: exact symbol, symbol prefix, name prefix, substring. Unlisted hits (`kind: "unlisted"`, `href: /unlisted/{id}`) are added only if the directory is already built; otherwise the call returns listed hits immediately and a background build is started, so a keystroke never waits on it. Each result carries `kind` (`listed` or `unlisted`) |
| `GET /universe/stats` | `{total, bySeries}` (listed only) |

### IPO
| Route | Description |
|---|---|
| `GET /ipo?segment=mainboard\|sme&status=ongoing\|upcoming\|closed\|listed` | Pipeline (cached 30 min) plus `insights`, `counts`/`errors` and an `unavailable` block explaining the missing grey-market and DRHP data |
| `GET /ipo/{issue_id}` | One issue by lower-cased id. Not used by the website |

### News
`GET /news?limit=&symbol=&kind=filing|press`: merged feed, cached 5 min, filtered after caching. Items carry `kind`, `flags[]`, `symbols[]`, ISO timestamps, and for filings the NSE `seq_id`-based id. Response also has `counts{filings, press}` and `errors[]` for failed sources.

### Bhavcopy
`GET /bhavcopy?on=YYYY-MM-DD`: omitted `on` means the latest available session. 404 if NSE has no file for the date. Cached 1 h per session. Returns `date`, `kpis`, `narrative`, `criteria`, `accumulation`, `volumeAnomalies`, `bandMoves{upper, lower}`, `insights`.

### Unlisted
| Route | Description |
|---|---|
| `GET /unlisted` | Every tracked unlisted company: id, name, sector, indicative price (cached 6 h, warmed at startup) |
| `GET /unlisted/{id}` | Price, 6M move, ISIN/CIN, the source's ratios, revision series and revision table (cached 3 h). 404 for an unknown id (ids must match `^[a-z0-9][a-z0-9-]{2,200}$`) |

The unlisted service reuses `ceia.fetcher.Fetcher` (honest user agent, robots.txt checks, 2 s minimum spacing per origin, on-disk cache and provenance log under `backend/cache/unlisted`). Directory pages are parsed with regular expressions over UnlistedZone's HTML, so a markup change on that site will break parsing.

### Research desk
| Route | Description |
|---|---|
| `GET /deals` | Today's bulk, block and short-selling disclosures from NSE, largest value first (cached 15 min) |
| `GET /calendar` | Next 30 days of board meetings (results flagged) and corporate actions: dividend, split, bonus, rights (cached 30 min) |
| `POST /watchlist/snapshot` | Body `{listed: [symbols], unlisted: [ids]}` (up to 60 each). Latest price and day change for listed names, indicative price for unlisted. Used by the watchlist and by browser-side alert checks |
| `GET /market/movers-explained?direction=&universe=&limit=` | Top movers, each with its own recent exchange filings (asked per symbol, last 4 days, routine notices dropped) plus press headlines that name it. A candidate explanation, not proof of cause |
| `GET /company/{symbol}/pre-ipo` | The unlisted-directory id for a now-listed company, matched on normalised legal name, or `{id: null}` |
| `GET /status` | Per-feed freshness (`fresh`, `stale`, `idle`), read from the cache so it never queries an upstream |

`GET /unlisted/{id}` also returns a `lifecycle` block: the NSE symbol if the company's name now matches a listed equity, and its IPO issue if one is in the pipeline. Both are read from caches only.

Insider-trading (PIT) disclosures are not offered: the NSE endpoint returned no rows for any date range tried.

### Fixed Income, Rates & Yield Curve (ackend/fixed_income.py)
| Function / Route | Params | Source / TTL | Description & Returns |
|---|---|---|---|
| get_sovereign_yield_curve() | None | CCIL / RBI, 300 s | Complete Indian Sovereign Yield Curve (91D, 182D, 364D T-Bills; 2Y, 3Y, 5Y, 10Y, 14Y, 30Y G-Secs) with fitted Nelson-Siegel / Svensson model parameters (beta_0, beta_1, beta_2, lambda), US 10Y sovereign spread, curve slope (10Y - 2Y, 30Y - 10Y), and historical 1M/1Y shift overlays |
| get_gsec_benchmarks() | None | RBI / CCIL, 300 s | Benchmark 10Y G-Sec (7.18% GS 2033 / current), RBI Policy Rate corridor (Policy Repo 6.50%, SDF 6.25%, MSF 6.75%, Bank Rate 6.75%), upcoming RBI indicative primary auction calendar, and sovereign liquidity status |

### Surveillance & Microstructure (ackend/surveillance.py)
| Function / Route | Params | Source / TTL | Description & Returns |
|---|---|---|---|
| get_sebi_surveillance_data() | ction_type=all|asm|gsm|t2t | SEBI / NSE / BSE circulars, 300 s | Securities under SEBI surveillance frameworks: Long-Term ASM (Stages I-IV), Short-Term ASM (Stages I-II), GSM (Stages I-IV with additional surveillance deposit requirements), Trade-for-Trade (T2T) settlement bucket, applicable price band filters (2%, 5%, 10%, 20%), and regulatory entry reason codes |
| get_circuit_band_movers() | and=all|2|5|10|20 | Exchange Bhavcopy & real-time quotes, 120 s | Securities hitting upper or lower circuit limits or trading within 1.5% of daily price bands, volume multipliers, and delivery participation |

### Derivatives Intelligence & Analytics (ackend/derivatives_intelligence.py)
| Function / Route | Params | Source / TTL | Description & Returns |
|---|---|---|---|
| get_participant_oi() | date? | NSE participant-wise open interest report, 300 s | Institutional positioning breakdown across FII, DII, Proprietary traders, and Clients. Returns contract counts and Net Open Interest in Index Futures, Index Options (Calls & Puts), Stock Futures, and Stock Options, plus Bull/Bear Long-Short ratios and historical 10-day trend |
| get_volatility_surface(symbol) | symbol (e.g. NIFTY, BANKNIFTY) | NSE option chain, 60 s | 3D Implied Volatility (IV) surface matrix across strike moneyness (80% to 120% of spot) and standard expiries (Current Weekly, Next Weekly, Monthly, Next Month). Computes implied volatility skew, smile curvature, and ATM volatility term structure |
| calculate_strategy_payoff(legs, spot_price) | Body {legs: [{type, strike, expiry, action, lots, premium}], spotPrice} | Deterministic quant calculator | Multi-leg Options Strategy Builder payoff curve across a +-15% price grid. Computes Upper & Lower Breakeven points, Maximum Profit, Maximum Risk / Loss, Risk-Reward ratio, Net Debit/Credit, and aggregated position Greeks (Delta, Gamma, Theta, Vega) |

### Macroeconomics & Currencies (ackend/macro_economics.py)
| Function / Route | Params | Source / TTL | Description & Returns |
|---|---|---|---|
| get_macro_economic_calendar() | limit? | MOSPI, RBI, Ministry of Commerce, 600 s | High-impact Indian economic events calendar: CPI Inflation, Real GDP Growth, Index of Industrial Production (IIP), Core Sector Growth, Fiscal Deficit, Trade Balance, and RBI MPC decisions. Includes Actual, Market Consensus, and Prior figures with surprise delta |
| get_macro_indicators() | None | MOSPI / RBI historical series, 3600 s | Historical macroeconomic time series for correlation and regression analysis with equity indices |
| get_inr_currency_matrix() | None | RBI Reference Rates & FX market, 120 s | INR Cross-Currency rates (USDINR, EURINR, GBPINR, JPYINR), 1D/1W/1M changes, RBI Foreign Exchange Reserves level, Real Effective Exchange Rate (REER) 40-currency index, and annualized Forward Premiums (1M, 3M, 6M, 1Y) |

### Mutual Funds & Overlap Engine (ackend/funds.py)
| Function / Route | Params | Source / TTL | Description & Returns |
|---|---|---|---|
| get_mutual_funds_screener(category) | category=all|equity|debt|hybrid|elss|index | AMFI / Fund factsheets, 600 s | Comprehensive Indian mutual fund screener with scheme NAV, 1Y, 3Y, 5Y CAGR returns, Total Expense Ratio (TER), Assets Under Management (AUM Rs Cr), Sharpe Ratio, Sortino Ratio, Benchmark Alpha, Portfolio Beta, and fund manager tenure |
| calculate_portfolio_overlap(scheme_ids) | scheme_ids (comma-separated IDs) | AMFI holding disclosures, 600 s | Pairwise portfolio overlap matrix calculated using the minimum holding weight formula: Overlap(A,B) = sum min(w_{i,A}, w_{i,B}). Returns overlap percentages, top common stocks with individual weights, and unique stock holdings per fund |

### Paper Trading & Indian Statutory Cost Desk (ackend/paper_trading.py)
| Function / Route | Params | Source / TTL | Description & Returns |
|---|---|---|---|
| get_paper_account() | ccount_id? | In-memory / session store | Virtual institutional cash account (default Rs 10,00,000 capital), available margin, margin utilized, open positions, realized and unrealized P&L |
| submit_paper_order(order) | Body {symbol, side, orderType, quantity, price, assetClass} | Execution simulator | Validates capital margin against live prices, simulates limit/market order fills, updates positions and records order audit trail |
| calculate_statutory_costs(trade_value, side, asset_class) | 	radeValue, side, ssetClass | Indian statutory tax calculator | Exact breakdown of Indian transaction costs: Securities Transaction Tax (STT - 0.1% equity delivery, 0.025% intraday sell, 0.125% options exercise), Goods & Services Tax (GST - 18% on brokerage + turnover fees + SEBI fees), SEBI Turnover Charges (Rs 10 per crore), Stamp Duty (0.015% buy delivery, 0.003% intraday buy, 0.003% options buy), and NSE Exchange Turnover Charges (0.00325%) |

### Analyzer (not enveloped)
| Route | Description |
|---|---|
| `GET /analyzer/search?q=&kind=any\|listed\|unlisted&limit=` | `kind` defaults to `any`: NSE equities plus the unlisted directory, merged so listed hits cannot crowd out unlisted ones (at least 3 unlisted slots are kept). Returns `unlistedReady: false` while the directory is still being built |
| `GET /analyzer/runs/{id}/peers` | Companies worth comparing a finished run with. Listed: the peers the engine scraped for the company. Unlisted: other unlisted companies in the same UnlistedZone sector (needs the directory to be built; `ready: false` until then). Each carries `runId` when a finished analysis of it already exists |
| `POST /analyzer/runs` (202) | Body `{kind, company, ticker?, url?, start, end}`. See validation below |
| `GET /analyzer/runs?origin=run\|sample&limit=` | Newest first |
| `GET /analyzer/runs/{id}` | Status, stage, log tail, progress |
| `GET /analyzer/runs/{id}/summary` | 409 unless `COMPLETED` |
| `GET /analyzer/runs/{id}/report` | Self-contained HTML |
| `GET /analyzer/runs/{id}/download/{report.html\|model.xlsx\|analysis.json}` | File download |
| `POST /analyzer/runs/{id}/cancel` | 409 if not active |
| `DELETE /analyzer/runs/{id}` | 404 missing, 403 sample, 409 active |
| `POST /analyzer/runs/clear-unsuccessful` | Deletes user-started failed/cancelled runs |
| `POST /analyzer/snapshots/{symbol}` | Start or reuse the no-news research snapshot |

### Bloomberg Terminal Expansion Endpoints (Phases 8–18)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/network/hierarchy?symbol={sym}` | Corporate conglomerate holding hierarchy, listed associates, subsidiaries & JVs |
| `GET /api/v1/network/supply-chain?symbol={sym}` | Multi-tier suppliers, customers, contractors, sole-source risk flags |
| `GET /api/v1/network/summary?symbol={sym}` | Aggregate corporate network telemetry and provenance metrics |
| `GET /api/v1/risk-lab/crisis-scenarios` | Historical crash parameters (2008 GFC, 2013 Taper, 2020 COVID, 2024 Election) |
| `POST /api/v1/risk-lab/stress-test` | Portfolio stress test against historical and hypothetical macro shocks |
| `GET /api/v1/risk-lab/factor-exposures` | Fama-French + Momentum + Low Volatility 5-factor regression for Indian equities |
| `POST /api/v1/risk-lab/backtest` | Walk-forward rule backtester deducting Indian statutory charges (STT, GST, Stamp Duty) |
| `GET /api/v1/sectors/kpis` | Cross-sector operating overview (SIAM auto, RBI banking, CEA power, DGCA aviation, TRAI telecom) |
| `GET /api/v1/sectors/kpis/{sector_code}` | Detailed sector operational ledger with 12-month historical time series |
| `GET /api/v1/valuation/{symbol}/dcf` | 2-Stage & 3-Stage FCFF model with dynamic CAPM WACC (10Y G-Sec Rf = 7.18%) |
| `POST /api/v1/valuation/dcf/calculate` | Dynamic recalculation of intrinsic value under custom WACC & growth parameters |
| `GET /api/v1/valuation/{symbol}/reverse-dcf` | Market-implied 5-year FCF growth rate priced into CMP |
| `GET /api/v1/valuation/{symbol}/sensitivity` | 5x5 sensitivity matrix grid of fair value across WACC and terminal growth |
| `GET /api/v1/sme/overview` | NSE Emerge & BSE SME board metrics, sector breakdown and active issues |
| `GET /api/v1/sme/ipos` | SME IPO pipeline with SEBI ₹1.0L–₹1.5L minimum lot compliance & subscription multiples |
| `GET /api/v1/sme/migrations` | Mainboard migration radar: companies meeting 3Y listing, ₹10 Cr capital, ₹25 Cr net worth criteria |
| `GET /api/v1/sme/screener` | Multi-factor SME stock screener with bid-ask spread and liquidity filters |
| `GET /api/v1/company/{symbol}/tear-sheet` | 2-Page institutional factsheet / tear-sheet with 10Y CAGR ledger and consensus targets |
| `GET /api/v1/company/{symbol}/notes` | In-terminal research notes retrieval |
| `POST /api/v1/company/{symbol}/notes` | Save analyst research thesis, price target, and sentiment tag |
| `GET /api/v1/xls/quote` | High-throughput live quote formula endpoint for Excel `=WEBSERVICE()` & Google Sheets `=IMPORTDATA()` |
| `GET /api/v1/xls/hist` | Historical daily OHLCV candles in streaming CSV format |

Run validation: `kind` listed or unlisted; `company` 2 to 120 chars; `ticker` matches `^[A-Za-z0-9&.\-^]+$`; `url` must match `^https://unlistedzone\.com/shares/…`; end not in the future; window 45 to 800 days; listed needs a ticker; 429 when 8 or more runs are queued/running.

`backend/README.md`'s endpoint table predates technicals, shareholding, statistics, statements, analysts, history, compare, commodities, Bhavcopy, the MACD screener, cache refresh and the extra analyzer routes. This document is the more complete list.

## 4. Providers (upstream access)

| Provider | Upstream | Notes |
|---|---|---|
| `yahoo.py` | `yfinance` | Quotes from `fast_info` plus last completed session; history; light profile/valuation; global indices. Latest row with `NaN` OHLC is dropped. 52-week fields are `yearHigh`/`yearLow`. Percentage conventions differ per field (see below) |
| `fundamentals.py` | `yfinance` statements | Quarterly/annual P&L, balance sheet, derived TTM ratios (ROE/ROCE derived from statements, not Yahoo's patchy summary). `_contiguous_tail` refuses to sum non-consecutive quarters |
| `nse.py` | `nseindia.com` JSON | Needs cookies primed from a home-page GET and browser impersonation (`curl_cffi`, `impersonate="chrome"`). `nse_get` retries 3 times with 0.75 s × 2ⁿ backoff and re-primes the session |
| `constituents.py` | `nsearchives.nseindia.com` CSV | Nifty 50/100/200/500 lists with industry classification |
| `universe.py` | `EQUITY_L.csv` | Equity master; `AMBIGUOUS_SYMBOLS` filters English words that are also tickers |
| `rss.py` | Four feeds: Moneycontrol market reports, Moneycontrol business, Economic Times markets, Livemint markets | Parsed with `feedparser`; entity/markup cleaning |
| `services/bhavcopy.py` | `sec_bhavdata_full_{ddmmyyyy}.csv` | Immutable once published, so cached for the process lifetime |
| `services/shareholding.py` | screener.in, NSE, Yahoo | Each source guarded independently; the page degrades per source |

### Upstream quirks handled in code (do not "fix" them back)
1. Yahoo's newest row can be an incomplete session (NaN OHLC with real volume).
2. 52-week fields are `yearHigh`/`yearLow`.
3. Yahoo mixes percent conventions in one payload: `returnOnEquity`, `profitMargins` are fractions; `dividendYield` is already a percentage. Scaling both alike once produced an 87% dividend yield for GRSE.
4. NSE needs primed cookies and browser impersonation.
5. NSE spells the losers bucket `loosers`.
6. NSE's all-securities movers are dominated by penny stocks and rights entitlements; the default universe is `gt20` and hyphenated symbols (e.g. `CENTEXT-RE`) are excluded.
7. Yahoo quarterly series have gaps for Indian issuers (e.g. Q2 FY26 missing for GRSE and TCS). Ratios fall back to the latest full fiscal year and report it in `ratios.basis`.
8. Press headline ticker matching has a three-character floor (TCS, ITC and IOC are real tickers). Company names are intentionally not matched.
9. Business Standard's markets feed returns no entries and is excluded.

## 5. Dependencies and runtime

`backend/requirements.txt` pins FastAPI 0.142, uvicorn 0.54, pandas 3.0.6, numpy 2.5.3, scipy 1.18.1, statsmodels 0.15.0, arch 8.0.0, yfinance 1.7.0, curl_cffi 0.16.3, pydantic 2.13.5, beautifulsoup4, lxml, plus unpinned lower bounds `openpyxl>=3.1`, `torch>=2.0`, `transformers>=4.40` for the analyzer. The file does not include Playwright, which `ceia/pdf.py` needs for PDF export (not wired to the website). `feedparser==6.0.14` (with its `feedparser_sgmllib==2.1.0` helper), which `providers/rss.py` imports at module load, is pinned in the file.
