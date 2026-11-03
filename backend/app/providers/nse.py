"""
NSE public JSON provider.

These endpoints back nseindia.com itself. They are public but undocumented and
unversioned: they require a primed cookie, reject non-browser clients, and can
change without notice. Every call is defensive and the caller is expected to
degrade gracefully rather than assume a shape.
"""

from __future__ import annotations

import html

import threading
import time
from datetime import datetime, timedelta, timezone
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


def _text(value: Any) -> str | None:
    """NSE filing text arrives HTML-escaped, sometimes twice (&amp;#8377; for the rupee sign)."""
    if not value:
        return value
    return html.unescape(html.unescape(str(value))).strip()


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
                "company": _text(row.get("sm_name")) or row.get("symbol"),
                "subject": _text(row.get("desc")),
                "detail": _text(row.get("attchmntText")),
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


def fetch_stocks_traded() -> dict[str, Any]:
    """
    Every security traded in the session: last price, change and market cap.

    This is NSE's own whole-market list (about 3,400 rows), so market breadth and
    per-constituent moves come from one call rather than one request per stock.
    """
    payload = nse_get("/api/live-analysis-stocksTraded")
    total = payload.get("total") or {}
    rows: dict[str, dict[str, Any]] = {}
    for row in total.get("data") or []:
        symbol = (row.get("symbol") or "").upper()
        last = _num(row.get("lastPrice"))
        if not _is_tradable_equity(symbol) or last is None or row.get("series") not in ("EQ", "BE", "BZ", "SM", "ST"):
            continue
        cap = _num(row.get("totalMarketCapcsv"))  # NSE reports this in lakh rupees
        rows[symbol] = {
            "last": round(last, 2),
            "changePct": round(_num(row.get("pchange")) or 0.0, 2),
            "marketCapCr": round(cap / 100, 0) if cap else None,
            "series": row.get("series"),
        }
    count = total.get("count") or {}
    return {
        "rows": rows,
        "breadth": {
            "advances": int(_num(count.get("Advances")) or 0),
            "declines": int(_num(count.get("Declines")) or 0),
            "unchanged": int(_num(count.get("Unchange")) or 0),
            "total": int(_num(count.get("Total")) or 0),
        },
        "asOf": payload.get("timestamp") or datetime.now(timezone.utc).isoformat(),
    }


_QUOTE_API = "/api/NextApi/apiClient/GetQuoteApi?functionName={fn}&marketType=N&series=EQ&symbol={symbol}"


def fetch_quote(symbol: str) -> dict[str, Any] | None:
    """
    The exchange's own quote, in the same shape as yahoo.fetch_quote plus ISIN and sector.

    The older /api/quote-equity endpoint answers 403 since NSE's site rebuild; this is
    the call the current quote page makes.
    """
    payload = nse_get(_QUOTE_API.format(fn="getSymbolData", symbol=symbol.upper()))
    rows = (payload or {}).get("equityResponse") or []
    if not rows:
        return None
    r = rows[0]
    meta, trade, price, sec = (r.get(k) or {} for k in ("metaData", "tradeInfo", "priceInfo", "secInfo"))
    last = _num(trade.get("lastPrice")) or _num(meta.get("closePrice"))
    prev = _num(meta.get("previousClose"))
    if not last:
        return None
    change = last - prev if prev else 0.0
    mcap = _num(trade.get("totalMarketCap"))
    return {
        "symbol": symbol.upper(),
        "exchange": "NSE",
        "cmp": round(last, 2),
        "change": {"absolute": round(change, 2), "percent": round(change / prev * 100, 2) if prev else 0.0},
        "open": _num(meta.get("open")),
        "previousClose": prev,
        "dayHigh": _num(meta.get("dayHigh")),
        "dayLow": _num(meta.get("dayLow")),
        "high52w": _num(price.get("yearHigh")),
        "low52w": _num(price.get("yearLow")),
        "volume": int(_num(trade.get("totalTradedVolume")) or 0),
        "marketCapCr": round(mcap / 1e7, 2) if mcap else None,
        "currency": "INR",
        "isin": meta.get("isinCode"),
        "name": meta.get("companyName"),
        "sector": (sec.get("sector") or "").strip() or None,
        "basicIndustry": (sec.get("basicIndustry") or "").strip() or None,
    }


def fetch_daily_history(symbol: str, days: int) -> list[dict[str, Any]]:
    """
    Daily bars from the exchange, oldest first, in the candle shape the site uses.

    These are the prices as traded: unlike Yahoo's they are not adjusted for splits or
    bonus issues, so a series that spans one shows the step. Callers say so on screen.
    The endpoint answers up to a year per request, so longer spans are fetched in years.
    """
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    rows: dict[str, dict[str, Any]] = {}
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=364), end)
        payload = nse_get(
            _QUOTE_API.format(fn="getHistoricalTradeData", symbol=symbol.upper())
            + f"&fromDate={cursor:%d-%m-%Y}&toDate={chunk_end:%d-%m-%Y}"
        )
        for r in payload if isinstance(payload, list) else (payload or {}).get("data") or []:
            close = _num(r.get("chClosingPrice") or r.get("CH_CLOSING_PRICE"))
            stamp = r.get("mtimestamp") or r.get("mTIMESTAMP")
            if close is None or not stamp:
                continue
            day = datetime.strptime(stamp, "%d-%b-%Y").date().isoformat()
            rows[day] = {
                "date": day,
                "open": round(_num(r.get("chOpeningPrice") or r.get("CH_OPENING_PRICE")) or close, 2),
                "high": round(_num(r.get("chTradeHighPrice") or r.get("CH_TRADE_HIGH_PRICE")) or close, 2),
                "low": round(_num(r.get("chTradeLowPrice") or r.get("CH_TRADE_LOW_PRICE")) or close, 2),
                "close": round(close, 2),
                "volume": int(_num(r.get("chTotTradedQty") or r.get("CH_TOT_TRADED_QTY")) or 0),
            }
        cursor = chunk_end + timedelta(days=1)
    return [rows[k] for k in sorted(rows)]


def fetch_institutional_flows() -> dict[str, Any]:
    """
    Provisional cash-market flows of foreign (FII/FPI) and domestic (DII) institutions for
    the latest trading day, in rupees crore: across all exchanges and on NSE alone.
    NSE keeps only the latest day; history is built by the scheduler (app/jobs.py).
    """

    def parse(rows: Any) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for r in rows if isinstance(rows, list) else []:
            who = "fii" if "FII" in str(r.get("category", "")).upper() else "dii" if "DII" in str(r.get("category", "")).upper() else None
            if who:
                out[who] = {"buy": _num(r.get("buyValue")), "sell": _num(r.get("sellValue")), "net": _num(r.get("netValue"))}
                out["date"] = datetime.strptime(r["date"], "%d-%b-%Y").date().isoformat()
        return out

    combined = parse(nse_get("/api/fiidiiTradeReact"))
    try:
        nse_only = parse(nse_get("/api/fiidiiTradeNse"))
    except Exception:
        nse_only = {}
    if not combined.get("fii") or not combined.get("dii"):
        raise ValueError("NSE returned no FII/DII rows")
    return {"date": combined["date"], "allExchanges": {k: combined[k] for k in ("fii", "dii")},
            "nseOnly": {k: nse_only[k] for k in ("fii", "dii") if k in nse_only} or None}
