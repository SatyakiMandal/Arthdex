# Site audit, 3 November 2026

Covers the redesign, the data-feed watchdog and the Next.js 16 upgrade. Lighthouse 12.8.2 against a local production build (`next build && next start`), the data service running, Chrome headless. Mobile uses Lighthouse's default simulated mid-range phone on a throttled connection; those performance figures move by about 5 to 8 points between runs on this machine.

## Scores: before and after

Before is the old design on Next 15.5.26. After is the new design on Next 16.4.4. Order: Performance / Accessibility / Best practices / SEO.

| Page | Before | After |
|---|---|---|
| Home, desktop | 100 / 93 / 100 / 100 | 99 / 97 / 100 / 100 |
| Home, mobile | 92 / 93 / 96 / 100 | 82 / 96 / 100 / 100 |
| Company (RELIANCE), mobile | 85 / 95 / 96 / 92 | 88 / 99 / 100 / 100 |
| Company (RELIANCE), desktop | not measured | 99 / 99 / 100 / 100 |
| Market watch, mobile | 79 / 94 / 96 / 92 | 88 / 100 / 100 / 100 |
| Screener, mobile | 92 / 96 / 96 / 100 | 89 / 100 / 100 / 100 |
| IPO, mobile | 89 / 94 / 96 / 92 | 89 / 100 / 100 / 100 |
| Unlisted, mobile | 92 / 95 / 96 / 100 | 90 / 99 / 100 / 100 |
| News, mobile | 81 / 94 / 96 / 92 | 88 / 100 / 100 / 100 |
| Data status, mobile | 94 / 99 / 96 / 92 | 91 / 100 / 100 / 100 |

Layout shift is 0 to 0.01 on every page except the screener (0.08), against 0.14 on the old company page.

Home mobile performance fell because the new home page does more above the fold: it renders all 49 Nifty 50 members live and fetches four data sections. Its LCP element is the headline, at about 4.5 s on the simulated phone and 0.9 s on desktop. Two experiments that did not help were reverted: inlining the CSS (first paint got slower) and dropping two font preloads (no gain).

## Health checks

| Check | Result |
|---|---|
| Routes | 22 of 22 return 200 (all pages, `/sitemap.xml`, `/robots.txt`) |
| TypeScript | `tsc --noEmit` clean |
| ESLint 9 | 0 errors; 36 warnings from the React Compiler rules that `eslint-config-next` 16 added (see below) |
| Backend tests | 32 pass, including 4 new watchdog tests |
| Data feeds | 18 of 18 pass the watchdog, including the new market pulse feed |
| Browser console | no errors on the home page |

## What fixed what

- **SEO 92 to 100.** Next 15 streamed `<title>` and the meta description into `<body>` on dynamic pages for anything not recognised as a bot. `htmlLimitedBots: /.*/` in `next.config.mjs` keeps them in `<head>`.
- **Best practices 96 to 100.** A console 404 and an oversized logo image were removed.
- **Accessibility to 96 to 100.** Logo link and image names, the refresh button's accessible name, heading order on data cards and the news feed, the screener's labelled span, 24 px footer tap targets, the dark-mode loss red raised to 4.5:1, and 12 px as the smallest text size.

## Company page redesign (same day, later)

The company page now opens with a masthead: the company name as the page title, a sentence written from the quote (today's move, distance from the 52-week extremes, the earnings multiple), the price, two range rails (today and 52 weeks) and an eight-figure ledger. The tab bar pins under the site header and folds the symbol and price into its left edge once the masthead scrolls away. The overview groups its panels under "The business" (profile and valuation ledger) and "Financials".

| Page | Before redesign | After |
|---|---|---|
| Company (RELIANCE), mobile | 88 / 99 / 100 / 100 | 84 to 86 / 100 / 100 / 100 |
| Company (RELIANCE), desktop | 99 / 99 / 100 / 100 | 99 / 100 / 100 / 100 |

Accessibility reached 100 by making the price chart's title an `h2`. Mobile performance is within this machine's run-to-run spread of the earlier figure; LCP is about 4.2 s on the simulated phone and 1.0 s on desktop, with no layout shift.

## Company tabs (same day, later)

Every company tab now opens with a section head that says what the tab answers. The shared panel shell (`DataCard`) drops its decorative icon and gains more room. Charts use five brand chart tokens (`--chart-teal`, `--chart-clay`, `--chart-plum`, `--chart-olive`, `--chart-sky`, with light and dark values) in place of stock Tailwind hex colours. The technicals chart opens with two overlays instead of five, and its support and resistance labels no longer print over each other.

- **Phone width.** The overview, analysts, technicals and quant tabs were wider than a 375 px screen, because grid cells grew to their widest table. A base rule (`.grid > * { min-width: 0 }`) fixes it site-wide. All 11 company tabs and 16 other pages now measure 375 px.
- **Accuracy.** The Statistics tab showed the data feed's beta (0.07 for TCS) while the Macro tab's own regression against the Nifty 50 gives 0.86. The feed's figure was removed. The masthead P/E (17.45, from the valuation endpoint) and the Statistics trailing P/E (17.52, from Yahoo's statistics) still differ slightly; reconciling sources is open.

| Tab (TCS), mobile | Score |
|---|---|
| Statistics | 87 / 100 / 100 / 100 |
| Shareholding | 83 / 100 / 100 / 100 |
| Technicals | 80 / 100 / 100 / 100 |

## Accuracy audit (same day, later)

