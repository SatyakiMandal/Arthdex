"""
Primary-market pipeline.

Issue facts — dates, price bands, subscription multiples, listing dates — are
real, from NSE's own IPO desk. Listing-day performance is reconstructed from
actual post-listing price history.

Grey-market premium is NOT here. It is an unofficial quote from a thin market
that no exchange publishes and no API exposes; the front end presents it as
illustrative rather than pretending it was captured.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

import pandas as pd
import yfinance as yf

from ..providers import nse
from ..providers.yahoo import to_yahoo_symbol

SME_SERIES = {"SME", "ST"}

_PRICE_RE = re.compile(r"(\d+(?:\.\d+)?)")


def parse_price_band(text: str | None) -> tuple[float | None, float | None]:
    """
    Pull a band out of NSE's free-text price field.

    Values arrive as "Rs.208 to Rs.220", sometimes "Rs.220" for a fixed price,
    and sometimes just "-" when the band is not yet filed.
    """
    if not text or text.strip() in {"-", ""}:
        return None, None
    numbers = [float(n) for n in _PRICE_RE.findall(text)]
    if not numbers:
        return None, None
    if len(numbers) == 1:
        return numbers[0], numbers[0]
    return min(numbers), max(numbers)


def _parse_date(text: str | None) -> date | None:
    if not text or text.strip() in {"-", ""}:
        return None
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _segment(series: str | None) -> str:
    return "sme" if (series or "").upper() in SME_SERIES else "mainboard"


def _iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _base(row: dict[str, Any], status: str) -> dict[str, Any]:
    low, high = parse_price_band(row.get("issuePriceRange"))
    start = _parse_date(row.get("issueStartDate"))
    end = _parse_date(row.get("issueEndDate"))
    listing = _parse_date(row.get("listingDate"))

    return {
        "id": (row.get("symbol") or row.get("companyName") or "").lower().replace(" ", "-"),
        "symbol": row.get("symbol"),
        "name": row.get("companyName"),
        "segment": _segment(row.get("series")),
        "status": status,
        "priceBandLow": low,
        "priceBandHigh": high,
        "issueStartDate": _iso(start),
        "issueEndDate": _iso(end),
        "listingDate": _iso(listing),
        "sharesOffered": row.get("sharesOffered"),
        "subscriptionTimes": row.get("subscriptionTimes"),
    }


def _classify_current(row: dict[str, Any], today: date) -> str:
    start = _parse_date(row.get("issueStartDate"))
    end = _parse_date(row.get("issueEndDate"))
    status = (row.get("status") or "").lower()

    if start and today < start:
        return "upcoming"
    if end and today > end:
        return "closed"
    if status == "active":
        return "ongoing"
    return "closed" if status == "closed" else "upcoming"


def fetch_listing_performance(symbol: str, listing_date: str | None) -> dict[str, Any]:
    """
    Real listing-day and current performance from post-listing price history.

    The first traded session on or after the listing date supplies the listing
    open and close; the latest session supplies the current price. Returns empty
    fields when the ticker has no Yahoo history, which is common for recent SME
    listings.
    """
    if not listing_date:
        return {}

    try:
        frame = yf.Ticker(to_yahoo_symbol(symbol)).history(period="2y", interval="1d")
    except Exception:
        return {}

    if frame is None or frame.empty:
        return {}

    frame = frame.dropna(subset=["Close"])
    if frame.empty:
        return {}

    index = pd.to_datetime(frame.index).tz_localize(None).normalize()
    target = pd.Timestamp(listing_date)
    on_or_after = index >= target
    if not on_or_after.any():
        return {}

    first_pos = int(on_or_after.argmax())
    first = frame.iloc[first_pos]
    latest = frame.iloc[-1]

    return {
        "listingOpen": round(float(first["Open"]), 2),
        "listingClose": round(float(first["Close"]), 2),
        "cmp": round(float(latest["Close"]), 2),
        "sessionsSinceListing": int(len(frame) - first_pos),
    }


def fetch_final_subscription(symbol: str, segment: str) -> float | None:
    """Total subscription multiple of a closed issue, on the same basis as the live feed."""
    for series in (("SME", "SM") if segment == "sme" else ("EQ", "BE")):
        try:
            d = nse.nse_get(f"/api/ipo-detail?symbol={symbol}&series={series}")
        except Exception:
            continue
        for row in (d or {}).get("bidDetails", []) if isinstance(d, dict) else []:
            if str(row.get("category", "")).startswith("Total"):
                try:
                    v = float(row.get("noOfTime"))
                except (TypeError, ValueError):
                    continue
                return round(v, 2)
    return None


def build_pipeline(with_performance: int = 45) -> dict[str, Any]:
    """
    The full pipeline: ongoing, upcoming, closed and listed.

    `with_performance` bounds how many recent listings get a price lookup —
    each is a separate upstream call, so the whole list is not enriched.
    """
    today = date.today()
    issues: list[dict[str, Any]] = []
    errors: list[str] = []

    try:
        for row in nse.fetch_current_ipos():
            issue = _base(row, _classify_current(row, today))
            issue["subscription"] = {
                "totalX": row.get("subscriptionTimes"),
                "sharesOffered": row.get("sharesOffered"),
                "sharesBid": row.get("sharesBid"),
            }
            issues.append(issue)
    except Exception as exc:
        errors.append(f"current: {type(exc).__name__}")

    try:
        seen = {i["symbol"] for i in issues}
        for row in nse.fetch_upcoming_ipos():
            if row.get("symbol") in seen:
                continue
            issues.append(_base(row, _classify_current(row, today)))
    except Exception as exc:
        errors.append(f"upcoming: {type(exc).__name__}")

    listed: list[dict[str, Any]] = []
    try:
        seen = {i["symbol"] for i in issues}
        for row in nse.fetch_past_issues(limit=80):
            if row.get("symbol") in seen:
                continue
            issue = _base(row, "listed" if _parse_date(row.get("listingDate")) else "closed")
            listed.append(issue)
    except Exception as exc:
        errors.append(f"past: {type(exc).__name__}")

    # Enrich the most recent listings: price history and final subscription are separate upstream
    # calls per issue, so they run in parallel and are bounded.
    from concurrent.futures import ThreadPoolExecutor

    candidates = [i for i in listed if i["status"] == "listed"][:with_performance]

    def enrich(issue: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None, float | None]:
        perf = None
        sub = None
        try:
            perf = fetch_listing_performance(issue["symbol"], issue["listingDate"])
        except Exception:
            perf = None
        try:
            sub = fetch_final_subscription(issue["symbol"], issue["segment"])
        except Exception:
            sub = None
        return issue, perf, sub

    enriched = 0
    if candidates:
        with ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(enrich, candidates))
        for issue, perf, sub in results:
            if sub is not None:
                issue["subscriptionTimes"] = sub
            if not perf:
                continue
            enriched += 1
            issue_price = issue.get("priceBandHigh")
            issue.update(perf)
            if issue_price:
                issue["listingGainPct"] = round(((perf["listingClose"] - issue_price) / issue_price) * 100, 2)
                issue["cmpVsIssuePct"] = round(((perf["cmp"] - issue_price) / issue_price) * 100, 2)
                issue["sinceListingPct"] = round(((perf["cmp"] - perf["listingClose"]) / perf["listingClose"]) * 100, 2)

    issues.extend(listed)

    return {
        "issues": issues,
        "counts": {
            status: sum(1 for i in issues if i["status"] == status)
            for status in ("ongoing", "upcoming", "closed", "listed")
        },
        "segments": {
            segment: sum(1 for i in issues if i["segment"] == segment)
            for segment in ("mainboard", "sme")
        },
        "performanceEnriched": enriched,
        "errors": errors or None,
        "unavailable": {
            "planning": (
                "DRHP-stage issues are filed with SEBI, not NSE, and are not exposed by any "
                "free API. The planning category cannot be populated from live data."
            ),
            "greyMarketPremium": (
                "GMP is an unofficial quote from a thin market. No exchange publishes it and "
                "no API exposes it."
            ),
        },
    }
