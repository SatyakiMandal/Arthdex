# Frontend

Next.js 15 App Router, React 19, TypeScript (strict), Tailwind 3.4. Path alias `@/*` maps to the repo root.

## 1. Rendering and data-fetching model

| Concern | How it works |
|---|---|
| Server components | Almost every page is an `async` server component that awaits typed fetchers from `lib/api/endpoints.ts`. Data is fetched on the server, so the browser never sees `ARTHDEX_API_URL`. |
| `lib/api/client.ts` | `apiGet<T>(path, revalidate)` returns `ApiResult<T>`: `{ok: true, data, meta}` or `{ok: false, status, message}`. Network failure becomes status `0` with a "Cannot reach the data service" message. `apiGetOrNull` returns `null` on failure for optional sections. Every fetch is tagged `"api"` for bulk invalidation. |
| Revalidate windows | `REVALIDATE` map: quote/indices 60 s, movers 120 s, candles 900 s, fundamentals/quant 3600 s, IPO 1800 s, news 300 s, universe 86 400 s. Several endpoints pass literal values (Bhavcopy 3600, technicals 60, commodities 600). |
| Cache-busting `?v=N` | Some fetchers append `v=1`/`v=2` (IPO, Bhavcopy, commodities, Yahoo sections). It forces Next's fetch cache to drop entries from an older payload shape. Bump it when a payload shape changes. |
| Analyzer fetchers | `lib/api/analyzer.ts` uses `cache: "no-store"`. Runs are stateful and responses are not enveloped. |
| Client components | Used only for interaction: header bar, search, charts, segmented controls, alert builders, technical workbench, MACD screener, analyzer launcher/run view/research panel. They call same-origin routes under `app/api/*`. |
| Dynamic rendering | Company routes, news, market watch etc. render per request (live prices; about 2,600 companies cannot be prerendered). |
| Navigation state in the URL | Filters on market watch, IPO, news and Bhavcopy are plain `<a href>` links with query strings, so views are shareable and work without client JS. |

### Same-origin route handlers (`app/api/*`)

| Route | Used by | Notes |
|---|---|---|
| `GET /api/search?q=` | `UniversalSearch` | Calls `searchCompanies(q, 10)` (listed and unlisted); returns `{results}` or 503 with an error message |
| `GET /api/candles?symbol=&period=` | `PriceChart` | Period switching without a page reload |
| `GET /api/metric?symbol=&metric=` | `AlertsWorkbench` | Metric `cmp`, `peRatio`, `pbRatio`; returns `{value}` |
| `GET /api/technicals?symbol=&interval=` | `TechnicalWorkbench` | Symbol validated against `^[A-Za-z0-9&_-]{1,20}$` |
| `GET /api/screener/macd?direction=&interval=&within=&index=` | `MacdScreener` | `within` clamped to 1 to 50; direction defaults to `above` |
| `GET\|POST\|DELETE /api/analyzer/[...path]` | Launcher, run view, research panel | Allow-listed proxy to `/api/v1/analyzer/*`; see below |

**Analyzer proxy.** Only these path shapes are forwarded (anything else is 404): `search`, `runs`, `runs/clear-unsuccessful`, `snapshots/{id}`, `runs/{id}`, `runs/{id}/(cancel|summary|report)`, `runs/{id}/download/{name}`. Responses stream through with `content-type` and `content-disposition` preserved and `cache-control: no-store`. Report responses get `content-security-policy: sandbox allow-scripts allow-popups`, because the report embeds scraped headlines.

### Server action: refresh

`app/actions/refresh.ts` → `refreshData(path, prefixes, symbol)`:
1. `POST {API}/api/v1/cache/refresh` with `{prefixes, symbol}`. The backend expires matching cache entries (never `analyzer:` entries, never entries younger than 10 s).
2. `revalidateTag("api")` and `revalidatePath(path, "layout")` drop Next's copies.

