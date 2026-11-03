"""
Cross-source reconciliation for the company pages.

The same figure often reaches the site by two routes: the market cap in the
quote and in Yahoo's statistics, a P/E in the masthead and on the statistics
tab, ROE in the masthead and in the key-ratios panel. When the routes disagree
the reader sees two numbers for one fact, and has no way to know which is right.

This module fetches every company endpoint for a set of symbols from the
running data service and checks each figure against its other sources and
against arithmetic (P/E must equal price over EPS). It reports, it does not
repair: a mismatch is a bug in a provider or a label, fixed in code.

    python -m app.reconcile                 # the default large-cap sample
    python -m app.reconcile TCS INFY HDFCBANK
    ARTHDEX_API_URL=https://... python -m app.reconcile

Exit code 1 when any check fails, so it can gate a deploy.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from dataclasses import dataclass
from datetime import date
from typing import Any, Callable

DEFAULT_SYMBOLS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "ITC",
    "SBIN", "BHARTIARTL", "LT", "HINDUNILVR", "MARUTI", "SUNPHARMA",
]

PACE_SECONDS = float(os.environ.get("ARTHDEX_RECONCILE_PACE", "6"))

ENDPOINTS = {
    "quote": "quote",
    "valuation": "valuation",
    "candles": "candles?period=1Y",
    "financials": "financials",
    "statistics": "statistics?v=1",
    "analysts": "analysts?v=1",
    "sensitivity": "sensitivity",
    "shareholding": "shareholding",
    "technicals": "technicals?interval=1d",
    "statements": "statements?v=1",
    "peers": "peers",
    "forensics": "forensics",
}


@dataclass
class Result:
    symbol: str
    check: str
    status: str  # "pass" | "fail" | "skip" | "note" (a known difference in basis, labelled in the UI)
    detail: str


def _get(base: str, symbol: str, path: str) -> Any:
    req = urllib.request.Request(f"{base}/api/v1/company/{symbol}/{path}")
    token = os.environ.get("ARTHDEX_API_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=90) as res:
        return json.load(res).get("data")


def rel_diff(a: float, b: float) -> float:
    """Relative difference against the larger magnitude; 0 when both are 0."""
    scale = max(abs(a), abs(b))
    return 0.0 if scale == 0 else abs(a - b) / scale


def compare(name: str, a: Any, b: Any, tolerance: float, *, absolute: bool = False, unit: str = "") -> tuple[str, str]:
    """
    Compare two figures. Tolerance is relative unless `absolute` is set.
    A missing figure on either side is a skip, not a pass: it proves nothing.
    """
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return "skip", f"{name}: one side missing ({a!r} vs {b!r})"
    gap = abs(a - b) if absolute else rel_diff(a, b)
    shown = f"{gap:.3g}{unit}" if absolute else f"{gap * 100:.2f}%"
    status = "pass" if gap <= tolerance else "fail"
    return status, f"{name}: {a:g} vs {b:g} (gap {shown})"


def fiscal_quarter(period_end: str) -> str:
    """Indian fiscal quarter for a quarter-end date: 2026-09-30 is Q2 FY27."""
    d = date.fromisoformat(period_end[:10])
    q = {6: 1, 9: 2, 12: 3, 3: 4}.get(d.month)
    fy = d.year + 1 if d.month >= 4 else d.year
    return f"Q{q} FY{fy % 100:02d}" if q else "?"


def checks(d: dict[str, Any]) -> list[tuple[str, Callable[[], tuple[str, str]]]]:
    """Every reconciliation, as (name, thunk). Thunks read from the fetched payloads `d`."""
    q, v, c, f, s = d.get("quote") or {}, d.get("valuation") or {}, d.get("candles") or {}, d.get("financials") or {}, d.get("statistics") or {}
    a, sens, tech, sh = d.get("analysts") or {}, d.get("sensitivity") or {}, d.get("technicals") or {}, d.get("shareholding") or {}
    sv, sh_h, st, sd = s.get("valuation") or {}, s.get("highlights") or {}, s.get("trading") or {}, s.get("dividends") or {}
    candles = c.get("candles") or []
    ratios = f.get("ratios") or {}
    cmp = q.get("cmp")

    def last_close():
        return compare("last price vs last daily close", cmp, candles[-1]["close"] if candles else None, 0.005)

    def high52():
        return compare("52-week high, quote vs statistics", q.get("high52w"), st.get("high52w"), 0.01)

    def low52():
        return compare("52-week low, quote vs statistics", q.get("low52w"), st.get("low52w"), 0.01)

    def high52_candles():
        top = max((x["high"] for x in candles), default=None)
        return compare("52-week high vs highest daily high in a year", q.get("high52w"), top, 0.02)

    def mcap():
        return compare("market cap, quote vs statistics", q.get("marketCapCr"), sv.get("marketCap"), 0.01)

    def mcap_shares():
        shares = st.get("sharesOutstanding")
        implied = shares * cmp / 1e7 if shares and cmp else None
        return compare("market cap vs shares x price", q.get("marketCapCr"), implied, 0.03)

    def units_sane():
        # A statement left in another currency, or in lakh instead of crore, shows up
        # here first: Infosys in dollars read as rupees gave a price-to-sales of 228.
        rev = ratios.get("revenueCr")
        if not rev or not q.get("marketCapCr"):
            return "skip", "price to sales: missing revenue or market cap"
        ps = q["marketCapCr"] / rev
        return ("pass" if 0.05 <= ps <= 60 else "fail"), f"price to sales from filed revenue = {ps:.2f}"

    def pe_arith():
        eps = v.get("eps")
        return compare("P/E vs price / EPS", v.get("peRatio"), cmp / eps if cmp and eps and eps > 0 else None, 0.006, absolute=True)

    def pe_tabs():
        return compare("P/E, masthead vs statistics tab", v.get("peRatio"), sv.get("trailingPE"), 0.01)

    def pb_arith():
        bv = v.get("bookValue")
        return compare("P/B vs price / book value", v.get("pbRatio"), cmp / bv if cmp and bv and bv > 0 else None, 0.006, absolute=True)

    def eps_same():
        return compare("EPS, valuation vs statistics", v.get("eps"), sh_h.get("eps"), 0.001)

    def roe_same():
        return compare("ROE, masthead vs key ratios", v.get("roePct"), ratios.get("roePct"), 0.001)

    def yield_same():
        return compare("dividend yield, masthead vs statistics", v.get("dividendYieldPct"), sd.get("trailingYieldPct"), 0.05, absolute=True, unit="pp")

    def revenue_ttm():
        if not ratios.get("ttmComplete"):
            return "skip", "TTM revenue: quarterly run is gapped, key ratios use a fiscal year"
        return compare("TTM revenue, statements vs statistics", ratios.get("revenueCr"), sh_h.get("revenue"), 0.03)

    def profit_ttm():
        if not ratios.get("ttmComplete"):
            return "skip", "TTM profit: quarterly run is gapped"
        return compare("TTM net profit, statements vs statistics", ratios.get("netProfitCr"), sh_h.get("netIncome"), 0.03)

    def eps_reported():
        quarters = f.get("quarterly") or []
        hist = a.get("earningsHistory") or []
        if not quarters or not hist:
            return "skip", "quarter EPS: no history"
        latest_q, latest_h = quarters[-1], hist[-1]
        # Results are announced within ~60 days of quarter end; only compare the same quarter
        gap = (date.fromisoformat(latest_h["date"][:10]) - date.fromisoformat(latest_q["periodEnd"][:10])).days
        if not 0 <= gap <= 75:
            return "skip", f"quarter EPS: latest quarter {latest_q['periodEnd']} and latest report {latest_h['date']} differ"
        # Analysts' "actual" is adjusted for one-off items; filed EPS is not. Only compare clean quarters.
        income = ((d.get("statements") or {}).get("income") or {}).get("quarterly") or {}
        dates, rows = income.get("dates") or [], {r["label"]: r["values"] for r in income.get("rows") or []}
        if latest_q["periodEnd"] in dates and "Total Unusual Items" in rows:
            one_off = rows["Total Unusual Items"][dates.index(latest_q["periodEnd"])] or 0
            profit = latest_q.get("netProfit") or 0
            if profit and abs(one_off) > 0.02 * abs(profit):
                return "skip", f"quarter EPS: {latest_q['quarter']} includes one-off items of {one_off:g} Cr, so filed and adjusted EPS differ by design"
        status, detail = compare("latest quarter EPS, statements vs analysts' actual", latest_q.get("eps"), latest_h.get("actual"), 0.025)
        # Brokers estimate on their own basis (often standalone, or adjusted), so a gap here is a
        # labelling matter for the analysts tab rather than a wrong number. Reported as a note.
        return ("note" if status == "fail" else status), detail

    def quarter_labels():
        bad = [x for x in f.get("quarterly") or [] if x.get("quarter") != fiscal_quarter(x["periodEnd"])]
        if not f.get("quarterly"):
            return "skip", "quarter labels: no quarters"
        return ("fail", f"quarter labels: {bad[0]['quarter']} for {bad[0]['periodEnd']}") if bad else ("pass", "quarter labels match fiscal calendar")

    def quarter_fresh():
        # Listed companies must publish within 45 days of quarter end (60 for Q4). Past
        # 150 days, at least one filed quarter is missing from the source.
        quarters = f.get("quarterly") or []
        if not quarters:
            return "skip", "freshness: no quarters"
        age = (date.today() - date.fromisoformat(quarters[-1]["periodEnd"][:10])).days
        return ("pass" if age <= 150 else "fail"), f"latest quarter on file ends {quarters[-1]['periodEnd']} ({age} days ago)"

    def ma50():
        closes = [x["close"] for x in candles[-50:]]
        mean = sum(closes) / len(closes) if len(closes) == 50 else None
        return compare("50-day average, statistics vs computed from candles", st.get("ma50"), mean, 0.02)

    def tech_close():
        return compare("technicals last close vs last price", tech.get("lastClose"), cmp, 0.005)

    def analyst_price():
        return compare("analysts' current price vs last price", a.get("currentPrice"), cmp, 0.01)

    def beta_sane():
        rows = sens.get("rows") or []
        nifty = next((r for r in rows if "50" in str(r.get("benchmark") or r.get("id") or r.get("name")) and "next" not in str(r).lower()), rows[0] if rows else None)
        beta = nifty.get("beta") if nifty else None
        if beta is None:
            return "skip", "beta: no regression"
        return ("pass" if -0.5 <= beta <= 3 else "fail"), f"beta against the Nifty 50 = {beta:g}"

    def promoter_same():
        # Yahoo's "insiders" is a different definition (ITC counts BAT; HDFCBANK has no
        # promoter), so it is not compared. The pledge filing and the pattern filing must agree.
        pledge = sh.get("pledge") or {}
        cats = {x["key"]: x for x in (sh.get("analytics") or {}).get("categories") or []}
        if not pledge.get("promoterPct") or "promoters" not in cats:
            return "skip", "promoter holding: no promoter in filings"
        return compare("promoter holding, pledge filing vs shareholding pattern", pledge.get("promoterPct"), cats["promoters"].get("latest"), 0.5, absolute=True, unit="pp")

    def agree(name: str, report: dict | None, kind: str):
        def thunk():
            if not report:
                return "skip", f"{name}: no comparison available"
            if kind == "series":
                if not report.get("overlap"):
                    return "skip", f"{name}: sources share no period (used {report.get('used')})"
                open_ = report.get("unresolved", report.get("disagreements")) or []
                settled = [d for d in report.get("disagreements") or [] if d.get("settled")]
                # Periods more than two years old are often restated after mergers, and NSE's
                # pre-2025 results filings carry no balance sheet to settle them: noted, shown
                # on the panel, but not failed
                cutoff = date.fromordinal(date.today().toordinal() - 730).isoformat()
                bad = [d for d in open_ if d["period"] >= cutoff]
                old = [d for d in open_ if d["period"] < cutoff]
                if not bad and old:
                    o0 = old[0]
                    return "note", f"{name}: {len(old)} older line(s) differ with no filing to settle them, e.g. {o0['field']} {o0['period']}"
                if bad:
                    b0 = bad[0]
                    return "fail", f"{name}: {len(bad)} line(s) differ with no filing to settle them, e.g. {b0['field']} {b0['period']}: Yahoo {b0['yahoo']:g} vs screener.in {b0['screener']:g} ({b0['gapPct']}%)"
                extra = f"; {len(settled)} settled by the NSE filing" if settled else ""
                return "pass", f"{name}: {report['overlap']} shared period(s) checked; using {report.get('used')}{extra}"
            if report.get("agree") is None:
                return "skip", f"{name}: only one source answered"
            return ("pass" if report["agree"] else "fail"), f"{name}: {json.dumps({k: v for k, v in report.items() if k not in ('agree', 'nseError', 'yahooError')})}"
        return thunk

    def peers_self_row():
        # screener.in's peer figures are taken as current only if its row for this company agrees
        v = (d.get("peers") or {}).get("vetting") or {}
        if not v.get("checks"):
            return "skip", "peers: company not in its industry table"
        bad = [c for c in v["checks"] if not c["agree"]]
        return ("fail" if bad else "pass"), "peer table's own row: " + ", ".join(f"{c['field']} {c['gapPct']}%" for c in v["checks"])

    def forensics_inputs():
        # Quality scores are withheld when Yahoo's line items disagree with the vetted figures
        fx = d.get("forensics") or {}
        if not fx:
            return "skip", "forensics: not available"
        if fx.get("withheld"):
            return "fail", f"forensics withheld: {fx['withheld']}"
        if fx.get("lender"):
            return "skip", "forensics: lender, scores not computed"
        checks = (fx.get("vetting") or {}).get("checks") or []
        return "pass", f"forensics inputs: {sum(c['agree'] for c in checks)} of {len(checks)} headline lines agree with vetted figures"

    fin_sources = f.get("sources") or {}
    return [
        ("sources.quarterly_agree", agree("quarterly results, Yahoo vs screener.in", fin_sources.get("quarterly"), "series")),
        ("sources.annual_agree", agree("annual results, Yahoo vs screener.in", fin_sources.get("annual"), "series")),
        ("sources.balance_agree", agree("balance sheet, Yahoo vs screener.in", fin_sources.get("balanceSheet"), "series")),
        ("sources.quote_agree", agree("price, NSE vs Yahoo", q.get("sources"), "pair")),
        ("sources.closes_agree", agree("recent daily closes, Yahoo vs NSE", c.get("vetting"), "pair")),
        ("sources.promoter_agree", agree("promoter holding, screener.in vs NSE filing", sh.get("vetting"), "pair")),
        ("sources.peers_self_row", peers_self_row),
        ("sources.forensics_inputs", forensics_inputs),
        ("price.last_close", last_close),
        ("price.high52", high52),
        ("price.low52", low52),
        ("price.high52_candles", high52_candles),
        ("size.mcap", mcap),
        ("size.mcap_shares", mcap_shares),
        ("size.units_sane", units_sane),
        ("multiple.pe_arith", pe_arith),
        ("multiple.pe_tabs", pe_tabs),
        ("multiple.pb_arith", pb_arith),
        ("earnings.eps_same", eps_same),
        ("returns.roe_same", roe_same),
        ("dividend.yield_same", yield_same),
        ("statements.revenue_ttm", revenue_ttm),
        ("statements.profit_ttm", profit_ttm),
        ("statements.eps_reported", eps_reported),
        ("statements.quarter_labels", quarter_labels),
        ("statements.quarter_fresh", quarter_fresh),
        ("trading.ma50", ma50),
        ("trading.technicals_close", tech_close),
        ("trading.analyst_price", analyst_price),
        ("risk.beta_sane", beta_sane),
        ("ownership.promoter_same", promoter_same),
    ]


def reconcile(symbol: str, base: str) -> list[Result]:
    payloads: dict[str, Any] = {}
    out: list[Result] = []
    for name, path in ENDPOINTS.items():
        try:
            payloads[name] = _get(base, symbol, path)
        except Exception as exc:  # an endpoint failing is itself a finding
            out.append(Result(symbol, f"endpoint.{name}", "fail", f"{name} endpoint: {exc}"))
    for name, thunk in checks(payloads):
        try:
            status, detail = thunk()
        except Exception as exc:
            status, detail = "fail", f"check raised {type(exc).__name__}: {exc}"
        out.append(Result(symbol, name, status, detail))
    return out


def reconcile_market(base: str) -> list[Result]:
    """Index levels from NSE (as served) against Yahoo's symbols for the same indices."""
    from .providers import yahoo

    req = urllib.request.Request(f"{base}/api/v1/market/indices")
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            served = {r["id"]: r for r in json.load(res).get("data") or []}
        backup = {r["id"]: r for r in yahoo.fetch_nse_index_levels([(k, v["name"], v["family"]) for k, v in served.items()])}
    except Exception as exc:
        return [Result("MARKET", "sources.index_levels", "fail", f"index comparison failed: {exc}")]
    out = []
    for key, row in served.items():
        if key not in backup:
            out.append(Result("MARKET", f"sources.index.{key}", "skip", f"{key}: no Yahoo level"))
            continue
        # India VIX ticks between the two reads; indices move little within seconds
        tol = 0.01 if key == "india-vix" else 0.002
        status, detail = compare(f"{row['name']} level, served vs Yahoo", row["level"], backup[key]["level"], tol)
        out.append(Result("MARKET", f"sources.index.{key}", status, detail))
    out += _reconcile_flows(base)
    # The home page's Nifty chart must end on the session the ticker shows
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{base}/api/v1/company/%5ENSEI/candles?period=1Y"), timeout=90) as res:
            last = (json.load(res).get("data") or {}).get("candles", [])[-1]
        status, detail = compare("Nifty 50 chart's last close vs NSE level", last.get("close"), (served.get("nifty-50") or {}).get("level"), 0.002)
        out.append(Result("MARKET", "index.chart_current", status, f"{detail}, chart ends {last.get('date')}"))
    except Exception as exc:
        out.append(Result("MARKET", "index.chart_current", "fail", f"index chart: {exc}"))
    return out


