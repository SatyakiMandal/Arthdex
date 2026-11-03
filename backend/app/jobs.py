"""
The data service's scheduled jobs. Importing this module registers them with the scheduler.

Each job fetches one dataset and records it in the point-in-time store, so the site can
show history the upstream does not keep (NSE publishes institutional flows for one day
at a time) and later work can be backtested against what was known when.
"""

from __future__ import annotations

from datetime import time

from .scheduler import Job, register