The floating **RefreshControl** (`components/layout/refresh-control.tsx`, mounted in the root layout) triggers it. Pages register data freshness by rendering `<PageStamp meta={…} />`; the control shows "Data 3m ago" and the source on hover. It maps the current path to backend cache prefixes (`market:`, `market:commodities`, `news:`, `ipo:`, `bhav`, `screener:`, or the company symbol). It hides itself on `/analyzer`.

## 2. App shell

Root layout (`app/layout.tsx`): fonts (Inter, Sora, Noto Sans Devanagari as CSS variables), `<Providers>` (next-themes with `attribute="class"`, `defaultTheme="system"`, `disableTransitionOnChange`; Framer Motion `LazyMotion` + `MotionConfig reducedMotion="user"`), and `<RefreshControl/>`. Metadata title: "Arthdex · Quantitative Market Intelligence".

Every page composes `<SiteHeader/> … <SiteFooter/>` itself.

| Piece | Type | Behaviour |
|---|---|---|
| `SiteHeader` | server | Sticky; stacks `MarketTicker` over `HeaderBar` |
| `MarketTicker` | server | Marquee of every NSE index returned by `/market/indices` (level and % change). Pauses on hover; no animation under reduced motion. On failure shows "Index feed unavailable" |
| `HeaderBar` | client | Logo, 7 primary items (Market Watch, Commodities, Screener, IPO, News, Unlisted, Analyzer) with a sliding active indicator, a **More** menu (Morning briefing, Deals, Calendar, Bhavcopy, Alerts, Methodology, Data status), `UniversalSearch` (a full box from 1280px, an icon that opens an overlay from 1024px, in the drawer below), `HeaderActions` (watchlist star with a count, alerts bell with a badge for fired alerts), theme toggle, and a mobile drawer under `lg` |
| `UniversalSearch` | client | Debounced (180 ms) autocomplete over about 2,600 NSE equities and the unlisted directory (unlisted hits show a building icon and an "Unlisted" tag and link to `/unlisted/{id}`), aborts superseded requests, keyboard navigation, Ctrl/⌘-K shortcut. Hidden below `md` in the bar (the mobile drawer has its own copy); between `lg` and `xl` it collapses to an icon that expands as an overlay |
| `SiteFooter` | server | Link columns plus the standing disclaimer |
| 404s | | `app/not-found.tsx` (root) and `app/company/not-found.tsx` ("Symbol not found"). The company one sits at `app/company/` and not beside `[symbol]/layout.tsx` because `notFound()` thrown from a layout is caught by the parent segment |

## 3. Routes

### `/` Landing
Server component. Sections: `Hero` (live headline index tiles for Nifty 50, Nifty Bank, Nifty IT, India VIX plus a one-year `^NSEI` chart via `getCandles`), `Methodology` (three steps: ingestion, benchmark adjustment, multi-pillar synthesis), `MoversPreview` (6 gainers/losers, universe `gt20`), `GlobalSentiment` (six world indices), and the latest 8 items of `NewsFeed`. The hero fades in in sequence, trails a soft glow behind the pointer and wipes its chart line in; `IndexChart` is a client component with a range switch (1M/3M/6M/1Y, slicing the year of candles the server sent) and a hover crosshair. Animation helpers (`Reveal`, `Stagger`, `SpotlightCard`, `GlowSection`) live in `components/landing/motion.tsx`; all of it is switched off under `prefers-reduced-motion`. `bento-grid.tsx` exists but is not imported anywhere (the section was removed as redundant).

### `/market-watch`
Query params: `universe` (`gt20` default, `nifty50`, `niftynext50`, `banknifty`, `fo`, `all`), `window` (`daily` default, `weekly`, `monthly`), `price` (`all`, `penny` under ₹50, `small` 50 to 500, `mid` 500 to 2,000, `large` above 2,000).
- Daily gainers/losers come from NSE's variation feed (limit 15, or 50 when a price band is active, then filtered client-side per band to 15).
- Weekly and monthly come from `getWindowedMovers` (Nifty 100 constituents, computed from price history). If that fails the page says so and daily lists still render.
- Index constituent breadth (sum of advances/declines), a full index table (level, % change, 1M, 1Y, P/E, 52-week high/low), and `FactorScreens` (High beta, Low volatility, Alpha for Nifty 100).
- Mover rows show delivery % from the latest Bhavcopy where available.

