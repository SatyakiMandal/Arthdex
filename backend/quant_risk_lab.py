"""
Root re-export for Quant Risk Lab and Crisis Stress-Testing (M22).
"""
from __future__ import annotations

try:
    from app.services.quant_risk_lab import (
        HISTORICAL_CRISIS_SCENARIOS,
        STOCK_FACTOR_PROFILES,
        TAG_ACTUAL_FILING,
        TAG_INDICATIVE,
        TAG_MODELLED,
        calculate_indian_statutory_charges,
        calculate_var_suite,
        get_crisis_scenario_by_id,
        get_crisis_scenarios,
        ols_regression,
        run_multi_factor_regression,
        run_portfolio_stress_test,
        run_walk_forward_backtest,
    )
except ImportError:
    from backend.app.services.quant_risk_lab import (
        HISTORICAL_CRISIS_SCENARIOS,
        STOCK_FACTOR_PROFILES,
        TAG_ACTUAL_FILING,
        TAG_INDICATIVE,
        TAG_MODELLED,
        calculate_indian_statutory_charges,
        calculate_var_suite,
        get_crisis_scenario_by_id,
        get_crisis_scenarios,
        ols_regression,
        run_multi_factor_regression,
        run_portfolio_stress_test,
        run_walk_forward_backtest,
    )

__all__ = [
    "HISTORICAL_CRISIS_SCENARIOS",
    "STOCK_FACTOR_PROFILES",
    "TAG_ACTUAL_FILING",
    "TAG_INDICATIVE",
    "TAG_MODELLED",
    "calculate_indian_statutory_charges",
    "calculate_var_suite",
    "get_crisis_scenario_by_id",
    "get_crisis_scenarios",
    "ols_regression",
    "run_multi_factor_regression",
    "run_portfolio_stress_test",
    "run_walk_forward_backtest",
]
