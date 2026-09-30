# Arthdex — Project Progress & Session Recovery

> **Purpose:** this file is the single source of truth for cross-session continuity.
> It is updated at the end of every phase. If a session is lost, read this file first.

**Project:** Arthdex — quantitative financial advisory platform (Indian markets)
**Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS 3.4 · Framer Motion · next-themes · Lucide · Recharts + Lightweight Charts
**Root:** `D:\Projects\GoaShipyardLtd\Arthdex`
**Last updated:** 2026-09-30

---

## Phase Status Board

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Project Scaffolding & State Persistence System | ✅ **Completed** |
| 1 | Modern Landing Page, Global Navigation & Market Watch | ✅ **Completed** |
| 2 | Listed Company Dashboard & Screener Charts | ✅ **Completed** |
| 3 | Return Forecasting, Volatility Ensemble & Risk Suite | ✅ **Completed** |
| 4 | Unlisted Space Valuation & Intelligence Hub | ✅ **Completed** |
| 5 | Primary Markets & IPO Intelligence Center | ✅ **Completed** |
| 6 | Macro Benchmark Sensitivity, News & Alert Engine | ✅ **Completed** |

---

## Phase 0 — Completed

### Checklist
- [x] Next.js + TypeScript + Tailwind project initialised (manual scaffold, no `create-next-app`)
- [x] `PROJECT_PROGRESS.md` created with all 6 phases tracked
- [x] Design tokens defined (HSL CSS variables, light + dark)
- [x] `next-themes` ThemeProvider wired (`attribute="class"`, `defaultTheme="system"`, `enableSystem`)
- [x] Framer Motion context (`MotionConfig` + `LazyMotion`, honours reduced-motion)
- [x] TypeScript contracts authored in `/types` for all six domains
- [x] `tsc --noEmit` and `next build` pass clean

### Files created
```
package.json · tsconfig.json · next.config.mjs · postcss.config.mjs
tailwind.config.ts · .eslintrc.json · .gitignore · .claude/launch.json

app/globals.css                         light/dark HSL token sets, .glass-panel, smooth scroll, tabular-nums
app/layout.tsx                          root layout, suppressHydrationWarning, Providers

components/providers/index.tsx          composed Providers (theme + motion)
components/providers/theme-provider.tsx next-themes wrapper
components/providers/motion-provider.tsx Framer Motion global config
components/ui/theme-toggle.tsx          Sun/Moon toggle, hydration-safe, animated swap

lib/utils.ts                            cn(), formatPct, formatDelta, formatINR, formatCrore, deltaColor

types/common.ts · market.ts · ticker.ts · financials.ts
types/quant.ts · unlisted.ts · ipo.ts · macro.ts · index.ts
```

### Design token reference (do not re-invent in later phases)
Semantic Tailwind colors, all driven by CSS variables in `app/globals.css`:
`background` `foreground` `surface` `surface-muted` `surface-raised` `muted` `muted-foreground`
`border` `input` `ring` `accent` `accent-foreground` — plus directional `up` (emerald), `down` (rose), `flat` (amber).
Utility class `.glass-panel` provides the glassmorphism treatment. `font-mono` is pre-set to tabular numerals.
Custom animations available: `animate-marquee`, `animate-pulse-glow`. Custom size: `text-2xs`.

---

## Phase 1 — Completed

### Checklist
- [x] Mock data layer under `/lib/mock-data/`, strictly typed against `/types`
- [x] Aesthetic landing page: animated Framer Motion SVG hero, bento-box grid, glassmorphism, hover reveals, smooth scroll
- [x] App shell header: theme toggle, responsive nav, mobile drawer, live badge
- [x] Continuous market ticker bar: 14 indices (incl. MSEI SX40), 5 macro indicators, 5 commodities
- [x] Market Watch: Top Gainers / Losers with Daily / Weekly / Monthly toggles
- [x] Columns: Scrip, CMP, Abs Change, % Change, 52W High, 52W Low (+ 52-week band position indicator)
- [x] Factor screeners: High Beta, Low Vol, Alpha
- [x] `tsc --noEmit` clean · `next lint` clean · `next build` clean
- [x] Verified live in-browser in **both** light and dark themes; console clean, no hydration warnings

### Files created / modified
```
NEW  lib/mock-data/indices.ts           14 indices — broad, sectoral, thematic, MSEI SX40
NEW  lib/mock-data/macro.ts             Brent, repo−Fed spread (bps), CPI, IIP, Mfg PMI
NEW  lib/mock-data/commodities.ts       gold, silver, copper, zinc, aluminium + 1M momentum
NEW  lib/mock-data/movers.ts            GAINERS/LOSERS keyed by MoverWindow (8 rows each × 3 windows)
NEW  lib/mock-data/screeners.ts         FACTOR_SCREENS keyed by ScreenerFactor + FACTOR_TABS
NEW  lib/mock-data/index.ts             barrel — the single swap seam for the FastAPI backend

NEW  components/landing/hero.tsx        staggered hero, gradient headline, stat strip, CTAs
NEW  components/landing/data-flow-graphic.tsx  seeded SVG factor lattice → 3 forecast paths
NEW  components/landing/bento-grid.tsx  6-card capability grid with grid-rows hover reveal

NEW  components/layout/market-ticker.tsx  seamless -50% marquee, pause-on-hover, edge fades
NEW  components/layout/site-footer.tsx    disclaimer footer
MOD  components/layout/site-header.tsx    ticker + nav + mobile drawer + live badge

NEW  components/market/market-watch.tsx   section shell, window state, gainers/losers panels
NEW  components/market/movers-table.tsx   dense table + 52-week band position dot
NEW  components/market/factor-screener.tsx three factor tabs with animated swap
NEW  components/ui/segmented-control.tsx  generic pill selector, layoutId sliding indicator

MOD  app/page.tsx                         Hero + BentoGrid + MarketWatch composition
MOD  app/globals.css                      added smooth scroll (reduced-motion aware)
```

### Bugs found and fixed during browser verification
1. **Theme-toggle hydration mismatch** — `aria-label` was derived from `resolvedTheme` outside the
   `mounted` guard, so SSR emitted "Switch to dark theme" while the client emitted the opposite.
   Every theme-dependent attribute now stays neutral until after mount.
2. **Ticker bar bleed-through** — the sticky bar used `bg-surface-muted/60` with no backdrop filter,
   so scrolling content collided with the figures. Now `/95` plus `backdrop-blur-xl`, and the edge
   fade gradients were corrected from `from-background` to `from-surface-muted`.
3. Bento featured card had `lg:row-span-2` producing a large dead area; grid rebalanced to two even rows.

### Notes / decisions
- Next.js pinned to `^15.5.26` — the initially installed `15.1.6` carried CVE-2025-66478.
- Tailwind v3.4 chosen over v4 for config-file stability across a 6-phase build.
- `SegmentedControl` is generic over the option id type and takes a **required** `layoutGroupId`;
  two controls sharing an id would animate into each other. Reuse it in later phases.
- The hero SVG uses a seeded LCG (`seededSeries`) rather than `Math.random()` so SSR and client
  markup match. Keep any future generated geometry deterministic for the same reason.
- **Dev-server caveat:** running `next build` while `next dev` is live clobbers `.next` and the dev
  server starts throwing `__webpack_modules__[moduleId] is not a function`. Stop the dev server,
  `rm -rf .next`, then build.

---

## Phase 2 — Completed

### Checklist
- [x] Universal search: animated expand-on-focus, autocomplete over listed / unlisted / IPO,
      keyboard navigation (↑ ↓ Enter Esc) and a ⌘K / Ctrl-K global shortcut