### `/commodities`
`getCommodities()` plus indices filtered to names matching METAL/ENERGY/OIL/COMMOD. Shows USD/INR, indicative gold per 10 g and silver per kg, a `DeskAnalysis` panel, and four group tables (Precious metals, Base metals, Energy, Agriculture) with price, 1D/1W/1M/3M/1Y changes drawn as proportional bars, one-year sparkline, 52-week range position and a "what moves it" note. Futures are USD benchmarks, not MCX prices.

### `/screener`
`MacdScreener`: direction (crossed above/below signal), bar size (5m, 15m, 1h, 1d), look-back `within` bars, universe (Nifty 50/100/200). Refetches on any change, with a manual re-run. Results show price, change, MACD/signal/histogram, RSI, ADX, and a 0 to 4 confirmation score; a `DeskAnalysis` panel summarises breadth.

### `/bhavcopy`
Query: `date` (`YYYY-MM-DD`, validated; plain GET form). Six KPIs (securities, advance/decline, turnover, weighted and simple delivery %), a generated session narrative, `DeskAnalysis`, and four tables: institutional accumulation radar, volume anomalies, upper-band closes, lower-band closes. Symbols link to company pages.

### `/ipo`
Query: `segment` (`mainboard`, `sme`, or all). Counts per status, `DeskAnalysis`, and a table per lifecycle stage (Ongoing, Upcoming, Closed, Listed): price band, subscription multiple, listing gain, CMP vs issue. Two banners state what is not tracked (grey-market premium, DRHP stage). There is no `/ipo/[id]` page; the backend endpoint exists but nothing calls it.

### `/news`
Query: `kind` (`filing`, `press`), `symbol`. Counts of filings and press items, `NewsFeed`, and a "Partial feed" notice when a source failed. `NewsFeed` renders flag chips that encode disclosure type (LODR, order win, rating action, earnings, board outcome, …), not sentiment.

### `/alerts`
`AlertsWorkbench` plus a `NewsFeed` of recent filings filtered to flags `earnings`, `board-outcome`, `order-win`, `rating-action`, `acquisition`, `dividend`.
- Pick any listed company, a metric (price, P/E, P/B), a comparator (`<`, `≤`, `>`, `≥`) and a threshold. The condition is evaluated once against the live value at creation.
- **Alerts live in component state only.** Nothing is stored, monitored or delivered, and the page says so. The same applies to the company-page alert drawer (`CustomAlertEngine`).

### `/unlisted` and `/unlisted/[id]`
Source: `GET /api/v1/unlisted` and `/api/v1/unlisted/{id}` (UnlistedZone indicative prices, fetched by the backend). The index is a searchable, sector-filterable, sortable grid of about 270 companies. The profile page shows the indicative price and its 6-month move, a step-line price history (the source holds its price flat between revisions, so only real revisions are drawn), the source's own ratios (P/B, book value, face value, lot size, 52-week range, P/E where it exists), the revision table, and a warning that the figure is an indicative dealer level, not an exchange price. Governance flags, shareholding, order books and milestones are not offered, since the source carries none.

### `/watchlist` and `/alerts`
The watchlist and alert rules live in `localStorage` (`arthdex:watchlist:v1`, `arthdex:alerts:v1`), via `lib/client/use-local-store.ts`, so they are per browser and survive reloads. `WatchButton` is on every company and unlisted header. `AlertRunner` (mounted in `Providers`) checks armed rules every minute while a tab is visible, and again when a hidden tab becomes visible, by posting to `/api/watchlist/snapshot`. A fired rule shows a toast, a browser notification if permitted, and a badge on the header bell. Nothing is sent when no tab is open; email or push needs a 24/7 host.

### `/deals`, `/calendar`, `/briefing`
Bulk/block/short deals, a 30-day results and corporate-actions calendar, and a one-page morning briefing (indices, global cues, movers with explanations, deals, results, IPOs, filings) with copy-as-text and print. Most tables have an Export CSV button (`components/ui/export-csv.tsx`).

