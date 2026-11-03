# Arthdex: product requirements for the remaining work

| | |
|---|---|
| Status | Draft for the owner's review |
| Date | 4 November 2026 |
| Branch | `feature/redesign-and-data-trust` (ahead of `main`, not pushed) |
| Related | [product-roadmap.md](product-roadmap.md) (the full feature catalogue), [data-sources.md](data-sources.md) (every feed, its backup and vetting), [paid-feed-roadmap.md](paid-feed-roadmap.md), [site-audit-2026-11-03.md](site-audit-2026-11-03.md) |

This document specifies everything Arthdex still needs to be a product a paying user would trust: what each piece does, why it matters, where in the code it goes, how to build it, what data it needs and whether that data may be shown, how to know it is done, and what it depends on. It is written so any one workstream can be picked up and built without rereading the history.

---

## 1. Where the product stands

**Built and verified** (all on the branch above; 96 backend tests, typecheck clean, lint 0 errors and 35 warnings):

- **Design:** editorial-terminal design system across every page; dense home page (live Nifty 50 grid, index board, market-today band, desk, filings).
- **Company page:** masthead, sticky tabs with mini quote, overview with peers, P/E band, quality checks (Piotroski, Altman, Beneish, cash conversion) and reverse DCF; statistics, statements, analysts, history, shareholding, technicals, order flow, research dossier, quant, macro and news tabs.
- **Markets:** market watch (movers, Nifty 500 sector map, institutional flows), derivatives (index and stock option chains with Greeks, F&O build-up), commodities, deals, bhavcopy, calendar, results season.
- **Research:** fundamental screener on vetted figures with a formula language, MACD screener, event-impact analyzer and compare, track record of logged calls.
- **Data trust:**
  - Every company feed has a second source, with NSE XBRL filings settling disagreements.
  - A feed watchdog runs every 30 minutes and a reconciliation of 30+ checks per stock runs daily; incidents are reported in Claude Code sessions.
  - The store and scheduler run on SQLite now and switch to Supabase Postgres with one setting.
- **Engineering:** Next.js 16.4, bundled fonts, CI (typecheck, lint, build, backend tests).

**Not done:** 72 roadmap items are not started and 18 are partial. They are grouped below into 13 workstreams.

---

## 2. Principles every piece of work must meet

These are acceptance conditions for every requirement below, not aspirations.

1. **Accuracy gate.** A new figure ships with a second source and a reconciliation check, or is labelled single-source on the page. Disagreements between sources are settled by the exchange filing where one exists, and shown when they cannot be settled.
2. **The nine-gate pipeline** in [product-roadmap.md](product-roadmap.md) §2.1: brief, data contract, probe, provider and service, API, monitoring, interface, verification, release and watch.
3. **Point-in-time.** Every vetted figure is stored with the date it was known (`backend/app/store.py`, series table). Nothing is backfilled with figures that were not known on the date.
4. **Blank is not zero.** A missing figure renders as a dash, never as 0, and never passes a filter.
5. **Design system.** Section heads, panels, mono figures, gold marks, the chart tokens (`--chart-*`), source lines. No new colours, no icons on panels, sentence case. Phone width with no horizontal scroll; light and dark.
6. **Upstream load.** Each feature states its upstream calls per page view; heavy work runs in the scheduler and is served from the store. Reconciliation and backfills are paced.
7. **Informational, not advisory.** Until the legal review (W11) says otherwise, nothing tells a user to buy or sell.

---

## 3. Who it is for

The owner chose to build for two users equally:

| User | Jobs to be done | What they need most |
|---|---|---|
| Long-term investor | Find good businesses at fair prices; understand a company quickly; track a portfolio and tax | Vetted fundamentals, peers, valuation history, forensics, screener, portfolio, alerts on filings |
| Active trader | Read the day; find setups; manage risk on F&O | Option chains and analytics, build-up scanners, charting, intraday scanners, flows, journal |

---

## 4. Decisions and actions only the owner can take

These block the workstreams named. Each is a decision or an account only the owner can make.

