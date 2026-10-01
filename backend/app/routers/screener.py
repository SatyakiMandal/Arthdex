"""Universe screener endpoints: factor screens and multi-window movers."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..providers import constituents
from ..schemas import envelope
from ..services import screener, technicals

router = APIRouter(prefix="/api/v1/screener", tags=["screener"])

# The batch download is the expensive call, so the derived screens share one
# cached universe rather than each triggering their own.
UNIVERSE_TTL = 3_600


def _universe(index: str):
    return CACHE.get_or_fetch(
        f"screener:universe:{index}",
        UNIVERSE_TTL,
        lambda: screener.build_universe_stats(index),
    )


@router.get("/indices")
def available_indices():
    return {
        "default": "nifty100",
        "indices": [
            {"id": key, "label": label} for key, (label, _f) in constituents.INDEX_FILES.items()
        ],
    }


@router.get("/factors")
def get_factors(
    index: str = Query("nifty100"),
    limit: int = Query(10, ge=3, le=30),
):
    if index not in constituents.INDEX_FILES:
        raise HTTPException(status_code=400, detail=f"unknown index '{index}'")

    try:
        stats, age = _universe(index)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Screener unavailable: {exc}") from exc

    screens = screener.factor_screens(stats, limit)
    return envelope(
        {
            **screens,
            "index": stats.get("index"),
            "indexLabel": stats.get("indexLabel"),
            "benchmark": stats.get("benchmark"),
            "computed": stats.get("computed"),
            "universeSize": stats.get("universeSize"),
        },
        age,
        source="Computed from Yahoo Finance history over NSE index constituents",
        delayed_minutes=15,
        note="Beta and alpha regressed on Nifty 50 over one year of daily returns.",
    )


@router.get("/movers")
def get_windowed_movers(
    window: str = Query("weekly", pattern="^(daily|weekly|monthly)$"),
    index: str = Query("nifty100"),
    limit: int = Query(15, ge=3, le=30),
):
    if index not in constituents.INDEX_FILES:
        raise HTTPException(status_code=400, detail=f"unknown index '{index}'")

    try:
        stats, age = _universe(index)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Screener unavailable: {exc}") from exc

    result = screener.windowed_movers(stats, window, limit)
    return envelope(
        {**result, "index": stats.get("index"), "indexLabel": stats.get("indexLabel")},
        age,
        source="Computed from Yahoo Finance history over NSE index constituents",
        delayed_minutes=15,
        note="NSE publishes daily variations only; weekly and monthly windows are computed from price history.",
    )


@router.get("/macd-crossover")
def macd_crossover(
    direction: str = Query("above", pattern="^(above|below)$"),
    interval: str = Query("15m"),
    within: int = Query(3, ge=1, le=50, description="Crossed within the last N bars"),
    index: str = Query("nifty50"),
):
    """Stocks whose MACD line crossed above / below its signal line in the last N bars."""
    if interval not in technicals.INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {list(technicals.INTERVALS)}")
    if index not in constituents.INDEX_FILES:
        raise HTTPException(status_code=400, detail=f"unknown index '{index}'")

    def compute():
        members, _ = CACHE.get_or_fetch(
            f"screener:members:{index}", 86_400, lambda: constituents.fetch_constituents(index)
        )
        return technicals.macd_crossover_screen(members, interval, direction, within)

    intraday = technicals.INTERVALS[interval][3]
    try:
        data, age = CACHE.get_or_fetch(
            f"screener:macd:{index}:{interval}:{direction}:{within}", 120 if intraday else 900, compute
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Screener unavailable: {exc}") from exc
    return envelope(
        {**data, "index": index},
        age,
        source="Yahoo Finance",
        delayed_minutes=15,
        note="Computed from 15-minute delayed bars; a crossover on the latest bar can still flip before the bar closes.",
    )
