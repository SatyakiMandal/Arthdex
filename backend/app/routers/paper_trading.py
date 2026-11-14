"""Paper trading execution, virtual margin accounts, and statutory contract note simulator."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..schemas import envelope
from ..services import paper_trading

router = APIRouter(prefix="/api/v1/paper", tags=["paper"])

MAX_TRADE_VALUE = 1e11  # Rs 10,000 crore: far above any paper order, well inside float precision


class _PaperRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    action: Literal["BUY", "SELL"] = "BUY"
    product: Literal["CNC", "MIS"] = "CNC"

    @field_validator("action", "product", mode="before")
    @classmethod
    def _upper(cls, value):
        return value.upper() if isinstance(value, str) else value


class ChargesRequest(_PaperRequest):
    tradeValue: float = Field(0.0, ge=0, le=MAX_TRADE_VALUE, allow_inf_nan=False)


class OrderRequest(_PaperRequest):
    symbol: str = Field("RELIANCE", min_length=1, max_length=20, pattern=r"^[A-Za-z0-9&_-]+$")
    quantity: int = Field(1, gt=0, le=1_000_000)
    price: float = Field(100.0, gt=0, le=10_000_000, allow_inf_nan=False)


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
def calculate_charges(payload: ChargesRequest):
    """Computes exact Indian statutory charges (STT, GST, Stamp Duty, Exchange Turnover) for a potential order."""
    trade_value = payload.tradeValue
    action = payload.action
    product = payload.product

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
def place_paper_order(payload: OrderRequest):
    """Simulates placing and executing an order in the virtual paper account."""
    symbol = payload.symbol.upper()
    action = payload.action
    quantity = payload.quantity
    price = payload.price
    product = payload.product

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