| # | Decision or action | Blocks | Recommendation |
|---|---|---|---|
| D1 | Create the Supabase project; put its connection string in the backend's environment as `DATABASE_URL`, and its URL and anon key in the site's | W1, W2, W3 | Supabase free tier to start; Mumbai region (ap-south-1) |
| D2 | Choose the email and push provider for alerts | W2 | Resend for email, Web Push (VAPID) for browsers, Telegram bot for chat |
| D3 | Choose the payments provider | W11 | Razorpay (UPI, GST invoices) |
| D4 | Legal review: SEBI Research Analyst Regulations, exchange data redistribution (live versus delayed versus end of day), DPDP Act 2023 privacy | W11, parts of W7 and W8 | Engage a securities lawyer before charging users |
| D5 | Whether to use an AI provider, and the monthly cost ceiling | W8 (assistant), W9 (summaries) | Deferred by the owner on 3 Nov 2026; revisit after W11 |
| D6 | Which paid feeds to buy first | W7 (intraday), W6 (estimates) | Analyst estimates first (Trendlyne or similar), live intraday after pricing is decided |
| D7 | Review the three earlier code-review edits left uncommitted (`indicators.py`, `options_gex.py`, `docs/code-review/README.md`) | W13 | The `options_gex.py` edit caps expiries by `len(skipped)`; it looks unintended |
| D8 | Merge or open a pull request for `feature/redesign-and-data-trust` | everything | Review and merge before W1 starts |

---

## 5. Workstreams

Each workstream lists features with IDs, then the how, where, data, acceptance and risks. Sizes: S is up to 3 days, M up to 2 weeks, L longer, for one engineer.

### W1. Platform and infrastructure

**Goal.** Make the service durable and observable enough to hold user data and run unattended.

| ID | Feature | Size |
|---|---|---|
| W1.1 | Move the store to Supabase Postgres (`DATABASE_URL`); migrate the SQLite series and job tables | S |
| W1.2 | Object storage for downloaded filings (XBRL, PDFs) in Supabase Storage, keyed by URL hash | S |
| W1.3 | Error tracking (Sentry) on the site and the data service | S |
| W1.4 | Product analytics (Plausible or PostHog, privacy-first, no personal data) | S |
| W1.5 | Clear the 35 React Compiler lint warnings (mostly `setState` in effects reading browser storage) | M |
| W1.6 | Home page phone performance above 90 (stream sections below the hero with `<Suspense>`) | S |
| W1.7 | Lighthouse CI in the workflow, failing a pull request that drops accessibility, SEO or best practices below 100 | S |
| W1.8 | Admin console: feed health, incident history, job runs, snapshot coverage, user counts | M |
| W1.9 | Backups and a restore drill for the database | S |
| W1.10 | Deployment of the data service off Hugging Face to a host that allows a persistent disk and background jobs (Fly.io or Railway, Mumbai) | M |

**How and where.**
- **W1.1:** `backend/app/store.py` already speaks Postgres via psycopg when `DATABASE_URL` is set. Add `psycopg[binary]` to `backend/requirements.txt` (it is commented there), run the schema once, then copy rows with a one-off script in `backend/scripts/`.
- **W1.5:** the pattern to replace is in `lib/client/use-local-store.ts`. Move it to `useSyncExternalStore`, then fix the components that copy the pattern (listed by `npx eslint .`).
- **W1.6:** `app/page.tsx`: wrap `Desk`, the filings and `Methodology` in `<Suspense>` with skeletons so the hero streams first.
- **W1.8:** a new route group `app/admin/`, behind the owner's account (W2), reading `GET /api/v1/health/feeds`, `/health/jobs` and the store.
- **W1.10:** the scheduler and watchdog run inside the data service, so the host must keep one instance always on. The snapshot job's pacing assumes one instance.

**Acceptance.**
- The site and data service restart without losing snapshots, flows history or job state.
- Sentry receives an error thrown on purpose.
- Lint has 0 warnings.
- Home phone performance is 90 or above in three consecutive Lighthouse runs.
- A pull request that adds an unlabelled button fails CI.

**Risks.** Supabase connection limits under the scheduler: use the session pooler. Yahoo and NSE rate limits are per host IP, and a cloud IP may be blocked by NSE: the backups (Yahoo for quotes and indices) carry the page, but option chains and flows are NSE-only. Test from the chosen host before moving.

