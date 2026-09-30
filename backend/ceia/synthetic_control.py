"""Synthetic Control Method (SCM) for Event Studies (Abadie et al. 2010).

Constructs a convex combination of donor peer stocks to create an optimal
counterfactual return trajectory, eliminating benchmark specification error
and beta instability.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import numpy as np
import pandas as pd
from scipy.optimize import minimize

log = logging.getLogger(__name__)


@dataclass
class SyntheticControlResult:
    target_ticker: str
    donor_tickers: list[str]
    weights: dict[str, float]
    pre_event_rmspe: float
    post_event_rmspe: float
    rmspe_ratio: float
    treatment_effects: pd.Series
    synthetic_car_pct: float
    synthetic_trajectory: pd.Series
    actual_trajectory: pd.Series
    p_value: float | None = None
    is_statistically_significant: bool = False
    regime: str = "Neutral"

    def to_dict(self) -> dict[str, Any]:
        return {
            "target_ticker": self.target_ticker,
            "donor_tickers": self.donor_tickers,
            "weights": {k: round(v, 4) for k, v in self.weights.items()},
            "pre_event_rmspe": round(self.pre_event_rmspe, 4),
            "post_event_rmspe": round(self.post_event_rmspe, 4),
            "rmspe_ratio": round(self.rmspe_ratio, 2),
            "synthetic_car_pct": round(self.synthetic_car_pct, 2),
            "p_value": round(self.p_value, 4) if self.p_value is not None else None,
            "is_statistically_significant": self.is_statistically_significant,
            "regime": self.regime,
        }


def fit_synthetic_control(
    target_returns: pd.Series,
    donor_returns: pd.DataFrame,
    event_date: date | str,
    pre_event_window: int = 60,
    post_event_window: int = 10,
    run_placebos: bool = True,
) -> SyntheticControlResult:
    """Fit Abadie Synthetic Control on a donor pool of peer stocks.

    Solves: min_w || Y_0 - Y_donor * w ||^2  s.t. w >= 0, sum(w) = 1.
    """
    event_ts = pd.Timestamp(event_date)
    common_idx = target_returns.dropna().index.intersection(donor_returns.dropna().index)
    if len(common_idx) < 20:
        return SyntheticControlResult(
            target_ticker="TARGET",
            donor_tickers=list(donor_returns.columns),
            weights={col: 1.0 / len(donor_returns.columns) for col in donor_returns.columns},
            pre_event_rmspe=0.0,
            post_event_rmspe=0.0,
            rmspe_ratio=1.0,
            treatment_effects=pd.Series(dtype=float),
            synthetic_car_pct=0.0,
            synthetic_trajectory=pd.Series(dtype=float),
            actual_trajectory=pd.Series(dtype=float),
            regime="Insufficient Data (<20 obs)",
        )

    y_target = target_returns.reindex(common_idx)
    y_donor = donor_returns.reindex(common_idx)

    # Identify event index
    locs = common_idx.get_indexer([event_ts], method="nearest")
    event_idx = int(locs[0]) if len(locs) > 0 and locs[0] >= 0 else len(common_idx) // 2

    start_pre = max(0, event_idx - pre_event_window)
    end_pre = event_idx
    end_post = min(len(common_idx), event_idx + post_event_window + 1)

    pre_idx = common_idx[start_pre:end_pre]
    post_idx = common_idx[event_idx:end_post]

    if len(pre_idx) < 10 or len(post_idx) < 1:
        return SyntheticControlResult(
            target_ticker="TARGET",
            donor_tickers=list(donor_returns.columns),
            weights={col: 1.0 / max(1, len(donor_returns.columns)) for col in donor_returns.columns},
            pre_event_rmspe=0.0,
            post_event_rmspe=0.0,
            rmspe_ratio=1.0,
            treatment_effects=pd.Series(dtype=float),
            synthetic_car_pct=0.0,
            synthetic_trajectory=pd.Series(dtype=float),
            actual_trajectory=pd.Series(dtype=float),
            regime="Pre/Post window insufficient",
        )

    Y0_pre = y_target.loc[pre_idx].values
    Y_donors_pre = y_donor.loc[pre_idx].values
    J = Y_donors_pre.shape[1]

    # Objective function: squared error
    def _loss(w):
        diff = Y0_pre - np.dot(Y_donors_pre, w)
        return np.sum(diff**2)

    # Constraints: sum(w) = 1, bounds: w_j in [0, 1]
    cons = ({"type": "eq", "fun": lambda w: np.sum(w) - 1.0})
    bounds = [(0.0, 1.0) for _ in range(J)]
    init_w = np.ones(J) / J

    res = minimize(_loss, init_w, method="SLSQP", bounds=bounds, constraints=cons)
    opt_w = res.x if res.success else init_w
    opt_w = np.maximum(0.0, opt_w)
    if np.sum(opt_w) > 0:
        opt_w = opt_w / np.sum(opt_w)

    weights_dict = {col: float(opt_w[i]) for i, col in enumerate(y_donor.columns)}

    # Compute pre & post synthetic trajectories
    all_idx = common_idx[start_pre:end_post]
    synth_all = np.dot(y_donor.loc[all_idx].values, opt_w)
    actual_all = y_target.loc[all_idx].values

    treatment_all = pd.Series(actual_all - synth_all, index=all_idx)

    pre_diff = treatment_all.loc[pre_idx]
    post_diff = treatment_all.loc[post_idx]

    pre_rmspe = float(np.sqrt(np.mean(pre_diff**2))) if len(pre_diff) > 0 else 1e-4
    post_rmspe = float(np.sqrt(np.mean(post_diff**2))) if len(post_diff) > 0 else 0.0

    rmspe_ratio = post_rmspe / max(1e-6, pre_rmspe)
    synth_car = float(np.sum(post_diff)) * 100.0

    # Placebo tests across donor pool
    p_val = None
    if run_placebos and J >= 3:
        placebo_ratios = []
        for j in range(J):
            donor_j_target = y_donor.iloc[:, j]
            other_donors = y_donor.drop(columns=[y_donor.columns[j]])
            # fit on placebo
            y_j_pre = donor_j_target.loc[pre_idx].values
            y_others_pre = other_donors.loc[pre_idx].values
            J_other = y_others_pre.shape[1]

            def _placebo_loss(w):
                return np.sum((y_j_pre - np.dot(y_others_pre, w)) ** 2)

            res_p = minimize(
                _placebo_loss, np.ones(J_other) / J_other, method="SLSQP",
                bounds=[(0.0, 1.0)] * J_other, constraints={"type": "eq", "fun": lambda w: np.sum(w) - 1.0}
            )
            w_p = res_p.x if res_p.success else np.ones(J_other) / J_other
            p_synth_post = np.dot(other_donors.loc[post_idx].values, w_p)
            p_post_diff = donor_j_target.loc[post_idx].values - p_synth_post
            p_pre_diff = y_j_pre - np.dot(y_others_pre, w_p)

            p_pre_rmspe = float(np.sqrt(np.mean(p_pre_diff**2))) if len(p_pre_diff) > 0 else 1e-4
            p_post_rmspe = float(np.sqrt(np.mean(p_post_diff**2))) if len(p_post_diff) > 0 else 0.0
            placebo_ratios.append(p_post_rmspe / max(1e-6, p_pre_rmspe))

        greater_count = sum(1 for r in placebo_ratios if r >= rmspe_ratio)
        p_val = float((greater_count + 1) / (len(placebo_ratios) + 1))

    is_sig = (p_val is not None and p_val < 0.10) or rmspe_ratio > 2.5
    regime = (
        "Statistically Significant Synthetic Event Impact (High Causal Alpha)" if is_sig and abs(synth_car) > 2.0
        else "Moderate Synthetic Disruption" if rmspe_ratio > 1.5
        else "Synthetic Counterfactual Conforms with Peer Cohort"
    )

    return SyntheticControlResult(
        target_ticker="TARGET",
        donor_tickers=list(donor_returns.columns),
        weights=weights_dict,
        pre_event_rmspe=pre_rmspe,
        post_event_rmspe=post_rmspe,
        rmspe_ratio=rmspe_ratio,
        treatment_effects=treatment_all,
        synthetic_car_pct=synth_car,
        synthetic_trajectory=pd.Series(synth_all, index=all_idx),
        actual_trajectory=pd.Series(actual_all, index=all_idx),
        p_value=p_val,
        is_statistically_significant=is_sig,
        regime=regime,
    )
