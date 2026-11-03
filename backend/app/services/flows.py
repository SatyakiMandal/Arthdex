"""
Institutional cash-market flows: what foreign and domestic institutions bought and sold.

Two measures, kept side by side and never merged:

  NSE provisional (series `flows:nse`), by trade date, FII/FPI and DII, all exchanges.
  NSDL custodial  (series `flows:nsdl`), FPI only, reported a trading day later.

NSE publishes only the latest day, so the history here is what the scheduler has
recorded since it started (app/jobs.py). Each record is vetted before it is stored:
buy minus sell must equal the stated net, values must be plausible, and once both
measures exist for the same trades, foreign flows must agree in direction or be small.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from ..providers import nse, nsdl
from ..store import STORE, Store

NSE_SERIES, NSDL_SERIES = "flows:nse", "flows:nsdl"
# A single day's net beyond this (rupees crore) has never happened and means a parse error
PLAUSIBLE_NET = 60_000
# Below this the two measures can point opposite ways through timing alone
SMALL_NET = 1_500


def _check_row(label: str, row: dict[str, Any] | None) -> list[str]:
    if not row:
        return [f"{label}: missing"]
    problems = []
    buy, sell, net = row.get("buy"), row.get("sell"), row.get("net")
    if None in (buy, sell, net):
        return [f"{label}: incomplete"]
    if buy < 0 or sell < 0:
        problems.append(f"{label}: negative gross value")
    if abs((buy - sell) - net) > 1:
        problems.append(f"{label}: buy {buy:g} minus sell {sell:g} is not the stated net {net:g}")
    if abs(net) > PLAUSIBLE_NET:
        problems.append(f"{label}: net {net:g} crore is implausible for one day")
    return problems


def vet_nse(payload: dict[str, Any]) -> list[str]:
    problems = []
    for basis in ("allExchanges", "nseOnly"):
        for who in ("fii", "dii"):
            if basis == "nseOnly" and not payload.get(basis):
                continue
            problems += _check_row(f"{basis}.{who}", (payload.get(basis) or {}).get(who))
    return problems


def record(store: Store = STORE) -> dict[str, Any]:
    """Fetch both measures and store them. Vetting problems are stored with the record and returned."""
    out: dict[str, Any] = {}
    flows = nse.fetch_institutional_flows()
    problems = vet_nse(flows)
    store.put(NSE_SERIES, flows["date"], {**flows, "problems": problems}, source="NSE provisional (fiidiiTradeReact)")
    out["nse"] = {"date": flows["date"], "problems": problems}
    try:
        fpi = nsdl.fetch_latest()
        fpi_problems = _check_row("nsdl.equity.stockExchange", fpi["equity"]["stockExchange"])
        store.put(NSDL_SERIES, fpi["reportedOn"], {**fpi, "problems": fpi_problems}, source="NSDL FPI daily trends")
        out["nsdl"] = {"reportedOn": fpi["reportedOn"], "problems": fpi_problems}
    except Exception as exc:  # NSDL is the secondary measure; its failure does not void NSE's
        out["nsdl"] = {"error": f"{type(exc).__name__}: {exc}"}
    return out


def _direction_check(nse_rows: list[dict[str, Any]], nsdl_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Pair each NSDL report with the trade date it covers (the last NSE trade date before the
    report) and compare foreign flows' direction. Opposite signs on a large day are flagged.
    """
    trades = sorted(nse_rows, key=lambda r: r["asOf"])
    pairs = []
    for report in sorted(nsdl_rows, key=lambda r: r["asOf"]):
        covered = [t for t in trades if t["asOf"] < report["asOf"]]
        if not covered:
            continue
        row = covered[-1]
        a = (row["value"].get("allExchanges") or {}).get("fii", {}).get("net")
        b = ((report["value"].get("equity") or {}).get("stockExchange") or {}).get("net")
        if a is None or b is None:
            continue
        agree = (a >= 0) == (b >= 0) or max(abs(a), abs(b)) < SMALL_NET
        pairs.append({"tradeDate": row["asOf"], "nseFii": a, "nsdlReportedOn": report["asOf"], "nsdlFpi": b, "agree": agree})
    return pairs


def _streak(values: list[float]) -> int:
    """Consecutive days, ending today, with the same sign as today (positive = buying days)."""
    if not values:
        return 0
    sign = values[-1] >= 0
    n = 0
    for v in reversed(values):
        if (v >= 0) != sign:
            break
        n += 1
    return n if sign else -n


def summary(days: int = 90, store: Store = STORE) -> dict[str, Any]:
    since = (date.today() - timedelta(days=days)).isoformat()
    nse_rows = store.history(NSE_SERIES, since=since)
    nsdl_rows = store.history(NSDL_SERIES, since=since)
    series = [
        {"date": r["asOf"], "fii": (r["value"]["allExchanges"]["fii"] or {}).get("net"), "dii": (r["value"]["allExchanges"]["dii"] or {}).get("net")}
        for r in nse_rows
    ]
    fii = [s["fii"] for s in series if s["fii"] is not None]
    dii = [s["dii"] for s in series if s["dii"] is not None]
    latest = nse_rows[-1]["value"] if nse_rows else None
    month = date.today().strftime("%Y-%m")
    return {
        "latest": latest,
        "latestNsdl": nsdl_rows[-1]["value"] if nsdl_rows else None,
        "series": series,
        "totals": {
            "fii5d": round(sum(fii[-5:]), 2) if len(fii) >= 5 else None,
            "dii5d": round(sum(dii[-5:]), 2) if len(dii) >= 5 else None,
            "fii20d": round(sum(fii[-20:]), 2) if len(fii) >= 20 else None,
            "dii20d": round(sum(dii[-20:]), 2) if len(dii) >= 20 else None,
            "fiiMonth": round(sum(s["fii"] for s in series if s["date"].startswith(month) and s["fii"] is not None), 2),
            "diiMonth": round(sum(s["dii"] for s in series if s["date"].startswith(month) and s["dii"] is not None), 2),
        },
        "streak": {"fii": _streak(fii), "dii": _streak(dii)},
        "historyStarts": series[0]["date"] if series else None,
        "days": len(series),
        "directionCheck": _direction_check(nse_rows, nsdl_rows),
    }
