"""
Arthdex data service.

Serves live market data to the Next.js front end. Upstream sources are free and
unofficial, so every response carries provenance and age metadata, and every
route degrades to a clear error rather than inventing a value.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import SETTINGS
from .routers import analyzer, bhavcopy, company, health, ipo, market, news, orderflow, quant, screener, search, unlisted, desk
from .services import analyzer as analyzer_service
from .services import unlisted as unlisted_service

app = FastAPI(
    title="Arthdex Data Service",
    version="0.1.0",
    description=(
        "Live Indian market data for the Arthdex front end. "
        "Prices are delayed; see each response's meta block for source and age."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(SETTINGS.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

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


@app.on_event("startup")
def _analyzer_startup() -> None:
    analyzer_service.RUNS_DIR.mkdir(parents=True, exist_ok=True)
    analyzer_service.recover_interrupted()
    analyzer_service.seed_samples()


@app.on_event("startup")
def _models_status() -> None:
    # Say plainly which sentiment engine analyses will use, so a missing model is visible at start-up
    import logging

    from ceia import models_registry

    info = models_registry.status()
    logging.getLogger("uvicorn.error").info(
        "Language models: %s. Run `python scripts/download_models.py` to fetch them ahead of time.", info["engine"]
    )


@app.on_event("startup")
def _unlisted_warmup() -> None:
    # A cold directory is about half a minute of polite fetching, so build it in the
    # background rather than on the first visitor's request.
    unlisted_service.ensure_warm()


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


_prewarm()
