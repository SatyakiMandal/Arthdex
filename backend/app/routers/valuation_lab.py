"""
Valuation Lab Router: Interactive DCF, Dynamic WACC, Reverse DCF, and Sensitivity Matrix.
Exposes endpoints adhering to SEBI standards and zero-dependency financial computation.
"""

from __future__ import annotations

from typing import Any, Literal
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..cache import CACHE
from ..schemas import envelope
from ..services import valuation_lab

router = APIRouter(tags=["valuation"])


class CAPMParamsModel(BaseModel):
    risk_free_rate: float = Field(0.0718, description="10Y G-Sec Sovereign yield (e.g. 0.0718 for 7.18%)")
    equity_risk_premium: float = Field(0.0600, description="Indian Equity Risk Premium (e.g. 0.0600 for 6.0%)")
    beta: float = Field(1.0, description="Equity beta")
    is_beta_unlevered: bool = Field(False, description="Whether provided beta is asset (unlevered) beta")
    debt_to_equity: float = Field(0.20, description="Debt / Equity ratio")
    pretax_cost_of_debt: float = Field(0.0850, description="Pre-tax corporate borrowing rate (e.g. 8.5%)")
    tax_rate: float = Field(0.2517, description="Marginal corporate tax rate (25.17% under Sec 115BAA)")
    equity_weight: float | None = None
    debt_weight: float | None = None


class DCFCalculateRequest(BaseModel):
    symbol: str
    current_price: float
    shares_outstanding_cr: float
    cash_and_equivalents_cr: float = 0.0
    total_debt_cr: float = 0.0
    base_fcff_cr: float
    stage1_growth_rate: float = 0.12
    stage1_years: int = 5
    terminal_growth_rate: float = 0.05
    wacc: float | None = None
    wacc_inputs: CAPMParamsModel | None = None
    model_type: Literal["2-stage", "3-stage"] = "2-stage"
    stage2_years: int = 5


@router.get("/api/valuation/{symbol}/dcf")
@router.get("/api/v1/valuation/{symbol}/dcf")
def get_dcf_valuation(
    symbol: str,
    model_type: Literal["2-stage", "3-stage"] = Query("2-stage"),
    growth_rate: float | None = Query(None, description="Override stage 1 growth rate"),
    terminal_growth: float | None = Query(None, description="Override terminal growth rate"),
    wacc: float | None = Query(None, description="Override WACC rate"),
):
    """
    Returns default DCF inputs derived from actual filings, dynamic Indian CAPM WACC,
    and computed Fair Value per share.
    """
    sym = symbol.upper()
    cache_key = f"valuation:dcf:{sym}:{model_type}:{growth_rate}:{terminal_growth}:{wacc}"

    def compute():
        defaults = valuation_lab.get_company_dcf_defaults(sym)
        g1 = growth_rate if growth_rate is not None else defaults["stage1_growth_rate"]
        g_term = terminal_growth if terminal_growth is not None else defaults["terminal_growth_rate"]

        wacc_breakdown = valuation_lab.calculate_wacc(
            beta=defaults["beta"],
            debt_to_equity=defaults["debt_to_equity"],
            pretax_cost_of_debt=defaults["pretax_cost_of_debt"],
        )
        resolved_wacc = wacc if wacc is not None else wacc_breakdown.wacc

        result = valuation_lab.calculate_dcf(
            symbol=sym,
            current_price=defaults["current_price"],
            shares_outstanding_cr=defaults["shares_outstanding_cr"],
            cash_and_equivalents_cr=defaults["cash_and_equivalents_cr"],
            total_debt_cr=defaults["total_debt_cr"],
            base_fcff_cr=defaults["base_fcff_cr"],
            stage1_growth_rate=g1,
            terminal_growth_rate=g_term,
            wacc=resolved_wacc,
            model_type=model_type,
        )
        return {
            "dcf": result.to_dict(),
            "defaults": defaults,
            "wacc_summary": wacc_breakdown.to_dict(),
        }

    try:
        data, age = CACHE.get_or_fetch(cache_key, 60, compute)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Valuation model error: {exc}") from exc

    return envelope(
        data,
        age,
        source="NSE Filings, 10Y Indian Sovereign G-Sec Benchmark & DCF Model",
        delayed_minutes=0,
        note="Valuation model complies with SEBI fair value standards. Historical filings tagged [ACTUAL FILING].",
    )


