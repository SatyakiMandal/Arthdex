"""Primary-market endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..services import ipo as ipo_service

router = APIRouter(prefix="/api/v1/ipo", tags=["ipo"])


@router.get("")
def get_pipeline(
    segment: str | None = Query(None, pattern="^(mainboard|sme)$"),
    status: str | None = Query(None, pattern="^(ongoing|upcoming|closed|listed)$"),
):
    """Ongoing, upcoming, closed and listed issues, optionally filtered."""
    try:
        data, age = CACHE.get_or_fetch(
            "ipo:pipeline", SETTINGS.ipo_ttl, ipo_service.build_pipeline
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"IPO pipeline unavailable: {exc}") from exc

    issues = data["issues"]
    if segment:
        issues = [i for i in issues if i["segment"] == segment]
    if status:
        issues = [i for i in issues if i["status"] == status]

    return envelope(
        {**data, "issues": issues},
        age,
        source="NSE IPO desk; listing performance from Yahoo Finance",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="Grey-market premium and DRHP-stage issues have no live source; see `unavailable`.",
    )


@router.get("/{issue_id}")
def get_issue(issue_id: str):
    try:
        data, age = CACHE.get_or_fetch(
            "ipo:pipeline", SETTINGS.ipo_ttl, ipo_service.build_pipeline
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"IPO pipeline unavailable: {exc}") from exc

    match = next((i for i in data["issues"] if i["id"] == issue_id.lower()), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"No tracked issue with id '{issue_id}'")

    return envelope(
        match,
        age,
        source="NSE IPO desk; listing performance from Yahoo Finance",
        delayed_minutes=SETTINGS.quote_delay_minutes,
    )
