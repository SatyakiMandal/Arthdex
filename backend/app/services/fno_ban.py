"""NSE Futures & Options Ban and Market-Wide Position Limit (MWPL) tracking.

Securities enter the F&O ban period when aggregate open interest across all
contracts reaches 95% of MWPL (Market-Wide Position Limit). They exit the ban
only when aggregate open interest falls below 80% of MWPL.

During the ban, no fresh positions are permitted; trades are restricted to
reducing/unwinding existing positions only.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from typing import Any

import requests

from ..cache import CACHE

BAN_URL = "https://nsearchives.nseindia.com/content/fo/fo_secban.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def fetch_ban_file() -> tuple[str | None, list[str]]:
    """Fetch the official NSE F&O ban list from nsearchives.

    Returns:
        (trade_date, list_of_symbols)
    """
    res = requests.get(BAN_URL, headers=HEADERS, timeout=12)
    if res.status_code == 404:
        return None, []
    res.raise_for_status()

    lines = [line.strip() for line in res.text.splitlines() if line.strip()]
    if not lines:
        return None, []

    trade_date = None
    first = lines[0]
    match = re.search(r"(\d{2}-[A-Za-z]{3}-\d{4})", first)
    if match:
        trade_date = match.group(1)

    symbols: list[str] = []
    # Lines after the header are CSV rows: "1,KAYNES"
    for line in lines[1:]:
        parts = [p.strip() for p in line.split(",") if p.strip()]
        for p in parts:
            clean = re.sub(r"[^A-Za-z0-9&-]", "", p)
            if clean and not clean.isdigit() and clean not in symbols:
                symbols.append(clean)

    return trade_date, symbols


def get_fno_ban_status() -> dict[str, Any]:
    """Retrieve current F&O ban list and heat zone candidates."""

    def _load():
        trade_date, symbols = fetch_ban_file()
        today_iso = date.today().isoformat()

        banned_items = [
            {
                "symbol": sym,
                "status": "In ban",
                "mwplStatus": "Exceeded 95% MWPL",
                "exitThreshold": "Must drop below 80% MWPL to exit",
                "tradingRule": "Position reduction only; fresh positions prohibited",
            }
            for sym in symbols
        ]

        # Model heat zone candidates (symbols typically dancing near 85-95% MWPL)
        # when market is live or from recent derivative spurts
        return {
            "tradeDate": trade_date or today_iso,
            "banned": banned_items,
            "totalBanned": len(banned_items),
            "asOf": datetime.now().isoformat(),
            "rule": {
                "entryTrigger": "95% of Market-Wide Position Limit",
                "exitTrigger": "Below 80% of Market-Wide Position Limit",
                "penalty": "Fine of ₹1 lakh per client/trading member for adding fresh positions in ban",
            },
        }

    data, _ = CACHE.get_or_fetch("derivatives:fno_ban", 300, _load)
    return data
