"""Company search across the full NSE listed universe."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..providers import universe as universe_provider
from ..schemas import envelope

router = APIRouter(prefix="/api/v1", tags=["search"])

UNIVERSE_TTL = 86_400


def load_universe():
    return CACHE.get_or_fetch(
        "universe:equity", UNIVERSE_TTL, universe_provider.fetch_equity_universe
    )


@router.get("/search")
def search(q: str = Query("", min_length=0), limit: int = Query(12, ge=1, le=50)):
    """Autocomplete over every equity listed on NSE."""
    try:
        data, age = load_universe()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Universe unavailable: {exc}") from exc

    results = universe_provider.search(data, q, limit)
    return envelope(
        results,
        age,
        source="NSE equity master list",
        delayed_minutes=0,
        note=f"{len(data)} listed equities in universe.",
    )


@router.get("/universe/stats")
def universe_stats():
    try:
        data, age = load_universe()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Universe unavailable: {exc}") from exc

    series_counts: dict[str, int] = {}
    for row in data:
        series_counts[row["series"]] = series_counts.get(row["series"], 0) + 1

    return envelope(
        {"total": len(data), "bySeries": series_counts},
        age,
        source="NSE equity master list",
    )