`backend/app/reconcile.py` (`npm run data:reconcile`) fetches every company endpoint for a set of stocks and checks each figure that reaches the site by more than one route, against its other sources and against arithmetic. It runs 23 checks per stock. The first run over 12 large caps failed 12 checks; after the fixes below, a run over 24 stocks (552 checks) fails one, an upstream gap that is now shown on the page.

| Finding | Cause | Fix |
|---|---|---|
| Infosys revenue shown as ₹514 crore a quarter, actual about ₹45,000 crore; profit, EPS and balance sheet off by the same factor of about 90 | Yahoo files Infosys in US dollars; the pipeline read every statement as rupees | Statements are converted at each period-end's USD/INR rate. The currency is inferred from the statements themselves, because Yahoo labels HCLTECH as dollars while its statements are in rupees |
| P/E 17.45 in the masthead, 17.52 on Statistics; P/B likewise | The valuation response was cached for hours, priced at an old quote | P/E, P/B and dividend yield are re-derived from the live price on every request |
| ROE 45.6% in the masthead, 48.1% in Key ratios, on the same page | Two sources (Yahoo, and our statements calculation) | One ROE, from the statements; the Key ratios footnote states the profit and equity periods it divides |
| Dividend yield 1.92% and payout 45.6% for TCS | Yahoo annualises the regular ₹12 dividend only; TCS paid ₹112 in the year | Yield and payout from dividends actually paid over 12 months: 4.48% and 78.5%. The regular annualised rate is still shown, labelled |
| Debt to equity 9.83 on Statistics, 0.10 in Key ratios | Yahoo reports it as a percentage | Converted to a ratio |
| "Next earnings" showed a date already past | Yahoo's calendar keeps the last results date | Labelled "Last results" until a future date is announced |
| Reliance's latest reported EPS shown as 11.34 on the analysts tab; filed 18.88 | A stray row in Yahoo's date-keyed earnings feed | Yahoo's quarter-keyed earnings history overrides it where it covers the quarter |
| Infosys promoter holding 21.36% in the pledge card, 13.9% in the pattern | NSE's pledge dataset uses a different basis | The tab shows the shareholding-pattern figure only |
| TTM revenue and profit on Statistics differed from the filed quarters by up to 30% (HUL, ICICI Bank, L&T) | Yahoo's own TTM lags and treats one-offs differently | Statistics shows the filed-quarter TTM, the same as the overview |
| TCS beta 0.07 on Statistics, 0.86 from our regression | Yahoo's beta for Indian tickers | Removed (earlier today) |
| Short ratio always blank | No short-interest data for Indian stocks | Row removed |

Known differences that stay, with a label: the analysts tab's "actual" EPS is on brokers' basis (adjusted or standalone), so it differs from filed consolidated EPS for ICICI Bank, Cochin Shipyard and Kotak Bank; the tab says so.

**Open, now reported automatically.** HDFC Bank's newest quarter on Yahoo ends June 2025, 491 days ago. The quarterly panel now says so on the page. The watchdog runs the reconciliation over TCS, INFY, HDFCBANK and RELIANCE once a day and keeps an incident per failing check ("Figures: statements.quarter_fresh"), which the session-start hook reports. Filling the gap needs a second source for quarterly results (NSE or screener.in).

Tests: 42 backend tests pass, including new ones for the comparison arithmetic, the currency rule (Infosys, HCLTECH, a rupee filer) and the incident lifecycle. Fetches whose response shape changed carry `?v=2` so deployed caches do not serve the old shape.

## Backup sources (same day, later)

Every company feed now has a second, independent source, and the two are compared before anything is served. The full map, feed by feed, is in [data-sources.md](data-sources.md).

- **Quotes:** NSE's own quote is primary, Yahoo the backup and cross-check on every fetch. ISIN now comes from NSE.
- **Quarterly results, annual results, balance sheet:** Yahoo and screener.in are both fetched and compared over recent periods; a stale or gapped series falls back, and filings converted from dollars give way to the company's rupee filings. HDFC Bank's quarterly table now runs to Q2 FY27 (September 2026) from screener.in.
- **Daily price history:** NSE's daily history backs up Yahoo and vets its last ten closes.
- **Shareholding:** NSE's shareholding filings vet screener.in's promoter figure (TCS, Infosys and Reliance matched exactly) and stand in if screener.in fails.
- **Index levels:** Yahoo backs up NSE; all 16 ticker indices matched to the paisa.

Vetting tests consistency rather than equality, because the sources define lines differently (gross or net revenue, profit with or without minority interest). Across 24 stocks the first pass with the backups flagged 41 disagreements, almost all definitional; after the rules were refined, 9 remain. They are real conflicts between the two sources: HDFC Bank's FY25 net worth (Yahoo 7.68 lakh crore against 5.22 lakh crore filed), Tech Mahindra's EPS, and single-period gaps at Bharti, Wipro, Maruti, Titan and Mazagon Dock. Each is named on the affected panel. Settling them automatically needs a third, authoritative source: the exchange's XBRL filings.

Tests: 54 backend tests pass.

## Still open

1. **Home mobile LCP.** The next step is streaming the sections below the hero with `<Suspense>`, so the hero is sent before the desk and the unlisted directory have fetched.
2. **36 React Compiler warnings.** Mostly `setState` inside effects that read `localStorage`. They are warnings, not bugs. The fix is `useSyncExternalStore` in `lib/client/use-local-store.ts` and the components that copy its pattern.
3. **Build font download.** `next/font/google` downloads fonts at build time, and one build failed on a transient network error. Self-hosting the fonts would remove that dependency for deploys.
4. **Remaining Lighthouse notes.** bf-cache (pages that hold open connections) and one colour-contrast item on the home page.
