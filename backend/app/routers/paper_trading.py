"""Paper trading execution, virtual margin accounts, and statutory contract note simulator."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..schemas import envelope
from ..services import paper_trading

router = APIRouter(prefix="/api/v1/paper", tags=["paper"])


@router.get("/account")
def get_paper_account():
    """Returns the current state of the virtual ₹10,00,000 cash account, positions, and orders."""
    try:
        data = paper_trading.get_virtual_account()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Paper trading account unavailable: {exc}") from exc
    return envelope(
        data,
        0,
        source="Arthdex Virtual Execution Engine & Ledger",
        delayed_minutes=0,
        note="Virtual simulation account initialized with ₹10,00,000 capital; real-time mark-to-market.",
    )


@router.post("/calculate-charges")
def calculate_charges(payload: dict[str, Any]):
    """Computes exact Indian statutory charges (STT, GST, Stamp Duty, Exchange Turnover) for a potential order."""
    trade_value = float(payload.get("tradeValue", 0.0))
    action = payload.get("action", "BUY").upper()
    product = payload.get("product", "CNC").upper()

    charges = paper_trading.calculate_regulatory_charges(
        trade_value=trade_value,
        action=action,
        product=product,
    )
    return envelope(
        charges,
        0,
        source="Arthdex Statutory Cost Calculator",
        delayed_minutes=0,
    )


@router.post("/order")
def place_paper_order(payload: dict[str, Any]):
    """Simulates placing and executing an order in the virtual paper account."""
    symbol = payload.get("symbol", "RELIANCE").upper()
    action = payload.get("action", "BUY").upper()
    quantity = int(payload.get("quantity", 1))
    price = float(payload.get("price", 100.0))
    product = payload.get("product", "CNC").upper()

    res = paper_trading.execute_paper_order(
        symbol=symbol,
        action=action,
        quantity=quantity,
        price=price,
        product=product,
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Order execution failed"))

    return envelope(
        res,
        0,
        source="Arthdex Paper Execution Matching Engine",
        delayed_minutes=0,
    )
