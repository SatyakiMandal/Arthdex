"""
Virtual Execution Simulator and Indian Regulatory Cost Engine (Bloomberg EMSX / PAPR equivalent).

Features:
- Realistic Indian statutory charges calculator:
  * Brokerage: Flat ₹20 or 0.03% (standard discount broker pricing)
  * STT / CTT: 0.1% for Delivery CNC buy & sell; 0.025% for Intraday MIS sell
  * Exchange Turnover: 0.00297% (NSE Equity)
  * Stamp Duty: 0.015% on Buy orders
  * SEBI Charges: ₹10 per crore (0.0001%)
  * GST: 18% on (Brokerage + Exchange Turnover + SEBI Charges)
- Virtual ₹10,00,000 cash balance account with realistic portfolio mark-to-market
- Live order fill simulator with fill price, execution slips, and contract notes
"""

from __future__ import annotations

import logging
import math
import threading
import uuid
from datetime import datetime
from typing import Any, Literal

logger = logging.getLogger(__name__)

INITIAL_CASH_BALANCE = 1000000.0  # ₹10 Lakh Virtual Capital
MAX_ORDER_HISTORY = 200  # the blotter keeps the most recent fills only

# One writer at a time: the account is a module-level dict shared by every request thread
_ACCOUNT_LOCK = threading.RLock()

# In-memory virtual account state. It starts as cash only: positions and fills appear when
# the user places paper orders, never from sample data.
VIRTUAL_ACCOUNT: dict[str, Any] = {
    "cashBalance": INITIAL_CASH_BALANCE,
    "initialCapital": INITIAL_CASH_BALANCE,
    "marginUsed": 0.0,
    "realizedPnl": 0.0,
    "positions": [],
    "orders": [],
}


def calculate_regulatory_charges(
    trade_value: float,
    action: Literal["BUY", "SELL"],
    product: Literal["CNC", "MIS"] = "CNC",
) -> dict[str, float]:
    """
    Computes exact statutory charges for Indian equity transactions:
    - Brokerage: min(20.0, trade_value * 0.0003)
    - STT: 0.1% on delivery (CNC); 0.025% on intraday sell (MIS)
    - Exchange Turnover: 0.00297%
    - Stamp Duty: 0.015% on Buy only
    - SEBI Turnover: 0.0001% (₹10 / Crore)
    - GST: 18% on (Brokerage + Exchange Turnover + SEBI Charges)
    """
    act = action.upper()
    prod = product.upper()

    brokerage = min(20.0, round(trade_value * 0.0003, 2))

    if prod == "CNC":
        stt = round(trade_value * 0.001, 2)  # 0.1% for delivery buy/sell
    else:  # MIS Intraday
        stt = round(trade_value * 0.00025, 2) if act == "SELL" else 0.0

    exchange_turnover = round(trade_value * 0.0000297, 2)
    stamp_duty = round(trade_value * 0.00015, 2) if act == "BUY" else 0.0
    sebi_charges = round(trade_value * 0.000001, 2)

    gst_base = brokerage + exchange_turnover + sebi_charges
    gst = round(gst_base * 0.18, 2)

    total_charges = round(brokerage + stt + exchange_turnover + stamp_duty + sebi_charges + gst, 2)

    net_cash_flow = -(trade_value + total_charges) if act == "BUY" else (trade_value - total_charges)

    return {
        "tradeValue": round(trade_value, 2),
        "brokerage": brokerage,
        "stt": stt,
        "exchangeTurnover": exchange_turnover,
        "stampDuty": stamp_duty,
        "sebiCharges": sebi_charges,
        "gst": gst,
        "totalCharges": total_charges,
        "netCashFlow": round(net_cash_flow, 2),
        "breakevenBps": round((total_charges / trade_value) * 10000, 1) if trade_value > 0 else 0.0,
    }


def get_virtual_account() -> dict[str, Any]:
    """Returns the current state of the virtual paper trading account."""
    positions = VIRTUAL_ACCOUNT["positions"]
    total_invested = sum(p["investedValue"] for p in positions)
    total_current = sum(p["currentValue"] for p in positions)
    total_unrealized_pnl = round(total_current - total_invested, 2)

    total_portfolio_value = round(VIRTUAL_ACCOUNT["cashBalance"] + total_current, 2)
    overall_pnl = round(total_portfolio_value - VIRTUAL_ACCOUNT["initialCapital"], 2)

    return {
        "asOf": datetime.now().isoformat(),
        "cashBalance": round(VIRTUAL_ACCOUNT["cashBalance"], 2),
        "marginUsed": round(total_invested, 2),
        "portfolioValue": total_portfolio_value,
        "unrealizedPnl": total_unrealized_pnl,
        "realizedPnl": round(VIRTUAL_ACCOUNT["realizedPnl"], 2),
        "overallPnl": overall_pnl,
        "initialCapital": VIRTUAL_ACCOUNT["initialCapital"],
        "positions": positions,
        "orders": VIRTUAL_ACCOUNT["orders"],
    }


