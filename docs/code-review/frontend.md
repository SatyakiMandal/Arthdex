# Frontend review (`app`, `components`, `lib`, `types`, configuration)

Next.js 15 / React 19 / TypeScript. `tsc --noEmit` and `next lint` both pass with no errors or warnings. Coverage codes and verdicts as in [backend.md](backend.md).

## Routes and route handlers (`app/`)

41 files · 2,371 lines · verdicts: Fix 1, OK 34, Watch 6 · coverage: R 41

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `app/actions/refresh.ts` | 28 | R | Watch | Correct two-layer invalidation. Callable by anyone (server action) and forwards arbitrary `prefixes` (F-05). |
| `app/alerts/loading.tsx` | 5 | R | OK | No defects found at the depth reviewed. |
| `app/alerts/page.tsx` | 65 | R | OK | Filters important filing flags; states the non-delivery clearly. |
| `app/analyzer/[id]/page.tsx` | 32 | R | OK | `notFound()` when the run does not exist. |
| `app/analyzer/page.tsx` | 78 | R | OK | `force-dynamic`, empty states, honest disclaimer. |
| `app/api/analyzer/[...path]/route.ts` | 69 | R | Fix | Allow-listed proxy and sandbox CSP on reports are good. Forwards any POST body regardless of content type (CSRF), snapshot regex excludes '&' (F-05, F-09). |
| `app/api/candles/route.ts` | 20 | R | OK | Validates presence of symbol; period defaults to 1Y and is validated by the backend. |
| `app/api/metric/route.ts` | 30 | R | OK | Small; returns `{value: null}` on any failure, which the UI renders as 'not reported'. |
| `app/api/screener/macd/route.ts` | 13 | R | Watch | Clamps `within` and direction. Passes an unvalidated `index`/`interval` to the backend, which validates. |
| `app/api/search/route.ts` | 26 | R | OK | Same-origin proxy with graceful 503. |
| `app/api/technicals/route.ts` | 15 | R | OK | Validates symbol with a regex that allows '&' (the client then breaks it, F-09). |
| `app/bhavcopy/page.tsx` | 209 | R | OK | Plain GET form so the date lives in the URL; validates the date format. |
| `app/commodities/page.tsx` | 179 | R | OK | Clean tables; indicative-price caveat stated. |
| `app/company/[symbol]/analysts/page.tsx` | 35 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/history/page.tsx` | 35 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/layout.tsx` | 63 | R | OK | Parallel quote/profile/valuation fetch, `notFound()` on 404; alert metrics built from live values. |
| `app/company/[symbol]/loading.tsx` | 23 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/macro/loading.tsx` | 14 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/macro/page.tsx` | 52 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/page.tsx` | 72 | R | Watch | Overview composition; its quarterly panel can crash on empty data (F-06). |
| `app/company/[symbol]/quant/loading.tsx` | 14 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/quant/page.tsx` | 55 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/research/page.tsx` | 20 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/shareholding/page.tsx` | 36 | R | Watch | Fine; the view it renders can crash on `yearly: {}` (F-07). |
| `app/company/[symbol]/statements/page.tsx` | 35 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/statistics/page.tsx` | 35 | R | OK | No defects found at the depth reviewed. |
| `app/company/[symbol]/technicals/page.tsx` | 20 | R | OK | No defects found at the depth reviewed. |
| `app/company/not-found.tsx` | 37 | R | OK | Placed above the layout deliberately (build-log lesson). |
| `app/ipo/loading.tsx` | 5 | R | OK | No defects found at the depth reviewed. |
| `app/ipo/page.tsx` | 217 | R | OK | Honest banners for GMP and DRHP; derived counts. |
| `app/layout.tsx` | 26 | R | OK | Fonts via next/font, providers, global RefreshControl. Title/description set. |
| `app/market-watch/loading.tsx` | 5 | R | OK | No defects found at the depth reviewed. |
| `app/market-watch/page.tsx` | 300 | R | Watch | Filters are links (shareable). Price-band filter is applied after fetching 50 rows, so a narrow band can show fewer than 15 rows. `href()` builder references `universe`/`activeWindow` before their `const` declarations inside the function but only calls them later, so it works. |
| `app/news/loading.tsx` | 5 | R | OK | No defects found at the depth reviewed. |
| `app/news/page.tsx` | 122 | R | Watch | Counts shown are for the unfiltered feed (F-17). |
| `app/not-found.tsx` | 42 | R | OK | Root 404. |
| `app/page.tsx` | 54 | R | OK | Server component composing landing sections; degrades to `DataUnavailable`. |
| `app/screener/page.tsx` | 31 | R | OK | Static shell around `MacdScreener`. |
| `app/unlisted/[id]/page.tsx` | 192 | R | OK | 404 handling and a prominent caution about indicative prices. |
| `app/unlisted/loading.tsx` | 5 | R | OK | No defects found at the depth reviewed. |
| `app/unlisted/page.tsx` | 52 | R | OK | Server fetch of the directory; provenance line. |

## API client, utilities, contracts (`lib/`, `types/`)

14 files · 1,764 lines · verdicts: Dead 6, OK 2, Watch 6 · coverage: P 2, R 4, S 8

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `lib/api/analyzer.ts` | 25 | R | OK | No-store fetchers; `server-only`. |
| `lib/api/client.ts` | 97 | R | Watch | Envelope-aware fetch with typed errors and `server-only`. No runtime validation of payload shape (F-11). |
| `lib/api/endpoints.ts` | 167 | R | Watch | One function per endpoint. `getMoverUniverses`/`getUniverseStats` unused (F-32); path symbols are not URL-encoded (safe for '&' in a path, not for other characters). |
| `lib/api/types.ts` | 680 | P | Watch | Mirrors backend payloads. `yearly: ShareholdingTable` is wrong when the backend sends `{}` (F-07). |
| `lib/utils.ts` | 38 | R | OK | `cn`, number/Indian-grouping formatters, `deltaColor`. `formatCrore` switches to 'L Cr' at 1e5 which is correct for lakh-crore. |
| `types/analyzer.ts` | 346 | P | Watch | Good headline types; `Blk = Record<string, any>` for most dossier blocks (F-11). |
| `types/common.ts` | 38 | S | Watch | Only `ISODate` and alert helpers are used (F-27). |
| `types/financials.ts` | 66 | S | Dead | Mock-era contracts that nothing imports (apart from the alert types re-exported from `types/index.ts`) (F-27). |
| `types/index.ts` | 7 | S | Watch | Barrel imported by one file for alert types only (F-27). |
| `types/ipo.ts` | 52 | S | Dead | Mock-era contracts that nothing imports (apart from the alert types re-exported from `types/index.ts`) (F-27). |
| `types/macro.ts` | 52 | S | Dead | Mock-era contracts that nothing imports (apart from the alert types re-exported from `types/index.ts`) (F-27). |
| `types/market.ts` | 67 | S | Dead | Mock-era contracts that nothing imports (apart from the alert types re-exported from `types/index.ts`) (F-27). |
| `types/quant.ts` | 88 | S | Dead | Mock-era contracts that nothing imports (apart from the alert types re-exported from `types/index.ts`) (F-27). |
| `types/ticker.ts` | 41 | S | Dead | Mock-era contracts that nothing imports (apart from the alert types re-exported from `types/index.ts`) (F-27). |

## Configuration

6 files · 151 lines · verdicts: OK 4, Watch 2 · coverage: S 6

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `.eslintrc.json` | 3 | S | OK | `next/core-web-vitals`; lint passes with no warnings. |
| `next.config.mjs` | 6 | S | Watch | Only `reactStrictMode`; no security headers (F-31). |
| `package.json` | 36 | S | Watch | Pinned majors. MUI + Emotion used for tooltips only (F-31). Scripts include `typecheck`; no `test` script (F-29). |
| `postcss.config.mjs` | 6 | S | OK | Standard. |
| `tailwind.config.ts` | 79 | S | OK | Token-based colours; custom animations. |
| `tsconfig.json` | 21 | S | OK | `strict: true`, bundler resolution, `@/*` alias. |

## Layout and providers

10 files · 780 lines · verdicts: OK 8, Watch 2 · coverage: P 1, R 9

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `components/brand/logo.tsx` | 60 | R | OK | Uses `useId` for gradient ids. |
| `components/layout/header-bar.tsx` | 139 | R | OK | Active-link logic, mobile drawer, responsive search placement. |
| `components/layout/market-ticker.tsx` | 73 | R | OK | Server-rendered marquee; pauses on hover; reduced-motion respected. |
| `components/layout/refresh-control.tsx` | 114 | R | OK | Small external store for page freshness and a transition-wrapped server action; hides on /analyzer. |
| `components/layout/site-footer.tsx` | 76 | R | OK | Disclaimer text is part of the product contract (see F-01). |
| `components/layout/site-header.tsx` | 18 | R | OK | Server shell around a client bar (correct split). |
| `components/providers/index.tsx` | 13 | R | OK | Composition. |
| `components/providers/motion-provider.tsx` | 18 | R | Watch | LazyMotion yields no saving while components use `motion` (F-31). |
| `components/providers/theme-provider.tsx` | 10 | R | OK | Thin wrapper. |
| `components/search/universal-search.tsx` | 259 | P | Watch | Debounce plus abort is correct; Enter during loading navigates to a stale result; finally-block of an aborted request can clear the spinner early; combobox lacks `role=option` semantics (F-35). |

## Company page components

22 files · 3,929 lines · verdicts: Fix 5, OK 9, Watch 8 · coverage: P 7, R 15

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `components/company/company-header.tsx` | 117 | R | Watch | Hides a 0 market cap but not other server-side fallbacks (F-13). |
| `components/company/company-tabs.tsx` | 74 | R | OK | Pending-state highlight and a shared-layout underline. |
| `components/company/fundamentals.tsx` | 289 | R | Fix | Quarterly panel renders `icon={undefined as never}` (F-06). D/E colouring flags banks red by construction. |
| `components/company/price-chart.tsx` | 372 | R | Watch | Careful hooks ordering and abort logic. `touch-none` traps touch scroll (F-26); y-axis labels round to integers (useless for sub-₹10 stocks); `Math.max(...volume)` of 0 yields NaN rects for zero-volume series. |
| `components/company/research-panel.tsx` | 149 | P | Watch | Starts/polls a snapshot; symbol with '&' fails at the proxy (F-09). |
| `components/company/valuation-panel.tsx` | 62 | R | OK | Null renders as a dash; counts reported fields. |
| `components/macro/benchmark-sensitivity.tsx` | 159 | R | Watch | Null R²/beta default to 0/1 for colouring (F-33). |
| `components/macro/global-sentiment.tsx` | 66 | R | OK | Server component with centred-zero bars. |
| `components/macro/news-feed.tsx` | 154 | R | Watch | Flags encode type not sentiment (good). External `href` is not scheme-checked (React 19 blocks `javascript:` URLs, but an allow-list is cheap). |
| `components/quant/regime-card.tsx` | 148 | P | Watch | Microstructure card says 'not estimated' (F-21). |
| `components/quant/return-forecasts.tsx` | 102 | R | Watch | Shared-scale rails are a good visual idea. Null becomes 0 (F-13); '95% split-conformal' wording (F-20). |
| `components/quant/risk-suite.tsx` | 149 | R | Watch | Null default probability toned green and null asset value shows '₹0 Cr' (F-13, F-33); tone thresholds are arbitrary. |
| `components/quant/volatility-ensemble.tsx` | 115 | R | OK | Weights footnote and consensus identity are stated. |
| `components/shareholding/shareholding-view.tsx` | 426 | P | Fix | `StackedHistory` throws when the table is `{}` (F-07). |
| `components/technicals/indicator-chart.tsx` | 317 | P | Fix | `PaneShell` defined inside the component (F-26); mouse-only crosshair. |
| `components/technicals/macd-screener.tsx` | 242 | R | Fix | Un-debounced parameter changes (F-18); dead ternary in `slice(interval === '1d' ? 5 : 5, 16)`. |
| `components/technicals/technical-workbench.tsx` | 210 | R | Fix | Unencoded symbol (F-09). Duplicate guide text (tooltip plus inline). |
| `components/yahoo/analysts-view.tsx` | 218 | P | OK | Defensive formatting; skimmed in places. |
| `components/yahoo/history-view.tsx` | 145 | R | OK | CSV export revokes the object URL immediately after click (fine in Chromium/Firefox, can race in Safari). |
| `components/yahoo/shared.tsx` | 136 | R | OK | Hand-rolled SVG chart utilities follow theme tokens. |
| `components/yahoo/statements-view.tsx` | 116 | P | OK | Annual/quarterly toggle; per-share rows not scaled. |
| `components/yahoo/statistics-view.tsx` | 163 | P | OK | Percent conventions match the backend; website link opened with `noopener`. |

## Market, landing, alerts, unlisted

13 files · 2,037 lines · verdicts: Dead 1, Fix 1, OK 8, Watch 3 · coverage: P 3, R 9, S 1

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `components/alerts/alerts-workbench.tsx` | 352 | R | Fix | Unencoded `symbol` in the metric URL (F-09) and unlisted results with empty symbols (F-10); stale threshold when the new company has no value; no keyboard navigation (F-35). Honest non-delivery notice. |
| `components/alerts/custom-alert-engine.tsx` | 329 | P | Watch | Honest notice pinned in the drawer. Modal without focus trap (F-35); threshold re-seeds on prop change. |
| `components/landing/bento-grid.tsx` | 170 | S | Dead | Not imported anywhere (F-32). |
| `components/landing/hero.tsx` | 104 | P | OK | Live figures only; stat strip links to market watch. |
| `components/landing/index-chart.tsx` | 156 | R | OK | Hooks before the early return; scales guarded. |
| `components/landing/methodology.tsx` | 56 | P | OK | Static copy. |
| `components/landing/motion.tsx` | 111 | R | Watch | Reveal/Stagger server-render invisible (F-37). |
| `components/market/factor-screens.tsx` | 122 | R | Watch | Uses backend key `highVolatility` for the beta list (F-34). |
| `components/market/movers-preview.tsx` | 101 | R | OK | Compact preview; error state present. |
| `components/market/movers-table.tsx` | 93 | R | OK | Row-level null handling. |
| `components/market/windowed-movers.tsx` | 125 | R | OK | Prop named `window` shadows the global (cosmetic). |
| `components/unlisted/directory-view.tsx` | 162 | R | OK | Client-side filter/sort over the server list; paged display. |
| `components/unlisted/price-history-chart.tsx` | 156 | R | OK | Step line is the honest rendering of revised quotes; duplicate React key when min equals max. |

## Analyzer

20 files · 2,911 lines · verdicts: Fix 3, OK 11, Watch 6 · coverage: P 3, R 17

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `components/analyzer/dossier/call-tab.tsx` | 140 | R | Fix | The recommendation UI (F-01, F-02); null conviction gauge at 0 (F-33). |
| `components/analyzer/dossier/event-tab.tsx` | 179 | R | OK | Expandable incident rows with an accessible inner button. |
| `components/analyzer/dossier/financials-tab.tsx` | 101 | R | OK | Empty states for missing statements. |
| `components/analyzer/dossier/index.tsx` | 85 | R | Watch | Tab bar (F-35). |
| `components/analyzer/dossier/key-strip.tsx` | 51 | R | Fix | Presents call/targets/stop prominently (F-01); null conviction renders '—' but gauge elsewhere shows 0. |
| `components/analyzer/dossier/macro-tab.tsx` | 122 | R | Fix | Rate differential sign (F-22). |
| `components/analyzer/dossier/peers-tab.tsx` | 63 | R | OK | Uses `<a>` instead of `<Link>` for peers (full reload). |
| `components/analyzer/dossier/quant-tab.tsx` | 240 | R | OK | Table-driven model cards. |
| `components/analyzer/dossier/risk-tab.tsx` | 186 | R | Watch | Microstructure claims (F-21). |
| `components/analyzer/dossier/shared.tsx` | 96 | R | OK | Formatting helpers; fraction-vs-percent helpers are explicit. |
| `components/analyzer/dossier/systemic-tab.tsx` | 198 | R | Watch | Execution card discloses 'assumed 2% daily volatility' (F-03). |
| `components/analyzer/dossier/technicals-tab.tsx` | 147 | R | OK | Readings and walk-forward backtest with a sample-size caveat. |
| `components/analyzer/dossier/timeline-tab.tsx` | 168 | P | OK | Hover state shared across panes; guards for short series. |
| `components/analyzer/dossier/validation-tab.tsx` | 112 | R | Watch | Always-green calibration badge; null score gauge at 0 (F-33). |
| `components/analyzer/dossier/valuation-tab.tsx` | 225 | R | Watch | Shows engine blocks via `any`; footnote constants (25% tax, 5.5% ERP, 6.8% rf) are hard-coded copy (F-03). |
| `components/analyzer/launcher.tsx` | 294 | P | Watch | Debounced/sequenced search is correct; unlisted must be picked (documented); no rate limiting on submit. |
| `components/analyzer/run-list.tsx` | 163 | R | OK | Confirm-before-delete flow; sample runs cannot be deleted. |
| `components/analyzer/run-progress.tsx` | 97 | P | OK | Percentage never moves backwards and is capped at 98%. |
| `components/analyzer/run-view.tsx` | 150 | R | OK | Poll, summary load, cancel and download links; poll errors shown. |
| `components/analyzer/summary-view.tsx` | 94 | R | OK | Guards a missing `detail` block from an old backend. |

## Shared UI primitives

11 files · 712 lines · verdicts: Dead 1, OK 7, Watch 3 · coverage: P 1, R 10

| File | Lines | Cov. | Verdict | Notes and findings |
|---|---:|:---:|:---:|---|
| `components/ui/cell-bar.tsx` | 42 | R | OK | Guards non-finite values. |
| `components/ui/data-card.tsx` | 93 | R | Watch | `icon` is required but one caller passes undefined (F-06). |
| `components/ui/data-provenance.tsx` | 130 | R | OK | Freshness, source, illustrative and unavailable components; `NotAvailable` unused. |
| `components/ui/desk-analysis.tsx` | 109 | P | OK | Renders the backend insights payload. |
| `components/ui/eyebrow.tsx` | 13 | R | OK | Simple. |
| `components/ui/gauge.tsx` | 83 | R | OK | Static gradient id would collide if two gauges share a page. |
| `components/ui/segmented-control.tsx` | 62 | R | Watch | tablist semantics without panels/keyboard (F-35). |
| `components/ui/skeleton.tsx` | 43 | R | OK | Simple. |
| `components/ui/swap-panel.tsx` | 40 | R | Dead | Documented as the required pattern but unused (F-32). |
| `components/ui/theme-toggle.tsx` | 48 | R | OK | Hydration-safe. |
| `components/ui/tip.tsx` | 49 | R | Watch | MUI tooltip for a few call sites (F-31); tips attach to non-focusable nodes (F-35). |

## What the frontend does well

- **Server-first data flow** with a typed envelope client, per-endpoint revalidate windows and same-origin proxies; the browser never needs the data-service address.
- **Honest UI vocabulary**: `FreshnessBadge`, `SourceLine`, `IllustrativeBanner`, `DataUnavailable`, and dashes for missing figures. Non-functional features (alerts) say so in the interface.
- **Hand-rolled SVG charts** that read CSS variables, so theme switches need no code, and carefully ordered hooks (a lint-caught bug was fixed).
- **Safe rendering**: no `dangerouslySetInnerHTML`, no `eval`, external links carry `rel="noopener noreferrer"`, and analyzer reports are served under a sandbox CSP.
- **Race-aware client code**: debounced searches with `AbortController`, sequence numbers in the analyzer launcher, monotonic progress.

## Themes to act on

1. **Crash safety** (F-06, F-07, F-11): fix the two known crashes and add error boundaries.
2. **Symbols with `&`** (F-09) and the unified-search regression (F-10).
3. **Null handling in presentation** (F-13, F-33).
4. **Performance details** (F-18, F-26, F-31, F-37).
5. **Accessibility** (F-35).
6. **Dead code and duplicate contracts** (F-27, F-32).

## Addendum: files added or changed after the first review (2026-10-02)

Findings are in [addendum-2026-10-02.md](addendum-2026-10-02.md). `tsc` and `next lint` are clean for all of it.

| Area | Files | Cov. | Verdict | Notes and findings |
|---|---|:---:|:---:|---|
| Client state | `lib/client/use-local-store.ts`, `watchlist.ts`, `alert-rules.ts`, `snapshot.ts`, `csv.ts` | R | OK | A localStorage hook that syncs across tabs and components, validates the stored shape, and survives a blocked store. CSV export escapes formula-leading text (fixed during the pass). |
| Alerts | `components/alerts/alert-runner.tsx`, `my-alerts.tsx`, `components/layout/header-actions.tsx` | R | Watch | Rules checked every minute while a tab is visible and when it becomes visible. Duplicate firing across tabs and silent skips (F-43). The old `AlertsWorkbench` still has F-10. |
| Watchlist | `app/watchlist/page.tsx`, `components/watchlist/*`, `app/api/watchlist/snapshot/route.ts` | R | OK | Unauthenticated proxy to the snapshot endpoint (F-41). |
| Market desk | `app/deals`, `app/calendar`, `app/briefing`, `components/market/deals-view.tsx`, `calendar-view.tsx`, `movers-explained.tsx` | R | OK | Honest empty and error states; the briefing builds a plain-text twin of the page; movers explained says a headline is a candidate, not a cause. |
| Trust pages | `app/methodology`, `app/status`, `components/layout/status-refresh.tsx`, `app/sitemap.ts`, `app/robots.ts` | R | Watch | The sitemap reads the unlisted directory and can block on a cold backend (F-47). |
| Search | `components/search/universal-search.tsx`, `company-picker.tsx` | R | OK | Compact icon-and-overlay mode between 1024px and 1279px; unlisted hits carry a badge and their own link. |
| Analyzer | `components/analyzer/unlisted-dossier.tsx`, `run-actions.tsx`, `launcher.tsx`, `summary-view.tsx`, `app/analyzer/compare/page.tsx` | R | Watch | Six-tab unlisted dossier reusing the listed call tab; copy link, PDF (prints the report window), re-run, compare. The call can look more precise than a short record deserves (F-48). |
| Landing | `components/landing/hero.tsx`, `index-chart.tsx`, `motion.tsx`, `methodology.tsx`, `app/page.tsx` | R | OK | Interactive chart (range, crosshair), staggered entrances, all disabled under reduced motion. `bento-grid.tsx` is unused. |
| Shared UI | `components/ui/export-csv.tsx`, `saved-presets.tsx`, `copy-text.tsx`, `unlisted/directory-view.tsx`, `price-history-chart.tsx` | R | OK | Small typed helpers; the price chart draws revisions as a step line, which is the honest reading of a dealer price. |