def _reconcile_flows(base: str) -> list[Result]:
    """Institutional flows: recorded cleanly, recent, and foreign flows pointing the same way on NSE and NSDL."""
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{base}/api/v1/market/flows"), timeout=90) as res:
            data = json.load(res).get("data") or {}
    except Exception as exc:
        return [Result("MARKET", "flows.available", "fail", f"flows endpoint: {exc}")]
    latest = data.get("latest") or {}
    out = []
    problems = latest.get("problems") or []
    out.append(Result("MARKET", "flows.vetted", "fail" if problems else "pass", "; ".join(problems) or f"{latest.get('date')} reconciles"))
    age = (date.today() - date.fromisoformat(latest["date"])).days if latest.get("date") else None
    # Weekends and holidays: up to four calendar days without a new trading day is normal
    out.append(Result("MARKET", "flows.fresh", "pass" if age is not None and age <= 4 else "fail", f"latest trade date {latest.get('date')} ({age} days ago)"))
    checks = data.get("directionCheck") or []
    bad = [c for c in checks if not c["agree"]]
    if not checks:
        out.append(Result("MARKET", "flows.direction", "skip", "no NSDL report paired with an NSE trade date yet"))
    else:
        out.append(Result("MARKET", "flows.direction", "fail" if bad else "pass",
                          f"{len(checks) - len(bad)} of {len(checks)} days agree" + (f"; e.g. {bad[0]['tradeDate']}: NSE {bad[0]['nseFii']:g} vs NSDL {bad[0]['nsdlFpi']:g}" if bad else "")))
    return out


