# Findings catalogue

Every finding in the review, ordered by severity. IDs (`F-nn`) are referenced from the per-file tables in [backend.md](backend.md), [frontend.md](frontend.md) and [engine.md](engine.md). Line numbers refer to the repository at commit `788c016` plus the working tree at review time; re-check them after edits.

> **Second pass, 2026-10-02.** F-40 to F-49 and the changes to F-01, F-05, F-10, F-14, F-15 and F-29 are recorded in [addendum-2026-10-02.md](addendum-2026-10-02.md). In short: F-01 now also covers the unlisted call, F-05 also covers the new desk endpoints, F-10 is still open for the old alerts card, F-29 is partly addressed by 16 new tests.

**Severity:** *High* = wrong or unsafe behaviour a user or operator would hit, or a legal/integrity problem. *Medium* = real bug or weakness with a workaround or limited blast radius. *Low* = polish, edge cases, robustness. *Info* = observation.


## High

### F-01 · The product issues buy/sell calls, price targets, stop-losses and rupee position sizes

**Severity:** High · **Category:** Compliance

**Where:** backend/ceia/investment_verdict.py:357-376, 389-449, 457-466; components/analyzer/dossier/call-tab.tsx:15-33, 82-135; key-strip.tsx:20-34

**What:** The Analyzer's Call tab and key strip show STRONG BUY / BUY / HOLD / REDUCE / SELL, an entry zone, Target 1 and 2, a hard stop, a risk/reward ratio, a 'prescribed' allocation and share counts for ₹10 lakh, ₹25 lakh and ₹1 crore portfolios, plus 'immediate mandatory exit' rules. The footer and the card footnote say the output is not advice and that Arthdex is not SEBI-registered.

**Impact:** Under Indian rules, publishing specific recommendations with targets and sizing to the public can fall under investment-adviser or research-analyst registration regardless of disclaimers. This is a product and legal risk, not a code defect, and this review is not legal advice. It also compounds F-02: the numbers behind the call are partly constants.

**Fix:** Get a qualified opinion before launch. Options: remove the call/targets/sizing and keep descriptive analytics; reframe as 'model scores' with no prescriptive language; or register. Whatever is chosen, keep UI wording consistent with the footer.

### F-02 · Verdict inputs are defaulted or invented, and parts of the explanation text are unconditional

**Severity:** High · **Category:** Integrity

**Where:** backend/ceia/investment_verdict.py:170, 200, 215-218, 267-273, 318-335, 360-376, 397-421

**What:** (a) Missing ROE defaults to 20, missing distance-to-default to 5.0σ, missing 1-day VaR to -2.8%; missing technicals add +20 and print 'Constructive Trend: asset maintains support above long-term EMAs'. (b) Pillar 5's evidence always reads 'Extremely low structural default probability ... ensures institutional solvency cushion', even when DD is below 2.5. (c) The ADX in the technical evidence is always 25.0 (`getattr(dict, 'adx', {})` returns {} for a dict, and the non-dict branch is a literal). (d) Target 1 is clamped to +8% to +22% and is +14.5% whenever DCF upside is 5% or less, so even a SELL prints targets above the price. (e) Kelly uses an expected return of 18% × conviction and a volatility taken from the 1-day 99% VaR (about 2.3σ) as if it were σ. (f) Any BUY is floored at 3% allocation and any HOLD at 1.5%. (g) The one-line summaries claim reasons (valuation, fundamentals, technicals) that are not tied to what drove the score. (h) The risk pillar has no 'Strong Bearish' branch.

**Impact:** The most prominent output of the site is partly fabricated. This breaks the project's own rule that nothing is back-filled, and a user cannot tell which parts are real.

**Fix:** Return 'Not assessed' for missing inputs (the macro and event pillars already do this) and re-weight; generate evidence text from the actual value; derive targets from model outputs or drop them; compute Kelly from a stated edge and a real σ or remove it; remove allocation floors.

### F-03 · Dossier recomputation invents book equity, net income, beta and uses a different risk-free rate

**Severity:** High · **Category:** Integrity

**Where:** backend/app/services/analyzer_extra.py:85-99, 102-103, 107, 157-162

