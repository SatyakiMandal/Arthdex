"""
Quant Risk Lab, Crisis Stress-Testing & Backtesting Router (STRS, MARS, FCTR, BTST).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..schemas import envelope
from ..services import quant_risk_lab

router = APIRouter(prefix="/api/risk-lab", tags=["risk-lab"])


class PositionItem(BaseModel):
    symbol: str = Field(..., description="NSE equity or index symbol (e.g. RELIANCE, HDFCBANK)")
    weight: Optional[float] = Field(None, description="Portfolio weight between 0.0 and 1.0")
    value_inr: Optional[float] = Field(None, description="Holding value in Indian Rupees")


class StressTestRequest(BaseModel):
    portfolio: Optional[Union[List[Dict[str, Any]], Dict[str, float]]] = Field(
        default_factory=lambda: [
            {"symbol": "RELIANCE", "weight": 0.35, "value_inr": 350000.0},
            {"symbol": "HDFCBANK", "weight": 0.35, "value_inr": 350000.0},
            {"symbol": "TCS", "weight": 0.30, "value_inr": 300000.0},
        ],
        description="Portfolio positions list or {symbol: weight} dictionary",
    )
    scenario_id: str = Field("covid_shock_2020", description="Crisis scenario key (e.g. gfc_2008, taper_tantrum_2013, covid_shock_2020, election_shock_2024, custom)")
    custom_shocks: Optional[Dict[str, float]] = Field(
        None,
        description="Custom macro shocks: rates_bps, crude_pct, inr_pct",
    )


class BacktestRequest(BaseModel):
    strategy: str = Field("sma_crossover", description="Strategy type (sma_crossover, momentum_breakout, etc.)")
    symbol: str = Field("NIFTY50", description="NSE symbol to backtest")
    parameters: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"fast_period": 20, "slow_period": 50},
        description="Strategy hyperparameters",
    )
    start_date: str = Field("2020-01-01", description="Start date YYYY-MM-DD")
    end_date: str = Field("2024-10-31", description="End date YYYY-MM-DD")
    initial_capital: float = Field(1000000.0, description="Starting capital in INR (default Rs 10 Lakh)")
    in_sample_pct: float = Field(0.70, description="Train / In-sample window fraction (0.5 to 0.9)")
    slippage_bps: float = Field(5.0, description="Execution slippage in basis points")
    brokerage_per_order_inr: float = Field(20.0, description="Flat brokerage per order in INR")


@router.get("/crisis-scenarios")
def get_crisis_scenarios():
    """Returns official historical crisis and hypothetical stress scenarios (STRS)."""
    try:
        scenarios = quant_risk_lab.get_crisis_scenarios()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load crisis scenarios: {exc}") from exc
    return envelope(
        scenarios,
        3600,
        source="NSE Index Services, RBI DBIE & Historical Crash Database",
        delayed_minutes=0,
        note="Historical crashes and hypothetical macro stress scenarios with factor drawdowns.",
    )


@router.post("/stress-test")
def run_stress_test(req: StressTestRequest):
    """
    Stress-tests a portfolio against historical or hypothetical crisis scenarios.
    Computes constituent drawdown, overall portfolio loss, and SEBI regulatory margin requirements.
    """
    try:
        results = quant_risk_lab.run_portfolio_stress_test(
            positions=req.portfolio or [],
            scenario_id=req.scenario_id,
            custom_shocks=req.custom_shocks,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Stress-test calculation failed: {exc}") from exc
    return envelope(
        results,
        60,
        source="Arthdex Quant Risk & Stress Transmission Lab",
        delayed_minutes=0,
        note="Factor drawdown and multi-asset transmission with SEBI capital adequacy haircuts.",
    )


@router.get("/factor-exposures")
def get_factor_exposures(
    symbol: str = Query("NIFTY50", description="NSE equity or index symbol"),
    lookback_days: int = Query(252, ge=30, le=1260, description="Lookback trading days"),
):
    """
    Runs multi-factor OLS regression (Fama-French 3-Factor + Momentum + Low Volatility)
    for Indian equities, reporting factor betas, alpha, t-stats, and variance attribution.
    """
    try:
        results = quant_risk_lab.run_multi_factor_regression(
            symbol=symbol,
            lookback_days=lookback_days,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Factor regression failed: {exc}") from exc
    return envelope(
        results,
        300,
        source="Indian 5-Factor Quantitative Model (FCTR)",
        delayed_minutes=0,
        note="Fama-French 3-Factor + Momentum + Low Volatility calibrated for the Indian universe.",
    )


@router.post("/backtest")
def run_backtest(req: BacktestRequest):
    """
    Executes walk-forward strategy backtest deducting exact Indian statutory charges
    (STT 0.1%, NSE Txn 0.003%, SEBI Turnover 0.0001%, Stamp Duty 0.015%, GST 18%).
    Reports in-sample vs out-of-sample metrics side-by-side per PRD M22.8 policy.
    """
    try:
        results = quant_risk_lab.run_walk_forward_backtest(
            strategy=req.strategy,
            symbol=req.symbol,
            parameters=req.parameters,
            start_date=req.start_date,
            end_date=req.end_date,
            initial_capital=req.initial_capital,
            in_sample_pct=req.in_sample_pct,
            slippage_bps=req.slippage_bps,
            brokerage_per_order_inr=req.brokerage_per_order_inr,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Backtest execution failed: {exc}") from exc
    return envelope(
        results,
        60,
        source="Arthdex Walk-Forward Quantitative Backtester (BTST)",
        delayed_minutes=0,
        note="Walk-forward backtest including Indian statutory taxes (STT, Stamp Duty, GST, Exchange fees).",
    )
