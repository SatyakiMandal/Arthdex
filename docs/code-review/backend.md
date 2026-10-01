# Backend review (`backend/app`)

Python FastAPI data service. Every file was read; import blocks and a few header sections were skimmed. Coverage codes: **R** read in full, **P** read in part, **S** skimmed, **T** tooling only. Verdicts: **OK** no defects found, **Watch** works but has weaknesses, **Fix** has a defect, **Dead** unused. Finding IDs link to [findings.md](findings.md).

## Entry point, configuration, cache, schemas

5 files · 251 lines · verdicts: OK 3, Watch 2 · coverage: R 5

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `backend/app/__init__.py` | 0 | R | OK | Empty. |
| `backend/app/cache.py` | 82 | R | Watch | Correct stale-on-failure semantics and a lock around the dict. No single-flight, no max size, keys include user input, `expire()` keeps the value (good) (F-15). It cannot help when fetchers swallow their own errors (F-12). |
| `backend/app/config.py` | 44 | R | OK | Small frozen dataclass of TTLs and settings. Only two TTLs are env-driven; the rest are constants here or inline in routers. Reasonable. |
| `backend/app/main.py` | 89 | R | Watch | Wires 11 routers, CORS, startup recovery/seeding and a background IPO pre-warm. `@app.on_event` is deprecated (use lifespan); `_prewarm()` starts a thread at import time, so `--reload` and tests start it twice (F-34). CORS is localhost-only, which is fine because the browser never calls this service (F-05 for the auth gap). |
| `backend/app/schemas.py` | 36 | R | OK | `envelope()` is the provenance contract. Note `fetchedAt` is the response time, not the upstream fetch time, so the badge tooltip 'fetched …' is slightly misleading; `PageStamp` correctly subtracts the cache age. |

## Routers (HTTP surface)

Thin handlers: validate, call the cache, wrap in the envelope, translate errors to 404/503.

12 files · 1,090 lines · verdicts: Fix 4, OK 3, Watch 5 · coverage: R 12

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `backend/app/routers/__init__.py` | 0 | R | OK | Empty. |
| `backend/app/routers/analyzer.py` | 187 | R | Fix | Pydantic validation is good (ticker/url patterns, date span). Snapshots bypass the queue cap, delete/clear are open (F-05). Unused imports `timedelta` and `CACHE` (ruff). |
| `backend/app/routers/bhavcopy.py` | 37 | R | OK | Clear date handling; 404 for non-trading days; analysis cached by session. |
| `backend/app/routers/company.py` | 231 | R | Watch | Consistent envelope/404/503 handling and a `_yahoo` helper. The 404 rule at line 113 lets 'no quarterly but has balance sheet' through (see F-06). `symbol` path values are not validated against the universe, so unknown symbols create cache entries (F-15). |
| `backend/app/routers/health.py` | 50 | R | Fix | `POST /cache/refresh` accepts an empty-string prefix that matches every key, and has no auth (F-05). `/health` and `/cache` are not called by the website (F-32). |
| `backend/app/routers/ipo.py` | 62 | R | Watch | Fine. `GET /ipo/{issue_id}` has no consumer (F-32). |
| `backend/app/routers/market.py` | 113 | R | Fix | Movers handler calls `bhavcopy.latest_session()`/`delivery_map()` on every request outside the cache (F-16). Indices/global/commodities handlers are clean. |
| `backend/app/routers/news.py` | 58 | R | Watch | Caches the whole feed then filters; company filter only sees the latest market-wide filings (F-17). |
| `backend/app/routers/quant.py` | 107 | R | Watch | Orchestration is clear; the microstructure placeholder contradicts the dossier (F-21). A 'no return history' ValueError becomes 503 rather than 404. |
| `backend/app/routers/screener.py` | 123 | R | Fix | MACD route caches per (index, interval, direction, within), re-downloading data for each combination (F-18). Factor/movers share one cached universe download (good). |
| `backend/app/routers/search.py` | 78 | R | Watch | Merges listed and unlisted results without making a keystroke wait on the unlisted build (good). Unbounded `q` length; ranking truncation lives in `providers/universe.py` (F-08). |
| `backend/app/routers/unlisted.py` | 44 | R | OK | Slug validated by regex before use; 404 vs 503 distinguished; envelope with an honest note. |

## Providers (upstream access)

Yahoo (yfinance), NSE JSON and CSV archives, RSS, universe and constituents.