def main(argv: list[str]) -> int:
    base = os.environ.get("ARTHDEX_API_URL", "http://127.0.0.1:8000").rstrip("/")
    symbols = [a.upper() for a in argv] or DEFAULT_SYMBOLS
    results: list[Result] = reconcile_market(base)
    market_fails = [r for r in results if r.status == "fail"]
    print(f"{'MARKET':<12} {sum(r.status == 'pass' for r in results):>2} pass  {len(market_fails):>2} fail")
    for r in market_fails:
        print(f"    FAIL {r.check:<32} {r.detail}")
    for i, sym in enumerate(symbols):
        if i:
            # Each symbol costs a dozen upstream calls; back-to-back runs got this machine
            # rate-limited by Yahoo and NSE on 2026-11-03
            time.sleep(PACE_SECONDS)
        rows = reconcile(sym, base)
        results.extend(rows)
        fails = [r for r in rows if r.status == "fail"]
        notes = [r for r in rows if r.status == "note"]
        print(f"{sym:<12} {sum(r.status == 'pass' for r in rows):>2} pass  {len(fails):>2} fail  {sum(r.status == 'skip' for r in rows):>2} skip  {len(notes):>2} note")
        for r in fails:
            print(f"    FAIL {r.check:<32} {r.detail}")
        for r in notes:
            print(f"    note {r.check:<32} {r.detail}")
    total_fail = sum(r.status == "fail" for r in results)
    by_check: dict[str, int] = {}
    for r in results:
        if r.status == "fail":
            by_check[r.check] = by_check.get(r.check, 0) + 1
    if by_check:
        print("\nFailures by check: " + ", ".join(f"{k} x{n}" for k, n in sorted(by_check.items(), key=lambda kv: -kv[1])))
    print(f"\n{len(symbols)} symbols, {len(results)} checks, {total_fail} failing")
    return 1 if total_fail else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
