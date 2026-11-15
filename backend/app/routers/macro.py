"""Macro endpoints: the RBI's rupee reference rates; indicators are refused until sourced."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..cache import CACHE
from ..not_sourced import refuse
from ..schemas import envelope
from ..services import macro_economics

router = APIRouter(prefix="/api/v1/macro", tags=["macro"])


@router.get("/dashboard")
def get_macro_dashboard():
    refuse(
        "The macro dashboard",
        "CPI, GDP, IIP, GST collections and the current account as each agency releases them",
        "MOSPI, the RBI and the GST Council publish releases and PDFs; no reader for them is written yet",
    )


@router.get("/forex")
def get_forex_monitor():
    """The RBI's reference rates for the rupee, with day-on-day changes from stored snapshots."""
    try:
        data = macro_economics.get_forex_monitor()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"RBI reference rates unavailable: {exc}") from exc
    return envelope(
        data,
        CACHE.age("macro:forex:inr") or 0.0,
        source="Reserve Bank of India reference rates (rbi.org.in)",
        delayed_minutes=0,
        note="The RBI's latest published reference rates. Changes are against Arthdex's own earlier snapshot, shown once one exists.",
    )