- [x] Price chart: all eight horizons, crosshair with date + OHLC + volume inspector
- [x] Chart re-themes on light/dark switch with no redraw code (every stroke reads a CSS variable)
- [x] Quarterly P&L (8 quarters), Balance Sheet Highlights, Key Ratios
- [x] Peer relative valuation matrix with composite-z-score verdict badge
- [x] Route `/company/[symbol]` + scoped `not-found.tsx`; all 10 companies prerendered via SSG
- [x] `tsc --noEmit` clean · `next lint` clean · `next build` clean (14 static routes)
- [x] Verified in-browser in both themes; console clean on a fresh tab

### Files created / modified
```
NEW  lib/mock-data/companies.ts      10 companies in 2 peer clusters + SEARCH_INDEX + searchEntities()
NEW  lib/mock-data/price-series.ts   deterministic OHLCV per symbol/period + PERIODS + 52W band fit
NEW  lib/mock-data/financials.ts     per-company profile expanded into 8 quarters / 3 FYs / TTM ratios
NEW  lib/mock-data/peers.ts          multiples table, composite z-score, verdictFromZScore, VERDICT_LABEL

NEW  components/search/universal-search.tsx   combobox with roving highlight and ⌘K
NEW  components/company/price-chart.tsx       SVG chart, crosshair, volume histogram, price axis
NEW  components/company/fundamentals.tsx      QuarterlyPnLPanel, BalanceSheetPanel, KeyRatiosPanel, RevenueTrend
NEW  components/company/peer-matrix.tsx       PeerMatrix + reusable ValuationBadge
NEW  components/company/company-header.tsx    quote strip, stat grid, 52-week rail
NEW  app/company/[symbol]/page.tsx            generateStaticParams + generateMetadata
NEW  app/company/[symbol]/not-found.tsx       coverage-universe fallback

MOD  components/layout/site-header.tsx        search wired into desktop bar and mobile drawer
MOD  components/market/movers-table.tsx       symbols link to their dashboard when in the registry
MOD  types/common.ts                          Candle.date documented as ISO date OR timestamp (intraday)
MOD  lib/mock-data/index.ts                   re-export the four new modules
```

### Bugs found and fixed during browser verification
1. **Price-axis labels didn't line up with the gridlines.** They were laid out with
   `justify-between` over a fixed 260px column while the gridlines came from the SVG's own
   y-scale over a 328-unit viewBox. Labels are now positioned from that same scale, converted
   to a percentage of the viewBox height.
2. **Generated series escaped the quoted 52-week band** — GRSE's 1Y path peaked above its own
   52W High shown in the header. Series at daily granularity and finer are now scaled to fit
   the band, anchored so the right edge still lands exactly on CMP.

### Rejected approach (do not retry)
Scaling the upside and downside of a price path by *independent* factors, so the 1Y chart would
span the full 52-week range. Where one bound is far slacker than the other — GRSE has ~₹460 of
headroom versus ~₹1,214 of legroom — it amplifies every small dip into a deep spike and destroys
the shape of the walk. The symmetric factor is used instead. Consequence: a 1Y chart touches
whichever bound is tighter and may not approach the other. That is an accepted limitation of
anchoring a random walk at CMP, not a bug.

### Notes / decisions
- The chart is hand-rolled SVG rather than Lightweight Charts or Recharts. Reading
  `hsl(var(--up))` etc. directly means a theme switch re-themes it with no listener and no
  redraw — which is exactly what the phase brief asked for. `lightweight-charts` and `recharts`
  remain installed but unused; drop them if nothing in Phases 3–6 needs them.
- `preserveAspectRatio="none"` stretches the chart to full width; strokes are kept 1px with
  `vectorEffect="non-scaling-stroke"`. Text is therefore rendered as HTML overlays, never `<text>`.
- Financial statements are *derived*, not hand-keyed: operating profit always equals revenue less
  opex and OPM% always reconciles. Change a company's `CompanyProfile`, not individual quarters.
- Peer verdicts are fully derived — adding a company to a `CLUSTERS` entry re-bases every other
  member's z-score automatically.
- IT-services companies carry no order backlog; `KeyRatiosPanel` renders an explicit
  "Not applicable" state with a footnote rather than a misleading zero.

---

## Phase 3 — Completed

### Checklist
- [x] Company route restructured: `layout.tsx` holds the quote strip + route-driven tab strip,
      so Overview and Quant Engine share one header
- [x] Multi-horizon return forecasts (1D / 5D / 21D) with 95% conformal intervals and confidence
- [x] Four-model volatility ensemble with weights summing to 1 and a reconciling consensus
- [x] Merton distance to default + solvency barrier; VaR suite (parametric / historical /
      Monte Carlo / Expected Shortfall)
- [x] Kyle's λ, VPIN toxicity gauge, Hamilton 2-state regime with transition matrix and
      expected sojourn duration
- [x] XAI Shapley waterfall, additive to the 21-day forecast by construction
- [x] `tsc --noEmit` clean · `next lint` clean · `next build` clean (24 static routes)
- [x] Verified in-browser in both themes across both peer clusters (GRSE and TCS)

### Files created / modified
```
NEW  lib/mock-data/quant.ts                    getQuantBundle() + normCdf/phi + vol & beta lookups
NEW  components/quant/quant-card.tsx           shared QuantCard shell + StatusPill
NEW  components/quant/return-forecasts.tsx     shared-scale conformal interval rails
NEW  components/quant/volatility-ensemble.tsx  model table with vol bars and weight bars
NEW  components/quant/risk-suite.tsx           Merton tiles + VaR magnitude table
NEW  components/quant/microstructure-xai.tsx   Microstructure + ShapleyAttributionCard
NEW  components/company/company-tabs.tsx       route-driven tabs with sliding layoutId underline
NEW  app/company/[symbol]/layout.tsx           shared header + tabs, notFound guard
NEW  app/company/[symbol]/quant/page.tsx       four-card quant grid
MOD  app/company/[symbol]/page.tsx             now the Overview panel only (header moved to layout)
MOD  lib/mock-data/index.ts                    re-export quant
```

### Consistency model (important for later phases)
No figure on the quant tab is free-floating; each is derived from something the app already shows:
- **Volatility anchor** is read from `FACTOR_SCREENS` when the symbol appears there, so the quant
  tab and the landing-page screener can never disagree. `VOL_FALLBACK` covers the four IT names.
- **Momentum** for forecasts and the regime comes from the peer table's `oneYearReturnPct`.
- **Merton** reads market cap from the quote and borrowings / total assets from the balance sheet.
- **Kyle's λ and VPIN** are driven by the quote's traded volume × CMP.
- **Ensemble consensus** is the literal weight × volatility sum of the rows displayed above it.
- **Shapley contributions** are normalised to sum exactly to the 21-day forecast.

### Bugs found and fixed during browser verification
1. **Expected Shortfall fell below Historical VaR** (GRSE: ES 9.10% vs historical VaR 9.17%).
   ES is the mean loss *beyond* the threshold and must exceed every VaR at the same confidence.
   The cause was mixing a Gaussian closed-form ES with fat-tail-adjusted VaR measures. ES is now
   the Gaussian ES/VaR ratio applied to the **largest** of the three VaR measures, which makes the
   ordering hold by construction for every symbol.
2. **Mislabelled solvency barrier ratio** — the caption read "% of assets" while the denominator
   was market asset value V, not book total assets. Relabelled "of asset value".

### Notes / decisions
- The Merton default barrier is short-term debt plus half of long-term debt, **plus** an
  operating-liabilities proxy of 15% of total assets. Without that proxy most of this universe is
  debt-free, which sends distance to default to infinity and makes the card meaningless.
