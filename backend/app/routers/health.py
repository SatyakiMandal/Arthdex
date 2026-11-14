"""Service health and cache introspection."""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .. import watchdog
from ..cache import CACHE
from ..schemas import envelope

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "arthdex-data",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/feeds")
def feed_health():
    """The watchdog's last report: per-feed results, open incidents and recently resolved ones."""
    state = watchdog.load_state()
    return envelope(
        {**state, "resolved": state.get("resolved", [])[-20:]},
        0,
        source="Arthdex feed watchdog",
        note="Each feed is probed on a timer; failures are retried, cached values expired and the NSE session re-primed before an incident is opened.",
    )


@router.get("/health/jobs")
def job_health():
    """Scheduled data jobs: when each last ran, whether it succeeded, and the store in use."""
    from .. import jobs, scheduler  # noqa: F401  (importing jobs registers them)
    from ..store import STORE

    return envelope(
        {"store": STORE.kind, "jobs": scheduler.status()},
        0,
        source="Arthdex scheduler",
        note="Daily jobs run once after their IST time on each day; a failed job is retried after 15 minutes.",
    )


FEED_RUN_COOLDOWN = 60.0  # seconds between on-demand probes of every upstream
_feed_run_lock = threading.Lock()
_feed_run_last: tuple[float, dict] | None = None


@router.post("/health/feeds/run")
def feed_health_run():
    """
    Probe every feed now, repairing what can be repaired. Takes up to a minute on a cold cache.

    A run hits about twenty upstreams, so repeated calls inside the cooldown get the last
    result back instead of starting another sweep (which is how an upstream bans this IP).
    """
    global _feed_run_last
    with _feed_run_lock:
        if _feed_run_last and time.monotonic() - _feed_run_last[0] < FEED_RUN_COOLDOWN:
            return _feed_run_last[1]
        state = watchdog.run_all(mode="on demand")
        _feed_run_last = (time.monotonic(), state)
        return state


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
        valid_prefixes = [p for p in body.prefixes if p and p.strip()]
        if any(key.startswith(p) for p in valid_prefixes) or (sym and sym in key.split(":")):
            CACHE.expire(key)
            expired += 1
    return {"expired": expired}
