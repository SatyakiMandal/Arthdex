"""
Starting inputs for the DCF workbench, read from the company's own figures.

A DCF needs facts (price, share count, cash, debt, free cash flow) and assumptions (growth,
discount rate inputs). The facts come from the same routes as the company page. Each
assumption is derived from the company's history where that is possible and is labelled as
an assumption either way. When a fact is missing the model is not run: there is no generic
profile to fall back to.

``derive`` is pure and tested offline; ``build`` fetches.
"""

from __future__ import annotations

from typing import Any

TAG_ACTUAL = "[ACTUAL FILING]"
TAG_MARKET = "[EXCHANGE DATA]"
TAG_MODELLED = "[MODELLED / ALGORITHMIC]"
TAG_ASSUMPTION = "[ASSUMPTION]"

DEFAULT_TERMINAL_GROWTH_RATE = 0.05
DEFAULT_PRETAX_COST_OF_DEBT = 0.085
DEFAULT_STAGE1_GROWTH = 0.10
GROWTH_FLOOR, GROWTH_CAP = 0.03, 0.20
BETA_FLOOR, BETA_CAP = 0.3, 2.5
MIN_BETA_R_SQUARED = 0.05

# A cash-flow DCF treats debt as financing. For a lender debt is raw material, so free cash
# flow to the firm is not a meaningful quantity and the model is not offered.
LENDER_WORDS = ("bank", "financ", "insurance", "nbfc", "capital markets", "lending")


class DcfInputsUnavailable(Exception):
    """The company's figures do not support a cash-flow DCF; the message says why."""


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if value == value and abs(value) != float("inf") else None


def _revenue_cagr(financials: dict | None) -> tuple[float | None, str | None]:
    annual = [(a.get("period"), _num(a.get("revenue"))) for a in (financials or {}).get("annual") or []]
    annual = [(p, r) for p, r in annual if r and r > 0]
    if len(annual) < 3:
        return None, None
    years = len(annual) - 1
    return (annual[-1][1] / annual[0][1]) ** (1.0 / years) - 1.0, f"{annual[0][0]} to {annual[-1][0]}"