7 files · 1,157 lines · verdicts: Fix 5, OK 2 · coverage: R 7

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `backend/app/providers/__init__.py` | 0 | R | OK | Empty. |
| `backend/app/providers/constituents.py` | 49 | R | OK | Simple CSV reader; unknown index silently becomes nifty100 (routers validate first); no retry. |
| `backend/app/providers/fundamentals.py` | 322 | R | Fix | The contiguous-quarter guard is a good piece of engineering. Missing debt is treated as 0 (line 135, F-13/F-19); FY label assumes a March year-end; ROE/ROCE are not meaningful for banks; NOPAT uses a flat 25%. |
| `backend/app/providers/nse.py` | 341 | R | Fix | Good defensive parsing and the 'loosers' quirk is handled. Shared global session and re-prime stampede (F-14); universe fallback silently substitutes `SecGtr20` for a missing universe key (line 194); `or 0.0` on change (F-13). |
| `backend/app/providers/rss.py` | 79 | R | Fix | No timeout on `feedparser.parse`, silent failure, missing dates stamped 'now' (F-17). |
| `backend/app/providers/universe.py` | 114 | R | Fix | Early break at 400 matches before ranking (F-08); imports a private name from `nse` (F-38). |
| `backend/app/providers/yahoo.py` | 252 | R | Fix | Handles Yahoo's NaN last row and mixed percent conventions well. Missing values fall back to the price or 0 (F-13); profile/valuation swallow errors and get cached (F-12); `fast_info.get` is outside the try block (F-34). |

## Services (computation)

Quant, screeners, technicals, Bhavcopy, IPO, news, shareholding, unlisted and the analyzer run manager.

17 files · 4,726 lines · verdicts: Fix 5, OK 4, Watch 8 · coverage: R 17

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `backend/app/services/__init__.py` | 0 | R | OK | Empty. |
| `backend/app/services/analyzer.py` | 759 | R | Fix | Solid design: subprocess isolation, argv list (no shell injection), run-id regex, atomic meta writes, restart recovery. Races and resource issues in F-23; unbounded snapshot queue (F-05). |
| `backend/app/services/analyzer_detail.py` | 245 | R | Watch | Passes engine blocks through under their own names; `slim()` silently truncates every list to 40 items and drops `_BULKY_KEYS`, including any long numeric series not on that list. |
| `backend/app/services/analyzer_extra.py` | 203 | R | Fix | Recomputes sections the engine normally stores, inventing inputs when absent (F-03); global `np.random.seed`; recomputed per request (F-23). |
| `backend/app/services/bhavcopy.py` | 183 | R | Watch | Good band-close rule (move and close at the extreme). Network on the hot path (F-16), no TTL on day files (F-15), different HTTP stack/User-Agent from the NSE provider (F-39). |
| `backend/app/services/commodities.py` | 122 | R | Watch | Correct INR conversions (31.1034768 g/oz). Continuous front-month series include roll jumps and are not flagged; `except Exception: insights = None` hides bugs (F-12). |
| `backend/app/services/indicators.py` | 199 | R | OK | Textbook implementations (Wilder RMA, Supertrend ratchet, ADX). Minor: RSI of a flat series is 100 rather than undefined; Wilder smoothing is seeded with the first value rather than an SMA, so early bars differ slightly from charting tools. |
| `backend/app/services/insights.py` | 447 | R | Watch | Rule-based findings, each tied to a number shown beside it. Interpretive sentences ('Buyers were more willing to hold...') read as facts; a missing delivery figure would print 'nan%' in the Bhavcopy headline; if no commodity has 1M data the headline format raises (swallowed by the caller). |
| `backend/app/services/ipo.py` | 264 | R | OK | Listing performance is reconstructed rather than quoted, with explicit 'unavailable' declarations. Gain is measured against the upper price band and the listing *close* (documented in the methods doc). Recent SME listings often have no Yahoo history and stay unenriched. |
| `backend/app/services/news.py` | 174 | R | Fix | Ordering by ISO string with mixed offsets, 'None' in headlines, counts of unfiltered feed (F-17). Flag taxonomy and syndication de-duplication are sensible. |
| `backend/app/services/quant.py` | 444 | R | Fix | Careful statistics (frozen-parameter out-of-sample evaluation, correct cumulative AR(1) expectation, row-stochastic transition matrix). Issues: Merton barrier/asset-value inconsistency (F-19), interval/confidence claims (F-20), global warning filter (F-36), 'KMV' labelling, `df` clamp without refit. The 80/20 split MSE on squared returns is noisy (weights end up near-uniform, as the build log shows). |
| `backend/app/services/screener.py` | 190 | R | Watch | Sound regression maths and a MIN_OVERLAP guard. Empty download is returned (and cached) instead of raised (F-12); gainers/losers can overlap; `highVolatility` is really beta; 52-week = closing range (F-34); global warning filter (F-36). |
| `backend/app/services/sensitivity.py` | 149 | R | OK | Correct OLS (statsmodels), minimum 120 observations, honest list of unavailable benchmarks. `annualised_vol_pct` is unused (F-32). |
| `backend/app/services/shareholding.py` | 297 | R | Fix | Each source is guarded independently (good). `&` in symbols (F-09), integer parser (F-25), `yearly: {}` (F-07), 'free float' = everything except promoters, scraping with a spoofed UA (F-39). |
| `backend/app/services/technicals.py` | 364 | R | Watch | Clear signal logic and a well-reasoned MACD cross rule (a reversed cross is dropped). Hard-codes `.NS` (no BSE); unused `numpy` import; global warning filter (F-36); screener cost structure (F-18). |
| `backend/app/services/unlisted.py` | 304 | R | Watch | Careful parsing and a non-blocking directory warm-up. HTML regexes will break silently if the source changes; a failed warm-up retries on the next keystroke without backoff; imports a private regex from the engine (F-38). Source decision left unchanged per owner. |
| `backend/app/services/yahoo_company.py` | 382 | R | Watch | Thorough reshaping with unit conversion and null-preserving helpers. Some Yahoo calls outside try (analysts), MAX history truncated to 1,500 rows silently (F-34). |