### W2. Accounts, sync and alert delivery

**Goal.** Let a user sign in, keep their lists and alerts across devices, and be told when something they follow happens.

| ID | Feature | Size |
|---|---|---|
| W2.1 | Sign-in with email link and Google (Supabase Auth); profile and preferences | M |
| W2.2 | Move watchlists, alerts, notes and logged calls from browser storage to the account, importing what is already in the browser on first sign-in | M |
| W2.3 | Multiple named watchlists with chosen columns | S |
| W2.4 | Alert delivery by email, web push and Telegram | M |
| W2.5 | Alerts on events: new filing, results published, pledge change, insider or SAST trade, screen entry or exit, price crossing a level | M |
| W2.6 | Saved screens (W6) and saved chart layouts (W7) | S |
| W2.7 | Personal briefing: the user's holdings and watchlist news, results and moves, on the briefing page and by email each morning | M |
| W2.8 | Weekly digest email | S |

**How and where.**
- **Auth:** `@supabase/ssr` in the Next app (middleware for the session); the data service verifies the Supabase JWT on user routes with a small dependency in `backend/app/auth.py`.
- **Tables:** `profiles`, `watchlists`, `watchlist_items`, `alerts`, `alert_events`, `notes`, `saved_screens`, `decisions`, with row-level security so a user reads only their rows.
- **Alert evaluation:** a scheduler job (`backend/app/jobs.py`) every 5 minutes in market hours for price alerts. Event alerts run off the flows, filings and snapshot jobs that already exist: when a snapshot shows a new latest quarter, results alerts fire.
- **Delivery:** `backend/app/services/notify.py` with one sender per channel and an `alert_events` row per delivery for idempotence.
- **Pages:** `app/(account)/…` for sign-in and settings. Existing components in `components/watchlist/` and `components/alerts/` switch from browser storage to the API.

**Data and privacy.** Personal data is the email address and the user's lists only. A privacy policy and consent are needed before launch (W11). No financial account numbers are stored. The CAS import in W3 is parsed and discarded except for holdings.

**Acceptance.**
- A watchlist made on a phone appears on a laptop.
- A test alert reaches email, push and Telegram within 2 minutes of its trigger.
- Signing out on one device does not delete data.
- Row-level security tests show one user cannot read another's rows.

### W3. Portfolio

**Goal.** Track holdings with correct returns and tax, using the same vetted prices and corporate actions as the rest of the site.

| ID | Feature | Size |
|---|---|---|
| W3.1 | Import holdings and transactions: CDSL/NSDL CAS PDF, broker tradebook CSV (Zerodha, Upstox, Groww, Angel), manual entry | L |
| W3.2 | Positions, day change, unrealised and realised P&L, XIRR per holding and overall | M |
| W3.3 | Corporate actions applied: splits, bonuses, dividends received | M |
| W3.4 | Allocation by sector and market cap, concentration, beta, drawdown, against Nifty 50 and Nifty 500 | M |
| W3.5 | Capital gains report (STCG, LTCG, grandfathering at 31 January 2018 prices), exportable for ITR | M |
| W3.6 | Dividend calendar and history for holdings | S |
| W3.7 | Mutual fund holdings with look-through to underlying stocks | L |

**How and where.**
- **Service and page:** `backend/app/services/portfolio.py` and `app/portfolio/`.
- **Imports:** CAS PDFs are password-protected (PAN plus date of birth). The user unlocks the file in the browser, and the PDF is parsed client-side with pdf.js, so the password never reaches the server. Parsed holdings are sent to the API. Broker CSVs have per-broker column maps in `backend/app/providers/brokers/`.
- **Prices and corporate actions:** prices come from `quote_sources.fetch`, and corporate actions from NSE's corporate actions endpoint (already used by the calendar page). Daily valuations go into the store, so the portfolio's history is point-in-time.
- **XIRR:** Newton's method with a bisection fallback on the cash flows.
- **Grandfathering:** NSE's 31 January 2018 closing prices from the bhavcopy archive, stored once.

