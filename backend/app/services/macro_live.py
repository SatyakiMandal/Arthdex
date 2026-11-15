"""
Macro indicators from the publishing bodies themselves.

  * Consumer prices, industrial production and quarterly GDP: MOSPI's public API
    (api.mospi.gov.in), figures exactly as published.
  * Policy rates and reserve ratios: the "Current Rates" panel on rbi.org.in.

Each series carries the period it refers to, because releases lag by weeks or months and
MOSPI's API can trail the press release. A series that cannot be fetched is listed under
``unavailable`` and the rest of the dashboard still loads.

Not connected: wholesale prices (the API serves item-level rows with no usable headline
filter), GST collections and the trade balance.

The parsers are pure and tested offline.
"""

from __future__ import annotations

import html
import re
from typing import Any, Callable

MOSPI = "https://api.mospi.gov.in/api"
CPI_URL = f"{MOSPI}/cpi/getCPIIndex?base_year=2012&series=Current&state_code=99&sector_code=3&group_code=0&Format=JSON&limit=13"
IIP_URL = f"{MOSPI}/iip/getIIPMonthly?base_year=2011-12&type=General&Format=JSON&limit=13"
GDP_URL = f"{MOSPI}/nas/getNASData?series=Current&frequency_code=Quarterly&indicator_code=5&Format=JSON&limit=80"
RBI_URL = "https://www.rbi.org.in/"

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

NOT_CONNECTED = {
    "wpi": "Wholesale price inflation: MOSPI's API serves item-level rows without a usable headline filter.",
    "gst": "GST collections are published by GSTN as monthly releases, with no API.",
    "trade": "The merchandise trade balance comes from the commerce ministry's releases, with no API.",
}

RBI_RATES = [
    ("repo", "Policy Repo Rate"),
    ("sdf", "Standing Deposit Facility Rate"),
    ("msf", "Marginal Standing Facility Rate"),
    ("bankRate", "Bank Rate"),
    ("reverseRepo", "Fixed Reverse Repo Rate"),
    ("crr", "CRR"),
    ("slr", "SLR"),
]


def _num(value: Any) -> float | None:
    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _period(year: Any, month: str) -> str:
    return f"{month} {year}"


def _month_key(row: dict[str, Any]) -> tuple[int, int]:
    month = str(row.get("month") or "")
    return int(row.get("year") or 0), MONTHS.index(month) if month in MONTHS else -1


def parse_cpi(payload: dict[str, Any]) -> dict[str, Any]:
    rows = sorted(payload.get("data") or [], key=_month_key)
    series = [
        {"period": _period(r["year"], r["month"]), "index": _num(r.get("index")), "inflationPct": _num(r.get("inflation"))}
        for r in rows
        if _num(r.get("inflation")) is not None
    ]
    if not series:
        raise ValueError("MOSPI returned no CPI rows")
    latest = series[-1]
    return {
        "label": "Consumer price inflation (CPI, combined, all India)",
        "period": latest["period"],
        "value": latest["inflationPct"],
        "unit": "% year on year",
        "previous": series[-2]["inflationPct"] if len(series) > 1 else None,
        "detail": f"Index {latest['index']} (base 2012 = 100)",
        "series": series,
        "source": "MOSPI",
    }


def parse_iip(payload: dict[str, Any]) -> dict[str, Any]:
    rows = sorted(payload.get("data") or [], key=_month_key)
    series = [
        {"period": _period(r["year"], r["month"]), "index": _num(r.get("index")), "growthPct": _num(r.get("growth_rate"))}
        for r in rows
        if _num(r.get("growth_rate")) is not None
    ]
    if not series:
        raise ValueError("MOSPI returned no IIP rows")
    latest = series[-1]
    return {
        "label": "Industrial production (IIP, general index)",
        "period": latest["period"],
        "value": latest["growthPct"],
        "unit": "% year on year",
        "previous": series[-2]["growthPct"] if len(series) > 1 else None,
        "detail": f"Index {latest['index']} (base 2011-12 = 100)",
        "series": series,
        "source": "MOSPI",
    }


