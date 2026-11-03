"""
The results season: who has reported the current quarter, how they did against the
same quarter a year before, and who is still to report and when.

Figures come from the fundamental snapshots (services/fundamental_screen.py), which
hold each Nifty 500 company's vetted latest quarter and its year-ago quarter. Scheduled
results come from NSE's event calendar. Companies are snapshotted soon after their
results meeting (the snapshot job puts them first), so a company appears here within
hours of reporting rather than at its weekly refresh.

The season is the latest quarter end that at least a fifth of snapshotted companies
have reported; until then it is the quarter before, so a handful of early reporters do
not make the season look empty.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from statistics import median
from typing import Any

from ..cache import CACHE
from ..providers.nse import nse_get

SEASON_THRESHOLD = 0.2


def calendar() -> list[dict[str, Any]]:
    """NSE's scheduled financial-results meetings, as {symbol, company, date}."""

    def fetch():
        rows = nse_get("/api/event-calendar?index=equities") or []
        out = []
        for r in rows if isinstance(rows, list) else []:
            if "result" not in str(r.get("purpose", "")).lower():
                continue
            try:
                day = datetime.strptime(r["date"], "%d-%b-%Y").date().isoformat()
            except (KeyError, ValueError):
                continue
            out.append({"symbol": r.get("symbol"), "company": r.get("company"), "date": day})
        return out

    rows, _ = CACHE.get_or_fetch("calendar:results", 3 * 3600, fetch)
    return rows


def reported_dates() -> dict[str, str]:
    """Results meetings already held, symbol to date, for the snapshot job's priority list."""
    today = date.today().isoformat()
    try:
        return {r["symbol"]: r["date"] for r in calendar() if r["symbol"] and r["date"] <= today}
    except Exception:
        return {}


def _growth(new: Any, old: Any) -> float | None:
    if not isinstance(new, (int, float)) or not isinstance(old, (int, float)) or old <= 0:
        return None
    return round((new / old - 1) * 100, 1)


def _season(snapshots: dict[str, dict[str, Any]]) -> str | None:
    ends = sorted({(s.get("latestQuarter") or {}).get("periodEnd") for s in snapshots.values()} - {None}, reverse=True)
    total = len(snapshots)
    for end in ends:
        share = sum(1 for s in snapshots.values() if (s.get("latestQuarter") or {}).get("periodEnd") == end) / total
        if share >= SEASON_THRESHOLD:
            return end
    return ends[0] if ends else None


def build(snapshots: dict[str, dict[str, Any]], scheduled: list[dict[str, Any]], names: dict[str, str]) -> dict[str, Any]:
    season = _season(snapshots)
    reported, pending = [], []
    for sym, s in snapshots.items():
        q, ya = s.get("latestQuarter") or {}, s.get("yearAgoQuarter") or {}
        if season and q.get("periodEnd") == season:
            reported.append({
                "symbol": sym,
                "name": names.get(sym, sym),
                "sector": s.get("sector"),
                "quarter": q.get("quarter"),
                "revenue": q.get("revenue"),
                "netProfit": q.get("netProfit"),
                "revenueGrowth": _growth(q.get("revenue"), ya.get("revenue")),
                "profitGrowth": _growth(q.get("netProfit"), ya.get("netProfit")),
                "epsGrowth": _growth(q.get("eps"), ya.get("eps")),
                "marginChange": round(q["opmPct"] - ya["opmPct"], 2) if isinstance(q.get("opmPct"), (int, float)) and isinstance(ya.get("opmPct"), (int, float)) else None,
                "yearAgo": bool(ya),
                "comparisonSource": s.get("comparisonSource"),
                "unresolved": s.get("unresolved") or 0,
                "asOf": s.get("asOf"),
            })
        else:
            pending.append(sym)

    when = {r["symbol"]: r["date"] for r in scheduled if r.get("symbol")}
    today = date.today().isoformat()
    upcoming = sorted(
        ({"symbol": sym, "name": names.get(sym, sym), "date": when[sym]} for sym in pending if sym in when and when[sym] >= today),
        key=lambda r: r["date"],
    )
    met = [{"symbol": sym, "name": names.get(sym, sym), "date": when[sym]} for sym in pending if sym in when and when[sym] < today]

    comparable = [r for r in reported if r["revenueGrowth"] is not None and r["profitGrowth"] is not None]
    pairs = [(snapshots[r["symbol"]]["latestQuarter"], snapshots[r["symbol"]]["yearAgoQuarter"]) for r in comparable]
    agg = lambda key: (  # noqa: E731
        round((sum(q[key] for q, _ in pairs) / sum(y[key] for _, y in pairs) - 1) * 100, 1)
        if pairs and sum(y[key] for _, y in pairs) > 0 else None
    )
    return {
        "season": season,
        "quarter": (next(iter(reported), {}) or {}).get("quarter"),
        "covered": len(snapshots),
        "reported": sorted(reported, key=lambda r: -(r["netProfit"] or 0)),
        "summary": {
            "reported": len(reported),
            "comparable": len(comparable),
            "revenueUp": sum(1 for r in comparable if r["revenueGrowth"] > 0),
            "profitUp": sum(1 for r in comparable if r["profitGrowth"] > 0),
            "medianRevenueGrowth": round(median(r["revenueGrowth"] for r in comparable), 1) if comparable else None,
            "medianProfitGrowth": round(median(r["profitGrowth"] for r in comparable), 1) if comparable else None,
            # All reporters' quarter added up against the same companies a year before
            "aggregateRevenueGrowth": agg("revenue"),
            "aggregateProfitGrowth": agg("netProfit"),
        },
        "upcoming": upcoming[:60],
        "awaitingFigures": met,
        "notScheduled": len([sym for sym in pending if sym not in when]),
        "window": {"from": today, "to": (date.today() + timedelta(days=30)).isoformat()},
    }