- `normCdf` is Abramowitz & Stegun 7.1.26 (|error| < 7.5e-8) — adequate here, but if a real
  backend ever needs tail probabilities below ~1e-7, replace it.
- Signal confidence across horizons is dominated by the per-symbol jitter rather than by horizon
  decay, so the three values cluster near each other. Defensible (a longer horizon carries more
  signal *and* more decay) but if the intent is a visibly monotonic decay, raise the `days`
  coefficient in `buildForecasts`.
- **Do not read figures off downscaled screenshots** when verifying — two readings were wrong
  during this phase. Use `javascript_tool` to read the DOM instead.

---

## Phase 4 — Completed

### Checklist
- [x] `/unlisted` index listing tracked firms with governance verdict and headline metrics
- [x] `/unlisted/[id]` profile — both routes the search index already pointed at now resolve
- [x] Valuation & growth: 3Y revenue/EBITDA CAGR, OCF, FCF, order book, order-book-to-revenue,
      implied valuation / P/E / EV-EBITDA off the last secondary deal
- [x] Governance tracker: severity-coded flag cards, severity counts, sorted most-severe-first
- [x] Milestone timeline: order wins, client references, hires, certifications, funding
- [x] Comparative toggle: unlisted multiple vs listed comparables, P/E ↔ EV/EBITDA
- [x] "Unlisted" header nav enabled
- [x] `tsc --noEmit` clean · `next lint` clean · `next build` clean (28 static routes)
- [x] Verified in-browser in both themes; fresh-tab console clean
- [x] **Deferred Phase 3 check cleared** — `/company/[symbol]/quant` confirmed console-clean
      on a fresh tab

### Files created / modified
```
NEW  lib/mock-data/unlisted.ts                    2 companies, governanceScore/governanceVerdict
NEW  components/unlisted/unlisted-header.tsx      deal price, implied multiples, stat grid
NEW  components/unlisted/scale-metrics.tsx        growth tiles + revenue-vs-EBITDA CAGR bars
NEW  components/unlisted/governance-tracker.tsx   severity-coded flag cards with counts
NEW  components/unlisted/milestone-timeline.tsx   spined timeline, newest first
NEW  components/unlisted/peer-comparison.tsx      client toggle, shared-scale bars vs listed peers
NEW  app/unlisted/page.tsx                        coverage index
NEW  app/unlisted/[id]/page.tsx                   profile, generateStaticParams
MOD  lib/mock-data/peers.ts                       exported getMultiples() for the comparison view
MOD  lib/mock-data/index.ts                       re-export unlisted
MOD  components/layout/site-header.tsx            Unlisted nav link enabled
```

### Design decisions
- **Governance scoring is deliberately non-linear**: red-flag 6, watch 2, info 0. A linear count
  would let a company with many well-documented disclosures score worse than an opaque one with
  nothing filed. Thresholds: ≥6 Red Flag, ≥2 Watchlist, else Clean.
- An `info` flag means *a disclosure was found and checked*, not *no risk*. The card footnote says
  so explicitly — this is the sort of thing a reader will otherwise misread.
- The comparison discount is struck against the listed **median**, not mean, so one richly-valued
  peer can't drag the benchmark.
- Unlisted profiles reuse `QuantCard` / `StatusPill` from `components/quant/`. If Phase 5 or 6
  needs a third consumer, consider promoting that file to `components/ui/`.
- Droneacharya carries negative FCF against positive OCF. The card swaps its footnote to explain
  the capex gap rather than leaving a red number unexplained.

### Verified figures (spot checks)
- Droneacharya P/E 46.2 vs listed median 56.9 (BEL 51.4, BDL 62.4) → −18.8% discount ✓
- Droneacharya EV/EBITDA 29.8 vs median 39.7 (BEL 34.8, BDL 44.6) → −24.9% ✓
- Pixel Vision P/E 28.4 vs median 51.4 (BEL 51.4, BDL 62.4, HAL 38.9) → −44.7% ✓
- Pixel Vision milestone value disclosed ₹724 Cr = 640 + 84 ✓
- Margin trajectory "Compressing −25.6%" = EBITDA CAGR 38.6 − revenue CAGR 64.2 ✓

No defects were found in this phase's browser verification.

---

## Phase 5 — Completed

### Checklist
- [x] `/ipo` hub — pipeline with Mainboard ↔ SME segment tabs and five lifecycle sections
- [x] `/ipo/[id]` detail for all 10 issues; `/ipo/garuda-aerospace` (which the search index
      already linked to) now resolves
- [x] GMP tracker with issue dropdown, implied listing gain, off-peak and per-row trend deltas
- [x] Subscription book with category multiples; post-listing performance vs issue, vs listing,
      and vs what the grey market predicted
- [x] Subscription alert builder — bucket × comparator × threshold, live-evaluated, with presets
- [x] `QuantCard` promoted to `components/ui/data-card.tsx` as `DataCard` (3rd consumer area)
- [x] `tsc --noEmit` clean · `next lint` clean · `next build` clean (39 static routes)
- [x] Verified in-browser in both themes; fresh-tab console clean

### Files created / modified
```
NEW  lib/mock-data/ipo.ts                       10 issues, gmpSeries/withListingPerformance builders
NEW  components/ui/swap-panel.tsx               SwapPanel — safe animated content swap (see bug 1)
NEW  components/ipo/ipo-pipeline.tsx            segment tabs + lifecycle sections
NEW  components/ipo/gmp-tracker.tsx             dropdown selector, premium history table
NEW  components/ipo/issue-detail.tsx            IssueHeader, SubscriptionBook, ListingPerformance
NEW  components/ipo/subscription-alerts.tsx     client-side threshold alert builder
NEW  app/ipo/page.tsx                           hub
NEW  app/ipo/[id]/page.tsx                      detail, generateStaticParams
MOV  components/quant/quant-card.tsx         →  components/ui/data-card.tsx (QuantCard → DataCard)
MOD  components/market/factor-screener.tsx      AnimatePresence mode="wait" → SwapPanel
MOD  components/market/market-watch.tsx         AnimatePresence mode="wait" → SwapPanel
MOD  components/unlisted/peer-comparison.tsx    AnimatePresence mode="wait" → SwapPanel
MOD  components/layout/site-header.tsx          IPO nav link enabled
MOD  lib/mock-data/index.ts                     re-export ipo
```

### Bug 1 — `AnimatePresence mode="wait"` stall (IMPORTANT, affects future work)
The IPO segment toggle set state to `sme` but the panel kept rendering Mainboard rows. The
outgoing child was frozen mid-exit (`opacity: 0.073; transform: translateY(-5.58px)`), so
`AnimatePresence` never received its exit-complete callback and never mounted the incoming child.
It is a **silent stale-data stall**, not a flicker — the worst failure mode for a data terminal.

It reproduces when the swap is triggered by a control that is itself running a `layoutId`
animation in the same subtree, which is exactly the `SegmentedControl`-drives-panel pattern used
throughout this app. Three earlier components (`factor-screener`, `market-watch`,
`peer-comparison`) used the identical pattern; they happened to work but shared the failure mode.

**Fix:** `components/ui/swap-panel.tsx`. A keyed element animating on entry only — same visual
result, no dependency on an exit callback. All four sites now use it, and all four were
regression-tested after conversion.

**Rule for Phase 6 and beyond:** do not use `AnimatePresence mode="wait"` for content swaps. Use
`SwapPanel`. `AnimatePresence` remains correct for genuine mount/unmount presence — the search
dropdown, the mobile drawer and the alert list still use it and are fine.

