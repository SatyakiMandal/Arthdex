"""
Choosing between two sources of a company's financials, and saying why.

Yahoo is the primary source for quarterly results, annual results and balance
sheets; screener.in is the second, independent source. For each series both
are fetched, compared period by period where they overlap, and one is chosen:

    1. A source must be current (its newest period recent enough to be the
       latest filing) and, for quarters, unbroken over the last four.
    2. Of the sources that pass, Yahoo wins ties, so a company's tables do not
       switch source from day to day for no reason.
    3. If neither passes, the one with the newer latest period wins.

A whole series always comes from one source: mixing sources across columns
would mix their definitions (Screener's net profit includes minority interest,
Yahoo's does not).

Overlapping periods are compared on the lines both define the same way. The sources
often define a line differently (gross or net revenue, profit with or without
minority interest), so vetting looks for consistency rather than equality: a
steady ratio across periods is a definition, recorded in `basis`; a period that
breaks the pattern, or a ratio too far from 1:1 to be a definition, is reported
in `disagreements`, which the reconciliation turns into a watchdog incident.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Callable

# How far one period may stray from the two sources' usual relationship before it is
# treated as an error in one of them, rather than a difference in definition.
TOLERANCES = {
    # EPS is per owner's share on both sides; net profit is not compared because
    # screener.in's includes minority interest, a share that moves quarter to quarter.
    "quarterly": {"revenue": 0.02, "eps": 0.03},
    "annual": {"revenue": 0.02, "eps": 0.03},
    "balanceSheet": {"netWorth": 0.02, "totalAssets": 0.03, "borrowings": 0.15},
}
# Every period on screen is vetted. Older periods are sometimes restated after mergers
# and demergers (HDFCBANK 2023, ITC Hotels 2025); where that makes the sources disagree,
# the original NSE filing settles it.
RECENT = {"quarterly": 8, "annual": 4, "balanceSheet": 4}
# How far the usual relationship itself may sit from 1:1 and still be a definition.
# Revenue: gross or net of excise, bullion, other operating income (ITC, Titan: up to 7%).
# Net profit: screener.in includes minority interest (Bharti: up to a third).
# Past these limits the gap is a units or mapping error (Infosys in dollars: 99%).
DEFINITION_LIMITS = {
    "revenue": 0.15, "netProfit": 0.35, "eps": 0.10,
    "netWorth": 0.10, "totalAssets": 0.10, "borrowings": 0.50,
}
# Figures this small (rupees crore) are compared only by eye: rounding dominates
FLOORS = {"revenue": 100, "netProfit": 50, "netWorth": 100, "totalAssets": 100, "borrowings": 100, "eps": 0}
# A consistent relationship needs at least this many shared periods to be recognised
MIN_PAIRS_FOR_BASIS = 3

# Newest period older than this is not the latest filing. Quarters must be out within
# 45 to 60 days; annual reports and year-end balance sheets within about two months.
MAX_AGE_DAYS = {"quarterly": 150, "annual": 450, "balanceSheet": 450}


def _age(rows: list[dict[str, Any]], today: date) -> int | None:
    if not rows:
        return None
    return (today - date.fromisoformat(rows[-1]["periodEnd"][:10])).days


def _unbroken(rows: list[dict[str, Any]], count: int = 4) -> bool:
    if len(rows) < count:
        return False
    ends = [date.fromisoformat(r["periodEnd"][:10]) for r in rows[-count:]]
    return all(80 <= (b - a).days <= 100 for a, b in zip(ends, ends[1:]))


def _passes(kind: str, rows: list[dict[str, Any]], today: date) -> tuple[bool, str]:
    age = _age(rows, today)
    if age is None:
        return False, "no periods"
    if age > MAX_AGE_DAYS[kind]:
        return False, f"newest period ended {rows[-1]['periodEnd']}, {age} days ago"
    if kind == "quarterly" and not _unbroken(rows):
        return False, "series is missing a quarter from the last four"
    return True, "current"


def disagreements(kind: str, a: list[dict[str, Any]], b: list[dict[str, Any]]) -> tuple[int, list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Compare overlapping periods field by field.

    For each field, the median Yahoo/screener.in ratio is the two sources' usual
    relationship. If it is within tolerance of 1:1 they define the field alike; if
    not, and at least three periods share it, the offset is a difference in
    definition (recorded in `basis`, not failed) unless it is implausibly large.
    Any single period that strays from the usual relationship is a disagreement.
    """
    by_end = {r["periodEnd"][:10]: r for r in b}
    shared = [(row, by_end[row["periodEnd"][:10]]) for row in a if row["periodEnd"][:10] in by_end][-RECENT[kind]:]
    lender = any(r.get("lender") for _, r in shared)
    found: list[dict[str, Any]] = []
    basis: list[dict[str, Any]] = []
    for field, tol in TOLERANCES[kind].items():
        if field == "revenue" and lender:
            # Gross interest earned against net interest income: no stable relationship to test
            continue
        pairs = []
        for x_row, y_row in shared:
            x, y = x_row.get(field), y_row.get(field)
            if not isinstance(x, (int, float)) or not isinstance(y, (int, float)) or y == 0 or x == 0:
                continue
            if max(abs(x), abs(y)) < FLOORS.get(field, 0) or (x > 0) != (y > 0):
                continue
            pairs.append((x_row["periodEnd"][:10], x, y))
        if not pairs:
            continue
        ratios = sorted(x / y for _, x, y in pairs)
        median = ratios[len(ratios) // 2] if len(ratios) % 2 else (ratios[len(ratios) // 2 - 1] + ratios[len(ratios) // 2]) / 2
        limit = DEFINITION_LIMITS[field]
        offset = abs(median - 1)
        if offset > limit and not any(abs(x / y - 1) <= tol for _, x, y in pairs):
            # Too far apart to be a definition, in every period: one side is in the wrong
            # units or mapped wrongly
            for period, x, y in pairs:
                found.append({"period": period, "field": field, "yahoo": x, "screener": y, "gapPct": round(abs(x - y) / max(abs(x), abs(y)) * 100, 2), "why": "levels too far apart to be a difference in definition"})
            continue
        if offset > limit:
            # Some periods agree 1:1 and others are far off: judge each against 1:1
            offset = 0.0
        if offset > tol:
            # A steady offset within the definition limit: a difference in definition. With
            # fewer than three shared periods there is no pattern to test single periods against.
            confirmed = len(pairs) >= MIN_PAIRS_FOR_BASIS
            basis.append({"field": field, "medianRatio": round(median, 4), "periods": len(pairs), "confirmed": confirmed})
            if not confirmed:
                continue
        baseline = median if offset > tol else 1.0
        for period, x, y in pairs:
            dev = abs((x / y) / baseline - 1)
            if dev > tol:
                found.append({"period": period, "field": field, "yahoo": x, "screener": y, "gapPct": round(abs(x - y) / max(abs(x), abs(y)) * 100, 2), "why": f"{dev * 100:.1f}% off the sources' usual relationship"})
    return len(shared), found, basis


# The section of a parsed filing (providers.nse_xbrl) that each series is checked against
FILING_SECTION = {"quarterly": "quarter", "annual": "year", "balanceSheet": "balance"}
# Share splits and bonus issues restate EPS by a whole factor; the filing keeps the original
SPLIT_FACTORS = (2, 3, 4, 5, 10)


def _matches(field: str, tol: float, source: Any, filed: Any) -> str | None:
    """'match', 'restated' (EPS off by a split factor) or None."""
    if not isinstance(source, (int, float)) or not isinstance(filed, (int, float)) or filed == 0:
        return None
    if abs(source - filed) / max(abs(source), abs(filed)) <= tol:
        return "match"
    if field == "eps" and source:
        ratio = filed / source
        if any(abs(ratio - k) / k <= 0.02 or abs(1 / ratio - k) / k <= 0.02 for k in SPLIT_FACTORS):
            return "restated"
    return None


def settle(kind: str, rows: list[dict[str, Any]], used: str, found: list[dict[str, Any]], filing_for: Callable[[str], dict[str, Any] | None]) -> list[dict[str, Any]]:
    """
    Check each disagreement against the company's own filing with the exchange.

    The source that matches the filing is right. Where the series on screen is the one
    that is wrong, the filed figure replaces it and the row records the correction.
    Disagreements with no filing to check stay open and are returned unresolved.
    """
    unresolved = []
    by_end = {r["periodEnd"][:10]: r for r in rows}
    for d in found:
        try:
            filing = filing_for(d["period"])
        except Exception:
            filing = None
        filed = ((filing or {}).get(FILING_SECTION[kind]) or {}).get(d["field"])
        if filed is None:
            d["settled"] = None
            unresolved.append(d)
            continue
        tol = TOLERANCES[kind][d["field"]]
        y, s_ = _matches(d["field"], tol, d["yahoo"], filed), _matches(d["field"], tol, d["screener"], filed)
        # An exact match beats a split-adjusted one; a source matching only after a split
        # adjustment is still the right one (HDFCBANK FY23 EPS: filed 82.64 before its 1:1
        # bonus, screener.in 41.22, Yahoo 44.51)
        if y == "match" or (y == "restated" and s_ not in ("match", "restated")):
            verdict = "yahoo"
        elif s_ == "match" or (s_ == "restated" and y != "restated"):
            verdict = "screener"
        elif y == s_ == "restated":
            verdict = "restated"
        else:
            verdict = "neither"
        restated = (y if verdict == "yahoo" else s_ if verdict == "screener" else None) == "restated"
        d["settled"] = {"by": "NSE XBRL filing", "filed": filed, "correct": verdict, "restated": restated, "url": (filing or {}).get("url")}
        if verdict == "neither" and d["field"] == "eps":
            # A per-share figure matching neither source, even after a split factor, is not
            # safe to show in place of either: leave it open
            unresolved.append(d)
            continue
        row = by_end.get(d["period"])
        if row is not None and verdict not in (used, "restated"):
            shown = d[verdict] if restated else filed
            row[d["field"]] = shown
            row.setdefault("corrected", {})[d["field"]] = {"from": d[used] if used in ("yahoo", "screener") else None, "to": shown, "by": "NSE XBRL filing"}
    return unresolved


def choose(
    kind: str,
    yahoo: list[dict[str, Any]],
    screener: list[dict[str, Any]],
    today: date | None = None,
    filing_for: Callable[[str], dict[str, Any] | None] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """The series to show, and a report of how it was chosen."""
    today = today or date.today()
    y_ok, y_why = _passes(kind, yahoo, today)
    s_ok, s_why = _passes(kind, screener, today)
    converted = any(r.get("convertedFrom") for r in yahoo)
    if y_ok and s_ok and converted:
        # Yahoo's figures were converted from another currency; the company's own rupee
        # filings beat any conversion
        used, reason = "screener", f"Yahoo's figures are converted from {yahoo[-1]['convertedFrom']}; screener.in has the company's rupee filings"
    elif y_ok:
        used, reason = "yahoo", "Yahoo is current"
    elif s_ok:
        used, reason = "screener", f"Yahoo's {y_why}, so it failed vetting; screener.in is current"
    elif yahoo or screener:
        newer_screener = bool(screener) and (not yahoo or screener[-1]["periodEnd"] > yahoo[-1]["periodEnd"])
        used = "screener" if newer_screener else "yahoo"
        reason = f"Neither source is current (Yahoo: {y_why}; screener.in: {s_why}); using the newer"
    else:
        used, reason = "none", "Neither source has data"
    overlap, found, basis = disagreements(kind, yahoo, screener)
    report = {
        "used": used,
        "reason": reason,
        "yahooLatest": yahoo[-1]["periodEnd"] if yahoo else None,
        "screenerLatest": screener[-1]["periodEnd"] if screener else None,
        "overlap": overlap,
        "disagreements": found,
        # Fields the two sources define differently, by a steady ratio: not errors, but the
        # reason a table can change when the source does
        "basis": basis,
    }
    rows = [dict(r) for r in (screener if used == "screener" else yahoo)]
    if found and filing_for is not None:
        report["unresolved"] = settle(kind, rows, used, found, filing_for)
    else:
        report["unresolved"] = list(found)
    return rows, report
