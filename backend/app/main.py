"""
Arthdex data service.

Serves live market data to the Next.js front end. Upstream sources are free and
unofficial, so every response carries provenance and age metadata, and every
route degrades to a clear error rather than inventing a value.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import hmac
import os
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import SETTINGS
from .routers import analyzer, bhavcopy, catalysts, company, decisions, derivatives, desk, forecast, health, ipo, market, news, orderflow, portfolio, quant, screener, search, unlisted
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


app = FastAPI(
    title="Arthdex Data Service",
    version="0.1.0",
    description=(
        "Live Indian market data for the Arthdex front end. "
        "Prices are delayed; see each response's meta block for source and age."
    ),
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(SETTINGS.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

_AUTH_EXEMPT_PATHS = {"/", "/docs", "/openapi.json", "/api/v1/health"}


@app.middleware("http")
async def _enforce_api_token(request: Request, call_next):
    expected = os.environ.get("ARTHDEX_API_TOKEN", "")
    if expected:
        if request.method != "OPTIONS" and not (
            request.method == "GET" and request.url.path in _AUTH_EXEMPT_PATHS
        ):
            auth_header = request.headers.get("authorization", "")
            if not hmac.compare_digest(auth_header, f"Bearer {expected}"):
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)


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
