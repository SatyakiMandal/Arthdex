"""Macroeconomic telemetry, RBI monetary policy indicators, and foreign exchange monitor."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..services import fx_live, macro_live

router = APIRouter(prefix="/api/v1/macro", tags=["macro"])


@router.get("/dashboard")
def get_macro_dashboard():
    """GDP growth, consumer inflation and industrial production from MOSPI, and RBI's policy rates."""
    try:
        data, age = CACHE.get_or_fetch("macro:dashboard:v2", 6 * 3600, macro_live.fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Macro data unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="MOSPI (api.mospi.gov.in); Reserve Bank of India",
        delayed_minutes=0,
        note="Each figure is shown with the period it refers to. MOSPI's API can trail the latest press release.",
    )


@router.get("/forex")
def get_forex_monitor():
    """Rupee spot cross rates with day, one-month and one-year changes."""
    try:
        data, age = CACHE.get_or_fetch("macro:forex:v2", 300, fx_live.fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Forex rates unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="Yahoo Finance currency quotes",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="Market spot quotes, not FBIL reference rates. Forward premia and REER are not available.",
    )
