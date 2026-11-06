"""
Root re-export for Tear Sheet services and models.
"""

from __future__ import annotations

try:
    from app.services.tear_sheet import (
        TAG_ACTUAL,
        TAG_CONSENSUS,
        TAG_MODELLED,
        TEAR_SHEET_CURATED_DATA,
        ResearchNote,
        add_research_note,
        get_company_tear_sheet,
        get_research_notes_for_symbol,
    )
except ImportError:
    from backend.app.services.tear_sheet import (
        TAG_ACTUAL,
        TAG_CONSENSUS,
        TAG_MODELLED,
        TEAR_SHEET_CURATED_DATA,
        ResearchNote,
        add_research_note,
        get_company_tear_sheet,
        get_research_notes_for_symbol,
    )

__all__ = [
    "TAG_ACTUAL",
    "TAG_CONSENSUS",
    "TAG_MODELLED",
    "TEAR_SHEET_CURATED_DATA",
    "ResearchNote",
    "add_research_note",
    "get_company_tear_sheet",
    "get_research_notes_for_symbol",
]
