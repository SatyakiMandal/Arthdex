# Arthdex Data Service

FastAPI service supplying live Indian market data to the Next.js front end.

## Run

```bash
cd backend
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Interactive API docs: <http://127.0.0.1:8000/docs>

## Endpoints

| Route | Returns |
|---|---|
| `GET /api/v1/health` | Service liveness |
| `GET /api/v1/cache` | Cached keys with age in seconds |
| `GET /api/v1/market/indices` | NSE broad, sectoral and thematic indices |
| `GET /api/v1/market/mover-universes` | Selectable universes for the movers table |
| `GET /api/v1/market/movers?direction=&universe=&limit=` | Top gainers / losers |
| `GET /api/v1/market/global` | Overnight global index levels |
| `GET /api/v1/company/{symbol}/quote` | Price, day range, 52-week band, market cap |
| `GET /api/v1/company/{symbol}/profile` | Name, sector, industry, website, headcount |
| `GET /api/v1/company/{symbol}/candles?period=` | OHLCV; periods `1D 5D 1M 6M 1Y 3Y 5Y MAX` |
| `GET /api/v1/company/{symbol}/financials` | Quarterly + annual P&L, balance sheet, ratios |
| `GET /api/v1/company/{symbol}/valuation` | P/E, P/B, EV multiples, margins, dividend yield |
| `GET /api/v1/company/{symbol}/quant` | Volatility ensemble, VaR, Merton, regime, forecasts |
| `GET /api/v1/company/{symbol}/sensitivity` | OLS beta / alpha / R² vs eight benchmarks |
| `GET /api/v1/search?q=` | Autocomplete over all ~2,600 NSE listed equities |
| `GET /api/v1/universe/stats` | Universe size and series breakdown |
| `GET /api/v1/ipo?segment=&status=` | Pipeline: ongoing, upcoming, closed, listed |
| `GET /api/v1/ipo/{issue_id}` | One issue |
| `GET /api/v1/news?symbol=&kind=&limit=` | Exchange filings + financial-press RSS |
| `GET /api/v1/analyzer/search?q=&kind=listed\|unlisted` | Autocomplete for the analyzer |
| `POST /api/v1/analyzer/runs` | Start an event-impact analysis (`kind`, `company`, `ticker`/`url`, `start`, `end`) |
| `GET /api/v1/analyzer/runs?origin=run\|sample` | Runs, newest first |
| `GET /api/v1/analyzer/runs/{id}` | Status, stage and live engine log |
| `GET /api/v1/analyzer/runs/{id}/summary` | Structured results of a finished run |
| `GET /api/v1/analyzer/runs/{id}/report` · `/download/{report.html\|model.xlsx\|analysis.json}` | Full report and artefacts |
| `POST /api/v1/analyzer/runs/{id}/cancel` | Kill an active run |

## Response shape

Every response is wrapped so the UI can state provenance rather than implying
that delayed data is live:

```json
{
  "data": { },
  "meta": {
    "source": "Yahoo Finance",
    "delayedMinutes": 15,
    "cacheAgeSeconds": 0.0,
    "fetchedAt": "2026-09-30T06:13:27Z",
    "illustrative": false,
    "note": null
  }
}
```

`illustrative: true` marks the three areas where **no live feed exists at any
price**: unlisted valuations, IPO grey-market premium, and Kyle's lambda / VPIN.

## Upstream quirks worth knowing

These were found by probing and are handled in code — do not "fix" them back.

1. **Yahoo's latest row is an incomplete session**: OHLC arrive as `NaN` with a
   real `Volume`. Rows without a close are dropped.
2. **52-week fields are `yearHigh` / `yearLow`**, not `fiftyTwoWeek*`.
3. **Yahoo mixes percentage conventions in one payload.** `returnOnEquity` and
   `profitMargins` are fractions; `dividendYield` is already a percentage.
   Scaling both the same way produced an 87% dividend yield for GRSE.
4. **NSE requires primed cookies** from a home-page GET plus browser
   impersonation (`curl_cffi`). A single re-prime retry handles expiry.
5. **NSE spells the losers bucket `loosers`** in the variations endpoint.
6. **NSE's `allSec` mover list is dominated by penny stocks and rights
   entitlements.** The default universe is `gt20` and hyphenated symbols
   (`CENTEXT-RE`) are excluded — they are rights entitlements, not shares.
7. **Yahoo's quarterly series has gaps for Indian issuers.** Both GRSE and TCS
   are missing Q2 FY26. Summing "the last four quarters" would double-count a
   Q1 and skip a Q2, so ratios fall back to the latest full fiscal year and say
   so via `ratios.basis`.

## Rate limiting

Both upstreams are free and unofficial. Everything is served through an
in-process TTL cache (`app/cache.py`) which also serves the last good value if a
refresh fails, reporting its age rather than erroring.

## Quant engine notes

Everything under `/quant` and `/sensitivity` is estimated from real daily return
series (3 years, ~740 observations). A component that will not converge returns
`note` explaining why; nothing is back-filled.

- **Volatility ensemble** — GARCH(1,1), EGARCH(1,1), FIGARCH(1,d,1) and HAR-RV.
  Weights are inverse out-of-sample MSE over the final 20% of the sample, with
  each model fitted on the training window and evaluated with parameters frozen.
  Akaike weights were rejected: they need a common likelihood, and HAR-RV is an
  OLS fit on realised variance rather than a likelihood fit on returns.
- **VaR** — parametric (Gaussian), historical (empirical 1st percentile) and
  Monte Carlo (200k draws from a Student-t fitted to the same returns).
  Expected Shortfall is the empirical conditional mean beyond the *historical*
  VaR, and is reported as that matched pair. Comparing an ES computed under one
  distribution against a VaR computed under another is not meaningful, so no
  artificial ordering is imposed across methods.
- **Merton** — default point is current liabilities plus half of total debt (KMV
  convention), both from the reported balance sheet. Asset volatility uses the
  first-order approximation `sigma_A ~ sigma_E * E/V`.
- **Regime** — Hamilton two-state Markov switching with regime-dependent
  variance. States are labelled by fitted volatility, not by statsmodels' own
  numbering, which is arbitrary. The transition matrix is transposed to be
  row-stochastic and reordered to `[lowVol, highVol]`.
- **Forecasts** — AR(1) point estimates with split-conformal prediction
  intervals. The half-width is the 95th percentile of absolute residuals on a
  held-out calibration window, so it inherits the real tail rather than assuming
  a Gaussian one. Cumulative expectations use the closed form
  `h*mu + (r_t - mu) * phi(1 - phi^h)/(1 - phi)`.
- **Kyle's lambda and VPIN are not estimated.** They need tick-level order flow,
  absent from every free and retail feed. The response marks them illustrative
  with `null` values.

### Benchmarks with real history

Nifty 50, Nifty Next 50, Nifty 100, Nifty 500, Nifty Bank, Nifty IT, Nifty
Pharma, Nifty Midcap 50.

**Nifty Auto, Energy, Metal, FMCG, Realty and PSU Bank return a single row**
from Yahoo — there is no series to regress against, so they are not offered.
The response lists them under `unavailableBenchmarks`.

## IPO and news notes

### IPO pipeline
Issue facts come from NSE's own IPO desk: `/api/ipo-current-issue` (with
subscription multiples), `/api/all-upcoming-issues` and `/api/public-past-issues`
(~1,500 rows, filtered to EQ/BE/SME). Segment is read from the series field —
`SME` versus `EQ`/`BE`.

Listing performance is **reconstructed from real price history**: the first
traded session on or after the listing date gives the listing open and close,
and the latest session gives CMP. Only the most recent listings are enriched,
since each needs its own upstream request.

Two things cannot be populated and say so in the `unavailable` block:
- **Planning / DRHP stage** — filed with SEBI, not NSE, and exposed by no free API.
- **Grey-market premium** — an unofficial quote from a thin market that no
  exchange publishes.

### News
Two sources, kept distinguishable by the `kind` field because they carry very
different weight:
- `filing` — NSE corporate announcements. These *are* LODR disclosures, so that
  flag is always set. Further flags come from NSE's own category taxonomy
  ("Bagging/Receiving of orders/contracts", "Credit Rating", "Outcome of Board
  Meeting"), which is far more reliable than keyword-matching a headline.
- `press` — RSS from Moneycontrol, Economic Times and Livemint. Business
  Standard's markets feed returns zero entries and is excluded. Flags here come
  from keyword rules, since press items carry no category.

Tickers in press headlines are matched against the real listed universe.
Three characters is the floor (TCS, ITC and IOC are all real symbols), with
ordinary English words that happen to be tickers filtered via
`universe.AMBIGUOUS_SYMBOLS`. Company names are not matched — "Wipro" in a
headline will not tag WIPRO — because name matching produces false positives
that a ticker match does not.

### Search
Backed by NSE's published equity master CSV (~2,600 companies with symbol, name,
series and ISIN). Ranking is exact symbol, then symbol prefix, then name prefix,
then substring, so "TCS" surfaces Tata Consultancy Services rather than West
Coast Paper.

## Event impact analyzer

The CEIA engine is vendored in `backend/ceia/` and run as a subprocess per job (see
`app/services/analyzer.py`). It needs `torch` and `transformers` for FinBERT / GoEmotions. Fetch and verify the
models once with `python scripts/download_models.py`; with the packages installed they are
required (a missing model stops the run), and `ARTHDEX_ML=off` opts into the word-list
scorer. Status: `GET /api/v1/analyzer/models`.
Run output lives in `analyzer_data/` (gitignored); bundled sample reports are in
`analyzer_samples/`. Tuning: `ARTHDEX_ANALYZER_CONCURRENCY` (default 2) and
`ARTHDEX_ANALYZER_TIMEOUT` seconds (default 5400). Runs are stateful and not cached; the analyzer
responses are not wrapped in the provenance envelope.
