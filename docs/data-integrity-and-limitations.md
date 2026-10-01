# Data Integrity, Limitations and Open Issues

## 1. Provenance model

Arthdex's central promise is that a reader can tell where a figure came from, how old it is, and whether it is real.

| Mechanism | Where | Meaning |
|---|---|---|
| Response envelope `meta` | Every backend route except the analyzer | `source`, `delayedMinutes`, `cacheAgeSeconds`, `fetchedAt`, `illustrative`, `note` |
| `FreshnessBadge` | Beside live figures | "15m delayed · 8s ago"; turns amber when cache age exceeds 15 minutes |
| `SourceLine` | Foot of panels | Source, delay and the response note |
| `PageStamp` + refresh control | Page-level | "Data 3m ago"; click to expire caches and refetch |
| `IllustrativeBanner` | Unlisted, IPO gaps, microstructure | The numbers below are not observations |
| `DataUnavailable` | On any failed fetch | The error is shown; no placeholder data is substituted |
| `—` for null | Tables and tiles | "Not reported" is a different claim from zero |
| `method` / footnotes | `DeskAnalysis`, cards | How a reading was computed and where it is weak |

Stale-on-failure caching means a figure can be older than its TTL when an upstream is down. The age is reported rather than hidden.

## 2. What is real and what is not

| Area | Status |
|---|---|
| Quotes, candles, indices, movers, news, filings, Bhavcopy, constituents, commodities | Live or delayed from public sources (Yahoo about 15 minutes; NSE about 1 minute) |
| Quant, sensitivity, screens, technicals | Computed on real return series; components that fail return notes |
| IPO listing performance | Reconstructed from real price history |
| **Unlisted companies** | **Hand-maintained** in `data/unlisted.json`. The two shipped records (Pixel Vision Technologies, Droneacharya Aerial Innovations) are marked "Illustrative sample data, not from a live or licensed feed", so the UI shows warning banners |
| **IPO grey-market premium** | Not available. Unofficial, unpublished by any exchange |
| **IPO planning/DRHP stage** | Not available. Filed with SEBI, not exposed by a free API |
| **Kyle's λ and VPIN** | Not estimated. They need tick-level order flow |
| Alerts | Client-side only. Not saved, not monitored, nothing is delivered. The UI says so |
| Analyzer | Real engine runs; output quality depends on news availability and the model assumptions listed per method |

### Editing `data/unlisted.json`
The file has a `_readme` and a `companies` map keyed by lower-case id. Each record needs the fields in `types/unlisted.ts` (`lastDealPrice`, `impliedValuationCr`, `impliedPe`, `impliedEvToEbitda`, `metrics`, `governanceFlags`, `milestones`, `listedPeerSymbols`) plus `source` and `lastUpdated`, both rendered in the UI. Optional `shareholding` holds cap-table data. A record whose `source` still matches `illustrative|sample` shows the warning banner; give it a real source to switch to a provenance line. Adding a record needs a rebuild for `generateStaticParams`, because ids are read at build time (a new id will render on demand in dev). Governance severity scoring: red-flag 6, watch 2, info 0.

## 3. Statistical limitations to keep in view

- Models are estimated from about three years of daily data for a single name. Fits can be poor (a "Weak fit" pill is shown even for the primary benchmark when R² is below 0.3).
- Conformal intervals inherit the sample's tail; they are not guarantees.
- Merton default point is a convention (current liabilities + half of total debt) on reported balance sheets that Yahoo sometimes lacks.
- Defence and shipbuilding names have no dedicated NSE index; Nifty 50 acts as their native benchmark rather than a misleading sector proxy.
- Beta/alpha screens use a one-year window; high alpha over one year says little about the future.
- Weekly/monthly movers are computed from constituent histories, not exchange feeds.
- Delivery-based "accumulation" cannot identify the buyer. Band closes are inferred from move size.
- Analyzer incident detection requires both unusual coverage and unusual abnormal return; absence of flagged days is not absence of impact. The unlisted mode uses revised indicative prices and makes no significance claims.

## 4. Open issues and risks found while documenting

These come from reading the code and repository; none has been reproduced by running the system.

