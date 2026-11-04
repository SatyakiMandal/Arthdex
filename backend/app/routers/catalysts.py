"""Catalyst endpoints: index rebalances, IPO lock-in expiries, and buyback arbitrage."""

from __future__ import annotations

from fastapi import APIRouter

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..services import buyback_arbitrage, index_rebalance, ipo_lockin

router = APIRouter(prefix="/api/v1/catalysts", tags=["catalysts"])


@router.get("/index-rebalance")
def get_index_rebalance():
    """Semi-annual Nifty 50, Bank Nifty, and Nifty Next 50 rebalance forecast with passive ETF flows."""
    key = "catalysts:index_rebalance"
    data, age = CACHE.get_or_fetch(
        key,
        SETTINGS.fundamentals_ttl,
        index_rebalance.predict_rebalance,
    )
    return envelope(data, age, source="NSE Indices Methodology", delayed_minutes=0)


@router.get("/ipo-lockins")
def get_ipo_lockins():
    """Anchor and Pre-IPO lock-in expiry schedule with supply impact volume ratios."""
    key = "catalysts:ipo_lockins"
    data, age = CACHE.get_or_fetch(
        key,
        SETTINGS.fundamentals_ttl,
        ipo_lockin.build_lockin_calendar,
    )
    return envelope(data, age, source="SEBI ICDR Regulations", delayed_minutes=0)


@router.get("/buybacks")
def get_buybacks():
    """Active tender-offer corporate buybacks with retail quota (₹2 Lakh) acceptance arbitrage simulations."""
    key = "catalysts:buybacks"
    data, age = CACHE.get_or_fetch(
        key,
        SETTINGS.fundamentals_ttl,
        buyback_arbitrage.get_buyback_desk,
    )
    return envelope(data, age, source="SEBI Buy-Back Disclosures", delayed_minutes=0)
