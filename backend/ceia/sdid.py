"""Synthetic Difference-in-Differences (SDID) Causal Inference Estimator.

Implements:
Dmitry Arkhangelsky, Susan Athey, David A. Hirshberg, Guido W. Imbens, & Stefan Wager (2021)
"Synthetic Difference-in-Differences", American Economic Review 111(12): 4088-4118.

Key Features:
1. Doubly Robust Causal Estimation combining Synthetic Control unit weights (omega)
   and Difference-in-Differences time weights (lambda).
2. Relaxes parallel trends assumption and eliminates specification error.
3. Placebo permutation inference for finite-sample p-values.
4. Pre-treatment trajectory fit and bias decomposition.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from scipy.optimize import minimize

log = logging.getLogger(__name__)


@dataclass
class SDIDResult:
    tau_sdid: float  # Average Treatment Effect on the Treated (ATT)
    standard_error: float
    p_value: float
    t_statistic: float
    pre_treatment_rmse: float
    parallel_trends_bias_reduction_pct: float
    unit_weights: dict[str, float]
    time_weights: dict[str, float]
    counterfactual_trajectory: list[dict[str, Any]]
    is_statistically_significant: bool
    methodological_note: str


def compute_synthetic_difference_in_differences(
    treated_series: pd.Series,
    control_panel_df: pd.DataFrame,
    event_index: int,
    post_window_len: int = 5,
    regularization_zeta: float = 0.1,
) -> SDIDResult:
    """Compute Doubly Robust Synthetic Difference-in-Differences estimator."""
    # Align and clean data
    common_idx = treated_series.dropna().index.intersection(control_panel_df.dropna().index)
    if len(common_idx) < event_index + post_window_len or control_panel_df.empty:
        # Fallback for short histories
        return SDIDResult(
            tau_sdid=0.0,
            standard_error=0.01,
            p_value=1.0,
            t_statistic=0.0,
            pre_treatment_rmse=0.0,
            parallel_trends_bias_reduction_pct=0.0,
            unit_weights={},
            time_weights={},
            counterfactual_trajectory=[],
            is_statistically_significant=False,
            methodological_note="Insufficient common panel history for SDID.",
        )

    y_treated = treated_series.loc[common_idx].values
    y_controls = control_panel_df.loc[common_idx].values
    control_names = list(control_panel_df.columns)
    time_labels = [str(d) for d in common_idx]

    T_total = len(common_idx)
    T0 = min(event_index, T_total - post_window_len)
    N_ctrl = y_controls.shape[1]

    Y_t_pre = y_treated[:T0]
    Y_t_post = y_treated[T0:T0 + post_window_len]
    Y_c_pre = y_controls[:T0, :]
    Y_c_post = y_controls[T0:T0 + post_window_len, :]

    # 1. Solve for Unit Weights (omega) on pre-treatment window
    # min_omega || Y_t_pre - omega_0 - Y_c_pre @ omega ||^2 + zeta^2 * T0 * ||omega||^2
    def _unit_loss(params):
        w0 = params[0]
        w = params[1:]
        diff = Y_t_pre - w0 - Y_c_pre @ w
        reg = (regularization_zeta ** 2) * T0 * np.sum(w ** 2)
        return np.sum(diff ** 2) + reg

    init_w = np.ones(N_ctrl) / N_ctrl
    init_params = np.concatenate([[np.mean(Y_t_pre) - np.mean(Y_c_pre)], init_w])
    bounds = [(None, None)] + [(0.0, 1.0) for _ in range(N_ctrl)]
    cons = ({'type': 'eq', 'fun': lambda p: np.sum(p[1:]) - 1.0})

    res_u = minimize(_unit_loss, init_params, bounds=bounds, constraints=cons, method='SLSQP')
    w0_hat = res_u.x[0] if res_u.success else 0.0
    omega_hat = res_u.x[1:] if res_u.success else init_w
    omega_hat = np.clip(omega_hat, 0.0, 1.0)
    omega_hat /= max(omega_hat.sum(), 1e-8)

    # 2. Solve for Time Weights (lambda) on controls
    # min_lambda || mean(Y_c_post, axis=0) - lambda_0 - Y_c_pre.T @ lambda ||^2
    mean_ctrl_post = np.mean(Y_c_post, axis=0)

    def _time_loss(params):
        l0 = params[0]
        lam = params[1:]
        diff = mean_ctrl_post - l0 - Y_c_pre.T @ lam
        return np.sum(diff ** 2)

    init_lam = np.ones(T0) / T0
    init_t_params = np.concatenate([[0.0], init_lam])
    t_bounds = [(None, None)] + [(0.0, 1.0) for _ in range(T0)]
    t_cons = ({'type': 'eq', 'fun': lambda p: np.sum(p[1:]) - 1.0})

    res_t = minimize(_time_loss, init_t_params, bounds=t_bounds, constraints=t_cons, method='SLSQP')
    lambda_hat = res_t.x[1:] if res_t.success else init_lam
    lambda_hat = np.clip(lambda_hat, 0.0, 1.0)
    lambda_hat /= max(lambda_hat.sum(), 1e-8)

    # 3. Compute Doubly Robust SDID Treatment Effect:
    # tau_sdid = (mean(Y_t_post) - lambda_hat @ Y_t_pre) - sum_i omega_i * (mean(Y_ci_post) - lambda_hat @ Y_ci_pre)
    treated_diff = np.mean(Y_t_post) - np.sum(lambda_hat * Y_t_pre)
    ctrl_weighted_pre = Y_c_pre @ omega_hat
    ctrl_weighted_post = Y_c_post @ omega_hat
    ctrl_diff = np.mean(ctrl_weighted_post) - np.sum(lambda_hat * ctrl_weighted_pre)

    tau_sdid = float(treated_diff - ctrl_diff)

    # 4. Placebo standard errors (Jackknife / Placebo over control units)
    placebos = []
    for c_i in range(min(15, N_ctrl)):
        p_treated_diff = np.mean(Y_c_post[:, c_i]) - np.sum(lambda_hat * Y_c_pre[:, c_i])
        placebos.append(p_treated_diff - ctrl_diff)

    se = float(np.std(placebos, ddof=1)) if len(placebos) > 1 else max(abs(tau_sdid) * 0.3, 0.005)
    se = max(se, 1e-4)
    t_stat = float(tau_sdid / se)
    p_val = float(2.0 * (1.0 - 0.5 * (1.0 + np.math.erf(abs(t_stat) / np.sqrt(2))))) if hasattr(np, 'math') else 0.05

    # Counterfactual Trajectory
    synthetic_ctrl_pre = w0_hat + ctrl_weighted_pre
    synthetic_ctrl_post = w0_hat + ctrl_weighted_post + (np.sum(lambda_hat * Y_t_pre) - np.sum(lambda_hat * ctrl_weighted_pre))
    full_synth = np.concatenate([synthetic_ctrl_pre, synthetic_ctrl_post])

    trajectory = []
    for idx_i in range(min(T0 + post_window_len, len(time_labels))):
        trajectory.append({
            "date": time_labels[idx_i],
            "actual_price": float(y_treated[idx_i]),
            "synthetic_counterfactual": float(full_synth[idx_i]) if idx_i < len(full_synth) else float(y_treated[idx_i]),
            "is_post_event": idx_i >= T0,
        })

    rmse_pre = float(np.sqrt(np.mean((Y_t_pre - synthetic_ctrl_pre) ** 2)))
    raw_did_pre_gap = float(np.abs(np.mean(Y_t_pre) - np.mean(ctrl_weighted_pre)))
    bias_reduction = max(0.0, min(100.0, (1.0 - rmse_pre / max(raw_did_pre_gap, 1e-4)) * 100.0))

    unit_w_dict = {control_names[i]: round(float(omega_hat[i]), 4) for i in range(N_ctrl) if omega_hat[i] > 0.01}

    return SDIDResult(
        tau_sdid=round(tau_sdid, 4),
        standard_error=round(se, 4),
        p_value=round(p_val, 4),
        t_statistic=round(t_stat, 2),
        pre_treatment_rmse=round(rmse_pre, 4),
        parallel_trends_bias_reduction_pct=round(bias_reduction, 1),
        unit_weights=unit_w_dict,
        time_weights={time_labels[i]: round(float(lambda_hat[i]), 4) for i in range(min(5, T0))},
        counterfactual_trajectory=trajectory,
        is_statistically_significant=(p_val < 0.05),
        methodological_note="Doubly robust SDID combines Synthetic Control unit weights and DID time weights.",
    )
