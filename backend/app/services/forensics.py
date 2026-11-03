"""
Quality and forensic checks, and the inputs for a reverse DCF.

Piotroski F-score (nine signals of improving fundamentals), Altman Z-score (distress,
original model for listed manufacturers), Beneish M-score (eight-variable earnings
manipulation screen), cash conversion, and the free cash flow, net debt and growth
history a reverse DCF needs. Every input is returned beside the score.

The full line items come from Yahoo's statements alone, so they are checked first:
Yahoo's revenue, net income and total assets for each year used must agree with the
vetted financials (Yahoo against screener.in, settled by NSE filings). If they do not,
the scores are withheld and the reason given, rather than computed from figures that
are known to be off.

Lenders (banks, NBFCs) have no working capital, gross margin or receivables in this
sense; their scores are not computed and the page says why.
"""

from __future__ import annotations

from typing import Any

# How far Yahoo's headline lines may sit from the vetted figures for the same year
VET_TOLERANCE = {"revenue": 0.03, "totalAssets": 0.03, "netIncome": 0.06}


class Lines:
    """Annual statement lines by label and year index (0 = latest)."""

    def __init__(self, statements: dict[str, Any]):
        self.dates: list[str] = []
        self.rows: dict[str, list[float | None]] = {}
        for kind in ("income", "balance", "cashflow"):
            frame = (statements.get(kind) or {}).get("annual") or {}
            dates = frame.get("dates") or []
            if kind == "income":
                self.dates = dates
            for row in frame.get("rows") or []:
                # Align every statement on the income statement's years
                by_date = dict(zip(dates, row["values"]))
                self.rows.setdefault(row["label"], [by_date.get(d) for d in self.dates] if self.dates else row["values"])

    def get(self, label: str, i: int) -> float | None:
        values = self.rows.get(label)
        if not values or i >= len(values):
            return None
        v = values[i]
        return None if v is None else float(v)

    def first(self, labels: tuple[str, ...], i: int) -> float | None:
        for label in labels:
            v = self.get(label, i)
            if v is not None:
                return v
        return None


def _div(a: float | None, b: float | None) -> float | None:
    return None if a is None or b in (None, 0) else a / b


def piotroski(l: Lines) -> dict[str, Any]:
    ni = [l.first(("Net Income", "Net Income Common Stockholders"), i) for i in range(3)]
    ta = [l.get("Total Assets", i) for i in range(3)]
    cfo = l.get("Operating Cash Flow", 0)
    ltd = [l.first(("Long Term Debt And Capital Lease Obligation", "Long Term Debt"), i) or 0.0 for i in range(2)]
    ca = [l.get("Current Assets", i) for i in range(2)]
    cl = [l.get("Current Liabilities", i) for i in range(2)]
    shares = [l.first(("Ordinary Shares Number", "Share Issued"), i) for i in range(2)]
    rev = [l.get("Total Revenue", i) for i in range(3)]
    gp = [l.get("Gross Profit", i) for i in range(2)]

    roa = [_div(ni[0], ta[1]), _div(ni[1], ta[2])]
    signals = [
        ("Return on assets is positive", None if roa[0] is None else roa[0] > 0, roa[0]),
        ("Operating cash flow is positive", None if cfo is None else cfo > 0, cfo),
        ("Return on assets improved", None if None in roa else roa[0] > roa[1], roa),
        ("Cash flow exceeds profit (earnings backed by cash)", None if None in (cfo, ni[0]) else cfo > ni[0], [cfo, ni[0]]),
        ("Long-term leverage fell", None if None in (ta[0], ta[1]) else ltd[0] / ta[0] < ltd[1] / ta[1], [_div(ltd[0], ta[0]), _div(ltd[1], ta[1])]),
        ("Current ratio improved", None if None in (*ca, *cl) else ca[0] / cl[0] > ca[1] / cl[1], [_div(ca[0], cl[0]), _div(ca[1], cl[1])]),
        ("No new shares issued", None if None in shares else shares[0] <= shares[1] * 1.001, shares),
        ("Gross margin improved", None if None in (*gp, rev[0], rev[1]) else gp[0] / rev[0] > gp[1] / rev[1], [_div(gp[0], rev[0]), _div(gp[1], rev[1])]),
        ("Asset turnover improved", None if None in (rev[0], rev[1], ta[1], ta[2]) else rev[0] / ta[1] > rev[1] / ta[2], [_div(rev[0], ta[1]), _div(rev[1], ta[2])]),
    ]
    scored = [s for s in signals if s[1] is not None]
    return {
        "score": sum(1 for s in scored if s[1]),
        "of": len(scored),
        "signals": [{"test": t, "pass": p, "values": v} for t, p, v in signals],
        "reading": "strong (8–9)" if len(scored) == 9 and sum(1 for s in scored if s[1]) >= 8 else None,
    }