**What:** When an analysis lacks a stored valuation suite (older runs, the bundled samples), the service rebuilds it with book equity = max(₹100, 40% of market cap) if absent, net income = 6% of market cap if absent, beta = 1.0 if absent, risk-free = 6.8% (the rest of the site uses 6.5%), and annualises the latest quarter ×4. The execution simulator is fed a fixed ₹1 crore order and a fixed 2% daily volatility. `np.random.seed(42)` mutates the global RNG of the API process.

**Impact:** DCF, scenarios and Monte Carlo are presented on the Valuation tab as the company's, but depend on invented inputs. The 2% volatility and 6.8% rate are disclosed in footnotes; the book-equity and net-income inventions are not.

**Fix:** Return `None` (the tab already has an empty state) when inputs are missing; share one risk-free constant; use `np.random.default_rng(42)` locally; cache the computed suite per run.

### F-04 · The engine's HTTP cache never expires and also stores error responses

**Severity:** High · **Category:** Reliability

**Where:** backend/ceia/fetcher.py:159-164, 221-248, 264-291; callers in ceia/macro.py (10 sites) and ceia/financials.py (3 sites) never pass force=True

**What:** `Fetcher.get` returns any file found in `cache/http/<host>/<sha256>.json` with no age or status check, and it writes whatever came back (including 403/404/429/5xx once the retries are used up). Macro series (RBI repo, CPI, GDP, PMI, yields, reserves, fiscal deficit) and screener.in fundamentals are 'latest snapshot' pages fetched through it.

**Impact:** After the first fetch, every later analysis reuses the same macro and fundamentals page until someone deletes the cache, so 'latest' values silently go stale. A transient 429 or 503 is stored and then served forever for that URL. Cache files are written non-atomically and read outside the origin lock, so a concurrent reader can hit a half-written file.

**Fix:** Add per-host TTLs (hours for snapshot pages, long for article pages), never cache status >= 400 (or cache briefly), write via temp file + rename, and add a `max_age` argument to `get`.

### F-05 · No authentication anywhere, with cheap abuse paths and cross-site POSTs

**Severity:** High · **Category:** Security

**Where:** backend/app/routers/analyzer.py:78-92, 118-129, 132-152; backend/app/services/analyzer.py:135-163; backend/app/routers/health.py:36-52; app/api/analyzer/[...path]/route.ts:14-21, 39

**What:** Every route is open. `POST /analyzer/snapshots/{symbol}` is not subject to the 8-run cap (only origin=run is counted), so a script can queue a thread and later a torch subprocess for each of ~2,600 symbols. `POST /cache/refresh` with `prefixes: [""]` expires every entry older than 10 s (an empty prefix matches all keys), forcing upstream re-fetches. Run delete/cancel/clear are open to all. The Next proxy forwards the body of any POST regardless of the caller's content type, so a cross-site `text/plain` form post can create runs against a developer's localhost or an intranet deployment.

**Impact:** Resource exhaustion, upstream bans (NSE/Yahoo throttle by IP), and loss of other users' runs. Acceptable only for a single-user local tool.

**Fix:** Add auth or a shared secret between Next and the backend, bind the backend to localhost/a private network, rate-limit per IP, count snapshots in the queue cap, reject empty prefixes, require `Content-Type: application/json` and an Origin/Sec-Fetch-Site check in the proxy.

### F-06 · Company overview page crashes when quarterly statements are missing

**Severity:** High · **Category:** Correctness

**Where:** components/company/fundamentals.tsx:18-25; components/ui/data-card.tsx:33; backend/app/routers/company.py:113

