"""
Desks that have no data source connected.

Each of these was built on figures typed into the code, some labelled as official filings.
Hand-entered numbers cannot be told apart from live ones on the page, and they go stale
silently, so the routes now refuse instead of serving them. The entry for each desk names
the source it needs; connecting that source and deleting the entry turns the desk back on.
"""

from __future__ import annotations

from fastapi import HTTPException

NEEDS: dict[str, tuple[str, str]] = {
    "sector-kpis": (
        "Sector operating KPIs",
        "monthly releases from SIAM and VAHAN (auto), RBI sectoral credit (banking), CEA and Grid-India (power), "
        "DGCA (aviation) and TRAI (telecom). None publishes a free API; each needs a scheduled parser of its bulletin.",
    ),
    "macro-dashboard": (
        "Macro dashboard",
        "MOSPI releases for CPI, IIP and GDP, the Office of the Economic Adviser for WPI, GSTN collections and RBI DBIE series.",
    ),
    "yield-curve": (
        "Sovereign yield curve",
        "CCIL or FBIL par yields by tenor and RBI's policy-rate announcements.",
    ),
    "funds": (
        "Mutual fund portfolio overlap",
        "each AMC's monthly portfolio disclosure. The screener itself runs on AMFI's NAV files.",
    ),
    "index-rebalance": (
        "Index rebalance forecast",
        "six-month average free-float market capitalisation and turnover for every candidate, which NSE Indices does not publish.",
    ),
    "buybacks": (
        "Buyback desk",
        "open tender offers from SEBI or exchange corporate-action filings, with record dates and offer sizes.",
    ),
}


def refuse(desk: str) -> None:
    """Raise 404 with what the desk is waiting for."""
    name, needs = NEEDS[desk]
    raise HTTPException(
        status_code=404,
        detail=f"{name} is not available: no data source is connected. It needs {needs}",
    )