def execute_paper_order(
    symbol: str,
    action: Literal["BUY", "SELL"],
    quantity: int,
    price: float,
    product: Literal["CNC", "MIS"] = "CNC",
) -> dict[str, Any]:
    """Simulates an order fill in the virtual paper trading account."""
    sym = symbol.upper()
    act = action.upper()
    prod = product.upper()
    # A negative quantity on a BUY would credit cash, and a NaN price would poison every
    # later balance, so the engine refuses them itself rather than trusting its callers.
    if act not in ("BUY", "SELL") or prod not in ("CNC", "MIS"):
        return {"success": False, "error": "Action must be BUY or SELL and product CNC or MIS"}
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
        return {"success": False, "error": "Quantity must be a positive whole number"}
    if not isinstance(price, (int, float)) or not math.isfinite(price) or price <= 0:
        return {"success": False, "error": "Price must be a positive number"}
    with _ACCOUNT_LOCK:
        return _fill_order(sym, act, quantity, float(price), prod)


def _fill_order(sym: str, act: str, quantity: int, price: float, prod: str) -> dict[str, Any]:
    trade_val = quantity * price

    charges = calculate_regulatory_charges(trade_val, act, prod)

    if act == "BUY":
        required_funds = trade_val + charges["totalCharges"]
        if required_funds > VIRTUAL_ACCOUNT["cashBalance"]:
            return {
                "success": False,
                "error": f"Insufficient virtual cash balance. Required: ₹{required_funds:,.2f}, Available: ₹{VIRTUAL_ACCOUNT['cashBalance']:,.2f}",
            }
        VIRTUAL_ACCOUNT["cashBalance"] -= required_funds

        # Check existing position
        pos = next((p for p in VIRTUAL_ACCOUNT["positions"] if p["symbol"] == sym and p["product"] == prod), None)
        if pos:
            new_qty = pos["quantity"] + quantity
            new_invested = pos["investedValue"] + trade_val
            pos["quantity"] = new_qty
            pos["investedValue"] = round(new_invested, 2)
            pos["averagePrice"] = round(new_invested / new_qty, 2)
            pos["currentValue"] = round(new_qty * price, 2)
            pos["unrealizedPnl"] = round(pos["currentValue"] - pos["investedValue"], 2)
            pos["unrealizedPnlPct"] = round((pos["unrealizedPnl"] / pos["investedValue"]) * 100, 2)
        else:
            VIRTUAL_ACCOUNT["positions"].append({
                "symbol": sym,
                "name": f"{sym} Equity",
                "quantity": quantity,
                "product": prod,
                "averagePrice": round(price, 2),
                "cmp": round(price, 2),
                "investedValue": round(trade_val, 2),
                "currentValue": round(trade_val, 2),
                "unrealizedPnl": 0.0,
                "unrealizedPnlPct": 0.0,
                "dayChangePct": 0.0,
            })
    else:  # SELL
        pos = next((p for p in VIRTUAL_ACCOUNT["positions"] if p["symbol"] == sym and p["product"] == prod), None)
        if not pos or pos["quantity"] < quantity:
            avail = pos["quantity"] if pos else 0
            return {
                "success": False,
                "error": f"Insufficient shares to sell. Requested: {quantity}, Available: {avail}",
            }

        net_received = trade_val - charges["totalCharges"]
        VIRTUAL_ACCOUNT["cashBalance"] += net_received

        # Realize P&L
        cost_basis = pos["averagePrice"] * quantity
        pnl = trade_val - cost_basis
        VIRTUAL_ACCOUNT["realizedPnl"] += pnl

        pos["quantity"] -= quantity
        if pos["quantity"] == 0:
            VIRTUAL_ACCOUNT["positions"] = [p for p in VIRTUAL_ACCOUNT["positions"] if p["symbol"] != sym or p["product"] != prod]
        else:
            pos["investedValue"] = round(pos["quantity"] * pos["averagePrice"], 2)
            pos["currentValue"] = round(pos["quantity"] * price, 2)
            pos["unrealizedPnl"] = round(pos["currentValue"] - pos["investedValue"], 2)

    order_record = {
        "orderId": f"ORD-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}",
        "symbol": sym,
        "action": act,
        "product": prod,
        "quantity": quantity,
        "price": round(price, 2),
        "tradeValue": round(trade_val, 2),
        "totalCharges": charges["totalCharges"],
        "status": "FILLED",
        "timestamp": datetime.now().isoformat(),
    }
    VIRTUAL_ACCOUNT["orders"].insert(0, order_record)
    del VIRTUAL_ACCOUNT["orders"][MAX_ORDER_HISTORY:]

    return {
        "success": True,
        "order": order_record,
        "charges": charges,
        "account": get_virtual_account(),
    }
