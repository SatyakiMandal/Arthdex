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
    "forex-monitor": (
        "Forex monitor",
        "FBIL reference rates and forward premia. Spot cross rates alone are available from Yahoo Finance and could seed a smaller desk.",
    ),
    "yield-curve": (
        "Sovereign yield curve",
        "CCIL or FBIL par yields by tenor and RBI's policy-rate announcements.",
    ),
    "funds": (
        "Mutual fund screener and overlap",
        "AMFI's daily NAV file for the scheme list and returns, and each AMC's monthly portfolio disclosure for holdings overlap.",
    ),
    "index-rebalance": (
        "Index rebalance forecast",
        "six-month average free-float market capitalisation and turnover for every candidate, which NSE Indices does not publish.",
    ),
    "ipo-lockins": (
        "IPO lock-in calendar",
        "anchor allotment and pre-IPO share counts from each prospectus and the exchange's lock-in notices. "
        "Expiry dates alone can be derived from listing dates already in the IPO pipeline.",
    ),
    "buybacks": (
        "Buyback desk",
        "open tender offers from SEBI or exchange corporate-action filings, with record dates and offer sizes.",
    ),
    "vol-surface": (
        "Volatility surface",
        "implied volatility by strike and expiry from the live option chain. The chain is already connected; the surface must be fitted to it rather than drawn from fixed parameters.",
    ),
}


def refuse(desk: str) -> None:
    """Raise 404 with what the desk is waiting for."""
    name, needs = NEEDS[desk]
    raise HTTPException(
        status_code=404,
        detail=f"{name} is not available: no data source is connected. It needs {needs}",
    )
