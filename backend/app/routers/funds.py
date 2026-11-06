"""Mutual funds, AMFI scheme master and portfolio overlap analytics."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..schemas import envelope
from ..services import funds

router = APIRouter(prefix="/api/v1/funds", tags=["funds"])


@router.get("/screener")
def get_funds_screener(category: str | None = Query(None), amc: str | None = Query(None)):
    """AMFI mutual fund scheme master, performance CAGRs (1Y, 3Y, 5Y), TER, and risk ratios."""
    try:
        data = funds.get_funds_overview(category=category, amc=amc)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Fund screener unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="AMFI official NAV disclosures & AMC monthly portfolio filings",
        delayed_minutes=0,
        note="CAGRs and risk ratios computed against benchmark indices; all figures direct-growth.",
    )


@router.get("/overlap")
def get_portfolio_overlap(
    fund_a: str = Query("122639", description="Scheme code of first fund"),
    fund_b: str = Query("118989", description="Scheme code of second fund"),
):
    """Calculates pairwise portfolio stock holding overlap percentage between two schemes."""
    try:
        data = funds.calculate_portfolio_overlap(fund_a_code=fund_a, fund_b_code=fund_b)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Portfolio overlap unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="AMC statutory monthly portfolio holding disclosures",
        delayed_minutes=0,
        note="Overlap % represents sum of min(weight_A, weight_B) for all common equity constituents.",
    )
