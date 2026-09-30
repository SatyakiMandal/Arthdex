"""
NSE public JSON provider.

These endpoints back nseindia.com itself. They are public but undocumented and
unversioned: they require a primed cookie, reject non-browser clients, and can
change without notice. Every call is defensive and the caller is expected to
degrade gracefully rather than assume a shape.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

from curl_cffi import requests as curl_requests

from ..config import SETTINGS

_SESSION_LOCK = threading.Lock()
_session: Any = None


def _build_session() -> Any:
    """
    A fresh impersonated session with cookies primed from the home page.

    NSE rejects requests that arrive without the cookies its home page sets, so
    the priming hit is mandatory, not an optimisation.
    """
    session = curl_requests.Session(impersonate="chrome")
    session.headers.update(
        {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": f"{SETTINGS.nse_base}/",
        }
    )
    session.get(SETTINGS.nse_base, timeout=SETTINGS.request_timeout)
    return session


def _get_session(force_new: bool = False) -> Any:
    global _session
    with _SESSION_LOCK:
        if _session is None or force_new:
            _session = _build_session()
        return _session


def nse_get(path: str, attempts: int = 3) -> Any:
    """
    GET an NSE API path with bounded retries and backoff.

    Two failure modes dominate. Cookies expire, after which the endpoint returns
    HTML or 401 instead of JSON — that needs a fresh primed session. And the
    endpoint rate-limits under burst, returning 429 or an empty body — that
    needs a pause, not an immediate retry, or the caller simply burns its
    attempts faster.
    """
    url = f"{SETTINGS.nse_base}{path}"
    last_error: str = "no attempt made"

    for attempt in range(attempts):
        # Re-prime the session on every retry: a stale cookie is the single most
        # common cause of a non-JSON response here.
        session = _get_session(force_new=attempt > 0)
        try:
            response = session.get(url, timeout=SETTINGS.request_timeout)

            if response.status_code == 200 and "json" in response.headers.get("content-type", ""):
                return response.json()

            last_error = f"status={response.status_code}"
            if response.status_code in (401, 403, 429, 503):
                # Exponential backoff with a small floor; NSE throttles bursts
                time.sleep(0.75 * (2**attempt))
                continue
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            if attempt == attempts - 1:
                raise
            time.sleep(0.75 * (2**attempt))

    raise RuntimeError(f"NSE endpoint returned no usable JSON after {attempts} attempts ({last_error}): {path}")


def _num(value: Any) -> float | None:
    if value in (None, "", "-"):
        return None
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


# Indices surfaced in the ticker bar, in display order. NSE's own naming is used
# as the lookup key; anything absent from the response is simply skipped.
TICKER_INDICES: list[tuple[str, str, str]] = [
    ("nifty-50", "NIFTY 50", "broad"),
    ("nifty-next-50", "NIFTY NEXT 50", "broad"),
    ("nifty-100", "NIFTY 100", "broad"),
    ("nifty-500", "NIFTY 500", "broad"),
    ("nifty-midcap-100", "NIFTY MIDCAP 100", "broad"),
    ("nifty-smallcap-100", "NIFTY SMALLCAP 100", "broad"),
    ("nifty-bank", "NIFTY BANK", "sectoral"),
    ("nifty-it", "NIFTY IT", "sectoral"),
    ("nifty-auto", "NIFTY AUTO", "sectoral"),
    ("nifty-pharma", "NIFTY PHARMA", "sectoral"),
    ("nifty-fmcg", "NIFTY FMCG", "sectoral"),
    ("nifty-metal", "NIFTY METAL", "sectoral"),
    ("nifty-energy", "NIFTY ENERGY", "sectoral"),
    ("nifty-realty", "NIFTY REALTY", "sectoral"),
    ("nifty-psu-bank", "NIFTY PSU BANK", "sectoral"),
    ("india-vix", "INDIA VIX", "thematic"),
]


def fetch_indices() -> list[dict[str, Any]]:
    payload = nse_get("/api/allIndices")
    rows = {row.get("index"): row for row in payload.get("data", [])}
    out: list[dict[str, Any]] = []

    for index_id, nse_name, family in TICKER_INDICES:
        row = rows.get(nse_name)
        if not row:
            continue
        level = _num(row.get("last"))
        prev = _num(row.get("previousClose"))
        if level is None:
            continue
        change_abs = None if prev is None else level - prev
        change_pct = _num(row.get("percentChange"))
        if change_pct is None and prev:
            change_pct = ((level - prev) / prev) * 100

        out.append(
            {
                "id": index_id,
                "name": row.get("index") or nse_name,
                "family": family,
                "exchange": "NSE",
                "level": round(level, 2),
                "change": {
                    "absolute": round(change_abs, 2) if change_abs is not None else 0.0,
                    "percent": round(change_pct, 2) if change_pct is not None else 0.0,
                },
                "peRatio": _num(row.get("pe")),
                "pbRatio": _num(row.get("pb")),
                "dividendYieldPct": _num(row.get("dy")),
                "advances": int(_num(row.get("advances")) or 0),
                "declines": int(_num(row.get("declines")) or 0),
                "oneMonthChangePct": _num(row.get("perChange30d")),
                "oneYearChangePct": _num(row.get("perChange365d")),
                "high52w": _num(row.get("yearHigh")),
                "low52w": _num(row.get("yearLow")),
                "asOf": payload.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            }
        )
    return out


# NSE groups its variation lists by universe. Exposed under stable ids so the
# UI can offer a selector without knowing NSE's internal key names.
MOVER_UNIVERSES: dict[str, tuple[str, str]] = {
    "gt20": ("SecGtr20", "Securities above ₹20"),
    "nifty50": ("NIFTY", "Nifty 50"),
    "niftynext50": ("NIFTYNEXT50", "Nifty Next 50"),
    "banknifty": ("BANKNIFTY", "Bank Nifty"),
    "fo": ("FOSec", "F&O securities"),
    "lt20": ("SecLwr20", "Securities below ₹20"),
    "all": ("allSec", "All securities"),
}

# Default deliberately excludes sub-₹20 names. The all-securities list is
# dominated by penny stocks and rights entitlements posting 30% moves on tiny
# turnover, which is noise rather than signal on a market-watch screen.
DEFAULT_MOVER_UNIVERSE = "gt20"


def _is_tradable_equity(symbol: str) -> bool:
    """
    Exclude rights entitlements and other non-share instruments.

    Plain NSE equity symbols never contain a hyphen; suffixed codes such as
    CENTEXT-RE are rights entitlements, not shares in the company.
    """
    return bool(symbol) and "-" not in symbol


def _movers_from(payload: dict[str, Any], bucket: str, universe: str) -> list[dict[str, Any]]:
    nse_key, _label = MOVER_UNIVERSES.get(universe, MOVER_UNIVERSES[DEFAULT_MOVER_UNIVERSE])
    group = payload.get(nse_key) or payload.get("SecGtr20") or {}
    rows = group.get("data", []) if isinstance(group, dict) else []

    out: list[dict[str, Any]] = []
    for row in rows:
        if not _is_tradable_equity((row.get("symbol") or "").upper()):
            continue
        ltp = _num(row.get("ltp"))
        prev = _num(row.get("prev_price"))
        if ltp is None:
            continue
        change_abs = None if prev is None else ltp - prev
        out.append(
            {
                "symbol": row.get("symbol", "").upper(),
                "name": row.get("symbol", "").upper(),
                "cmp": round(ltp, 2),
                "change": {
                    "absolute": round(change_abs, 2) if change_abs is not None else 0.0,
                    "percent": round(_num(row.get("perChange")) or 0.0, 2),
                },
                "open": _num(row.get("open_price")),
                "dayHigh": _num(row.get("high_price")),
                "dayLow": _num(row.get("low_price")),
                "volume": int(_num(row.get("trade_quantity")) or 0),
                "turnoverLakh": _num(row.get("turnover")),
                "bucket": bucket,
                "universe": universe,
            }
        )
    return out


def fetch_movers(direction: str, universe: str = DEFAULT_MOVER_UNIVERSE) -> list[dict[str, Any]]:
    """direction is 'gainers' or 'losers' — NSE's own daily variation lists."""
    key = "gainers" if direction == "gainers" else "loosers"  # NSE spells it this way
    payload = nse_get(f"/api/live-analysis-variations?index={key}")
    return _movers_from(payload, direction, universe)


