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
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Corporate hierarchy unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="Audited Annual Reports (Related Party Disclosures Note 34), NSE & MCA",
        delayed_minutes=0,
        note="Consolidated holdings, listed associates, wholly owned subsidiaries, and JVs.",
    )


@router.get("/supply-chain")
def get_supply_chain(symbol: str = Query("M&M", description="NSE equity symbol")):
    """Returns the multi-tier supply chain and customer network for a given symbol (SPLC)."""
    try:
        data = corporate_network.get_supply_chain_cached(symbol)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Supply chain network unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="Exchange LODR filings, Annual Report Notes to Accounts, and Procurement disclosures",
        delayed_minutes=0,
        note="Multi-tier suppliers, customer volume breakdown, and critical sole-source bottlenecks.",
    )


@router.get("/summary")
def get_summary(symbol: str = Query("M&M", description="NSE equity symbol")):
    """Returns high-level supply chain and conglomerate summary metrics."""
    try:
        data = corporate_network.get_summary_cached(symbol)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Network summary unavailable: {exc}") from exc
    return envelope(
        data,
        3600,
        source="Arthdex Corporate Network Intelligence",
        delayed_minutes=0,
        note="Supplier counts, dependency metrics, and provenance breakdown.",
    )
