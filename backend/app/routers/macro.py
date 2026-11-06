"""Macroeconomic telemetry, RBI monetary policy indicators, and foreign exchange monitor."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import envelope
from ..services import macro_economics

router = APIRouter(prefix="/api/v1/macro", tags=["macro"])


@router.get("/dashboard")
def get_macro_dashboard():
    """India macroeconomic dashboard: CPI, WPI, GDP, IIP, GST collections, and BoP telemetry."""
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
    """Foreign exchange cross-rates against INR, forward premia, and RBI REER/NEER indices."""
    try:
        data = macro_economics.get_forex_monitor()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Forex monitor unavailable: {exc}") from exc
    return envelope(
        data,
        120,
        source="FBIL reference rates & RBI forex bulletin",
        delayed_minutes=0,
        note="FBIL reference rates published daily at 13:30 IST; forward premia computed from OTC interbank quotes.",
    )
