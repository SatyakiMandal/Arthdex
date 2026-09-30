"""
Index constituent lists.

NSE publishes these as archive CSVs. They carry the industry classification
alongside the symbol, which is the only free source of sector labels for the
whole listed universe.
"""

from __future__ import annotations

import csv
import io
from typing import Any

from .nse import _get_session

INDEX_FILES: dict[str, tuple[str, str]] = {
    "nifty50": ("Nifty 50", "ind_nifty50list.csv"),
    "nifty100": ("Nifty 100", "ind_nifty100list.csv"),
    "nifty200": ("Nifty 200", "ind_nifty200list.csv"),
    "nifty500": ("Nifty 500", "ind_nifty500list.csv"),
}

BASE = "https://nsearchives.nseindia.com/content/indices"


def fetch_constituents(index: str = "nifty100") -> list[dict[str, Any]]:
    label, filename = INDEX_FILES.get(index, INDEX_FILES["nifty100"])
    session = _get_session()
    response = session.get(f"{BASE}/{filename}", timeout=30)
    response.raise_for_status()

    rows: list[dict[str, Any]] = []
    for raw in csv.DictReader(io.StringIO(response.text)):
        record = {(k or "").strip(): (v or "").strip() for k, v in raw.items()}
        symbol = record.get("Symbol", "")
        if not symbol:
            continue
        rows.append(
            {
                "symbol": symbol.upper(),
                "name": record.get("Company Name", symbol),
                "industry": record.get("Industry") or "Unclassified",
                "series": record.get("Series", "EQ"),
                "isin": record.get("ISIN Code") or None,
                "index": label,
            }
        )
    return rows
