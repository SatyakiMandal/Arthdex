"""
Institutional Tear-Sheet & Research Notes Router.
Exposes endpoints for comprehensive company factsheet and research notes.
"""

from __future__ import annotations

from typing import Any, Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..cache import CACHE
from ..schemas import envelope
from ..services import tear_sheet

router = APIRouter(tags=["tear-sheet"])


class CreateResearchNoteRequest(BaseModel):
    title: str = Field(..., min_length=3, description="Headline thesis of the research note")
    author: str = Field(..., min_length=2, description="Analyst name")
    firm: str = Field(..., min_length=2, description="Institutional broker / research house")
    recommendation: Literal["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"]
    target_price: float = Field(..., gt=0, description="Target price in ₹")
    horizon: str = Field("12 Months", description="Investment time horizon")
    key_catalysts: list[str] = Field(default_factory=list, description="Key growth catalysts")
    key_risks: list[str] = Field(default_factory=list, description="Key downside risks")
    tags: list[str] = Field(default_factory=list, description="Categorization tags")
    content: str = Field("", description="Detailed investment thesis narrative")


@router.get("/api/company/{symbol}/tear-sheet")
@router.get("/api/v1/company/{symbol}/tear-sheet")
def get_institutional_tear_sheet(symbol: str):
    """
    Returns Goldman Sachs / Jefferies style 2-page institutional factsheet:
    header, trading stats, 10-year financials summary, peer multiples,
    shareholding & pledge trend, and consensus forecasts.
    """
    sym = symbol.upper()
    cache_key = f"company:tearsheet:{sym}"

    def compute():
        return tear_sheet.get_company_tear_sheet(sym)

    try:
        data, age = CACHE.get_or_fetch(cache_key, 60, compute)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Tear-Sheet error: {exc}") from exc

    return envelope(
        data,
        age,
        source="NSE Filings, Screener Financials & Institutional Consensus",
        delayed_minutes=0,
        note="Institutional tear-sheet conforms to SEBI research analyst reporting disclosures.",
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save note: {exc}") from exc
