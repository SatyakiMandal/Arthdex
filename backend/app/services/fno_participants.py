"""
Participant-wise open interest in equity derivatives, from NSE's daily file.

NSE publishes ``fao_participant_oi_DDMMYYYY.csv`` after each session: long and short
contracts held by clients, DIIs, FIIs and proprietary desks in index and stock futures and
options. This module downloads the latest file, parses it and adds only arithmetic on its
rows (net positions and long shares). There is no stored copy to fall back on: if the
file cannot be fetched the route says so.

``parse`` and ``summarise`` are pure and tested offline.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime, timedelta
from typing import Any, Callable

from ..cache import CACHE

ARCHIVE_URL = "https://nsearchives.nseindia.com/content/nsccl/fao_participant_oi_{stamp}.csv"
LOOKBACK_DAYS = 7  # covers a long weekend plus a holiday

LABELS = {
    "Client": "Clients (retail and other non-institutional)",
    "DII": "Domestic institutional investors",
    "FII": "Foreign institutional investors",
    "Pro": "Proprietary desks",
}

# our key -> (long column, short column) in NSE's header
COLUMNS = {
    "indexFutures": ("Future Index Long", "Future Index Short"),
    "stockFutures": ("Future Stock Long", "Future Stock Short"),
    "indexCalls": ("Option Index Call Long", "Option Index Call Short"),
    "indexPuts": ("Option Index Put Long", "Option Index Put Short"),
    "stockCalls": ("Option Stock Call Long", "Option Stock Call Short"),
    "stockPuts": ("Option Stock Put Long", "Option Stock Put Short"),
}


class ParticipantDataUnavailable(Exception):
    """NSE's participant file could not be fetched or read."""


def _leg(long: int, short: int) -> dict[str, Any]:
    total = long + short
    return {"long": long, "short": short, "net": long - short, "longPct": round(long / total * 100.0, 1) if total else None}


def _stance(index_futures: dict[str, Any]) -> tuple[str, str]:
    share = index_futures["longPct"]
    if share is None:
        return "No index futures position", "neutral"
    if share >= 55.0:
        return f"Net long index futures ({share}% of its contracts are long)", "up"
    if share <= 45.0:
        return f"Net short index futures ({share}% of its contracts are long)", "down"
    return f"Roughly balanced index futures ({share}% long)", "neutral"


def parse(text: str) -> dict[str, Any]:
    """Rows of NSE's file as participant records. Raises ValueError if the layout is not recognised."""
    lines = [line for line in text.splitlines() if line.strip()]
    header_at = next((i for i, line in enumerate(lines) if line.lower().startswith("client type")), None)
    if header_at is None:
        raise ValueError("participant file has no 'Client Type' header")
    title = " ".join(lines[:header_at])
    match = re.search(r"as on\s+([A-Za-z]{3}\s+\d{1,2},\s*\d{4})", title)
    as_of = datetime.strptime(match.group(1).replace(" ,", ","), "%b %d, %Y").date().isoformat() if match else None

    reader = csv.DictReader(io.StringIO("\n".join(lines[header_at:])))
    reader.fieldnames = [(name or "").strip() for name in (reader.fieldnames or [])]
    missing = [col for pair in COLUMNS.values() for col in pair if col not in reader.fieldnames]
    if missing:
        raise ValueError(f"participant file is missing columns: {missing}")

    def count(row: dict[str, str], column: str) -> int:
        return int(float((row.get(column) or "0").replace(",", "").strip() or 0))

    records = []
    for row in reader:
        name = (row.get("Client Type") or "").strip()
        if name not in LABELS:
            continue  # the TOTAL row and anything unexpected
        record: dict[str, Any] = {"participant": name, "label": LABELS[name]}
        for key, (long_col, short_col) in COLUMNS.items():
            record[key] = _leg(count(row, long_col), count(row, short_col))
        record["netIndexBias"], record["tone"] = _stance(record["indexFutures"])
        records.append(record)
    if {r["participant"] for r in records} != set(LABELS):
        raise ValueError("participant file does not list all four participant types")
    return {"asOf": as_of, "participants": records}


def summarise(parsed: dict[str, Any]) -> dict[str, Any]:
    """The file's rows plus net figures read straight off them. Descriptive only."""
    by_name = {r["participant"]: r for r in parsed["participants"]}
    fii, client, pro = by_name["FII"], by_name["Client"], by_name["Pro"]
    fii_net, client_net = fii["indexFutures"]["net"], client["indexFutures"]["net"]
    regime, tone = _stance(fii["indexFutures"])
    institutional_puts = fii["indexPuts"]["net"] + pro["indexPuts"]["net"]

    def side(net: int) -> str:
        return f"net {'long' if net >= 0 else 'short'} {abs(net):,} contracts"

    opposite = (fii_net >= 0) != (client_net >= 0)
    return {
        "asOf": parsed["asOf"],
        "fiiIndexLongPct": fii["indexFutures"]["longPct"],
        "fiiNetIndexContracts": fii_net,
        "clientNetIndexContracts": client_net,
        "marketRegime": f"FIIs: {regime[0].lower()}{regime[1:]}",
        "regimeTone": tone,
        "putWritingBias": (
            f"FIIs and proprietary desks together are net long {institutional_puts:,} index puts"
            if institutional_puts > 0
            else f"FIIs and proprietary desks together are net short {abs(institutional_puts):,} index puts"
        ),
        "participants": parsed["participants"],
        "divergenceSignal": {
            "title": "FIIs and clients in index futures",
            "description": (
                f"FIIs are {side(fii_net)} and clients are {side(client_net)}. "
                + ("They are positioned on opposite sides." if opposite else "They are positioned on the same side.")
            ),
            "divergenceMagnitude": abs(client_net - fii_net),
        },
        "source": "NSE participant-wise open interest (fao_participant_oi)",
    }


def fetch_latest(get_text: Callable[[str], str | None] | None = None, today: date | None = None) -> dict[str, Any]:
    """Walk back from today to the most recent session that has a file."""
    if get_text is None:
        from ..providers.nse import _get_session

        session = _get_session()

        def get_text(url: str) -> str | None:
            response = session.get(url, timeout=20)
            return response.text if response.status_code == 200 and "Client Type" in response.text else None

    day = today or date.today()
    errors: list[str] = []
    for back in range(LOOKBACK_DAYS + 1):
        candidate = day - timedelta(days=back)
        if candidate.weekday() >= 5:
            continue
        try:
            text = get_text(ARCHIVE_URL.format(stamp=candidate.strftime("%d%m%Y")))
            if text:
                return summarise(parse(text))
        except Exception as exc:  # a malformed or blocked day: try the one before
            errors.append(f"{candidate.isoformat()}: {exc}")
    raise ParticipantDataUnavailable(
        "NSE's participant open-interest file could not be read for the last "
        f"{LOOKBACK_DAYS} days" + (f" ({'; '.join(errors[:2])})" if errors else "")
    )


def get_participant_oi_overview() -> dict[str, Any]:
    return CACHE.get_or_fetch("derivatives:participant-oi:v2", 3600, fetch_latest)[0]
