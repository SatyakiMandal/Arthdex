"""
Foreign portfolio investment as reported to NSDL by custodians.

A different measure from NSE's provisional FII figure: it covers FPIs only, includes
primary-market investment, and is reported a trading day later (the report dated D
covers trades up to the previous trading day). Shown beside NSE's figure, labelled,
never in place of it.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import requests

URL = "https://www.fpi.nsdl.co.in/web/Reports/Latest.aspx"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"}


def _num(text: str) -> float | None:
    t = text.replace(",", "").strip()
    neg = t.startswith("(") and t.endswith(")")
    try:
        v = float(t.strip("()"))
    except ValueError:
        return None
    return -v if neg else v


def parse_latest(html: str) -> dict[str, Any]:
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
    date_m = re.search(r"Daily Trends in FPI Investments on (\d{2}-[A-Za-z]{3}-\d{4})", text)
    if not date_m:
        raise ValueError("NSDL page has no daily trends table")
    reported = datetime.strptime(date_m.group(1), "%d-%b-%Y").date().isoformat()
    num = r"(\(?[\d,]+\.\d+\)?)"
    # The conversion rate sits in the middle of the first row ("... 344.79 Rs.94.8755 Primary ...")
    eq = re.search(
        r"Equity Stock Exchange " + " ".join([num] * 4) + r" (?:Rs\.\s*([\d.]+) )?Primary market & others "
        + " ".join([num] * 4) + r" Sub-total " + " ".join([num] * 4),
        text,
    )
    if not eq:
        raise ValueError("NSDL equity rows not found")
    parts = list(eq.groups())
    rate = parts.pop(4)
    g = [_num(x) for x in parts]
    return {
        "reportedOn": reported,
        "equity": {
            "stockExchange": {"buy": g[0], "sell": g[1], "net": g[2], "netUsdMn": g[3]},
            "primaryAndOthers": {"buy": g[4], "sell": g[5], "net": g[6], "netUsdMn": g[7]},
            "total": {"buy": g[8], "sell": g[9], "net": g[10], "netUsdMn": g[11]},
        },
        "usdInr": float(rate) if rate else None,
    }


def fetch_latest() -> dict[str, Any]:
    res = requests.get(URL, headers=UA, timeout=30)
    res.raise_for_status()
    return parse_latest(res.text)
