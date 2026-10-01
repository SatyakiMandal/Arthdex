"""Service health and cache introspection."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel, Field

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


class RefreshRequest(BaseModel):
    prefixes: list[str] = Field(default_factory=list, max_length=12)
    symbol: str | None = Field(default=None, max_length=24, pattern=r"^[A-Za-z0-9&.\-]+$")


MIN_REFRESH_AGE = 10.0  # seconds; a just-fetched entry is not thrown away, so the button cannot hammer upstreams


@router.post("/cache/refresh")
def refresh(body: RefreshRequest):
    """Expire cached entries for a page so its next read goes upstream. Analyzer runs are never touched."""
    sym = body.symbol.upper() if body.symbol else None
    expired = 0
    for key, age in CACHE.stats().items():
        if key.startswith("analyzer:") or age < MIN_REFRESH_AGE:
            continue
        if any(key.startswith(p) for p in body.prefixes) or (sym and sym in key.split(":")):
            CACHE.expire(key)
            expired += 1
    return {"expired": expired}
