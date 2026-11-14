"""Mutual fund screener on AMFI's NAV files. Portfolio overlap has no source and is refused."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from .. import not_connected
from ..cache import CACHE
from ..schemas import envelope
from ..services import funds_live

router = APIRouter(prefix="/api/v1/funds", tags=["funds"])

DATASET_TTL = 6 * 3600  # AMFI updates NAVs once a day, late evening


def _dataset() -> tuple[dict, float]:
    try:
        return CACHE.get_or_fetch("funds:amfi:v1", DATASET_TTL, funds_live.fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"AMFI fund data unavailable: {exc}") from exc


@router.get("/screener")
def get_funds_screener(
    category: str | None = Query(None, max_length=80),
    sub_category: str | None = Query(None, max_length=120),
    amc: str | None = Query(None, max_length=80),
    plan: Literal["all", "Direct", "Regular"] = Query("Direct"),
    option: Literal["all", "Growth", "IDCW"] = Query("Growth"),
    q: str | None = Query(None, max_length=80),
    sort: Literal["schemeName", "return1yPct", "cagr3yPct", "cagr5yPct"] = Query("schemeName"),
    limit: int = Query(100, ge=1, le=500),
):
    """Schemes with latest NAV and returns over one, three and five years (growth options only)."""
    data, age = _dataset()
    rows = funds_live.screen(data["schemes"], category, sub_category, amc, plan, option, q, sort, 10**6)
    return envelope(
        {
            "asOf": data["asOf"],
            "totalSchemes": data["totalSchemes"],
            "matched": len(rows),
            "schemes": rows[:limit],
            "categories": data["categories"],
            "amcs": data["amcs"],
            "returnsMissingFor": data["returnsMissingFor"],
            "unavailable": data["unavailable"],
        },
        age,
        source="AMFI (NAVAll.txt and NAV history report)",
        delayed_minutes=0,
        note="Returns are NAV to NAV for growth options: one-year simple, three and five-year annualised. Past returns do not predict future ones.",
    )


@router.get("/overlap")
def get_portfolio_overlap():
    """Not offered: scheme holdings are not in any connected source."""
    not_connected.refuse("funds")
