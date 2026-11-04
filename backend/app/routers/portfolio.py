"""Portfolio endpoints: true XIRR solver, sector allocation, and Section 112A tax-loss harvesting."""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter

from ..schemas import envelope
from ..services import portfolio_analytics

router = APIRouter(prefix="/api/v1/portfolio", tags=["portfolio"])


@router.post("/analyze")
def analyze_portfolio_payload(
    payload: dict[str, Any],
):
    """Analyze a portfolio: compute exact cash flow XIRR, sector allocation, and tax-loss harvesting savings."""
    holdings = payload.get("holdings") or []
    res = portfolio_analytics.analyze_portfolio(holdings)
    return envelope(res, 0, source="Arthdex Portfolio Engine", delayed_minutes=0)


@router.post("/xirr")
def calculate_xirr_standalone(
    payload: dict[str, Any],
):
    """Stand-alone Newton-Raphson XIRR solver for irregular date cash flows."""
    raw_flows = payload.get("cashFlows") or []
    parsed_flows = []
    for item in raw_flows:
        d = portfolio_analytics._parse_date(item.get("date"))
        amt = float(item.get("amount") or 0.0)
        parsed_flows.append((d, amt))

    xirr_val = portfolio_analytics.calculate_xirr(parsed_flows)
    return envelope(
        {"xirrPct": xirr_val, "cashFlowsCount": len(parsed_flows)},
        0,
        source="Arthdex XIRR Solver",
        delayed_minutes=0,
    )
