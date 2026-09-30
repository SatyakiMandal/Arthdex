"""
The listed-equity universe.

NSE publishes its full equity master list as a CSV archive file — roughly 2,600
companies with symbol, name, series and ISIN. That is the authoritative list of
what is actually tradable, and it backs both the search bar and the symbol
matching in the news feed.
"""

from __future__ import annotations

import csv
import io
from typing import Any

from .nse import _get_session

EQUITY_MASTER_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"

# Tokens that are real NSE symbols but also ordinary English words. Without this
# every headline containing "all" or "india" would be tagged with a ticker.
AMBIGUOUS_SYMBOLS = {
    "ALL", "AND", "ANY", "ARE", "BEST", "BIG", "CARE", "CITY", "DAY", "FACT",
    "FINE", "FIRST", "FOR", "GOLD", "GREEN", "HIGH", "IDEA", "INDIA", "IT",
    "JOB", "KEY", "LIVE", "LOG", "MAN", "MAX", "NET", "NEW", "NEXT", "NOW",
    "ONE", "ORIENT", "POWER", "PRO", "RIGHT", "SAFE", "SMART", "STAR", "SUN",
    "TEAM", "THE", "TIME", "TOP", "UNION", "VALUE", "WIN", "ZONE",
}


def _clean_key(key: str) -> str:
    return (key or "").strip().upper()


def fetch_equity_universe() -> list[dict[str, Any]]:
    """Every equity listed on NSE, from the exchange's own master file."""
    session = _get_session()
    response = session.get(EQUITY_MASTER_URL, timeout=30)
    response.raise_for_status()

    rows: list[dict[str, Any]] = []
    reader = csv.DictReader(io.StringIO(response.text))

    for raw in reader:
        # Column headers in this file carry leading spaces (" SERIES")
        record = {_clean_key(k): (v or "").strip() for k, v in raw.items() if k}
        symbol = record.get("SYMBOL", "")
        if not symbol:
            continue
        rows.append(
            {
                "symbol": symbol.upper(),
                "name": record.get("NAME OF COMPANY", symbol),
                "series": record.get("SERIES", ""),
                "listingDate": record.get("DATE OF LISTING") or None,
                "isin": record.get("ISIN NUMBER") or None,
                "faceValue": record.get("FACE VALUE") or None,
            }
        )
    return rows


def searchable_symbols(universe: list[dict[str, Any]]) -> set[str]:
    """Symbols safe to match inside free text, minus the ambiguous ones."""
    return {r["symbol"] for r in universe if len(r["symbol"]) >= 3} - AMBIGUOUS_SYMBOLS


def search(universe: list[dict[str, Any]], query: str, limit: int = 12) -> list[dict[str, Any]]:
    """
    Rank matches for the search bar.

    Exact symbol first, then symbol prefix, then name prefix, then any substring
    — so typing "TCS" surfaces TCS itself rather than a company whose name
    happens to contain those letters.
    """
    q = (query or "").strip().upper()
    if not q:
        return []

    scored: list[tuple[int, dict[str, Any]]] = []
    for row in universe:
        symbol = row["symbol"]
        name = (row["name"] or "").upper()

        if symbol == q:
            rank = 0
        elif symbol.startswith(q):
            rank = 1
        elif name.startswith(q):
            rank = 2
        elif q in symbol:
            rank = 3
        elif q in name:
            rank = 4
        else:
            continue

        scored.append((rank, row))
        if len(scored) > 400:
            break

    scored.sort(key=lambda pair: (pair[0], len(pair[1]["symbol"])))
    return [
        {
            "id": row["symbol"],
            "symbol": row["symbol"],
            "name": row["name"],
            "series": row["series"],
            "isin": row["isin"],
            "kind": "listed",
            "href": f"/company/{row['symbol']}",
        }
        for _rank, row in scored[:limit]
    ]
