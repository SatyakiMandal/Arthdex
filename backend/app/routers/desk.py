"""Research-desk endpoints: deals, calendar, watchlist snapshot, movers explained, data status."""

from __future__ import annotations

import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import nse, yahoo
from ..providers import universe as universe_provider
from ..schemas import envelope
from ..services import news as news_service
from ..services import unlisted as unlisted_service
from .search import load_universe

router = APIRouter(prefix="/api/v1", tags=["desk"])

DEALS_TTL = 900
CALENDAR_TTL = 1800
STARTED_AT = time.time()


def _num(value: Any) -> float | None:
    return nse._num(value)


def _ddmmyyyy(text: str | None) -> str | None:
    """NSE writes dates as 01-Oct-2026; return ISO so the client can sort them."""
    if not text or text.strip() in {"-", ""}:
        return None
    from datetime import datetime

    for fmt in ("%d-%b-%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


# -- bulk and block deals -----------------------------------------------------


def _build_deals() -> dict[str, Any]:
    raw = nse.nse_get("/api/snapshot-capital-market-largedeal")

    def rows(key: str, kind: str) -> list[dict[str, Any]]:
        out = []
        for r in raw.get(key) or []:
            qty = _num(r.get("qty"))
            price = _num(r.get("watp"))
            out.append(
                {
                    "kind": kind,
                    "symbol": r.get("symbol"),
                    "name": (r.get("name") or "").strip(),
                    "client": (r.get("clientName") or "").strip(),
                    "side": (r.get("buySell") or "").upper(),
                    "quantity": qty,
                    "price": price,
                    "valueCr": round(qty * price / 1e7, 2) if qty and price else None,
                    "remarks": (r.get("remarks") or "").strip() or None,
                    "date": _ddmmyyyy(r.get("date")),
                }
            )
        out.sort(key=lambda d: -(d["valueCr"] or 0))
        return out

    return {
        "asOn": _ddmmyyyy(raw.get("as_on_date")),
        "bulk": rows("BULK_DEALS_DATA", "bulk"),
        "block": rows("BLOCK_DEALS_DATA", "block"),
        "short": rows("SHORT_DEALS_DATA", "short"),
    }


@router.get("/deals")
def get_deals():
    """Today's bulk, block and short-selling disclosures from the exchange."""
    try:
        data, age = CACHE.get_or_fetch("desk:deals", DEALS_TTL, _build_deals)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Deals unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="NSE large deals snapshot",
        note="Latest session only. A bulk deal is 0.5% or more of a company's equity; value is quantity times weighted average price.",
    )


# -- calendar: board meetings, results, corporate actions ---------------------


def _build_calendar() -> dict[str, Any]:
    today = date.today()
    end = today + timedelta(days=30)
    fmt = lambda d: d.strftime("%d-%m-%Y")  # noqa: E731

    meetings: list[dict[str, Any]] = []
    errors: list[str] = []
    try:
        for r in nse.nse_get("/api/event-calendar") or []:
            purpose = r.get("purpose") or ""
            meetings.append(
                {
                    "symbol": r.get("symbol"),
                    "name": r.get("company"),
                    "date": _ddmmyyyy(r.get("date")),
                    "purpose": purpose,
                    "detail": (r.get("bm_desc") or "")[:300],
                    "isResults": bool(re.search(r"result", purpose + " " + (r.get("bm_desc") or ""), re.I)),
                }
            )
    except Exception as exc:
        errors.append(f"event calendar: {type(exc).__name__}")

    actions: list[dict[str, Any]] = []
    try:
        path = f"/api/corporates-corporateActions?index=equities&from_date={fmt(today)}&to_date={fmt(end)}"
        for r in nse.nse_get(path) or []:
            subject = r.get("subject") or ""
            low = subject.lower()
            kind = (
                "dividend" if "dividend" in low
                else "split" if "split" in low or "sub-division" in low
                else "bonus" if "bonus" in low
                else "rights" if "rights" in low
                else "other"
            )
            actions.append(
                {
                    "symbol": r.get("symbol"),
                    "name": r.get("comp"),
                    "subject": subject,
                    "kind": kind,
                    "exDate": _ddmmyyyy(r.get("exDate")),
                    "recordDate": _ddmmyyyy(r.get("recDate")),
                }
            )
    except Exception as exc:
        errors.append(f"corporate actions: {type(exc).__name__}")

    if not meetings and not actions:
        raise RuntimeError("; ".join(errors) or "no calendar data returned")

    meetings.sort(key=lambda m: m["date"] or "9999")
    actions.sort(key=lambda a: a["exDate"] or "9999")
    return {"meetings": meetings, "actions": actions, "errors": errors or None, "from": today.isoformat(), "to": end.isoformat()}


@router.get("/calendar")
def get_calendar():
    """Upcoming board meetings and results dates, plus dividends, splits, bonuses and rights."""
    try:
        data, age = CACHE.get_or_fetch("desk:calendar", CALENDAR_TTL, _build_calendar)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Calendar unavailable: {exc}") from exc
    return envelope(data, age, source="NSE event calendar and corporate actions", note="Next 30 days.")


