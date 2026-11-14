"""
Company tear sheet and research notes.

The sheet itself is assembled in tear_sheet_live from the figures the company page already
serves. This module keeps the research-note store (in memory, capped) and the entry point.
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Literal

TAG_ACTUAL = "[ACTUAL FILING]"
TAG_MODELLED = "[MODELLED / ALGORITHMIC]"
TAG_CONSENSUS = "[CONSENSUS ESTIMATE]"

from . import tear_sheet_live  # noqa: E402
from .tear_sheet_live import TearSheetUnavailable  # noqa: E402,F401


@dataclass
class ResearchNote:
    id: str
    symbol: str
    title: str
    author: str
    firm: str
    recommendation: Literal["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"]
    target_price: float
    horizon: str
    key_catalysts: list[str]
    key_risks: list[str]
    tags: list[str]
    content: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# In-memory thread-safe store for research notes
_NOTES_LOCK = threading.Lock()
_RESEARCH_NOTES_STORE: dict[str, list[ResearchNote]] = {}


def get_research_notes_for_symbol(symbol: str) -> list[dict[str, Any]]:
    """Returns stored institutional research notes for a company."""
    sym = symbol.upper()
    with _NOTES_LOCK:
        notes = _RESEARCH_NOTES_STORE.get(sym, [])
        return [n.to_dict() for n in notes]


MAX_NOTES_PER_SYMBOL = 50
MAX_NOTE_SYMBOLS = 500


class NoteStoreFull(Exception):
    """The in-memory note store has reached its cap for new symbols."""


def add_research_note(
    symbol: str,
    title: str,
    author: str,
    firm: str,
    recommendation: Literal["BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL"],
    target_price: float,
    horizon: str = "12 Months",
    key_catalysts: list[str] | None = None,
    key_risks: list[str] | None = None,
    tags: list[str] | None = None,
    content: str = "",
) -> dict[str, Any]:
    """Adds and persists a new institutional research note."""
    sym = symbol.upper()
    note_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    note = ResearchNote(
        id=note_id,
        symbol=sym,
        title=title,
        author=author,
        firm=firm,
        recommendation=recommendation,
        target_price=round(target_price, 2),
        horizon=horizon,
        key_catalysts=key_catalysts or [],
        key_risks=key_risks or [],
        tags=tags or [],
        content=content,
        created_at=now_iso,
        updated_at=now_iso,
    )

    with _NOTES_LOCK:
        if sym not in _RESEARCH_NOTES_STORE:
            if len(_RESEARCH_NOTES_STORE) >= MAX_NOTE_SYMBOLS:
                raise NoteStoreFull("Research note store is full")
            _RESEARCH_NOTES_STORE[sym] = []
        _RESEARCH_NOTES_STORE[sym].insert(0, note)
        # Memory-backed store: keep the newest notes per company so it cannot grow without bound
        del _RESEARCH_NOTES_STORE[sym][MAX_NOTES_PER_SYMBOL:]

    return note.to_dict()


def get_company_tear_sheet(symbol: str) -> dict[str, Any]:
    """
    Tear sheet for a listed company, assembled from the vetted figures behind the company
    page (see tear_sheet_live). Raises TearSheetUnavailable when the symbol has no quote.
    """
    sym = symbol.upper()
    sheet = tear_sheet_live.build(sym)
    sheet["latest_research_notes"] = get_research_notes_for_symbol(sym)[:3]
    return sheet