@router.post("/api/valuation/dcf/calculate")
@router.post("/api/v1/valuation/dcf/calculate")
def calculate_custom_dcf(request: DCFCalculateRequest):
    """
    Dynamically recalculates 2-Stage or 3-Stage DCF with user-specified financial assumptions.
    """
    try:
        capm_inputs = None
        if request.wacc_inputs is not None:
            capm_inputs = valuation_lab.CAPMInputs(
                risk_free_rate=request.wacc_inputs.risk_free_rate,
                equity_risk_premium=request.wacc_inputs.equity_risk_premium,
                beta=request.wacc_inputs.beta,
                is_beta_unlevered=request.wacc_inputs.is_beta_unlevered,
                debt_to_equity=request.wacc_inputs.debt_to_equity,
                pretax_cost_of_debt=request.wacc_inputs.pretax_cost_of_debt,
                tax_rate=request.wacc_inputs.tax_rate,
                equity_weight=request.wacc_inputs.equity_weight,
                debt_weight=request.wacc_inputs.debt_weight,
            )

        result = valuation_lab.calculate_dcf(
            symbol=request.symbol.upper(),
            current_price=request.current_price,
            shares_outstanding_cr=request.shares_outstanding_cr,
            cash_and_equivalents_cr=request.cash_and_equivalents_cr,
            total_debt_cr=request.total_debt_cr,
            base_fcff_cr=request.base_fcff_cr,
            stage1_growth_rate=request.stage1_growth_rate,
            stage1_years=request.stage1_years,
            terminal_growth_rate=request.terminal_growth_rate,
            wacc=request.wacc,
            wacc_inputs=capm_inputs,
            model_type=request.model_type,
            stage2_years=request.stage2_years,
        )
        return envelope(
            result.to_dict(),
            0.0,
            source="Custom DCF Calculation Engine",
            delayed_minutes=0,
            note="User parameterized valuation output.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Recalculation error: {exc}") from exc


@router.get("/api/valuation/{symbol}/reverse-dcf")
@router.get("/api/v1/valuation/{symbol}/reverse-dcf")
def get_reverse_dcf(
    symbol: str,
    terminal_growth: float | None = Query(None, description="Terminal growth rate (default 0.05)"),
    wacc: float | None = Query(None, description="Discount rate / WACC (default computed or 0.115)"),
):
    """
    Reverse DCF Model: Solves for the implied 5-year Free Cash Flow CAGR priced into the current market price.
    """
    sym = symbol.upper()
    cache_key = f"valuation:reversedcf:{sym}:{terminal_growth}:{wacc}"

    def compute():
        defaults = valuation_lab.get_company_dcf_defaults(sym)
        g_term = terminal_growth if terminal_growth is not None else defaults["terminal_growth_rate"]

        if wacc is not None:
            resolved_wacc = wacc
        else:
            wacc_b = valuation_lab.calculate_wacc(
                beta=defaults["beta"],
                debt_to_equity=defaults["debt_to_equity"],
                pretax_cost_of_debt=defaults["pretax_cost_of_debt"],
            )
            resolved_wacc = wacc_b.wacc

        result = valuation_lab.solve_reverse_dcf(
            symbol=sym,
            current_price=defaults["current_price"],
            shares_outstanding_cr=defaults["shares_outstanding_cr"],
            cash_and_equivalents_cr=defaults["cash_and_equivalents_cr"],
            total_debt_cr=defaults["total_debt_cr"],
            base_fcff_cr=defaults["base_fcff_cr"],
            wacc=resolved_wacc,
            terminal_growth_rate=g_term,
        )
        return result.to_dict()

    try:
        data, age = CACHE.get_or_fetch(cache_key, 60, compute)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Reverse DCF error: {exc}") from exc

    return envelope(
        data,
        age,
        source="Arthdex Reverse DCF Numerical Solver",
        delayed_minutes=0,
        note="Reverse DCF extracts market-implied growth hurdles without subjective forecasting bias.",
    )


@router.get("/api/valuation/{symbol}/sensitivity")
@router.get("/api/v1/valuation/{symbol}/sensitivity")
def get_sensitivity_matrix(
    symbol: str,
    stage1_growth: float | None = Query(None, description="Stage 1 CAGR"),
    terminal_growth: float | None = Query(None, description="Base terminal growth rate"),
    wacc: float | None = Query(None, description="Base WACC"),
):
    """
    Returns 5x5 matrix of Fair Value per share and Upside/Downside %
    under varying WACC and Terminal Growth rates.
    """
    sym = symbol.upper()
    cache_key = f"valuation:sensitivity:{sym}:{stage1_growth}:{terminal_growth}:{wacc}"

    def compute():
        defaults = valuation_lab.get_company_dcf_defaults(sym)
        g1 = stage1_growth if stage1_growth is not None else defaults["stage1_growth_rate"]
        g_term = terminal_growth if terminal_growth is not None else defaults["terminal_growth_rate"]

        if wacc is not None:
            resolved_wacc = wacc
        else:
            wacc_b = valuation_lab.calculate_wacc(
                beta=defaults["beta"],
                debt_to_equity=defaults["debt_to_equity"],
                pretax_cost_of_debt=defaults["pretax_cost_of_debt"],
            )
            resolved_wacc = wacc_b.wacc

        return valuation_lab.compute_sensitivity_matrix(
            symbol=sym,
            current_price=defaults["current_price"],
            shares_outstanding_cr=defaults["shares_outstanding_cr"],
            cash_and_equivalents_cr=defaults["cash_and_equivalents_cr"],
            total_debt_cr=defaults["total_debt_cr"],
            base_fcff_cr=defaults["base_fcff_cr"],
            stage1_growth_rate=g1,
            base_wacc=resolved_wacc,
            base_terminal_growth=g_term,
        )

    try:
        data, age = CACHE.get_or_fetch(cache_key, 60, compute)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sensitivity matrix error: {exc}") from exc

    return envelope(
        data,
        age,
        source="Valuation Lab Multi-Dimensional Scenario Engine",
        delayed_minutes=0,
        note="Matrix illustrates valuation elasticity across WACC and terminal growth spectrum.",
    )