**Acceptance.**
- Three real CAS statements (CDSL, NSDL, with and without mutual funds) import with every holding.
- XIRR matches a spreadsheet `XIRR()` to 0.01%.
- A split in the holding period does not show as a loss.
- The capital-gains report matches a hand calculation for 10 mixed trades.

**Risks.** CAS formats change. Keep parser tests with anonymised fixtures in `backend/tests/fixtures/`.

### W4. Company research depth

**Goal.** Make the company page the most complete free company page in India, with every figure vetted.

| ID | Feature | Size |
|---|---|---|
| W4.1 | Full statements from NSE XBRL: every line item of the income statement, balance sheet and cash flow, as filed; gives the statements tab a second source | L |
| W4.2 | Segment and geography revenue and results (XBRL segment facts, already present in the filings) | M |
| W4.3 | Ten-year history with CAGR (screener.in annual series, vetted against Yahoo where they overlap) | S |
| W4.4 | Cash flow summary on the overview | S |
| W4.5 | EV/EBITDA and P/B bands beside the P/E band | S |
| W4.6 | Editable DCF with a sensitivity table, sharing the reverse-DCF inputs | M |
| W4.7 | Red-flag panel: pledge rising, auditor change or resignation, related-party transactions, contingent liabilities, frequent dilution | M |
| W4.8 | Named top holders (mutual funds, FPIs, individuals above 1%) | M |
| W4.9 | Management and governance: board, key managerial persons, auditor, remuneration, credit ratings | M |
| W4.10 | Filings timeline with categories (results, orders, acquisitions, management change, litigation) | M |
| W4.11 | Annual reports and investor presentations, linked and searchable | M |
| W4.12 | Earnings-call transcripts with guidance extracted (needs D5 for summaries) | L |
| W4.13 | Peer charts: any metric over time against peers | S |
| W4.14 | Option chain link and summary on the company page for F&O stocks | S |
| W4.15 | Private notes and a thesis tracker per company (needs W2) | S |

**How and where.**
- **W4.1:** extend `backend/app/providers/nse_xbrl.py`, whose `parse` reads headline facts today, into a full statement reader keyed by the Ind-AS taxonomy element names. Map elements to display lines in `backend/app/services/xbrl_statements.py`, keep banking and general formats separate, and store parsed filings (W1.2). The statements tab (`components/yahoo/statements-view.tsx`) then shows NSE as primary and Yahoo as cross-check. Each total must equal the sum of its components, and must match the vetted headline figures.
- **W4.2:** segment contexts are the dimensional contexts `parse` skips today; read the `ReportableSegments` axis.
- **W4.7:** red-flag sources are the NSE pledge and SAST feeds (built), auditor changes from announcements (category filter on `fetch_announcements`), and related-party disclosures from the half-yearly RPT filings (NSE `/api/corporate-related-party-transactions`, to probe).
- **W4.9:** credit ratings from the agencies' public rating lists (CRISIL, ICRA, CARE, India Ratings), matched by ISIN.
- **W4.10:** the categoriser is shared with W9.1.

**Acceptance.**
- For 20 companies across general, banking and insurance formats, full statements from XBRL foot to their totals and agree with the vetted headline figures.
- Segment revenue sums to total revenue within 1%.
- The red-flag panel shows each flag with its source filing linked.

**Risks.** XBRL taxonomies differ for banks, NBFCs and insurers. Older filings omit balance sheets (pre-2025 quarterly results); half-yearly balance sheets come in a separate filing.

### W5. Markets and macro

**Goal.** One place to read the market and the economy, each figure from its official source.

| ID | Feature | Size |
|---|---|---|
| W5.1 | Breadth dashboard: advance-decline line, new 52-week highs and lows, % above 50- and 200-day averages (from stored daily snapshots of the traded list) | M |
| W5.2 | Market regime card: trend, volatility and breadth state with the rule shown | S |
| W5.3 | FII derivatives positioning (NSE participant-wise open interest, daily archive) | S |
| W5.4 | Mutual fund flows by category (AMFI monthly) | S |
| W5.5 | Futures rollover, basis and cost of carry near expiry | S |
| W5.6 | India VIX history against realised volatility | S |
| W5.7 | Government bond yield curve and 10-year history (RBI, CCIL) | M |
| W5.8 | Rupee against major currencies and the dollar index | S |
| W5.9 | RBI policy rate history and next meeting | S |
| W5.10 | India macro dashboard: CPI, WPI, IIP, GDP, PMI, GST, trade, with release dates and surprises (MOSPI, RBI DBIE, PIB) | L |
| W5.11 | Economic calendar, India and major global releases | M |
| W5.12 | Institutional flows history backfill from NSDL's archive, so the chart does not start on 3 November 2026 | S |

