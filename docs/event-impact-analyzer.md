# Event Impact Analyzer

The Analyzer answers "what did the news do to the stock?". It is the only part of Arthdex that runs long jobs, scrapes the web, and keeps state. It integrates the CEIA tool (Company Event Impact Analyzer, originally the `GSL-claude-company-event-impact-analyzer` repository) by vendoring its engine into `backend/ceia/` and running it as a subprocess.

It exposes three surfaces:

| Surface | Route | Purpose |
|---|---|---|
| Launcher and history | `/analyzer` | Start a run, list "Your analyses" and "Sample reports" |
| Run page | `/analyzer/[id]` | Live progress and log, then results, then the full HTML report and downloads |
| Company research tab | `/company/[symbol]/research` | The same dossier without news scraping, started automatically as a "snapshot" |

The page copy is explicit that this is a structured case-study generator, not a trading signal: coincidence between coverage and a move is not causation, and the model-derived calls are outputs, not advice.

## 1. Run lifecycle

```
POST /analyzer/runs ──► meta.json (QUEUED) ──► _worker waits for a slot (default 2 at once)
   │                                              │
   │                                  listed? ──► price preflight (fail in seconds on a bad ticker)
   │                                              │
   │                                  subprocess: python -u -m ceia.analyze | ceia.unlisted
   │                                  cwd = backend/analyzer_data/, stdout → run.log
   │                                              │
   └── UI polls GET /runs/{id} every 2.5 s ◄──── COMPLETED | FAILED | CANCELLED
```

- **Why a subprocess.** A run loads FinBERT/GoEmotions through torch, scrapes for minutes, and mutates global logging state. Isolation keeps the API light, lets a hung run be killed, and makes stdout the progress feed (the same text the CLI prints).
- **Storage.** Every run owns `backend/analyzer_data/runs/<id>/` with `meta.json`, `run.log`, `analysis.json`, `report.html`, `model.xlsx`. Nothing lives only in memory. The directory is git-ignored.
- **Statuses.** `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`. A run counts as completed only if exit code is 0 **and** `analysis.json` exists (plus `report.html` unless it is a snapshot).
- **Restart recovery.** On startup, runs that were `QUEUED`/`RUNNING` with no live process are marked `FAILED` ("Interrupted: the service restarted…").
- **Limits.** Concurrency `ARTHDEX_ANALYZER_CONCURRENCY` (2), timeout `ARTHDEX_ANALYZER_TIMEOUT` (5400 s, the process is killed), at most 8 queued/running runs (429 beyond), window 45 to 800 days, end date not in the future.
- **Failure messages.** The service prefers the engine's own explanation (searching the log for "Price data unavailable", "Ticker lookup failed", "UnlistedZone lookup failed", "Error", "Traceback") over an exit code.
- **Cancel.** Marks `CANCELLED` and kills the process. **Delete** removes only the run's folder; the shared per-company news cache is kept. Samples cannot be deleted. "Clear failed" deletes user-started failed/cancelled runs.

### Progress model
The log is scanned for markers to find the furthest of six steps: Finding news, Reading articles, Scoring tone, Market data, Running models, Writing the report. Within the first three, "N/M" fractions in log lines give a detail string ("42 of 130 articles"). The front end never lets the percentage move backwards and caps it at 98% until completion. The coarser `stage` label comes from a separate keyword table.

### Origins
| `origin` | Meaning |
|---|---|
| `run` | Started from the launcher |
| `snapshot` | Started by the Research Dossier tab; no news (`noNews`), skips HTML/Excel generation, 12-hour reuse window (`SNAPSHOT_TTL_SECONDS`), failures retried only after 10 minutes. A superseded snapshot is deleted |
| `sample` | One of 19 bundled reports (16 listed, 3 unlisted: Garuda Aerospace, Polymatech, Goa Shipyard Limited), copied into the runs directory once at startup. They contain `analysis.json` and `report.html` only (no workbook), and their dates reflect when they were generated (2026-09-18). Because seeding is idempotent and skipped when `meta.json` already exists, editing a bundled sample does **not** update an already-seeded copy |

## 2. Launching a run (`launcher.tsx`)

1. Type a name. There is no listed/unlisted toggle: one search covers NSE equities and the unlisted directory, and the kind of the picked result decides the run type. Debounced 220 ms. While the unlisted directory is still being built the search says so (`unlistedReady: false`) and shows listed hits only.
2. A raw ticker is accepted for listed names the NSE list may not carry (for example BSE-only). Unlisted companies must be picked from the results, because the run needs the exact UnlistedZone page URL.
3. Choose dates (default last ~6 months; presets 3M/6M/1Y). The UI enforces 45 days minimum; the API enforces 45 to 800.
4. Submit: `POST /api/analyzer/runs`, then navigate to `/analyzer/{id}`.

