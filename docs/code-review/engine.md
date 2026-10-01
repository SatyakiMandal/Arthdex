# Vendored engine review (`backend/ceia`)

The CEIA engine was vendored from another repository (57 Python files, about 28,000 lines). It is part of the website's backend, but it is much larger than everything else combined, so it was reviewed at a different depth. **It was not read line by line.** Method: tooling over all files (`ruff` with F, B, S, PLE and related rules, 215 findings, mostly unused imports and locals); the dependency graph from graphify to find what the website actually reaches; and direct reading of the modules that matter most for correctness, safety and what the user sees (`fetcher`, `investment_verdict`, `prices`, the market-model section of `returns`, the escaping in `report` and `export_excel`, and the integration surface in `backend/app/services/analyzer*.py`). Treat the per-file coverage column honestly: **T** means tooling only.

## Static analysis summary

| Rule | Count | Meaning here |
|---|---:|---|
| F401 unused import | 60 | cosmetic |
| F841 unused variable | 59 | mostly in `pdf_report.py` (dead path) |
| F821 undefined name | 36 | 30 are `Any` in postponed annotations (harmless); real ones: `log` (financials.py:331, 373), `fit_multi_factor_model` (pdf_report.py:847) → **F-24** |
| F541 f-string without placeholders | 22 | cosmetic |
| S110/S112 try-except-pass/continue | 19 | swallowed errors, see F-12 for the pattern |
| B904 raise without `from` | 8 | loses traceback context |
| S301 pickle | 1 | `prices.py:292` → **F-28** |
| S324 sha1 | 1 | non-security id (`models.py:114`) |
| S105 hardcoded password | 1 | false positive (`robots.py:155`, a robots token) |
| B023 closure over loop variable | 2 | false positive (`synthetic_control.py:162`) |

## Reachability (graphify)

The website starts the engine through `python -m ceia.analyze` and `python -m ceia.unlisted`, and imports `analyze, discovery, emotion, execution_simulator, factor_model, fetcher, prices, returns, sentiment, solvency_ensemble, unlisted, valuation_model` directly from `backend/app`. Following import edges from those roots reaches 52 of 57 files. Not reached from any entry point: `batch`, `peer_benchmark` (only used by `batch`), `pdf_extract`, `probe`, `synthetic_control` (about 1,400 lines). `pdf`, `pdf_report` and `pdf_charts` (about 2,700 lines) are reachable only through an optional `--pdf` flag the service never passes. See **F-32**.

## Engine-specific findings

- **F-04** the HTTP cache never expires and stores errors (affects macro and screener fundamentals).
- **F-01 / F-02** the investment verdict.
- **F-22** rate-differential naming and the UI sign.
- **F-24** `NameError` in error paths.
- **F-28** price day-cache location, staleness and pickle.
- **F-30** Excel XML.

## Observations from the parts that were read

- The market-model estimation in `returns.fit_market_model` is sound: it uses data before the analysis window, leaves a gap, requires a minimum sample, and logs a clear note when it falls back to beta 1.0.
- Unadjusted corporate actions are detected (`detect_corporate_actions_discontinuity`) but only logged, so an event study that spans a split or bonus can show a spurious abnormal return. Consider adjusting or excluding those days.
- `fit_garch11_residuals` does not fit anything: α and β are fixed at 0.10 and 0.85. The name overstates it.
- `report.py` builds about 5,000 lines of HTML with f-strings. It uses `html.escape` consistently (188 call sites) and only links `http(s)` URLs; combined with the sandbox CSP applied by the Next proxy this is a reasonable defence. Because it was not audited line by line, a missed unescaped interpolation is possible.
- `sentiment.py` and `emotion.py` download models with `from_pretrained(name)` and no revision pin, so a model update on the Hub changes results; consider pinning a revision.
- The Fetcher's honest user agent and robots.txt handling are good practice (and `robots.py` implements `*`/`$` correctly, which the stdlib parser does not).

## Per-file table

