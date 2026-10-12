"""Track record of the platform's own calls."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..cache import CACHE
from ..schemas import envelope
from ..services import decision_log

router = APIRouter(prefix="/api/v1/decisions", tags=["decisions"])
SYMBOL = re.compile(r"^[A-Z0-9&_-]{1,20}$")


class NewDecision(BaseModel):
    symbol: str


@router.get("")
def list_decisions():
    try:
        data, age = CACHE.get_or_fetch("decisions:list", 120, decision_log.listing)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Track record unavailable: {exc}") from exc
    return envelope(data, age, source="Arthdex log scored against Yahoo Finance closes", delayed_minutes=0)


@router.post("", status_code=201)
def create_decision(body: NewDecision):
    sym = body.symbol.strip().upper()
    if not SYMBOL.match(sym):
        raise HTTPException(status_code=400, detail="Invalid symbol")
    try:
        data = decision_log.add(sym)
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OverflowError as exc:
        raise HTTPException(status_code=507, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Could not log the call: {exc}") from exc
    CACHE.expire("decisions:list")
    return envelope(data, 0, source="Yahoo Finance daily bars", delayed_minutes=0)


@router.delete("/{decision_id}")
def delete_decision(decision_id: int):
    if not decision_log.remove(decision_id):
        raise HTTPException(status_code=404, detail="No such call")
    CACHE.expire("decisions:list")
    return {"deleted": decision_id}
