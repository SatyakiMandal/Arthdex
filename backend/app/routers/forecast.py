"""
Multi-Algorithm Scenario Forecasting and Execution Sizer router.
Provides multi-horizon Bear, Base, Bull projections and quantitative trade tickets.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..services import scenario_forecast

router = APIRouter(prefix="/api/v1/forecast", tags=["forecast"])


@router.get("/scenarios/{symbol}")
def get_scenario_forecasts(
    symbol: str,
    exchange: str = Query("NSE", pattern="^(NSE|BSE)$"),
    capital: float = Query(500000.0, ge=1000.0, le=100000000.0),
    risk_pct: float = Query(1.0, ge=0.1, le=10.0),
):
    """
    Returns multi-horizon scenario forecasts across 6 quantitative algorithms,
    synthesized Arthdex Hybrid Consensus Index (AHCI), and institutional
    position sizing / execution ticket.
    """
    sym = symbol.upper()
    cache_key = f"forecast:scenarios:{exchange}:{sym}:{round(capital, -3)}:{risk_pct}"

    def compute():
        return scenario_forecast.compute_multialgo_forecasts(
            symbol=sym,
            exchange=exchange,
            portfolio_capital=capital,
            risk_pct=risk_pct,
        )

    try:
        # 15s TTL so real-time price changes flow through into execution tickets
        ttl = 15
        data, age = CACHE.get_or_fetch(cache_key, ttl, compute)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Scenario forecast engine unavailable: {exc}"
        ) from exc

    return envelope(
        data,
        age,
        source="NSE Direct Feeds, Option Chain & Multi-Algo Quant Engine",
        delayed_minutes=0,
        note=(
            "Consolidated multi-horizon forecasts derived from Merton Jump-Diffusion, "
            "GARCH(1,1), Black-Scholes Straddle, Auction Market Volume Profile, "
            "Holt-Winters ATR channels, and Wyckoff Liquidity Blocks."
        ),
    )
