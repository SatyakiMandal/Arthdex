"""NSE Emerge (SME) board: live listings, a screener over them, and the SME IPO pipeline."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import nse
from ..schemas import envelope
from ..services import ipo as ipo_service
from ..services import sme_live

router = APIRouter(tags=["sme"])

BOARD_TTL = 120
SOURCE = "NSE (live-analysis-stocksTraded, series SM and ST)"


EMERGE_MASTER_URL = "https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv"


def _emerge_names() -> list[dict[str, str]]:
    """Company names from NSE's Emerge master list. A convenience: the board stands without them."""

    def fetch():
        response = nse._get_session().get(EMERGE_MASTER_URL, timeout=20)
        response.raise_for_status()
        return sme_live.parse_master(response.text)

    try:
        return CACHE.get_or_fetch("sme:names:v1", 86_400, fetch)[0]
    except Exception:
        return []


def _board() -> tuple[dict, float]:
    def compute():
        traded = nse.fetch_stocks_traded()
        return sme_live.board(traded, _emerge_names())

    try:
        return CACHE.get_or_fetch("sme:board:v3", BOARD_TTL, compute)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"SME board unavailable: {exc}") from exc


@router.get("/api/sme/overview")
@router.get("/api/v1/sme/overview")
def get_sme_exchange_overview():
    """Counts, market cap, turnover, breadth and the session's leaders on NSE Emerge."""
    data, age = _board()
    return envelope(
        {k: v for k, v in data.items() if k != "rows"},
        age,
        source=SOURCE,
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="NSE Emerge only. See 'unavailable' for what the feed does not carry.",
    )


@router.get("/api/sme/screener")
@router.get("/api/v1/sme/screener")
def screen_sme_stocks(
    min_market_cap_cr: float | None = Query(None, ge=0, le=1e7),
    max_market_cap_cr: float | None = Query(None, ge=0, le=1e7),
    min_turnover_cr: float | None = Query(None, ge=0, le=1e6),
    sort: Literal["marketCapCr", "turnoverCr", "changePct", "volume"] = Query("marketCapCr"),
    limit: int = Query(200, ge=1, le=1000),
):
    """Emerge securities traded this session, filtered by size and liquidity."""
    data, age = _board()
    rows = sme_live.screen(data["rows"], min_market_cap_cr, max_market_cap_cr, min_turnover_cr, sort, limit)
    return envelope(
        {"asOf": data["asOf"], "total": data["count"], "matched": len(rows), "rows": rows},
        age,
        source=SOURCE,
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="Price, volume and market cap only: the exchange feed carries no fundamentals for SME companies.",
    )


@router.get("/api/sme/ipos")
@router.get("/api/v1/sme/ipos")
def get_sme_ipos(status: Literal["all", "ongoing", "upcoming", "closed", "listed"] = Query("all")):
    """SME issues from the IPO pipeline, exactly as NSE lists them."""
    try:
        pipeline, age = CACHE.get_or_fetch("ipo:pipeline", SETTINGS.ipo_ttl, ipo_service.build_pipeline)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"IPO pipeline unavailable: {exc}") from exc
    return envelope(
        sme_live.sme_ipos(pipeline, status),
        age,
        source="NSE IPO listings",
        delayed_minutes=0,
        note="Grey-market premium is not shown: it is an unofficial quote that no exchange publishes.",
    )


@router.get("/api/sme/migrations")
@router.get("/api/v1/sme/migrations")
def get_mainboard_migrations():
    """Not offered: the inputs to the eligibility test are not in any connected source."""
    raise HTTPException(status_code=404, detail=sme_live.UNAVAILABLE["migration"])
