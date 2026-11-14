"""
Arthdex data service.

Serves live market data to the Next.js front end. Upstream sources are free and
unofficial, so every response carries provenance and age metadata, and every
route degrades to a clear error rather than inventing a value.
"""

from __future__ import annotations

import hmac
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import SETTINGS
from .routers import (
    analyzer,
    bhavcopy,
    catalysts,
    company,
    corporate_network,
    decisions,
    derivatives,
    desk,
    forecast,
    funds,
    health,
    ipo,
    macro,
    market,
    news,
    orderflow,
    paper_trading,
    portfolio,
    quant,
    quant_risk_lab,
    screener,
    search,
    sector_kpi,
    sme_markets,
    tear_sheet,
    unlisted,
    valuation_lab,
)
from .services import analyzer as analyzer_service
from .services import unlisted as unlisted_service


def _startup() -> None:
    _analyzer_startup()
    _models_status()
    _unlisted_warmup()
    _feed_watchdog()
    _scheduler()
    if (
        os.environ.get("ARTHDEX_WATCHDOG_MINUTES") != "0"
        and os.environ.get("ARTHDEX_SCHEDULER", "").lower() not in ("0", "false", "off")
    ):
        _prewarm()


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _startup()
    yield


LOG = logging.getLogger("arthdex.api")


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


_DOCS_ENABLED = _flag("ARTHDEX_ENABLE_DOCS") or (
    not os.environ.get("ARTHDEX_API_TOKEN") and not _flag("ARTHDEX_DISABLE_DOCS")
)
# "testclient" is the address Starlette's in-process TestClient reports; a socket peer is
# always an IP address, so no network caller can present it.
_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost", "testclient"}
MAX_BODY_BYTES = 1_000_000  # no route takes more than a few kilobytes of JSON

app = FastAPI(
    title="Arthdex Data Service",
    version="0.1.0",
    description=(
        "Live Indian market data for the Arthdex front end. "
        "Prices are delayed; see each response's meta block for source and age."
    ),
    lifespan=_lifespan,
    # The interactive docs list every route. They are served only when asked for, or in
    # local development where no token is configured.
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(SETTINGS.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

_AUTH_EXEMPT_PATHS = {"/", "/api/v1/health"}
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def _enforce_api_token(request: Request, call_next):
    """
    With ARTHDEX_API_TOKEN set, every route but the health probe needs the bearer token.

    Without it the service is read-only to the network: requests that change state (orders,
    analyzer runs, notes, cache and feed repair) are accepted from this machine only. A
    deployment whose gateway authenticates callers itself (a private Hugging Face Space)
    opts out with ARTHDEX_ALLOW_OPEN_WRITES=1.
    """
    expected = os.environ.get("ARTHDEX_API_TOKEN", "")
    if expected:
        if request.method != "OPTIONS" and not (
            request.method == "GET" and request.url.path in _AUTH_EXEMPT_PATHS
        ):
            auth_header = request.headers.get("authorization", "")
            # bytes, because compare_digest raises on a non-ASCII str
            if not hmac.compare_digest(
                auth_header.encode("utf-8", "replace"), f"Bearer {expected}".encode("utf-8")
            ):
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    elif request.method not in _SAFE_METHODS and not _flag("ARTHDEX_ALLOW_OPEN_WRITES"):
        client_host = request.client.host if request.client else ""
        if client_host not in _LOOPBACK_HOSTS:
            return JSONResponse(
                {"detail": "Write access needs ARTHDEX_API_TOKEN to be configured on the data service"},
                status_code=401,
            )
    return await call_next(request)


@app.middleware("http")
async def _limit_body_size(request: Request, call_next):
    """Refuse oversized uploads before a route reads them into memory."""
    if request.method not in _SAFE_METHODS:
        declared = request.headers.get("content-length")
        if declared is None:
            if request.headers.get("transfer-encoding"):
                return JSONResponse({"detail": "Content-Length is required"}, status_code=411)
        else:
            try:
                too_large = int(declared) > MAX_BODY_BYTES
            except ValueError:
                return JSONResponse({"detail": "Invalid Content-Length"}, status_code=400)
            if too_large:
                return JSONResponse({"detail": "Request body too large"}, status_code=413)
    return await call_next(request)


@app.exception_handler(StarletteHTTPException)
async def _http_error(request: Request, exc: StarletteHTTPException):
    """
    Routes build 5xx details as "<what failed>: <exception text>". The exception text can
    carry upstream URLs, file paths or library internals, so it goes to the log and the
    caller gets only the first part.
    """
    detail = exc.detail
    if exc.status_code >= 500 and isinstance(detail, str) and ": " in detail:
        LOG.warning("%s %s -> %s %s", request.method, request.url.path, exc.status_code, detail)
        detail = detail.split(": ", 1)[0]
    return JSONResponse({"detail": detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(Exception)
async def _unhandled_error(request: Request, exc: Exception):
    LOG.exception("%s %s failed", request.method, request.url.path)
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


app.include_router(health.router)
app.include_router(market.router)
app.include_router(company.router)
app.include_router(quant.router)
app.include_router(ipo.router)
app.include_router(news.router)
app.include_router(search.router)
app.include_router(screener.router)
app.include_router(analyzer.router)
app.include_router(bhavcopy.router)
app.include_router(unlisted.router)
app.include_router(desk.router)
app.include_router(orderflow.router)
app.include_router(decisions.router)
app.include_router(derivatives.router)
app.include_router(catalysts.router)
app.include_router(portfolio.router)
app.include_router(forecast.router)
app.include_router(macro.router)
app.include_router(funds.router)
app.include_router(paper_trading.router)
app.include_router(corporate_network.router)
app.include_router(valuation_lab.router)
app.include_router(sme_markets.router)
app.include_router(tear_sheet.router)
app.include_router(quant_risk_lab.router)
app.include_router(sector_kpi.router)


def _analyzer_startup() -> None:
    analyzer_service.RUNS_DIR.mkdir(parents=True, exist_ok=True)
    analyzer_service.recover_interrupted()
    analyzer_service.seed_samples()


def _models_status() -> None:
    # Say plainly which sentiment engine analyses will use, so a missing model is visible at start-up
    import logging

    from ceia import models_registry

    info = models_registry.status()
    logging.getLogger("uvicorn.error").info(
        "Language models: %s. Run `python scripts/download_models.py` to fetch them ahead of time.", info["engine"]
    )


def _unlisted_warmup() -> None:
    # A cold directory is about half a minute of polite fetching, so build it in the
    # background rather than on the first visitor's request.
    unlisted_service.ensure_warm()


def _feed_watchdog() -> None:
    # Probe every feed on a timer, repair what it can, and log the rest (see app/watchdog.py)
    from . import watchdog

    watchdog.start_background()


def _scheduler() -> None:
    # Daily and periodic data jobs (flows, snapshots) recorded in the store; see app/scheduler.py
    from . import jobs, scheduler  # noqa: F401  (importing jobs registers them)

    scheduler.start_background()


@app.get("/")
def root():
    return {
        "service": "arthdex-data",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


def _prewarm() -> None:
    """Build the IPO pipeline in the background: it needs ~a minute of upstream calls the first time."""
    import threading

    from .cache import CACHE
    from .config import SETTINGS
    from .services import ipo as ipo_service

    def run() -> None:
        try:
            CACHE.get_or_fetch("ipo:pipeline", SETTINGS.ipo_ttl, ipo_service.build_pipeline)
        except Exception:
            pass

    threading.Thread(target=run, name="prewarm-ipo", daemon=True).start()