## 3. The run page (`run-view.tsx`)

Header (company, ticker, window, status pill) and, once complete, links to the full report (new tab), HTML, Excel and JSON downloads. While active: `RunProgress` (percentage, elapsed time, six-step tracker, plain-language blurb per step, collapsible log, cancel). On failure: the error plus the engine log. On completion: it loads `/runs/{id}/summary` and renders `ListedSummaryView` or `UnlistedSummaryView`. The first ever run also downloads FinBERT and GoEmotions (about 500 MB each) and crawls news sitemaps uncached, so expect 15+ minutes; later runs reuse `analyzer_data/data/news_cache`.

## 4. Listed dossier (12 tabs)

`components/analyzer/dossier/index.tsx`. A key strip sits above a sticky tab bar; the run's `caveats` are listed below. Data comes from `analyzer.summarise()` (headline fields, renamed to camelCase) and `analyzer_detail.detail_listed()` (tab-level blocks passed through under the engine's own field names, with long daily series removed). `analyzer_extra` re-derives the valuation suite, factor model, execution simulator and price timeline from `analysis.json`, mirroring what `report.py` computes at render time, so the on-site dossier matches the HTML report.

*Tab contents below are taken from the tab components, the `ListedDetail` type and the engine's module docstrings; individual fields vary by run.*

| Tab | Contents |
|---|---|
| Call & Dossier | Investment verdict: STRONG BUY / ACCUMULATE / HOLD / REDUCE / SELL, conviction 0 to 100, thesis, entry zone, two targets, stop, risk/reward, weighted pillars (the engine scores valuation, event flow, technicals, macro transmission and downside risk), position sizing and holding playbook |
| Timeline | Price vs benchmark rebased, daily abnormal return, volume, flagged incident days |
| Event Study | Incident days (abnormal return z, coverage z, item count, tone, dominant event and emotion, headlines, CAR), market model α/β/R², sentiment-return correlation, news inventory counts. **Hidden in snapshots** |
| Technicals | Composite rating/score, RSI, ADX, MACD, trend, moving-average structure |
| Financials | Revenue, profit, growth, ratios, order book, balance-sheet credit metrics (screener.in) |
| Valuation | 2-stage DCF with WACC (or residual income for banks), scenarios, Bayesian/Monte Carlo distributions, DuPont, solvency, relative multiples |
| Return & Volatility | Multi-horizon forecasts (P10/P50/P90), HAR-RV, six-sigma view, 4-model volatility ensemble |
| Risk & XAI | VaR/ES at 95% and 99% for 1 and 10 days, Merton distance to default, Shapley attribution of the forecast, regime |
| Portfolio & Systemic | HRP and Black-Litterman, Diebold-Yilmaz spillover and connectedness, factor model, execution (Almgren-Chriss) |
| Validation | Backtests: conformal coverage, volatility out-of-sample, technical-signal trades, overall score |
| Nifty & Macro | Nifty and sector index event studies; RBI repo, GDP, CPI, IIP, crude, USD/INR, G-Sec spread, reserves, PMI, fiscal deficit; metals; global-market ripple |
| Peer Valuations | Peer cohort multiples and benchmarks |

## 5. Unlisted analysis

`ceia.unlisted` is deliberately **not** an event study. UnlistedZone's displayed prices are periodically revised indicative levels (the engine's analysis of one company found 71 distinct values across 1,321 daily points), so there is no valid daily baseline for z-scores, market-model beta, CAR or permutation p-values. The module builds a timeline of dealer-price moves and attributes headline coverage to them, using the same "coincided with, never caused" language. Its summary has price statistics, the largest moves, per-source news counts and the same download set.

### Research layer (`ceia/unlisted_research.py`)

The timeline alone left the unlisted report thin next to the listed one, so a research layer now adds valuation, risk, trend, outlook and an investment call, all at the frequency the data really moves (monthly returns, weekly bars, the revision record), never daily:

| Block | Method | Left out when |
|---|---|---|
| Price profile | Returns over 1/3/6/12 months, CAGR, 52-week position, max drawdown, revision count, median gap, average revision size | fewer than 30 daily points |
| Valuation | Relative P/B and P/E against the NSE sector index (broad Nifty 500 when no sector index maps), justified P/B from ROE (P/B ÷ P/E) against a CAPM cost of equity, and a 12-month median anchor. Every relative model is cut by an illiquidity discount (25% base). Blended by weight into a fair value, with a sensitivity grid (discount × benchmark multiple) | the page prints no book value, P/B or P/E, or no benchmark was available |
| Trend | RSI, MACD, 10/26/52-week averages, 4/13-week momentum and Bollinger %B on weekly bars, composite score and rating | fewer than 14 weekly bars |
| Risk | Monthly volatility, skew, kurtosis, 1-month VaR (historical, parametric, Cornish-Fisher, expected shortfall), volatility regime, share of days the price is unchanged, lot size and minimum ticket, debt to equity | fewer than 6 monthly returns (historical VaR needs 12, 99% needs 24) |
| Market sensitivity | Beta, R², t-stat on monthly returns against Nifty 50 and the sector index | fewer than 6 overlapping months |
| Outcome ranges | Stationary block bootstrap of monthly returns with half of the historical drift removed, 1/3/6/12 months | fewer than 6 monthly returns |