### Design decisions
- **Alerts are explicitly non-functional and say so.** They live in component state; there is no
  persistence and no delivery channel. The footnote reads "held in this page's memory only… nothing
  will notify you". Implying a notification would arrive would be the dishonest option here.
- Derived-not-keyed, as elsewhere: `gmpSeries()` computes implied listing gain from the upper band,
  and `withListingPerformance()` computes listing gain and CMP-vs-issue. Neither can drift.
- The GMP card reports **trend**, not just level — a premium that is still positive but falling
  ("Cooling") is a different signal from one climbing ("Firming"), and the headline number hides it.
- Post-listing performance separates "CMP vs Issue" from "Since Listing", because a listing pop
  that has since faded is a different outcome from one that held.
- The GMP footnote states plainly that it is an unregulated quote from a thin market with no
  settlement mechanism.
- Planning-stage issues render explicit empty states rather than zeros: "Terms not filed", no GMP
  card at all, and a note that alerts stay pending until bidding opens.

### Verified figures (DOM reads, not screenshots)
- Northpeak: issue ₹236 → listing ₹371 = +57.2% ✓ · CMP ₹412.65 = +74.8% vs issue ✓ ·
  since listing +11.2% ✓ · peak GMP ₹132/236 = +55.9%, actual beat by 1.3% ✓
- Vantage: GMP −₹14 / ₹536 = −2.6% implied ✓ · off-peak −141.2% from ₹34 ✓ · "Discount" pill ✓
- Havelock alerts: QIB ≥ 10x → Condition met (14.62x) ✓ · Retail ≥ 50x → Not met (9.18x) ✓
- Segment toggle: Mainboard → SME → Mainboard all render the right issue sets ✓

---

## Phase 6 — Completed

### Checklist
- [x] Benchmark sensitivity panel (β, α, R², abnormal return) against six indices, as a third
      company tab `/company/[symbol]/macro`
- [x] Global sentiment strip — six world indices with breadth, on the landing page
- [x] Curated news feed with LODR / stake-sale / earnings / rating / order-win flags —
      company-filtered on the macro tab, market-wide on the landing page
- [x] Custom alert engine as a right-hand drawer, reachable from the company tab bar
- [x] Production wrap-up: types, lint, build, light/dark sweep over every route
- [x] `recharts` and `lightweight-charts` removed — unused since Phase 2
- [x] `tsc --noEmit` clean · `next lint` clean · `next build` clean (49 static routes)
- [x] Console clean on a fresh tab across every route

### Placement decisions (as requested)
- **Sensitivity + company news** → third company tab, `Macro & News`. They are company-scoped, so
  they belong beside Overview and Quant Engine rather than on a global page.
- **Global sentiment + market-wide news** → landing page, below Market Watch. These are
  pre-open context, not per-company analysis.
- **Alert engine** → drawer launched from the company tab bar. Alerts are company-specific, so
  the trigger lives wherever a company is on screen, on all three tabs.

### Files created / modified
```
NEW  lib/mock-data/sensitivity.ts                 getSensitivities, primaryBenchmark,
                                                  GLOBAL_INDICES, NEWS_ITEMS, newsForSymbol
NEW  components/macro/benchmark-sensitivity.tsx   β / α / R² / abnormal table
NEW  components/macro/global-sentiment.tsx        six world index cards + breadth
NEW  components/macro/news-feed.tsx               flagged feed, reused on two surfaces
NEW  components/alerts/custom-alert-engine.tsx    right-hand drawer, live evaluation
NEW  app/company/[symbol]/macro/page.tsx          third company tab
NEW  app/not-found.tsx                            root 404
MOV  app/company/[symbol]/not-found.tsx        →  app/company/not-found.tsx  (see bug 2)
MOD  components/company/company-tabs.tsx          third tab + `action` slot for the alert trigger
MOD  app/company/[symbol]/layout.tsx              builds alert metric list, mounts the drawer
MOD  app/page.tsx                                 global sentiment + market-wide news
MOD  lib/mock-data/quant.ts                       BETA_FALLBACK for the four IT names
MOD  lib/mock-data/index.ts                       re-export sensitivity
DEL  recharts, lightweight-charts                 from package.json
```

### Bug 1 — beta and R² were generated independently
The first cut gave GRSE a beta of 2.06 against Nifty IT with an R² of 0.25 — an impossible row.
For a single-factor regression `β = ρ·(σ_stock/σ_benchmark)` and `R² = ρ²`, so a weak fit caps
beta; the two cannot be drawn separately.

Both are now derived from **one correlation per pair**. The Nifty 50 correlation is *implied* by
the published beta (`ρ = β·σ_m/σ_i`), which keeps `betaFor()` as the single anchor the screener and
quant tab already report; other benchmarks scale that correlation by a sector-affinity factor.
Result: GRSE's non-native betas fell to 0.33–0.56 with R² 0.02–0.05, and TCS correctly resolves
Nifty IT as its primary benchmark at R² 0.70.

### Bug 2 — company 404 regressed silently in Phase 3
`/company/NOTREAL` was serving Next's default 404 instead of the coverage-universe page built in
Phase 2. Adding `app/company/[symbol]/layout.tsx` in Phase 3 moved the boundary: a `notFound()`
thrown **from a layout** is caught by the *parent* segment, not by a `not-found.tsx` sitting
beside that layout. Moving the file to `app/company/not-found.tsx` restores it. A root
`app/not-found.tsx` was added at the same time.

*Lesson worth carrying:* adding a layout can silently relocate an error boundary. Re-test 404
paths after introducing one.

### Design decisions
- Alpha and abnormal return are deliberately **both** shown and are different quantities: alpha is
  risk-adjusted (realised less CAPM-required at that beta), abnormal return is the plain excess
  over the index. The footnote says why they differ.
- Defence and shipbuilding names have no dedicated NSE index here, so Nifty 50 is treated as their
  native benchmark. Pretending Nifty Metal is a sector proxy for a shipyard would be worse.
- A "Weak fit" pill is shown honestly even when it lands on the *primary* benchmark — GRSE's best
  fit is Nifty 50 at R² 0.20, which is genuinely weak for a stock with 54% volatility. The panel
  warns that beta and alpha estimated from a poor fit should be read with caution.
- News flags encode **disclosure type**, not sentiment. A stake sale and an order win are both
  material; colour helps a reader scan, it does not tell them what to conclude.
- The alert drawer's "not saved, nothing will notify you" notice sits pinned below the header, not
  in a footnote — same honesty rule as the IPO alerts.
- Alert thresholds seed from the metric's current value, so the default is a sensible anchor.

### Verified figures (DOM reads)
- GRSE Nifty 50: β 1.86 (matches `FACTOR_SCREENS`) · α +52.8% = 68.4 − (6.5 + 1.86×4.9) ✓ ·
  abnormal +57.0% = 68.4 − 11.4 ✓
- TCS Nifty IT: primary at R² 0.70 · α −10.2% = −24.6 − (6.5 + 0.80×−26.1) ✓ ·
  abnormal −5.0% = −24.6 − (−19.6) ✓
- Alerts on TCS (P/E 22.4): seeded 22.4 · "< 25" → Condition met · "< 22" → Not met ·
  event metric → Awaiting calendar ✓
- Global breadth 4/6 advancing (67%) ✓
- `/company/NOTREAL` → "Symbol not covered" · `/nonexistent-route` → "Page not found" ✓

---

# Project Complete

All seven phases (0–6) are done. `tsc --noEmit`, `next lint` and `next build` pass clean;
**49 routes** prerender statically.