**What:** `QuarterlyPnLPanel` renders `<DataCard icon={undefined as never}>` for an empty quarterly list. `DataCard` always renders `<Icon .../>`, so React throws 'Element type is invalid'. The backend only returns 404 when both quarterly and balance sheet are empty, so a company with an annual/balance sheet but no quarterlies reaches this path (Yahoo's Indian coverage often has such gaps).

**Impact:** The whole `/company/[symbol]` overview fails for those tickers; there is no error boundary (F-11).

**Fix:** Make `icon` optional in `DataCard` (or pass a real icon) and add a test for the empty-quarterly case.


## Medium

### F-07 · Shareholders tab crashes on 'Yearly' when screener.in has no yearly table

**Severity:** Medium · **Category:** Correctness

**Where:** components/shareholding/shareholding-view.tsx:89-93, 139; lib/api/types.ts:523; backend/app/services/shareholding.py:85

**What:** The backend sends `yearly: {}` when only one table is present; the type says `yearly: ShareholdingTable` (labels required). `StackedHistory` reads `t.labels.length`, which is undefined for `{}`.

**Impact:** Toggling to Yearly throws and blanks the tab.

**Fix:** Return `null` for a missing table, type it as optional, and render an empty state.

### F-08 · Search truncates before ranking, so short queries miss the best matches

**Severity:** Medium · **Category:** Correctness

**Where:** backend/app/providers/universe.py:63-102 (the break is line 99)

**What:** The loop stops after 400 matches in file (alphabetical) order and only then sorts by rank. For a 1-3 letter query most rows match by name substring, so the first 400 are reached long before later symbols that match by symbol prefix (for example 'TA' would not reach TATA*; the NSE master file is ordered by symbol).

**Impact:** The header search, the alerts picker and the analyzer search return poor results for short input.

**Fix:** Rank every row (it is only ~2,600) or keep top-k with a heap; drop the early break.

### F-09 · Symbols containing '&' (M&M, J&KBANK, S&SPOWER ...) break several calls

**Severity:** Medium · **Category:** Correctness

**Where:** components/technicals/technical-workbench.tsx:48; components/alerts/alerts-workbench.tsx:105; backend/app/services/shareholding.py:91-92, 116-117, 143-144; app/api/analyzer/[...path]/route.ts:18 with components/company/research-panel.tsx:34

**What:** Query strings are built without `encodeURIComponent`, so `symbol=M&M` becomes `symbol=M`. The NSE pledge/SAST/PIT calls interpolate the symbol into the query unencoded. The analyzer proxy allow-list for snapshots is `[A-Za-z0-9._-]+`, which rejects '&'. (The technicals proxy regex explicitly allows '&', so the intent was there.)

**Impact:** Technicals, alert values, shareholder filings and the Research tab fail or return another company's data for these tickers.

**Fix:** Encode every interpolated value (`encodeURIComponent` on the client, `urllib.parse.quote` on the server); allow '&' in the snapshot route.

### F-10 · Alerts picker now offers unlisted companies with an empty symbol

**Severity:** Medium · **Category:** Correctness

**Where:** components/alerts/alerts-workbench.tsx:10-13, 83-93, 190-208

**What:** After search became unified (listed + unlisted), `/api/search` returns items with `kind: 'unlisted'` and `symbol: ''`. The picker's `Hit` type ignores `kind`, keys on `symbol` (duplicate empty keys) and passes the empty symbol to `/api/metric`.

**Impact:** Picking an unlisted result yields an alert on a blank symbol and React key warnings.

**Fix:** Filter to `kind === 'listed'` or pass `kind` through; use `href`/`id` as the key.

### F-11 · No error boundaries and loosely typed analyzer payloads

**Severity:** Medium · **Category:** Reliability

**Where:** app/ (no error.tsx or global-error.tsx); types/analyzer.ts `Blk = Record<string, any>`; components/analyzer/dossier/*.tsx

**What:** Any thrown render error (F-06, F-07, a `.toFixed` on null from a changed API) blanks the page. Dossier blocks are typed `any` and API responses are not validated at runtime.

**Impact:** Small upstream shape changes become white screens.

**Fix:** Add `app/error.tsx`, `app/company/[symbol]/error.tsx`, `app/analyzer/error.tsx`; validate API payloads (zod/valibot) at the `apiGet` boundary or narrow `Blk` per block.

### F-12 · Failures are swallowed inside fetchers and then cached as successes

**Severity:** Medium · **Category:** Integrity

**Where:** backend/app/providers/yahoo.py:164-189, 229-251; backend/app/services/screener.py:75-77; backend/app/services/commodities.py:117-121; backend/app/providers/rss.py:55-60

**What:** `fetch_profile` and `fetch_valuation` catch every exception and return placeholder dicts ('Unclassified', all-null), which the router caches for 24 h. `build_universe_stats` returns an empty result instead of raising, cached for 1 h. Commodity insights and RSS feeds drop exceptions silently. Only 3 backend modules use `logging` at all.

**Impact:** A one-minute upstream hiccup shows blank panels for a day, and the stale-on-failure cache never engages because the call 'succeeded'. There is nothing in the logs to diagnose it.

**Fix:** Raise from fetchers, let `CACHE.get_or_fetch` fall back to stale values, and log with `logging` wherever a fallback is taken.

### F-13 · 'Null is never zero' is violated in several places

**Severity:** Medium · **Category:** Integrity

**Where:** backend/app/providers/yahoo.py:147-158; backend/app/providers/nse.py:152-153, 213; backend/app/providers/fundamentals.py:135; backend/app/services/quant.py:277-279; components/quant/risk-suite.tsx:65, 78, 89; components/quant/return-forecasts.tsx:43-45; components/analyzer/dossier/call-tab.tsx:24; validation-tab.tsx:26

**What:** Quote fields fall back to the last price (open, day high/low, 52-week high/low) or 0.0 (change, market cap); missing debt becomes 0 in the balance sheet and the Merton barrier; advances/declines become 0; forecasts and gauges treat null as 0.

**Impact:** A 52-week band collapsed to the price, a debt-free balance sheet and a 0% forecast are indistinguishable from real data. The company header hides a 0 market cap, but nothing else does.

**Fix:** Return null and let the UI print the dash; make the Merton function refuse when either leg is missing.

### F-14 · NSE session handling is not thread-safe and can stampede

**Severity:** Medium · **Category:** Reliability

**Where:** backend/app/providers/nse.py:22, 25-49, 52-86

**What:** One global `curl_cffi` session is shared by all request threads and by the IPO enrichment pool. Any retry replaces the global session (`force_new=attempt > 0`) while other threads are mid-request, and priming happens under a lock that blocks every NSE caller. A burst of failures causes repeated home-page hits. The last attempt also sleeps before raising.

**Impact:** Under load NSE endpoints fail together and the site's own retries make throttling worse.

**Fix:** Per-thread sessions or a session pool; re-prime at most once per N seconds; jittered backoff; no sleep after the final attempt.

### F-15 · The TTL cache has no single-flight, no size bound and unbounded key cardinality

**Severity:** Medium · **Category:** Performance

**Where:** backend/app/cache.py:43-62; backend/app/services/bhavcopy.py:48-57; backend/app/routers/company.py (symbol-keyed entries)

**What:** N concurrent requests for a cold key run the expensive fetch N times (quant fits four models, screeners download 100 tickers, the IPO pipeline is about a minute). Keys are built from user-supplied symbols and dates, including unknown symbols (`None` is cached), and nothing is ever evicted. Bhavcopy day files are cached with no TTL for the process lifetime.

**Impact:** Duplicate heavy work and slow memory growth; trivial to inflate with random symbols.

**Fix:** Per-key locks with a shared future, a max-entries LRU, validate symbols against the universe before caching.

### F-16 · `/market/movers` does network I/O outside its cache on every request

**Severity:** Medium · **Category:** Performance

**Where:** backend/app/routers/market.py:69-86; backend/app/services/bhavcopy.py:55-66

**What:** After the cached NSE call, the handler calls `bhavcopy.latest_session()` and `delivery_map()` every time. On a trading day before the file is published, `load_day(today)` makes an HTTP request that 404s (misses are deliberately not cached) on each call.

**Impact:** Extra round trips (25-second timeout) on the hottest endpoint, hit by the landing page and market watch.

**Fix:** Cache `latest_session` for a few minutes and the delivery map with it; cache misses briefly.

### F-17 · News feed ordering, scope and error reporting

**Severity:** Medium · **Category:** Correctness

**Where:** backend/app/services/news.py:122, 165, 169-173; backend/app/providers/nse.py:261-266; backend/app/providers/rss.py:42-49, 55-60; backend/app/routers/news.py:29-46

**What:** (a) Sorting is by the ISO string; filings carry +05:30 and press +00:00, so items within 5.5 hours interleave wrongly. (b) Company news filters the market-wide latest 80 filings (`index=equities` without a symbol), so a company's tab is usually empty. (c) `feedparser.parse` has no timeout and swallows failures, so a dead feed is never reported in `errors`. (d) Counts describe the unfiltered feed. (e) Items without a date are stamped 'now' and float to the top. (f) A filing with no subject renders 'Company: None'.

**Impact:** The Macro & News tab and the news page under-deliver and can be slow.

**Fix:** Parse to UTC datetimes before sorting; use the symbol-specific announcements endpoint; fetch feeds with `requests` and a timeout; report per-feed status.

### F-18 · MACD screener multiplies upstream downloads

**Severity:** Medium · **Category:** Performance

**Where:** backend/app/routers/screener.py:92-120 (key at 113); components/technicals/macd-screener.tsx:46-62, 99-112

**What:** The cache key includes `within` and `direction`, and every distinct key re-downloads 50-200 symbols of intraday bars from Yahoo. On the client, each +/- click or keystroke in the number box fires a request immediately (aborting the fetch does not stop the backend job).

**Impact:** Clicking '+' ten times can trigger ten full-universe downloads, the quickest way to get rate-limited by Yahoo.

**Fix:** Cache the downloaded bars per (index, interval) and filter by direction/within in memory; debounce the client.

### F-19 · Merton barrier and asset value are inconsistent and mislabelled

**Severity:** Medium · **Category:** Correctness

**Where:** backend/app/services/quant.py:277-302; backend/app/providers/fundamentals.py:135-151

**What:** The barrier is current liabilities + 50% of total debt. KMV is usually stated with short-term debt; using all current liabilities (which include trade payables and customer advances) is a more conservative choice, notably for shipbuilders and EPC firms, and is not flagged as such. Asset value is market cap + debt and omits the operating liabilities that sit in the barrier, so the two sides are inconsistent. Missing legs are treated as 0. The drift is a hard-coded 8%.

**Impact:** Distance to default is biased low for payables-heavy companies, can be overstated when a leg is missing, and the card is labelled 'KMV convention'.

**Fix:** Decide the barrier definition and state it; keep asset value and barrier on the same basis; refuse to compute when legs are missing; expose the drift.

### F-20 · Multi-horizon 'conformal' intervals and 'confidence' are looser than described

**Severity:** Medium · **Category:** Integrity

**Where:** backend/app/services/quant.py:379-444 (418, 428, 432); components/quant/return-forecasts.tsx:37-39

**What:** Only the 1-step interval is calibrated. 5D and 21D widths are `q95 × √h`, a Gaussian-style scaling, yet the card says '95% split-conformal'. Coverage also assumes exchangeable residuals, which volatility clustering violates. 'Signal confidence' is an arbitrary mapping 40 + 45 × min(1, 4 × |drift|/width) clamped to 35-85 (the lower clamp is unreachable).

**Impact:** The numbers look like calibrated probabilities but are not.

**Fix:** Calibrate each horizon on h-step residuals (or label the extrapolation), and either drop the confidence percentage or document it as a heuristic score.

### F-21 · Microstructure is 'not estimated' on one tab and estimated on another

**Severity:** Medium · **Category:** Integrity

**Where:** backend/app/routers/quant.py:56-64; components/quant/regime-card.tsx:114-148; components/analyzer/dossier/risk-tab.tsx:94-114; backend/ceia/microstructure.py

**What:** The Quant Engine tab says Kyle's λ and VPIN need tick data and are not estimated. The Research dossier shows Kyle's λ, VPIN and a 'liquidity grade' computed by the engine from OHLCV/intraday bars with bulk volume classification.

**Impact:** Two tabs of one site disagree about whether the numbers exist, and the dossier does not say they are proxies.

**Fix:** Label the dossier values as proxy estimates and state the data they use, or hide them.

### F-22 · Rate differential is shown with the wrong sign

**Severity:** Medium · **Category:** Correctness

**Where:** components/analyzer/dossier/macro-tab.tsx:31-35; backend/ceia/macro.py:599

**What:** The engine stores `us_india_rate_differential_bps = (repo - fed) × 100`, i.e. India minus US (the verdict code uses it that way). The tab negates it and labels it 'India minus US'.

**Impact:** The displayed differential has the opposite sign to the value used in scoring.

**Fix:** Remove the negation (and rename the field in the engine).

### F-23 · Analyzer service: races, duplicated work and platform quirks

**Severity:** Medium · **Category:** Reliability

**Where:** backend/app/services/analyzer.py:135-163 (ensure_snapshot), 297-355 (_worker), 393-402 (cancel), 78-97 (_write_meta/read_meta), 106 (list_runs), 506 (summarise); backend/app/services/analyzer_extra.py:62-139

**What:** (a) `ensure_snapshot` checks then submits without a lock, so two requests start two runs. (b) `cancel` before the subprocess exists marks CANCELLED but the worker still spawns the engine. (c) `_write_meta` replaces the file atomically but `read_meta` is outside the lock; on Windows `os.replace` can fail with PermissionError when a poller has the file open. (d) `proc.kill()` does not kill child processes. (e) `list_runs(limit=10_000)` re-reads every meta.json on each Research tab open. (f) `summarise()` re-parses analysis.json and recomputes DCF, a 1,000-path Monte Carlo and factor models on every request, in the request thread.

**Impact:** Sporadic 500s while polling, duplicate runs, wasted CPU.

**Fix:** Per-symbol lock, re-check status after the semaphore, read under the lock (or retry), cache the summary on disk next to analysis.json.

### F-24 · NameErrors in the engine's error paths

**Severity:** Medium · **Category:** Correctness

**Where:** backend/ceia/financials.py:331, 373; backend/ceia/pdf_report.py:847

**What:** `log` is used but never defined in `financials.py` (the `except` handlers in peer discovery raise NameError instead of falling back to the peer table). `fit_multi_factor_model` is undefined in `pdf_report.py` and is hidden by a bare `except`. ruff also reports 36 undefined names overall; most are `Any` in postponed annotations and harmless.

**Impact:** A screener hiccup during peer discovery aborts the run instead of using the fallback cohort.

**Fix:** Add `log = logging.getLogger(__name__)`, import the missing function, and enable `F821` in CI.

### F-25 · Integer parser strips decimal points (needs verification against live payloads)

**Severity:** Medium · **Category:** Correctness

**Where:** backend/app/services/shareholding.py:42-44, 100-101, 126-128, 156-157

**What:** `_int('1234567.50')` removes every non-digit and returns 123456750. NSE fields such as `secVal` and share counts are parsed with it. Whether NSE sends decimals was not confirmed in this review.

**Impact:** If decimals are present, insider trade values and share counts are inflated 100×.

**Fix:** Parse with `float()` after removing commas, then round.

### F-26 · Chart components re-mount on hover and trap touch scrolling

**Severity:** Medium · **Category:** Performance

**Where:** components/technicals/indicator-chart.tsx:151-162; components/company/price-chart.tsx:232

**What:** `PaneShell` is declared inside `IndicatorChart`, so every hover re-render creates a new component type and React re-mounts every pane's SVG. The price chart sets `touch-none`, which prevents vertical page scrolling when a finger starts on the chart.

**Impact:** Laggy crosshair on the technicals tab; on phones the chart is a scroll trap.

**Fix:** Hoist `PaneShell` out of the component (or call it as a function); use `touch-pan-y` like the other charts.

### F-27 · Two parallel type systems, one of them dead

**Severity:** Medium · **Category:** Maintainability

**Where:** types/{common,market,ticker,financials,quant,ipo,macro}.ts vs lib/api/types.ts

**What:** The mock-era contracts in `types/` are only imported for three alert types; everything else (Ipo, QuantBundle, MarketIndex, SearchResult, PriceSeries ...) is unused and duplicates `lib/api/types.ts`.

**Impact:** Readers cannot tell which contract is real.

**Fix:** Delete the unused files and move `CustomAlert`, `AlertCategory`, `AlertComparator` next to their only consumer.

### F-28 · Daily price cache is cwd-relative, caches company series, and uses pickle

**Severity:** Medium · **Category:** Reliability

**Where:** backend/ceia/prices.py:284-309

**What:** Files go to `Path('cache/prices_day')` relative to the process cwd (backend/ in the API process, analyzer_data/ in the subprocess). The key includes the date but not the time, so a series fetched mid-session is reused after the close; this applies to company tickers as well as indices. Frames are stored with `pandas.read_pickle`/`to_pickle`.

**Impact:** Same-day re-runs use stale last bars; unpickling a tampered file executes code.

**Fix:** Absolute cache dir from settings; short TTL for the current day; use parquet/CSV.

### F-29 · No automated tests and no CI

**Severity:** Medium · **Category:** Testing

**Where:** repository

**What:** There are no test files or CI configuration. Verification so far was manual plus `tsc`, `next lint` and `next build`.

**Impact:** Findings such as F-06, F-07, F-09 and F-22 are the kind a handful of unit/contract tests would have caught.

**Fix:** Add pytest for the pure functions (indicators, ratios, parsers, ranking) and Playwright smoke tests for each route; run tsc, lint, ruff and tests in CI.


## Low

### F-30 · Excel writer can emit invalid XML

**Severity:** Low · **Category:** Correctness

**Where:** backend/ceia/export_excel.py:1191-1192, 1210, 1258-1259

**What:** `xml.sax.saxutils.escape` does not remove control characters (scraped headlines can contain them) and does not escape the quotes used in the `sheet name="..."` attribute. `openpyxl` is already a dependency.

**Impact:** Rare corrupted workbooks.

**Fix:** Strip control characters, quote attributes with `quoteattr`, or use openpyxl.

### F-31 · No security headers or CSP; third-party UI weight

**Severity:** Low · **Category:** Security

**Where:** next.config.mjs; components/ui/tip.tsx; package.json

**What:** No `headers()` (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy). `@mui/material` and Emotion are shipped to render tooltips only (4 import sites). `LazyMotion` is configured but the other 12 files import `motion`, so it saves nothing.

**Impact:** Weaker defence in depth and a heavier client bundle.

**Fix:** Add headers in `next.config.mjs`; replace the tooltip with a small headless one; use `m` components or drop LazyMotion.

### F-32 · Dead and unreachable code

**Severity:** Low · **Category:** Maintainability

**Where:** components/landing/bento-grid.tsx; components/ui/swap-panel.tsx; components/ui/data-provenance.tsx (NotAvailable); lib/api/endpoints.ts (getMoverUniverses, getUniverseStats); backend/app/services/sensitivity.py (annualised_vol_pct); GET /ipo/{id}, GET /screener/indices; backend/ceia/{batch,peer_benchmark,pdf_extract,probe,synthetic_control}.py (~1.4k lines) and pdf*.py (~2.7k lines, reachable only through an unused flag)

**What:** Verified by repository-wide search (graphify shows no inbound references). `SwapPanel` is documented as the required pattern but nothing uses it.

**Impact:** More surface to read and keep correct.

**Fix:** Delete or move to a `tools/` folder; update the rules in PROJECT_PROGRESS.md.

### F-33 · Colour and gauge defaults that read as data

**Severity:** Low · **Category:** Integrity

**Where:** components/analyzer/dossier/validation-tab.tsx:26, 35; call-tab.tsx:24; components/macro/benchmark-sensitivity.tsx:27, 63, 94-96; components/quant/risk-suite.tsx:65

**What:** The calibration diagnosis badge is always green; null scores draw a gauge at 0; null beta is toned as 1.0; null default probability is toned green.

**Impact:** Visual cues contradict missing data.

**Fix:** Tone from the value, not from a default; render 'not assessed' for null.

### F-34 · Smaller correctness and robustness items

**Severity:** Low · **Category:** Correctness

**Where:** see per-file tables

**What:** Examples: `yahoo.fetch_quote` reads `fast_info.get` outside its try (yahoo.py:121); `/company/{symbol}/history` truncates MAX daily history to 1,500 rows without notice (yahoo_company.py:351); `windowed_movers` can list the same stock as both gainer and loser when the universe is smaller than 2×limit (screener.py:187-188); `factor_screens` keys the high-beta list as `highVolatility` (screener.py:157-164); `analysts()` leaves several Yahoo calls outside try (yahoo_company.py:310-313); the 52-week fields in screener rows are closing high/low (screener.py:136); `search` accepts an unbounded `q`; `main.py` uses deprecated `on_event` (lines 49, 56) and starts a thread at import (line 89, also under `--reload`).

**Impact:** Edge-case misbehaviour.

**Fix:** Fix individually.

### F-35 · Keyboard and screen-reader gaps

**Severity:** Low · **Category:** Accessibility

**Where:** components/ui/segmented-control.tsx:31-41; components/analyzer/dossier/index.tsx; components/alerts/custom-alert-engine.tsx:121-130; components/alerts/alerts-workbench.tsx:190-208; components/technicals/indicator-chart.tsx; components/ui/tip.tsx

**What:** `role=tablist/tab` is used for filter pills with no tabpanel, arrow-key support or `aria-controls`; the alert drawer is `aria-modal` with no focus trap, initial focus or scroll lock; the alerts picker has no keyboard navigation; chart crosshairs are mouse/pointer only; tooltips attach to non-focusable elements.

**Impact:** Hard to use without a mouse.

**Fix:** Use `aria-pressed` buttons for filters, a dialog primitive for the drawer, listbox semantics for pickers.

### F-36 · Global `warnings.filterwarnings('ignore')` in four modules

**Severity:** Low · **Category:** Reliability

**Where:** backend/app/services/{quant,screener,technicals,commodities}.py

**What:** Silences every warning process-wide, including from FastAPI, pandas and statsmodels.

**Impact:** Deprecations and convergence warnings become invisible.

**Fix:** Scope with `warnings.catch_warnings()` around the model fits.

### F-37 · Landing content is invisible until hydration

**Severity:** Low · **Category:** Performance

**Where:** components/landing/motion.tsx:10-47

**What:** `Reveal` and `Stagger` server-render with `opacity: 0` and reveal on view.

**Impact:** Blank sections without JavaScript or before hydration; slower perceived load.

**Fix:** Render visible by default and animate only after mount.


## Info

### F-38 · Duplicated helpers and constants, private cross-module imports

**Severity:** Info · **Category:** Maintainability

**Where:** backend/app: `analyzer_detail.py` and `analyzer_extra.py` import each other (one lazily); `_f`/`_finite`/`_round` in 6 files; `TRADING_DAYS`/`RISK_FREE_PCT` in 3 (and 6.8% in analyzer_extra); `universe.py`/`constituents.py` import `nse._get_session`; `services/unlisted.py` imports `ceia.unlisted._SERIES_POINT_RE`

**What:** Constants drift (6.5% vs 6.8%) and private names become an implicit API.

**Impact:** Harder refactors.

**Fix:** Create `app/common.py` for numerics and constants; expose public names.

### F-39 · Third-party data access

**Severity:** Info · **Category:** Compliance

**Where:** backend/app/services/shareholding.py:30, 74; backend/ceia/financials.py; backend/app/providers/nse.py; backend/app/services/unlisted.py

**What:** The site depends on screener.in HTML, undocumented NSE JSON, Yahoo through yfinance, and UnlistedZone. `shareholding.py` and `bhavcopy.py` send a browser User-Agent while the engine's Fetcher identifies itself honestly. Per the owner's instruction, UnlistedZone scraping is left as is and is not reviewed further here.

**Impact:** These sources can change or block access without notice and their terms were not reviewed in the repository.

**Fix:** Keep the provenance and fallbacks, record a terms review per source, and use one identifying User-Agent.

## Addendum

Findings F-40 to F-49 (second pass, 2026-10-02) are in [addendum-2026-10-02.md](addendum-2026-10-02.md): F-40 unlisted valuation benchmarks (Medium), F-41 unauthenticated fan-out endpoints (Medium), F-42 sequential NSE requests in movers explained (Medium), F-43 alert duplicates across tabs (Low), F-44 name-based listed/unlisted linking (Low), F-45 duplicated source parsing (Low), F-46 research layer fails open (Low), F-47 sitemap on a cold directory (Low), F-48 false precision on thin data (Medium), F-49 thin test coverage (Low).