### `/methodology` and `/status`
Plain-language sources and models, and a live feed-freshness table read from `GET /status`.

### Movers explained, saved screens, analyzer extras
`/market-watch` shows "Why they moved" next to the movers. The MACD screener saves named filter sets (`components/ui/saved-presets.tsx`). A finished analysis has Copy link, PDF (prints the report window), Re-run (same window length ending today) and Compare. The Compare menu (`components/analyzer/compare-menu.tsx`) has a search box over every listed or unlisted company, suggests the company's sector peers (`GET /analyzer/runs/{id}/peers`), and lists other finished analyses; a company with a finished run opens the comparison at once, any other starts an analysis over the same window and opens a comparison that waits for it (`ComparePending`). `/analyzer/compare?a=&b=` rebuilds every block of the dossier side by side: for listed runs about 16 sections and 200 measures (call and pillars, a rebased price chart against the benchmark, window statistics, sizing, market model and event study, technicals and indicator signals, technical backtest, financials, DCF, scenario, Bayesian, DuPont and solvency valuation, volatility models and VaR, risk, microstructure and XAI drivers, peer multiples, index returns, systemic), for unlisted runs about 12 (call, dealer-price chart, valuation by model, price profile and revisions, trend, risk and liquidity, market sensitivity, outcome ranges, news and data quality). A marker shows the stronger side only where higher or lower clearly means better. Mixed listed and unlisted pairs are refused. An unlisted profile shows when the company is now listed or has an IPO open; a listed company that was once unlisted shows its pre-IPO history under the valuation panel.

### `/analyzer` and `/analyzer/[id]`
See [event-impact-analyzer.md](event-impact-analyzer.md). Both are `force-dynamic`.

### `/company/[symbol]`: shared layout and ten tabs
`layout.tsx` fetches quote, profile and valuation in parallel. A quote 404 triggers `notFound()`. It renders `CompanyHeader` (price, change, day range, 52-week band, market cap, P/E, freshness) and `CompanyTabs` (route-driven tabs with a sliding underline, immediate highlight on click, and the alert drawer at the right). Symbols are upper-cased. `loading.tsx` skeletons exist for the base route, `macro` and `quant`.

