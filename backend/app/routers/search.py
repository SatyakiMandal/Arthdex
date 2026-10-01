"""Company search across the full NSE listed universe."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..providers import universe as universe_provider
from ..schemas import envelope
from ..services import unlisted as unlisted_service

router = APIRouter(prefix="/api/v1", tags=["search"])

UNIVERSE_TTL = 86_400


def load_universe():
    return CACHE.get_or_fetch(
        "universe:equity", UNIVERSE_TTL, universe_provider.fetch_equity_universe
    )


@router.get("/search")
def search(q: str = Query("", min_length=0), limit: int = Query(12, ge=1, le=50)):
    """Autocomplete over every NSE-listed equity, plus the unlisted / pre-IPO directory."""
    try:
        data, age = load_universe()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Universe unavailable: {exc}") from exc

    listed = universe_provider.search(data, q, limit)

    # Unlisted names come from the already-built directory. If it is still being built
    # the search answers with listed results only rather than making the keystroke wait.
    unlisted_hits: list[dict] = []
    directory = unlisted_service.cached_directory()
    if directory is not None:
        room = max(limit - len(listed), min(4, limit))
        for c in unlisted_service.search_directory(directory, q, room):
            unlisted_hits.append(
                {
                    "id": c["id"],
                    "symbol": "",
                    "name": c["name"],
                    "series": c["sector"] or "Unlisted",
                    "isin": None,
                    "kind": "unlisted",
                    "href": f"/unlisted/{c['id']}",
                }
            )

    results = (listed[: limit - len(unlisted_hits)] + unlisted_hits)[:limit]
    return envelope(
        results,
        age,
        source="NSE equity master list; UnlistedZone directory",
        delayed_minutes=0,
        note=f"{len(data)} listed equities in universe"
        + ("" if directory is None else f", {len(directory)} unlisted companies") + ".",
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
