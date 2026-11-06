"""
Root re-export for Valuation Lab services and models.
"""

from __future__ import annotations

try:
    from app.services.valuation_lab import (
        DEFAULT_CORPORATE_TAX_RATE,
        DEFAULT_EQUITY_RISK_PREMIUM,
        DEFAULT_PRETAX_COST_OF_DEBT,
        DEFAULT_RISK_FREE_RATE,
        DEFAULT_TERMINAL_GROWTH_RATE,
        TAG_ACTUAL,
        TAG_CONSENSUS,
        TAG_MODELLED,
        CAPMInputs,
        DCFResult,
        ReverseDCFResult,
        WACCBreakdown,
        calculate_dcf,
        calculate_wacc,
        compute_sensitivity_matrix,
        get_company_dcf_defaults,
        lever_beta,
        solve_reverse_dcf,
        unlever_beta,
    )
except ImportError:
    from backend.app.services.valuation_lab import (
        DEFAULT_CORPORATE_TAX_RATE,
        DEFAULT_EQUITY_RISK_PREMIUM,
        DEFAULT_PRETAX_COST_OF_DEBT,
        DEFAULT_RISK_FREE_RATE,
        DEFAULT_TERMINAL_GROWTH_RATE,
        TAG_ACTUAL,
        TAG_CONSENSUS,
        TAG_MODELLED,
        CAPMInputs,
        DCFResult,
        ReverseDCFResult,
        WACCBreakdown,
        calculate_dcf,
        calculate_wacc,
        compute_sensitivity_matrix,
        get_company_dcf_defaults,
        lever_beta,
        solve_reverse_dcf,
        unlever_beta,
    )

__all__ = [
    "DEFAULT_CORPORATE_TAX_RATE",
    "DEFAULT_EQUITY_RISK_PREMIUM",
    "DEFAULT_PRETAX_COST_OF_DEBT",
    "DEFAULT_RISK_FREE_RATE",
    "DEFAULT_TERMINAL_GROWTH_RATE",
    "TAG_ACTUAL",
    "TAG_CONSENSUS",
    "TAG_MODELLED",
    "CAPMInputs",
    "DCFResult",
    "ReverseDCFResult",
    "WACCBreakdown",
    "calculate_dcf",
    "calculate_wacc",
    "compute_sensitivity_matrix",
    "get_company_dcf_defaults",
    "lever_beta",
    "solve_reverse_dcf",
    "unlever_beta",
]
