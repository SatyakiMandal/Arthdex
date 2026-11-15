"""
Risk lab: refused until it runs on real series.

Its crisis scenarios were fixed tables, its factor returns were generated sine waves
and its backtest priced a generated series. Real versions need index and factor
histories that Arthdex does not hold yet, so the endpoints say so.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ..not_sourced import refuse

router = APIRouter(prefix="/api/risk-lab", tags=["risk-lab"])


@router.get("/crisis-scenarios")
def get_crisis_scenarios():
    refuse("Crisis scenarios", "sector and asset drawdowns measured over each crisis window", "index histories for those windows are not stored yet")


@router.post("/stress-test")
def run_stress_test(req: dict[str, Any] | None = None):
    refuse("The stress test", "crisis scenarios measured from real index histories", "index histories for those windows are not stored yet")


@router.get("/factor-exposures")
def get_factor_exposures(symbol: str = "NIFTY"):
    refuse("Factor exposures", "Indian market, size, value and momentum factor return series", "no published Indian factor series is fetched yet")


@router.post("/backtest")
def run_backtest(req: dict[str, Any] | None = None):
    refuse("The backtest", "the real price history of what is being tested", "this desk generated its own prices; it will return once wired to stored history")