### What Arthdex is
A Next.js 15 App Router front end for an Indian-market quantitative advisory platform, built
against a fully typed mock data layer designed to be swapped for a FastAPI backend. Every module
in `/lib/mock-data/` carries its target endpoint in a header comment.

### Surfaces
| Route | Contents |
|---|---|
| `/` | Animated hero, bento capabilities, market ticker, movers + factor screens, global sentiment, news |
| `/company/[symbol]` | Price chart with crosshair, quarterly P&L, balance sheet, ratios, peer valuation |
| `/company/[symbol]/quant` | Conformal forecasts, volatility ensemble, Merton + VaR, microstructure, Shapley |
| `/company/[symbol]/macro` | Benchmark sensitivity, company news feed |
| `/unlisted`, `/unlisted/[id]` | Private-market coverage, governance flags, milestones, listed comparison |
| `/ipo`, `/ipo/[id]` | Pipeline, GMP tracker, subscription book, listing performance, alerts |

### The one rule that shaped the codebase
**No figure is free-floating.** Every derived number traces to something the app already shows —
the screener's volatility, the balance sheet's leverage, the quote's traded volume, the peer
table's one-year return. Ensemble consensus is the literal weighted sum of its own rows; Shapley
contributions sum to the forecast they explain; beta and R² share one correlation; GMP implied
gain is computed from the price band. Several bugs found across these phases were violations of
exactly this rule, and they were only ever visible in the browser — never in the build.

### Known limitations
- All data is mock. The disclaimer in the footer states this and that Arthdex is not a registered
  investment adviser.
- Both alert engines are client-side only: no persistence, no delivery. Both say so in the UI.
- The 1Y price chart touches whichever 52-week bound is tighter and may not approach the other —
  see the Phase 2 "Rejected approach" note before attempting to change this.
- `normCdf` is an Abramowitz & Stegun approximation; replace it if tail probabilities below
  ~1e-7 ever matter.
- Quant signal confidence clusters across horizons rather than decaying monotonically — see the
  Phase 3 note.

### For the backend handover
Replace each `/lib/mock-data/*.ts` module with a fetch against the endpoint named in its header
comment. The `/types` contracts are the interface; nothing in `/components` imports mock data
shapes directly, only the types. `components/ui/data-card.tsx`, `segmented-control.tsx` and
`swap-panel.tsx` are the shared primitives — **use `SwapPanel` for content swaps, never
`AnimatePresence mode="wait"`** (see the Phase 5 bug note).

---

# REBUILD: Live Data (Phases 7+)

**Decision, 2026-09-30:** replace the mock layer with real captured data.
Chosen: free/delayed sources to start (Yahoo Finance + NSE public JSON), a Python
FastAPI service for the quant models, no-source data kept but clearly labelled
illustrative, and news from exchange filings + RSS combined.

## Verified feasibility (all probed live from this machine)
| Capability | Status |
|---|---|
| Listed quotes / OHLCV (`yfinance`, `.NS`) | WORKS — GRSE real CMP Rs 2,206.10 |
| NSE `/api/allIndices` | WORKS — incl. pe, pb, dy, advances/declines, 30d/365d change |
| NSE `/api/live-analysis-variations` gainers/losers | WORKS |
| NSE `/api/ipo-current-issue` | WORKS — real live issues |
| NSE `/api/corporate-announcements` | WORKS — real LODR filings + PDF links |
| GARCH / EGARCH / FIGARCH (`arch` 8.0.0, py3.14) | WORKS — fitted on 498 real GRSE obs |
| HAR-RV (`statsmodels` 0.15.0) | WORKS |

Real GRSE fit: realised ann vol 52.27%; GARCH 32.92%, EGARCH 36.60%,
FIGARCH 42.65%, HAR-RV 45.45%. Ensemble weights can now come from AIC.

## Data-quality gotchas found while probing (do not re-discover these)
1. **Yahoo's latest row is an incomplete session**: OHLC come back `NaN` with a
   real `Volume`. Must `dropna(subset=["Close"])` — handled in `yahoo.fetch_history`.
2. **52-week fields are `yearHigh` / `yearLow`**, NOT `fiftyTwoWeekHigh/Low`.
3. **NSE requires primed cookies** from a home-page GET plus a browser
   impersonation (`curl_cffi`, `impersonate="chrome"`). Handled in `nse._build_session`,
   with a one-shot re-prime retry in `nse.nse_get`.
4. **NSE spells the losers bucket `loosers`** in the variations endpoint.
5. Yahoo market cap is in rupees; the UI works in crore (divide by 1e7).

## NO LIVE SOURCE EXISTS (keep, label illustrative)
- Unlisted share prices / valuations — dealer quotes only, no API; scraping
  UnlistedZone / Altius violates their terms.
- IPO grey-market premium — unofficial by definition, no exchange publishes it.
- Kyle's lambda / VPIN — need tick-level order flow, absent from all retail tiers.

## Phase 7 — COMPLETE (verified live)

FastAPI service under `backend/`, every endpoint hit and confirmed returning real
data. See `backend/README.md` for the endpoint table and upstream quirks.

```
backend/app/config.py              TTL settings, CORS origins, NSE base
backend/app/cache.py               TTLCache; serves stale-on-failure, reports age
backend/app/schemas.py             envelope() — source / delay / cache age on every payload
backend/app/providers/yahoo.py     quotes, candles, profile, valuation, global indices
backend/app/providers/nse.py       indices, movers (7 universes), IPOs, announcements
backend/app/providers/fundamentals.py  quarterly + annual P&L, balance sheet, derived ratios
backend/app/routers/health.py      /health, /cache
backend/app/routers/market.py      /indices, /movers, /mover-universes, /global
backend/app/routers/company.py     /quote, /profile, /candles, /financials, /valuation
backend/app/main.py                app, CORS, router wiring
backend/README.md                  endpoints, response shape, upstream quirks
```

### Verified live (2026-09-30)
| Endpoint | Real result |
|---|---|
| `/market/indices` | 16 NSE indices; Nifty 50 = 22,702.55 |
| `/market/movers` (nifty50) | ICICIBANK +2.81%, TCS +1.98%, KOTAKBANK +1.92% |
| `/market/movers` (fo, losers) | APOLLOHOSP −5.48%, FORTIS −5.36%, MAXHEALTH −5.18% |
| `/market/global` | S&P 500 = 7,670.84; 6 indices |
| `/company/GRSE/quote` | ₹2,208.20; 52w 1,963.70–3,339.00; m-cap ₹25,295 Cr |
| `/company/GRSE/candles?period=1D` | 30 intraday 5-min bars, 09:15 → 11:40 |
| `/company/GRSE/candles?period=1Y` | 251 daily bars |
| `/company/GRSE/financials` | 5 quarters, 4 FYs; FY26 ROE 28.48%, ROCE 29.21% |
| `/company/TCS/financials` | FY26 ROE 45.89%, ROCE 56.55%, D/E 0.105 |
| `/company/HINDUNILVR/financials` | FY26 ROE 30.86%, ROCE 27.32% |

### Bugs found and fixed during Phase 7 verification
1. **Dividend yield of 87% for GRSE.** Yahoo mixes conventions inside one
   payload: `returnOnEquity` / `profitMargins` are fractions, `dividendYield` is
   already a percentage. Scaling both identically inflated yields 100×.
   Now scaled separately; GRSE reads 0.87%, TCS 3.14%, ITC 6.03%.
2. **Movers were rights entitlements and penny stocks.** `allSec` returned
   `CENTEXT-RE` at ₹3.70 +32.6% as the top gainer. A rights entitlement is not a
   share. Added seven selectable universes, defaulted to `gt20`, and excluded
   hyphenated symbols.