def _previous_year(fiscal: str) -> str:
    """'2026-27' -> '2025-26'."""
    start = int(fiscal[:4]) - 1
    return f"{start}-{str(start + 1)[-2:]}"


def parse_gdp(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Real GDP growth for each quarter against the same quarter a year earlier.

    MOSPI serves more than one base year in the same response. Constant-price levels on
    different bases are not comparable, so growth is computed only between two quarters on
    the same base, using the newest base that has such a pair.
    """
    by_base: dict[str, dict[tuple[str, str], dict[str, Any]]] = {}
    for r in payload.get("data") or []:
        base, year, quarter = str(r.get("base_year") or ""), str(r.get("year") or ""), str(r.get("quarter") or "")
        if base and re.fullmatch(r"\d{4}-\d{2}", year) and quarter in ("Q1", "Q2", "Q3", "Q4"):
            by_base.setdefault(base, {})[(year, quarter)] = r

    for base in sorted(by_base, reverse=True):
        rows = by_base[base]
        series = []
        for (year, quarter), row in sorted(rows.items()):
            now = _num(row.get("constant_price"))
            then = _num((rows.get((_previous_year(year), quarter)) or {}).get("constant_price"))
            if now is None or not then:
                continue
            series.append({
                "period": f"{quarter} {year}",
                "realGdpCr": now,
                "nominalGdpCr": _num(row.get("current_price")),
                "growthPct": round((now / then - 1.0) * 100.0, 2),
            })
        if series:
            latest = series[-1]
            return {
                "label": "Real GDP growth (quarterly, constant prices)",
                "period": latest["period"],
                "value": latest["growthPct"],
                "unit": "% year on year",
                "previous": series[-2]["growthPct"] if len(series) > 1 else None,
                "detail": f"Real GDP ₹{latest['realGdpCr'] / 1e5:,.2f} lakh crore (base {base}); growth computed from MOSPI's constant-price levels",
                "series": series[-8:],
                "source": "MOSPI",
            }
    raise ValueError("MOSPI returned no GDP quarter with a year-ago comparison on the same base")


def parse_rbi_rates(page: str) -> dict[str, Any]:
    """The rates RBI shows on its homepage, as percentages."""
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", page)))
    rates: dict[str, float] = {}
    for key, label in RBI_RATES:
        match = re.search(re.escape(label) + r"\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*%", text)
        if match:
            rates[key] = float(match.group(1))
    if "repo" not in rates:
        raise ValueError("RBI page did not show the policy repo rate")
    return rates


def build(get_json: Callable[[str], dict[str, Any]], get_text: Callable[[str], str]) -> dict[str, Any]:
    indicators: list[dict[str, Any]] = []
    unavailable = dict(NOT_CONNECTED)
    for key, url, parser, name in (
        ("gdp", GDP_URL, parse_gdp, "GDP growth"),
        ("cpi", CPI_URL, parse_cpi, "CPI inflation"),
        ("iip", IIP_URL, parse_iip, "Industrial production"),
    ):
        try:
            indicators.append({"id": key, **parser(get_json(url))})
        except Exception as exc:
            unavailable[key] = f"{name} could not be read from MOSPI just now ({type(exc).__name__})."
    policy = None
    try:
        policy = parse_rbi_rates(get_text(RBI_URL))
    except Exception as exc:
        unavailable["policyRates"] = f"RBI's rates panel could not be read just now ({type(exc).__name__})."
    if not indicators and policy is None:
        raise ValueError("neither MOSPI nor RBI answered")
    return {"indicators": indicators, "policyRates": policy, "unavailable": unavailable}


def fetch() -> dict[str, Any]:
    import requests

    headers = {"User-Agent": "Mozilla/5.0"}

    def get_json(url: str) -> dict[str, Any]:
        response = requests.get(url, timeout=30, headers=headers)
        response.raise_for_status()
        return response.json()

    def get_text(url: str) -> str:
        response = requests.get(url, timeout=30, headers=headers)
        response.raise_for_status()
        return response.text

    return build(get_json, get_text)