## What the backend does well

- **Provenance as a contract.** Every payload is wrapped by `envelope()`; delayed, stale and illustrative data are labelled rather than hidden.
- **Defensive upstream handling.** The Yahoo NaN row, mixed percent conventions, NSE cookie priming, the `loosers` spelling and gapped quarterly series are all handled and commented. `_contiguous_tail` refusing to sum non-consecutive quarters is a good example of correctness over convenience.
- **Statistics done carefully.** Frozen-parameter out-of-sample evaluation for the volatility ensemble, the cumulative AR(1) expectation formula, row-stochastic regime matrix, empirical ES paired with historical VaR, minimum-overlap guards on regressions.
- **Safe subprocess use.** The analyzer launches the engine with an argv list (no shell), validates run ids with a regex, writes metadata atomically, recovers interrupted runs at startup and serves reports with a sandbox CSP.
- **Static checks are nearly clean.** `ruff` (rules F, B, S, PLE, PLW) reports 18 minor items in `backend/app`: unused imports in `routers/analyzer.py` and `services/technicals.py`, `zip()` without `strict=`, module-level `global` statements, and one expected `subprocess` note.

## Themes to act on

1. **Failure handling** (F-12, F-13): fetchers should raise, the cache should fall back to stale data, and every fallback should be logged.
2. **Concurrency and cost** (F-14, F-15, F-16, F-18, F-23): add single-flight, bound the caches, stop doing network I/O outside cached sections, and restructure the MACD cache.
3. **Statistical honesty** (F-19, F-20, F-21): tighten the Merton inputs and the wording of interval and confidence claims.
4. **Security** (F-05): add authentication or at least a shared secret and rate limits before exposing the service beyond localhost.

## Addendum: files added or changed after the first review (2026-10-02)

Findings are in [addendum-2026-10-02.md](addendum-2026-10-02.md). Coverage **R** for every file below.

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `backend/app/routers/desk.py` | 350 | R | Watch | New. Deals, calendar, watchlist snapshot, movers explained (per-symbol NSE filings, routine notices dropped, last four days), data status, pre-IPO lookup. All read from caches or fetch through the cache. Sequential NSE calls because the session is not thread-safe (F-42); fan-out endpoints are unauthenticated (F-41). |
| `backend/app/routers/search.py` | 70 | R | OK | Now merges the unlisted directory into results, only if already built, so a keystroke never waits on a cold build. |
| `backend/app/routers/analyzer.py` | 110 | R | Watch | Search is `kind=any` by default and keeps at least three unlisted slots. Two unused imports remain (`timedelta`, `CACHE`). |
| `backend/app/routers/unlisted.py` | 45 | R | OK | Directory and company routes; the company route adds a `lifecycle` block (listed symbol, IPO status) read from caches only. |
| `backend/app/services/unlisted.py` | 330 | R | Watch | New. Directory and company-page parsing by regular expression (duplicated in the engine, F-45), non-blocking `cached_directory`, `ensure_warm` with a flag lock, name normalisation and lifecycle matching (ISIN first, then name; F-44). Price 0 is treated as no price. |
| `backend/app/services/analyzer.py` | 900 | R | Watch | Writes a `context.json` for unlisted runs (sector, the page's ratios, live NSE index multiples) and reports a missing research layer as a note rather than an old-run message. `_verdict_view` is now shared by listed and unlisted summaries. Earlier findings F-23 and the two ambiguous names stand. |
| `backend/app/main.py` | 95 | R | Watch | Registers the desk router; the unlisted warm-up thread is started from a startup hook. Same F-34 caveat about import-time threads. |
| `backend/tests/test_unlisted_research.py` | 170 | R | OK | 16 `unittest` cases, no network. First tests in the repository (F-49). |
