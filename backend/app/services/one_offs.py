"""
One-off items in a company's trailing earnings, read from its quarterly filings.

Reported profit includes exceptional items (write-offs, gains on sale, settlements) and the
profit of operations the company has since discontinued. Some data providers leave these
out of the earnings behind a P/E and some do not, which is why two honest P/E figures for
the same company can differ by a quarter. This module reads both items from the last four
quarterly filings and states the trailing EPS with and without them.

What is filed and what is calculated:
  * exceptional items are filed before tax; discontinued-operations profit is filed after tax;
  * the after-tax effect of the exceptional items is an estimate, using each quarter's own
    effective tax rate (tax expense over profit before tax). It is marked as calculated.

``summarise`` is pure and tested offline.
"""

from __future__ import annotations

from typing import Any, Callable

MATERIAL_SHARE = 0.03   # one-offs below this share of trailing profit are not worth a second P/E
MAX_TAX_RATE = 0.6      # an effective rate outside 0..60% is a distorted quarter, not a rate


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and value == value else None


def after_tax(exceptional: float, profit_before_tax: float | None, tax: float | None) -> float | None:
    """Exceptional items net of tax at the quarter's effective rate; None if that rate is not usable."""
    if exceptional == 0:
        return 0.0
    pbt, t = _num(profit_before_tax), _num(tax)
    if pbt is None or t is None or pbt <= 0:
        return None
    rate = t / pbt
    if not 0 <= rate <= MAX_TAX_RATE:
        return None
    return exceptional * (1.0 - rate)


def summarise(quarters: list[dict[str, Any] | None], reported_profit: Any, reported_eps: Any) -> dict[str, Any] | None:
    """
    ``quarters`` are the filing figures for the four quarters behind the trailing EPS, in
    any order; None where a filing could not be read. Returns None when nothing was read.
    """
    read = [q for q in quarters if q]
    if not read:
        return None
    exceptional = sum(_num(q.get("exceptionalBeforeTax")) or 0.0 for q in read)
    discontinued = sum(_num(q.get("discontinuedAfterTax")) or 0.0 for q in read)

    effect: float | None = discontinued
    for q in read:
        exc = _num(q.get("exceptionalBeforeTax")) or 0.0
        net = after_tax(exc, q.get("profitBeforeTax"), q.get("taxExpense"))
        if net is None:
            effect = None  # one quarter's tax rate is unusable: no after-tax figure is offered
            break
        effect += net

    profit, eps = _num(reported_profit), _num(reported_eps)
    complete = len(read) == len(quarters) == 4
    out: dict[str, Any] = {
        "quartersRead": len(read),
        "complete": complete,
        "exceptionalBeforeTaxCr": round(exceptional, 2),
        "discontinuedAfterTaxCr": round(discontinued, 2),
        "afterTaxEffectCr": round(effect, 2) if effect is not None else None,
        "material": False,
        "epsBeforeOneOffs": None,
        "source": "NSE quarterly results filings (XBRL)",
    }
    if not complete or effect is None or not profit or profit <= 0 or not eps or eps <= 0:
        out["note"] = _note(out, None)
        return out
    share = effect / profit
    out["shareOfReportedProfitPct"] = round(share * 100.0, 1)
    if abs(share) >= MATERIAL_SHARE and profit - effect > 0:
        out["material"] = True
        # EPS scales with the profit attributable to the same shares
        out["epsBeforeOneOffs"] = round(eps * (profit - effect) / profit, 2)
    out["note"] = _note(out, share)
    return out


def _note(o: dict[str, Any], share: float | None) -> str:
    parts = []
    if o["exceptionalBeforeTaxCr"]:
        kind = "gains" if o["exceptionalBeforeTaxCr"] > 0 else "charges"
        parts.append(f"exceptional {kind} of ₹{abs(o['exceptionalBeforeTaxCr']):,.0f} crore before tax")
    if o["discontinuedAfterTaxCr"]:
        kind = "profit" if o["discontinuedAfterTaxCr"] > 0 else "loss"
        parts.append(f"a {kind} of ₹{abs(o['discontinuedAfterTaxCr']):,.0f} crore from discontinued operations")
    if not parts:
        return "The last four quarterly filings report no exceptional items or discontinued operations."
    text = "Reported earnings over the last four quarters include " + " and ".join(parts) + ", as filed."
    if not o["complete"]:
        text += f" Only {o['quartersRead']} of the four filings could be read, so no adjusted figure is given."
    elif share is not None and o["material"]:
        direction = "raise" if share > 0 else "lower"
        text += f" Together these {direction} reported profit by about {abs(share) * 100:.0f}% after tax (calculated at each quarter's tax rate)."
    return text


def for_symbol(symbol: str, quarter_ends: list[str], reported_profit: Any, reported_eps: Any,
               filing_for: Callable[[str, str], dict[str, Any] | None]) -> dict[str, Any] | None:
    quarters = []
    for end in quarter_ends[-4:]:
        try:
            filing = filing_for(symbol, end)
        except Exception:
            filing = None
        quarters.append((filing or {}).get("quarter"))
    if len(quarters) < 4:
        quarters += [None] * (4 - len(quarters))
    return summarise(quarters, reported_profit, reported_eps)
