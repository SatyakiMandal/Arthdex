# Cross-cutting review

## Tool results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | passes, no errors |
| `npx next lint` | "No ESLint warnings or errors" (the command is deprecated in Next 16) |
| `ruff` (F, B, S, PLE, PLW) on `backend/app` | 18 minor findings, no errors of substance |
| `ruff` on `backend/ceia` | 215 findings; real ones summarised in [engine.md](engine.md) |
| Tests | none exist (F-29) |

## Security

- **Authentication and abuse** (F-05) is the main gap. Everything is open; the proxy forwards POSTs from any origin; the cache-refresh endpoint accepts an empty prefix; snapshots bypass the queue cap.
- **Injection surface is small.** The engine is started with an argv list (no shell); run ids and tickers are pattern-validated; report HTML escapes scraped text and is served under `sandbox allow-scripts allow-popups`; no `dangerouslySetInnerHTML`, `eval` or `innerHTML` anywhere in the frontend.
- **Server-side URL building**: symbols are interpolated into upstream URLs and query strings without encoding (F-09). The destination host is fixed, so this is a correctness problem more than SSRF.
- **Secrets**: `.env.local` is git-ignored and only holds `ARTHDEX_API_URL`. The backend reads no secrets.
- **Headers/CSP** (F-31) are not configured.
- **Deserialisation**: `pandas.read_pickle` on a local cache (F-28).

## Reliability

- Failure should surface, not be cached (F-12); NSE session handling (F-14); no single-flight (F-15); analyzer races (F-23); crash-on-empty-data paths (F-06, F-07) with no error boundaries (F-11).
- The engine's permanent HTTP cache (F-04) is the most important reliability fix for data freshness.

## Performance

- Hot-path network I/O (F-16), per-parameter cache keys (F-18), repeated recomputation per request (F-23), hover re-mounting (F-26), MUI for tooltips (F-31).
- Positive: server components with per-endpoint revalidate windows keep most pages cheap; the factor and mover screens share one batch download.

## Data integrity (the product's core claim)

The site's promise is that every figure is real, sourced and honestly labelled. Most of the code keeps that promise. The exceptions that matter are F-02, F-03 (invented inputs), F-13 (null as zero), F-20/F-21 (claims stronger than the method) and F-22 (a sign error).

## Compliance

F-01 (prescriptive calls and sizing) is the most significant non-code risk. F-39 records that several data sources have terms that were not reviewed in the repository; the UnlistedZone decision is the owner's.

## Testing recommendations

1. **pytest, pure functions first** (fast, high value): `indicators` (RSI/ADX/Supertrend against known series), `fundamentals._contiguous_tail` and `compute_ratios`, `universe.search` ranking (would have caught F-08), `shareholding._int/_pct`, `news._classify_*` and ordering, `bhavcopy.analyse` on a small fixture, `quant.merton_default_risk`, `screener` overlap handling.
2. **Contract tests**: for each route, validate the JSON against the TypeScript types (generate from Pydantic models or use a shared schema). This catches shape drift such as F-07.
3. **Playwright smoke tests**: load every route in light and dark with a stubbed backend that returns "awkward" payloads (empty quarterly, `yearly: {}`, `&` in a symbol, null fields).
4. **CI**: `tsc`, `next lint`, `ruff` (F821 on), `pytest`, `playwright`.

## Remediation roadmap

**P0, before any public exposure**
- F-06, F-07 crash fixes and F-11 error boundaries.
- F-09 symbol encoding, F-10 alerts picker, F-22 sign, F-24 `log` NameError.
- F-04 cache TTL and no-cache-on-error.
- F-05 authentication/rate limiting and proxy hardening.
- F-01 decision on the recommendation features.

**P1, integrity**
- F-02 and F-03 (stop inventing inputs; generate text from values), F-12/F-13 (raise, log, null), F-19/F-20/F-21 (method honesty).
- F-40 (real peer sets for the unlisted valuation) and F-48 (stop showing paisa-level targets on a short record).

**P2, scale and cost**
- F-14, F-15, F-16, F-18, F-23, F-28, and from the second pass F-41 (rate limits on the fan-out endpoints), F-42 (warm filings in the background), F-47.

**P3, hygiene**
- F-27, F-29, F-30-F-38 and the dead-code list in F-32; from the second pass F-43 to F-46 and F-49.

## Counts

Findings: **6 High, 27 Medium, 14 Low, 2 Info** (49 total, including the second pass). By category: Correctness 14, Integrity 9, Reliability 8, Performance 6, Maintainability 4, Compliance 2, Security 3, Testing 2, Accessibility 1.

## Second pass: tool results (2026-10-02)

`tsc` and `next lint` clean; `ruff` (E, F) reports six items, all in files that predate the pass; `python -m unittest` runs 16 passing tests (new). Details and the defects fixed during the pass are in [addendum-2026-10-02.md](addendum-2026-10-02.md). The testing plan above still applies: the 16 tests cover only the unlisted research layer.
