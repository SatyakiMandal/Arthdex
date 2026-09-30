"""Merton (1974) Structural Model of Credit Risk and Distance to Default (DD).

In the Merton framework:
- Equity is modeled as a European call option on firm assets V_A with strike D (debt):
    E = V_A * N(d1) - D * exp(-r * T) * N(d2)
- By Ito's Lemma, equity volatility sigma_E and asset volatility sigma_A satisfy:
    sigma_E * E = V_A * N(d1) * sigma_A

Solving this simultaneous system yields the unobserved asset value (V_A) and
asset volatility (sigma_A).

Distance to Default (DD) is defined as:
    DD = [ln(V_A / D) + (mu - 0.5 * sigma_A^2) * T] / [sigma_A * sqrt(T)]
    Default Probability (DP) = N(-DD)

Inputs:
- Market Capitalization (E) from stock price and shares outstanding
- Total Debt (D) from Balance Sheet
- Equity Volatility (sigma_E) from daily stock returns
- Risk-free Rate (r) from 10Y G-Sec yield
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Any

import numpy as np
import pandas as pd
from scipy import optimize, stats

log = logging.getLogger(__name__)

DEFAULT_HORIZON_YEARS = 1.0
DEFAULT_RISK_FREE_RATE = 0.0675  # 6.75% default if G-Sec reading is missing


@dataclass
class MertonResult:
    equity_value: float  # Market Cap (E)
    debt_value: float  # Book Debt (D)
    equity_volatility: float  # Annualized stock return volatility (sigma_E)
    risk_free_rate: float  # Annualized risk-free rate (r)
    asset_value: float  # Estimated market value of assets (V_A)
    asset_volatility: float  # Estimated asset volatility (sigma_A)
    distance_to_default: float  # Number of standard deviations to default
    default_probability: float  # Implied default probability N(-DD)
    time_horizon_years: float = 1.0
    converged: bool = True
    note: str = ""


def _merton_equations(vars_vec: np.ndarray, E: float, D: float, sigma_E: float, r: float, T: float) -> np.ndarray:
    """System of equations:
    F1 = V_A * N(d1) - D * exp(-r*T) * N(d2) - E
    F2 = V_A * N(d1) * sigma_A - sigma_E * E
    """
    V_A, sigma_A = vars_vec[0], vars_vec[1]

    if V_A <= 0 or sigma_A <= 0:
        return np.array([1e6, 1e6])

    sqrt_T = np.sqrt(T)
    d1 = (np.log(V_A / D) + (r + 0.5 * sigma_A**2) * T) / (sigma_A * sqrt_T)
    d2 = d1 - sigma_A * sqrt_T

    Nd1 = float(stats.norm.cdf(d1))
    Nd2 = float(stats.norm.cdf(d2))

    eq1 = V_A * Nd1 - D * np.exp(-r * T) * Nd2 - E
    eq2 = V_A * Nd1 * sigma_A - sigma_E * E

    return np.array([eq1, eq2])


def solve_merton_model(
    equity_value: float,
    debt_value: float,
    equity_volatility: float,
    risk_free_rate: float = DEFAULT_RISK_FREE_RATE,
    time_horizon: float = DEFAULT_HORIZON_YEARS,
    expected_return: float | None = None,
) -> MertonResult:
    """Solve for Asset Value (V_A), Asset Volatility (sigma_A), and Distance to Default (DD)."""
    if equity_value <= 0:
        raise ValueError("Equity value (market cap) must be positive.")
    if equity_volatility <= 0:
        raise ValueError("Equity volatility must be positive.")

    # Edge case: zero debt
    if debt_value <= 0:
        return MertonResult(
            equity_value=equity_value,
            debt_value=0.0,
            equity_volatility=equity_volatility,
            risk_free_rate=risk_free_rate,
            asset_value=equity_value,
            asset_volatility=equity_volatility,
            distance_to_default=float("inf"),
            default_probability=0.0,
            time_horizon_years=time_horizon,
            converged=True,
            note="Zero reported debt implies infinite Distance to Default.",
        )

    # Initial guess: V_A0 = E + D, sigma_A0 = sigma_E * E / (E + D)
    V_A0 = equity_value + debt_value
    sigma_A0 = equity_volatility * (equity_value / V_A0)

    try:
        sol = optimize.root(
            _merton_equations,
            x0=[V_A0, sigma_A0],
            args=(equity_value, debt_value, equity_volatility, risk_free_rate, time_horizon),
            method="hybr",
        )
        converged = bool(sol.success and sol.x[0] > 0 and sol.x[1] > 0)
        if converged:
            V_A, sigma_A = float(sol.x[0]), float(sol.x[1])
        else:
            # Fallback to simple approximation
            V_A = V_A0
            sigma_A = sigma_A0
            converged = False
    except Exception as exc:
        log.warning("Merton solver error: %s", exc)
        V_A = V_A0
        sigma_A = sigma_A0
        converged = False

    mu = expected_return if expected_return is not None else risk_free_rate
    sqrt_T = np.sqrt(time_horizon)

    # DD formula: [ln(V_A / D) + (mu - 0.5 * sigma_A^2) * T] / (sigma_A * sqrt(T))
    dd = (np.log(V_A / debt_value) + (mu - 0.5 * sigma_A**2) * time_horizon) / (sigma_A * sqrt_T)
    dp = float(stats.norm.cdf(-dd))

    note = ""
    if not converged:
        note = "Solver used linear approximation (E + D) due to non-convergence."

    return MertonResult(
        equity_value=round(equity_value, 2),
        debt_value=round(debt_value, 2),
        equity_volatility=round(equity_volatility, 4),
        risk_free_rate=round(risk_free_rate, 4),
        asset_value=round(V_A, 2),
        asset_volatility=round(sigma_A, 4),
        distance_to_default=round(float(dd), 2),
        default_probability=round(float(dp), 6),
        time_horizon_years=time_horizon,
        converged=converged,
        note=note,
    )


def rolling_distance_to_default(
    frame: pd.DataFrame,
    debt_value: float,
    shares_outstanding: float,
    risk_free_rate: float = DEFAULT_RISK_FREE_RATE,
    vol_window: int = 30,
) -> pd.DataFrame:
    """Compute daily rolling Merton Distance to Default across the price series.

    Returns a DataFrame indexed by date with columns:
    [close, market_cap, rolling_vol, asset_value, asset_volatility, dd, default_prob_pct]
    """
    if frame.empty or "close" not in frame.columns or "return" not in frame.columns:
        return pd.DataFrame()

    out_records = []
    # Rolling annualized return volatility
    rolling_vol_s = frame["return"].rolling(vol_window, min_periods=10).std(ddof=1) * np.sqrt(252)

    for ts, row in frame.iterrows():
        close_px = float(row["close"])
        vol_e = float(rolling_vol_s.loc[ts])
        if np.isnan(vol_e) or vol_e <= 0:
            # Fallback to full series vol
            vol_e = float(frame["return"].std(ddof=1)) * np.sqrt(252)

        mcap_t = close_px * shares_outstanding
        if mcap_t <= 0 or np.isnan(mcap_t):
            continue

        try:
            res = solve_merton_model(
                equity_value=float(mcap_t),
                debt_value=float(debt_value),
                equity_volatility=float(vol_e),
                risk_free_rate=float(risk_free_rate),
            )
            out_records.append({
                "date": ts.date() if hasattr(ts, "date") else ts,
                "close": round(close_px, 2),
                "market_cap": round(mcap_t, 2),
                "rolling_vol": round(vol_e, 4),
                "asset_value": res.asset_value,
                "asset_volatility": res.asset_volatility,
                "dd": res.distance_to_default,
                "default_prob_pct": round(res.default_probability * 100, 6),
            })
        except Exception:
            continue

    if not out_records:
        return pd.DataFrame()

    res_df = pd.DataFrame(out_records).set_index("date")
    return res_df


def get_term_matched_risk_free_rate(
    horizon_years: float = 1.0,
    macro: dict[str, Any] | None = None,
) -> float:
    """Interpolate India sovereign risk-free rate matched to debt horizon T."""
    if macro and "gsec_yield" in macro:
        gsec = macro["gsec_yield"]
        if isinstance(gsec, dict) and gsec.get("yield_pct") is not None:
            return gsec["yield_pct"] / 100.0
        elif isinstance(gsec, (int, float)):
            return gsec / 100.0

    base_10y = DEFAULT_RISK_FREE_RATE
    # Sovereign term structure spread adjustments relative to 10Y benchmark
    if horizon_years <= 1.0:
        return max(0.01, base_10y - 0.0035)  # 1Y T-bill spread (-35 bps)
    elif horizon_years <= 3.0:
        return max(0.01, base_10y - 0.0020)  # 3Y G-Sec spread (-20 bps)
    elif horizon_years <= 5.0:
        return max(0.01, base_10y - 0.0010)  # 5Y G-Sec spread (-10 bps)
    return base_10y


def dd_summary(
    ticker: str,
    frame: pd.DataFrame | None,
    financials: dict[str, Any] | None,
    macro: dict[str, Any] | None = None,
    horizon_years: float = 1.0,
) -> dict[str, Any]:
    """Generate structured Distance to Default summary for analysis reporting."""
    if frame is None or frame.empty or "return" not in frame.columns:
        return {"available": False, "note": "price return series unavailable."}

    # 1. Equity Volatility (annualized)
    ret_series = frame["return"].dropna().to_numpy()
    if len(ret_series) < 10:
        return {
            "available": False,
            "note": f"insufficient price history ({len(ret_series)} trading days) for volatility estimation.",
        }
    daily_vol = float(np.std(ret_series, ddof=1))
    sigma_E = daily_vol * np.sqrt(252)

    # 2. Risk-free rate from macro (G-Sec) matched to horizon
    r_f = get_term_matched_risk_free_rate(horizon_years, macro)

    # 3. Market Cap & Debt from financials
    if not financials or financials.get("note"):
        return {
            "available": False,
            "note": "financial statement balance-sheet data unavailable from screener.in.",
        }

    market_cap = financials.get("market_cap")
    shares_outstanding = financials.get("shares_outstanding")

    # If market_cap not directly provided, compute from latest close * shares_outstanding
    if market_cap is None and shares_outstanding is not None and "close" in frame.columns:
        latest_close = float(frame["close"].iloc[-1])
        market_cap = latest_close * shares_outstanding

    # Extract Total Debt from balance sheet
    bs = financials.get("balance_sheet") or {}
    debt = bs.get("total_debt") or financials.get("total_debt")

    # If debt is not in balance_sheet, check borrowings
    if debt is None and "borrowings" in bs:
        debt = bs["borrowings"]

    if market_cap is None or market_cap <= 0:
        return {
            "available": False,
            "note": "market capitalization could not be determined.",
        }

    if debt is None:
        return {
            "available": False,
            "note": "total debt could not be determined from balance sheet.",
        }

    try:
        res = solve_merton_model(
            equity_value=float(market_cap),
            debt_value=float(debt),
            equity_volatility=float(sigma_E),
            risk_free_rate=float(r_f),
        )
    except Exception as exc:
        return {"available": False, "note": f"computation error: {exc}"}

    currency = financials.get("currency_unit", "Rs. Crores")

    # Compute rolling time-series trajectory if shares_outstanding is available
    rolling_trajectory = []
    if shares_outstanding and shares_outstanding > 0:
        try:
            r_df = rolling_distance_to_default(frame, float(debt), float(shares_outstanding), r_f)
            if not r_df.empty:
                rolling_trajectory = [
                    {"date": d.isoformat() if hasattr(d, "isoformat") else str(d),
                     "dd": row["dd"], "default_prob_pct": row["default_prob_pct"],
                     "asset_vol": row["asset_volatility"]}
                    for d, row in r_df.iterrows()
                ]
        except Exception as exc:
            log.warning("rolling DD trajectory calculation error: %s", exc)

    return {
        "available": True,
        "ticker": ticker,
        "market_cap": res.equity_value,
        "total_debt": res.debt_value,
        "currency_unit": currency,
        "equity_volatility": res.equity_volatility,
        "risk_free_rate": res.risk_free_rate,
        "asset_value": res.asset_value,
        "asset_volatility": res.asset_volatility,
        "distance_to_default": res.distance_to_default,
        "default_probability": res.default_probability,
        "default_probability_pct": round(res.default_probability * 100, 4),
        "horizon_years": res.time_horizon_years,
        "converged": res.converged,
        "rolling_trajectory": rolling_trajectory,
        "note": res.note or f"Merton (1974) structural credit risk model with T={res.time_horizon_years}yr horizon.",
    }
