"""Market-wide endpoints: indices, movers, global sentiment."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import nse, yahoo
from ..services import bhavcopy, commodities
from ..schemas import envelope

router = APIRouter(prefix="/api/v1/market", tags=["market"])


@router.get("/indices")
def get_indices():
    """Broad, sectoral and thematic NSE indices for the ticker bar."""
    try:
        data, age = CACHE.get_or_fetch("market:indices", SETTINGS.index_ttl, nse.fetch_indices)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"NSE indices unavailable: {exc}") from exc
    return envelope(data, age, source="NSE (nseindia.com public API)", delayed_minutes=1)


@router.get("/mover-universes")
def get_mover_universes():
    """Selectable universes for the movers table, for building a UI selector."""
    return {
        "default": nse.DEFAULT_MOVER_UNIVERSE,
        "universes": [
            {"id": key, "label": label} for key, (_nse_key, label) in nse.MOVER_UNIVERSES.items()
        ],
    }


@router.get("/movers")
def get_movers(
    direction: str = Query("gainers", pattern="^(gainers|losers)$"),
    universe: str = Query(nse.DEFAULT_MOVER_UNIVERSE),
    limit: int = Query(15, ge=1, le=50),
):
    """
    Top gainers or losers for a chosen universe.

    NSE publishes daily variations only. Weekly and monthly windows are computed
    in the screener service from historical candles, not here.
    """
    if universe not in nse.MOVER_UNIVERSES:
        raise HTTPException(
            status_code=400,
            detail=f"universe must be one of {sorted(nse.MOVER_UNIVERSES)}",
        )

    key = f"market:movers:{direction}:{universe}"
    try:
        data, age = CACHE.get_or_fetch(
            key, SETTINGS.movers_ttl, lambda: nse.fetch_movers(direction, universe)
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"NSE movers unavailable: {exc}") from exc

    ordered = sorted(
        data,
        key=lambda r: r["change"]["percent"],
        reverse=direction == "gainers",
    )
    rows = ordered[:limit]
    # Delivery is only published after the close, so this is the last completed session
    try:
        session = bhavcopy.latest_session()
        deliv = bhavcopy.delivery_map(session) if session else {}
    except Exception:
        session, deliv = None, {}
    rows = [
        {**r, "deliveryPct": deliv.get(r["symbol"]), "deliveryDate": session.isoformat() if session else None}
        for r in rows
    ]
    return envelope(
        rows,
        age,
        source="NSE live analysis",
        delayed_minutes=1,
        note=f"Universe: {nse.MOVER_UNIVERSES[universe][1]}. Rights entitlements excluded.",
    )


@router.get("/global")
def get_global_indices():
    """Overnight global cues."""
    try:
        data, age = CACHE.get_or_fetch(
            "market:global", SETTINGS.index_ttl, yahoo.fetch_global_indices
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Global indices unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance", delayed_minutes=15)


@router.get("/commodities")
def get_commodities():
    """Metals, energy and agricultural futures with multi-horizon changes."""
    try:
        data, age = CACHE.get_or_fetch("market:commodities", 600, commodities.fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Commodities unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="Yahoo Finance (front-month futures)",
        delayed_minutes=15,
        note="US-dollar futures from COMEX, NYMEX, CBOT and ICE, not MCX prices. Rupee equivalents exclude duty, GST and premiums.",
    )
