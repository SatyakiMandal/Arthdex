"""
Institutional Tear-Sheet & Research Notes Router.
Exposes endpoints for comprehensive company factsheet and research notes.
"""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..services import tear_sheet

router = APIRouter(tags=["tear-sheet"])

_SYMBOL_RE = re.compile(r"[A-Z0-9&_-]{1,20}")


_ShortText = Annotated[str, Field(max_length=200)]


class CreateResearchNoteRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, description="Headline thesis of the research note")
    author: str = Field(..., min_length=2, max_length=80, description="Analyst name")
    firm: str = Field(..., min_length=2, max_length=120, description="Institutional broker / research house")
    recommendation: Literal["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"]
    target_price: float = Field(..., gt=0, le=10_000_000, allow_inf_nan=False, description="Target price in ₹")
    horizon: str = Field("12 Months", max_length=40, description="Investment time horizon")
    key_catalysts: list[_ShortText] = Field(default_factory=list, max_length=12, description="Key growth catalysts")
    key_risks: list[_ShortText] = Field(default_factory=list, max_length=12, description="Key downside risks")
    tags: list[Annotated[str, Field(max_length=40)]] = Field(default_factory=list, max_length=12, description="Categorization tags")
    content: str = Field("", max_length=10_000, description="Detailed investment thesis narrative")


@router.get("/api/company/{symbol}/tear-sheet")
@router.get("/api/v1/company/{symbol}/tear-sheet")
def get_institutional_tear_sheet(symbol: str):
    """
    Two-page company factsheet: header, trading statistics, annual financials and growth,
    peer multiples, shareholding and pledge, and analyst estimates. Every figure is read
    from the same source as its tab on the company page; none is generated.
    """
    sym = symbol.upper()
    if not _SYMBOL_RE.fullmatch(sym):
        raise HTTPException(status_code=400, detail="Invalid symbol")

    def compute():
        return tear_sheet.get_company_tear_sheet(sym)

    try:
        data, age = CACHE.get_or_fetch(f"company:tearsheet:v2:{sym}", 300, compute)
    except tear_sheet.TearSheetUnavailable as exc:
        raise HTTPException(status_code=404, detail=f"No tear sheet for {sym}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Tear sheet unavailable: {exc}") from exc

    return envelope(
        data,
        age,
        source="NSE, Yahoo Finance, screener.in",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="Assembled from the company page's own data. Sections listed under 'unavailable' had no source response.",
    )


@router.get("/api/company/{symbol}/notes")
@router.get("/api/v1/company/{symbol}/notes")
def get_company_research_notes(symbol: str):
    """
    Returns list of institutional research notes and recommendations recorded for the symbol.
    """
    sym = symbol.upper()
    try:
        notes = tear_sheet.get_research_notes_for_symbol(sym)
        return envelope(
            {"symbol": sym, "count": len(notes), "notes": notes},
            0.0,
            source="Arthdex Institutional Research Notes Repository",
            delayed_minutes=0,
            note="Analyst notes recorded with time-stamped target prices and thesis.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Notes retrieval error: {exc}") from exc


@router.post("/api/company/{symbol}/notes")
@router.post("/api/v1/company/{symbol}/notes")
def create_company_research_note(symbol: str, request: CreateResearchNoteRequest):
    """
    Creates and stores a new institutional research note for the given symbol.
    """
    sym = symbol.upper()
    if not _SYMBOL_RE.fullmatch(sym):
        raise HTTPException(status_code=400, detail="Invalid symbol")
    try:
        note = tear_sheet.add_research_note(
            symbol=sym,
            title=request.title,
            author=request.author,
            firm=request.firm,
            recommendation=request.recommendation,
            target_price=request.target_price,
            horizon=request.horizon,
            key_catalysts=request.key_catalysts,
            key_risks=request.key_risks,
            tags=request.tags,
            content=request.content,
        )
        return envelope(
            note,
            0.0,
            source="Arthdex Research Note Authoring Engine",
            delayed_minutes=0,
            note="Research note successfully saved.",
        )
    except tear_sheet.NoteStoreFull as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save note: {exc}") from exc
