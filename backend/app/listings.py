"""
Every listed Indian equity, on either exchange, as one list.

Three exchange files are merged: NSE's main-board master, NSE Emerge (SME) and BSE's
scrip master (main board and SME). They are joined by ISIN, the one identifier both
exchanges share; tickers are not reliable for this (BSE's scrip ID differs from the NSE
symbol for many companies, and the same letters can mean different companies).

Each company gets one route id. A company on NSE keeps its NSE symbol, so existing
links do not move; a company only on BSE is addressed by its six-digit BSE scrip code,
which can never collide with an NSE symbol because NSE symbols always contain a letter.
"""

from __future__ import annotations

import logging
from typing import Any

from .cache import CACHE
from .providers import bse, universe

LOG = logging.getLogger("arthdex.listings")
TTL = 86_400


def build(nse_main: list[dict[str, Any]], nse_sme: list[dict[str, Any]], bse_master: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_isin: dict[str, dict[str, Any]] = {}
    out: list[dict[str, Any]] = []

    def add(entry: dict[str, Any]) -> None:
        out.append(entry)
        if entry["isin"]:
            by_isin[entry["isin"]] = entry

    for board, rows in (("main", nse_main), ("sme", nse_sme)):
        for r in rows:
            if r.get("isin") and r["isin"] in by_isin:
                continue
            add(
                {
                    "id": r["symbol"],
                    "name": r["name"],
                    "isin": r.get("isin"),
                    "nse": {"symbol": r["symbol"], "series": r.get("series") or None, "board": board},
                    "bse": None,
                }
            )

    for r in bse_master:
        listing = {
            "code": r["code"], "scripId": r.get("scripId"), "group": r.get("group"),
            "board": "sme" if r.get("sme") else "main", "status": r.get("status") or "active",
        }
        entry = by_isin.get(r["isin"]) if r.get("isin") else None
        if entry is not None:
            # An ISIN can carry an active and a suspended scrip code; the active one wins
            if entry["bse"] is None or (entry["bse"].get("status") != "active" and listing["status"] == "active"):
                entry["bse"] = listing
            continue
        add({"id": r["code"], "name": r["name"], "isin": r.get("isin"), "nse": None, "bse": listing})

    for e in out:
        e["exchanges"] = [x for x in ("NSE", "BSE") if e[x.lower()]]
    return out


def _load() -> list[dict[str, Any]]:
    parts: dict[str, list[dict[str, Any]]] = {}
    errors: list[str] = []
    for name, fn in (("nse", universe.fetch_equity_universe), ("sme", universe.fetch_sme_universe), ("bse", bse.fetch_scrip_master)):
        try:
            parts[name] = fn()
        except Exception as exc:  # one exchange down still leaves the other searchable
            errors.append(f"{name}: {type(exc).__name__}: {str(exc)[:120]}")
            parts[name] = []
    if not any(parts.values()):
        raise ValueError("No exchange listing could be loaded: " + "; ".join(errors))
    if errors:
        LOG.warning("Listings built without part of the data: %s", "; ".join(errors))
    return {"rows": build(parts["nse"], parts["sme"], parts["bse"]), "partial": bool(errors)}


def all_listings() -> list[dict[str, Any]]:
    entry = CACHE.get_entry("listings:all")
    # A list missing an exchange is rebuilt after an hour rather than a day
    if entry is not None and entry.value["partial"] and (CACHE.age("listings:all") or 0) > 3600:
        CACHE.expire("listings:all")
    data, _ = CACHE.get_or_fetch("listings:all", TTL, _load)
    return data["rows"]


def _index() -> dict[str, dict[str, Any]]:
    """Lookup by route id, NSE symbol, BSE code, then BSE scrip ID where it is unambiguous."""
    data = all_listings()
    cached = CACHE.get_entry("listings:index")
    if cached is not None and cached.value[0] is data:
        return cached.value[1]
    index: dict[str, dict[str, Any]] = {}
    for e in data:
        index.setdefault(e["id"], e)
        if e["bse"]:
            index.setdefault(e["bse"]["code"], e)
    for e in data:
        scrip = e["bse"] and e["bse"].get("scripId")
        if scrip:
            index.setdefault(scrip, e)
    CACHE.set("listings:index", (data, index))
    return index


def resolve(symbol: str) -> dict[str, Any] | None:
    try:
        return _index().get((symbol or "").strip().upper())
    except Exception:
        return None


def exchange_for(symbol: str, requested: str = "NSE") -> str:
    """
    The exchange to price `symbol` on: the one asked for when the company trades there,
    otherwise the one it does trade on. A BSE code always means BSE.
    """
    want = (requested or "NSE").upper()
    if want == "NSE" and not bse.is_code(symbol):
        return "NSE"  # route ids for BSE-only companies are codes, so a ticker on NSE needs no lookup
    entry = resolve(symbol)
    if entry is None:
        return "BSE" if bse.is_code(symbol) else want
    if want in entry["exchanges"]:
        return want
    return entry["exchanges"][0]


def bse_code(symbol: str) -> str | None:
    if bse.is_code(symbol):
        return symbol.strip()
    entry = resolve(symbol)
    return entry["bse"]["code"] if entry and entry["bse"] else None


def nse_symbol(symbol: str) -> str | None:
    entry = resolve(symbol)
    if entry and entry["nse"]:
        return entry["nse"]["symbol"]
    return None if bse.is_code(symbol) else symbol.upper()


def describe(symbol: str) -> dict[str, Any] | None:
    """The listing block the front end needs: where it trades and under which tickers."""
    entry = resolve(symbol)
    if entry is None:
        return None
    return {
        "id": entry["id"],
        "isin": entry["isin"],
        "exchanges": entry["exchanges"],
        "nse": entry["nse"],
        "bse": entry["bse"],
    }


def search(query: str, limit: int = 12) -> list[dict[str, Any]]:
    """
    Rank matches across both exchanges: exact ticker or code, ticker prefix, name prefix,
    then any substring. Larger boards win ties so "TATA" surfaces main-board names first.
    """
    q = (query or "").strip().upper()
    if not q:
        return []
    scored: list[tuple[int, int, dict[str, Any]]] = []
    for e in all_listings():
        tickers = [t for t in ((e["nse"] or {}).get("symbol"), (e["bse"] or {}).get("scripId"), (e["bse"] or {}).get("code")) if t]
        name = (e["name"] or "").upper()
        if q in tickers:
            rank = 0
        elif any(t.startswith(q) for t in tickers):
            rank = 1
        elif name.startswith(q):
            rank = 2
        elif any(q in t for t in tickers):
            rank = 3
        elif q in name:
            rank = 4
        else:
            continue
        sme = all(x.get("board") == "sme" for x in (e["nse"], e["bse"]) if x)
        scored.append((rank, (1 if sme else 0) + (0 if len(e["exchanges"]) == 2 else 1), e))
    scored.sort(key=lambda t: (t[0], t[1], len(t[2]["id"])))
    return [
        {
            "id": e["id"],
            "symbol": e["id"],
            "name": e["name"],
            "series": (e["nse"] or {}).get("series") or (e["bse"] or {}).get("group") or "",
            "isin": e["isin"],
            "kind": "listed",
            "href": f"/company/{e['id']}",
            "exchanges": e["exchanges"],
            "nseSymbol": (e["nse"] or {}).get("symbol"),
            "bseCode": (e["bse"] or {}).get("code"),
            "board": "sme" if all(x.get("board") == "sme" for x in (e["nse"], e["bse"]) if x) else "main",
        }
        for _r, _t, e in scored[:limit]
    ]
