"""Company search across every listed equity on NSE and BSE, and the unlisted directory."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from .. import listings
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
    """Autocomplete over every listed equity on NSE and BSE, plus the unlisted / pre-IPO directory."""
    source = "NSE and BSE listings (NSE main board, NSE Emerge, BSE scrip master), joined by ISIN"
    try:
        data = listings.all_listings()
        age = CACHE.age("listings:all") or 0.0
        listed = listings.search(q, limit)
    except Exception:
        # Both exchanges' lists failed to build: NSE's own master still answers
        try:
            data, age = load_universe()
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Universe unavailable: {exc}") from exc
        listed = universe_provider.search(data, q, limit)
        source = "NSE equity master list (BSE listings unavailable)"

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
        source=f"{source}; UnlistedZone directory",
        delayed_minutes=0,
        note=f"{len(data)} listed companies"
        + ("" if directory is None else f", {len(directory)} unlisted companies") + ".",
    )


@router.get("/universe/stats")
def universe_stats():
    """How many companies are covered, on which exchange and board, counted from the exchanges' own files."""
    try:
        data = listings.all_listings()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Universe unavailable: {exc}") from exc

    def count(pred) -> int:
        return sum(1 for e in data if pred(e))

    return envelope(
        {
            "companies": len(data),
            "bothExchanges": count(lambda e: len(e["exchanges"]) == 2),
            "nseOnly": count(lambda e: e["exchanges"] == ["NSE"]),
            "bseOnly": count(lambda e: e["exchanges"] == ["BSE"]),
            "nse": {"main": count(lambda e: (e["nse"] or {}).get("board") == "main"), "sme": count(lambda e: (e["nse"] or {}).get("board") == "sme")},
            "bse": {
                "main": count(lambda e: (e["bse"] or {}).get("board") == "main"),
                "sme": count(lambda e: (e["bse"] or {}).get("board") == "sme"),
                "suspended": count(lambda e: (e["bse"] or {}).get("status") == "suspended"),
            },
        },
        CACHE.age("listings:all") or 0.0,
        source="NSE equity master and Emerge lists; BSE scrip master (active and suspended)",
    )