3. **Fabricated trailing-twelve-month ratios.** Yahoo's quarterly series is
   missing Q2 FY26 for both GRSE and TCS, so "last four quarters" summed two Q1s
   and skipped a Q2 — producing an ROE that looked precise and was wrong. Added a
   contiguity guard (`_contiguous_tail`), and when the run is broken the ratios
   fall back to the latest full fiscal year with `ratios.basis` stating which
   period was actually used.

## Remaining roadmap
- **Phase 10**: COMPLETE — see the Phase 10 section at the end of this file.
  add top-level routes `/market-watch`, `/news`, `/alerts`; add delay/staleness
  badges and illustrative banners. NOTE: company pages, IPO hub, market watch,
  news feed and alerts ALREADY EXIST from Phases 1-6 — this is a data swap plus
  a route promotion, not a rebuild.
- **Phase 11**: COMPLETE — see the Phase 11 section at the end of this file.

## Phase 8 — COMPLETE (verified live)

Quant engine on real return series. `backend/app/services/quant.py`,
`backend/app/services/sensitivity.py`, `backend/app/routers/quant.py`.
Full method notes in `backend/README.md`.

### Verified live on GRSE (742 daily observations, 3 years)
| Output | Real result |
|---|---|
| Realised annualised vol | 54.84% |
| GARCH(1,1) / EGARCH(1,1) / FIGARCH / HAR-RV | 33.87 / 40.82 / 37.61 / 41.41% |
| Ensemble weights (inverse out-of-sample MSE) | 0.253 / 0.257 / 0.234 / 0.256 |
| Consensus vol | 38.46% |
| VaR 1D 99% — parametric / historical / Monte Carlo | 5.64 / 7.71 / 10.40% |
| Expected Shortfall (historical basis) | 10.02% |
| Merton distance to default | 3.07σ, PD 0.109%, barrier ₹7,878 Cr |
| Markov regime | BULL_LOW_VOL p=0.884; regimes 27.6% / 78.7% ann vol; converged |
| Forecasts 1D / 5D / 21D | +0.09% / +1.10% / +5.24% |

### Sensitivity regressions (real OLS)
TCS vs Nifty IT: **beta 0.92, R² 0.756, t=39.0** — correctly selected as primary.
GRSE vs Nifty IT: beta 0.26, R² 0.014 — correctly unrelated. GRSE's primary is
Nifty Next 50 (R² 0.269) with betas 1.5–1.8 against broad indices.

Note: the beta/R² consistency that had to be hand-engineered in Phase 6 now
emerges naturally, because both come from the same real regression.

### Bugs found and fixed during Phase 8 verification
1. **Realised volatility of 126% for GRSE, no model converging.** The quant
   engine called the chart period map, where `3Y` deliberately coarsens to
   *weekly* bars. Weekly returns were being annualised with sqrt(252) and left
   only ~156 observations. Added `yahoo.fetch_daily_history()`; the engine now
   always uses daily bars. Realised vol corrected to 54.84% on 742 observations.
2. **5D and 21D forecasts identical to 1D.** Summing a geometrically decaying
   AR(1) path collapses to the one-step forecast when phi is near zero, which it
   is for any equity return series. Replaced with the correct cumulative
   expectation `h*mu + (r_t - mu) * phi(1 - phi^h)/(1 - phi)`. Drift now scales
   with horizon.
3. **Transition matrix was column-stochastic.** statsmodels returns
   `regime_transition[i, j]` as the probability of moving FROM j TO i. Rendered
   as-is it would read backwards in the UI. Transposed to row-stochastic and
   reordered to `[lowVol, highVol]` to match the labels, since statsmodels' own
   state numbering is arbitrary.
4. **Merton current-liabilities wiring was dead code** — the expression always
   resolved to `None`. Added `currentLiabilities` to the balance-sheet payload
   and wired it through.

### Method decisions worth keeping
- **Akaike weights rejected** for the ensemble: they require a common likelihood,
  and HAR-RV is an OLS fit on realised variance, not a likelihood fit on returns,
  so its AIC is not comparable with the GARCH family's. Inverse out-of-sample MSE
  is comparable across all four.
- **No artificial VaR/ES ordering.** In the mock build, ES was forced above every
  VaR measure. That was right there because all were Gaussian; it is wrong here.
  ES is now reported as the empirical conditional mean beyond the *historical*
  VaR — a matched pair whose ordering holds by construction. Monte Carlo VaR can
  legitimately exceed it when the fitted Student-t tail (df≈3) is fatter than the
  realised sample.
- **Signal confidence rises with horizon** because drift scales with time while
  the conformal interval scales with its square root. That is a real
  signal-to-noise property, not a claim that long forecasts are more reliable —
  the response note says so explicitly.

## Phase 9 — COMPLETE (verified live)

IPO pipeline, combined news/filings feed, and full-universe company search.

```
backend/app/providers/rss.py        4 financial-press feeds, entity/tag cleaning
backend/app/providers/universe.py   NSE equity master CSV (~2,600), search ranking
backend/app/providers/nse.py        + fetch_upcoming_ipos, fetch_past_issues
backend/app/services/ipo.py         segmentation, status classification, listing performance
backend/app/services/news.py        filing + press merge, flag classification, ticker matching
backend/app/routers/ipo.py          /api/v1/ipo, /api/v1/ipo/{id}
backend/app/routers/news.py         /api/v1/news
backend/app/routers/search.py       /api/v1/search, /api/v1/universe/stats
```

### Verified live (2026-09-30)
| Surface | Real result |
|---|---|
| IPO pipeline | 7 ongoing, 10 closed, 70 listed; 63 mainboard / 24 SME |
| Ongoing split | 4 mainboard (VNL, NITYAS, SRIT, SHAHINVEST) + 3 SME |
| Listing performance | ADROITIND +85.4%, ELEVATE −3.9%, ARMEE −15.9% (listed today) |
| News feed | 20 exchange filings + 69 press items |
| Filing flags | order-win, credit-rating, board-outcome, insider-window, management-change |
| Search universe | 2,592 equities (2,328 EQ, 237 BE, 27 BZ) |
| Search ranking | "garden reach" → GRSE; "reliance" → RELIANCE first |

Cross-check: ARMEE appears as a −15.9% IPO listing *and* in the live losers list
at −15.5% — two independent endpoints agreeing on the same real event.

### Bugs found and fixed during Phase 9 verification
1. **Press headlines tagged with no tickers.** Two causes: the router never
   supplied a symbol universe, and the matcher required four-plus characters so
   TCS, ITC and IOC could never match. Wired the real NSE universe through and
   lowered the floor to three, with `AMBIGUOUS_SYMBOLS` filtering English words
   that happen to be tickers. 7 of 50 press items now tag correctly.
2. **Filing and press timestamps were not comparable.** NSE publishes
   `30-Sep-2026 01:18:34` while RSS is ISO; string-sorting interleaved them
   arbitrarily, and the sort was ascending so the feed opened with the oldest
   item. Both are normalised to ISO and sorted newest-first.

### Design decisions
- **`kind` separates filings from press.** An NSE announcement is a primary-source
  LODR disclosure; a Moneycontrol headline is commentary. Merging them into one
  undifferentiated "news" list would flatten that distinction.
- **Flags come from NSE's own category taxonomy** where available, not keyword
  guessing. Keyword rules are reserved for press items, which carry no category.
- **Company names are deliberately not matched** in headlines — "Wipro" will not
  tag WIPRO. Name matching produces false positives that ticker matching does not.
