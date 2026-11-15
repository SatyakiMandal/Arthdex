"""
Who owns a company, from its own quarterly shareholding filing.

Every listed company files its shareholding pattern with the exchange each quarter as an
XBRL document. It names each promoter and promoter-group entity with the shares it holds,
and each public shareholder above one per cent. This module reads the latest filing for a
symbol and returns those names and stakes as filed. It works for any NSE-listed company.

Not in the filing, and so not shown: subsidiaries and joint ventures (they are in the
annual report), suppliers and customers (companies do not disclose them in a usable form).

``parse`` is pure and tested offline.
"""

from __future__ import annotations

import html
import re
from collections import defaultdict
from typing import Any, Callable

_FACT = re.compile(r"<[\w.-]+:(\w+)\s+contextRef=\"([^\"]+)\"[^>]*>([^<]*)</")
_CATEGORY_TAGS = ("CategoryOfOtherIndianShareholders", "CategoryOfOtherForeignShareholders", "CategoryOfOtherNonInstitutions")

# The filing groups holders by table; these are the readable names for the common ones.
HOLDER_TYPES = {
    "IndividualsOrHinduUndividedFamily": "Individual or HUF",
    "CentralGovernmentOrStateGovernments": "Government",
    "FinancialInstitutionsOrBanks": "Bank or financial institution",
    "OthersIndianShareholders": "Indian entity",
    "IndividualsNonResidentIndividualsForeignIndividuals": "Foreign individual",
    "OtherForeignShareholders": "Foreign entity",
    "MutualFundsOrUTI": "Mutual fund",
    "InsuranceCompanies": "Insurance company",
    "ProvidentFundsOrPensionFunds": "Provident or pension fund",
    "AlternativeInvestmentFunds": "Alternative investment fund",
    "ForeignPortfolioInvestorsCategoryOne": "Foreign portfolio investor",
    "ForeignPortfolioInvestorsCategoryTwo": "Foreign portfolio investor",
    "DetailsOfSharesHeldByOtherInstitutionsForeign": "Foreign institution",
    "OtherNonInstitutions": "Other non-institution",
    "Banks": "Bank",
    "NBFCsRegisteredWithRBI": "NBFC",
    "SovereignWealthFunds": "Sovereign wealth fund",
}
UNAVAILABLE = {
    "subsidiaries": "Subsidiaries, associates and joint ventures are listed in the annual report, which is not connected.",
    "supplyChain": "Suppliers and customers are not disclosed by companies in any structured filing.",
    "promoterType": "The public version of the filing masks whether each entity is a promoter or a promoter-group member.",
}
MAX_GROUP_NAMES = 200


class OwnershipUnavailable(Exception):
    """The symbol has no shareholding filing that can be read."""


def _holder_type(table: str, category: str | None) -> str:
    if table.startswith("PAC_"):
        return "Person acting in concert"
    label = HOLDER_TYPES.get(table) or re.sub(r"(?<=[a-z])(?=[A-Z])", " ", table).capitalize()
    return f"{label} ({category.lower()})" if category and category.lower() not in label.lower() else label


def _float(value: str | None) -> float | None:
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def parse(xml: str) -> dict[str, Any]:
    """Named holders from a shareholding-pattern XBRL document. Raises ValueError if none are found."""
    facts: dict[str, dict[str, str]] = defaultdict(dict)
    for tag, context, value in _FACT.findall(xml):
        facts[context][tag] = html.unescape(value).strip()

    promoters: list[dict[str, Any]] = []
    group_without_shares: list[str] = []
    public: list[dict[str, Any]] = []
    for context, described in facts.items():
        name = described.get("NameOfTheShareholder")
        if not name or not context.startswith("D_"):
            continue
        numbers = facts.get(context[2:], {})
        table = context[2:].rsplit("_Context", 1)[0]
        shares = _float(numbers.get("NumberOfFullyPaidUpEquityShares")) or _float(numbers.get("NumberOfShares")) or 0.0
        fraction = _float(numbers.get("ShareholdingAsAPercentageOfTotalNumberOfShares"))
        category = next((described[t] for t in _CATEGORY_TAGS if described.get(t)), None)
        row = {
            "name": re.sub(r"\s+", " ", name),
            "holderType": _holder_type(table, category),
            "shares": int(shares),
            # the filing gives the stake as a fraction of total shares
            "pct": round(fraction * 100.0, 2) if fraction is not None else None,
        }
        if "TypeOfPromoterShareholding" in described:
            if shares > 0:
                promoters.append(row)
            else:
                group_without_shares.append(row["name"])
        elif shares > 0:
            public.append(row)

    if not promoters and not public and not group_without_shares:
        raise ValueError("filing names no shareholders")
    promoters.sort(key=lambda r: -r["shares"])
    public.sort(key=lambda r: -r["shares"])
    known = [r["pct"] for r in promoters if r["pct"] is not None]
    return {
        "promoters": promoters,
        "promoterNamedTotalPct": round(sum(known), 2) if known else None,
        "promoterGroupWithoutShares": sorted(set(group_without_shares))[:MAX_GROUP_NAMES],
        "promoterGroupWithoutSharesCount": len(set(group_without_shares)),
        "publicHoldersAbove1Pct": public,
    }


def _normalise(name: str) -> str:
    text = re.sub(r"[^a-z0-9 ]", " ", name.lower().replace("&", " and "))
    text = re.sub(r"\b(limited|ltd|the|pvt|private|company|co|corporation|corp|india)\b", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def link_listed(rows: list[dict[str, Any]], universe: list[dict[str, Any]] | None) -> None:
    """Adds the NSE symbol to a holder whose name matches a listed company exactly (after normalising)."""
    index: dict[str, str] = {}
    clashes: set[str] = set()
    for item in universe or []:
        key = _normalise(str(item.get("name") or ""))
        if not key:
            continue
        if key in index and index[key] != item.get("symbol"):
            clashes.add(key)
        index[key] = str(item.get("symbol"))
    for row in rows:
        key = _normalise(row["name"])
        row["symbol"] = index.get(key) if key and key not in clashes else None


def build(
    symbol: str,
    filings: list[dict[str, Any]],
    get_text: Callable[[str], str],
    universe: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """``filings`` are rows of NSE's shareholding master for the symbol, newest first."""
    sym = symbol.upper()
    usable = [f for f in filings or [] if str(f.get("xbrl") or "").lower().endswith(".xml")]
    if not usable:
        raise OwnershipUnavailable(f"No shareholding filing is available for {sym}.")
    last_error: Exception | None = None
    for filing in usable[:3]:  # a revised or malformed latest filing falls back to the one before
        try:
            parsed = parse(get_text(filing["xbrl"]))
        except Exception as exc:
            last_error = exc
            continue
        link_listed(parsed["promoters"], universe)
        link_listed(parsed["publicHoldersAbove1Pct"], universe)
        return {
            "symbol": sym,
            "companyName": filing.get("name") or sym,
            "asOf": filing.get("date"),
            "filedOn": filing.get("submissionDate") or filing.get("broadcastDate"),
            "promoterAndGroupPct": _float(filing.get("pr_and_prgrp")),
            "publicPct": _float(filing.get("public_val")),
            **parsed,
            "filingUrl": filing["xbrl"],
            "notes": (filing.get("shareholdingPatternNotes") or "").strip() or None,
            "unavailable": UNAVAILABLE,
        }
    raise OwnershipUnavailable(f"The shareholding filing for {sym} could not be read ({type(last_error).__name__}).")
