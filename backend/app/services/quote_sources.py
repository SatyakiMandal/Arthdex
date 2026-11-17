"""
Two sources for a company quote: the exchange first, Yahoo as the backup.

The exchange the quote is asked for (NSE or BSE) is the exchange of record, so its
price, range, volume and market cap are used when it answers. Yahoo's quote for the
same exchange is fetched as well, every time, for two reasons: it carries the page
when the exchange refuses the request (NSE blocks many cloud addresses), and the two
prices are compared so a broken or stale source shows up at once.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

# Both are fetched within seconds of each other; a larger gap means one is stale or wrong
PRICE_TOLERANCE = 0.005


def choose(
    fetch_nse: Callable[[], dict[str, Any] | None],
    fetch_yahoo: Callable[[], dict[str, Any] | None],
    exchange: str = "NSE",
) -> dict[str, Any] | None:
    """`fetch_nse` is the exchange's own quote, whichever exchange that is."""
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

    ex = exchange.lower()
    report: dict[str, Any] = {
        "used": ex if nse else "yahoo",
        "exchange": exchange.upper(),
        "exchangePrice": nse.get("cmp") if nse else None,
        "nsePrice": nse.get("cmp") if nse and ex == "nse" else None,
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
    """The exchange first, Yahoo as backup and cross-check, with where else the company trades."""
    from .. import listings
    from ..providers import bse, nse, yahoo

    ex = listings.exchange_for(symbol, exchange)
    if ex == "BSE":
        code = listings.bse_code(symbol)
        if code is None:
            return None
        quote = choose(lambda: bse.fetch_quote(code), lambda: yahoo.fetch_quote(code, "BSE"), exchange="BSE")
    else:
        quote = choose(lambda: nse.fetch_quote(symbol), lambda: yahoo.fetch_quote(symbol, "NSE"), exchange="NSE")
    if quote is None:
        return None
    listing = listings.describe(symbol)
    if listing:
        # The route id, not the exchange ticker, is what every other endpoint is called with
        quote = {**quote, "symbol": listing["id"], "exchange": ex, "listing": listing}
    return quote
