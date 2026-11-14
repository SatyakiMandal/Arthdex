"""
BSE (Bombay Stock Exchange): the scrip master, quotes and daily history.

BSE's own site is served by a JSON API at api.bseindia.com. It answers browser-like
requests that carry a bseindia.com Referer, without the cookie dance NSE needs. Every
company is keyed by its six-digit scrip code (Reliance: 500325); the scrip ID
("RELIANCE") is BSE's ticker and often, but not always, matches the NSE symbol, so the
two exchanges are joined by ISIN, never by ticker.

Like NSE's, these endpoints are unofficial: shapes are read defensively and a missing
field stays empty rather than being guessed.
"""

from __future__ import annotations

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from curl_cffi import requests as curl_requests

API = "https://api.bseindia.com/BseIndiaAPI/api/"
HEADERS = {
    "Referer": "https://www.bseindia.com/",
    "Origin": "https://www.bseindia.com",
    "Accept": "application/json, text/plain, */*",
}

_local = threading.local()


def _session() -> Any:
    session = getattr(_local, "session", None)
    if session is None:
        session = curl_requests.Session(impersonate="chrome")
        _local.session = session
    return session


def bse_get(path: str, timeout: int = 30) -> Any:
    response = _session().get(API + path, headers=HEADERS, timeout=timeout)
    response.raise_for_status()
    # BSE answers an unknown scrip with 200 and an empty body
    return response.json() if response.content.strip() else None


def _num(value: Any) -> float | None:
    """BSE prints numbers as text with Indian grouping ("18,05,375.99") and signs."""
    if value in (None, "", "-", "--"):
        return None
    try:
        return float(str(value).replace(",", "").replace("+", "").strip())
    except ValueError:
        return None


_UNITS = {"cr": 1e7, "crore": 1e7, "lakh": 1e5, "lac": 1e5, "thousand": 1e3, "k": 1e3}


def _scaled(value: Any, unit: Any) -> float | None:
    """A figure printed with a unit label such as "(Cr.)" or "(Lakh)", in plain units."""
    v = _num(value)
    if v is None:
        return None
    label = str(unit or "").strip("() .").lower()
    if label and label not in _UNITS:
        return None  # an unknown unit leaves the field blank rather than off by a power of ten
    return v * _UNITS.get(label, 1.0)


def is_code(symbol: str) -> bool:
    """A BSE scrip code: six digits (500325). NSE symbols always contain a letter."""
    s = (symbol or "").strip()
    return s.isdigit() and len(s) == 6


def fetch_scrip_master() -> list[dict[str, Any]]:
    """
    Every listed equity scrip on BSE, main board and SME, with ISIN.

    Suspended scrips are included: they remain listed, only trading is halted, and
    they are marked so a stale last price is never read as a live one. Delisted
    scrips are left out.
    """
    out: list[dict[str, Any]] = []
    for status in ("Active", "Suspended"):
        rows = bse_get(f"ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status={status}", timeout=60) or []
        if status == "Active" and not rows:
            raise ValueError("BSE returned an empty scrip master")
        for r in rows:
            code = str(r.get("SCRIP_CD") or "").strip()
            if not is_code(code):
                continue
            group = (r.get("GROUP") or "").strip()
            out.append(
                {
                    "code": code,
                    "scripId": (r.get("scrip_id") or "").strip().upper() or None,
                    "name": (r.get("Issuer_Name") or r.get("Scrip_Name") or "").strip() or code,
                    "shortName": (r.get("Scrip_Name") or "").strip() or None,
                    "isin": (r.get("ISIN_NUMBER") or "").strip() or None,
                    "group": group or None,
                    # BSE's SME platform scrips sit in the M, MT and MS groups
                    "sme": group in ("M", "MT", "MS"),
                    "status": status.lower(),
                }
            )
    return out