- **"HPCL" correctly fails to match** because NSE's symbol is HINDPETRO. That is
  accurate behaviour, not a gap.
- Search ranks exact symbol → symbol prefix → name prefix → substring, so "TCS"
  cannot be outranked by West Coast Paper Mills.

### Still unavailable (stated in the API response, not hidden)
- IPO planning/DRHP stage — SEBI territory, no free API.
- Grey-market premium — unofficial, unpublished by any exchange.
- Kyle's lambda / VPIN — need tick-level order flow.
# Phase 10 — Frontend swapped to live data

Status: **complete**, verified in-browser. `tsc --noEmit`, `next lint` and
`next build` all clean.

## What changed

The mock layer is gone. `lib/mock-data/` is deleted; the only non-live module
left is `lib/illustrative/unlisted.ts`, and every surface that renders it shows
a prominent banner saying so.

```
NEW  lib/api/client.ts                    envelope-aware fetch, revalidate map, typed errors
NEW  lib/api/types.ts                     payload shapes mirroring the backend exactly
NEW  lib/api/endpoints.ts                 one typed function per endpoint
NEW  components/ui/data-provenance.tsx    FreshnessBadge, SourceLine, IllustrativeBanner,
                                          DataUnavailable, NotAvailable
NEW  components/layout/header-bar.tsx     client nav split out of the header
NEW  components/market/movers-preview.tsx compact live movers for the landing page
NEW  components/company/valuation-panel.tsx
NEW  components/quant/regime-card.tsx     RegimeCard + MicrostructureCard
NEW  components/alerts/alerts-workbench.tsx
NEW  app/market-watch/page.tsx            top-level route
NEW  app/news/page.tsx                    top-level route
NEW  app/alerts/page.tsx                  top-level route
NEW  app/api/search/route.ts              proxy for the search bar
NEW  app/api/candles/route.ts             proxy for chart period switching
NEW  app/api/metric/route.ts              live metric lookup for the alert builder
MOV  lib/mock-data/unlisted.ts         -> lib/illustrative/unlisted.ts
DEL  lib/mock-data/                       (indices, macro, commodities, movers, screeners,
                                           companies, price-series, financials, peers, quant,
                                           sensitivity)
DEL  components/market/market-watch.tsx, factor-screener.tsx
DEL  components/ipo/{ipo-pipeline,issue-detail,subscription-alerts,gmp-tracker}.tsx
DEL  components/quant/microstructure-xai.tsx
DEL  components/company/peer-matrix.tsx
DEL  app/ipo/[id]/
```

Every other page was rewritten against the API.

## Verified live in-browser

| Surface | Real result |
|---|---|
| Ticker bar | Live NSE indices, e.g. Nifty Bank 55,017.50 +1.40% |
| `/market-watch` | ESTER +17.21%, IRCON +15.05%; losers ARMEE −17.05%; breadth 679/370 |
| `/company/GRSE` | ₹2,216.70 +0.67%, real name, 1,463 employees, m-cap ₹25,393 Cr, P/E 31.74 |
| Chart 1Y → 1D | 251 daily bars → 40 intraday bars, 09:15 am to 12:30 pm today |
| `/company/GRSE/quant` | 742 observations; GARCH 33.83 / EGARCH 40.69 / FIGARCH 37.48 / HAR-RV 41.38; consensus 38.38% |
| `/news` | 20 exchange filings + 60 press; real 12:31 filings with ticker chips |
| `/alerts` | TCS live price ₹2,070.20; "< 2500" → Condition met, "< 1500" → Not met |
| Search | Full 2,592-company universe |

## Bugs found and fixed

1. **Client component importing an async server component.** `SiteHeader` was
   `"use client"` and imported the now-async `MarketTicker`. Split into a server
   shell (`site-header.tsx`) plus a client bar (`header-bar.tsx`).
2. **React hooks called conditionally** in `price-chart.tsx` — an early return
   for the empty-series case sat between `useMemo` calls. Caught by lint. All
   hooks now run before any return, with the guard applied after.
3. **`buildScales` on an empty series** returned `Infinity` from `Math.min()`.
   Guarded, since it is reachable before the render guard.
4. **Duplicate React keys in the news feed.** Two Radaan Mediaworks filings
   shared a timestamp to the second, so `nse-{symbol}-{timestamp}` collided.
   NSE supplies `seq_id`; that is now carried through the provider and used for
   the id, with positional fallback.
5. **The same press story appeared twice.** Outlets syndicate across feeds, so
   one article arrived from two sources. Press items are now deduplicated on a
   punctuation- and case-normalised headline fingerprint. Verified: 67 press
   items, 67 unique headlines.

   Filings are deliberately NOT deduplicated by headline. Two Aarey Drugs
   "Outcome of Board Meeting" filings share a subject but are separate
   disclosures with different sequence ids and different attachments — hiding
   one would suppress a real filing, which is the wrong failure for a
   compliance feed.

### Verification caveat worth remembering
Clearing `.next/cache/fetch-cache` while `next dev` is running has no effect —
the fetch cache is also held in memory. Stop the server, clear, then restart, or
a corrected backend payload will appear stale for the full revalidate window.

## Provenance model

Every backend response carries source, upstream delay and cache age. The UI
renders it rather than discarding it:

- `FreshnessBadge` — "15m delayed · 8s ago" beside every live figure
- `SourceLine` — attribution under each panel
- `IllustrativeBanner` — on unlisted surfaces, IPO GMP and microstructure
- `DataUnavailable` — on fetch failure, including the exact command to start the
  data service when it is unreachable

Nulls render as em dashes, never zeros. "Not reported" and "zero" are different
claims and the UI keeps them different.

## Known gaps, stated in the UI

- **Weekly/monthly mover windows and the beta / low-vol / alpha factor screens**
  are not wired. NSE publishes daily variations only, so these need a
  full-universe historical scan rather than a feed. The page says so.
- **Unlisted** remains illustrative — labelled, with live listed peers for the
  comparison.
- **IPO grey-market premium and DRHP-stage issues** are absent, with the reason
  shown on the page.
- **Kyle's lambda and VPIN** render as em dashes behind an explanatory banner.
- **Alerts are not monitored** after creation. The page states this twice.


## Phase 11 — COMPLETE (verified live)

Hardening, plus the two spec items that were still missing.

### Closed the remaining spec gaps
Both needed a universe-wide historical scan, which is why they were absent:
NSE publishes daily variations only. A single batch download of index
constituents plus the benchmark takes ~4 seconds and backs both.

```
NEW backend/app/providers/constituents.py  NSE index constituent CSVs (50/100/200/500)
                                           with industry classification
NEW backend/app/services/screener.py       batch universe stats, factor screens,
                                           windowed movers
NEW backend/app/routers/screener.py        /screener/factors, /screener/movers, /screener/indices
NEW components/market/factor-screens.tsx   High Beta / Low Vol / Alpha tables
NEW components/market/windowed-movers.tsx  weekly & monthly gainers/losers with 52W band
MOD app/market-watch/page.tsx              window toggle + factor screens
```

**Factor screens** — real regressions against Nifty 50 over a year of daily
returns, 99 of 100 constituents computed:
- High beta: SHRIRAMFIN 1.95, TMCV 1.84, INDIGO 1.81, ADANIGREEN 1.67
- Low volatility: NTPC 18.8%, BRITANNIA 19.3%, APOLLOHOSP 19.5%, SUNPHARMA 19.5%
- Alpha: SHRIRAMFIN +69.7%, TMCV +61.9%, MOTHERSON +61.2%

A constituent with too little overlapping history is **excluded**, not given a
default beta of 1.0.

