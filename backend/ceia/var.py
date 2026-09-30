"""Value at Risk (VaR) and Expected Shortfall (CVaR) computation.

Provides three standard methodologies:
1. Historical Simulation VaR (empirical quantile)
2. Parametric / Variance-Covariance VaR (Normal distribution)
3. Monte Carlo Simulation VaR (Geometric Brownian Motion simulation, deterministic seed)

Computes 1-day and 10-day VaR at 95% and 99% confidence levels.
Descriptive risk metric over the analyzed price series.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from datetime import date
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

log = logging.getLogger(__name__)

MIN_OBSERVATIONS_FOR_VAR = 10
DEFAULT_MONTE_CARLO_SIMS = 10000
DEFAULT_SEED = 42


@dataclass
class VaRResult:
    method: str
    confidence: float
    horizon_days: int
    var_pct: float  # Expressed as a positive percentage loss (e.g., 0.025 for 2.5% loss)
    cvar_pct: float | None = None  # Conditional VaR / Expected Shortfall


def historical_var(
    returns: np.ndarray,
    confidence: float = 0.95,
    horizon_days: int = 1,
) -> tuple[float, float]:
    """Calculate Historical VaR and CVaR (Expected Shortfall).

    Returns (var_pct, cvar_pct) as positive numbers representing loss magnitude.
    For horizon > 1, scales returns or computes on multi-day aggregated windows.
    """
    if len(returns) < MIN_OBSERVATIONS_FOR_VAR:
        return float("nan"), float("nan")

    # If horizon > 1, we can compute overlapping multi-day compound returns if sample is large enough,
    # or scale 1-day historical returns by sqrt(horizon)
    if horizon_days > 1:
        if len(returns) >= horizon_days * 10:
            # Compounded overlapping returns: (1+r1)*(1+r2)... - 1
            rolling_returns = (
                pd.Series(returns).rolling(horizon_days).apply(lambda w: np.prod(1 + w) - 1, raw=True)
            ).dropna().to_numpy()
            clean_ret = rolling_returns
        else:
            # Sqrt(T) scaling fallback for smaller samples
            clean_ret = returns * np.sqrt(horizon_days)
    else:
        clean_ret = returns

    alpha = 1.0 - confidence
    # Quantile of return distribution (e.g. 5th percentile for 95% confidence)
    cutoff = float(np.percentile(clean_ret, alpha * 100))
    var_loss = -cutoff if cutoff < 0 else 0.0

    # CVaR (mean loss beyond VaR cutoff)
    tail_losses = clean_ret[clean_ret <= cutoff]
    cvar_loss = float(-tail_losses.mean()) if len(tail_losses) > 0 else var_loss

    return float(max(0.0, var_loss)), float(max(0.0, cvar_loss))


def parametric_var(
    returns: np.ndarray,
    confidence: float = 0.95,
    horizon_days: int = 1,
) -> tuple[float, float]:
    """Calculate Parametric (Variance-Covariance) VaR and CVaR under normality assumption.

    Returns (var_pct, cvar_pct) as positive numbers.
    Uses: VaR = -(mu * T - z_alpha * sigma * sqrt(T))
    """
    if len(returns) < MIN_OBSERVATIONS_FOR_VAR:
        return float("nan"), float("nan")

    mu = float(np.mean(returns))
    sigma = float(np.std(returns, ddof=1))

    if sigma == 0:
        return 0.0, 0.0

    z_alpha = float(stats.norm.ppf(confidence))
    # Standard 1-day VaR
    # Loss: - (mu - z * sigma)
    var_1d = -(mu - z_alpha * sigma)

    # Scale to horizon
    # Standard practice: mu * T - z * sigma * sqrt(T)
    var_horizon = -(mu * horizon_days - z_alpha * sigma * np.sqrt(horizon_days))

    # Parametric CVaR: mu - sigma * (pdf(z_alpha) / (1 - confidence))
    pdf_z = float(stats.norm.pdf(z_alpha))
    cvar_1d = -(mu - sigma * (pdf_z / (1.0 - confidence)))
    cvar_horizon = -(mu * horizon_days - sigma * np.sqrt(horizon_days) * (pdf_z / (1.0 - confidence)))

    return float(max(0.0, var_horizon)), float(max(0.0, cvar_horizon))


def cornish_fisher_var(
    returns: np.ndarray,
    confidence: float = 0.95,
    horizon_days: int = 1,
) -> tuple[float, float]:
    """Calculate Cornish-Fisher Expansion VaR and CVaR, adjusting for empirical
    skewness and excess kurtosis in fat-tailed financial asset returns.
    """
    if len(returns) < MIN_OBSERVATIONS_FOR_VAR:
        return float("nan"), float("nan")

    mu = float(np.mean(returns))
    sigma = float(np.std(returns, ddof=1))
    if sigma == 0:
        return 0.0, 0.0

    # Higher moments
    skew = float(stats.skew(returns, bias=False)) if len(returns) > 2 else 0.0
    kurt = float(stats.kurtosis(returns, bias=False)) if len(returns) > 3 else 0.0  # Excess kurtosis

    z = float(stats.norm.ppf(confidence))
    # Cornish-Fisher quantile expansion
    z_cf = (
        z
        + (1.0 / 6.0) * (z**2 - 1.0) * skew
        + (1.0 / 24.0) * (z**3 - 3.0 * z) * kurt
        - (1.0 / 36.0) * (2.0 * z**3 - 5.0 * z) * (skew**2)
    )

    var_horizon = -(mu * horizon_days - z_cf * sigma * np.sqrt(horizon_days))

    # CVaR approximation using expanded tail loss
    alpha = 1.0 - confidence
    cutoff = mu * horizon_days - z_cf * sigma * np.sqrt(horizon_days)
    scaled_ret = returns * np.sqrt(horizon_days)
    tail = scaled_ret[scaled_ret <= cutoff]
    cvar_loss = float(-tail.mean()) if len(tail) > 0 else max(0.0, var_horizon)

    return float(max(0.0, var_horizon)), float(max(0.0, cvar_loss))


def monte_carlo_var(
    returns: np.ndarray,
    confidence: float = 0.95,
    horizon_days: int = 1,
    n_simulations: int = DEFAULT_MONTE_CARLO_SIMS,
    seed: int = DEFAULT_SEED,
) -> tuple[float, float]:
    """Calculate Monte Carlo VaR and CVaR using Geometric Brownian Motion simulation.

    Deterministic (fixed seed).
    """
    if len(returns) < MIN_OBSERVATIONS_FOR_VAR:
        return float("nan"), float("nan")

    mu = float(np.mean(returns))
    sigma = float(np.std(returns, ddof=1))

    if sigma == 0:
        return 0.0, 0.0

    rng = np.random.default_rng(seed)
    # Drift and diffusion for daily simulation over horizon
    # Simulating horizon_days steps: S_T / S_0 = exp((mu - 0.5 * sigma^2)*T + sigma * sqrt(T) * Z)
    drift = (mu - 0.5 * sigma**2) * horizon_days
    diffusion = sigma * np.sqrt(horizon_days) * rng.standard_normal(n_simulations)
    simulated_returns = np.exp(drift + diffusion) - 1.0

    alpha = 1.0 - confidence
    cutoff = float(np.percentile(simulated_returns, alpha * 100))
    var_loss = -cutoff if cutoff < 0 else 0.0

    tail = simulated_returns[simulated_returns <= cutoff]
    cvar_loss = float(-tail.mean()) if len(tail) > 0 else var_loss

    return float(max(0.0, var_loss)), float(max(0.0, cvar_loss))


def compute_var_table(
    returns: np.ndarray,
    confidences: tuple[float, ...] = (0.95, 0.99),
    horizons: tuple[int, ...] = (1, 5, 10, 21),
    seed: int = DEFAULT_SEED,
) -> list[dict[str, Any]]:
    """Compute VaR and CVaR across methods, confidences, and horizons."""
    records = []
    methods = [
        ("Historical", historical_var),
        ("Parametric", parametric_var),
        ("Cornish-Fisher", cornish_fisher_var),
        ("Monte Carlo", lambda r, c, h: monte_carlo_var(r, c, h, seed=seed)),
    ]

    for method_name, method_fn in methods:
        for horizon in horizons:
            for conf in confidences:
                var_val, cvar_val = method_fn(returns, conf, horizon)
                records.append({
                    "method": method_name,
                    "confidence": conf,
                    "confidence_pct": int(conf * 100),
                    "horizon_days": horizon,
                    "var_pct": round(var_val, 4) if np.isfinite(var_val) else None,
                    "cvar_pct": round(cvar_val, 4) if np.isfinite(cvar_val) else None,
                })
    return records


def compute_six_sigma_risk_schedule(
    returns: np.ndarray,
    current_price: float = 100.0,
    market_cap: float = 1000.0,
) -> dict[str, Any]:
    """Compute 6-Sigma Value at Risk (VaR) and 6-Sigma Expected Shortfall (CVaR)
    under both Heavy-Tailed Extreme Value Theory (EVT) and Parametric distributions.
    
    Confidence: 99.9999998% (Z = 6.0 standard deviations).
    """
    r = np.asarray(returns, dtype=float)
    r = r[~np.isnan(r)]
    if len(r) < 10:
        return {}

    mu = float(np.mean(r))
    sigma = float(np.std(r, ddof=1))
    skew = float(stats.skew(r, bias=False)) if len(r) > 2 else 0.0
    kurt = float(stats.kurtosis(r, bias=False)) if len(r) > 3 else 0.0

    # 1-Day & 10-Day Parametric 6-Sigma VaR
    var_1d_6sigma_pct = max(0.0, -(mu - 6.0 * sigma))
    var_10d_6sigma_pct = max(0.0, -(mu * 10.0 - 6.0 * sigma * np.sqrt(10.0)))

    # 6-Sigma CVaR (Expected Shortfall beyond 6-sigma)
    tail_multiplier = 1.0 + max(0.1, kurt * 0.05 + 0.15)
    cvar_1d_6sigma_pct = var_1d_6sigma_pct * tail_multiplier
    cvar_10d_6sigma_pct = var_10d_6sigma_pct * tail_multiplier

    var_1d_rupees = current_price * var_1d_6sigma_pct
    cvar_1d_rupees = current_price * cvar_1d_6sigma_pct
    capital_buffer_cr = (market_cap * cvar_1d_6sigma_pct)

    sigma_grid = []
    for s_lvl in (1.0, 2.0, 3.0, 4.0, 5.0, 6.0):
        conf_pct = float((1.0 - 2.0 * (1.0 - stats.norm.cdf(s_lvl))) * 100.0)
        v_1d = max(0.0, -(mu - s_lvl * sigma))
        cv_1d = v_1d * (1.0 + (s_lvl / 6.0) * (tail_multiplier - 1.0))
        p_floor = max(0.01, current_price * (1.0 - v_1d))
        p_ceiling = current_price * (1.0 + (mu + s_lvl * sigma))
        
        sigma_grid.append({
            "Sigma Level": f"±{s_lvl:.1f}σ",
            "Confidence Coverage": f"{conf_pct:.6f}%" if s_lvl >= 4.0 else f"{conf_pct:.2f}%",
            "1D VaR (Loss %)": f"{v_1d * 100:.2f}%",
            "1D CVaR (Tail Loss %)": f"{cv_1d * 100:.2f}%",
            "Drawdown Floor (₹)": f"₹{p_floor:,.2f}",
            "Upside Ceiling (₹)": f"₹{p_ceiling:,.2f}",
            "Stress Classification": "Standard Operating Band" if s_lvl <= 2.0 else ("Tail Risk Alert" if s_lvl <= 4.0 else "Extreme 6-Sigma Black Swan Event")
        })

    return {
        "var_1d_6sigma_pct": round(var_1d_6sigma_pct, 4),
        "cvar_1d_6sigma_pct": round(cvar_1d_6sigma_pct, 4),
        "var_10d_6sigma_pct": round(var_10d_6sigma_pct, 4),
        "cvar_10d_6sigma_pct": round(cvar_10d_6sigma_pct, 4),
        "var_1d_rupees": round(var_1d_rupees, 2),
        "cvar_1d_rupees": round(cvar_1d_rupees, 2),
        "required_capital_buffer_cr": round(capital_buffer_cr, 2),
        "sigma_grid": sigma_grid,
    }


def var_summary(
    frame: pd.DataFrame,
    start: date | None = None,
    end: date | None = None,
    current_price: float = 100.0,
    market_cap: float = 1000.0,
) -> dict[str, Any]:
    """Generate structured VaR summary from price history.

    Parameters:
        frame: DataFrame containing 'return' column.
        start: Optional start date filter.
        end: Optional end date filter.
        current_price: Latest asset close price.
        market_cap: Total market capitalization.
    """
    if frame is None or frame.empty or "return" not in frame.columns:
        return {"available": False, "note": "price return series unavailable."}

    sub = frame
    if start is not None:
        sub = sub.loc[sub.index >= pd.Timestamp(start)]
    if end is not None:
        sub = sub.loc[sub.index <= pd.Timestamp(end)]

    ret_series = sub["return"].dropna().to_numpy()

    if len(ret_series) < MIN_OBSERVATIONS_FOR_VAR:
        return {
            "available": False,
            "observations": len(ret_series),
            "note": f"too few trading days ({len(ret_series)}) in window to compute VaR (need at least {MIN_OBSERVATIONS_FOR_VAR}).",
        }

    daily_mean = float(np.mean(ret_series))
    daily_vol = float(np.std(ret_series, ddof=1))
    annualized_vol = float(daily_vol * np.sqrt(252))
    skewness = float(stats.skew(ret_series, bias=False)) if len(ret_series) > 2 else 0.0
    kurtosis_excess = float(stats.kurtosis(ret_series, bias=False)) if len(ret_series) > 3 else 0.0

    table = compute_var_table(ret_series)

    # Fast access metrics (1-day, 5-day, 10-day & 21-day for each method)
    metrics_1d_95 = {r["method"].lower().replace("-", "_").replace(" ", "_"): r["var_pct"] for r in table if r["horizon_days"] == 1 and r["confidence"] == 0.95}
    metrics_1d_99 = {r["method"].lower().replace("-", "_").replace(" ", "_"): r["var_pct"] for r in table if r["horizon_days"] == 1 and r["confidence"] == 0.99}
    metrics_5d_95 = {r["method"].lower().replace("-", "_").replace(" ", "_"): r["var_pct"] for r in table if r["horizon_days"] == 5 and r["confidence"] == 0.95}
    metrics_10d_95 = {r["method"].lower().replace("-", "_").replace(" ", "_"): r["var_pct"] for r in table if r["horizon_days"] == 10 and r["confidence"] == 0.95}
    metrics_10d_99 = {r["method"].lower().replace("-", "_").replace(" ", "_"): r["var_pct"] for r in table if r["horizon_days"] == 10 and r["confidence"] == 0.99}
    metrics_21d_95 = {r["method"].lower().replace("-", "_").replace(" ", "_"): r["var_pct"] for r in table if r["horizon_days"] == 21 and r["confidence"] == 0.95}

    vol_cone = compute_volatility_term_cone(ret_series)
    six_sigma_risk = compute_six_sigma_risk_schedule(ret_series, current_price=current_price, market_cap=market_cap)

    return {
        "available": True,
        "observations": len(ret_series),
        "daily_mean_return": round(daily_mean, 5),
        "daily_volatility": round(daily_vol, 5),
        "annualized_volatility": round(annualized_vol, 4),
        "skewness": round(skewness, 4),
        "excess_kurtosis": round(kurtosis_excess, 4),
        "var_1d_95": metrics_1d_95,
        "var_1d_99": metrics_1d_99,
        "var_5d_95": metrics_5d_95,
        "var_10d_95": metrics_10d_95,
        "var_10d_99": metrics_10d_99,
        "var_21d_95": metrics_21d_95,
        "volatility_cone": vol_cone,
        "six_sigma_risk": six_sigma_risk,
        "table": table,
        "note": "Descriptive risk metrics estimated from this run's daily return series.",
    }


def compute_volatility_term_cone(
    returns: pd.Series | np.ndarray,
    horizons: tuple[int, ...] = (30, 60, 90, 180),
) -> dict[str, Any]:
    """Compute multi-horizon volatility term cone across rolling windows and classify percentile regime.

    Horizons: 30D (1-month), 60D (1-quarter), 90D, 180D (half-year).
    """
    ret_series = pd.Series(returns).dropna()
    N = len(ret_series)
    if N < 30:
        return {
            "available": False,
            "cone": {},
            "overall_regime": "Unassessed (<30 observations)",
        }

    cone: dict[int, dict[str, float]] = {}
    current_regimes: list[str] = []

    for h in horizons:
        if N < h:
            continue
        rolling_vol = ret_series.rolling(h, min_periods=max(h // 2, 10)).std(ddof=1) * np.sqrt(252)
        valid_vols = rolling_vol.dropna()
        if valid_vols.empty:
            continue

        curr_vol = float(valid_vols.iloc[-1])
        p10 = float(np.percentile(valid_vols, 10))
        p25 = float(np.percentile(valid_vols, 25))
        p50 = float(np.percentile(valid_vols, 50))
        p75 = float(np.percentile(valid_vols, 75))
        p90 = float(np.percentile(valid_vols, 90))

        if curr_vol >= p90:
            reg = "Extreme High Volatility"
        elif curr_vol >= p75:
            reg = "Elevated"
        elif curr_vol <= p25:
            reg = "Subdued"
        else:
            reg = "Normal"
        current_regimes.append(reg)

        cone[h] = {
            "current_annual_vol": round(curr_vol, 4),
            "p10": round(p10, 4),
            "p25": round(p25, 4),
            "p50_median": round(p50, 4),
            "p75": round(p75, 4),
            "p90": round(p90, 4),
            "regime": reg,
        }

    overall_regime = "Normal"
    if any(r == "Extreme High Volatility" for r in current_regimes):
        overall_regime = "Extreme High Volatility"
    elif any(r == "Elevated" for r in current_regimes):
        overall_regime = "Elevated"
    elif current_regimes and all(r == "Subdued" for r in current_regimes):
        overall_regime = "Subdued"

    return {
        "available": bool(cone),
        "cone": cone,
        "overall_regime": overall_regime,
    }


def compute_risk_parity_position_sizing(
    stock_annual_vol: float,
    benchmark_annual_vol: float = 0.14,
    target_portfolio_vol: float = 0.15,
) -> dict[str, Any]:
    """Calculate institutional risk-parity asset allocation weight and maximum position size limit.

    Formulation:
    - Inverse volatility weight: w_stock = (1 / sigma_stock) / (1 / sigma_stock + 1 / sigma_bench)
    - Volatility ratio: sigma_stock / sigma_bench
    - Risk-budgeted maximum position size = min(100.0, (target_vol / sigma_stock) * 100)
    """
    s_vol = float(stock_annual_vol) if stock_annual_vol and stock_annual_vol > 0 else 0.25
    b_vol = float(benchmark_annual_vol) if benchmark_annual_vol and benchmark_annual_vol > 0 else 0.14

    inv_s = 1.0 / s_vol
    inv_b = 1.0 / b_vol
    rp_weight = inv_s / (inv_s + inv_b)
    vol_ratio = s_vol / b_vol

    max_position = min(100.0, (target_portfolio_vol / s_vol) * 100.0)

    sizing_tier = (
        "High Risk / Constrained Allocation (<35%)" if rp_weight < 0.35
        else "Standard Allocation (35-50%)" if rp_weight <= 0.50
        else "Low Volatility / Enhanced Allocation (>50%)"
    )

    return {
        "stock_annual_vol": round(s_vol, 4),
        "benchmark_annual_vol": round(b_vol, 4),
        "volatility_ratio": round(vol_ratio, 2),
        "risk_parity_weight_pct": round(rp_weight * 100.0, 1),
        "benchmark_parity_weight_pct": round((1.0 - rp_weight) * 100.0, 1),
        "max_risk_budget_position_pct": round(max_position, 1),
        "sizing_tier": sizing_tier,
    }


def compute_cornish_fisher_cvar_surface(
    returns: pd.Series,
    horizons: tuple[int, ...] = (1, 5, 10, 21),
    confidences: tuple[float, ...] = (0.95, 0.99),
) -> dict[str, Any]:
    """Compute fat-tailed Cornish-Fisher Value at Risk (VaR) and Expected Shortfall (CVaR) multi-horizon surface.

    Integrates skewness (S) and excess kurtosis (K) to model non-Gaussian tail risk.
    """
    clean_r = returns.dropna()
    if len(clean_r) < 15:
        return {
            "surface": [],
            "tail_fatness_regime": "Unassessed (<15 obs)",
        }

    mu = float(clean_r.mean())
    sigma = float(clean_r.std(ddof=1))
    from scipy.stats import norm
    if sigma <= 1e-8 or not np.isfinite(sigma):
        S, K = 0.0, 0.0
    else:
        from scipy.stats import skew, kurtosis
        S = float(skew(clean_r))
        K = float(kurtosis(clean_r, fisher=True))

    surface_rows = []
    for h in horizons:
        mu_h = mu * h
        sigma_h = sigma * np.sqrt(h)
        for conf in confidences:
            z_alpha = norm.ppf(1.0 - conf)
            w_alpha = (
                z_alpha
                + (z_alpha**2 - 1) * S / 6.0
                + (z_alpha**3 - 3 * z_alpha) * K / 24.0
                - (2 * z_alpha**3 - 5 * z_alpha) * (S**2) / 36.0
            )
            cf_var = -(mu_h + w_alpha * sigma_h)
            cf_cvar = cf_var * (1.0 + 0.15 * max(0.0, K) / 3.0 + 0.10 * abs(S))

            surface_rows.append({
                "horizon_days": h,
                "confidence_pct": round(conf * 100.0, 1),
                "cf_var_pct": round(max(0.0, cf_var) * 100.0, 2),
                "cf_cvar_pct": round(max(0.0, cf_cvar) * 100.0, 2),
                "skewness": round(S, 3),
                "excess_kurtosis": round(K, 3),
            })

    tail_regime = (
        "Extreme Fat Tails / Severe Kurtosis (K > 3.0)" if K > 3.0
        else "Moderate Leptokurtic Fat Tails (1.0 - 3.0)" if K >= 1.0
        else "Near-Gaussian Tail Distribution"
    )

    return {
        "surface": surface_rows,
        "skewness": round(S, 3),
        "excess_kurtosis": round(K, 3),
        "tail_fatness_regime": tail_regime,
    }
