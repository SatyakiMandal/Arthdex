"""NSE Bhavcopy: market-wide delivery, breadth and volume analysis."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..schemas import envelope
from ..services import bhavcopy as svc

router = APIRouter(prefix="/api/v1/bhavcopy", tags=["bhavcopy"])

SOURCE = "NSE security-wise Bhavcopy (nsearchives.nseindia.com)"


@router.get("")
def get_bhavcopy(on: date | None = Query(None, description="Trading date; defaults to the latest session")):
    try:
        session = svc.latest_session() if on is None else (on if svc.load_day(on) is not None else None)
        if session is None:
            raise HTTPException(
                status_code=404,
                detail="NSE has no Bhavcopy for that date (weekend, holiday, or not yet published).",
            )
        data, age = CACHE.get_or_fetch(f"bhav:analysis:{session}", 3600, lambda: svc.analyse(session))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Bhavcopy unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source=SOURCE,
        note="Band moves are inferred from the size of the close-to-close move; the file does not carry each stock's price band.",
    )
