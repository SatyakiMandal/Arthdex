"""Order-flow and options-exposure endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..services import options_gex, orderflow

router = APIRouter(prefix="/api/v1", tags=["orderflow"])


@router.get("/orderflow/{symbol}")
def get_orderflow(
    symbol: str,
    market: str = Query("nse", pattern="^(nse|futures|us)$"),
    interval: str = Query("5m"),
):
    """Volume profile, modelled delta/CVD/footprint, absorption and large-volume bars."""
    if interval not in orderflow.INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {list(orderflow.INTERVALS)}")
    sym = symbol.upper()
    try:
        orderflow.yahoo_symbol(sym, market)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    intraday = orderflow.INTERVALS[interval][3]

    def compute():
        return orderflow.build(sym, market, interval, orderflow.fetch_bars(sym, market, interval))

    try:
        data, age = CACHE.get_or_fetch(f"orderflow:{market}:{sym}:{interval}", 90 if intraday else 900, compute)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Order flow unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="Yahoo Finance",
        delayed_minutes=SETTINGS.quote_delay_minutes if market == "nse" else 10,
        note="Buy/sell split is modelled from bars; there is no tape or order-book depth in the free feed.",
    )


@router.get("/options/{symbol}/gex")
def get_gex(symbol: str):
    """Gamma, delta and theta exposure, open interest, walls and 0DTE share from listed option chains."""
    sym = symbol.upper()
    if sym not in options_gex.PROXY:
        raise HTTPException(status_code=400, detail=f"symbol must be one of {sorted(options_gex.PROXY)}")

    def compute():
        last = None
        if sym in options_gex.FUTURES_FOR:
            bars = orderflow.fetch_bars(sym, "futures", "1d")
            last = float(bars["Close"].iloc[-1]) if len(bars) else None
        return options_gex.build(sym, last)

    try:
        data, age = CACHE.get_or_fetch(f"options:gex:{sym}", 300, compute)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Options data unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="Yahoo Finance",
        delayed_minutes=15,
        note="Open interest is end-of-day. Dealer positioning is a modelled assumption, not a measurement.",
    )
