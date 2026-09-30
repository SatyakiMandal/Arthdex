"""Hierarchical Risk Parity (HRP) and Black-Litterman Portfolio Optimization.

Implements:
1. Marcos Lopez de Prado (2016) Hierarchical Risk Parity (HRP):
   - Tree clustering on correlation distance matrix D = sqrt(0.5 * (1 - rho))
   - Quasi-diagonalization matrix sorting
   - Recursive bisection allocation without matrix inversion
2. Fischer Black & Robert Litterman (1990/1992) Bayesian View Integration:
   - Implied equilibrium return prior Pi = delta * Sigma * w_mkt
   - Active views matrix (P, q, Omega) from event study CARs and forecasting cones
   - Posterior return and covariance estimation
3. Fractional Kelly Criterion with leverage asymmetry penalty.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, to_tree
from scipy.spatial.distance import squareform

log = logging.getLogger(__name__)


def _get_quasi_diag(linkage_matrix: np.ndarray) -> list[int]:
    """Reorder items so similar assets are placed next to each other."""
    root = to_tree(linkage_matrix)
    order: list[int] = []

    def _traverse(node):
        if node.is_leaf():
            order.append(node.id)
        else:
            if node.left:
                _traverse(node.left)
            if node.right:
                _traverse(node.right)

    _traverse(root)
    return order


def _get_cluster_var(cov: np.ndarray, cluster_items: list[int]) -> float:
    """Calculate the inverse-variance portfolio variance for a cluster."""
    sub_cov = cov[np.ix_(cluster_items, cluster_items)]
    inv_diag = 1.0 / np.maximum(np.diag(sub_cov), 1e-8)
    w = inv_diag / np.sum(inv_diag)
    var = float(w @ sub_cov @ w)
    return max(var, 1e-8)


def _get_rec_bisection(cov: np.ndarray, sorted_indices: list[int]) -> pd.Series:
    """Recursively bisect the tree and assign inverse-variance cluster weights."""
    weights = pd.Series(1.0, index=sorted_indices)
    clusters = [sorted_indices]

    while len(clusters) > 0:
        next_clusters = []
        for cluster in clusters:
            if len(cluster) > 1:
                mid = len(cluster) // 2
                left = cluster[:mid]
                right = cluster[mid:]

                var_left = _get_cluster_var(cov, left)
                var_right = _get_cluster_var(cov, right)

                alpha = 1.0 - var_left / (var_left + var_right)
                alpha = np.clip(alpha, 0.01, 0.99)

                weights[left] *= alpha
                weights[right] *= (1.0 - alpha)

                if len(left) > 1:
                    next_clusters.append(left)
                if len(right) > 1:
                    next_clusters.append(right)
        clusters = next_clusters

    return weights


@dataclass
class HRPResult:
    weights: dict[str, float]
    dendrogram_clusters: list[dict[str, Any]]
    portfolio_volatility_annualized: float
    diversification_ratio: float
    cluster_order: list[str]


def compute_hierarchical_risk_parity(
    returns_df: pd.DataFrame,
    shrinkage: float = 0.1,
) -> HRPResult:
    """Compute Lopez de Prado (2016) Hierarchical Risk Parity weights."""
    clean_df = returns_df.dropna(axis=1, thresh=max(5, int(len(returns_df) * 0.7))).fillna(0.0)
    assets = list(clean_df.columns)
    n = len(assets)

    if n < 2:
        return HRPResult(
            weights={a: 1.0 / max(1, n) for a in assets},
            dendrogram_clusters=[],
            portfolio_volatility_annualized=float(clean_df.std().iloc[0] * np.sqrt(252)) if n == 1 else 0.0,
            diversification_ratio=1.0,
            cluster_order=assets,
        )

    raw_corr = clean_df.corr().fillna(0.0).values
    raw_cov = clean_df.cov().fillna(0.0).values * 252.0
    for i in range(n):
        if raw_cov[i, i] <= 1e-8:
            raw_cov[i, i] = 1e-4

    corr = (1.0 - shrinkage) * raw_corr + shrinkage * np.eye(n)
    np.fill_diagonal(corr, 1.0)
    corr = np.nan_to_num(corr, nan=0.0, posinf=1.0, neginf=-1.0)
    corr = np.clip(corr, -1.0, 1.0)

    dist = np.sqrt(np.maximum(0.0, 0.5 * (1.0 - corr)))
    np.fill_diagonal(dist, 0.0)
    dist = np.nan_to_num(dist, nan=0.0)
    condensed_dist = squareform(dist, checks=False)

    link = linkage(condensed_dist, method="ward")
    sorted_idx = _get_quasi_diag(link)
    sorted_assets = [assets[i] for i in sorted_idx]

    raw_w = _get_rec_bisection(raw_cov, sorted_idx)
    raw_w = raw_w / raw_w.sum()

    weights_dict = {assets[i]: float(raw_w[i]) for i in range(n)}

    w_vec = np.array([weights_dict[a] for a in assets])
    port_var = float(w_vec @ raw_cov @ w_vec)
    port_vol = float(np.sqrt(max(port_var, 1e-6)))

    individual_vols = np.sqrt(np.maximum(np.diag(raw_cov), 1e-6))
    weighted_vol = float(np.sum(w_vec * individual_vols))
    div_ratio = float(weighted_vol / port_vol) if port_vol > 0 else 1.0

    clusters_rep = []
    for step_i, row in enumerate(link):
        clusters_rep.append({
            "step": step_i + 1,
            "node1": int(row[0]),
            "node2": int(row[1]),
            "distance": round(float(row[2]), 4),
            "size": int(row[3]),
        })

    return HRPResult(
        weights=weights_dict,
        dendrogram_clusters=clusters_rep,
        portfolio_volatility_annualized=port_vol,
        diversification_ratio=round(div_ratio, 3),
        cluster_order=sorted_assets,
    )


@dataclass
class BlackLittermanResult:
    prior_returns: dict[str, float]
    posterior_returns: dict[str, float]
    active_tilts: dict[str, float]
    optimal_weights: dict[str, float]
    confidence_lambda: float


def compute_black_litterman(
    returns_df: pd.DataFrame,
    views: dict[str, float],
    view_confidences: dict[str, float] | None = None,
    risk_aversion: float = 2.5,
    tau: float = 0.05,
) -> BlackLittermanResult:
    """Compute Black-Litterman Bayesian return distribution & optimal tilts."""
    assets = list(returns_df.columns)
    k = len(assets)
    if k == 0:
        return BlackLittermanResult({}, {}, {}, {}, 0.0)

    cov = returns_df.cov().values * 252.0
    w_mkt = np.ones(k) / k
    pi = risk_aversion * (cov @ w_mkt)

    view_assets = [a for a in assets if a in views]
    if not view_assets:
        return BlackLittermanResult(
            prior_returns={a: float(pi[i]) for i, a in enumerate(assets)},
            posterior_returns={a: float(pi[i]) for i, a in enumerate(assets)},
            active_tilts={a: 0.0 for a in assets},
            optimal_weights={a: float(w_mkt[i]) for i, a in enumerate(assets)},
            confidence_lambda=1.0,
        )

    v_len = len(view_assets)
    P = np.zeros((v_len, k))
    q = np.zeros(v_len)
    omega_diag = np.zeros(v_len)

    for r_i, a in enumerate(view_assets):
        c_i = assets.index(a)
        P[r_i, c_i] = 1.0
        q[r_i] = views[a]
        conf = (view_confidences.get(a, 0.7) if view_confidences else 0.7)
        omega_diag[r_i] = (1.0 - conf) / max(conf, 0.05) * (tau * cov[c_i, c_i])

    Omega = np.diag(omega_diag)

    tau_sigma = tau * cov
    m_inv = np.linalg.pinv(P @ tau_sigma @ P.T + Omega)
    er_post = pi + (tau_sigma @ P.T) @ m_inv @ (q - P @ pi)

    w_opt_raw = np.linalg.pinv(risk_aversion * cov) @ er_post
    w_opt = np.clip(w_opt_raw, 0.0, 1.0)
    if w_opt.sum() > 0:
        w_opt /= w_opt.sum()
    else:
        w_opt = w_mkt

    tilts = w_opt - w_mkt

    return BlackLittermanResult(
        prior_returns={a: float(pi[i]) for i, a in enumerate(assets)},
        posterior_returns={a: float(er_post[i]) for i, a in enumerate(assets)},
        active_tilts={a: float(tilts[i]) for i, a in enumerate(assets)},
        optimal_weights={a: float(w_opt[i]) for i, a in enumerate(assets)},
        confidence_lambda=float(np.mean([view_confidences.get(a, 0.7) for a in view_assets]) if view_confidences else 0.7),
    )


def compute_fractional_kelly_sizing(
    expected_return: float,
    annual_volatility: float,
    fraction: float = 0.5,
    leverage_penalty: float = 1.54,
) -> dict[str, float]:
    """Compute Asymmetry-Adjusted Fractional Kelly position sizing."""
    var = max(annual_volatility ** 2, 1e-4)
    raw_kelly = expected_return / var
    adj_fraction = fraction / max(1.0, (leverage_penalty - 1.0) * 0.5 + 1.0)
    sized_weight = np.clip(raw_kelly * adj_fraction, -0.5, 0.5)

    return {
        "raw_full_kelly": round(float(raw_kelly), 4),
        "fractional_kelly_recommended": round(float(sized_weight), 4),
        "leverage_penalty_applied": round(float(leverage_penalty), 3),
        "recommended_leverage_cap": round(float(abs(sized_weight) * 1.5), 3),
    }