| # | Finding | Severity | Detail |
|---|---|---|---|
| 1 | **Analyzer scrapes UnlistedZone against the project's own finding** | Compliance | Phase 12 of the build log records that UnlistedZone's Terms of Use prohibit bots, scrapers and systematic extraction, and that no scraper was therefore built for the Unlisted pages. But `ceia/unlisted.py` crawls UnlistedZone's directory (`https://unlistedzone.com/shares`, up to 20 pages) and fetches each product page's price series, through a fetcher that honours `robots.txt` (which the log says is permissive). `robots.txt` compliance does not satisfy the Terms. Decide whether to obtain authorisation, restrict the unlisted mode, or remove it |
| 3 | No authentication or rate limiting | Security | Backend routes are open; the Next.js proxy forwards analyzer POST/DELETE. Anyone reaching the site can queue runs (cap 8), cancel or delete user-started runs, download artefacts, and invoke `POST /cache/refresh` through the UI |
| 4 | Multi-worker deployment hazard | Reliability | See [operations.md](operations.md#5-deployment-guidance); orphan recovery and concurrency are per process |
| 5 | Third-party scraping beyond UnlistedZone | Compliance | The shareholding tab and the analyzer's fundamentals scrape screener.in; the analyzer crawls news sites and NSE JSON that is undocumented and unversioned. No terms-of-use review for these is recorded in the repository |
| 7 | `/ipo/{issue_id}` has no consumer | Dead code | The detail pages were deleted in the live-data rewrite, but the endpoint remains |
| 8 | `components/landing/bento-grid.tsx` unused | Dead code | Replaced by the methodology section and hero |
| 9 | Seeded samples do not update | Maintenance | `seed_samples()` skips an id whose `meta.json` exists, so changes to bundled samples (the latest commit rewrote several) do not reach an already-seeded `analyzer_data` |
| 10 | Samples have no Excel workbook | UX | Sample runs expose HTML and JSON only; the Excel button is hidden because `hasWorkbook` is false |
| 11 | Reports and cached data age | Content | Sample reports are dated 2026-09-18; the page says dates reflect generation time |
| 12 | `ceia/pdf.py` needs Playwright | Optional | Not in requirements and not reachable from the site |
| 13 | No tests | Quality | The repository contains no test files. Verification so far was manual, in-browser, plus `tsc`, `next lint` and `next build` |
| 14 | Backend CORS limited to localhost | Low | Irrelevant for the proxy design, relevant if a client ever calls the backend directly |
| 15 | Quant "confidence" can mislead | Content | It rises with horizon by construction; the response note says so, but the label invites misreading |

## 5. Documentation drift

`PROJECT_PROGRESS.md` is a chronological build log and several statements in it no longer hold:

- It still describes mock data (`lib/mock-data/`), 49 static routes, `/ipo/[id]`, `QuantCard`, `peer-matrix`, `microstructure-xai`, Shapley waterfall and Recharts in places. Those were removed or replaced in the live-data rebuild (Phases 7 to 12).
- It uses "Phase 7" twice (backend live data, and later the Analyzer tab), and its phase table stops at Phase 6.
- It states the footer says "all figures are mock"; the footer now carries the research/not-advice disclaimer instead.
- It says ensemble weights "can now come from AIC"; the implemented method is inverse out-of-sample MSE (see [analytics-methods.md](analytics-methods.md)).
- `backend/README.md` documents roughly half of the current endpoints. [backend-api.md](backend-api.md) is more complete.
- Commits after the build log's last edit added: Yahoo-style company tabs, technicals and the MACD screener, Bhavcopy, commodities, shareholders, research dossier, the 12-tab analyzer dossier, run progress UI, the refresh control, and a landing-page redesign.

Prefer these `docs/` files and the code. Update `PROJECT_PROGRESS.md` or retire it so there is one source of truth.

## 6. Change-safety rules (from the build history)

1. Do not use `AnimatePresence mode="wait"` for content swaps; use `SwapPanel`.
2. Do not "fix" the upstream quirks listed in [backend-api.md](backend-api.md#upstream-quirks-handled-in-code-do-not-fix-them-back).
3. Never default a missing value: use `null` and `—`.
4. Keep derived figures consistent with figures on the same page, and keep generated geometry deterministic.
5. Re-test 404 paths after adding a layout.
6. Re-verify numbers from the DOM or API payloads, not screenshots.
7. Keep disclaimers truthful: do not imply alerts notify, or that delayed data is live, or that illustrative data is real.
