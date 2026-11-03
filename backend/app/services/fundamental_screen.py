"""
A fundamental screener on vetted figures.

Running the full vetting pipeline (Yahoo against screener.in, settled by NSE filings)
for 500 companies per query is out of the question, so it runs on a schedule instead:
each company's per-share figures, growth and quality are recorded in the point-in-time
store as a snapshot, refreshed a slice at a time (`refresh`). At query time the
price-based multiples are recomputed for every company from NSE's whole-market traded
list, so P/E, P/B and yield move with the market while the earnings behind them only
change when a company reports.

Filters are a small whitelisted language, `pe < 20 AND roe > 18 AND de < 0.5`,
parsed rather than evaluated: a field, a comparison and a number, joined by AND.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import date, timedelta
from typing import Any, Callable

from ..store import STORE, Store

LOG = logging.getLogger("uvicorn.error")
SERIES = "snapshot:fundamentals"
STALE_AFTER_DAYS = 7
PER_RUN = 120
PACE_SECONDS = 3.0

# field: (label, unit, where it comes from)
FIELDS: dict[str, tuple[str, str, str]] = {
    "price": ("Price", "₹", "live"),
    "change": ("Change today", "%", "live"),
    "mcap": ("Market cap", "₹ Cr", "live"),
    "pe": ("P/E", "x", "live price over vetted TTM EPS"),
    "pb": ("P/B", "x", "live price over book value per share"),
    "divyield": ("Dividend yield", "%", "dividends paid in 12 months over live price"),
    "roe": ("ROE", "%", "vetted"),
    "roce": ("ROCE", "%", "vetted"),
    "de": ("Debt to equity", "x", "vetted"),
    "currentratio": ("Current ratio", "x", "vetted"),
    "revenue": ("Revenue, TTM", "₹ Cr", "vetted"),
    "profit": ("Net profit, TTM", "₹ Cr", "vetted"),
    "opm": ("Operating margin", "%", "vetted"),
    "npm": ("Net margin", "%", "vetted"),
    "revgrowth": ("Revenue growth, last year", "%", "vetted annual"),
    "profitgrowth": ("Profit growth, last year", "%", "vetted annual"),
    "revcagr3": ("Revenue growth, 3-year CAGR", "%", "vetted annual"),
}
OPS: dict[str, Callable[[float, float], bool]] = {
    "<=": lambda a, b: a <= b, ">=": lambda a, b: a >= b, "<": lambda a, b: a < b, ">": lambda a, b: a > b, "=": lambda a, b: abs(a - b) < 1e-9,
}
_CLAUSE = re.compile(r"^\s*([a-z0-9]+)\s*(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*$")

PRESETS = {
    "quality": ("Quality at a fair price", "roe > 18 AND roce > 18 AND de < 0.5 AND pe < 35"),
    "value": ("Cheap on earnings and book", "pe < 12 AND pb < 1.5 AND profit > 0"),
    "growth": ("Growing fast", "revgrowth > 20 AND profitgrowth > 20 AND opm > 10"),
    "dividend": ("Dividend payers", "divyield > 3 AND de < 1"),
    "compounders": ("Steady compounders", "revcagr3 > 15 AND roe > 15 AND npm > 10"),
}


class FilterError(ValueError):
    pass


def parse(formula: str) -> list[tuple[str, str, float]]:
    """`pe < 20 AND roe > 18` into [("pe", "<", 20.0), ("roe", ">", 18.0)]; unknown fields are errors."""
    clauses = []
    for part in re.split(r"\s+and\s+", formula.strip().lower()) if formula.strip() else []:
        m = _CLAUSE.match(part)
        if not m:
            raise FilterError(f"Could not read '{part.strip()}': write a field, a comparison and a number, like pe < 20")
        field, op, value = m.group(1), m.group(2), float(m.group(3))
        if field not in FIELDS:
            raise FilterError(f"Unknown field '{field}'. Fields: {', '.join(FIELDS)}")
        clauses.append((field, op, value))
    if len(clauses) > 12:
        raise FilterError("At most 12 conditions")
    return clauses


# -- snapshots ------------------------------------------------------------------------


def _growth(new: float | None, old: float | None) -> float | None:
    if not isinstance(new, (int, float)) or not isinstance(old, (int, float)) or old <= 0:
        return None
    return round((new / old - 1) * 100, 2)


def snapshot_one(symbol: str, financials: dict[str, Any], valuation: dict[str, Any], sector: str | None) -> dict[str, Any]:
    """Per-share figures, growth and quality from the vetted financials; nothing price-based."""
    ratios = financials.get("ratios") or {}
    annual = [r for r in financials.get("annual") or [] if isinstance(r.get("revenue"), (int, float))]
    quarterly = financials.get("quarterly") or []
    sources = financials.get("sources") or {}
    unresolved = sum(len((sources.get(k) or {}).get("unresolved") or []) for k in ("quarterly", "annual", "balanceSheet"))
    revenue, profit = ratios.get("revenueCr"), ratios.get("netProfitCr")
    q4 = quarterly[-4:]
    op = sum(q["operatingProfit"] for q in q4) if len(q4) == 4 and all(isinstance(q.get("operatingProfit"), (int, float)) for q in q4) else None
    return {
        "symbol": symbol,
        "sector": sector,
        "eps": valuation.get("eps"),
        "bookValue": valuation.get("bookValue"),
        "dividendsTtm": valuation.get("dividendsTtm"),
        "roe": ratios.get("roePct"),
        "roce": ratios.get("rocePct"),
        "de": ratios.get("debtToEquity"),
        "currentratio": ratios.get("currentRatio"),
        "revenue": revenue,
        "profit": profit,
        "opm": round(op / revenue * 100, 2) if op is not None and revenue else (annual[-1].get("opmPct") if annual else None),
        "npm": round(profit / revenue * 100, 2) if isinstance(profit, (int, float)) and revenue else None,
        "revgrowth": _growth(annual[-1]["revenue"], annual[-2]["revenue"]) if len(annual) >= 2 else None,
        "profitgrowth": _growth(annual[-1].get("netProfit"), annual[-2].get("netProfit")) if len(annual) >= 2 else None,
        "revcagr3": round(((annual[-1]["revenue"] / annual[-4]["revenue"]) ** (1 / 3) - 1) * 100, 2)
        if len(annual) >= 4 and annual[-4]["revenue"] > 0 else None,
        "basis": ratios.get("basis"),
        "unresolved": unresolved,
    }


def refresh(
    symbols: list[str],
    fetch: Callable[[str], tuple[dict[str, Any], dict[str, Any]]],
    sectors: dict[str, str],
    store: Store = STORE,
    limit: int = PER_RUN,
    pace: float = PACE_SECONDS,
) -> dict[str, Any]:
    """Snapshot up to `limit` companies whose snapshot is missing or older than a week, oldest first."""
    cutoff = (date.today() - timedelta(days=STALE_AFTER_DAYS)).isoformat()
    latest = {r[0]: str(r[1])[:10] for r in store.query("SELECT key, MAX(as_of) FROM series WHERE name = ? GROUP BY key", (SERIES,))}
    due = sorted((s for s in symbols if latest.get(s, "0000") < cutoff), key=lambda s: latest.get(s, "0000"))[:limit]
    done, failed = [], []
    for i, sym in enumerate(due):
        if i:
            time.sleep(pace)
        try:
            financials, valuation = fetch(sym)
            store.put(SERIES, date.today(), snapshot_one(sym, financials, valuation, sectors.get(sym)), key=sym, source="Arthdex vetted financials")
            done.append(sym)
        except Exception as exc:  # one company failing does not stop the slice
            failed.append({"symbol": sym, "error": f"{type(exc).__name__}: {str(exc)[:120]}"})
    LOG.info("Fundamental snapshots: %d refreshed, %d failed, %d still due", len(done), len(failed), max(0, len([s for s in symbols if latest.get(s, '0000') < cutoff]) - len(due)))
    return {"refreshed": done, "failed": failed}


def load(store: Store = STORE) -> dict[str, dict[str, Any]]:
    """The latest snapshot per company."""
    rows = store.query(
        "SELECT s.key, s.payload, s.as_of FROM series s JOIN (SELECT key, MAX(as_of) AS m FROM series WHERE name = ? GROUP BY key) t "
        "ON s.key = t.key AND s.as_of = t.m WHERE s.name = ?",
        (SERIES, SERIES),
    )
    import json

    return {r[0]: {**json.loads(r[1]), "asOf": str(r[2])[:10]} for r in rows}


# -- query ----------------------------------------------------------------------------


def with_live(snap: dict[str, Any], live: dict[str, Any] | None) -> dict[str, Any]:
    row = dict(snap)
    price = (live or {}).get("last")
    row["price"] = price
    row["change"] = (live or {}).get("changePct")
    row["mcap"] = (live or {}).get("marketCapCr")
    eps, book, paid = snap.get("eps"), snap.get("bookValue"), snap.get("dividendsTtm")
    row["pe"] = round(price / eps, 2) if price and isinstance(eps, (int, float)) and eps > 0 else None
    row["pb"] = round(price / book, 2) if price and isinstance(book, (int, float)) and book > 0 else None
    row["divyield"] = round(paid / price * 100, 2) if price and isinstance(paid, (int, float)) else None
    return row


def screen(
    formula: str,
    snapshots: dict[str, dict[str, Any]],
    live: dict[str, dict[str, Any]],
    sort: str = "mcap",
    descending: bool = True,
    limit: int = 50,
) -> dict[str, Any]:
    clauses = parse(formula)
    if sort not in FIELDS:
        raise FilterError(f"Cannot sort by '{sort}'")
    rows = [with_live(s, live.get(sym)) for sym, s in snapshots.items()]
    matched = []
    for r in rows:
        ok = True
        for field, op, value in clauses:
            v = r.get(field)
            # A missing figure never passes a condition: blank is not zero
            if not isinstance(v, (int, float)) or not OPS[op](v, value):
                ok = False
                break
        if ok:
            matched.append(r)
    matched.sort(key=lambda r: (r.get(sort) is None, -(r.get(sort) or 0) if descending else (r.get(sort) or 0)))
    dates = sorted(s["asOf"] for s in snapshots.values())
    return {
        "formula": " AND ".join(f"{f} {o} {v:g}" for f, o, v in clauses),
        "matched": len(matched),
        "universe": len(rows),
        "rows": matched[:limit],
        "snapshotRange": {"oldest": dates[0], "newest": dates[-1]} if dates else None,
        "withUnresolved": sum(1 for r in matched if r.get("unresolved")),
    }
