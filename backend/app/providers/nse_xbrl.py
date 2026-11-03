"""
Financial results as filed with NSE, read from the companies' own XBRL.

This is the third, authoritative source behind Yahoo and screener.in. It is used
to settle a disagreement between the two, period by period, not as a primary
feed: each filing is a separate download, so only disputed periods are fetched.

Two NSE listings carry the filings. Results under SEBI's integrated-filing format
(from 2025) are listed by /api/integrated-filing-results; earlier ones by
/api/corporates-financial-results. Both link an XBRL instance in the Ind-AS
capital-markets taxonomy, where:

    a duration context of about 91 days ending on the period end is the quarter,
    one of about 365 days is the full year (filed with fourth-quarter results),
    an instant context on the period end is the balance sheet (half-year and year end).

Contexts carrying a dimension (segment revenue, expense breakdowns) are skipped.
Values are in rupees and are returned in crore.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import date, datetime
from typing import Any

from ..cache import CACHE
from .nse import _get_session, nse_get

CRORE = 1e7
# A filing never changes once published; revisions are new filings with new URLs
FILING_TTL = 30 * 24 * 3600
LIST_TTL = 12 * 3600

# Facts read, in priority order where the taxonomies differ (banks file their own lines)
REVENUE = ("RevenueFromOperations", "TotalIncomeFromOperations", "InterestEarned")
PROFIT_OWNERS = (
    "ProfitOrLossAttributableToOwnersOfParent",
    "ProfitLossAttributableToOwnersOfParent",
    "ProfitLossAfterTaxesMinorityInterestAndShareOfProfitLossOfAssociates",  # banks
)
PROFIT_TOTAL = ("ProfitLossForPeriod", "ProfitLossForThePeriod", "NetProfitLossForThePeriod")
MINORITY = ("ProfitOrLossAttributableToNonControllingInterests", "ProfitLossOfMinorityInterest")
EPS = (
    "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
    "BasicEarningsPerShareAfterExtraordinaryItems",
    "BasicEarningsLossPerShareFromContinuingOperations",
)
EQUITY_OWNERS = ("EquityAttributableToOwnersOfParent",)
EQUITY_TOTAL = ("Equity", "TotalEquity")
ASSETS = ("Assets", "TotalAssets", "CapitalAndLiabilities")
# Banks report equity as share capital plus reserves and surplus
BANK_EQUITY = ("Capital", "ReservesAndSurplus")
BORROWINGS = (("BorrowingsCurrent", "BorrowingsNoncurrent"), ("Borrowings",))


def _day(text: str | None) -> date | None:
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d-%b-%Y", "%d-%B-%Y"):
        try:
            return datetime.strptime(text.strip().title() if "-" in text and not text[:4].isdigit() else text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def list_filings(symbol: str) -> list[dict[str, Any]]:
    """Every results filing NSE lists for a company: period end, basis and XBRL link, newest first."""

    def fetch() -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        try:
            recent = nse_get(f"/api/integrated-filing-results?index=equities&symbol={symbol}&period_ended=all&type=Integrated%20Filing-%20Financials")
            for r in (recent or {}).get("data") or []:
                end = _day(r.get("qe_Date"))
                if end and r.get("xbrl"):
                    out.append({"periodEnd": end.isoformat(), "consolidated": r.get("consolidated") == "Consolidated",
                                "url": r["xbrl"], "filed": r.get("broadcast_Date"), "revised": r.get("type_Sub") not in (None, "Original")})
        except Exception:
            pass
        try:
            older = nse_get(f"/api/corporates-financial-results?index=equities&symbol={symbol}&period=Quarterly")
            for r in older if isinstance(older, list) else []:
                end = _day(r.get("toDate"))
                if end and r.get("xbrl") and str(r["xbrl"]).endswith(".xml"):
                    out.append({"periodEnd": end.isoformat(), "consolidated": r.get("consolidated") == "Consolidated",
                                "url": r["xbrl"], "filed": r.get("broadCastDate"), "revised": False})
        except Exception:
            pass
        return out

    rows, _ = CACHE.get_or_fetch(f"xbrl:list:{symbol.upper()}", LIST_TTL, fetch)
    return rows


def parse(xml: bytes | str) -> dict[str, Any]:
    """Quarter, full-year and balance-sheet figures from one XBRL instance, in crore."""
    root = ET.fromstring(xml)

    def local(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    contexts: dict[str, tuple[date | None, date | None]] = {}
    for ctx in root.iter():
        if local(ctx.tag) != "context":
            continue
        if any(local(e.tag) in ("segment", "scenario") for e in ctx.iter()):
            continue  # dimensional: segment revenue, expense lines
        dates = {local(e.tag): _day(e.text) for e in ctx.iter() if local(e.tag) in ("startDate", "endDate", "instant")}
        if "instant" in dates:
            contexts[ctx.get("id")] = (None, dates["instant"])
        elif "endDate" in dates:
            contexts[ctx.get("id")] = (dates.get("startDate"), dates["endDate"])

    meta: dict[str, str] = {}
    for el in root.iter():
        name = local(el.tag)
        if el.get("contextRef") and el.text and name in (
            "NatureOfReportStandaloneConsolidated", "DateOfEndOfReportingPeriod", "ReportingQuarter",
            "DateOfStartOfFinancialYear", "DateOfStartOfReportingPeriod",
        ):
            meta.setdefault(name, el.text.strip())

    end = _day(meta.get("DateOfEndOfReportingPeriod"))
    if end is None:
        return {}

    # Older NSE filings (before the 2025 integrated format) reference the main periods by
    # convention without declaring them: OneD is the quarter, FourD the year to date, OneI
    # the period-end instant. Declare them from the filing's own dates where missing.
    fy_start = _day(meta.get("DateOfStartOfFinancialYear"))
    q_start = _day(meta.get("DateOfStartOfReportingPeriod"))
    implied = {
        "OneD": (q_start or date.fromordinal(end.toordinal() - 90), end),
        "FourD": (fy_start, end) if fy_start else None,
        "OneI": (None, end),
    }
    for cid, span in implied.items():
        if cid not in contexts and span is not None:
            contexts[cid] = span

    facts: dict[tuple[str, str], str] = {}
    for el in root.iter():
        ref = el.get("contextRef")
        if ref in contexts and el.text is not None:
            facts.setdefault((local(el.tag), ref), el.text.strip())

    def ids(min_days: int | None, max_days: int | None) -> list[str]:
        out = []
        for cid, (start, stop) in contexts.items():
            if stop != end:
                continue
            if min_days is None and start is None:
                out.append(cid)
            elif min_days is not None and start is not None and min_days <= (stop - start).days <= max_days:
                out.append(cid)
        return out

    def value(names: tuple[str, ...], cids: list[str], scale: float = CRORE) -> float | None:
        for n in names:
            for cid in cids:
                raw = facts.get((n, cid))
                if raw not in (None, ""):
                    try:
                        return round(float(raw) / scale, 2)
                    except ValueError:
                        continue
        return None

    def flows(cids: list[str]) -> dict[str, Any] | None:
        if not cids:
            return None
        total, minority = value(PROFIT_TOTAL, cids), value(MINORITY, cids)
        owners = value(PROFIT_OWNERS, cids)
        if owners is None and total is not None:
            owners = round(total - (minority or 0), 2)
        row = {"revenue": value(REVENUE, cids), "netProfitOwners": owners, "netProfit": total, "eps": value(EPS, cids, scale=1)}
        return row if any(v is not None for v in row.values()) else None

    balance = None
    inst = ids(None, None)
    if inst:
        borrow = None
        for group in BORROWINGS:
            parts = [value((g,), inst) for g in group]
            if all(p is not None for p in parts):
                borrow = round(sum(parts), 2)
                break
        worth = value(EQUITY_OWNERS, inst) or value(EQUITY_TOTAL, inst)
        if worth is None:
            parts = [value((n,), inst) for n in BANK_EQUITY]
            worth = round(sum(parts), 2) if all(p is not None for p in parts) else None
        balance = {"netWorth": worth, "totalAssets": value(ASSETS, inst), "borrowings": borrow}
        if not any(v is not None for v in balance.values()):
            balance = None

    return {
        "periodEnd": end.isoformat(),
        "consolidated": meta.get("NatureOfReportStandaloneConsolidated") == "Consolidated",
        "quarter": flows(ids(80, 100)),
        "year": flows(ids(355, 370)),
        "balance": balance,
    }


def figures_for(symbol: str, period_end: str, consolidated: bool = True) -> dict[str, Any] | None:
    """The parsed filing for one period end, consolidated by preference; the latest revision wins."""
    filings = [f for f in list_filings(symbol) if f["periodEnd"] == period_end[:10]]
    if not filings:
        return None
    filings.sort(key=lambda f: (f["consolidated"] == consolidated, f["revised"], f.get("filed") or ""), reverse=True)
    url = filings[0]["url"]

    def fetch() -> dict[str, Any]:
        res = _get_session().get(url, timeout=60)
        res.raise_for_status()
        return {**parse(res.content), "url": url}

    parsed, _ = CACHE.get_or_fetch(f"xbrl:filing:{url}", FILING_TTL, fetch)
    return parsed or None
