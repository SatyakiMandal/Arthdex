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
