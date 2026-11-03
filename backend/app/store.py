"""
Durable storage for the data service: point-in-time series and scheduler state.

Postgres (Supabase) when `DATABASE_URL` is set and psycopg is installed; otherwise a
SQLite file at backend/app_data/arthdex.db, so local development and tests need no
database server. Both speak the same small SQL: `ON CONFLICT ... DO UPDATE` upserts and
JSON stored as text.

The core table is `series`: one row per (name, as_of, key), each a JSON payload with the
time it was fetched. A figure written here is the figure as it was known on that date,
which is what honest backtests, track records and flow histories need. Rows are never
rewritten for a past date unless the source itself restates it.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SQLITE_PATH = Path(__file__).resolve().parent.parent / "app_data" / "arthdex.db"

_SCHEMA = (
    """CREATE TABLE IF NOT EXISTS series (
        name TEXT NOT NULL,
        as_of DATE NOT NULL,
        key TEXT NOT NULL DEFAULT '',
        payload TEXT NOT NULL,
        source TEXT,
        fetched_at TEXT NOT NULL,
        PRIMARY KEY (name, as_of, key)
    )""",
    "CREATE INDEX IF NOT EXISTS series_name_as_of ON series (name, as_of)",
    """CREATE TABLE IF NOT EXISTS job_runs (
        job TEXT PRIMARY KEY,
        last_started TEXT,
        last_finished TEXT,
        last_ok INTEGER,
        last_error TEXT,
        runs INTEGER NOT NULL DEFAULT 0
    )""",
)


class Store:
    """A thin wrapper so callers never see which database is underneath."""

    def __init__(self, url: str | None = None, sqlite_path: Path | None = None):
        self.url = url if url is not None else os.environ.get("DATABASE_URL")
        self.sqlite_path = sqlite_path or SQLITE_PATH
        self._lock = threading.Lock()
        self.kind = "postgres" if self.url and self.url.startswith(("postgres://", "postgresql://")) else "sqlite"
        self._ready = False

    # -- connection ----------------------------------------------------------------

    @contextmanager
    def _conn(self) -> Iterator[Any]:
        if self.kind == "postgres":
            import psycopg  # optional dependency; see requirements.txt

            with psycopg.connect(self.url, autocommit=True) as conn:
                yield conn
        else:
            self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(self.sqlite_path, timeout=30)
            try:
                yield conn
                conn.commit()
            finally:
                conn.close()

    def _sql(self, sql: str) -> str:
        # Callers write `?` placeholders; psycopg wants `%s`
        return sql.replace("?", "%s") if self.kind == "postgres" else sql

    def execute(self, sql: str, params: tuple = ()) -> None:
        self.ensure_schema()
        with self._lock, self._conn() as conn:
            conn.execute(self._sql(sql), params)

    def query(self, sql: str, params: tuple = ()) -> list[tuple]:
        self.ensure_schema()
        with self._lock, self._conn() as conn:
            cur = conn.execute(self._sql(sql), params)
            return list(cur.fetchall())

    def ensure_schema(self) -> None:
        if self._ready:
            return
        with self._lock, self._conn() as conn:
            for statement in _SCHEMA:
                conn.execute(statement)
        self._ready = True

    # -- series --------------------------------------------------------------------

    def put(self, name: str, as_of: date | str, payload: Any, key: str = "", source: str | None = None) -> None:
        """Record a value as known on `as_of`. Writing the same (name, as_of, key) again replaces it."""
        self.execute(
            """INSERT INTO series (name, as_of, key, payload, source, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT (name, as_of, key) DO UPDATE SET payload = excluded.payload, source = excluded.source,
               fetched_at = excluded.fetched_at""",
            (name, str(as_of)[:10], key, json.dumps(payload, default=str), source, datetime.now(timezone.utc).isoformat()),
        )

    def history(self, name: str, key: str = "", since: date | str | None = None, limit: int = 2000) -> list[dict[str, Any]]:
        """Rows for a series, oldest first."""
        rows = self.query(
            "SELECT as_of, payload, source, fetched_at FROM series WHERE name = ? AND key = ? AND as_of >= ? ORDER BY as_of LIMIT ?",
            (name, key, str(since or "0001-01-01")[:10], limit),
        )
        return [{"asOf": str(r[0])[:10], "value": json.loads(r[1]), "source": r[2], "fetchedAt": r[3]} for r in rows]

    def latest(self, name: str, key: str = "") -> dict[str, Any] | None:
        rows = self.query(
            "SELECT as_of, payload, source, fetched_at FROM series WHERE name = ? AND key = ? ORDER BY as_of DESC LIMIT 1",
            (name, key),
        )
        if not rows:
            return None
        r = rows[0]
        return {"asOf": str(r[0])[:10], "value": json.loads(r[1]), "source": r[2], "fetchedAt": r[3]}


STORE = Store()
