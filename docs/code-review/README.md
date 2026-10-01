# Code review of the Arthdex website

A review of the code written for the site: the Next.js front end, the FastAPI data service, and the vendored analysis engine it runs. Reviewed against commit `788c016` on 2026-10-01. The review used [graphify](graph.md) to map relationships and to keep a queryable memory of the codebase.

## Documents

| Document | Contents |
|---|---|
| **This file** | Scope, method, coverage, headline findings |
| [findings.md](findings.md) | The first 39 findings in detail: where, what, impact, fix |
| [addendum-2026-10-02.md](addendum-2026-10-02.md) | Second pass over the work done after the first review: findings F-40 to F-49, what moved, defects found and fixed |
| [backend.md](backend.md) | Per-file review of `backend/app` (routers, providers, services) |
| [frontend.md](frontend.md) | Per-file review of `app`, `components`, `lib`, `types` and configuration |
| [engine.md](engine.md) | The vendored CEIA engine: reachability, static analysis, deeper reads |
| [cross-cutting.md](cross-cutting.md) | Tool results, security, reliability, testing plan, remediation roadmap |
| [graph.md](graph.md) | The knowledge graph: contents, frontend↔backend bridge, hubs, how to query it |

## Scope and honesty about depth

235 source files (53,616 lines) were included: every file under `app/`, `components/`, `lib/`, `types/`, `backend/app/` and `backend/ceia/`, plus the build configuration. Generated data (`backend/analyzer_samples`, caches, `.next`, `node_modules`) and documentation were excluded.

| Coverage | Files | Lines | Meaning |
|:-:|---:|---:|---|
| R | 148 | 17,958 | Read line by line |
| P | 32 | 19,394 | Read in part: key logic read, remainder skimmed |
| S | 15 | 732 | Configuration and unused contracts, skimmed and tool-checked |
| T | 40 | 15,532 | Engine modules reviewed by tooling, graph and docstrings only |

All of `backend/app` and the application layer of the front end was read in full or in the parts that carry logic. The vendored engine (about 28,000 lines) was **not** read line by line; see [engine.md](engine.md) for exactly what was and was not examined. Nothing in this review was confirmed by running the site against live upstreams, so findings marked "needs verification" (F-25) and any behaviour that depends on live payloads should be reproduced before fixing.

## Method

1. **Graph.** graphify extracted an AST graph of all source files (2,405 nodes, 5,905 edges); 35 `http_calls` edges were added to connect the front end to the routes it calls ([graph.md](graph.md)).
2. **Tools.** `tsc`, `next lint`, and `ruff` over `backend/app` and `backend/ceia`.
3. **Reading.** Files were read in dependency order: backend providers → services → routers, then the API client, pages and components, then the engine's integration surface and its highest-impact modules.
4. **Cross-checks.** Dead-code candidates from the graph were re-verified with repository-wide searches; line numbers were re-resolved against the files; claims in the existing documentation were compared with the code.

## Verdict in one paragraph

The codebase is generally careful: provenance, defensive parsing, safe subprocess handling, honest empty states and clean type/lint results are real strengths. The most serious problems are not in the plumbing but in what the product tells users: a recommendation engine whose inputs and explanations are partly constants (F-02, F-03) inside a feature that likely needs regulatory attention (F-01), and a data cache in the engine that never expires (F-04). Beyond that there are two page-crash bugs (F-06, F-07), a family of symbol-encoding bugs (F-09), a regression from the unified search (F-10), and the absence of authentication, error boundaries and tests (F-05, F-11, F-29).

## Headline findings

Counts after the second pass ([addendum](addendum-2026-10-02.md)): **6 High, 27 Medium, 14 Low, 2 Info** (49). The table below lists the first 39; F-40 to F-49 are in the addendum.