def fetch_quote(code: str) -> dict[str, Any] | None:
    """
    The exchange's own quote, in the same shape as nse.fetch_quote.

    Four small calls make one quote: price and range, trading statistics (volume,
    turnover, market cap), the 52-week range, and identifiers. Only the first is
    required; the rest fill fields and stay empty when BSE refuses them.
    """
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {
            "head": pool.submit(bse_get, f"getScripHeaderData/w?Debtflag=&scripcode={code}&seriesid="),
            "trade": pool.submit(bse_get, f"StockTrading/w?flag=&quotetype=EQ&scripcode={code}"),
            "range": pool.submit(bse_get, f"HighLow/w?scripcode={code}&Type=EQ&flag=C"),
            "info": pool.submit(bse_get, f"ComHeadernew/w?quotetype=EQ&scripcode={code}&seriesid="),
        }
        parts: dict[str, Any] = {}
        for name, job in jobs.items():
            try:
                parts[name] = job.result() or {}
            except Exception:
                if name == "head":
                    raise
                parts[name] = {}

    head, trade, rng, info = parts["head"], parts["trade"], parts["range"], parts["info"]
    rate, header = head.get("CurrRate") or {}, head.get("Header") or {}
    last = _num(rate.get("LTP")) or _num(header.get("LTP"))
    if not last:
        return None
    prev = _num(header.get("PrevClose"))
    change = _num(rate.get("Chg"))
    pct = _num(rate.get("PcChg"))
    if change is None and prev:
        change = last - prev
    if pct is None and prev and change is not None:
        pct = change / prev * 100
    # Volume and turnover carry their own unit labels, which change with the size of the
    # number (Reliance's turnover is in crore, a small cap's in lakh)
    ttq = _scaled(trade.get("TTQ"), trade.get("TTQin"))
    turnover = _scaled(trade.get("Turnover"), trade.get("Turnoverin"))
    return {
        "symbol": code,
        "exchange": "BSE",
        "cmp": round(last, 2),
        "change": {"absolute": round(change or 0.0, 2), "percent": round(pct or 0.0, 2)},
        "open": _num(header.get("Open")),
        "previousClose": prev,
        "adjustedBase": None,
        "dayHigh": _num(header.get("High")),
        "dayLow": _num(header.get("Low")),
        "high52w": _num(rng.get("Fifty2WkHigh_adj")),
        "low52w": _num(rng.get("Fifty2WkLow_adj")),
        "volume": int(round(ttq)) if ttq is not None else 0,
        "turnoverCr": round(turnover / 1e7, 4) if turnover is not None else None,
        "vwap": _num(trade.get("WAP")),
        "marketCapCr": _num(trade.get("MktCapFull")),
        "currency": "INR",
        "isin": (info.get("ISIN") or "").strip() or None,
        "name": ((head.get("Cmpname") or {}).get("FullN") or "").strip() or None,
        "sector": (info.get("Sector") or "").strip() or None,
        "basicIndustry": (info.get("Industry") or "").strip() or None,
        "bseGroup": (info.get("Group") or "").strip() or None,
        "exchangeTime": header.get("Ason"),
        "asOf": datetime.now(timezone.utc).isoformat(),
    }


def fetch_daily_history(code: str) -> list[dict[str, Any]]:
    """
    Daily closes and volumes for the last twelve months, oldest first.

    BSE's chart feed gives one close per day (no open, high or low), so the bar is drawn
    flat at the close. It backs up Yahoo for the one-year and shorter daily periods.
    """
    payload = bse_get(f"StockReachGraph/w?scripcode={code}&flag=12M&fromdate=&todate=&seriesid=") or {}
    raw = payload.get("Data")
    points = json.loads(raw) if isinstance(raw, str) else raw or []
    rows: dict[str, dict[str, Any]] = {}
    for p in points:
        close = _num(p.get("vale1"))
        try:
            day = datetime.strptime(str(p.get("dttm"))[:15], "%a %b %d %Y").date().isoformat()
        except ValueError:
            continue
        if close is None:
            continue
        rows[day] = {"date": day, "open": close, "high": close, "low": close, "close": round(close, 2),
                     "volume": int(_num(p.get("vole")) or 0)}
    return [rows[k] for k in sorted(rows)]