def fetch_current_ipos() -> list[dict[str, Any]]:
    """Issues currently open or recently closed, per NSE's IPO desk."""
    payload = nse_get("/api/ipo-current-issue")
    if not isinstance(payload, list):
        return []

    out: list[dict[str, Any]] = []
    for row in payload:
        out.append(
            {
                "symbol": (row.get("symbol") or "").upper(),
                "companyName": row.get("companyName"),
                "series": row.get("series"),
                "issuePriceRange": row.get("issuePrice"),
                "issueSize": _num(row.get("issueSize")),
                "issueStartDate": row.get("issueStartDate"),
                "issueEndDate": row.get("issueEndDate"),
                "status": row.get("status"),
                "category": row.get("category"),
                "sharesOffered": _num(row.get("noOfSharesOffered")),
                "sharesBid": _num(row.get("noOfsharesBid")),
                "subscriptionTimes": _num(row.get("noOfTime")),
            }
        )
    return out


def fetch_announcements(limit: int = 60) -> list[dict[str, Any]]:
    """
    Corporate announcements — the primary-source LODR filings that the news
    flags in this app are actually about.
    """
    payload = nse_get("/api/corporate-announcements?index=equities")
    if not isinstance(payload, list):
        return []

    out: list[dict[str, Any]] = []
    for row in payload[:limit]:
        out.append(
            {
                # Two filings from one company can share a timestamp to the
                # second, so the exchange sequence id is carried through to keep
                # each announcement uniquely identifiable downstream.
                "seqId": row.get("seq_id"),
                "symbol": (row.get("symbol") or "").upper(),
                "company": row.get("sm_name") or row.get("symbol"),
                "subject": row.get("desc"),
                "detail": row.get("attchmntText"),
                "attachment": row.get("attchmntFile"),
                "publishedAt": row.get("an_dt"),
                "broadcastAt": row.get("exchdisstime"),
            }
        )
    return out