**How and where.**
- **Providers:** one per official source in `backend/app/providers/` (`rbi.py`, `mospi.py`, `amfi.py`, `ccil.py`).
- **Scheduling:** a job per release schedule in `backend/app/jobs.py`. Series go into the store under names like `macro:cpi`. The macro page is `app/macro/`, and market-watch sections reuse `SectionHead` and the chart tokens.
- **W5.1:** needs a daily snapshot of NSE's traded list, the per-stock close, recorded by a job after 18:00 IST. The 50- and 200-day averages then come from the store, without per-stock history calls.
- **W5.12:** NSDL's archive page is an ASP.NET form; post its view state per date, paced.

**Data and licensing.** RBI, MOSPI, AMFI, CCIL and NSDL publish for public use. Check each site's terms during gate 2.

**Acceptance.**
- Each macro release appears within a day of publication, with the official release linked.
- The yield curve matches CCIL's published curve.
- Breadth figures match NSE's own advance-decline counts on the same day.

### W6. Discovery and screening

**Goal.** Help users find ideas worth researching, from vetted data.

| ID | Feature | Size |
|---|---|---|
| W6.1 | Screener views: heatmap and scatter of any two fields | S |
| W6.2 | Screen alerts: tell me when a company enters or leaves a screen (needs W2) | S |
| W6.3 | Extend the screener universe beyond the Nifty 500 to all companies with vetted financials | M |
| W6.4 | Thematic baskets (defence, railways, EV, PSU banks, shipbuilding) with basket performance | M |
| W6.5 | Business-group views (Tata, Adani, Reliance, Mahindra) with group market cap | S |
| W6.6 | Smart money across the market: insider, SAST and promoter activity aggregated by buyer and by company | M |
| W6.7 | Well-known investors' holdings from shareholding filings (holders above 1%) | M |
| W6.8 | Mutual fund holding changes by stock (AMFI monthly portfolios) | L |
| W6.9 | Results season: estimates beat or miss (needs D6), sector breakdown, and a season-over-season view | S |
| W6.10 | Corporate-action screens: dividends, splits, bonuses, buybacks by record date | S |
| W6.11 | SME IPOs with their own risk notes | S |

**How and where.**
- **W6.1:** `components/screener/` reading `GET /api/v1/screener/fundamental`.
- **W6.3:** raise the snapshot job's universe in `backend/app/jobs.py`. At 30 companies an hour, 2,600 companies take 4 days to cover and refresh weekly within the pacing; raise the rate only after W1.10.
- **W6.4:** baskets are curated lists in `backend/app/data/themes.json`, each with a source note; performance is market-cap weighted from the traded-list snapshots.
- **W6.6:** aggregates the NSE disclosure feeds already parsed in `backend/app/services/shareholding.py`.

**Acceptance.**
- A screen saved by one user runs identically for another via its link.
- Screen alerts fire once per entry, not on every run.
- Thematic basket constituents each have a stated reason for inclusion.

### W7. Derivatives and trading tools

**Goal.** Give traders the tools they use every day, with the same honesty about stale or modelled data.