def altman(l: Lines, market_cap_cr: float | None) -> dict[str, Any] | None:
    ta = l.get("Total Assets", 0)
    wc = l.get("Working Capital", 0)
    if wc is None and l.get("Current Assets", 0) is not None and l.get("Current Liabilities", 0) is not None:
        wc = l.get("Current Assets", 0) - l.get("Current Liabilities", 0)
    re_ = l.get("Retained Earnings", 0)
    ebit = l.first(("EBIT", "Operating Income"), 0)
    tl = l.get("Total Liabilities Net Minority Interest", 0)
    sales = l.get("Total Revenue", 0)
    if None in (ta, wc, re_, ebit, tl, sales, market_cap_cr) or not ta or not tl:
        return None
    x = {"workingCapital": wc / ta, "retainedEarnings": re_ / ta, "ebit": ebit / ta, "marketValueToLiabilities": market_cap_cr / tl, "sales": sales / ta}
    z = 1.2 * x["workingCapital"] + 1.4 * x["retainedEarnings"] + 3.3 * x["ebit"] + 0.6 * x["marketValueToLiabilities"] + 1.0 * x["sales"]
    zone = "safe" if z > 2.99 else "grey" if z >= 1.81 else "distress"
    return {"z": round(z, 2), "zone": zone, "ratios": {k: round(v, 4) for k, v in x.items()}}


def beneish(l: Lines) -> dict[str, Any] | None:
    g = lambda label, i: l.get(label, i)
    rev = [g("Total Revenue", i) for i in range(2)]
    ar = [g("Accounts Receivable", i) for i in range(2)]
    gp = [g("Gross Profit", i) for i in range(2)]
    ca = [g("Current Assets", i) for i in range(2)]
    ppe = [g("Net PPE", i) for i in range(2)]
    ta = [g("Total Assets", i) for i in range(2)]
    dep = [l.first(("Depreciation And Amortization", "Reconciled Depreciation"), i) for i in range(2)]
    sga = [g("Selling General And Administration", i) for i in range(2)]
    cl = [g("Current Liabilities", i) for i in range(2)]
    ltd = [l.first(("Long Term Debt And Capital Lease Obligation", "Long Term Debt"), i) or 0.0 for i in range(2)]
    nico = l.first(("Net Income From Continuing Operation Net Minority Interest", "Net Income"), 0)
    cfo = g("Operating Cash Flow", 0)
    needed = (*rev, *ar, *gp, *ca, *ppe, *ta, *dep, *cl, nico, cfo)
    if any(v is None for v in needed) or 0 in (rev[0], rev[1], ta[0], ta[1], gp[0], gp[1]):
        return None
    try:
        v = {
            "DSRI": (ar[0] / rev[0]) / (ar[1] / rev[1]),
            "GMI": (gp[1] / rev[1]) / (gp[0] / rev[0]),
            "AQI": (1 - (ca[0] + ppe[0]) / ta[0]) / (1 - (ca[1] + ppe[1]) / ta[1]),
            "SGI": rev[0] / rev[1],
            "DEPI": (dep[1] / (dep[1] + ppe[1])) / (dep[0] / (dep[0] + ppe[0])),
            # Without an SG&A line the index is neutral, and the page says so
            "SGAI": ((sga[0] / rev[0]) / (sga[1] / rev[1])) if None not in sga and sga[1] else 1.0,
            "LVGI": ((cl[0] + ltd[0]) / ta[0]) / ((cl[1] + ltd[1]) / ta[1]),
            "TATA": (nico - cfo) / ta[0],
        }
    except ZeroDivisionError:
        return None
    m = (-4.84 + 0.920 * v["DSRI"] + 0.528 * v["GMI"] + 0.404 * v["AQI"] + 0.892 * v["SGI"] + 0.115 * v["DEPI"]
         - 0.172 * v["SGAI"] + 4.679 * v["TATA"] - 0.327 * v["LVGI"])
    return {
        "m": round(m, 2),
        "flag": m > -1.78,
        "threshold": -1.78,
        "indices": {k: round(x, 3) for k, x in v.items()},
        "sgaMissing": None in sga or not sga[1],
    }


def cash_conversion(l: Lines, years: int = 3) -> dict[str, Any] | None:
    cfo = [l.get("Operating Cash Flow", i) for i in range(years)]
    ni = [l.first(("Net Income", "Net Income Common Stockholders"), i) for i in range(years)]
    pairs = [(c, n) for c, n in zip(cfo, ni) if c is not None and n is not None]
    if len(pairs) < 2 or sum(n for _, n in pairs) <= 0:
        return None
    ratio = sum(c for c, _ in pairs) / sum(n for _, n in pairs)
    return {"ratio": round(ratio, 2), "years": len(pairs), "cfo": [c for c, _ in pairs], "netIncome": [n for _, n in pairs]}


