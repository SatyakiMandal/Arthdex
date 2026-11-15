"""
Government securities yields by tenor, from CCIL's daily "Tenorwise Indicative Yields" table.

CCIL lists one traded benchmark per tenor bucket: three treasury bills, central government
bonds from about two to thirty years, and a few state bonds. This module reads that table,
places each sovereign security on the curve by the tenor CCIL gives it, and computes spreads
between the points that exist. It draws no fitted curve and fills no missing tenor.

``parse`` and ``build`` are pure and tested offline.
"""

from __future__ import annotations

import html
import re
from typing import Any

SOURCE_URL = "https://www.ccilindia.com/web/ccil/tenorwise-indicative-yields"

# CCIL's bucket label -> (short label, years to place it on the axis)
TENOR_YEARS: dict[str, tuple[str, float]] = {
    "91D": ("3M", 0.25),
    "182D": ("6M", 0.5),
    "364D": ("1Y", 1.0),
    "1Y-2Y": ("2Y", 2.0),
    "2Y-3Y": ("3Y", 3.0),
    "3Y-4Y": ("4Y", 4.0),
    "4Y-5Y": ("5Y", 5.0),
    "5Y-6Y": ("6Y", 6.0),
    "6Y-7Y": ("7Y", 7.0),
    "7Y-8Y": ("8Y", 8.0),
    "8Y-9Y": ("9Y", 9.0),
    "9Y-10Y": ("10Y", 10.0),
    "10Y-13Y": ("12Y", 12.0),
    "13Y-15Y": ("15Y", 15.0),
    "15Y-20Y": ("20Y", 20.0),
    "20Y-28Y": ("25Y", 25.0),
    "28Y-30Y": ("30Y", 30.0),
    "30Y-40Y": ("40Y", 40.0),
}
SPREADS = [("10Y", "2Y"), ("10Y", "3M"), ("30Y", "10Y"), ("10Y", "5Y")]


def _cells(row: str) -> list[str]:
    return [
        re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", cell))).strip()
        for cell in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, flags=re.S)
    ]


def parse(page: str) -> list[dict[str, Any]]:
    """Rows of the yields table: date, tenor bucket, security, yield. Raises ValueError if it is not found."""
    at = page.find("YTM (%)")
    start = page.rfind("<table", 0, at) if at != -1 else -1
    end = page.find("</table>", at) if at != -1 else -1
    if start == -1 or end == -1:
        raise ValueError("CCIL page has no yields table")
    rows = []
    for raw in re.findall(r"<tr[^>]*>(.*?)</tr>", page[start:end], flags=re.S):
        cells = _cells(raw)
        if len(cells) < 4 or not re.match(r"\d{4}-\d{2}-\d{2}", cells[0]):
            continue
        try:
            value = float(cells[3])
        except ValueError:
            continue
        rows.append({"date": cells[0][:10], "bucket": cells[1], "security": cells[2], "yieldPct": value})
    if not rows:
        raise ValueError("CCIL yields table has no rows")
    return rows


def build(rows: list[dict[str, Any]], policy_rates: dict[str, float] | None = None) -> dict[str, Any]:
    sovereign, state = [], []
    for row in rows:
        security = row["security"]
        is_state = "SGS" in security.upper() or "SDL" in security.upper()
        if is_state:
            state.append({"tenor": row["bucket"], "security": security, "yieldPct": round(row["yieldPct"], 4)})
            continue
        label, years = TENOR_YEARS.get(row["bucket"], (row["bucket"], None))
        if years is None:
            continue  # a bucket this module does not know how to place
        sovereign.append({
            "tenor": label,
            "bucket": row["bucket"],
            "years": years,
            "security": security,
            "kind": "Treasury bill" if "DTB" in security.upper() else "Government bond",
            "yieldPct": round(row["yieldPct"], 4),
        })
    sovereign.sort(key=lambda p: p["years"])
    if not sovereign:
        raise ValueError("CCIL table lists no central government security")

    by_tenor = {p["tenor"]: p["yieldPct"] for p in sovereign}
    spreads = [
        {"label": f"{long} minus {short}", "bps": round((by_tenor[long] - by_tenor[short]) * 100.0, 1)}
        for long, short in SPREADS
        if long in by_tenor and short in by_tenor
    ]
    repo = (policy_rates or {}).get("repo")
    if repo is not None and "10Y" in by_tenor:
        spreads.append({"label": "10Y minus policy repo rate", "bps": round((by_tenor["10Y"] - repo) * 100.0, 1)})
    return {
        "asOf": max(r["date"] for r in rows),
        "curve": sovereign,
        "stateBonds": state,
        "spreads": spreads,
        "policyRates": policy_rates,
        "shape": (
            "Upward sloping: longer bonds yield more than shorter ones"
            if sovereign[-1]["yieldPct"] > sovereign[0]["yieldPct"]
            else "Flat or inverted: the longest tenor does not yield more than the shortest"
        ),
        "method": "Each point is the indicative yield of the one benchmark security CCIL lists for that tenor bucket. No curve is fitted between points.",
    }


def fetch() -> dict[str, Any]:
    import requests

    from . import macro_live

    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(SOURCE_URL, timeout=30, headers=headers)
    response.raise_for_status()
    rows = parse(response.text)
    try:
        rbi = requests.get(macro_live.RBI_URL, timeout=30, headers=headers)
        rbi.raise_for_status()
        policy = macro_live.parse_rbi_rates(rbi.text)
    except Exception:
        policy = None  # the curve stands without the policy-rate comparison
    return build(rows, policy)
