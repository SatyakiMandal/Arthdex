"""
Small in-process TTL cache.

Every upstream call is free, unofficial and rate-limited, so nothing is fetched
twice inside its TTL. Stale entries are kept after expiry: if a refresh fails we
would rather serve the last good value with an honest age than fail the request,
and the API reports that age so the UI can say how old a figure is.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, TypeVar

T = TypeVar("T")


@dataclass
class Entry:
    value: Any
    stored_at: float


class TTLCache:
    def __init__(self) -> None:
        self._data: dict[str, Entry] = {}
        self._lock = threading.Lock()

    def get_entry(self, key: str) -> Entry | None:
        with self._lock:
            return self._data.get(key)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = Entry(value=value, stored_at=time.time())

    def age(self, key: str) -> float | None:
        entry = self.get_entry(key)
        return None if entry is None else time.time() - entry.stored_at

    def get_or_fetch(self, key: str, ttl: int, fetch: Callable[[], T]) -> tuple[T, float]:
        """
        Return (value, age_seconds).

        On a fetch failure with a stale entry present, the stale value is served
        rather than raising — the caller surfaces the age.
        """
        entry = self.get_entry(key)
        now = time.time()

        if entry is not None and (now - entry.stored_at) < ttl:
            return entry.value, now - entry.stored_at

        try:
            value = fetch()
        except Exception:
            if entry is not None:
                return entry.value, now - entry.stored_at
            raise

        self.set(key, value)
        return value, 0.0

    def expire(self, key: str) -> None:
        """Mark an entry stale so the next read refetches, keeping the value as a fallback."""
        with self._lock:
            if key in self._data:
                self._data[key].stored_at = 0.0

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def stats(self) -> dict[str, float]:
        with self._lock:
            now = time.time()
            return {k: round(now - e.stored_at, 1) for k, e in self._data.items()}


CACHE = TTLCache()
