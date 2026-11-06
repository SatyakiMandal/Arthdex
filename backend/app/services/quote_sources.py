"""
Two sources for a company quote: the exchange (NSE) first, Yahoo as the backup.

NSE is the exchange of record, so its price, range, volume and market cap are
used when it answers. Yahoo is fetched as well, every time, for two reasons: it
carries the page when NSE refuses the request (NSE blocks many cloud addresses),
and the two prices are compared so a broken or stale source shows up at once.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

# Both are fetched within seconds of each other; a larger gap means one is stale or wrong
PRICE_TOLERANCE = 0.005


def choose(fetch_nse: Callable[[], dict[str, Any] | None], fetch_yahoo: Callable[[], dict[str, Any] | None]) -> dict[str, Any] | None:
    def attempt(fn: Callable[[], dict[str, Any] | None]) -> tuple[dict[str, Any] | None, str | None]:
        try:
            return fn(), None
        except Exception as exc:  # a refused source is reported, not raised
            return None, f"{type(exc).__name__}: {str(exc)[:160]}"

    nse, nse_error = attempt(fetch_nse)
    yahoo, yahoo_error = attempt(fetch_yahoo)
    quote = nse or yahoo
    if quote is None:
        return None

    report: dict[str, Any] = {
        "used": "nse" if nse else "yahoo",
        "nsePrice": nse.get("cmp") if nse else None,
        "yahooPrice": yahoo.get("cmp") if yahoo else None,
        "nseError": nse_error,
        "yahooError": yahoo_error,
        "agree": None,
        "gapPct": None,
    }
    if nse and yahoo and nse.get("cmp") and yahoo.get("cmp"):
        gap = abs(nse["cmp"] - yahoo["cmp"]) / max(nse["cmp"], yahoo["cmp"])
        report.update(gapPct=round(gap * 100, 3), agree=gap <= PRICE_TOLERANCE)

    merged = dict(quote)
    # Fill anything the chosen source left empty from the other, field by field
    other = yahoo if quote is nse else nse
    if other:
        for key, value in other.items():
            if merged.get(key) in (None, 0) and value not in (None, 0):
                merged[key] = value
    merged["sources"] = report
    return merged


def fetch(symbol: str, exchange: str = "NSE") -> dict[str, Any] | None:
    """Exchange first, Yahoo as backup and cross-check. BSE listings have only the Yahoo route."""
    from ..providers import nse, yahoo

    if exchange.upper() != "NSE":
        q = yahoo.fetch_quote(symbol, exchange)
        if q is None:
            return None
        return {
            **q,
            "sources": {
                "used": "yahoo",
                "nsePrice": None,
                "yahooPrice": q.get("cmp"),
                "nseError": None,
                "yahooError": None,
                "agree": None,
                "gapPct": None,
            },
        }
    return choose(lambda: nse.fetch_quote(symbol), lambda: yahoo.fetch_quote(symbol, exchange))
