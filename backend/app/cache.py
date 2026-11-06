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
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypeVar

T = TypeVar("T")


@dataclass
class Entry:
    value: Any
    stored_at: float


class TTLCache:
    def __init__(self, max_entries: int = 4096) -> None:
        self._data: dict[str, Entry] = {}
        self._lock = threading.Lock()
        self._key_locks: dict[str, threading.Lock] = {}
        self._max_entries = max_entries

    def get_entry(self, key: str) -> Entry | None:
        with self._lock:
            return self._data.get(key)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = Entry(value=value, stored_at=time.time())
            if len(self._data) > self._max_entries:
                excess = len(self._data) - self._max_entries
                oldest_keys = sorted(self._data, key=lambda k: self._data[k].stored_at)[:excess]
                for k in oldest_keys:
                    self._data.pop(k, None)
                    self._key_locks.pop(k, None)

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

        with self._lock:
            key_lock = self._key_locks.setdefault(key, threading.Lock())

        with key_lock:
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
        if not key:
            return
        with self._lock:
            if key in self._data:
                self._data[key].stored_at = 0.0
            else:
                for k, entry in self._data.items():
                    if k.startswith(key):
                        entry.stored_at = 0.0

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
            self._key_locks.clear()

    def stats(self) -> dict[str, float]:
        with self._lock:
            now = time.time()
            return {k: round(now - e.stored_at, 1) for k, e in self._data.items()}


CACHE = TTLCache()