| ID | Sev. | Category | Finding |
|---|---|---|---|
| [F-01](findings.md#f-01--the-product-issues-buysell-calls-price-targets-stop-losses-and-rupee-position-sizes) | High | Compliance | The product issues buy/sell calls, price targets, stop-losses and rupee position sizes |
| [F-02](findings.md#f-02--verdict-inputs-are-defaulted-or-invented-and-parts-of-the-explanation-text-are-unconditional) | High | Integrity | Verdict inputs are defaulted or invented, and parts of the explanation text are unconditional |
| [F-03](findings.md#f-03--dossier-recomputation-invents-book-equity-net-income-beta-and-uses-a-different-risk-free-rate) | High | Integrity | Dossier recomputation invents book equity, net income, beta and uses a different risk-free rate |
| [F-04](findings.md#f-04--the-engines-http-cache-never-expires-and-also-stores-error-responses) | High | Reliability | The engine's HTTP cache never expires and also stores error responses |
| [F-05](findings.md#f-05--no-authentication-anywhere-with-cheap-abuse-paths-and-cross-site-posts) | High | Security | No authentication anywhere, with cheap abuse paths and cross-site POSTs |
| [F-06](findings.md#f-06--company-overview-page-crashes-when-quarterly-statements-are-missing) | High | Correctness | Company overview page crashes when quarterly statements are missing |
| [F-07](findings.md#f-07--shareholders-tab-crashes-on-yearly-when-screenerin-has-no-yearly-table) | Medium | Correctness | Shareholders tab crashes on 'Yearly' when screener.in has no yearly table |
| [F-08](findings.md#f-08--search-truncates-before-ranking-so-short-queries-miss-the-best-matches) | Medium | Correctness | Search truncates before ranking, so short queries miss the best matches |
| [F-09](findings.md#f-09--symbols-containing--mm-jkbank-sspower--break-several-calls) | Medium | Correctness | Symbols containing '&' (M&M, J&KBANK, S&SPOWER ...) break several calls |
| [F-10](findings.md#f-10--alerts-picker-now-offers-unlisted-companies-with-an-empty-symbol) | Medium | Correctness | Alerts picker now offers unlisted companies with an empty symbol |
| [F-11](findings.md#f-11--no-error-boundaries-and-loosely-typed-analyzer-payloads) | Medium | Reliability | No error boundaries and loosely typed analyzer payloads |
| [F-12](findings.md#f-12--failures-are-swallowed-inside-fetchers-and-then-cached-as-successes) | Medium | Integrity | Failures are swallowed inside fetchers and then cached as successes |
| [F-13](findings.md#f-13--null-is-never-zero-is-violated-in-several-places) | Medium | Integrity | 'Null is never zero' is violated in several places |
| [F-14](findings.md#f-14--nse-session-handling-is-not-thread-safe-and-can-stampede) | Medium | Reliability | NSE session handling is not thread-safe and can stampede |
| [F-15](findings.md#f-15--the-ttl-cache-has-no-single-flight-no-size-bound-and-unbounded-key-cardinality) | Medium | Performance | The TTL cache has no single-flight, no size bound and unbounded key cardinality |
| [F-16](findings.md#f-16--marketmovers-does-network-io-outside-its-cache-on-every-request) | Medium | Performance | `/market/movers` does network I/O outside its cache on every request |
| [F-17](findings.md#f-17--news-feed-ordering-scope-and-error-reporting) | Medium | Correctness | News feed ordering, scope and error reporting |
| [F-18](findings.md#f-18--macd-screener-multiplies-upstream-downloads) | Medium | Performance | MACD screener multiplies upstream downloads |
| [F-19](findings.md#f-19--merton-barrier-and-asset-value-are-inconsistent-and-mislabelled) | Medium | Correctness | Merton barrier and asset value are inconsistent and mislabelled |
| [F-20](findings.md#f-20--multi-horizon-conformal-intervals-and-confidence-are-looser-than-described) | Medium | Integrity | Multi-horizon 'conformal' intervals and 'confidence' are looser than described |
| [F-21](findings.md#f-21--microstructure-is-not-estimated-on-one-tab-and-estimated-on-another) | Medium | Integrity | Microstructure is 'not estimated' on one tab and estimated on another |
| [F-22](findings.md#f-22--rate-differential-is-shown-with-the-wrong-sign) | Medium | Correctness | Rate differential is shown with the wrong sign |
| [F-23](findings.md#f-23--analyzer-service-races-duplicated-work-and-platform-quirks) | Medium | Reliability | Analyzer service: races, duplicated work and platform quirks |
| [F-24](findings.md#f-24--nameerrors-in-the-engines-error-paths) | Medium | Correctness | NameErrors in the engine's error paths |
| [F-25](findings.md#f-25--integer-parser-strips-decimal-points-needs-verification-against-live-payloads) | Medium | Correctness | Integer parser strips decimal points (needs verification against live payloads) |
| [F-26](findings.md#f-26--chart-components-re-mount-on-hover-and-trap-touch-scrolling) | Medium | Performance | Chart components re-mount on hover and trap touch scrolling |
| [F-27](findings.md#f-27--two-parallel-type-systems-one-of-them-dead) | Medium | Maintainability | Two parallel type systems, one of them dead |
| [F-28](findings.md#f-28--daily-price-cache-is-cwd-relative-caches-company-series-and-uses-pickle) | Medium | Reliability | Daily price cache is cwd-relative, caches company series, and uses pickle |
| [F-29](findings.md#f-29--no-automated-tests-and-no-ci) | Medium | Testing | No automated tests and no CI |

## Second pass (2026-10-02)

The research desk (watchlist, alerts, deals, calendar, briefing, movers explained, methodology, status), the unified search and the unlisted-company research layer (valuation, risk, trend, outlook and an investment call) were added after this review. They were reviewed in a second pass: see the [addendum](addendum-2026-10-02.md). In short: ten new findings (four Medium, six Low), eight defects found and fixed during the pass, 16 unit tests added, and F-01, F-05, F-14, F-15 and F-29 extended or partly addressed. The most important new point is F-40: the unlisted valuation compares against index averages picked by sector label, so a fast-growing company reads "Rich".

## Verdict counts by file

OK 132 · Watch 57 · Fix 30 · Dead 16 (of 235 files). Files without a specific note are counted as OK at the depth reviewed.
