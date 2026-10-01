# Arthdex Documentation

Arthdex is a quantitative market-intelligence website for Indian equities. It combines live (delayed) NSE and Yahoo Finance data with statistical models fitted on real return series, and shows where every figure came from.

> **How this was written.** These documents were produced by reading the source at commit `9034491` (branch `main`, 2026-10-01). Nothing here was confirmed by running the site. Commands are taken from `package.json`, `backend/README.md` and the code; check them on your machine before relying on them. `PROJECT_PROGRESS.md` is a historical build log and is partly out of date (see [Documentation drift](data-integrity-and-limitations.md#documentation-drift)); where it disagrees with the code, these docs follow the code.

## Contents

| Document | What it covers |
|---|---|
| **This file** | What the product is, architecture, repository map, quick start, configuration |
| [frontend.md](frontend.md) | Every route, the app shell, data fetching, proxies, shared components, theming |
| [backend-api.md](backend-api.md) | The FastAPI data service: conventions, caching, full endpoint reference, upstream sources |
| [analytics-methods.md](analytics-methods.md) | How the numbers are computed: quant engine, sensitivity, screeners, technicals, Bhavcopy, IPO, news |
| [event-impact-analyzer.md](event-impact-analyzer.md) | The Analyzer tab and the vendored CEIA engine: run lifecycle, outputs, dossier tabs |
| [operations.md](operations.md) | Running, deploying, tuning, storage layout, troubleshooting |
| [data-integrity-and-limitations.md](data-integrity-and-limitations.md) | Provenance model, illustrative data, known gaps, open risks, documentation drift |

## What the site does

| Area | Route | Summary |
|---|---|---|
| Landing | `/` | Live index strip, one-year Nifty 50 chart, methodology, top movers, overnight global cues, latest filings |
| Market watch | `/market-watch` | NSE gainers/losers by universe, daily/weekly/monthly windows, price bands, index table, factor screens |
| Commodities | `/commodities` | 19 futures across metals, energy and agriculture, with Nifty Metal/Energy indices and a rule-based read |
| Technical screener | `/screener` | MACD crossover scan across Nifty 50/100/200 on 5-minute to daily bars |
| Bhavcopy | `/bhavcopy` | One session's breadth, delivery, volume anomalies and circuit closes from NSE's file |
| IPO | `/ipo` | Ongoing, upcoming, closed and listed issues with reconstructed listing performance |
| News | `/news` | NSE corporate filings and financial-press RSS in one flagged feed |
| Alerts | `/alerts` | Threshold builder (client-side only) plus a filtered feed of results-type filings |
| Company | `/company/[symbol]/…` | Ten tabs per listed company: overview, statistics, analysts, statements, history, shareholders, technicals, research dossier, quant engine, macro and news |
| Unlisted | `/unlisted`, `/unlisted/[id]` | Indicative prices, revision history and key ratios for ~270 unlisted companies (UnlistedZone, via the backend) |
| Analyzer | `/analyzer`, `/analyzer/[id]` | Runs a news-driven event study and a full multi-model dossier for a listed or unlisted company |

## Architecture

```
 Browser
   │  HTML (server-rendered React) · small JSON calls to /api/*
   ▼
 Next.js 15 (App Router, React 19)             port 3000
   • Server components fetch data on the server (lib/api/*)
   • Route handlers under app/api/* proxy the browser's calls
   • Server action app/actions/refresh.ts busts caches
   │  HTTP + JSON, ARTHDEX_API_URL
   ▼
 FastAPI data service (backend/app)             port 8000
   • TTL cache with stale-on-failure (app/cache.py)
   • Every payload wrapped in an envelope {data, meta}
   • Providers → Yahoo Finance, NSE, RSS, screener.in
   • Services → quant, screener, technicals, bhavcopy, IPO, news, shareholding
   │
   ├── subprocess per analysis ──► CEIA engine (backend/ceia)
   │        python -m ceia.analyze | ceia.unlisted
   │        writes backend/analyzer_data/runs/<id>/
   ▼
 Upstreams (free, unofficial, rate-limited):
   Yahoo Finance (yfinance) · nseindia.com JSON · nsearchives.nseindia.com CSVs ·
   Moneycontrol / Economic Times / Livemint RSS · screener.in · Indian news sites (analyzer) ·
   UnlistedZone (Unlisted pages and analyzer unlisted mode)
```

Key design points:

1. **The browser never talks to the data service.** Pages fetch on the server; client components call same-origin routes under `app/api/*`. CORS on the backend is therefore not on the critical path.
2. **Provenance is part of the contract.** Every backend payload carries `meta.source`, `meta.delayedMinutes`, `meta.cacheAgeSeconds` and `meta.illustrative`. The UI renders them (freshness badges, source lines, illustrative banners).
3. **Failure is surfaced, not papered over.** Failed fetches render a `DataUnavailable` panel. Missing values render as `—`, never `0`. A model that cannot converge returns `null` plus a note.
4. **No figure is free-floating.** Derived numbers are computed from data shown on the same page, so the page cannot contradict itself.

## Technology

| Layer | Stack |
|---|---|
| Frontend | Next.js `^15.5.26`, React 19.0.0, TypeScript 5.7 (strict), Tailwind CSS 3.4.17, Framer Motion 11.18, next-themes, Lucide icons, Material UI (`@mui/material`, used only for the `Tip` tooltip) |
| Charts | Hand-rolled SVG (no chart library; `recharts` and `lightweight-charts` were removed) |
| Fonts | Inter (body), Sora (display), Noto Sans Devanagari, via `next/font/google` |
| Backend | Python, FastAPI 0.142, uvicorn, pandas 3, numpy, scipy, statsmodels, `arch`, `yfinance`, `curl_cffi`, BeautifulSoup/lxml, openpyxl |
| Analyzer ML | `torch` and `transformers` for FinBERT and GoEmotions (optional; the engine falls back to a lexicon without them) |

## Repository map

```
app/                    Next.js routes (see frontend.md)
  actions/refresh.ts    Server action: expire backend cache + revalidate Next cache
  api/                  Same-origin proxies: search, candles, metric, technicals, screener/macd, analyzer/[...path]
  company/[symbol]/     Shared layout + 10 tab routes
  analyzer/, ipo/, news/, alerts/, bhavcopy/, commodities/, market-watch/, screener/, unlisted/
components/
  layout/               site-header (server), header-bar (client), market-ticker, footer, refresh-control
  landing/              hero, methodology, index-chart, motion helpers (bento-grid is present but unused)
  company/  quant/  macro/  market/  technicals/  shareholding/  yahoo/  unlisted/  alerts/
  analyzer/             launcher, run-list, run-view, run-progress, summary-view, dossier/* (12 tabs)
  ui/                   data-card, data-provenance, desk-analysis, segmented-control, swap-panel, cell-bar, gauge, tip, skeleton, …
lib/api/                client.ts (envelope-aware fetch), endpoints.ts, analyzer.ts, types.ts
types/                  Shared TypeScript contracts (analyzer.ts, market.ts, quant.ts, …)
backend/
  app/                  FastAPI service: main.py, config.py, cache.py, schemas.py, routers/, providers/, services/
  ceia/                 Vendored event-impact engine (57 Python files)
  analyzer_samples/     19 bundled sample reports (16 listed, 3 unlisted)
  cache/                Committed HTTP/price cache files for the engine (see operations.md)
  requirements.txt  README.md
PROJECT_PROGRESS.md     Historical build log
```

## Quick start

Prerequisites: a current Node.js LTS (Next 15 needs 18.18 or newer), a recent Python (the build log records Python 3.14; the pinned pandas 3 and numpy 2.5 will not install on old interpreters), and network access to Yahoo Finance and nseindia.com. No minimum versions are declared in the repo, so treat these as guidance.

**1. Data service** (terminal 1)

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt      # Windows
# ./.venv/bin/python -m pip install -r requirements.txt            # macOS / Linux
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Interactive API docs: <http://127.0.0.1:8000/docs>. Health: `GET /api/v1/health`.

**2. Website** (terminal 2)

```bash
npm install
cp .env.example .env.local        # sets ARTHDEX_API_URL=http://127.0.0.1:8000
npm run dev                       # http://localhost:3000
```

**3. Checks**

```bash
npm run typecheck
npm run lint
npm run build
```

The launch configuration for the in-app preview is `.claude/launch.json` (`arthdex-dev`, `npm run dev`, port 3000).

> Do not run `npm run build` while `npm run dev` is running. It overwrites `.next` and the dev server then fails with `__webpack_modules__[moduleId] is not a function`. Stop the dev server, delete `.next`, then build.

## Configuration

| Variable | Read by | Default | Purpose |
|---|---|---|---|
| `ARTHDEX_API_URL` | Next.js server (`lib/api/client.ts`, `lib/api/analyzer.ts`, `app/actions/refresh.ts`) | `http://127.0.0.1:8000` | Base URL of the data service. Server-side only; it is not exposed to the browser |
| `ARTHDEX_QUOTE_TTL` | Backend | `60` | Seconds to cache quotes |
| `ARTHDEX_CANDLES_TTL` | Backend | `900` | Seconds to cache candles |
| `ARTHDEX_ANALYZER_CONCURRENCY` | Backend | `2` | Simultaneous analyzer subprocesses |
| `ARTHDEX_ANALYZER_TIMEOUT` | Backend | `5400` | Per-run kill timeout, seconds |

All other TTLs are constants in `backend/app/config.py` or inline in the routers. See [operations.md](operations.md).

## Disclaimer in the product

The footer states that Arthdex is for research only, is not investment advice, and is not a SEBI-registered investment adviser; that grey-market premiums are unofficial; and that unlisted prices are dealer quotes. Treat that wording as part of the product contract when changing the UI.
