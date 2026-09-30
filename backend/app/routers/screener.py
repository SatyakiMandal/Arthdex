"""Universe screener endpoints: factor screens and multi-window movers."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..providers import constituents
from ..schemas import envelope
from ..services import screener

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
