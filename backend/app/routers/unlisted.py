"""Unlisted / pre-IPO share endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..cache import CACHE
from ..schemas import envelope
from ..services import unlisted as unlisted_service

router = APIRouter(prefix="/api/v1/unlisted", tags=["unlisted"])

# The source revises prices a few times a month and the directory is a dozen
# paginated fetches at a polite 2-second spacing, so neither is worth refreshing often.
DIRECTORY_TTL = unlisted_service.DIRECTORY_TTL
COMPANY_TTL = 3 * 3600

SOURCE = "UnlistedZone indicative prices"
NOTE = (
    "Indicative levels compiled by the dealer site, not exchange prices or executable quotes. "
    "Unlisted shares are illiquid and settle off-exchange."
)


@router.get("")
def get_directory():
    try:
        data, age = CACHE.get_or_fetch(unlisted_service.DIRECTORY_KEY, DIRECTORY_TTL, unlisted_service.build_directory)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Unlisted directory unavailable: {exc}") from exc
    return envelope(data, age, source=SOURCE, note=NOTE)


@router.get("/{slug}")
def get_company(slug: str):
    if not unlisted_service.SLUG_RE.match(slug):
        raise HTTPException(status_code=404, detail="Unknown unlisted company")
    try:
        data, age = CACHE.get_or_fetch(f"unlisted:{slug}", COMPANY_TTL, lambda: unlisted_service.build_company(slug))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Unlisted company unavailable: {exc}") from exc
    return envelope({**data, "lifecycle": unlisted_service.lifecycle_for(data["name"], data.get("isin"))}, age, source=SOURCE, note=NOTE)
