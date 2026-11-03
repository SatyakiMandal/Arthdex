"""
The data service's scheduled jobs. Importing this module registers them with the scheduler.

Each job fetches one dataset and records it in the point-in-time store, so the site can
show history the upstream does not keep (NSE publishes institutional flows for one day
at a time) and later work can be backtested against what was known when.
"""

from __future__ import annotations

from datetime import time

from .scheduler import Job, register


def _record_flows() -> None:
    from .services import flows

    flows.record()


# NSE posts provisional figures in the evening; NSDL's report for the day appears next
# morning, and the evening run picks it up too. Both are idempotent per date.
register(Job("institutional-flows", _record_flows, daily_after_ist=time(19, 30), weekdays_only=True))
register(Job("institutional-flows-morning", _record_flows, daily_after_ist=time(10, 30), weekdays_only=True))


def _snapshot_fundamentals() -> None:
    from .cache import CACHE
    from .providers import constituents
    from .routers.screener import _fundamental_inputs
    from .services import fundamental_screen

    members, _ = CACHE.get_or_fetch("constituents:nifty500", 86_400, lambda: constituents.fetch_constituents("nifty500"))
    sectors = {m["symbol"]: m["industry"] for m in members}
    from .services import results_season

    fundamental_screen.refresh(list(sectors), _fundamental_inputs, sectors, limit=30, reported_on=results_season.reported_dates())


# A trickle rather than a nightly burst: 30 of the stalest companies an hour covers the
# Nifty 500 in under a day, then keeps every snapshot less than a week old
register(Job("fundamental-snapshots", _snapshot_fundamentals, every_minutes=60))