# -- watchlist snapshot -------------------------------------------------------


class SnapshotRequest(BaseModel):
    listed: list[str] = Field(default_factory=list, max_length=60)
    unlisted: list[str] = Field(default_factory=list, max_length=60)


_SYMBOL_RE = re.compile(r"^[A-Za-z0-9&.\-]{1,24}$")


def _quote(symbol: str) -> dict[str, Any] | None:
    key = f"company:quote:NSE:{symbol.upper()}"
    try:
        data, _age = CACHE.get_or_fetch(key, SETTINGS.quote_ttl, lambda: yahoo.fetch_quote(symbol, "NSE"))
    except Exception:
        return None
    if not data:
        return None
    return {"id": symbol.upper(), "price": data["cmp"], "changePct": data["change"]["percent"], "previousClose": data["previousClose"]}


@router.post("/watchlist/snapshot")
def watchlist_snapshot(body: SnapshotRequest):
    """Latest price for a set of listed symbols and unlisted ids. Used by the watchlist and by alert checks."""
    listed = [s for s in dict.fromkeys(body.listed) if _SYMBOL_RE.match(s)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        quotes = [q for q in pool.map(_quote, listed) if q]

    unlisted_rows: list[dict[str, Any]] = []
    directory = unlisted_service.cached_directory()
    if directory is not None:
        wanted = set(body.unlisted)
        for c in directory:
            if c["id"] in wanted:
                unlisted_rows.append({"id": c["id"], "price": c["price"], "name": c["name"], "sector": c["sector"]})

    return envelope(
        {"listed": quotes, "unlisted": unlisted_rows, "unlistedReady": directory is not None},
        0,
        source="Yahoo Finance (listed), UnlistedZone indicative prices (unlisted)",
        delayed_minutes=SETTINGS.quote_delay_minutes,
    )


# -- movers explained ---------------------------------------------------------

_FLAG_LABELS = {
    "earnings": "Results",
    "board-outcome": "Board outcome",
    "order-win": "Order win",
    "rating-action": "Rating action",
    "acquisition": "Acquisition",
    "dividend": "Dividend",
}


def _news_items() -> list[dict[str, Any]]:
    def fetch():
        try:
            rows, _age = load_universe()
            known = universe_provider.searchable_symbols(rows)
        except Exception:
            known = set()
        return news_service.build_feed(limit=200, known_symbols=known)

    data, _age = CACHE.get_or_fetch("news:feed", SETTINGS.news_ttl, fetch)
    return data["items"]


FILING_WINDOW_DAYS = 4
_ROUTINE_FILINGS = r"trading window|newspaper|share certificate|loss of|duplicate|intimation of record date for"


def _symbol_filings(symbol: str) -> list[dict[str, Any]]:
    """Recent exchange filings for one company.

    The shared news feed only holds the latest ~80 filings market-wide, which is about
    the last hour, so a mover's results or order-win filing from this morning is usually
    not in it. Asking the exchange per symbol finds it.
    """

    def fetch() -> list[dict[str, Any]]:
        rows = nse.nse_get(f"/api/corporate-announcements?index=equities&symbol={symbol}") or []
        cutoff = time.time() - FILING_WINDOW_DAYS * 86_400
        out = []
        for r in rows[:40]:
            iso = news_service._to_iso(r.get("an_dt"))
            if not iso:
                continue
            from datetime import datetime

            try:
                when = datetime.fromisoformat(iso).timestamp()
            except ValueError:
                continue
            if when < cutoff:
                continue
            subject = r.get("desc")
            detail = r.get("attchmntText")
            if re.search(_ROUTINE_FILINGS, subject or "", re.I):
                continue  # compliance housekeeping, not a reason for a price move
            out.append(
                {
                    "headline": f"{r.get('sm_name') or symbol}: {subject}",
                    "summary": (detail or "")[:300],
                    "source": "NSE corporate filing",
                    "url": r.get("attchmntFile"),
                    "publishedAt": iso,
                    "flags": news_service._classify_filing(subject, detail),
                    "kind": "filing",
                }
            )
        return out

    try:
        data, _age = CACHE.get_or_fetch(f"desk:filings:{symbol}", 600, fetch)
    except Exception:
        return []
    return data


@router.get("/market/movers-explained")
def movers_explained(
    direction: str = Query("gainers", pattern="^(gainers|losers)$"),
    universe: str = Query(nse.DEFAULT_MOVER_UNIVERSE),
    limit: int = Query(8, ge=1, le=20),
):
    """Today's biggest movers, each paired with the filings and headlines that name it."""
    if universe not in nse.MOVER_UNIVERSES:
        raise HTTPException(status_code=400, detail=f"universe must be one of {sorted(nse.MOVER_UNIVERSES)}")
    try:
        movers, age = CACHE.get_or_fetch(
            f"market:movers:{direction}:{universe}", SETTINGS.movers_ttl, lambda: nse.fetch_movers(direction, universe)
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"NSE movers unavailable: {exc}") from exc

    try:
        items = _news_items()
    except Exception:
        items = []

    by_symbol: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        if item["kind"] == "press":
            for sym in item.get("symbols") or []:
                by_symbol.setdefault(sym, []).append(item)

    ordered = sorted(movers, key=lambda r: r["change"]["percent"], reverse=direction == "gainers")[:limit]
    # One at a time: the shared NSE session is not safe to use from several threads
    filings = [_symbol_filings(m["symbol"]) for m in ordered]

    rows = []
    for r, own_filings in zip(ordered, filings):
        related = [*own_filings, *by_symbol.get(r["symbol"], [])]
        # Filings are primary sources and outrank press commentary; flagged ones (results, orders) first
        related.sort(key=lambda i: str(i.get("publishedAt") or ""), reverse=True)
        related.sort(key=lambda i: (i["kind"] != "filing", not i.get("flags")))
        seen_headlines: set[str] = set()
        related = [i for i in related if not (i["headline"] in seen_headlines or seen_headlines.add(i["headline"]))]
        labels = []
        for item in related:
            for flag in item.get("flags") or []:
                label = _FLAG_LABELS.get(flag)
                if label and label not in labels:
                    labels.append(label)
        rows.append(
            {
                "symbol": r["symbol"],
                "name": r.get("name"),
                "cmp": r["cmp"],
                "changePct": r["change"]["percent"],
                "labels": labels,
                "news": [
                    {
                        "headline": i["headline"],
                        "source": i["source"],
                        "url": i.get("url"),
                        "publishedAt": i.get("publishedAt"),
                        "kind": i["kind"],
                    }
                    for i in related[:3]
                ],
            }
        )

    return envelope(
        rows,
        age,
        source="NSE movers; NSE filings and Indian financial press",
        delayed_minutes=1,
        note="A headline naming a stock is a candidate explanation, not proof of cause. Moves with no headline may be flow, sector or market driven.",
    )


# -- data status --------------------------------------------------------------

_FEEDS: list[tuple[str, str, str, int]] = [
    ("Indices and ticker", "market:indices", "NSE", SETTINGS.index_ttl),
    ("Movers", "market:movers", "NSE", SETTINGS.movers_ttl),
    ("Company quotes", "company:quote", "Yahoo Finance", SETTINGS.quote_ttl),
    ("Price candles", "company:candles", "Yahoo Finance", SETTINGS.candles_ttl),
    ("Fundamentals", "company:profile", "Yahoo Finance", SETTINGS.fundamentals_ttl),
    ("News and filings", "news:feed", "NSE filings and press RSS", SETTINGS.news_ttl),
    ("IPO pipeline", "ipo:pipeline", "NSE IPO desk", SETTINGS.ipo_ttl),
    ("Listed universe", "universe:equity", "NSE equity master list", 86_400),
    ("Unlisted directory", unlisted_service.DIRECTORY_KEY, "UnlistedZone", unlisted_service.DIRECTORY_TTL),
    ("Deals", "desk:deals", "NSE", DEALS_TTL),
    ("Calendar", "desk:calendar", "NSE", CALENDAR_TTL),
]


@router.get("/status")
def data_status():
    """Per-feed freshness, read from the cache so checking status never hits an upstream."""
    ages = CACHE.stats()
    feeds = []
    for label, prefix, source, ttl in _FEEDS:
        matching = [age for key, age in ages.items() if key.startswith(prefix)]
        age = min(matching) if matching else None
        if age is None:
            state = "idle"
        elif age <= ttl * 1.5:
            state = "fresh"
        else:
            state = "stale"
        feeds.append(
            {"label": label, "source": source, "state": state, "ageSeconds": age, "ttlSeconds": ttl, "entries": len(matching)}
        )
    return envelope(
        {"service": "ok", "uptimeSeconds": round(time.time() - STARTED_AT), "feeds": feeds},
        0,
        source="Arthdex data service cache",
        note="Read from the cache, so this page never queries an upstream itself. 'Idle' means no one has requested that feed since the service started.",
    )


# -- pre-IPO history for a now-listed company ---------------------------------


@router.get("/company/{symbol}/pre-ipo")
def pre_ipo(symbol: str):
    """The unlisted-directory page for a listed company's earlier private-market life, if one exists."""
    if not _SYMBOL_RE.match(symbol):
        raise HTTPException(status_code=404, detail="Unknown symbol")
    try:
        rows, age = load_universe()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Universe unavailable: {exc}") from exc
    row = next((r for r in rows if r["symbol"] == symbol.upper()), None)
    match = unlisted_service.pre_ipo_match(row["name"]) if row else None
    return envelope(match or {"id": None, "name": None}, age, source="UnlistedZone directory matched on company name")
