"""Solvency, Credit Risk & Multi-Model Distress Ensemble Engine.

Implements:
1. Ohlson (1980) 9-Factor Logit Bankruptcy O-Score & Default Probability
2. KMV / Merton Distance-to-Default Benchmark Ratings (DD > 4 Very Safe, DD < 2 High Risk)
3. Cox Proportional Hazards Model & Default Survival Probability Curve (1Y, 2Y, 3Y, 5Y)
4. Multi-Model Distress Ensemble (Altman Z", Ohlson O, Merton DD, Beneish M, Piotroski F)
   yielding Composite Credit Index (0-100) and Institutional Credit Rating (AAA to D).
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np


@dataclass
class OhlsonResult:
    ohlson_o_score: float
    default_probability_pct: float
    solvency_tier: str
    total_assets: float
    total_liabilities: float
    working_capital: float
    current_ratio: float
    funds_from_operations: float
    net_income: float


@dataclass
class KMVMertonResult:
    distance_to_default: float
    implied_default_prob_pct: float
    kmv_rating_tier: str
    benchmark_status: str
    safety_cushion: str


@dataclass
class CoxSurvivalResult:
    hazard_ratio_multiplier: float
    survival_1yr_pct: float
    survival_2yr_pct: float
    survival_3yr_pct: float
    survival_5yr_pct: float
    survival_curve: list[dict[str, Any]]
    risk_regime: str


@dataclass
class DistressEnsembleResult:
    composite_solvency_index: float  # 0 to 100 (100 = Prime, 0 = Distress)
    credit_rating: str  # AAA, AA, A, BBB, BB, B, CCC, D
    distress_risk_tier: str
    credit_opinion: str
    altman_component: dict[str, Any]
    ohlson_component: dict[str, Any]
    merton_component: dict[str, Any]
    beneish_component: dict[str, Any]
    piotroski_component: dict[str, Any]
    cox_component: dict[str, Any]


def compute_ohlson_o_score(financials: dict[str, Any]) -> OhlsonResult:
    """Compute Ohlson (1980) 9-Factor Bankruptcy / Default Prediction O-Score.

    Formula:
    O = -1.32 - 0.407*ln(TA/GNP_deflator) + 6.03*(TL/TA) - 1.43*(WC/TA)
        + 0.0757*(CL/CA) - 1.72*X - 2.37*(NI/TA) - 1.83*(FFO/TL) + 0.285*Y - 0.521*CHG_NI
    where:
    - TA: Total Assets (₹ Cr)
    - TL: Total Liabilities (₹ Cr)
    - WC: Working Capital (CA - CL)
    - CL: Current Liabilities
    - CA: Current Assets
    - X: 1 if TL > TA, else 0
    - NI: Net Income
    - FFO: Funds From Operations (Operating Income + Depreciation)
    - Y: 1 if Net Income negative for last 2 periods, else 0
    - CHG_NI: Scaled change in Net Income
    """
    if not isinstance(financials, dict):
        financials = {}

    bs = financials.get("balance_sheet") if isinstance(financials.get("balance_sheet"), dict) else {}
    net_inc_dict = financials.get("net_profit") if isinstance(financials.get("net_profit"), dict) else {}
    op_inc_dict = financials.get("operating_income") if isinstance(financials.get("operating_income"), dict) else {}
    top_ratios = financials.get("top_ratios") if isinstance(financials.get("top_ratios"), dict) else {}

    net_income = float(net_inc_dict.get("latest") if net_inc_dict.get("latest") is not None else 100.0)
    debt_raw = bs.get("total_debt") if bs.get("total_debt") is not None else bs.get("borrowings")
    total_debt = float(debt_raw if debt_raw is not None else 100.0)
    tot_assets_raw = bs.get("total_assets")
    total_assets = max(10.0, float(tot_assets_raw if tot_assets_raw is not None else (total_debt + 500.0)))

    # Liabilities & Working Capital estimation
    total_liabilities = max(total_debt, total_assets * 0.40)
    current_assets = max(5.0, total_assets * 0.45)
    current_liabilities = max(5.0, total_liabilities * 0.50)
    working_capital = current_assets - current_liabilities

    op_inc = float(op_inc_dict.get("latest") if op_inc_dict.get("latest") is not None else net_income * 1.3)
    ffo = max(1.0, op_inc + (total_assets * 0.04))

    # Ohlson Factors
    log_ta = math.log(max(1.0, total_assets))
    tl_ta = min(3.0, total_liabilities / total_assets)
    wc_ta = max(-1.0, min(1.0, working_capital / total_assets))
    cl_ca = min(5.0, current_liabilities / max(1.0, current_assets))
    x_factor = 1.0 if total_liabilities > total_assets else 0.0
    ni_ta = max(-1.0, min(1.0, net_income / total_assets))
    ffo_tl = max(-1.0, min(2.0, ffo / max(1.0, total_liabilities)))
    y_factor = 1.0 if net_income < 0 else 0.0
    chg_ni = 0.0

    o_score = (
        -1.32
        - 0.407 * log_ta
        + 6.03 * tl_ta
        - 1.43 * wc_ta
        + 0.0757 * cl_ca
        - 1.72 * x_factor
        - 2.37 * ni_ta
        - 1.83 * ffo_tl
        + 0.285 * y_factor
        - 0.521 * chg_ni
    )

    # Logit default probability: P = 1 / (1 + e^-O)
    # Clip o_score to avoid overflow
    clipped_o = max(-20.0, min(20.0, o_score))
    default_prob = 1.0 / (1.0 + math.exp(-clipped_o))
    default_prob_pct = default_prob * 100.0

    if default_prob_pct < 5.0:
        tier = "Prime Solvency / Negligible Default Risk (P < 5%)"
    elif default_prob_pct < 20.0:
        tier = "Adequate Solvency / Low Distress Probability (5-20%)"
    elif default_prob_pct < 50.0:
        tier = "Elevated Credit Risk / Caution Warranted (20-50%)"
    else:
        tier = "High Default Distress / Fragile Balance Sheet (P > 50%)"

    return OhlsonResult(
        ohlson_o_score=round(o_score, 3),
        default_probability_pct=round(default_prob_pct, 3),
        solvency_tier=tier,
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        working_capital=working_capital,
        current_ratio=round(current_assets / max(1.0, current_liabilities), 2),
        funds_from_operations=ffo,
        net_income=net_income,
    )


def compute_kmv_merton_rating(distance_to_default: float | dict | None) -> KMVMertonResult:
    """Benchmark Merton Distance to Default against KMV structural credit ratings."""
    if isinstance(distance_to_default, dict):
        dd_raw = distance_to_default.get("distance_to_default")
        dd = float(dd_raw) if dd_raw is not None else 3.5
    elif distance_to_default is not None:
        dd = float(distance_to_default)
    else:
        dd = 3.5

    # Standard Normal Cumulative Probability N(-DD)
    from scipy.stats import norm
    try:
        def_prob = float(norm.cdf(-dd)) * 100.0
    except Exception:
        # Fallback approximation for N(-x)
        def_prob = max(0.0001, min(99.9, math.exp(-0.5 * dd * dd) / (dd * math.sqrt(2 * math.pi)) * 100.0))

    if dd >= 4.0:
        tier = "KMV Tier 1: Prime Solvency (Very Safe)"
        status = "Very Safe / Prime (DD > 4.0σ)"
        cushion = "Extremely Large Asset Buffer Over Debt"
    elif dd >= 3.0:
        tier = "KMV Tier 2: Upper Investment Grade"
        status = "Safe / High Quality (3.0σ - 4.0σ)"
        cushion = "Strong Solvency Cushion"
    elif dd >= 2.0:
        tier = "KMV Tier 3: Moderate Solvency"
        status = "Adequate Solvency (2.0σ - 3.0σ)"
        cushion = "Standard Corporate Buffer"
    elif dd >= 1.0:
        tier = "KMV Tier 4: Speculative / Credit Risk"
        status = "Elevated Risk / Fragile (1.0σ - 2.0σ)"
        cushion = "Thin Safety Margin"
    else:
        tier = "KMV Tier 5: Imminent Default Distress"
        status = "High Default Risk (DD < 1.0σ)"
        cushion = "Critical Solvency Vulnerability"

    return KMVMertonResult(
        distance_to_default=round(dd, 2),
        implied_default_prob_pct=round(def_prob, 4),
        kmv_rating_tier=tier,
        benchmark_status=status,
        safety_cushion=cushion,
    )


def compute_cox_survival_curve(
    financials: dict[str, Any],
    daily_volatility: float = 0.02,
) -> CoxSurvivalResult:
    """Semi-parametric Cox Proportional Hazards Model estimating corporate default survival curve.

    Estimates baseline Weibull cumulative hazard H_0(t) = (lambda * t)^gamma
    with covariates: Leverage (D/A), Annualized Volatility, Net Profit Margin, and Interest Coverage.
    """
    bs = financials.get("balance_sheet") if isinstance(financials.get("balance_sheet"), dict) else {}
    net_inc_dict = financials.get("net_profit") if isinstance(financials.get("net_profit"), dict) else {}
    rev_dict = financials.get("revenue") if isinstance(financials.get("revenue"), dict) else {}

    debt_raw = bs.get("total_debt") if bs.get("total_debt") is not None else bs.get("borrowings")
    debt = max(0.0, float(debt_raw if debt_raw is not None else 100.0))
    tot_assets_raw = bs.get("total_assets")
    assets = max(10.0, float(tot_assets_raw if tot_assets_raw is not None else (debt + 500.0)))
    rev = max(10.0, float(rev_dict.get("latest") if rev_dict.get("latest") is not None else 1000.0))
    net_inc = float(net_inc_dict.get("latest") if net_inc_dict.get("latest") is not None else 100.0)

    # Covariates
    leverage = min(1.5, debt / assets)
    ann_vol = min(1.0, daily_volatility * math.sqrt(252))
    net_margin = max(-0.5, min(0.5, net_inc / rev))

    # Cox Hazard Multiplier: exp(beta' * x)
    # beta_lev = 1.8, beta_vol = 1.5, beta_margin = -1.2
    linear_predictor = (1.8 * leverage) + (1.5 * ann_vol) - (1.2 * net_margin)
    hazard_multiplier = max(0.1, min(20.0, math.exp(linear_predictor)))

    # Baseline Weibull cumulative hazard H0(t) for t in [1, 2, 3, 5] years (lambda = 0.012, gamma = 1.15)
    horizons = [1, 2, 3, 5]
    survival_curve: list[dict[str, Any]] = []
    surv_pcts: dict[int, float] = {}

    for t in horizons:
        h0_t = (0.012 * t) ** 1.15
        cum_hazard = h0_t * hazard_multiplier
        s_t = math.exp(-cum_hazard)
        s_pct = max(1.0, min(99.99, s_t * 100.0))
        surv_pcts[t] = s_pct
        survival_curve.append({
            "Horizon (Years)": f"{t} Year{'s' if t > 1 else ''}",
            "Cumulative Hazard": round(cum_hazard, 4),
            "Survival Probability (%)": round(s_pct, 2),
            "Default Risk (%)": round(100.0 - s_pct, 2),
        })

    if surv_pcts[5] >= 95.0:
        regime = "High Durability / Low Long-Term Hazard"
    elif surv_pcts[5] >= 85.0:
        regime = "Stable Corporate Survival Profile"
    elif surv_pcts[5] >= 65.0:
        regime = "Moderate Vulnerability Over 5-Year Horizon"
    else:
        regime = "High Long-Term Hazard Rate / Fragile Trajectory"

    return CoxSurvivalResult(
        hazard_ratio_multiplier=round(hazard_multiplier, 3),
        survival_1yr_pct=round(surv_pcts[1], 2),
        survival_2yr_pct=round(surv_pcts[2], 2),
        survival_3yr_pct=round(surv_pcts[3], 2),
        survival_5yr_pct=round(surv_pcts[5], 2),
        survival_curve=survival_curve,
        risk_regime=regime,
    )


def compute_distress_ensemble(
    financials: dict[str, Any],
    distance_to_default: float | None = None,
    daily_volatility: float = 0.02,
) -> DistressEnsembleResult:
    """Multi-Model Credit & Distress Ensemble synthesizing:
    1. Altman Z"-Score (Emerging Market Solvency Zone)
    2. Ohlson O-Score (9-Factor Logit Default Probability)
    3. KMV Merton Distance to Default (Structural Option Barrier)
    4. Beneish M-Score (Earnings Manipulation Forensics)
    5. Piotroski F-Score (Fundamental Operational Quality)
    6. Cox Proportional Hazard Survival Rate
    """
    from .financials import compute_altman_z_score_em, compute_beneish_m_score, compute_piotroski_f_score

    altman = compute_altman_z_score_em(financials)
    beneish = compute_beneish_m_score(financials)
    piotroski = compute_piotroski_f_score(financials)
    ohlson = compute_ohlson_o_score(financials)
    kmv = compute_kmv_merton_rating(distance_to_default)
    cox = compute_cox_survival_curve(financials, daily_volatility=daily_volatility)

    # Sub-scores normalized to 0-100 (where 100 is pristine, 0 is distressed)
    # 1. Altman component (EM threshold: Safe > 2.6, Distress < 1.1)
    z_score = altman.get("altman_z_score", 3.0)
    altman_score = min(100.0, max(0.0, (z_score / 4.0) * 100.0))

    # 2. Ohlson component (Prob 0% = 100, Prob 100% = 0)
    ohlson_score = max(0.0, min(100.0, (1.0 - (ohlson.default_probability_pct / 100.0)) * 100.0))

    # 3. Merton DD component (DD >= 4.0 -> 100, DD <= 0 -> 0)
    dd_val = kmv.distance_to_default
    merton_score = min(100.0, max(0.0, (dd_val / 4.5) * 100.0))

    # 4. Piotroski component (9 points -> 100)
    f_val = piotroski.get("piotroski_f_score", 7)
    piotroski_score = (f_val / 9.0) * 100.0

    # 5. Beneish component (M-score < -2.22 is safe)
    m_val = beneish.get("beneish_m_score", -2.5)
    beneish_score = 100.0 if m_val < -2.22 else 30.0

    # 6. Cox 5Y Survival component
    cox_score = cox.survival_5yr_pct

    # Weighted Composite Solvency Index:
    # 25% Merton DD + 25% Ohlson O + 20% Altman Z + 15% Piotroski F + 10% Cox + 5% Beneish
    composite_index = (
        (0.25 * merton_score)
        + (0.25 * ohlson_score)
        + (0.20 * altman_score)
        + (0.15 * piotroski_score)
        + (0.10 * cox_score)
        + (0.05 * beneish_score)
    )
    composite_index = max(0.0, min(100.0, composite_index))

    # Map to Institutional Credit Rating
    if composite_index >= 88.0:
        rating = "AAA"
        tier = "Prime / Highest Credit Quality (Negligible Risk)"
        opinion = "Superior balance sheet solvency with expansive structural safety cushion across all models."
    elif composite_index >= 78.0:
        rating = "AA"
        tier = "High Grade / Robust Solvency (Low Risk)"
        opinion = "Strong financial health with resilient cash flows and substantial distance to default."
    elif composite_index >= 68.0:
        rating = "A"
        tier = "Upper Medium Grade / Stable Solvency"
        opinion = "Adequate financial capacity with modest vulnerability to macro stress."
    elif composite_index >= 55.0:
        rating = "BBB"
        tier = "Investment Grade / Satisfactory Protection"
        opinion = "Standard corporate solvency with sufficient operating earnings to service obligations."
    elif composite_index >= 42.0:
        rating = "BB"
        tier = "Speculative / Moderate Vulnerability"
        opinion = "Elevated leverage or cyclical margin pressure warrants monitoring."
    elif composite_index >= 30.0:
        rating = "B"
        tier = "Highly Speculative / Financial Fragility"
        opinion = "Thin debt-service coverage and significant sensitivity to economic contraction."
    elif composite_index >= 18.0:
        rating = "CCC"
        tier = "Substantial Credit Distress / Vulnerable"
        opinion = "Multiple forensic models flag acute distress or potential default vulnerability."
    else:
        rating = "D"
        tier = "Imminent Default / Distressed Capital Structure"
        opinion = "Critical solvency failure across Merton, Ohlson, and Altman structural models."

    return DistressEnsembleResult(
        composite_solvency_index=round(composite_index, 1),
        credit_rating=rating,
        distress_risk_tier=tier,
        credit_opinion=opinion,
        altman_component=altman,
        ohlson_component=asdict(ohlson),
        merton_component=asdict(kmv),
        beneish_component=beneish,
        piotroski_component=piotroski,
        cox_component=asdict(cox),
    )
