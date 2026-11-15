"""
Group structures and supply chains: refused until a real source is parsed.

Subsidiary ownership and related-party flows are in each company's annual report and
XBRL filings, which Arthdex does not yet parse for these fields. The endpoints say so
instead of serving fixed tables or generated subsidiaries.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..not_sourced import refuse

router = APIRouter(prefix="/api/v1/network", tags=["network"])

_NEEDS = "subsidiary ownership and related-party transactions for this company"
_WHERE = "they are disclosed in annual reports and XBRL filings, which are not parsed for this yet"


@router.get("/hierarchy")
def get_hierarchy(symbol: str = Query("M&M")):
    refuse("The group structure", _NEEDS, _WHERE)


@router.get("/supply-chain")
def get_supply_chain(symbol: str = Query("M&M")):
    refuse("The supply chain", _NEEDS, _WHERE)


@router.get("/summary")
def get_summary(symbol: str = Query("M&M")):
    refuse("The corporate network", _NEEDS, _WHERE)