| ID | Feature | Size |
|---|---|---|
| W7.1 | Full charting: multi-pane, drawing tools, multiple timeframes, saved layouts, compare overlay (lightweight-charts) | L |
| W7.2 | Options strategy builder: legs from the chain, payoff at expiry and today, probability of profit, breakevens, margin estimate (SPAN approximation, labelled) | L |
| W7.3 | IV surface and skew, IV rank and percentile (needs daily IV snapshots in the store) | M |
| W7.4 | F&O scanners beyond build-up: OI spikes, PCR extremes, IV crush candidates | S |
| W7.5 | Intraday scanners: breakouts, volume spikes, VWAP reclaim, opening range (needs a live feed, D6) | L |
| W7.6 | Trade-level risk: stop, target, reward to risk, expected value | S |
| W7.7 | Trade journal with tags, screenshots, mistakes and lessons (needs W2) | M |
| W7.8 | Paper trading against live prices | M |
| W7.9 | Read-only broker connections (Zerodha Kite, Upstox, Angel, Dhan) for holdings and orders | L |

**How and where.**
- **W7.1:** a client component in `components/charting/` with lightweight-charts (Apache 2.0), fed by the candles endpoint, which already fills missing sessions from NSE.
- **W7.2:** `backend/app/services/strategy.py` reuses the Greeks in `backend/app/services/options.py`, and payoffs are computed client-side for speed. The page is `app/derivatives/strategy/`.
- **W7.3:** a scheduler job records the ATM and 25-delta IVs per expiry at 15:35 IST into the store; IV rank needs 252 days of history, so the page shows how many days it has.
- **W7.9:** broker APIs need each user's own API key and their OAuth consent. Tokens are stored encrypted, per user, read-only scopes only. Order placement is out of scope until D4 says otherwise.

**Data and licensing.** Option chains are NSE's public endpoint, delayed. Showing live intraday prices or running intraday scanners needs a licensed feed and an NSE data-vendor agreement (D4, D6).

**Acceptance.**
- Strategy payoffs match a hand calculation for a straddle, a bull call spread and an iron condor.
- IV rank states its history length.
- Every chart works at phone width with touch.

### W8. Research lab

**Goal.** Let users test ideas honestly.

| ID | Feature | Size |
|---|---|---|
| W8.1 | Backtesting lab: walk-forward tests of screens and technical rules, with costs and slippage, and an out-of-sample gate before a result is shown | L |
| W8.2 | Factor lab: India factor returns (size, value, momentum, quality, low volatility) and any stock's or portfolio's exposure | M |
| W8.3 | Correlation matrix, rolling correlation, pairs and cointegration scanner | M |
| W8.4 | Scenario stress tests (rates up, rupee down, crude up, a 2008 or 2020 drawdown) on a stock or portfolio | M |
| W8.5 | AI research assistant answering only from Arthdex's vetted data, each figure cited (needs D5) | L |
| W8.6 | Bull and bear case synthesis with evidence (needs D5) | M |

**How and where.**
- **Backtesting:** `backend/app/services/backtest.py`. It must read fundamentals from the point-in-time store (the snapshots the screener already records) and never from today's figures. Survivorship needs historical index membership: NSE publishes changes, so store them.
- **Display rule:** results show in-sample and out-of-sample side by side, and a strategy that fails out of sample is shown as failing.
- **AI:** if approved, use the Claude API with retrieval over the store and the vetted endpoints only. The assistant cites the endpoint and date for each figure, and refuses to answer from memory.

**Acceptance.**
- A backtest of a screen run on a past date uses only snapshots recorded on or before that date.
- The out-of-sample gate cannot be bypassed in the interface.

**Risks.** Point-in-time history begins on 3 November 2026. Until a year of snapshots exists, backtests of fundamental screens are limited to what can be rebuilt from XBRL filings by their filing date. That is possible, and is part of W4.1.

### W9. News and intelligence

| ID | Feature | Size |
|---|---|---|
| W9.1 | Filings categorised by type (results, orders, acquisitions, management change, litigation, credit rating) | M |
| W9.2 | Material-event detection with the price reaction (abnormal return from the event analyzer) | M |
| W9.3 | Sentiment per item and per company (FinBERT is already in the analyzer; reuse, labelled as model output) | S |
| W9.4 | Duplicate collapsing across exchange filings and press | S |
| W9.5 | Filing and transcript summaries (needs D5) | M |

**How and where.** `backend/app/services/news.py` and the analyzer engine. Categories start rule-based from NSE's own subject field and attachment names, then a classifier if needed, with a confusion matrix on 500 labelled filings kept in `backend/tests/fixtures/`.