57 files · 31,737 lines · verdicts: Dead 8, Fix 6, OK 37, Watch 6 · coverage: P 15, R 2, T 40

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `backend/ceia/__init__.py` | 3 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/align.py` | 85 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/analyze.py` | 1212 | P | Watch | Entry point; raises without `from` (B904) in three places; unused f-strings. |
| `backend/ceia/backtest.py` | 522 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/batch.py` | 411 | T | Dead | Standalone multi-company CLI; no importer (F-32). |
| `backend/ceia/charts.py` | 1216 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/dedupe.py` | 98 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/discovery.py` | 402 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/distance_to_default.py` | 341 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/emotion.py` | 209 | P | Watch | Same model-loading note. |
| `backend/ceia/eventstudy.py` | 1520 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/execution_simulator.py` | 151 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/export_excel.py` | 1374 | P | Fix | Hand-written XLSX XML; control characters and attribute quoting (F-30); unused locals/imports. |
| `backend/ceia/extract.py` | 266 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/factor_model.py` | 198 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/fetcher.py` | 293 | R | Fix | Polite design (identifying UA, robots.txt, per-origin locks, provenance log) is good. Permanent cache and cached errors (F-04). |
| `backend/ceia/financials.py` | 980 | P | Fix | Undefined `log` in two except handlers; `FinancialRow` undefined in annotations (F-24); freshness via Fetcher (F-04). |
| `backend/ceia/forecasting.py` | 787 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/global_markets.py` | 226 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/ingest.py` | 640 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/investment_verdict.py` | 497 | R | Fix | F-01, F-02. |
| `backend/ceia/macro.py` | 631 | P | Fix | Sign convention of the rate differential (F-22) and uncached-freshness issue via Fetcher (F-04); ruff: unused imports and a loop variable. |
| `backend/ceia/metals.py` | 302 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/microstructure.py` | 185 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/models.py` | 189 | P | OK | Shared dataclasses; `sha1` for ids is non-security. |
| `backend/ceia/narrative.py` | 496 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/news_cache.py` | 303 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/nifty.py` | 243 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/pdf.py` | 110 | P | Dead | Playwright-based PDF renderer, not in requirements, unused (F-32). |
| `backend/ceia/pdf_charts.py` | 673 | T | Dead | Supports the unused PDF path (F-32). |
| `backend/ceia/pdf_extract.py` | 182 | T | Dead | Standalone; no importer (F-32). |
| `backend/ceia/pdf_report.py` | 1909 | P | Dead | 1.9k lines reachable only through an unused `--pdf` flag; ~30 unused locals and an undefined `fit_multi_factor_model` (F-24, F-32). |
| `backend/ceia/peer_benchmark.py` | 288 | T | Dead | Used only by `batch.py` (F-32). |
| `backend/ceia/portfolio.py` | 255 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/prices.py` | 314 | P | Fix | Provider chain with a day cache (F-28). |
| `backend/ceia/probe.py` | 316 | T | Dead | Phase-0 feasibility spike; no importer (F-32). |
| `backend/ceia/regime.py` | 149 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/relevance.py` | 162 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/report.py` | 4995 | P | Watch | 5k lines of f-string HTML. 188 `escape()` calls and an http(s) allow-list on links; the sandbox CSP at the proxy is the second layer. Not audited line by line. |
| `backend/ceia/returns.py` | 1620 | P | Watch | Market-model fit uses a pre-window estimation period with a gap (good) and falls back to beta 1.0 with a logged note. `fit_garch11_residuals` does not fit (fixed α=0.10, β=0.85). Split detection only warns. 20 undefined `Any` annotations (harmless). |
| `backend/ceia/robots.py` | 194 | P | OK | Own wildcard-aware robots matcher (stdlib parser lacks `*`/`$`); ruff S105 is a false positive. |
| `backend/ceia/sdid.py` | 175 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/sentiment.py` | 955 | P | Watch | FinBERT via `from_pretrained(model_name)`: no revision pin and no offline mode; `trust_remote_code` is not used (good). |
| `backend/ceia/solvency_ensemble.py` | 378 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/sources.py` | 336 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/spillover.py` | 150 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/staleness.py` | 59 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/synthetic_control.py` | 201 | P | Dead | No importer found (SDID is separate) (F-32); ruff B023 is a false positive (closure used within the iteration). |
| `backend/ceia/technical_analysis.py` | 534 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/ticker_lookup.py` | 121 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/unlisted.py` | 522 | P | Watch | Dealer-price timeline without significance claims (appropriate). Source decision left unchanged per owner. |
| `backend/ceia/unlisted_narrative.py` | 119 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/valuation_model.py` | 1654 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/var.py` | 530 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/volatility_models.py` | 645 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/wayback.py` | 264 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
| `backend/ceia/xai.py` | 147 | T | OK | Not read line by line. ruff and the dependency graph show nothing beyond the engine-level findings. |
