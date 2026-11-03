# Product roadmap: sections, features and build pipeline

Arthdex is an Indian-markets research and trading-intelligence tool whose difference is trust: every figure carries its source, is checked against a second source, and is settled by the exchange filing when the two disagree. This document lists every section the product should have, the features inside each, what is built today, what each needs in data, and the order and process to build the rest.

Written 3 November 2026. Status reflects the code on that date. Related: [paid-feed-roadmap.md](paid-feed-roadmap.md), [data-sources.md](data-sources.md), [data-integrity-and-limitations.md](data-integrity-and-limitations.md).

**Status.** Built: live and verified. Partial: exists but incomplete. New: not started.
**Data.** Free: public sources already wired (NSE, Yahoo, screener.in, RSS). Free-new: public but not yet wired. Paid: needs a vendor feed. Licence: needs an exchange or vendor redistribution licence before it can be shown to users.
**Priority.** P1 is needed to launch, P2 is needed to compete, P3 is differentiating or later.

---

## Part 1. Sections and features

### 1. Markets (the daily overview)

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Home | Live Nifty 50 pulse grid, sector highlight, breadth bar | Built | Free | P1 |
| | One-line market read written from the day's numbers | Built | Free | P1 |
| | Year chart beside a sector board | Built | Free | P1 |
| | Personalised home once signed in (your watchlist, your alerts, your portfolio's day) | New | Free | P2 |
| Market watch | Indices, movers, global sentiment | Built | Free | P1 |
| | Sector and industry heatmap with drill-down to stocks (Nifty 500, by market cap) | Partial (Nifty 50 grid only) | Free | P1 |
| | Breadth dashboard: advance/decline line, new 52-week highs and lows, % above 50/200-day averages, McClellan oscillator | New | Free | P2 |
| | Market regime card: trend, volatility and breadth state, with how it was decided | Partial (per-stock regime in quant) | Free | P2 |
| Flows | FII and DII cash flows, daily and cumulative, with NSDL's FPI report beside them | Built (history recorded from 3 Nov 2026) | Free | P1 |
| | FII derivative positioning: index futures and options long/short ratio | New | Free-new (NSE participant OI) | P2 |
| | Mutual fund flows (AMFI monthly) and sector allocation shifts | New | Free-new (AMFI) | P3 |
| Derivatives overview | Index option chain summary: PCR, max pain, OI build-up by strike, IV | Partial (GEX panel on order flow) | Free-new (NSE option chain) / Licence for live | P1 |
| | Futures rollover, basis and cost of carry around expiry | New | Free-new | P2 |
| | India VIX term and history, VIX against Nifty realised volatility | Partial (VIX in ticker) | Free | P2 |
| Rates and currency | G-sec yield curve, 10-year yield history, T-bill rates | New | Free-new (RBI/CCIL) | P2 |
| | INR against USD, EUR, GBP, JPY; dollar index | Partial (global sentiment) | Free | P2 |
| | RBI policy rate history and the next MPC date | New | Free-new (RBI) | P2 |
| Commodities and global | Commodities with INR conversion and MCX equivalents | Built (Yahoo front-month) | Free / Licence for MCX | P2 |
| | Global indices, US futures, Asian open | Built | Free | P1 |
| Macro | Indian macro dashboard: CPI, WPI, IIP, GDP, PMI, GST collections, trade balance, with release dates and surprises | New | Free-new (MOSPI, RBI, PIB) | P2 |
| | Economic calendar: India and major global releases | New | Free-new | P2 |

### 2. Discovery (finding ideas)

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Screener | Technical screener | Built | Free | P1 |
| | Factor screens (alpha, value, quality, momentum) | Built | Free | P1 |
| | Fundamental screener on any ratio, with vetted figures only | New | Free | P1 |
| | Custom formula screens (`PE < 20 AND ROE > 18 AND debt_to_equity < 0.5`), saved and shareable | New | Free | P2 |
| | Screen results as a table, a heatmap and a scatter (any two metrics) | New | Free | P2 |
| | Screen alerts: tell me when a stock enters or leaves a screen | New | Free | P2 |
| Themes | Thematic baskets (defence, railways, EV, PSU banks, shipbuilding) with basket performance and constituents | New | Free | P3 |
| | Business-group views (Tata, Adani, Reliance, Mahindra) with group market cap and cross-holdings | New | Free-new | P3 |
| Smart money | Bulk and block deals | Built | Free | P1 |
| | Insider and SAST disclosures, aggregated by buyer and by company | Partial (per company) | Free | P1 |
| | Promoter buying, selling and pledging across the market | Partial (per company) | Free | P2 |
| | Superstar investor portfolios from shareholding filings (holders above 1%) | New | Free-new | P2 |
| | Mutual fund holding changes by stock, monthly | New | Free-new (AMFI portfolios) | P3 |
| | Delivery percentage spikes (bhavcopy accumulation) | Built | Free | P2 |
| Events | Results calendar and corporate actions | Built | Free | P1 |
| | Results season tracker: who reported, beat or miss against last year and against estimates, live during the season | New | Free (filings) / Paid (estimates) | P1 |
| | Corporate-action screens: upcoming dividends, splits, bonuses, buybacks with record dates | Partial (calendar) | Free | P2 |
| New issues | IPO pipeline, subscription, listing performance | Built | Free | P1 |
| | SME IPOs, with their own risk notes | New | Free-new | P2 |
| | Unlisted and pre-IPO directory | Built (indicative prices) | Licence for live prices | P2 |
| | Grey-market premium | Not planned | Unreliable, unregulated | — |

### 3. Company (the research page)

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Masthead | Name, price, read-out sentence, range rails, eight-figure ledger, sticky mini quote | Built | Free | P1 |
| Overview | Price chart, business profile, valuation ledger, financials | Built | Free | P1 |
| Financials | Quarterly and annual results, balance sheet, key ratios, vetted against two sources and settled by XBRL | Built | Free | P1 |
| | Cash flow statement summary on the overview | Partial (Statements tab) | Free | P1 |
| | Full statements from NSE XBRL (every line item, as filed) | New | Free-new | P1 |
| | Segment and geography revenue and margins | New | Free-new (XBRL segment facts are already in the filings) | P1 |
| | Ten-year history with CAGR (revenue, profit, EPS, book value, dividends) | Partial (four years) | Free (screener.in has ten) | P1 |
| Statistics | Valuation, profitability, trading, dividends | Built | Free | P1 |
| Valuation | Reverse DCF: what growth the price implies, on free cash flow and on earnings, with adjustable rates | Built | Free | P1 |
| | DCF with editable assumptions and a sensitivity table | Partial (analyzer valuation tab) | Free | P2 |
| | Relative valuation against peers and against its own five-year P/E range | Built (P/E; EV/EBITDA bands not yet) | Free | P1 |
| | Monte Carlo valuation | Built (analyzer) | Free | P3 |
| Peers | Peer table: size, growth, returns, valuation, with the company ranked, vetted through its own row | Built | Free | P1 |
| | Peer charts: any metric over time against peers | New | Free | P2 |
| Quality and forensics | Piotroski F-score, Altman Z, Beneish M, cash conversion, withheld when inputs fail vetting | Built | Free | P1 |
| | Red-flag panel: pledge rising, auditor change, related-party transactions, contingent liabilities, frequent equity dilution | New | Free-new (filings, annual reports) | P2 |
| Ownership | Shareholding pattern, pledge, SAST, insider trades, vetted against NSE | Built | Free | P1 |
| | Top holders by name (mutual funds, FPIs, individuals above 1%) | New | Free-new | P2 |
| Management and governance | Board, key managerial persons, tenure, remuneration, auditor, credit ratings | New | Free-new (annual reports, rating agencies) | P2 |
| Filings and documents | Filings timeline with categories (results, board meetings, acquisitions, orders) | Partial (Macro and news tab) | Free | P1 |
| | Annual reports and investor presentations, linked and searchable | New | Free-new | P2 |
| | Earnings-call transcripts with summary, guidance extracted, tone change quarter on quarter | New | Free-new (company sites, BSE) | P2 |
| Analysts | Targets, ratings, estimate trends, earnings history | Built (Yahoo) | Paid for depth | P2 |
| Technicals | Indicators, signals, support and resistance, MACD screener, risk card, log a call | Built | Free | P1 |
| Order flow | Footprint, absorption, value area, big prints (modelled from bars) | Built | Paid for true tick data | P2 |
| Derivatives | Stock option chain, OI build-up, IV percentile, futures basis | New | Free-new / Licence for live | P2 |
| Quant | Volatility ensemble, VaR suite, Merton default, regime, forecasts | Built | Free | P2 |
| Macro and news | Benchmark sensitivity, filings and news | Built | Free | P1 |
| Research dossier | Multi-lens structured analysis, run on demand | Built | Free | P2 |
| Notes | Private notes and a thesis tracker per company, with dated revisions | New | — | P2 |

### 4. Research and analytics (the workbench)

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Analyzer | Event impact analyzer (abnormal returns around an event) | Built | Free | P2 |
| | Listed and unlisted compare | Built | Free | P2 |
| Backtesting lab | Walk-forward backtests of screens and technical rules, with costs, slippage and an out-of-sample gate | New | Free (EOD) / Paid (point-in-time fundamentals) | P2 |
| | Results honest about look-ahead and survivorship bias, with the limits stated on the page | New | Paid for point-in-time universe | P2 |
| Factor lab | Factor returns for India (size, value, momentum, quality, low volatility), factor exposure of any stock or portfolio | Partial (Fama-French in dossier) | Free | P3 |
| Relationships | Correlation matrix, rolling correlation, pairs and cointegration scanner | New | Free | P3 |
| Scenarios | Stress tests: rates up, rupee down, crude up, a 2008/2020-style drawdown, applied to a stock or portfolio | New | Free | P3 |
| AI research assistant | Ask about a company or the market in plain language; answers built only from Arthdex's vetted data, each figure cited to its source | New | LLM provider | P2 |
| | Bull and bear case synthesis, with the evidence for each | New | LLM provider | P3 |
| | Filing and transcript summaries, and "what changed since last quarter" | New | LLM provider | P2 |

### 5. Trading tools

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Charting | Price chart with indicators | Built | Free | P1 |
| | Full charting: multi-pane, drawing tools, multi-timeframe, saved layouts, compare overlay | New | Free (EOD) / Licence for live intraday | P1 |
| Options | Option chain with Greeks, IV, OI change, stale quotes marked | Built (index and stock chains) | Free | P1 |
| | Strategy builder with payoff diagram, probability of profit, margin estimate | New | Free-new | P2 |
| | IV surface and skew, IV rank and percentile | New | Free-new | P2 |
| | Options-exposure (GEX, max pain, gamma flip) | Built | Free / Paid for depth | P2 |
| Scanners | Intraday scanners (breakouts, volume spikes, VWAP reclaim, opening range) | New | Licence for live | P2 |
| | F&O scanners: long and short build-up, unwinding, short covering | Built (/derivatives) | Free | P1 |
| Risk | Position sizing and risk plan | Built | Free | P1 |
| | Trade-level risk: stop, target, reward-to-risk, expected value | Partial | Free | P2 |
| Journal | Trade journal with tags, screenshots, mistakes and lessons | New | — | P2 |
| | Track record of logged calls against Nifty | Built | Free | P2 |
| Paper trading | Simulated orders and positions against live prices | New | Free | P3 |
| Broker connection | Read-only holdings and orders via broker APIs (Zerodha Kite, Upstox, Angel, Dhan); order placement later, behind explicit confirmation | New | Broker API terms | P3 |

### 6. Portfolio and personal

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Watchlists | Card watchlist | Built (browser storage) | — | P1 |
| | Multiple named lists, synced to an account, with columns the user chooses | New | — | P1 |
| Portfolio | Holdings import: CAS statement PDF (CDSL/NSDL), broker CSV, manual entry | New | — | P1 |
| | P&L, XIRR, day change, contribution by holding and sector | New | Free | P1 |
| | Concentration, sector and factor exposure, beta, drawdown | New | Free | P2 |
| | Dividends received and upcoming | New | Free | P2 |
| | Capital gains (STCG, LTCG with grandfathering) for tax filing, exportable | New | Free | P2 |
| | Mutual fund holdings with look-through to stocks | New | Free-new (AMFI) | P3 |
| Alerts | Price, valuation and event alerts | Built (in-app) | Free | P1 |
| | Delivery by email, push and Telegram or WhatsApp | New | Messaging providers | P1 |
| | Alerts on filings, results, pledge changes, insider trades, screen entry | New | Free | P2 |
| Briefing | Morning briefing | Built | Free | P1 |
| | Personal briefing: your holdings' news, results and moves | New | Free | P2 |
| | Weekly digest by email | New | Email provider | P2 |

### 7. News and intelligence

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Feed | Exchange filings and press, merged | Built | Free | P1 |
| | Categorised filings (results, orders, acquisitions, management change, litigation) | New | Free | P1 |
| | Material-event detection: large order wins, rating changes, auditor resignations, with the price reaction | New | Free | P2 |
| | Sentiment scored per item and aggregated per company and sector | New | LLM or FinBERT | P3 |
| | Duplicate collapsing across sources | Partial | Free | P2 |

### 8. Data trust layer (the differentiator)

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Provenance | Source line, freshness and delay on every panel | Built | — | P1 |
| Vetting | Second source for quotes, financials, history, shareholding, indices; XBRL settles disputes | Built | Free | P1 |
| Monitoring | Feed watchdog every 30 minutes, daily reconciliation, incidents reported to Claude sessions | Built | — | P1 |
| | Public status page | Built | — | P1 |
| | Incident alerts to the owner by email or Telegram, not only in Claude sessions | New | Messaging provider | P2 |
| Transparency | Methodology page | Built | — | P1 |
| | Data dictionary: every metric's definition, formula, source and known differences between sources | New | — | P2 |
| | Per-figure "how was this computed" popover | New | — | P2 |
| Storage | Historical snapshots of every vetted figure (point-in-time store), the foundation for honest backtests | New | — | P2 |

### 9. Platform

| Subsection | Feature | Status | Data | Priority |
|---|---|---|---|---|
| Accounts | Sign-up and sign-in (email link, Google), profile, preferences | New | Auth provider | P1 |
| | Data moved from browser storage to the account (watchlists, alerts, notes, logged calls) | New | Database | P1 |
| Plans | Free and paid tiers, trials, billing (Razorpay or Stripe India), invoices with GST | New | Payments provider | P1 |
| | Feature gating by tier, usage limits for heavy features (dossier, backtests, AI) | New | — | P1 |
| Exports and sharing | CSV and Excel export everywhere, PDF report of a company page, shareable links | Partial (CSV in places) | — | P2 |
| | Public API with keys and rate limits | New | Licence review | P3 |
| Mobile | Installable web app (PWA), phone-first layouts for the top ten screens | Partial (responsive) | — | P1 |
| | Native apps | New | — | P3 |
| Language | Hindi interface and number formats; later Gujarati, Marathi, Tamil | New | — | P3 |
| Quality | Lighthouse 100 for accessibility, SEO and best practices; performance over 90 on phones | Partial (82 to 91 on phones) | — | P1 |
| | Self-hosted fonts and CI | Built | — | P1 |
| | React Compiler warnings cleared, error tracking (Sentry), product analytics | New | — | P1 |
| Operations | Point-in-time store and job scheduler (SQLite locally, Supabase Postgres via DATABASE_URL) | Built | — | P1 |
| | Object store for filings, backups | New | Infrastructure | P1 |
| | Admin console: users, plans, feed health, incident history, content flags | New | — | P2 |
| Compliance | Disclaimers, terms, privacy policy (DPDP Act 2023), cookie consent | Partial (disclaimer) | Legal review | P1 |
| | SEBI position: whether any feature amounts to research analyst or investment adviser activity | New | Legal review | P1 |
| | Exchange data redistribution: what may be shown live, delayed or end of day without a licence | New | Legal review | P1 |

---

## Part 2. Build pipeline

### 2.1 The pipeline every feature goes through

Each feature moves through the same nine gates. A feature is not shipped until it has passed all of them; the gates are where this project's accuracy standard is enforced.

| Gate | What happens | Output | Exit check |
|---|---|---|---|
| 1. Brief | State the user question the feature answers, who asks it, and what a correct answer looks like | One-paragraph brief and a mock of the answer | The owner agrees the question is worth answering |
| 2. Data contract | Name the primary source, the second source, the authority that settles disputes, refresh rate, licence status | An entry in `data-sources.md` | Every figure has two sources or is labelled single-source; licence status is known |
| 3. Probe | Fetch real responses for 10 to 25 symbols, including awkward ones (banks, dollar filers, recent demergers, SMEs) | Saved samples in the scratchpad, field mapping | Units, currency, period labels and definitions are confirmed against a filing |
| 4. Provider and service | Write the provider (fetch and parse) and the service (compute), with source selection and vetting | Backend modules | Unit tests for parsing, units, edge cases and vetting rules |
| 5. API | Add the route with the response envelope (source, freshness, delay, note) and a cache TTL suited to the data | Route, entry in `backend-api.md` | Route answers in under 2 seconds warm; failures degrade to a labelled partial answer, not a crash |
| 6. Monitoring | Add a watchdog check, and reconciliation checks for every figure that also appears elsewhere | Entries in `watchdog.py` and `reconcile.py` | Reconciliation passes on the sample set; a deliberately broken input fails it |
| 7. Interface | Design in the editorial-terminal system: section head, panel, figures in mono, source line, empty, loading and error states, phone layout | Components and page | Typecheck and lint clean; no horizontal overflow at 375 px; light and dark checked |
| 8. Verification | Check the page in the browser against the probe samples; Lighthouse on the page | Screenshots, scores in the audit doc | Accessibility, best practices and SEO 100; performance not lower than the page it joins |
| 9. Release and watch | Ship behind a flag to a few users, then to all; watch incidents for a week | Release note | No open incident for the feature for seven days |

### 2.2 Phases

Phases are ordered by dependency first and impact second. Each phase ends with an exit check; the next starts only after it.

#### Phase 0. Foundation (prerequisite for anything market-facing)

| Work | Why first | Size |
|---|---|---|
| Commit today's work in reviewed chunks; add CI (typecheck, lint, backend tests, build) on every push | Nothing below is safe without a green pipeline | S |
| Persistent database (Postgres) and a job scheduler (cron-style, inside the backend or a worker) | Accounts, alerts delivery, snapshots and daily logging all need them | M |
| Object store for downloaded filings (XBRL, PDFs) | XBRL is now fetched on demand; full statements and transcripts need storage | S |
| Self-host fonts, clear the 36 React Compiler warnings, add error tracking | Known risks from the audit | S |
| Home mobile performance: stream the sections below the hero | The one page under 85 on phones | S |
| Legal review: SEBI research analyst and adviser boundaries, exchange data redistribution, DPDP privacy | Decides what may launch and in what form | M (external) |

Exit: CI green, database and scheduler in production, legal guidance written down.

#### Phase 1. Launchable research product (P1 features)

| Work | Depends on | Size |
|---|---|---|
| Accounts, synced watchlists and alerts, alert delivery by email and push | Phase 0 database | M |
| Full statements from NSE XBRL, ten-year history, cash flow on the overview | XBRL parser (built) | M |
| Segment and geography figures from XBRL | Full statements | S |
| Peer table and relative valuation bands | Ten-year history | M |
| Reverse DCF | Full statements | S |
| Forensic and quality scores (Piotroski, Altman, Beneish, cash conversion) | Full statements | S |
| Fundamental screener on vetted figures | Full statements, database | M |
| FII and DII flows; index option chain summary; F&O build-up scanner | Scheduler | M |
| Sector heatmap for Nifty 500 | Pulse (built) | S |
| Results season tracker and categorised filings | Filings feed (built) | M |
| Portfolio: CAS and CSV import, P&L, XIRR | Accounts | M |
| Plans and billing, feature gating | Accounts, legal guidance | M |
| Full charting | — | M |
| Installable web app | — | S |

Exit: a paying user can sign in, research any listed company end to end with every figure vetted, track a portfolio, and receive alerts; reconciliation passes on 50 stocks; Lighthouse targets met.

#### Phase 2. Competitive depth (P2 features)

| Work | Depends on | Size |
|---|---|---|
| Options suite: stock chains, strategy builder, IV surface | Option chain (Phase 1) | L |
| Macro dashboard, economic calendar, rates and currency | Scheduler | M |
| Breadth dashboard and market regime | Snapshots | S |
| Smart-money views across the market (insider, SAST, promoter, superstar portfolios) | Database | M |
| Earnings-call transcripts and filing summaries | AI assistant decision, object store | M |
| AI research assistant, answers cited to vetted data | LLM provider, data dictionary | L |
| Backtesting lab with walk-forward gate | Point-in-time snapshots (start collecting in Phase 0) | L |
| Trade journal, notes and thesis tracker | Accounts | M |
| Data dictionary and per-figure "how computed" | — | M |
| Portfolio risk, tax report, dividends | Portfolio | M |
| Owner incident alerts by Telegram or email | Scheduler | S |

Exit: feature parity with the leading Indian research tools on fundamentals and F&O, with the trust layer as the stated difference.

#### Phase 3. Differentiation and scale (P3 features)

Factor lab, correlation and pairs, scenario stress tests, thematic and business-group baskets, mutual fund look-through, sentiment, paper trading, broker connections, public API, Hindi interface, native apps, and paid feeds for analyst estimates, tick data and live intraday (see [paid-feed-roadmap.md](paid-feed-roadmap.md)).

### 2.3 Cross-cutting rules for every phase

- **Accuracy before features.** A new figure ships with its second source and reconciliation check, or with a visible "single source" label. No exceptions for speed.
- **Point-in-time from day one.** Every vetted figure is stored with the date it was known. Backtests and track records are only honest if the data is.
- **One design system.** New pages use the section head, panel, mono figures, gold marks and source lines already in place; no new colours outside the chart tokens.
- **Rate limits are a design constraint.** Each feature declares its upstream calls per page view; heavy work moves to the scheduler and is served from the database.
- **Informational, not advisory, unless registered.** Signals, scores and the assistant describe and explain; they do not tell a user to buy or sell, until the legal review says otherwise.

### 2.4 Decisions the owner needs to make

1. Who the first paying user is: active traders (prioritise options, charting, scanners) or long-term investors (prioritise fundamentals, portfolio, forensics). The phase order above leans to investors, with F&O basics in Phase 1.
2. Which LLM provider powers the assistant and summaries, and the cost ceiling per user.
3. Whether to pursue SEBI research analyst registration, which would allow explicit calls and published track records.
4. Which paid feeds to buy first, and when: analyst estimates, live intraday, or tick data.
5. Pricing: free tier scope, paid tier price, and whether the API is a separate product.
