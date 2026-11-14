"""Catalyst endpoints: index rebalances, IPO lock-in expiries, and buyback arbitrage."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..services import ipo as ipo_service
from .. import not_connected
from ..services import buyback_arbitrage, index_rebalance, ipo_lockin

router = APIRouter(prefix="/api/v1/catalysts", tags=["catalysts"])


@router.get("/index-rebalance")
def get_index_rebalance():
    """Semi-annual Nifty 50, Bank Nifty, and Nifty Next 50 rebalance forecast with passive ETF flows."""
    not_connected.refuse("index-rebalance")
    key = "catalysts:index_rebalance"
    data, age = CACHE.get_or_fetch(
        key,
        SETTINGS.fundamentals_ttl,
        index_rebalance.predict_rebalance,
    )
    return envelope(data, age, source="NSE Indices Methodology", delayed_minutes=0)


@router.get("/ipo-lockins")
def get_ipo_lockins():
    """Lock-in expiry dates for recent listings, derived from SEBI's fixed periods and listing dates."""
    try:
        pipeline, age = CACHE.get_or_fetch("ipo:pipeline", SETTINGS.ipo_ttl, ipo_service.build_pipeline)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"IPO pipeline unavailable: {exc}") from exc
    return envelope(
        ipo_lockin.build(pipeline),
        age,
        source="NSE IPO listings; SEBI ICDR lock-in periods",
        delayed_minutes=0,
        note="Dates are counted from the listing date and may be a few days after the true expiry, which runs from allotment. Share counts are not shown.",
    )


@router.get("/buybacks")
def get_buybacks():
    """Active tender-offer corporate buybacks with retail quota (₹2 Lakh) acceptance arbitrage simulations."""
    not_connected.refuse("buybacks")
    key = "catalysts:buybacks"
    data, age = CACHE.get_or_fetch(
        key,
        SETTINGS.fundamentals_ttl,
        buyback_arbitrage.get_buyback_desk,
    )
    return envelope(data, age, source="SEBI Buy-Back Disclosures", delayed_minutes=0)
