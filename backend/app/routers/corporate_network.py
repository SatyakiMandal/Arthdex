"""
Corporate Network, Conglomerate Hierarchy & Supply Chain Router (SPLC, HOLD, REL).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..schemas import envelope
from ..services import corporate_network

router = APIRouter(prefix="/api/v1/network", tags=["network"])


@router.get("/hierarchy")
def get_hierarchy(symbol: str = Query("M&M", description="NSE equity symbol")):
    """Returns the conglomerate corporate structure tree for a given symbol (HOLD)."""
    try:
        data = corporate_network.get_hierarchy_cached(symbol)
    except corporate_network.NetworkNotOnFile as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Corporate hierarchy unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="Compiled by hand from company annual reports",
        delayed_minutes=0,
        note="Hand-compiled and not machine-checked against filings; stakes and revenue shares may be out of date.",
    )


@router.get("/supply-chain")
def get_supply_chain(symbol: str = Query("M&M", description="NSE equity symbol")):
    """Returns the multi-tier supply chain and customer network for a given symbol (SPLC)."""
    try:
        data = corporate_network.get_supply_chain_cached(symbol)
    except corporate_network.NetworkNotOnFile as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Supply chain network unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="Compiled by hand from company annual reports",
        delayed_minutes=0,
        note="Hand-compiled. Supplier dependency and cost shares are estimates unless marked ACTUAL FILING; companies do not disclose them in full.",
    )


@router.get("/summary")
def get_summary(symbol: str = Query("M&M", description="NSE equity symbol")):
    """Returns high-level supply chain and conglomerate summary metrics."""
    try:
        data = corporate_network.get_summary_cached(symbol)
    except corporate_network.NetworkNotOnFile as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Network summary unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="Compiled by hand from company annual reports",
        delayed_minutes=0,
        note="Supplier counts, dependency metrics, and provenance breakdown.",
    )