The investment call reuses the listed verdict objects but not its pillars: valuation 35%, trend 20%, news 10%, macro 10%, risk, leverage and liquidity 25% (a pillar with no data is dropped and its weight shared). Differences from the listed call: conviction is capped at 85, and at 65 when there are fewer than 24 revisions or 12 monthly returns; stops are wider (10 to 25%); position size is at most 3% and rounded down to whole lots; there is no tactical horizon; and a valuation guard stops a buy call when the quote is above fair value and lowers a neutral call to reduce when it is more than 50% above.

The illiquidity discount, equity risk premium (5.5%) and terminal growth (5%) are assumptions and are returned with the output. The service writes a `context.json` per run (sector, the page's ratios, live NSE index P/E and P/B) and passes it with `--context`; without it the engine reads the page's ratios itself and skips benchmark models. Older unlisted runs carry no research block and the site asks for a re-run.

## 6. The CEIA engine (`backend/ceia/`)

57 Python files; the Streamlit `gui.py` was dropped. Entry points: `python -m ceia.analyze` (listed) and `python -m ceia.unlisted`. Arguments the service passes: `--company`, `--start`, `--end`, `--html`, `--xlsx`, `--ticker`, `--benchmark ^NSEI`, `--news` (an empty JSON file for snapshots), `--url` (unlisted).

| Stage | Modules |
|---|---|
| Ingestion | `sources`, `discovery` (robots-declared sitemaps, not search pages), `fetcher` (polite, cached, provenance-logging HTTP client that obeys robots.txt and crawl delay), `robots`, `extract`, `wayback` (fallback for Business Standard and Mint), `ingest`, `news_cache`, `ticker_lookup` |
| Cleaning | `relevance` (alias and position scoring), `dedupe` (token-shingle Jaccard, same-day), `staleness` (Tetlock 2011), `align` (maps timestamps to the trading day that could react; after-close items go to the next day) |
| Tone | `sentiment` (FinBERT primary, lexicon fallback), `emotion` (GoEmotions, secondary), event tagging |
| Market model | `prices`, `returns`, `eventstudy` (incident ranking needs unusual coverage **and** unusual abnormal return), `nifty`, `global_markets`, `metals`, `macro`, `synthetic_control`, `sdid` |
| Risk and volatility | `var`, `volatility_models`, `distance_to_default`, `solvency_ensemble`, `regime` (3-state), `microstructure`, `spillover` |
| Forecasting and valuation | `forecasting`, `valuation_model`, `financials`, `factor_model`, `portfolio`, `execution_simulator`, `xai`, `peer_benchmark`, `batch` |
| Calls and checks | `technical_analysis`, `investment_verdict`, `backtest` |
| Output | `narrative` and `unlisted_narrative` (deterministic templates, so identical inputs give identical prose and every number traces to a field), `report` (self-contained HTML, inline SVG), `charts`, `export_excel` (13-tab workbook), `pdf_report`/`pdf_charts`/`pdf` (A4 PDF via Playwright; not wired to the site) |
| Misc | `models`, `probe` (a phase-0 feasibility spike), `pdf_extract` |

Without `torch`/`transformers` the engine falls back to a lexicon, skips emotion tags, and says so in its log.

### Difference from the original repository
The original repository's company router fell back to hard-coded placeholder numbers when data was missing. That was deliberately **not** carried over: a failed run surfaces an error.

## 7. Security notes specific to the Analyzer

- The proxy at `app/api/analyzer/[...path]` forwards only allow-listed shapes.
- `ID_RE = ^[A-Za-z0-9_-]{4,64}$` guards run ids; `artefact()` serves only `report.html`, `analysis.json`, `model.xlsx`.
- Reports embed scraped text and are served with a sandbox CSP (`sandbox allow-scripts allow-popups`, no same-origin) (the run page links to it in a new tab rather than embedding it).
- Request fields are pattern-validated (`ticker`, `url` limited to `https://unlistedzone.com/shares/…`).
- There is **no authentication** on any route: anyone who can reach the site can start runs (bounded by the queue cap), delete user runs and download artefacts. See [data-integrity-and-limitations.md](data-integrity-and-limitations.md).
