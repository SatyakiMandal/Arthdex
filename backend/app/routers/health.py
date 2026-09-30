"""Service health and cache introspection."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..cache import CACHE

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "arthdex-data",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/cache")
def cache_stats():
    """Cached keys with their age in seconds — useful when diagnosing staleness."""
    entries = CACHE.stats()
    return {"entries": len(entries), "ageSeconds": entries}
