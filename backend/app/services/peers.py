"""
Peers and valuation against the company's own history.

Peers come from screener.in's finest classification (its "Industry" level), the
largest companies in it by market cap plus the company itself. Their figures are a
single source, so the table is vetted through the company's own row: its price,
market cap and P/E must agree with Arthdex's vetted quote and valuation, or the
table is marked unvetted.

The valuation band is the P/E at each week of the last five years, on the latest
full-year EPS that had been published by that week (results are out within 60 days
of the year end), so no week uses earnings that were not yet known.
"""

from __future__ import annotations

from datetime import date, timedelta
from statistics import median
from typing import Any

from ..cache import CACHE
from ..providers import screener, yahoo

PEER_LIMIT = 12
METRICS = ("pe", "marketCapCr", "dividendYieldPct", "rocePct", "salesGrowthQtrPct", "profitGrowthQtrPct")
# Screener's price is its last update, so it can trail a live quote during the session
TOLERANCE = {"price": 0.03, "marketCapCr": 0.04, "pe": 0.08}
PUBLICATION_LAG = timedelta(days=60)


def _gap(a: float | None, b: float | None) -> float | None:
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)) or max(abs(a), abs(b)) == 0:
        return None
    return abs(a - b) / max(abs(a), abs(b))


def _tidy(name: str) -> str:
    """Some master-file names are in capitals ("SIGMA ADVANCED SYSTEMS LIMITED")."""
    if name != name.upper():
        return name
    keep = {"(INDIA)": "(India)", "OF": "of", "AND": "and", "&": "&"}
    return " ".join(keep.get(w, w if len(w) <= 3 and w.isalpha() and w not in {"LTD", "THE"} else w.capitalize()) for w in name.split())


def peers(symbol: str, quote: dict[str, Any] | None, valuation: dict[str, Any] | None) -> dict[str, Any]:
    sym = symbol.upper()
    company = screener.fetch_company(sym)
    cls = company.get("classification")
    if not cls:
        raise ValueError(f"No industry classification for {sym}")
    rows, _ = CACHE.get_or_fetch(f"screener:industry:{cls['industryPath']}", 12 * 3600, lambda: screener.fetch_industry(cls["industryPath"]))
    ranked = sorted((r for r in rows if r.get("marketCapCr")), key=lambda r: -r["marketCapCr"])
    # screener.in abbreviates names ("Hind.Aeronautics"); the exchange's master has them in full
    try:
        from ..providers import universe

        master, _ = CACHE.get_or_fetch("universe:equity", 24 * 3600, universe.fetch_equity_universe)
        names = {u["symbol"]: _tidy(u["name"]) for u in master}
        ranked = [{**r, "name": names.get(r["symbol"], r["name"])} for r in ranked]
    except Exception:
        pass
    table = ranked[:PEER_LIMIT]
    self_row = next((r for r in ranked if r["symbol"] == sym), None)
    if self_row and self_row not in table:
        table.append(self_row)

    # Vet the source through the one row Arthdex can check independently
    checks = []
    if self_row:
        for field, ours in (("price", (quote or {}).get("cmp")), ("marketCapCr", (quote or {}).get("marketCapCr")), ("pe", (valuation or {}).get("peRatio"))):
            gap = _gap(self_row.get(field), ours)
            if gap is not None:
                checks.append({"field": field, "screener": self_row.get(field), "arthdex": ours, "gapPct": round(gap * 100, 2), "agree": gap <= TOLERANCE[field]})
    vetted = bool(checks) and all(c["agree"] for c in checks)

    medians = {}
    for m in METRICS:
        values = [r[m] for r in table if isinstance(r.get(m), (int, float)) and r["symbol"] != sym]
        medians[m] = round(median(values), 2) if values else None
    ranks = {}
    for m in METRICS:
        values = sorted((r[m] for r in table if isinstance(r.get(m), (int, float))), reverse=True)
        if self_row and isinstance(self_row.get(m), (int, float)):
            ranks[m] = {"position": values.index(self_row[m]) + 1, "of": len(values)}
    return {
        "classification": cls,
        "industrySize": len(rows),
        "peers": table,
        "self": self_row,
        "medians": medians,
        "ranks": ranks,
        "vetting": {"checks": checks, "vetted": vetted},
    }


def _percentile(sorted_values: list[float], value: float) -> float:
    below = sum(1 for v in sorted_values if v < value)
    return round(below / len(sorted_values) * 100, 1)


def pe_band(symbol: str, live_price: float | None) -> dict[str, Any]:
    sym = symbol.upper()
    annual = [r for r in screener.fetch_company(sym).get("annual") or [] if isinstance(r.get("eps"), (int, float))]
    if not annual:
        raise ValueError(f"No annual EPS for {sym}")
    frame = yahoo.fetch_history(sym, "5Y")
    if frame is None or frame.empty:
        raise ValueError(f"No price history for {sym}")
    known = sorted((date.fromisoformat(r["periodEnd"]) + PUBLICATION_LAG, r["eps"], r["period"]) for r in annual)

    points = []
    for ts, row in frame.iterrows():
        day = ts.date()
        eps = next((k for k in reversed(known) if k[0] <= day), None)
        close = float(row["Close"])
        if eps is None or eps[1] <= 0 or close != close:
            continue
        points.append({"date": day.isoformat(), "pe": round(close / eps[1], 2), "epsYear": eps[2]})
    if len(points) < 20:
        raise ValueError(f"Too little history with positive earnings to draw a band for {sym}")

    values = sorted(p["pe"] for p in points)
    q = lambda f: values[min(len(values) - 1, int(f * (len(values) - 1)))]
    latest_eps = known[-1] if known[-1][0] <= date.today() else next((k for k in reversed(known) if k[0] <= date.today()), None)
    current = round(live_price / latest_eps[1], 2) if live_price and latest_eps and latest_eps[1] > 0 else points[-1]["pe"]
    return {
        "basis": "Price over the latest full-year EPS published by each date (60 days after the year end)",
        "epsYear": latest_eps[2] if latest_eps else None,
        "points": points,
        "stats": {"min": values[0], "p25": q(0.25), "median": q(0.5), "p75": q(0.75), "max": values[-1]},
        "current": current,
        "percentile": _percentile(values, current),
        "since": points[0]["date"],
    }
