# Data sources, backups and vetting

Every figure on Arthdex comes from a public source. This page lists, feed by feed, the primary source, the second source behind it, how the two are checked against each other, and what still has no second source. Kept current as of 3 November 2026.

## How vetting works

- **Live, on every fetch.** Where a backup is fetched alongside the primary (quotes, company financials, recent closes, promoter holding), the two are compared before anything is served. The response carries the comparison (`sources` or `vetting`), and the page says when it is showing the backup and why.
- **Daily, in the watchdog.** `backend/app/reconcile.py` cross-checks figures between sources, between tabs, and against arithmetic (P/E must equal price over EPS). The watchdog runs it once a day over TCS, Infosys, HDFC Bank and Reliance, plus all ticker indices. Each failing check opens a `Figures: <check>` incident, which the session-start hook reports in the next Claude session. Run it on demand with `npm run data:reconcile` (any symbols can be passed).
- **Feed health, every 30 minutes.** `backend/app/watchdog.py` probes 18 feeds, repairs what it can (retry, clear cache, re-prime NSE) and logs the rest.

**Third source to settle disputes.** When Yahoo and screener.in still disagree on a figure after vetting, the company's own XBRL filing with NSE for that period is fetched (`backend/app/providers/nse_xbrl.py`, both the integrated-filing and the older results listings, general and banking taxonomies). The source that matches the filing is right; if the series on screen is the wrong one, the filed figure replaces it and the panel says so. EPS that differs from the filing by a whole split or bonus factor counts as a restatement, not an error. Only disputed periods are fetched, and a parsed filing is cached for 30 days because filings never change.