**Acceptance.** Category precision of 95% or better on the labelled set; every event links to its filing.

### W10. Data trust layer

**Goal.** Keep the product's main difference ahead of every feature.

| ID | Feature | Size |
|---|---|---|
| W10.1 | Owner incident alerts by email or Telegram, not only in Claude Code sessions (needs D2) | S |
| W10.2 | Data dictionary page: every metric's definition, formula, source, and known differences between sources | M |
| W10.3 | "How was this computed" popover on any figure, from the response's `sources` and `vetting` blocks | M |
| W10.4 | Reconciliation over 50 stocks daily (paced), and over the Nifty 500 weekly | S |
| W10.5 | Second source for the analysts tab (paid estimates, D6) | M |
| W10.6 | Second source for global indices and commodities (Stooq or an exchange feed) | S |
| W10.7 | Second source for weekly, monthly and intraday history | M |
| W10.8 | Public status page shows reconciliation results, not only feed health | S |

**How and where.**
- **Checks and notifications:** `backend/app/reconcile.py` and `backend/app/watchdog.py`; W10.1 hooks into `watchdog.record` and `reconcile_figures`.
- **Data dictionary:** generated from the `FIELDS` table in `services/fundamental_screen.py` and a new `backend/app/data/dictionary.yaml`, so definitions live in one place and the page and the screener read the same text.

**Acceptance.**
- A deliberately broken provider (wrong unit) is caught by reconciliation within a day and reaches the owner by email.
- Every figure on the company page has a popover.

### W11. Monetisation, compliance and launch

**Goal.** Charge for the product lawfully.

| ID | Feature | Size |
|---|---|---|
| W11.1 | Legal review outcomes written down: SEBI position, data redistribution rights, privacy (D4) | external |
| W11.2 | Terms, privacy policy (DPDP Act 2023), cookie consent, disclaimers on every page | S |
| W11.3 | Plans and billing: free and paid tiers, trials, Razorpay subscriptions, GST invoices (D3) | M |
| W11.4 | Feature gating and usage limits for heavy features (dossier runs, backtests, AI) | S |
| W11.5 | Public API with keys and rate limits, as a separate plan, if the data licence allows | M |
| W11.6 | Launch: landing copy, pricing page, onboarding, help pages | M |

**How and where.** Gating via a `plan` column on `profiles` (W2) checked in the data service and in the site's server components. Razorpay webhooks are handled in `app/api/billing/`.

**Acceptance.**
- A free user hitting a limit sees what the paid plan adds.
- A failed payment downgrades after a grace period without data loss.
- Invoices carry the GSTIN.

**Risks.** If the legal review finds that published calls and track records amount to research-analyst activity, the track-record page and the "log this call" button must be restricted or the owner must register. Plan for both.

### W12. Mobile, accessibility, languages, performance

| ID | Feature | Size |
|---|---|---|
| W12.1 | Installable web app: manifest, offline shell, push (shares W2.4) | S |
| W12.2 | Phone-first layouts for the ten most visited screens, measured with analytics (W1.4) | M |
| W12.3 | Hindi interface and number formats; later Gujarati, Marathi, Tamil | L |
| W12.4 | Native apps (after the web app proves retention) | L |
| W12.5 | Keyboard navigation of tables and charts; screen-reader summaries for every chart | M |

**Acceptance.** Lighthouse 100 for accessibility, SEO and best practices on every route, and performance of 90 or above on phones for the top ten routes.

### W13. Known defects and technical debt

| ID | Item | Where |
|---|---|---|
| W13.1 | 35 React Compiler warnings | `lib/client/use-local-store.ts` and its callers (W1.5) |
| W13.2 | Home phone LCP (W1.6) | `app/page.tsx` |
| W13.3 | HDFC Bank and others: older-year disputes between Yahoo and screener.in with no filing to settle them (pre-2025 results filings carry no balance sheet) | Settle from annual-report XBRL (W4.1) |
| W13.4 | NSE's pledge dataset reports promoter holding on a different basis from the shareholding pattern; the pattern is shown, the cause is not understood | `backend/app/services/shareholding.py` |
| W13.5 | Statements tab is single-source (Yahoo) and stale for some companies; it shows a notice | W4.1 |
| W13.6 | Option chains after the close carry stale last trades; they are marked, but a mid-price snapshot at 15:30 would be better | `backend/app/services/options.py` |
| W13.7 | Lender revenue is defined differently on the two sources; not vetted for banks | Use XBRL interest-earned lines (W4.1) |
| W13.8 | bf-cache blocked on pages that hold connections; one home colour-contrast item | Lighthouse notes |
| W13.9 | The three earlier code-review edits left uncommitted (D7) | `backend/app/services/indicators.py`, `options_gex.py` |
| W13.10 | Institutional-flows history starts on 3 November 2026 (W5.12) | `backend/app/services/flows.py` |

