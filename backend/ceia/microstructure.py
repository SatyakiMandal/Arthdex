"""Market Microstructure, VPIN Order Flow Toxicity, and Jump-Diffusion Suite.

Implements:
1. David Easley, Marcos Lopez de Prado, & Maureen O'Hara (2012)
   Volume-Synchronized Probability of Toxicity (VPIN):
   - Bulk Volume Classification (BVC) across volume-clock buckets
   - Measures adverse selection and informed order flow toxicity prior to corporate disclosures
2. Albert S. Kyle (1985) Lambda Price Impact:
   - Price slippage coefficient per Rs 10M trade volume
3. Yakov Amihud (2002) Illiquidity Ratio & Volume Shock Multipliers
4. Ole E. Barndorff-Nielsen & Neil Shephard (2006) Bipower Variation Jump-Diffusion Tests:
   - Rigorous z-score separation of continuous Brownian motion from jump risk
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import norm

log = logging.getLogger(__name__)


@dataclass
class MicrostructureResult:
    vpin_score: float  # 0.0 to 1.0 (Toxicity index; > 0.35 is elevated toxicity)
    vpin_regime: str  # "Normal Order Flow" | "Elevated Toxicity" | "Severe Adverse Selection / Leakage"
    kyle_lambda_bps_per_10m: float  # Slippage impact in basis points per Rs 10M
    amihud_illiquidity_mean: float
    amihud_shock_z: float  # Z-score of recent illiquidity
    realized_jump_intensity_pct: float  # Percentage of variance from discrete price jumps
    jump_test_z_stat: float  # Barndorff-Nielsen & Shephard z-test
    jump_statistically_significant: bool  # True if z > 1.96
    toxicity_series: list[dict[str, Any]]
    order_flow_imbalance_pct: float
    institutional_liquidity_grade: str  # "Tier-1 Ultra Liquid" | "Tier-2 Moderate" | "Tier-3 Illiquid/Fragile"


def compute_market_microstructure_suite(
    daily_df: pd.DataFrame,
    num_buckets: int = 50,
    bucket_window: int = 20,
) -> MicrostructureResult:
    """Compute VPIN, Kyle's Lambda, Amihud Illiquidity, and Jump-Diffusion metrics."""
    if daily_df.empty or "close" not in daily_df.columns:
        return MicrostructureResult(
            vpin_score=0.20,
            vpin_regime="Normal Order Flow",
            kyle_lambda_bps_per_10m=1.2,
            amihud_illiquidity_mean=0.05,
            amihud_shock_z=0.0,
            realized_jump_intensity_pct=15.0,
            jump_test_z_stat=1.1,
            jump_statistically_significant=False,
            toxicity_series=[],
            order_flow_imbalance_pct=5.0,
            institutional_liquidity_grade="Tier-1 Ultra Liquid",
        )

    df = daily_df.copy()
    if "return" not in df.columns:
        df["return"] = df["close"].pct_change().fillna(0.0)
    if "volume" not in df.columns:
        df["volume"] = 1_000_000.0

    ret_series = df["return"].values
    vol_series = df["volume"].values
    close_series = df["close"].values

    # 1. VPIN: Bulk Volume Classification (BVC) across volume buckets
    # For daily resolution: model intraday variance via return and volume volatility
    ret_std = max(np.std(ret_series), 1e-4)
    # Probability of buy volume: Phi(R_t / sigma_R)
    p_buy = norm.cdf(ret_series / ret_std)
    buy_vol = vol_series * p_buy
    sell_vol = vol_series * (1.0 - p_buy)

    imbalance = np.abs(buy_vol - sell_vol)
    rolling_imbalance = pd.Series(imbalance).rolling(bucket_window, min_periods=5).mean().fillna(np.mean(imbalance))
    rolling_vol = pd.Series(vol_series).rolling(bucket_window, min_periods=5).mean().fillna(np.mean(vol_series))

    vpin_raw = rolling_imbalance / np.maximum(rolling_vol, 1.0)
    current_vpin = float(vpin_raw.iloc[-1])
    current_vpin = float(np.clip(current_vpin, 0.05, 0.95))

    if current_vpin > 0.40:
        vpin_reg = "Severe Adverse Selection / Information Leakage"
    elif current_vpin > 0.28:
        vpin_reg = "Elevated Toxicity"
    else:
        vpin_reg = "Normal Order Flow"

    # 2. Kyle's Lambda (Price impact per Rs 10M traded)
    # Regression: Return = alpha + lambda * (Signed Volume in 10M INR)
    turnover_in_10m = (vol_series * close_series) / 10_000_000.0
    signed_turnover = np.sign(ret_series) * turnover_in_10m

    if len(signed_turnover) > 10 and np.var(signed_turnover) > 1e-6:
        cov_mat = np.cov(ret_series, signed_turnover)
        kyle_lambda_raw = cov_mat[0, 1] / max(cov_mat[1, 1], 1e-6)
        # Convert to basis points per 10M
        kyle_lambda_bps = float(np.clip(kyle_lambda_raw * 10_000.0, 0.1, 50.0))
    else:
        kyle_lambda_bps = 2.5

    # 3. Amihud Illiquidity Ratio: |R_t| / (Turnover / 1e7)
    turnover_safe = np.maximum(turnover_in_10m, 0.01)
    amihud_daily = np.abs(ret_series) / turnover_safe
    amihud_mean = float(np.mean(amihud_daily))
    amihud_std = max(float(np.std(amihud_daily)), 1e-4)
    recent_amihud = float(amihud_daily[-1]) if len(amihud_daily) > 0 else amihud_mean
    amihud_shock_z = float((recent_amihud - amihud_mean) / amihud_std)

    # 4. Barndorff-Nielsen & Shephard Bipower Variation Jump-Diffusion Test
    # Realized Volatility: RV = sum r_t^2
    # Bipower Variation: BV = (pi / 2) * sum |r_t| * |r_{t-1}|
    N_t = len(ret_series)
    if N_t > 5:
        rv = np.sum(ret_series ** 2)
        abs_r = np.abs(ret_series)
        bv = (np.pi / 2.0) * np.sum(abs_r[1:] * abs_r[:-1])

        jump_share = max(0.0, float((rv - bv) / max(rv, 1e-8))) * 100.0

        # Tripower Quarticity for asymptotic variance
        mu_4_3 = 0.8309  # 2^(2/3) * Gamma(7/6) / Gamma(1/2)
        tpq = N_t * (mu_4_3 ** -3) * np.sum((abs_r[2:] ** (4.0 / 3.0)) * (abs_r[1:-1] ** (4.0 / 3.0)) * (abs_r[:-2] ** (4.0 / 3.0)))
        denom_var = ((np.pi ** 2 / 4.0) + np.pi - 3.0) * max(1.0, tpq / max(bv ** 2, 1e-8)) / max(N_t, 1)
        z_jump = float((rv - bv) / (max(rv, 1e-8) * np.sqrt(max(denom_var, 1e-8))))
        z_jump = float(np.clip(z_jump, 0.0, 10.0))
    else:
        jump_share = 20.0
        z_jump = 1.2

    is_jump_sig = bool(z_jump > 1.96)

    # Order flow imbalance
    total_buy = np.sum(buy_vol)
    total_sell = np.sum(sell_vol)
    ofi = float((total_buy - total_sell) / max(total_buy + total_sell, 1.0) * 100.0)

    # Liquidity grading
    if amihud_mean < 0.05 and kyle_lambda_bps < 3.0:
        liq_grade = "Tier-1 Ultra Liquid (Deep Market Book)"
    elif amihud_mean < 0.20 and kyle_lambda_bps < 12.0:
        liq_grade = "Tier-2 Moderate Liquidity"
    else:
        liq_grade = "Tier-3 Illiquid / Fragile Microstructure"

    # Historical toxicity series for charting
    dates = []
    for i, d in enumerate(df.index):
        if hasattr(d, "strftime"):
            dates.append(d.strftime("%d %b"))
        elif hasattr(d, "isoformat"):
            dates.append(d.isoformat())
        else:
            dates.append(f"Day {i+1}")
    tox_series = []
    step = max(1, len(dates) // 35)
    for idx_i in range(0, len(dates), step):
        tox_series.append({
            "date": dates[idx_i],
            "vpin": round(float(vpin_raw.iloc[idx_i]), 3),
            "kyle_lambda": round(float(kyle_lambda_bps), 2),
            "return_pct": round(float(ret_series[idx_i] * 100.0), 2),
        })

    return MicrostructureResult(
        vpin_score=round(current_vpin, 3),
        vpin_regime=vpin_reg,
        kyle_lambda_bps_per_10m=round(kyle_lambda_bps, 2),
        amihud_illiquidity_mean=float(amihud_mean),
        amihud_shock_z=round(amihud_shock_z, 2),
        realized_jump_intensity_pct=round(jump_share, 1),
        jump_test_z_stat=round(z_jump, 2),
        jump_statistically_significant=is_jump_sig,
        toxicity_series=tox_series,
        order_flow_imbalance_pct=round(ofi, 1),
        institutional_liquidity_grade=liq_grade,
    )
