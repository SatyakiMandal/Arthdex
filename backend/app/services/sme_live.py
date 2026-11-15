"""
NSE Emerge (SME) board, read from the exchange.

Two live sources feed it: NSE's whole-market traded list, whose SM and ST series are the
Emerge board, and the IPO pipeline's SME segment. Everything on the desk is one of those
rows or an aggregate of them.

Not covered, and said so in the payload rather than filled in:
  * BSE SME: no free BSE feed is wired in.
  * Fundamentals per SME company (P/E, ROE, margins) and mainboard-migration eligibility
    (paid-up capital, years listed, shareholder count): not in either source.
  * Grey-market premium: an unofficial dealer quote, excluded by policy (see services/ipo).

``board`` and ``sme_ipos`` are pure and tested offline.
"""

from __future__ import annotations

from typing import Any

SME_SERIES = ("SM", "ST")
TOP_N = 10

UNAVAILABLE = {
    "bseSme": "BSE SME listings are not covered: no free BSE feed is connected.",
    "fundamentals": "P/E, ROE and margins for SME companies are not carried by the exchange feed.",
    "migration": (
        "Mainboard-migration eligibility needs paid-up capital, listing age and shareholder counts "
        "per company, which no connected source provides."
    ),
    "greyMarketPremium": "Grey-market premium is an unofficial dealer quote and is not shown.",
}


def _name_map(universe: Any) -> dict[str, str]:
    names: dict[str, str] = {}
    for item in universe or []:
        if isinstance(item, dict) and item.get("symbol") and item.get("name"):
            names[str(item["symbol"]).upper()] = str(item["name"])
    return names


def parse_master(text: str) -> list[dict[str, str]]:
    """Symbol and company name from NSE's Emerge master CSV (SYMBOL,NAME_OF_COMPANY,...)."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines or "SYMBOL" not in lines[0].upper() or "NAME" not in lines[0].upper():
        raise ValueError("Emerge master list has an unexpected header")
    out = []
    for line in lines[1:]:
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 2 and parts[0] and parts[1]:
            out.append({"symbol": parts[0].upper(), "name": parts[1]})
    return out


def board(traded: dict[str, Any] | None, universe: Any = None) -> dict[str, Any]:
    """Every Emerge security traded in the session, plus aggregates over them."""
    names = _name_map(universe)
    rows = []
    for symbol, row in ((traded or {}).get("rows") or {}).items():
        if row.get("series") not in SME_SERIES:
            continue
        rows.append({
            "symbol": symbol,
            "name": names.get(symbol),
            "series": row.get("series"),
            "last": row.get("last"),
            "changePct": row.get("changePct"),
            "volume": row.get("volume"),
            "turnoverCr": row.get("turnoverCr"),
            "marketCapCr": row.get("marketCapCr"),
        })
    rows.sort(key=lambda r: (r["marketCapCr"] or 0.0), reverse=True)

    caps = [r["marketCapCr"] for r in rows if r["marketCapCr"]]
    moved = [r for r in rows if isinstance(r["changePct"], (int, float))]
    by_change = sorted(moved, key=lambda r: r["changePct"], reverse=True)
    by_turnover = sorted((r for r in rows if r["turnoverCr"]), key=lambda r: r["turnoverCr"], reverse=True)
    return {
        "asOf": (traded or {}).get("asOf"),
        "exchange": "NSE Emerge",
        "count": len(rows),
        "totalMarketCapCr": round(sum(caps), 0) if caps else None,
        "totalTurnoverCr": round(sum(r["turnoverCr"] or 0.0 for r in rows), 2) if rows else None,
        "breadth": {
            "advances": sum(1 for r in moved if r["changePct"] > 0),
            "declines": sum(1 for r in moved if r["changePct"] < 0),
            "unchanged": sum(1 for r in moved if r["changePct"] == 0),
        },
        "marketCapTiers": {
            "under100Cr": sum(1 for c in caps if c < 100),
            "from100To250Cr": sum(1 for c in caps if 100 <= c < 250),
            "from250To500Cr": sum(1 for c in caps if 250 <= c < 500),
            "over500Cr": sum(1 for c in caps if c >= 500),
        },
        "gainers": by_change[:TOP_N],
        "losers": [r for r in reversed(by_change[-TOP_N:]) if r["changePct"] < 0],
        "mostTraded": by_turnover[:TOP_N],
        "rows": rows,
        "unavailable": UNAVAILABLE,
    }


def screen(
    rows: list[dict[str, Any]],
    min_market_cap_cr: float | None = None,
    max_market_cap_cr: float | None = None,
    min_turnover_cr: float | None = None,
    sort: str = "marketCapCr",
    limit: int = 200,
) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        cap, turnover = r.get("marketCapCr"), r.get("turnoverCr")
        if min_market_cap_cr is not None and (cap is None or cap < min_market_cap_cr):
            continue
        if max_market_cap_cr is not None and (cap is None or cap > max_market_cap_cr):
            continue
        if min_turnover_cr is not None and (turnover is None or turnover < min_turnover_cr):
            continue
        out.append(r)
    key = sort if sort in ("marketCapCr", "turnoverCr", "changePct", "volume") else "marketCapCr"
    out.sort(key=lambda r: (r.get(key) is not None, r.get(key) or 0.0), reverse=True)
    return out[:limit]


def sme_ipos(pipeline: dict[str, Any] | None, status: str = "all") -> dict[str, Any]:
    """The SME segment of the IPO pipeline, as the exchange lists it."""
    issues = [i for i in (pipeline or {}).get("issues") or [] if i.get("segment") == "sme"]
    if status != "all":
        issues = [i for i in issues if i.get("status") == status]
    return {
        "issues": issues,
        "counts": {s: sum(1 for i in issues if i.get("status") == s) for s in ("ongoing", "upcoming", "closed", "listed")},
        "unavailable": {"greyMarketPremium": UNAVAILABLE["greyMarketPremium"]},
    }
