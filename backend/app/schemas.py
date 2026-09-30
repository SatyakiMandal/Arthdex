"""
Response envelope.

Every payload carries its provenance: which upstream supplied it, how delayed
that upstream is, and how long ago this service fetched it. The UI renders this
rather than presenting delayed data as live.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def envelope(
    data: Any,
    age_seconds: float,
    *,
    source: str,
    delayed_minutes: int = 0,
    illustrative: bool = False,
    note: str | None = None,
) -> dict[str, Any]:
    return {
        "data": data,
        "meta": {
            "source": source,
            # Upstream's own delay, separate from our cache age
            "delayedMinutes": delayed_minutes,
            "cacheAgeSeconds": round(age_seconds, 1),
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            # True only where no live feed exists for this data at all
            "illustrative": illustrative,
            "note": note,
        },
    }