def reverse_dcf_inputs(l: Lines, market_cap_cr: float | None, annual_revenue: list[dict[str, Any]]) -> dict[str, Any] | None:
    fcf = [l.get("Free Cash Flow", i) for i in range(3)]
    fcf = [f for f in fcf if f is not None]
    debt = l.get("Total Debt", 0) or 0.0
    cash = l.first(("Cash Cash Equivalents And Short Term Investments", "Cash And Cash Equivalents"), 0) or 0.0
    if not fcf or market_cap_cr is None:
        return None
    revs = [r for r in annual_revenue if isinstance(r.get("revenue"), (int, float)) and r["revenue"] > 0]

    def cagr(n: int) -> float | None:
        if len(revs) <= n:
            return None
        start, end = revs[-1 - n]["revenue"], revs[-1]["revenue"]
        return round(((end / start) ** (1 / n) - 1) * 100, 2)

    ni = l.first(("Net Income", "Net Income Common Stockholders"), 0)
    return {
        "netIncomeLatest": ni,
        "fcfLatest": fcf[0],
        "fcfAverage3y": round(sum(fcf) / len(fcf), 2),
        "fcfYears": len(fcf),
        "netDebt": round(debt - cash, 2),
        "marketCap": market_cap_cr,
        "enterpriseValue": round(market_cap_cr + debt - cash, 2),
        "revenueCagr": {"3y": cagr(3), "5y": cagr(5), "10y": cagr(10)},
        "defaults": {"discountRatePct": 12.0, "terminalGrowthPct": 5.0, "years": 10},
    }


def implied_growth(fcf0: float, ev: float, r: float, tg: float, years: int = 10) -> float | None:
    """The yearly FCF growth for `years` that makes discounted cash flows equal today's EV."""
    if fcf0 <= 0 or ev <= 0 or r <= tg:
        return None

    def value(g: float) -> float:
        pv, f = 0.0, fcf0
        for t in range(1, years + 1):
            f *= 1 + g
            pv += f / (1 + r) ** t
        return pv + (f * (1 + tg) / (r - tg)) / (1 + r) ** years

    lo, hi = -0.5, 1.0
    if not value(lo) <= ev <= value(hi):
        return None
    for _ in range(100):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if value(mid) < ev else (lo, mid)
    return round((lo + hi) / 2 * 100, 2)


def vet_inputs(l: Lines, vetted: dict[str, Any]) -> list[dict[str, Any]]:
    """Yahoo's headline lines against the vetted annual figures, year by year."""
    annual = {r["periodEnd"][:10]: r for r in vetted.get("annual") or []}
    balance = {r["periodEnd"][:10]: r for r in vetted.get("balanceSheet") or []}
    checks = []
    for i, day in enumerate(l.dates[:3]):
        pairs = [
            ("revenue", l.get("Total Revenue", i), (annual.get(day) or {}).get("revenue")),
            ("netIncome", l.first(("Net Income", "Net Income Common Stockholders"), i), (annual.get(day) or {}).get("netProfit")),
            ("totalAssets", l.get("Total Assets", i), (balance.get(day) or {}).get("totalAssets")),
        ]
        for field, yahoo, ours in pairs:
            if yahoo is None or ours in (None, 0):
                continue
            gap = abs(yahoo - ours) / max(abs(yahoo), abs(ours))
            checks.append({"year": day, "field": field, "yahoo": yahoo, "vetted": ours, "gapPct": round(gap * 100, 2), "agree": gap <= VET_TOLERANCE[field]})
    return checks


def build(
    statements: dict[str, Any],
    vetted_financials: dict[str, Any],
    market_cap_cr: float | None,
    lender: bool,
    long_revenue: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    l = Lines(statements)
    checks = vet_inputs(l, vetted_financials)
    failed = [c for c in checks if not c["agree"]]
    out: dict[str, Any] = {"years": l.dates[:3], "vetting": {"checks": checks, "vetted": bool(checks) and not failed}}
    if failed:
        f = failed[0]
        out["withheld"] = (
            f"Yahoo's {f['field']} for the year to {f['year']} ({f['yahoo']:,.0f}) is {f['gapPct']}% off the vetted figure "
            f"({f['vetted']:,.0f}), so scores built on its line items are not shown."
        )
        return out
    if lender:
        out["lender"] = True
        out["cashConversion"] = None
        out["note"] = "Piotroski, Altman and Beneish scores assume an operating company; for a lender, working capital, gross margin and receivables mean something else, so they are not computed."
        return out
    out.update(
        piotroski=piotroski(l),
        altman=altman(l, market_cap_cr),
        beneish=beneish(l),
        cashConversion=cash_conversion(l),
        # Growth history from screener.in's ten-plus years; the vetted series covers about four
        reverseDcf=reverse_dcf_inputs(l, market_cap_cr, long_revenue or vetted_financials.get("annual") or []),
    )
    rd = out["reverseDcf"]
    if rd:
        d = rd["defaults"]
        r, tg = d["discountRatePct"] / 100, d["terminalGrowthPct"] / 100
        rd["impliedGrowthPct"] = implied_growth(rd["fcfAverage3y"], rd["enterpriseValue"], r, tg, d["years"])
        # On earnings: profit as owner earnings against the market cap. Free cash flow misleads
        # where working capital absorbs cash (Titan's gold inventory), so both are shown.
        rd["impliedGrowthEarningsPct"] = implied_growth(rd["netIncomeLatest"] or 0, rd["marketCap"], r, tg, d["years"])
        fcf_to_profit = _div(rd["fcfAverage3y"], rd["netIncomeLatest"])
        rd["fcfToProfit"] = round(fcf_to_profit, 2) if fcf_to_profit is not None else None
    return out