def fetch_upcoming_ipos() -> list[dict[str, Any]]:
    """Issues with announced dates that have not yet listed."""
    payload = nse_get("/api/all-upcoming-issues?category=ipo")
    if not isinstance(payload, list):
        return []
    return [
        {
            "symbol": (r.get("symbol") or "").upper(),
            "companyName": r.get("companyName"),
            "series": r.get("series"),
            "issuePriceRange": r.get("issuePrice"),
            "issueSize": _num(r.get("issueSize")),
            "issueStartDate": r.get("issueStartDate"),
            "issueEndDate": r.get("issueEndDate"),
            "status": r.get("status"),
        }
        for r in payload
    ]


def fetch_past_issues(limit: int = 120) -> list[dict[str, Any]]:
    """
    Historical public issues.

    NSE returns well over a thousand rows covering debt and other non-equity
    instruments; only equity and SME series are kept.
    """
    payload = nse_get("/api/public-past-issues")
    if not isinstance(payload, list):
        return []

    keep = {"EQ", "BE", "SME"}
    out: list[dict[str, Any]] = []
    for r in payload:
        series = (r.get("securityType") or "").upper()
        if series not in keep:
            continue
        out.append(
            {
                "symbol": (r.get("symbol") or "").upper(),
                "companyName": r.get("company"),
                "series": series,
                "issuePriceRange": r.get("priceRange"),
                "issuePrice": r.get("issuePrice"),
                "issueStartDate": r.get("ipoStartDate"),
                "issueEndDate": r.get("ipoEndDate"),
                "listingDate": r.get("listingDate"),
            }
        )
        if len(out) >= limit:
            break
    return out
