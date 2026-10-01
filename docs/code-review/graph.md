# Graph and relationships (graphify)

The code review used [graphify](https://github.com/safishamsi/graphify) to build a persistent knowledge graph of the repository's source and to answer structural questions (what calls what, what is unused, where the layers meet). The graph is the review's memory: it can be queried in later sessions instead of re-reading files.

## What was built

| | |
|---|---|
| Corpus | 235 source files (TypeScript 132, Python 98, config 5), excluding `node_modules`, `.next`, sample reports, caches and generated data |
| Extraction | AST only (deterministic, no LLM, no API key). Docs were not part of the code graph |
| Graph | 2,405 nodes, 5,905 edges, 98 communities |
| Edge confidence | 5,751 extracted, 154 inferred |
| Edge types | calls 1497, contains 1310, imports 1017, imports_from 633, references 593, rationale_for 533, uses 114, method 109, http_calls 35, indirect_call 31, inherits 17, extends 9, re_exports 7 |
| Outputs | `graphify-out/graph.json` (queryable), `graphify-out/graph.html` (interactive), `graphify-out/GRAPH_REPORT.md` (audit report) |

The pipeline's health check reported 651 dangling-endpoint edges and 519 collapsed same-endpoint edges. These come from references to external names (for example `Any`, `date`) and repeated imports of the same module, not from missing source files.

## The frontend ↔ backend bridge

AST extraction cannot see across an HTTP boundary, so the first graph had no edges between `lib/api/*` and `backend/app/routers/*`. This review added 35 `http_calls` edges deterministically, by matching each client function's request path to the FastAPI route decorator (prefix + path with parameters normalised). They are marked `EXTRACTED` and carry `context: fetch|proxy/fetch`.

| Frontend caller | Backend handler |
|---|---|
| `cancel()` · `components/analyzer/run-view.tsx` | `cancel_run()` · `backend/app/routers/analyzer.py` |
| `submit()` · `components/analyzer/launcher.tsx` | `create_run()` · `backend/app/routers/analyzer.py` |
| `call()` · `components/analyzer/run-list.tsx` | `delete_run()` · `backend/app/routers/analyzer.py` |
| `getRun()` · `lib/api/analyzer.ts` | `get_run()` · `backend/app/routers/analyzer.py` |
| `listRuns()` · `lib/api/analyzer.ts` | `list_runs()` · `backend/app/routers/analyzer.py` |
| `getBhavcopy()` · `lib/api/endpoints.ts` | `get_bhavcopy()` · `backend/app/routers/bhavcopy.py` |
| `getYAnalysts()` · `lib/api/endpoints.ts` | `get_analysts()` · `backend/app/routers/company.py` |
| `getCandles()` · `lib/api/endpoints.ts` | `get_candles()` · `backend/app/routers/company.py` |
| `getYCompare()` · `lib/api/endpoints.ts` | `get_compare()` · `backend/app/routers/company.py` |
| `getFinancials()` · `lib/api/endpoints.ts` | `get_financials()` · `backend/app/routers/company.py` |
| `getYHistory()` · `lib/api/endpoints.ts` | `get_history()` · `backend/app/routers/company.py` |
| `getProfile()` · `lib/api/endpoints.ts` | `get_profile()` · `backend/app/routers/company.py` |
| `getQuote()` · `lib/api/endpoints.ts` | `get_quote()` · `backend/app/routers/company.py` |
| `getShareholding()` · `lib/api/endpoints.ts` | `get_shareholding()` · `backend/app/routers/company.py` |
| `getYStatements()` · `lib/api/endpoints.ts` | `get_statements()` · `backend/app/routers/company.py` |
| `getYStats()` · `lib/api/endpoints.ts` | `get_statistics()` · `backend/app/routers/company.py` |
| `getTechnicals()` · `lib/api/endpoints.ts` | `get_technicals()` · `backend/app/routers/company.py` |
| `getValuation()` · `lib/api/endpoints.ts` | `get_valuation()` · `backend/app/routers/company.py` |
| `refreshData()` · `app/actions/refresh.ts` | `refresh()` · `backend/app/routers/health.py` |
| `getIpoPipeline()` · `lib/api/endpoints.ts` | `get_pipeline()` · `backend/app/routers/ipo.py` |
| `getCommodities()` · `lib/api/endpoints.ts` | `get_commodities()` · `backend/app/routers/market.py` |
| `getGlobalIndices()` · `lib/api/endpoints.ts` | `get_global_indices()` · `backend/app/routers/market.py` |
| `getIndices()` · `lib/api/endpoints.ts` | `get_indices()` · `backend/app/routers/market.py` |
| `getMoverUniverses()` · `lib/api/endpoints.ts` | `get_mover_universes()` · `backend/app/routers/market.py` |
| `getMovers()` · `lib/api/endpoints.ts` | `get_movers()` · `backend/app/routers/market.py` |
| `getNews()` · `lib/api/endpoints.ts` | `get_news()` · `backend/app/routers/news.py` |
| `getQuant()` · `lib/api/endpoints.ts` | `get_quant()` · `backend/app/routers/quant.py` |
| `getSensitivity()` · `lib/api/endpoints.ts` | `get_sensitivity()` · `backend/app/routers/quant.py` |
| `getFactorScreens()` · `lib/api/endpoints.ts` | `get_factors()` · `backend/app/routers/screener.py` |
| `getWindowedMovers()` · `lib/api/endpoints.ts` | `get_windowed_movers()` · `backend/app/routers/screener.py` |
| `getMacdScreen()` · `lib/api/endpoints.ts` | `macd_crossover()` · `backend/app/routers/screener.py` |
| `searchCompanies()` · `lib/api/endpoints.ts` | `search()` · `backend/app/routers/search.py` |
| `getUniverseStats()` · `lib/api/endpoints.ts` | `universe_stats()` · `backend/app/routers/search.py` |
| `getUnlistedCompany()` · `lib/api/endpoints.ts` | `get_company()` · `backend/app/routers/unlisted.py` |
| `getUnlistedDirectory()` · `lib/api/endpoints.ts` | `get_directory()` · `backend/app/routers/unlisted.py` |

**Backend routes with no direct caller in the website code** (some are reached through the generic `/api/analyzer/[...path]` proxy with template-string URLs the matcher cannot resolve):

- Via the analyzer proxy from client components: `POST /analyzer/runs/clear-unsuccessful`, `GET /analyzer/runs/{id}/summary|report|download/{name}`, `GET /analyzer/search`, `POST /analyzer/snapshots/{symbol}`.
- Genuinely unused by the site: `GET /health`, `GET /cache` (operational), `GET /ipo/{issue_id}`, `GET /screener/indices` (F-32). `GET /market/mover-universes` and `GET /universe/stats` are only reached through client functions that nothing calls.

## Hubs (most connected code nodes)

| Node | File | Degree |
|---|---|---:|
| `cn()` | `lib/utils.ts` | 150 |
| `report.py` | `backend/ceia/report.py` | 114 |
| `endpoints.ts` | `lib/api/endpoints.ts` | 89 |
| `types.ts` | `lib/api/types.ts` | 86 |
| `utils.ts` | `lib/utils.ts` | 75 |
| `Fetcher` | `backend/ceia/fetcher.py` | 67 |
| `deltaColor()` | `lib/utils.ts` | 62 |
| `analyze.py` | `backend/ceia/analyze.py` | 61 |
| `formatINR()` | `lib/utils.ts` | 59 |
| `NewsItem` | `backend/ceia/models.py` | 55 |
| `export_excel.py` | `backend/ceia/export_excel.py` | 50 |
| `analyse()` | `backend/ceia/analyze.py` | 48 |

`cn`, `deltaColor`, `formatINR` and `formatPct` are the frontend's shared formatting spine; `Fetcher`, `NewsItem` and `analyse()` are the engine's. A bug in `Fetcher` (F-04) therefore reaches every ingestion path, which is why it is rated High.

## Largest communities

| # | Nodes | Dominant file | Example members |
|---:|---:|---|---|
| 0 | 92 | `components/layout/refresh-control.tsx` | `PageProps`, `PageProps`, `PageProps`, `PageProps` |
| 1 | 79 | `components/analyzer/dossier/shared.tsx` | `Field`, `Tone`, `AnalyzerKind`, `Blk` |
| 2 | 76 | `backend/app/services/indicators.py` | `Entry`, `TTLCache`, `.age()`, `.clear()` |
| 3 | 71 | `lib/api/types.ts` | `PageProps`, `RangeId`, `Point`, `RangeId` |
| 4 | 71 | `backend/ceia/returns.py` | `IndexSeries`, `MarketModel`, `MultiFactorModel`, `_descriptive_only()` |
| 5 | 69 | `backend/app/services/analyzer.py` | `RunRequest`, `_analyzer_startup()`, `cancel_run()`, `clear_unsuccessful()` |
| 6 | 68 | `backend/app/providers/yahoo.py` | `compute_ratios()`, `_contiguous_tail()`, `_cr()`, `fetch_annual_pnl()` |
| 7 | 65 | `lib/api/endpoints.ts` | `PageProps`, `TickerCell`, `ApiError`, `ApiResult` |
| 8 | 58 | `backend/ceia/eventstudy.py` | `DailyCoverage`, `valence_of()`, `aggregate_by_day()`, `attach_headlines()` |
| 9 | 57 | `lib/api/types.ts` | `PageProps`, `ApiAnnual`, `ApiBalanceSheet`, `ApiCandleSeries` |
| 10 | 56 | `backend/ceia/news_cache.py` | `NewsItem`, `CacheSegment`, `CompanyCache`, `ingest_with_cache()` |
| 11 | 53 | `backend/ceia/prices.py` | `AlphaVantageProvider`, `CsvProvider`, `FastYahooProvider`, `PriceError` |
| 12 | 53 | `backend/ceia/valuation_model.py` | `BayesianDCFResult`, `DCFResult`, `DupontResult`, `KeyFinancialRatiosResult` |
| 13 | 52 | `app/api/analyzer/[...path]/route.ts` | `Props`, `Ctx`, `PageProps`, `AnalyzerRun` |
| 14 | 51 | `backend/ceia/report.py` | `compute_directional_volatility_spillover()`, `same_direction_rate()`, `_backtest_suite_section()`, `build_html()` |
| 15 | 46 | `components/technicals/macd-screener.tsx` | `Feature`, `SearchHit`, `SegmentOption`, `SortKey` |
| 16 | 45 | `backend/ceia/sentiment.py` | `analyze_transcript_pdf()`, `_extract_pdf_stream_text()`, `extract_pdf_text()`, `main()` |
| 17 | 43 | `backend/ceia/financials.py` | `FinancialsError`, `FinancialSummary`, `QuarterlyRow`, `SkippedFinancialsFetcher` |
| 18 | 43 | `backend/ceia/macro.py` | `MacroEvent`, `SkippedFetcher`, `SkippedPriceProvider`, `cpi_inflation()` |
| 19 | 41 | `backend/ceia/unlisted.py` | `RunConfig`, `PriceMove`, `UnlistedAnalysis`, `UnlistedCompanyNotFoundError` |

Communities map cleanly onto files and layers (for example the dossier tabs cluster together, the engine splits into ingestion, event study, valuation and reporting groups), which supports the layering described in the architecture docs. File-level import analysis of the non-engine code found one cycle, `services/analyzer_detail.py` ↔ `services/analyzer_extra.py` (broken by a function-level import, see F-38), none in the front end, and no front-end file importing backend code.

## Using the graph later

```bash
graphify query "what calls Fetcher.get"            # BFS context
graphify query "who writes analysis.json" --dfs    # follow a path
graphify path "submit()" "create_run()"              # shortest path across the HTTP bridge
graphify explain "ensure_snapshot"
```

After editing code, refresh incrementally with `graphify update .` (code-only, no LLM). The HTTP-bridge edges were added by a script and are not regenerated by `update`; re-run the matcher if endpoints change (the script is described in this document and is about 50 lines).

## Limits of the graph

- JSX usage (`<Component />`) is not recorded as a call, so frontend "unused" candidates from the graph were re-verified with a repository-wide text search before being reported (F-32).
- Python imports of the form `from . import x as y` are recorded; function-level lazy imports are recorded; dynamic imports are not.
- The graph does not include the documentation or the sample reports.

## Update, 2026-10-02

`graphify update .` was run after the second pass (AST only): **3,098 nodes, 7,140 edges, 163 communities** over 308 files (the corpus now includes the documentation and the new modules). The 35 hand-derived `http_calls` edges are not regenerated by that command, so the new client-to-route calls (watchlist snapshot, deals, calendar, movers explained, status, pre-IPO, compare) are not in the graph's frontend to backend bridge. They follow the same pattern: a function in `lib/api/endpoints.ts` or a route handler in `app/api` calling a router in `backend/app/routers/desk.py` or `unlisted.py`.