| Tab | Route suffix | Data | Contents |
|---|---|---|---|
| Overview | (none) | candles 1Y, financials, valuation | `PriceChart` (8 horizons, crosshair with OHLC and volume, themed by CSS variables), `ValuationPanel`, quarterly P&L (transposed), annual P&L, key ratios, balance sheet |
| Statistics | `/statistics` | `getYStats` | Valuation measures, share statistics, trading information, profitability and growth, balance sheet and cash flow, most recent quarter, dividends and splits, key executives |
| Analysts | `/analysts` | `getYAnalysts` | Price targets, recommendation trend, earnings and revenue estimates, EPS trend and revisions, growth estimates, earnings history |
| Statements | `/statements` | `getYStatements` | Income statement, balance sheet, cash flow; annual and quarterly (₹ crore) |
| Historical | `/history` | `getYHistory(5Y)` + `getYCompare` | Price table/chart and a "vs Nifty 50" comparison (the page requests the comparison with no peers; the endpoint accepts up to 6) |
| Shareholders | `/shareholding` | `getShareholding` | Ownership composition and trend (quarterly/yearly), change between filings, promoter pledge, SEBI Reg 29 large-holder disclosures, insider trades, Yahoo holder summary |
| Technicals | `/technicals` | client → `/api/technicals` | `TechnicalWorkbench`: bar size 5m/15m/1h/1d, toggleable overlays (SMA/EMA, Bollinger, Supertrend, VWAP, support/resistance) and panes (volume, RSI, MACD, stochastic, MFI, ADX, ATR), signal table with glossary tooltips and a bull/bear tally |
| Research Dossier | `/research` | client → analyzer snapshot | `ResearchPanel`: starts or reuses a no-news analyzer run for the ticker, polls it, then renders the 11-tab `ListedDossier` (event tab hidden) |
| Quant Engine | `/quant` | `getQuant` | Return forecasts with conformal intervals, volatility ensemble, VaR + Merton, Markov regime, microstructure card (Kyle's λ and VPIN shown as unavailable) |
| Macro & News | `/macro` | `getSensitivity`, `getNews(symbol)` | OLS beta/alpha/R² against benchmarks with fit labels (Strong ≥ 0.6, Partial ≥ 0.3, Weak otherwise) and a company-filtered news feed |

### Brand
The logo is the trademark supplied by the project's professor (`components/brand/logo.tsx`): the open-book A mark from `public/brand/arthdex-mark.png`, with the name "ArThDex" (Source Serif 4 bold, navy and teal) and the line LEARN | ANALYZE | INVEST | GROW beside it. The artwork is navy on white, so `arthdex-mark-light.png` carries the same mark with its navy parts lightened for the dark theme, swapped by the `dark:` class. The tagline shows from the 2xl breakpoint in the header and always in the footer. `app/icon.png` and `app/apple-icon.png` are the navy app tile from the brand board. Brand colours: navy #0B2D5B, teal #00A896, gold #F4B942, light #E8EEF4. The files are crops of a raster brand board, so a vector original should replace them when the professor can supply one.

## 4. Shared components and conventions

| Component | Purpose |
|---|---|
| `DataCard` / `StatusPill` | Standard panel shell with title, subtitle, icon, badge, footnote |
| `FreshnessBadge`, `SourceLine`, `IllustrativeBanner`, `DataUnavailable`, `NotAvailable` | The provenance vocabulary (see data-integrity doc). `DataUnavailable` prints the command to start the data service when the failure is a connectivity error |
| `DeskAnalysis` | Renders a backend `insights` payload: headline, metric tiles, toned findings, small tables, method note. Used on Commodities, IPO, Bhavcopy and the MACD screener |
| `SegmentedControl` | Pill selector with sliding indicator. Requires a unique `layoutGroupId` per instance |
| `SwapPanel` | Animated content swap. **Use this, never `AnimatePresence mode="wait"`**: that pattern stalled and left stale data on screen when triggered by a control running its own `layoutId` animation |
| `CellBar` | Table cell with a proportional bar behind the number |
| `Gauge`, `Tip` (MUI tooltip restyled from tokens), `Skeleton`/`PageSkeleton`, `Eyebrow`, `ThemeToggle` | Small primitives |

Conventions worth keeping:
- **Null is `—`, never 0.** Use `formatINR`, `formatPct`, `formatCrore`, `deltaColor` from `lib/utils.ts` (Indian digit grouping; direction colours `up`/`down`/`flat`).
- **All hooks run before any early return** (a lint-caught bug in `price-chart.tsx`).
- **Charts are hand-rolled SVG** that read `hsl(var(--token))`, so theme changes need no redraw logic. Keep generated geometry deterministic for SSR/client parity.
- **Client components cannot import async server components.** That is why `SiteHeader` (server) wraps `HeaderBar` (client).

## 5. Theming and styling

- Tailwind `darkMode: "class"`; tokens are HSL CSS variables in `app/globals.css` for light and `.dark`: `background foreground surface surface-muted surface-raised muted muted-foreground border input ring accent accent-foreground up down flat`.
- Custom utilities: `.glass-panel`, `.text-gradient`, `.bg-grid`, `.hero-aurora`, `.btn-primary`, `.btn-ghost`, `.data-table` (+ `-sticky`), `.dossier` density overrides. Font size `text-2xs`. Animations `marquee`, `fade-up`, `shimmer`, `pulse-glow`.
- Fonts: `font-sans` Inter, `font-display` Sora, `font-deva` Noto Sans Devanagari, `font-mono` system monospace with tabular numerals for figures.
- The design pass applied the taste-skill (vendored at `.claude/skills/taste-skill/`) to the landing page only, with dials VARIANCE 6 / MOTION 3 / DENSITY 4. Em dashes are avoided in user-facing prose but kept as the "not reported" placeholder in tables.
- `next.config.mjs` only sets `reactStrictMode`. ESLint extends `next`.
