"""
A one-page company summary, assembled from Arthdex's own real data.

Every section is read from the same service the company pages use, so it carries the
same sourcing and vetting: the exchange quote, Yahoo's statistics, the vetted annual
results (Yahoo against screener.in, settled by NSE XBRL filings), the screener.in peer
table, the shareholding pattern and the analyst estimates. A section whose source does
not answer is left empty and says why; nothing is filled in.

Research notes are what users write, kept in memory for the session of the service.
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Literal

# -- research notes --------------------------------------------------------------


@dataclass
class ResearchNote:
    id: str
    symbol: str
    title: str
    author: str
    firm: str
    recommendation: Literal["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"]
    target_price: float
    horizon: str
    key_catalysts: list[str]
    key_risks: list[str]
    tags: list[str]
    content: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_NOTES_LOCK = threading.Lock()
_RESEARCH_NOTES_STORE: dict[str, list[ResearchNote]] = {}


def get_research_notes_for_symbol(symbol: str) -> list[dict[str, Any]]:
    """Notes users have written for a company, newest first."""
    with _NOTES_LOCK:
        return [n.to_dict() for n in _RESEARCH_NOTES_STORE.get(symbol.upper(), [])]


def add_research_note(
    symbol: str,
    title: str,
    author: str,
    firm: str,
    recommendation: Literal["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"],
    target_price: float,
    horizon: str = "12 Months",
    key_catalysts: list[str] | None = None,
    key_risks: list[str] | None = None,
    tags: list[str] | None = None,
    content: str = "",
) -> dict[str, Any]:
    sym = symbol.upper()
    now_iso = datetime.now(timezone.utc).isoformat()
    note = ResearchNote(
        id=str(uuid.uuid4()), symbol=sym, title=title, author=author, firm=firm, recommendation=recommendation,
        target_price=round(target_price, 2), horizon=horizon, key_catalysts=key_catalysts or [], key_risks=key_risks or [],
        tags=tags or [], content=content, created_at=now_iso, updated_at=now_iso,
    )
    with _NOTES_LOCK:
        _RESEARCH_NOTES_STORE.setdefault(sym, []).insert(0, note)
    return note.to_dict()


# -- the summary -------------------------------------------------------------------


def _returns(candles: list[dict[str, Any]]) -> dict[str, float | None]:
    """Price change over each window, from the last close back to the first close on or before the start."""
    from datetime import date, timedelta

    closes = [(c["date"][:10], c["close"]) for c in candles if c.get("close")]
    if len(closes) < 2:
        return {}
    last_day, last = closes[-1]
    end = date.fromisoformat(last_day)
    out: dict[str, float | None] = {}
    for label, days in (("1M", 30), ("3M", 91), ("6M", 182), ("1Y", 365), ("3Y", 1095), ("5Y", 1826)):
        start = (end - timedelta(days=days)).isoformat()
        before = [c for d, c in closes if d <= start]
        # A window longer than the history is left empty, not measured from the first close
        out[label] = round((last / before[-1] - 1) * 100, 2) if before else None
    return out


def get_company_tear_sheet(symbol: str) -> dict[str, Any]:
    from ..routers import company

    sym = symbol.upper()
    missing: dict[str, str] = {}

    def section(name: str, fn: Callable[[], Any]) -> Any:
        try:
            return fn()
        except Exception as exc:  # each section stands alone; a failure is reported, not filled
            detail = getattr(exc, "detail", None) or str(exc)
            missing[name] = str(detail)[:200]
            return None

    quote = section("price", lambda: company.get_quote(sym, "NSE")["data"])
    stats = section("statistics", lambda: company.get_statistics(sym)["data"])
    fin = section("financials", lambda: company.get_financials(sym, "NSE")["data"])
    peers = section("peers", lambda: company.get_peers(sym)["data"])
    holding = section("shareholding", lambda: company.get_shareholding(sym)["data"])
    analysts = section("analysts", lambda: company.get_analysts(sym)["data"])
    candles = section("returns", lambda: company.get_candles(sym, "5Y", "NSE")["data"]["candles"])

    about = (stats or {}).get("about") or {}
    trading = (stats or {}).get("trading") or {}
    valuation = (stats or {}).get("valuation") or {}
    dividends = (stats or {}).get("dividends") or {}
    listing = (quote or {}).get("listing") or {}

    pattern = ((holding or {}).get("pattern") or {}).get("quarterly") or {}
    labels = pattern.get("labels") or []
    take = slice(-6, None)
    shareholding = [
        {
            "quarter": q,
            **{k: (pattern.get(k) or [None] * len(labels))[i] for k in ("promoters", "fiis", "diis", "government", "public")},
        }
        for i, q in list(enumerate(labels))[take]
    ] if labels else []

    recs = (analysts or {}).get("recommendations") or []
    return {
        "symbol": sym,
        "asOf": datetime.now(timezone.utc).isoformat(),
        "header": {
            "name": about.get("name") or (quote or {}).get("name"),
            "isin": listing.get("isin") or (quote or {}).get("isin"),
            "exchanges": listing.get("exchanges"),
            "nseSymbol": (listing.get("nse") or {}).get("symbol"),
            "bseCode": (listing.get("bse") or {}).get("code"),
            "sector": about.get("sector"),
            "industry": about.get("industry"),
            "website": about.get("website"),
            "employees": about.get("employees"),
            "summary": about.get("summary"),
            "officers": [{"name": o.get("name"), "title": o.get("title")} for o in ((stats or {}).get("officers") or [])[:6]],
        },
        "price": {
            "cmp": (quote or {}).get("cmp"),
            "change": ((quote or {}).get("change") or {}).get("absolute"),
            "changePct": ((quote or {}).get("change") or {}).get("percent"),
            "exchange": (quote or {}).get("exchange"),
            "dayHigh": (quote or {}).get("dayHigh"),
            "dayLow": (quote or {}).get("dayLow"),
            "high52w": (quote or {}).get("high52w"),
            "low52w": (quote or {}).get("low52w"),
            "marketCapCr": (quote or {}).get("marketCapCr"),
            "enterpriseValueCr": valuation.get("enterpriseValue"),
            "sharesOutstanding": trading.get("sharesOutstanding"),
            "floatShares": trading.get("floatShares"),
            "beta": trading.get("beta"),
            "asOf": (quote or {}).get("asOf"),
        } if quote else None,
        "returns": _returns(candles) if candles else None,
        "valuation": {
            "trailingPE": valuation.get("trailingPE"),
            "forwardPE": valuation.get("forwardPE"),
            "priceToBook": valuation.get("priceToBook"),
            "evToEbitda": valuation.get("evToEbitda"),
            "dividendYieldPct": dividends.get("trailingYieldPct"),
        } if stats else None,
        "annual": (fin or {}).get("annual") or [],
        "annualSource": ((fin or {}).get("sources") or {}).get("annual", {}).get("used"),
        "ratios": (fin or {}).get("ratios"),
        "peers": {
            "industry": ((peers or {}).get("classification") or {}).get("industry"),
            "rows": [(peers or {}).get("self")] + [p for p in (peers or {}).get("peers") or [] if p.get("symbol") != sym][:6],
        } if peers else None,
        "shareholding": shareholding,
        "pledgePct": ((holding or {}).get("analytics") or {}).get("pledgePct"),
        "analysts": {
            "targets": (analysts or {}).get("targets"),
            "latest": recs[0] if recs else None,
            "nextEarnings": (analysts or {}).get("nextEarnings"),
        } if analysts else None,
        "notes": get_research_notes_for_symbol(sym)[:3],
        "missing": missing,
        "sources": [
            "Exchange quote (NSE or BSE) with Yahoo Finance cross-check",
            "Yahoo Finance statistics and analyst estimates",
            "Annual results from Yahoo Finance and screener.in, settled by NSE XBRL filings",
            "screener.in industry peers",
            "Shareholding pattern from screener.in, vetted against NSE",
        ],
    }
