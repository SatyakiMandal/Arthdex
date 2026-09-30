"""Diebold-Yilmaz (2012, 2014) Volatility Spillover and Connectedness Index.

Implements:
1. Francis X. Diebold & Kamil Yilmaz (2012, 2014) Generalized Forecast Error
   Variance Decomposition (GVD) in a Vector Autoregressive (VAR) framework.
2. Total Connectedness Index (TCI) measuring systemic financial market integration.
3. Directional Spillovers: "TO" (transmitted) and "FROM" (received) others.
4. Net Transmitters vs Net Receivers identification across peer companies and benchmark indices.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)


@dataclass
class ConnectednessResult:
    total_connectedness_index: float  # TCI (0% to 100%)
    spillover_matrix: pd.DataFrame  # Normalized NxN GVD matrix
    directional_to: dict[str, float]  # Volatility transmitted TO others
    directional_from: dict[str, float]  # Volatility received FROM others
    net_spillover: dict[str, float]  # Net = TO - FROM
    net_transmitters: list[str]  # Assets with Net > 0
    net_receivers: list[str]  # Assets with Net < 0
    target_company_tci: float
    target_company_role: str  # "Net Systemic Shock Transmitter" | "Net Volatility Receiver"


def compute_diebold_yilmaz_connectedness(
    volatilities_df: pd.DataFrame,
    horizon_h: int = 10,
    target_ticker: str | None = None,
) -> ConnectednessResult:
    """Compute Diebold-Yilmaz (2012) Total Connectedness Index and GVD Matrix."""
    clean_vols = volatilities_df.dropna(axis=1, thresh=max(5, int(len(volatilities_df) * 0.7))).ffill().fillna(0.01)
    assets = list(clean_vols.columns)
    N = len(assets)

    if N < 2:
        empty_mat = pd.DataFrame(np.eye(max(1, N)), index=assets, columns=assets)
        return ConnectednessResult(
            total_connectedness_index=0.0,
            spillover_matrix=empty_mat,
            directional_to={a: 0.0 for a in assets},
            directional_from={a: 0.0 for a in assets},
            net_spillover={a: 0.0 for a in assets},
            net_transmitters=[],
            net_receivers=[],
            target_company_tci=0.0,
            target_company_role="Isolated Asset",
        )

    # 1. Fit VAR(1) Model: Y_t = c + Phi * Y_{t-1} + e_t
    Y = clean_vols.values
    Y_lag = Y[:-1, :]
    Y_curr = Y[1:, :]

    # OLS estimation with Ridge shrinkage for stability
    X = np.column_stack([np.ones(len(Y_lag)), Y_lag])
    lambda_reg = 0.05 * np.eye(N + 1)
    lambda_reg[0, 0] = 0.0  # Do not shrink intercept
    beta = np.linalg.pinv(X.T @ X + lambda_reg) @ (X.T @ Y_curr)

    intercept = beta[0, :]
    Phi = beta[1:, :].T  # N x N lag matrix

    # Residuals & Covariance
    residuals = Y_curr - (X @ beta)
    Sigma = np.cov(residuals, rowvar=False) + 1e-6 * np.eye(N)
    sig_diag = np.diag(Sigma)

    # 2. Moving Average Coefficients A_h: A_0 = I, A_h = A_{h-1} * Phi
    A_mats = [np.eye(N)]
    curr_A = np.eye(N)
    for h in range(1, horizon_h):
        curr_A = curr_A @ Phi
        A_mats.append(curr_A)

    # 3. Generalized Variance Decomposition (GVD)
    # theta_{ij}(H) = (sigma_{jj}^-1 * sum_{h=0}^{H-1} (e_i' A_h Sigma e_j)^2) / sum_{h=0}^{H-1} (e_i' A_h Sigma A_h' e_i)
    theta = np.zeros((N, N))

    for i in range(N):
        e_i = np.zeros(N)
        e_i[i] = 1.0

        # Denominator
        denom = sum(float(e_i @ A_mats[h] @ Sigma @ A_mats[h].T @ e_i) for h in range(horizon_h))
        denom = max(denom, 1e-8)

        for j in range(N):
            e_j = np.zeros(N)
            e_j[j] = 1.0
            sigma_jj = max(sig_diag[j], 1e-8)

            # Numerator
            numer = sum((float(e_i @ A_mats[h] @ Sigma @ e_j)) ** 2 for h in range(horizon_h))
            theta[i, j] = (1.0 / sigma_jj) * (numer / denom)

    # Row-normalize to sum to 100%
    row_sums = theta.sum(axis=1, keepdims=True)
    theta_tilde = (theta / np.maximum(row_sums, 1e-8)) * 100.0

    # 4. Spillovers Calculation
    # FROM_i: sum_{j != i} theta_{ij}
    dir_from = np.sum(theta_tilde, axis=1) - np.diag(theta_tilde)
    # TO_j: sum_{i != j} theta_{ij}
    dir_to = np.sum(theta_tilde, axis=0) - np.diag(theta_tilde)
    # NET_i: TO_i - FROM_i
    net = dir_to - dir_from

    # Total Connectedness Index (TCI): mean of FROM spillovers
    tci = float(np.sum(dir_from) / N)

    spill_df = pd.DataFrame(
        np.round(theta_tilde, 2),
        index=assets,
        columns=assets,
    )

    to_dict = {assets[i]: round(float(dir_to[i]), 2) for i in range(N)}
    from_dict = {assets[i]: round(float(dir_from[i]), 2) for i in range(N)}
    net_dict = {assets[i]: round(float(net[i]), 2) for i in range(N)}

    net_trans = [assets[i] for i in range(N) if net[i] > 0]
    net_recv = [assets[i] for i in range(N) if net[i] <= 0]

    # Target specific metrics
    tgt = target_ticker if (target_ticker and target_ticker in assets) else assets[0]
    tgt_net = net_dict.get(tgt, 0.0)
    tgt_role = "Net Systemic Shock Transmitter" if tgt_net > 0 else "Net Volatility Receiver / Absorber"

    return ConnectednessResult(
        total_connectedness_index=round(tci, 2),
        spillover_matrix=spill_df,
        directional_to=to_dict,
        directional_from=from_dict,
        net_spillover=net_dict,
        net_transmitters=net_trans,
        net_receivers=net_recv,
        target_company_tci=round(from_dict.get(tgt, 0.0), 2),
        target_company_role=tgt_role,
    )