---

## 6. Sequence

Milestones run in this order; each ends with its exit check. Workstreams inside a milestone can run in parallel where they touch different files.

| Milestone | Contents | Exit check |
|---|---|---|
| M0. Merge | D7, D8; W13.1 | Branch merged to `main`; CI green; lint 0 warnings |
| M1. Foundation | D1; W1.1 to W1.4, W1.6, W1.7, W1.9, W1.10; W10.1 | The service runs unattended for 7 days on the new host with no data loss; Sentry and incident emails work |
| M2. Accounts | D2; W2.1 to W2.5; W12.1 | A user's lists and alerts follow them across devices; alerts arrive on every channel |
| M3. Research depth | W4.1 to W4.5, W4.7, W4.10, W4.14; W6.1, W6.3; W5.1, W5.12; W10.2 to W10.4 | Full statements from XBRL for 20 test companies; reconciliation over 50 stocks clean |
| M4. Portfolio and traders | W3.1 to W3.6; W7.1 to W7.4, W7.6, W7.7; W6.2, W6.6 | Three real CAS statements import; strategy payoffs verified |
| M5. Launch | D3, D4; W11.1 to W11.4, W11.6; W12.2 | First paying user; legal positions written down |
| M6. After launch | W5 macro, W6 themes and smart money, W8, W9, W10.5 to W10.7, W11.5, W12.3 to W12.5, D5, D6 | By user demand, measured with analytics |

---

## 7. Owner checklist

Owner actions, in the order they unblock work:

1. Review and merge `feature/redesign-and-data-trust` (D8); decide on the three earlier edits (D7).
2. Create the Supabase project in the Mumbai region; add `DATABASE_URL` to the data service's environment, and the Supabase URL and anon key to the site's (D1).
3. Choose and open accounts for email (Resend), Telegram bot, and Sentry (D2, W1.3).
4. Choose the data-service host (W1.10) and confirm NSE answers from it.
5. Engage a securities lawyer for the SEBI and data-redistribution questions; draft the privacy policy (D4).
6. Open a Razorpay account (D3).
7. Decide on AI and paid feeds when M5 is in sight (D5, D6).

---

## 8. Appendix: where things live

| Area | Files |
|---|---|
| Pages | `app/` (one folder per route; company tabs in `app/company/[symbol]/`) |
| Components | `components/<area>/` (`company`, `market`, `derivatives`, `screener`, `landing`, `layout`, `ui`) |
| API client and types | `lib/api/endpoints.ts`, `lib/api/types.ts` |
| Data service routes | `backend/app/routers/` |
| Providers (one per upstream) | `backend/app/providers/` (`nse.py`, `nse_xbrl.py`, `nse_options.py`, `nsdl.py`, `screener.py`, `yahoo.py`, `fundamentals.py`) |
| Services (computation and vetting) | `backend/app/services/` (`financial_sources.py`, `quote_sources.py`, `peers.py`, `forensics.py`, `options.py`, `flows.py`, `fundamental_screen.py`, `results_season.py`) |
| Store and scheduler | `backend/app/store.py`, `backend/app/scheduler.py`, `backend/app/jobs.py` |
| Monitoring | `backend/app/watchdog.py`, `backend/app/reconcile.py`, `scripts/feed-report.mjs`, `.claude/settings.json` |
| Tests | `backend/tests/` (96 tests); CI in `.github/workflows/ci.yml` |
| Fonts | `app/fonts/` (bundled, SIL OFL) |
