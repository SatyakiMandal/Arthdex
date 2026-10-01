# Operations

## 1. Processes and ports

| Process | Command | Port |
|---|---|---|
| Data service | `cd backend && ./.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` (add `--reload` for development) | 8000 |
| Website (dev) | `npm run dev` | 3000 |
| Website (prod) | `npm run build && npm run start` | 3000 |

Start the data service first. The website renders without it, but every data panel shows a `DataUnavailable` message that includes the start command.

## 2. Configuration summary

| Setting | Where | Notes |
|---|---|---|
| `ARTHDEX_API_URL` | `.env.local` (git-ignored; template `.env.example`) | Production example in the template: `https://arthdex-data.yourdomain.com`. Server-side only |
| `ARTHDEX_QUOTE_TTL`, `ARTHDEX_CANDLES_TTL` | Backend environment | Only these two TTLs are env-driven |
| Other TTLs | `backend/app/config.py` and routers | index 60 s, movers 120 s, candles 900 s, fundamentals 86 400 s, IPO 1 800 s, news 300 s, quant 3 600 s; inline: commodities 600 s, shareholding 6 h, Yahoo sections 3 to 6 h, universe 24 h, screener universe 1 h, technicals 120 s/900 s, Bhavcopy 1 h |
| `ARTHDEX_ANALYZER_CONCURRENCY`, `ARTHDEX_ANALYZER_TIMEOUT` | Backend environment | Defaults 2 and 5400 s |
| CORS origins | `config.py` (`allowed_origins`) | Hard-coded to localhost:3000. Not needed for the website itself, because the browser never calls the backend |

## 3. Caching layers (and how to make data fresh)

1. **Backend TTL cache** (in process). Serves stale on upstream failure.
2. **Next.js fetch cache** (per `revalidate`, tagged `"api"`).
3. **Browser**: nothing special; pages are server-rendered.

Ways to force fresh data:
- Click the floating refresh control (server action: expires backend entries for that page, then `revalidateTag("api")` and `revalidatePath`).
- `POST /api/v1/cache/refresh` with `{prefixes, symbol}` directly.
- Restart the backend (clears its cache).
- Delete `.next/cache/fetch-cache` **with the dev server stopped**. While `next dev` runs, the fetch cache is also held in memory, so deleting files has no effect and a corrected payload looks stale for the whole revalidate window.

Use `GET /api/v1/cache` to see keys and ages when diagnosing staleness, or the `/status` page for a per-feed summary.

**Warm-up.** On start the service builds the unlisted directory in a background thread (a dozen polite fetches at a 2-second spacing, about 30 to 55 seconds). Until it finishes, search returns listed hits only and `/unlisted` shows its loading state. The IPO pipeline is warmed the same way. Restarting the backend therefore restarts both warm-ups.

## 4. Storage layout (backend)

| Path | Contents | Git |
|---|---|---|
| `backend/analyzer_data/runs/<id>/` | `meta.json`, `run.log`, `analysis.json`, `report.html`, `model.xlsx` | ignored |
| `backend/analyzer_data/data/news_cache/` | Per-company scraped-news cache shared by runs | ignored |
| `backend/analyzer_data/cache/` | HTTP/price cache used by analyzer subprocesses | ignored |
| `backend/analyzer_samples/` | 19 bundled sample reports plus `index.json` (about 17 MB) | tracked |
| `backend/cache/` | `http/` JSON responses (tradingeconomics, screener.in, govtbudget), `prices_day/*.pkl`, `unlisted/` (UnlistedZone pages fetched by the unlisted service), `provenance.jsonl` | ignored (`/cache/` in `backend/.gitignore`). They look like by-products of engine code run with `backend/` as the working directory (for example the price preflight) |

Back up `analyzer_data/runs` if finished reports matter; it is the only durable state in the system.

## 5. Deployment guidance

The repository contains no Dockerfile, CI configuration or deployment manifests (only `.gitignore` mentions `.vercel`). The following follows from how the code behaves:

- **Run the data service as a single process.** The TTL cache and the analyzer's concurrency semaphore (`_SLOTS`) are per process. Several uvicorn workers would not share cache or the concurrency limit, and each would try to run recovery at startup. `recover_interrupted()` considers a run orphaned if its id is not in that process's `_PROCS`, so a second worker could mark another worker's live run `FAILED`.
- **Persistent disk** for `backend/analyzer_data` (runs, news cache, model downloads in the Hugging Face cache).
- **Resources.** An analyzer run loads torch models; budget RAM for 2 concurrent runs or lower `ARTHDEX_ANALYZER_CONCURRENCY`.
- **Network egress** to Yahoo Finance, `nseindia.com`, `nsearchives.nseindia.com`, the RSS hosts, screener.in and (for analyzer news) several Indian news sites. NSE rejects non-browser clients, which is why `curl_cffi` impersonation is used; cloud IP ranges may be throttled or blocked.
- **Keep the data service private.** It has no authentication. Expose only the Next.js app and set `ARTHDEX_API_URL` to an internal address. Note that the Next.js app still forwards analyzer routes (including POST and DELETE) to it for anyone who can reach the site.
- Dates use the server's local `date.today()` for window validation and snapshot windows; run both services in the same time zone.
- Do not run `next build` over a live `next dev`; see the quick-start note.

## 6. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Every panel shows "Cannot reach the data service" | Backend not running or `ARTHDEX_API_URL` wrong. Check `GET /api/v1/health` |
| Ticker bar, movers or IPO fail with 503 | NSE cookies expired or the IP is throttled. `nse_get` already retries three times with backoff. Wait and use the refresh control |
| `/unlisted` slow or unavailable right after the backend starts | The directory is built by a background thread started at startup (roughly 30 to 55 seconds). Until it finishes, a request to `/unlisted` that finds no cached directory builds one itself inside the request (the backend does not coordinate it with the warm-up thread), so it can take that long, and search returns listed hits only |
| IPO page empty or slow on first load | The first pipeline build takes about a minute; the backend pre-warms it in a thread at startup. Later calls hit the cache |
| `__webpack_modules__[moduleId] is not a function` in dev | `next build` ran over a live dev server. Stop dev, delete `.next`, restart |
| Corrected backend data still looks old | Next fetch cache (see section 3) |
| Quant tab slow or blank on first visit | Four volatility models are fitted on a cold cache; the route has a skeleton. Short histories (< 180 daily observations) return notes instead of values |
| Weekly/monthly movers or factor screens say unavailable | The batch constituent download failed; daily movers still work |
| Analyzer run fails within seconds | Price preflight found no history for the ticker. Check the symbol (BSE tickers end `.BO`) |
| Analyzer run "Interrupted: the service restarted…" | The backend restarted mid-run. Start a new run |
| Analyzer is slow on first run | FinBERT/GoEmotions downloads (about 500 MB each) and uncached news crawl. Subsequent runs reuse caches |
| No emotion tags in a report | `torch`/`transformers` missing; the engine fell back to the lexicon (stated in the log) |
| Company page 404 "Symbol not found" | Yahoo has no quote for `SYMBOL.NS`; try the exact NSE symbol via search |

## 7. Verification checklist after changes

```bash
npm run typecheck && npm run lint && npm run build
```

```bash
cd backend && ./.venv/Scripts/python.exe -m unittest discover -s tests -v   # unlisted research arithmetic, 16 tests, no network
```

These are the only automated tests in the repository (see finding F-29 in the code review); they cover the unlisted valuation, risk, forecast and call logic.

Then, with both services running: load `/`, `/market-watch`, a company page and each of its tabs, `/news`, `/ipo`, `/bhavcopy`, `/commodities`, `/screener`, `/unlisted`, `/analyzer`, `/watchlist`, `/alerts`, `/deals`, `/calendar`, `/briefing`, `/methodology`, `/status`; check both themes; check `/company/NOTREAL` shows the symbol-not-found page and `/nope` the root 404 (adding a layout can silently relocate an error boundary). The build log recommends reading figures from the DOM rather than downscaled screenshots.
