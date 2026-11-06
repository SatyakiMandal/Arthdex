"""
NSE option chains and open-interest changes.

The chain is NSE's own (option-chain-v3, which needs an expiry; the older
option-chain-indices endpoint answers 404 since NSE's site rebuild). There is no free
second source for Indian option chains, so the service vets the chain for internal
consistency instead (services/options.py).
"""

from __future__ import annotations

import urllib.parse
from datetime import datetime
from typing import Any

from .nse import _num, nse_get

INDEX_SYMBOLS = ("NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50")


def kind_of(symbol: str) -> str:
    return "Indices" if symbol.upper() in INDEX_SYMBOLS else "Equity"


def expiries(symbol: str) -> list[str]:
    """Expiry dates, nearest first, as ISO dates."""
    encoded = urllib.parse.quote(symbol.upper(), safe="")
    data = nse_get(f"/api/option-chain-contract-info?symbol={encoded}")
    out = []
    for e in (data or {}).get("expiryDates") or []:
        try:
            out.append(datetime.strptime(e, "%d-%b-%Y").date().isoformat())
        except ValueError:
            continue
    return sorted(out)


def _leg(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    if not raw:
        return None
    return {
        "ltp": _num(raw.get("lastPrice")),
        "change": _num(raw.get("change")),
        "oi": _num(raw.get("openInterest")),
        "oiChange": _num(raw.get("changeinOpenInterest")),
        "volume": _num(raw.get("totalTradedVolume")),
        "iv": _num(raw.get("impliedVolatility")) or None,  # NSE reports 0 where it has no IV
        "bid": _num(raw.get("buyPrice1")),
        "ask": _num(raw.get("sellPrice1")),
    }


def chain(symbol: str, expiry_iso: str) -> dict[str, Any]:
    """One expiry's chain: per-strike call and put legs, the underlying, and NSE's own totals."""
    expiry = datetime.fromisoformat(expiry_iso).strftime("%d-%b-%Y")
    encoded = urllib.parse.quote(symbol.upper(), safe="")
    data = nse_get(f"/api/option-chain-v3?type={kind_of(symbol)}&symbol={encoded}&expiry={expiry}")
    records = (data or {}).get("records") or {}
    rows = []
    for r in records.get("data") or []:
        strike = _num(r.get("strikePrice") or (r.get("CE") or r.get("PE") or {}).get("strikePrice"))
        if strike is None:
            continue
        rows.append({"strike": strike, "ce": _leg(r.get("CE")), "pe": _leg(r.get("PE"))})
    filtered = (data or {}).get("filtered") or {}
    return {
        "symbol": symbol.upper(),
        "expiry": expiry_iso,
        "underlying": _num(records.get("underlyingValue")),
        "timestamp": records.get("timestamp") or None,
        "rows": sorted(rows, key=lambda r: r["strike"]),
        "nseTotals": {
            "ceOi": _num((filtered.get("CE") or {}).get("totOI")),
            "peOi": _num((filtered.get("PE") or {}).get("totOI")),
        },
    }


def oi_spurts() -> list[dict[str, Any]]:
    """Underlyings with the largest change in open interest today."""
    data = nse_get("/api/live-analysis-oi-spurts-underlyings")
    out = []
    for r in (data or {}).get("data") or []:
        out.append({
            "symbol": r.get("symbol"),
            "latestOi": _num(r.get("latestOI")),
            "previousOi": _num(r.get("prevOI")),
            "oiChange": _num(r.get("changeInOI")),
            "oiChangePct": _num(r.get("avgInOI")),
            "underlying": _num(r.get("underlyingValue")),
        })
    return out
