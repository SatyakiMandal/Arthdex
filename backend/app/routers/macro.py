"""Macroeconomic telemetry, RBI monetary policy indicators, and foreign exchange monitor."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..services import fx_live
from .. import not_connected
from ..services import macro_economics

router = APIRouter(prefix="/api/v1/macro", tags=["macro"])


@router.get("/dashboard")
def get_macro_dashboard():
    """India macroeconomic dashboard: CPI, WPI, GDP, IIP, GST collections, and BoP telemetry."""
    not_connected.refuse("macro-dashboard")
    try:
        data = macro_economics.get_macro_dashboard()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Macro dashboard unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="MOSPI, RBI DBIE, Ministry of Finance, Office of Economic Adviser",
        delayed_minutes=0,
        note="Official release data aggregated directly from central government and central bank feeds.",
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
