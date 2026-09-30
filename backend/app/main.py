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
from .routers import analyzer, company, health, ipo, market, news, quant, screener, search
from .services import analyzer as analyzer_service

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


@app.on_event("startup")
def _analyzer_startup() -> None:
    analyzer_service.RUNS_DIR.mkdir(parents=True, exist_ok=True)
    analyzer_service.recover_interrupted()
    analyzer_service.seed_samples()


@app.get("/")
def root():
    return {
        "service": "arthdex-data",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
