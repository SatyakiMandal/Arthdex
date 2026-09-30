"""Almgren-Chriss (2000) Optimal Execution & Institutional Position Sizing Simulator.

Models market impact, temporary price concessions, and permanent drift during
institutional order execution (TWAP vs VWAP vs Risk-Neutral Almgren-Chriss trajectory).
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)


@dataclass
class ExecutionTrajectory:
    day: int
    shares_remaining: float
    shares_to_trade: float
    trade_pct_of_adv: float
    expected_slippage_bps: float


@dataclass
class ExecutionSimulationResult:
    target_order_value_inr: float
    shares_total: float
    average_daily_volume_shares: float
    daily_volatility_pct: float
    liquidation_horizon_days: int
    total_expected_impact_cost_inr: float
    total_expected_impact_bps: float
    risk_adjusted_shortfall_inr: float
    max_position_size_for_25bps_inr: float
    execution_urgency_tier: str
    schedule: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "target_order_value_inr": round(self.target_order_value_inr, 2),
            "shares_total": int(self.shares_total),
            "average_daily_volume_shares": int(self.average_daily_volume_shares),
            "daily_volatility_pct": round(self.daily_volatility_pct, 2),
            "liquidation_horizon_days": self.liquidation_horizon_days,
            "total_expected_impact_cost_inr": round(self.total_expected_impact_cost_inr, 2),
            "total_expected_impact_bps": round(self.total_expected_impact_bps, 2),
            "risk_adjusted_shortfall_inr": round(self.risk_adjusted_shortfall_inr, 2),
            "max_position_size_for_25bps_inr": round(self.max_position_size_for_25bps_inr, 2),
            "execution_urgency_tier": self.execution_urgency_tier,
            "schedule": self.schedule,
        }


def simulate_almgren_chriss_execution(
    order_value_inr: float = 10000000.0,  # Default ₹1 Crore order
    stock_price: float = 2500.0,
    average_daily_volume: float = 100000.0,
    daily_volatility: float = 0.02,
    horizon_days: int = 5,
    risk_aversion_lambda: float = 1e-6,
) -> ExecutionSimulationResult:
    """Compute optimal liquidation schedule and expected market impact under Almgren-Chriss."""
    order_val = max(10000.0, float(order_value_inr))
    p_0 = max(1.0, float(stock_price))
    adv = max(100.0, float(average_daily_volume))
    vol = max(0.005, min(0.15, float(daily_volatility)))
    n_days = max(1, int(horizon_days))

    total_shares = order_val / p_0

    # Impact parameters (Kyle / Almgren empirical calibrations for Indian equities)
    # Temporary impact eta: price concession per unit trading rate
    eta = 0.15 * p_0 / adv
    # Permanent impact gamma: permanent price shift per unit volume
    gamma = 0.05 * p_0 / adv

    # Almgren-Chriss decay rate kappa:
    # kappa = acosh(1 + 0.5 * lambda * sigma^2 / eta)
    tau = 1.0  # 1-day trade intervals
    arg = 1.0 + (0.5 * risk_aversion_lambda * (vol * p_0) ** 2 * (tau ** 2)) / max(1e-8, eta)
    kappa = np.arccosh(max(1.0001, arg)) if arg > 1.0 else 0.1
    kappa = max(0.05, min(3.0, kappa))

    schedule_rows: list[dict[str, Any]] = []
    curr_shares = total_shares
    cum_impact_cost = 0.0

    T = n_days
    for j in range(1, T + 1):
        t_j = j
        # Optimal remaining shares x_j = X0 * sinh(kappa*(T - t_j)) / sinh(kappa*T)
        if j == T:
            x_j = 0.0
        else:
            x_j = total_shares * (np.sinh(kappa * (T - t_j)) / max(1e-8, np.sinh(kappa * T)))
        x_j = max(0.0, min(curr_shares, x_j))

        trade_shares = curr_shares - x_j
        trade_pct_adv = (trade_shares / adv) * 100.0

        # Impact for step j: temporary + permanent
        temp_impact = eta * (trade_shares / tau)
        perm_impact = gamma * trade_shares
        step_impact_bps = ((temp_impact + 0.5 * perm_impact) / p_0) * 10000.0
        step_cost_inr = trade_shares * (temp_impact + 0.5 * perm_impact)

        cum_impact_cost += step_cost_inr

        schedule_rows.append({
            "Day": j,
            "Shares to Trade": int(trade_shares),
            "Shares Remaining": int(x_j),
            "Trade % of ADV": round(trade_pct_adv, 2),
            "Expected Slippage (bps)": round(step_impact_bps, 1),
            "Estimated Cost (₹)": round(step_cost_inr, 2),
        })
        curr_shares = x_j

    total_bps = (cum_impact_cost / order_val) * 10000.0

    # Risk-adjusted shortfall (Expected Cost + Lambda * Variance)
    var_shortfall = 0.5 * (vol * p_0) ** 2 * total_shares * sum((s["Shares Remaining"] / total_shares) ** 2 for s in schedule_rows)
    risk_shortfall = cum_impact_cost + risk_aversion_lambda * var_shortfall

    # Max position size limit for 25 bps slippage budget
    # Since impact scales linearly with order size: Size_25 = Order_val * (25 / total_bps)
    max_25bps_size = order_val * (25.0 / max(1.0, total_bps))

    urgency_tier = (
        "Liquid / Low Friction Execution (<15 bps)" if total_bps < 15.0
        else "Moderate Execution Friction (15-35 bps)" if total_bps <= 35.0
        else "Illiquid / High Market Impact Execution (>35 bps)"
    )

    return ExecutionSimulationResult(
        target_order_value_inr=order_val,
        shares_total=total_shares,
        average_daily_volume_shares=adv,
        daily_volatility_pct=vol * 100.0,
        liquidation_horizon_days=n_days,
        total_expected_impact_cost_inr=cum_impact_cost,
        total_expected_impact_bps=total_bps,
        risk_adjusted_shortfall_inr=risk_shortfall,
        max_position_size_for_25bps_inr=max_25bps_size,
        execution_urgency_tier=urgency_tier,
        schedule=schedule_rows,
    )
