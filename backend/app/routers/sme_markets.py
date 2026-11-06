"""
SME Exchange Board Router: NSE Emerge & BSE SME Overview, IPO Pipeline,
Mainboard Migration Tracker, and Stock Screener.
"""

from __future__ import annotations

from typing import Literal
from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..schemas import envelope
from ..services import sme_markets

router = APIRouter(tags=["sme"])


@router.get("/api/sme/overview")
@router.get("/api/v1/sme/overview")
def get_sme_exchange_overview():
    """
    Returns high-level snapshot of NSE Emerge and BSE SME boards:
    active listings count, exchange split, sector distribution, mcap tiers, and market breadth.
    """
    cache_key = "sme:overview:all"

    def compute():
        return sme_markets.get_sme_overview()

    try:
        data, age = CACHE.get_or_fetch(cache_key, 30, compute)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SME Overview error: {exc}") from exc

    return envelope(
        data,
        age,
        source="NSE Emerge & BSE SME Official Feeds",
        delayed_minutes=0,
        note="SME board metrics updated in real-time. Complies with SEBI SME trading framework.",
    )


@router.get("/api/sme/ipos")
@router.get("/api/v1/sme/ipos")
def get_sme_ipos(
    status: Literal["all", "live", "upcoming", "closed", "listed"] = Query("all"),
    exchange: Literal["ALL", "NSE", "BSE"] = Query("ALL"),
):
    """
    Returns SME IPO Pipeline: issue size, lot size, minimum application amount (₹1.0L - ₹1.5L),
    and QIB / NII / Retail subscription multiples.
    """
    cache_key = f"sme:ipos:{status}:{exchange}"

    def compute():
        return sme_markets.get_sme_ipos(status=status, exchange=exchange)

    try:
        data, age = CACHE.get_or_fetch(cache_key, 30, compute)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SME IPOs error: {exc}") from exc

    return envelope(
        data,
        age,
        source="NSE Emerge, BSE SME & Lead Manager Filings",
        delayed_minutes=0,
        note="SEBI mandates lot sizes with minimum investment of ₹1,00,000 - ₹1,50,000 per application.",
    )


@router.get("/api/sme/migrations")
@router.get("/api/v1/sme/migrations")
def get_mainboard_migrations(
    status: Literal["all", "ready"] = Query("all"),
):
    """
    Mainboard Migration Tracker:
    Evaluates companies against SEBI / NSE / BSE 5-point migration eligibility criteria
    and tracks historical post-migration performance of graduated stars.
    """
    cache_key = f"sme:migrations:{status}"

    def compute():
        return sme_markets.get_sme_migrations(status=status)

    try:
        data, age = CACHE.get_or_fetch(cache_key, 60, compute)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SME Migration error: {exc}") from exc

    return envelope(
        data,
        age,
        source="NSE & BSE Listing Compliance Disclosures",
        delayed_minutes=0,
        note="Audit criteria: 3Y listing tenure, Paid-up capital > ₹10 Cr, MCap > ₹25 Cr, Positive PAT (2/3Y).",
    )


@router.get("/api/sme/screener")
@router.get("/api/v1/sme/screener")
def screen_sme_stocks(
    exchange: Literal["ALL", "NSE", "BSE"] = Query("ALL"),
    sector: str | None = Query(None, description="Filter by sector"),
    min_market_cap: float | None = Query(None, description="Minimum market cap in ₹ Cr"),
    max_market_cap: float | None = Query(None, description="Maximum market cap in ₹ Cr"),
    min_pat_growth: float | None = Query(None, description="Minimum 3Y sales / profit growth %"),
    max_pe: float | None = Query(None, description="Maximum P/E multiple"),
    max_spread_pct: float | None = Query(None, description="Maximum bid-ask spread %"),
    migration_ready_only: bool = Query(False, description="Filter only migration-eligible companies"),
    sort_by: str = Query("market_cap_cr", description="Field to sort by"),
    order: Literal["asc", "desc"] = Query("desc"),
):
    """
    Institutional multi-factor screener for SME exchange stocks.
    """
    try:
        results = sme_markets.screen_sme_stocks(
            exchange=exchange,
            sector=sector,
            min_market_cap=min_market_cap,
            max_market_cap=max_market_cap,
            min_pat_growth=min_pat_growth,
            max_pe=max_pe,
            max_spread_pct=max_spread_pct,
            migration_ready_only=migration_ready_only,
            sort_by=sort_by,
            order=order,
        )
        return envelope(
            {"count": len(results), "results": results},
            0.0,
            source="Arthdex SME Screener Engine",
            delayed_minutes=0,
            note="Screened against active NSE Emerge and BSE SME universe.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SME screener error: {exc}") from exc