def derive(
    symbol: str,
    quote: dict | None,
    statistics: dict | None,
    financials: dict | None,
    sensitivities: dict | None,
) -> dict[str, Any]:
    sym = symbol.upper()
    price = _num((quote or {}).get("cmp"))
    if not price or price <= 0:
        raise DcfInputsUnavailable(f"No quote is available for {sym}.")

    stats = statistics or {}
    highlights, trading, about = stats.get("highlights") or {}, stats.get("trading") or {}, stats.get("about") or {}
    sector = " ".join(str(x) for x in (quote.get("sector"), quote.get("basicIndustry"), about.get("sector"), about.get("industry")) if x)
    if any(word in sector.lower() for word in LENDER_WORDS):
        raise DcfInputsUnavailable(
            f"{sym} is a lender or insurer. Free cash flow to the firm is not a meaningful measure for it, "
            "so a cash-flow DCF is not offered. Use the price-to-book and return-on-equity figures instead."
        )

    provenance: dict[str, str] = {"current_price": TAG_MARKET}
    notes: list[str] = []

    shares = _num(trading.get("sharesOutstanding"))
    market_cap = _num(quote.get("marketCapCr"))
    if shares and shares > 0:
        shares_cr = shares / 1e7
        provenance["shares_outstanding_cr"] = TAG_ACTUAL
    elif market_cap and market_cap > 0:
        shares_cr = market_cap / price
        provenance["shares_outstanding_cr"] = TAG_MODELLED
        notes.append("Share count is market capitalisation divided by price.")
    else:
        raise DcfInputsUnavailable(f"The share count for {sym} is not available.")

    fcf = _num(highlights.get("freeCashflow"))
    if fcf is None:
        raise DcfInputsUnavailable(f"Free cash flow for {sym} is not reported by the data sources.")
    if fcf <= 0:
        raise DcfInputsUnavailable(
            f"{sym} reported negative free cash flow over the last twelve months (₹{fcf:,.0f} crore). "
            "A DCF grown from a negative base has no meaning; enter your own normalised figure to model it."
        )
    provenance["base_fcff_cr"] = TAG_ACTUAL
    notes.append("Base cash flow is trailing twelve-month free cash flow as reported, not a normalised figure.")

    cash, debt = _num(highlights.get("cash")), _num(highlights.get("debt"))
    for label, value, key in (("Cash", cash, "cash_and_equivalents_cr"), ("Debt", debt, "total_debt_cr")):
        if value is None:
            notes.append(f"{label} is not reported by the data sources and is taken as zero.")
            provenance[key] = TAG_ASSUMPTION
        else:
            provenance[key] = TAG_ACTUAL

    ratios = (financials or {}).get("ratios") or {}
    debt_to_equity = _num(ratios.get("debtToEquity"))
    if debt_to_equity is None:
        debt_to_equity = _num(highlights.get("debtToEquity"))
    if debt_to_equity is None or debt_to_equity < 0:
        debt_to_equity = (debt / market_cap) if debt and market_cap else 0.0
        provenance["debt_to_equity"] = TAG_MODELLED
    else:
        provenance["debt_to_equity"] = TAG_ACTUAL

    beta, beta_basis = 1.0, None
    rows = {r.get("benchmarkId"): r for r in (sensitivities or {}).get("rows") or []}
    row = rows.get("nifty-50")
    if row and _num(row.get("beta")) is not None and (_num(row.get("rSquared")) or 0) >= MIN_BETA_R_SQUARED:
        beta = min(BETA_CAP, max(BETA_FLOOR, float(row["beta"])))
        beta_basis = f"OLS on {row.get('observationWindowDays')} daily returns against the Nifty 50"
        provenance["beta"] = TAG_MODELLED
    else:
        provenance["beta"] = TAG_ASSUMPTION
        notes.append("No usable regression against the Nifty 50, so beta is assumed to be 1.0.")

    cagr, span = _revenue_cagr(financials)
    if cagr is None:
        growth = DEFAULT_STAGE1_GROWTH
        notes.append("Fewer than three years of revenue on file, so first-stage growth starts at 10%.")
    else:
        growth = min(GROWTH_CAP, max(GROWTH_FLOOR, cagr))
        notes.append(
            f"First-stage growth starts at the {span} revenue growth rate ({cagr * 100:.1f}% a year), "
            f"held within {GROWTH_FLOOR * 100:.0f}% to {GROWTH_CAP * 100:.0f}%."
        )
    provenance["stage1_growth_rate"] = TAG_ASSUMPTION
    provenance["terminal_growth_rate"] = TAG_ASSUMPTION
    provenance["pretax_cost_of_debt"] = TAG_ASSUMPTION

    return {
        "symbol": sym,
        "name": quote.get("name") or about.get("name") or sym,
        "current_price": round(price, 2),
        "shares_outstanding_cr": round(shares_cr, 4),
        "cash_and_equivalents_cr": round(cash or 0.0, 2),
        "total_debt_cr": round(debt or 0.0, 2),
        "base_fcff_cr": round(fcf, 2),
        "beta": round(beta, 2),
        "beta_basis": beta_basis,
        "debt_to_equity": round(debt_to_equity, 3),
        "stage1_growth_rate": round(growth, 4),
        "historical_revenue_cagr": round(cagr, 4) if cagr is not None else None,
        "terminal_growth_rate": DEFAULT_TERMINAL_GROWTH_RATE,
        "pretax_cost_of_debt": DEFAULT_PRETAX_COST_OF_DEBT,
        "as_of": quote.get("asOf"),
        "input_provenance": provenance,
        "notes": notes,
        "provenance": f"{TAG_MARKET} price · {TAG_ACTUAL} cash flow and balance sheet · {TAG_ASSUMPTION} growth and discount inputs",
    }


def build(symbol: str) -> dict[str, Any]:
    from fastapi import HTTPException

    from ..routers import company, quant  # imported here: the routers import services

    sym = symbol.upper()

    def section(fn):
        try:
            return (fn() or {}).get("data")
        except HTTPException:
            return None
        except Exception:
            return None

    quote = section(lambda: company.get_quote(sym, "NSE"))
    if not quote:
        raise DcfInputsUnavailable(f"No quote is available for {sym}.")
    return derive(
        sym,
        quote,
        section(lambda: company.get_statistics(sym)),
        section(lambda: company.get_financials(sym, "NSE")),
        section(lambda: quant.get_sensitivity(sym, "NSE")),
    )
