"""Ownership network: each company's named shareholders, read from its exchange filing."""

from __future__ import annotations

import re
import urllib.parse

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..providers import nse
from ..schemas import envelope
from ..services import ownership_live

router = APIRouter(prefix="/api/v1/network", tags=["network"])

_SYMBOL_RE = re.compile(r"[A-Z0-9&_-]{1,20}")
OWNERSHIP_TTL = 12 * 3600  # filings change once a quarter


def _universe() -> list[dict]:
    """Listed-company names for linking holders to their own pages. A convenience only."""
    try:
        from .search import load_universe

        return load_universe()[0]
    except Exception:
        return []


@router.get("/ownership")
def get_ownership(symbol: str = Query(..., min_length=1, max_length=20, description="NSE symbol")):
    """Promoters, promoter-group entities and public holders above 1%, as filed with the exchange."""
    sym = symbol.upper().strip()
    if not _SYMBOL_RE.fullmatch(sym):
        raise HTTPException(status_code=400, detail="Invalid symbol")

    def fetch():
        filings = nse.nse_get(f"/api/corporate-share-holdings-master?index=equities&symbol={urllib.parse.quote(sym, safe='')}") or []
        session = nse._get_session()

        def get_text(url: str) -> str:
            response = session.get(url, timeout=60)
            response.raise_for_status()
            return response.text

        return ownership_live.build(sym, filings, get_text, _universe())

    try:
        data, age = CACHE.get_or_fetch(f"network:ownership:v1:{sym}", OWNERSHIP_TTL, fetch)
    except ownership_live.OwnershipUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Shareholding filing unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="NSE shareholding pattern filing (XBRL)",
        delayed_minutes=0,
        note=f"As filed for the quarter ended {data.get('asOf')}. Names and stakes are the company's own disclosure.",
    )
