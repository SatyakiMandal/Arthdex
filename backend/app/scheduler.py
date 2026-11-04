"""
Background jobs on a schedule, inside the data service.

A job is a function plus when it should run: every N minutes, or once a day after a
time in IST (market data is published on Indian time). Each run is recorded in the
store's `job_runs` table, so a restart neither repeats a daily job nor forgets one that
was missed: a daily job that has not run today runs at the next check after its time.

ARTHDEX_SCHEDULER=off disables the loop (tests and CI). Jobs never raise into the loop;
a failure is recorded with its error and retried at the next due time.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass
from datetime import datetime, time as dtime, timedelta, timezone
from typing import Callable

from .store import STORE, Store

LOG = logging.getLogger("uvicorn.error")
IST = timezone(timedelta(hours=5, minutes=30))
TICK_SECONDS = 60


@dataclass
class Job:
    name: str
    run: Callable[[], object]
    every_minutes: float | None = None
    daily_after_ist: dtime | None = None
    weekdays_only: bool = False


JOBS: list[Job] = []


def register(job: Job) -> Job:
    JOBS.append(job)
    return job


def _last_finished(store: Store, name: str) -> datetime | None:
    rows = store.query("SELECT last_finished FROM job_runs WHERE job = ?", (name,))
    if not rows or not rows[0][0]:
        return None
    return datetime.fromisoformat(rows[0][0])


RETRY_AFTER = timedelta(minutes=15)


def _backing_off(store: Store, name: str, now: datetime) -> bool:
    """A job that just failed waits before retrying, so a down upstream is not hammered."""
    rows = store.query("SELECT last_started, last_ok FROM job_runs WHERE job = ?", (name,))
    if not rows or rows[0][1] != 0 or not rows[0][0]:
        return False
    return now - datetime.fromisoformat(rows[0][0]) < RETRY_AFTER


def due(job: Job, now: datetime, last: datetime | None) -> bool:
    """Whether a job should run at `now` (an aware datetime), given when it last finished."""
    local = now.astimezone(IST)
    if job.weekdays_only and local.weekday() >= 5:
        return False
    if job.every_minutes is not None:
        return last is None or now - last >= timedelta(minutes=job.every_minutes)
    if job.daily_after_ist is not None:
        if local.time() < job.daily_after_ist:
            return False
        return last is None or last.astimezone(IST).date() < local.date()
    return False


def run_job(job: Job, store: Store = STORE) -> bool:
    started = datetime.now(timezone.utc).isoformat()
    store.execute(
        """INSERT INTO job_runs (job, last_started, runs) VALUES (?, ?, 0)
           ON CONFLICT (job) DO UPDATE SET last_started = excluded.last_started""",
        (job.name, started),
    )
    ok, error = True, None
    try:
        job.run()
    except Exception as exc:  # recorded, retried at the next due time
        ok, error = False, f"{type(exc).__name__}: {str(exc)[:300]}"
        LOG.warning("Scheduler: %s failed: %s", job.name, error)
    finished = datetime.now(timezone.utc).isoformat() if ok else None
    store.execute(
        "UPDATE job_runs SET last_finished = COALESCE(?, last_finished), last_ok = ?, last_error = ?, runs = runs + 1 WHERE job = ?",
        (finished, 1 if ok else 0, error, job.name),
    )
    return ok


def tick(store: Store = STORE, now: datetime | None = None) -> list[str]:
    """Run every job that is due. Returns the names run."""
    now = now or datetime.now(timezone.utc)
    ran = []
    for job in list(JOBS):
        if _backing_off(store, job.name, now):
            continue
        if due(job, now, _last_finished(store, job.name)):
            run_job(job, store)
            ran.append(job.name)
    return ran


def status(store: Store = STORE) -> list[dict]:
    rows = {r[0]: r for r in store.query("SELECT job, last_started, last_finished, last_ok, last_error, runs FROM job_runs")}
    out = []
    for job in JOBS:
        r = rows.get(job.name)
        out.append({
            "job": job.name,
            "schedule": f"every {job.every_minutes:g} min" if job.every_minutes else f"daily after {job.daily_after_ist:%H:%M} IST" + (" on weekdays" if job.weekdays_only else ""),
            "lastStarted": r[1] if r else None,
            "lastFinished": r[2] if r else None,
            "lastOk": bool(r[3]) if r and r[3] is not None else None,
            "lastError": r[4] if r else None,
            "runs": r[5] if r else 0,
        })
    return out


def start_background() -> None:
    if os.environ.get("ARTHDEX_SCHEDULER", "on").lower() in ("0", "false", "off"):
        return

    def loop() -> None:
        time.sleep(60)  # let start-up warm-ups finish first
        while True:
            try:
                tick()
            except Exception:
                LOG.exception("Scheduler tick failed")
            time.sleep(TICK_SECONDS)

    threading.Thread(target=loop, name="scheduler", daemon=True).start()