Two sources often define a line differently (revenue gross or net of excise, profit with or without minority interest, a lender's gross or net interest). Vetting therefore tests consistency, not equality. A steady ratio across recent periods is a difference in definition and is recorded as `basis`. A period that breaks the pattern, or a ratio too far from 1:1 to be a definition (Infosys in dollars read as rupees), is a disagreement and fails.

## Company data

| Feed | Primary | Second source | Vetting | Notes |
|---|---|---|---|---|
| Quote (price, day range, 52-week range, volume, market cap) | NSE quote API | Yahoo Finance | Every fetch: price within 0.5% | NSE is the exchange of record. Yahoo carries the page when NSE refuses a network, which it does for many cloud hosts |
| Profile (name, sector, ISIN) | Yahoo Finance | NSE quote | ISIN always from NSE (Yahoo leaves it empty) | If Yahoo has no profile, name and classification come from NSE |
| Quarterly results | Yahoo Finance | screener.in, NSE XBRL filings to settle disputes | Every fetch: revenue and EPS over every quarter shown | Falls back when Yahoo is stale or gapped (HDFC Bank: Yahoo stopped at June 2025), and prefers screener.in's rupee filings where Yahoo's were converted from dollars (Infosys) |
| Annual results | Yahoo Finance | screener.in, NSE XBRL filings to settle disputes | Every fetch: revenue and EPS over every year shown | Same rules |
| Balance sheet | Yahoo Finance | screener.in, NSE XBRL filings to settle disputes | Every fetch: net worth, total assets, borrowings over every year-end shown | screener.in has no current assets or liabilities, so the current ratio is blank when it is the source |
| Peers | screener.in industry classification and peer table | None for the other companies | Every fetch: the company's own row must match Arthdex's price, market cap and P/E, or the table is marked unvetted | Names from the NSE equity master |
| P/E band (five years) | Computed: Yahoo weekly prices over screener.in annual EPS | Inherits both | Only EPS already published at each date (60 days after year end) | |
| Quality checks and reverse DCF | Yahoo Finance annual line items | Headline lines vetted against the two-source financials | Every fetch: Yahoo's revenue, net income and total assets for each year used must agree with the vetted figures, or the scores are withheld; daily reconciliation fails on a withheld panel | Lenders get no operating scores |
| Valuation multiples | Derived | Statistics tab (Yahoo) | Daily: P/E and P/B equal price over EPS and book value | Re-derived from the live price on every request |
| Daily price history | Yahoo Finance | NSE daily history (1M, 6M, 1Y) | Every fetch: last 10 closes within 0.5% | NSE prices are not adjusted for splits or bonus issues; the page says so when they are shown |
| Weekly, monthly and intraday history | Yahoo Finance | None | Daily: last close against the quote | No free exchange equivalent |
| Shareholding pattern | screener.in | NSE shareholding filings | Every fetch: latest promoter holding within 0.5 points | NSE has promoter and public only; FII, DII and government splits are screener.in's |
| Promoter pledge, SAST and insider disclosures | NSE | None | Feed watchdog | Exchange filings; NSE is the only public source |
| Statistics tab | Yahoo Finance | Partly: TTM revenue and profit from the vetted statements, 52-week range from NSE | Daily reconciliation | Yahoo-only lines (margins, cash, forward EPS) have no second source |
| Statements tab (full line items) | Yahoo Finance | None | Daily: freshness of the latest quarter | screener.in does not publish full line items. For HDFC Bank this tab is still Yahoo's stale series |
| Analysts tab | Yahoo Finance | None | Daily: reported EPS against filed EPS | No free second source for broker estimates; EPS basis is labelled |
| Technicals, quant, sensitivity | Computed from price history | Inherit the price-history backup | Daily: technicals close against the quote | Calculations, not sourced figures |

## Market data

| Feed | Primary | Second source | Vetting | Notes |
|---|---|---|---|---|
| Ticker indices (16) | NSE | Yahoo Finance | Daily: every level within 0.2% (VIX 1%) | Vetted 3 Nov 2026: all 16 matched to the paisa. Breadth and index valuation are NSE-only and blank on the backup |
| Institutional flows (FII/FPI, DII) | NSE provisional, all exchanges, by trade date | NSDL custodial FPI report, a day later | Every record: buy minus sell equals net, plausible size; daily: freshness, and direction agrees with NSDL on large days | Two different measures, shown side by side. NSE keeps one day, so history is recorded daily by the scheduler from 3 Nov 2026 |
| Option chains | NSE option-chain-v3 | None free | Every fetch: underlying matches Arthdex's price, per-strike OI adds up to NSE's totals, put-call parity at the money within 15% of the straddle; stale last trades marked | Greeks use each strike's out-of-the-money IV |
| F&O build-up | NSE open-interest changes with NSE traded prices | None | Feed watchdog | Price change from the exchange's adjusted base |
| Market pulse (Nifty 50 grid, breadth) | NSE traded list and index constituents | None | Feed watchdog | NSE's equity-stockIndices endpoint was retired; this uses its replacement |
| Movers | NSE | None | Feed watchdog | |
| News and filings | NSE announcements | Indian financial press RSS | Both always merged | Two sources by design |
| IPO pipeline | NSE IPO desk | Yahoo Finance for listing performance | Feed watchdog | |
| Deals, calendar, bhavcopy | NSE | None | Feed watchdog | Exchange publications |
| Global indices, commodities | Yahoo Finance | None | Feed watchdog | |
| Listed universe and search | NSE equity master | None | Feed watchdog | |
| Unlisted directory | UnlistedZone | NSE master for matching | Feed watchdog | Indicative dealer quotes, labelled as such |
| Screener factors | Computed from Yahoo history | Inherit the price-history backup for daily ranges | Feed watchdog | |

## Still without a second source, in order of impact

1. **Analysts' estimates.** Yahoo only. A paid feed (Refinitiv, FactSet, Trendlyne) is the realistic second source.
2. **Statements tab line items.** Yahoo only; screener.in carries summary lines, not full statements. The XBRL parser now reads the headline lines from NSE filings; extending it to every line item would give this tab a second source.
3. **Movers, pulse, deals, calendar, bhavcopy.** NSE only. These are exchange publications, so the exchange is already the authority; the risk is availability, not accuracy. BSE's equivalents are the natural backup.
4. **Global indices and commodities.** Yahoo only. Stooq or an exchange feed would be a second source.
5. **Long-range and intraday history.** Yahoo only.

## Known differences between sources (not errors)

- screener.in's net profit includes minority interest; Yahoo's is attributable to owners. Vetting compares EPS instead.
- For lenders, screener.in's revenue is gross interest earned and Yahoo's is net interest income. Revenue is not vetted for lenders, and a panel built from screener.in says so.
- Yahoo restates older periods after mergers and demergers. Where that makes the sources disagree, the original filing settles it.
- NSE's pledge dataset reports promoter holding on a different basis from the shareholding pattern (Infosys: 21.36% against 13.9%). The pattern's figure is shown; both the pattern and NSE's shareholding filings agree on it.