**Weekly / monthly mover windows** — computed from constituent price history:
- Monthly gainers: ADANIPORTS +9.15%, VBL +6.44%, COALINDIA +5.83%
- Monthly losers: MAZDOCK −14.97%, INFY −14.01%, TCS −13.44%, WIPRO −12.77%

Cross-check: the monthly IT losses match the IT selloff in the news feed and the
−19.6% Nifty IT one-year return in the sensitivity regressions. Four independent
surfaces agreeing on the same real event.

### Hardening
- **Loading skeletons** on every route (`loading.tsx` × 7). The quant tab fits
  four volatility models on a cold cache; several seconds of blank page reads as
  a failure.
- **Bounded retry with exponential backoff** in `nse_get`. Two failure modes are
  handled distinctly: an expired cookie needs a freshly primed session, while a
  429/503 needs a pause — retrying immediately just burns the attempts faster.
  Three attempts, 0.75s × 2^n backoff, with the last error reported.
- **Smoke test**: all 16 endpoints return 200.

### Note on a non-bug
`/screener/factors?limit=2` returns 422. That is the `ge=3` query constraint
working correctly, not a failure — a factor screen of two rows is not a screen.

### Final state
`tsc --noEmit`, `next lint`, `next build` all clean. Console clean across every
route on a fresh tab. 14 routes, 16 backend endpoints.

## Phase 12 — Design pass + unlisted data provenance

### Unlisted data: UnlistedZone was checked, not assumed
Their `robots.txt` is permissive (`Allow: /`), but the Terms of Use are explicit
and controlling. Verbatim: users "shall not... Use automated systems (bots,
scrapers) without authorization" and may not "Scrape, copy, or systematically
extract data". No scraper was built.

What was built instead: `data/unlisted.json`, a hand-maintained dataset each of
whose records carries `source` and `lastUpdated`. The UI renders both. A record
whose source still says "illustrative" shows a warning banner; a record with a
real source shows a provenance line instead. Replacing sample values with
figures you are entitled to use is now a JSON edit, not a code change.

Legitimate routes to real data, in order of effort: request authorised access
from UnlistedZone (their terms contemplate it), use a licensed feed, or key in
dealer quotes by hand.

### Design pass (taste-skill)
Vendored to `.claude/skills/taste-skill/` with its LICENSE.

The skill's own Section 13 excludes dashboards and data tables and instructs the
agent to say so and apply only the landing-page parts. Arthdex is mostly a data
terminal, so it was applied to the landing page only. Its dials were set
**VARIANCE 6 / MOTION 3 / DENSITY 4**, below the 8/6/4 baseline: a finance tool
that performs visually reads as unserious to analysts.

**Design Read:** redesign of a B2B quantitative-finance landing page for
analysts and traders, restrained terminal-adjacent language, existing Tailwind
token system, credibility-first.

Violations found and fixed on the landing page:
1. **Stale fabricated stats.** The hero claimed "2,140 scrips" and "180 unlisted
   firms", both invented during the mock era. Real figure is 2,592, and it is
   now read from `/universe/stats` at request time rather than written in.
   This was a factual error, not a style one.
2. **Gradient text on the H1** removed.
3. **Decorative hand-rolled SVG** (a "factor lattice" representing nothing)
   replaced with a real Nifty 50 one-year chart drawn from the same candle
   endpoint the company pages use. A chart of the actual index carries
   information; the ornament did not.
4. **Neon glow and blur orb** removed.
5. **Eyebrow inflation.** Five `uppercase tracking` micro-labels above section
   headlines, against a budget of ceil(sections/3). Now zero on the landing path.
6. **Three-equal-cards feature row** replaced with an asymmetric grid: two wide
   anchors, four narrow supporting cards, every one a real link.
7. **Em-dashes purged from all user-facing prose** (13 replacements) and from
   page titles (separator is now a middle dot).

Deliberately **not** applied: the em-dash ban does not extend to the `—`
placeholder that marks an unreported figure in a data table. That is an
accounting convention, and replacing it with "N/A" would be worse for the
domain. Code comments were also left alone; they are not on the page.

Also not applied: the skill prefers Phosphor/Tabler over Lucide. Swapping the
icon set across ~30 components is high churn for modest gain, and the current
set is used consistently. Flagged rather than silently skipped.

---

## Phase 7 — Event Impact Analyzer tab

Integrates the CEIA tool (`GSL-claude-company-event-impact-analyzer`, github.com/SatyakiMandal/GSL)
as a top-level **Analyzer** tab. Unlike Phases 1–6 this is **live, not mock**: a run scrapes news,
fetches prices and executes the real engine.

### What shipped
- **Engine vendored** into `backend/ceia/` (57 modules, unchanged except `gui.py` dropped, since
  Streamlit is not used here). Not a dependency on the other repo.
- **Runs are subprocesses** (`python -m ceia.analyze` / `ceia.unlisted`) launched by
  `backend/app/services/analyzer.py`, cwd `backend/analyzer_data/` so the engine's relative
  `cache/` and `data/news_cache/` land there. stdout is the progress feed. Max 2 concurrent,
  90 min timeout, cancellable. Each run persists to `analyzer_data/runs/<id>/`
  (`meta.json`, `run.log`, `analysis.json`, `report.html`, `model.xlsx`), so a restart loses nothing;
  runs that were live at restart are marked FAILED.
- **Listed and unlisted** both supported. Listed = full pipeline vs Nifty 50 (event study,
  FinBERT/GoEmotions, volatility ensemble, VaR/Merton, technicals, valuation, backtests, verdict).
  Unlisted = UnlistedZone dealer-price move study attributed to headlines.
- **Search**: listed uses the existing NSE universe; unlisted searches UnlistedZone's directory.
- **UI**: `/analyzer` (launcher, your runs, sample reports) and `/analyzer/[id]` (live progress
  and log, then native summary cards, then the full HTML report in a sandboxed iframe, plus
  HTML / Excel / JSON downloads).
- **19 earlier reports bundled** as read-only samples in `backend/analyzer_samples/` (16 listed,
  3 unlisted), seeded into the runs directory on startup.

### Files
```
NEW  backend/ceia/                                 vendored engine
NEW  backend/app/services/analyzer.py              job runner, persistence, summary extraction
NEW  backend/app/routers/analyzer.py               /api/v1/analyzer/*
NEW  backend/analyzer_samples/                     bundled sample reports
MOD  backend/app/main.py                           router, POST CORS, startup seeding
MOD  backend/requirements.txt                      + openpyxl, torch, transformers
NEW  types/analyzer.ts · lib/api/analyzer.ts
NEW  app/api/analyzer/[...path]/route.ts           allow-listed same-origin proxy
NEW  app/analyzer/page.tsx · app/analyzer/[id]/page.tsx
NEW  components/analyzer/{launcher,run-list,run-view,summary-view}.tsx
MOD  components/layout/header-bar.tsx              Analyzer nav link
```

### Decisions and caveats
- The GSL repo's own `backend/routers/company.py` falls back to **hard-coded placeholder numbers**
  when data is missing. That was deliberately not carried over: a failed run surfaces an error.
- Report HTML embeds scraped headlines, so it is served with `Content-Security-Policy: sandbox
  allow-scripts allow-popups` and framed with the same sandbox (no same-origin).
- Windows are limited to 45–800 days (the market model needs an estimation window).
- The first ever run downloads FinBERT and GoEmotions (~500 MB each) and crawls news sitemaps
  uncached; expect 15+ minutes. Later runs reuse `analyzer_data/data/news_cache`.
- The site footer still says all figures are mock. That is true for Phases 1–6 but not this tab.
