"""Daily returns and benchmark-adjusted (abnormal) returns — PRD Section 9.

The point of abnormal returns is stated plainly in the PRD: if the whole market
fell 4% and the company fell 4.5%, the company-specific move is −0.5%, not
−4.5%. Reading the raw return as news-driven is the single easiest way to get a
wrong answer here.

Two models are supported:

* **market-adjusted** — ``AR = R_i − R_m``. Assumes beta of 1. Needs no
  estimation window, so it works on short date ranges.
* **market-model** — ``AR = R_i − (α + β·R_m)``, with α and β fitted by OLS over
  an estimation window *before* the analysis period. More rigorous, and the
  version the PRD calls "the more rigorous market-model version". It needs
  enough clean lead-in data, so the engine falls back to market-adjusted and
  says so rather than fitting a beta on ten observations.

The estimation window deliberately ends before the analysis window starts, so
the "normal" baseline is not contaminated by the very event being measured.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd
from scipy import stats

from .prices import PriceError, PriceProvider, load_prices

log = logging.getLogger(__name__)

# Trading days of history to fit alpha/beta on. 120 is a common choice; the
# floor is what we will accept before giving up on the market model.
DEFAULT_ESTIMATION_DAYS = 120
MIN_ESTIMATION_DAYS = 40
# Gap between the estimation window and the analysis window, so news leaking
# into the run-up does not shape the baseline.
ESTIMATION_GAP_DAYS = 5
# Calendar days of price history fetched *after* the analysis window, so that
# after-close attribution and CAR windows have sessions to land on.
TAIL_BUFFER_DAYS = 21


@dataclass
class MarketModel:
    alpha: float
    beta: float
    residual_sd: float
    observations: int
    r_squared: float
    fitted: bool
    note: str = ""

    @property
    def kind(self) -> str:
        return "market-model" if self.fitted else "market-adjusted"


@dataclass
class MultiFactorModel:
    alpha: float
    betas: dict[str, float]  # {"MKT": 1.2, "SMB": 0.3, "HML": -0.1, "MOM": 0.05}
    t_stats: dict[str, float]
    residual_sd: float
    observations: int
    r_squared: float
    adj_r_squared: float
    fitted: bool
    model_type: str = "fama-french-3"  # "fama-french-3" | "carhart-4"
    note: str = ""

    @property
    def kind(self) -> str:
        return self.model_type if self.fitted else "market-adjusted"

    @property
    def beta(self) -> float:
        return self.betas.get("MKT", 1.0)


def daily_returns(close: pd.Series) -> pd.Series:
    """Simple daily returns. Simple, not log, because they aggregate across
    assets additively — which is what subtracting a benchmark requires."""
    return close.pct_change()


def detect_corporate_actions_discontinuity(close: pd.Series, volume: pd.Series | None = None) -> list[dict]:
    """Detect unadjusted corporate action price discontinuities (e.g. 1:1 bonus, 1:2 split, 1:10 split).

    Identifies sudden price drops matching standard corporate action ratios (1/2, 1/3, 1/5, 1/10)
    to prevent split-induced false flags.
    """
    if len(close) < 2:
        return []

    discontinuities = []
    ratio = close / close.shift(1)
    split_ratios = [(0.5, "1:1 bonus or 1:2 stock split"),
                    (0.333, "2:1 bonus or 1:3 stock split"),
                    (0.2, "4:1 bonus or 1:5 stock split"),
                    (0.1, "1:10 stock split")]

    for i in range(1, len(ratio)):
        r_val = ratio.iloc[i]
        if np.isnan(r_val):
            continue
        for target, desc in split_ratios:
            if abs(r_val - target) < 0.035:
                ts = ratio.index[i]
                discontinuities.append({
                    "date": ts.date() if hasattr(ts, "date") else ts,
                    "ratio": round(float(r_val), 3),
                    "action": desc,
                    "note": f"Probable {desc} detected on {ts.date() if hasattr(ts, 'date') else ts} (price ratio {r_val:.2f})",
                })
    return discontinuities


def compute_amihud_illiquidity(frame: pd.DataFrame) -> pd.Series:
    """Compute daily Amihud (2002) Illiquidity Ratio.

    ILLIQ_t = |Return_t| / (Close_t * Volume_t) * 10^7
    Higher values indicate thinner liquidity where small order flow causes larger price moves.
    """
    if "return" not in frame.columns or "volume" not in frame.columns or "close" not in frame.columns:
        return pd.Series(index=frame.index, dtype=float)

    turnover = frame["close"] * frame["volume"]
    illiq = (frame["return"].abs() / turnover.replace(0, np.nan)) * 1e7
    return illiq.fillna(0.0)


def fit_garch11_residuals(
    residuals: pd.Series,
    alpha: float = 0.10,
    beta: float = 0.85,
) -> tuple[pd.Series, pd.Series]:
    """Fit a GARCH(1,1) conditional variance filter over residuals.

    sigma_t^2 = omega + alpha * epsilon_{t-1}^2 + beta * sigma_{t-1}^2
    where omega = unconditional_var * (1 - alpha - beta).

    Returns:
        (conditional_vol_series, garch_z_scores)
    """
    if residuals.empty or len(residuals.dropna()) < 5:
        return residuals.copy(), residuals.copy()

    clean_res = residuals.fillna(0.0).to_numpy()
    n = len(clean_res)
    uncond_var = float(np.var(clean_res, ddof=1)) if np.var(clean_res) > 0 else 1e-4
    omega = max(uncond_var * (1.0 - alpha - beta), 1e-6)

    cond_var = np.zeros(n)
    cond_var[0] = uncond_var

    for t in range(1, n):
        cond_var[t] = omega + alpha * (clean_res[t - 1] ** 2) + beta * cond_var[t - 1]

    cond_vol = np.sqrt(np.maximum(cond_var, 1e-8))
    garch_z = clean_res / cond_vol

    cond_vol_series = pd.Series(cond_vol, index=residuals.index, name="garch_vol")
    garch_z_series = pd.Series(garch_z, index=residuals.index, name="garch_z")
    return cond_vol_series, garch_z_series


def align_series(company: pd.DataFrame, benchmark: pd.DataFrame) -> pd.DataFrame:
    """Inner-join on trading dates both series actually have."""
    columns = {
        "close": company["close"],
        "benchmark_close": benchmark["close"],
    }
    if "volume" in company.columns:
        columns["volume"] = company["volume"]
    if "high" in company.columns and "low" in company.columns:
        columns["high"] = company["high"]
        columns["low"] = company["low"]

    frame = pd.DataFrame(columns).dropna(subset=["close", "benchmark_close"])
    frame["return"] = daily_returns(frame["close"])
    frame["benchmark_return"] = daily_returns(frame["benchmark_close"])

    # Compute Amihud Illiquidity if volume is present
    if "volume" in frame.columns:
        frame["amihud_illiq"] = compute_amihud_illiquidity(frame)

    # Detect unadjusted corporate actions
    vol_col = frame["volume"] if "volume" in frame.columns else None
    splits = detect_corporate_actions_discontinuity(frame["close"], vol_col)
    if splits:
        frame.attrs["corporate_actions"] = splits
        for s in splits:
            log.warning("Corporate action notice: %s", s["note"])
    return frame


def fit_market_model(
    frame: pd.DataFrame,
    analysis_start: date,
    estimation_days: int = DEFAULT_ESTIMATION_DAYS,
    gap_days: int = ESTIMATION_GAP_DAYS,
) -> MarketModel:
    """Fit ``R_i = α + β·R_m + ε`` on data before the analysis window."""
    cutoff = pd.Timestamp(analysis_start)
    window = frame.loc[frame.index < cutoff].dropna(
        subset=["return", "benchmark_return"])
    if gap_days and len(window) > gap_days:
        window = window.iloc[:-gap_days]
    window = window.tail(estimation_days)

    if len(window) < MIN_ESTIMATION_DAYS:
        note = (f"only {len(window)} estimation observations before "
                f"{analysis_start} (need {MIN_ESTIMATION_DAYS}); "
                "using market-adjusted returns with beta fixed at 1.0")
        # This is silent otherwise - the reason only ever showed up buried in
        # the final report's provenance section. A run that falls back here
        # is a real accuracy hit (a high-beta stock gets a systematically
        # inflated abnormal return), worth seeing the moment it happens
        # rather than discovering it after the fact.
        log.warning("market model: %s", note)
        return MarketModel(
            alpha=0.0, beta=1.0, residual_sd=float("nan"),
            observations=len(window), r_squared=float("nan"), fitted=False,
            note=note,
        )

    x = window["benchmark_return"].to_numpy()
    y = window["return"].to_numpy()
    if np.std(x) == 0:
        note = ("benchmark has zero variance in the estimation window; "
                "using market-adjusted returns")
        log.warning("market model: %s", note)
        return MarketModel(0.0, 1.0, float("nan"), len(window), float("nan"),
                           False, note)

    beta, alpha = np.polyfit(x, y, 1)
    residuals = y - (alpha + beta * x)
    # ddof=2 because two parameters were estimated.
    residual_sd = float(np.std(residuals, ddof=2)) if len(residuals) > 2 else float("nan")
    ss_res = float(np.sum(residuals**2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r_squared = 1 - ss_res / ss_tot if ss_tot else float("nan")

    log.info("market model: fitted on %d trading days before %s "
             "(alpha=%.5f beta=%.3f R2=%.3f)",
             len(window), analysis_start, alpha, beta, r_squared)
    return MarketModel(
        alpha=float(alpha), beta=float(beta), residual_sd=residual_sd,
        observations=len(window), r_squared=float(r_squared), fitted=True,
        note=f"fitted on {len(window)} trading days before {analysis_start}",
    )


def compute_rolling_beta(frame: pd.DataFrame, window_days: int = 60) -> pd.Series:
    """Compute rolling market beta: Cov(R_i, R_m) / Var(R_m) over rolling windows."""
    if "return" not in frame.columns or "benchmark_return" not in frame.columns:
        return pd.Series(index=frame.index, dtype=float)
    cov = frame["return"].rolling(window_days).cov(frame["benchmark_return"])
    var_m = frame["benchmark_return"].rolling(window_days).var()
    rolling = cov / var_m
    return rolling.replace([np.inf, -np.inf], np.nan)


def detect_beta_structural_break(
    frame: pd.DataFrame,
    split_date: date | None = None,
) -> dict[str, Any]:
    """Chow test for structural break / regime shift in market model relationship.

    Tests H0: beta_1 = beta_2, alpha_1 = alpha_2 across two sub-periods.
    """
    clean = frame[["return", "benchmark_return"]].dropna()
    N = len(clean)
    k = 2  # alpha and beta
    if N < 2 * MIN_ESTIMATION_DAYS:
        return {"has_break": False, "f_stat": None, "p_value": None, "note": "insufficient observations"}

    if split_date is not None:
        split_idx = int(clean.index.searchsorted(pd.Timestamp(split_date)))
    else:
        split_idx = N // 2

    if split_idx < MIN_ESTIMATION_DAYS or (N - split_idx) < MIN_ESTIMATION_DAYS:
        return {"has_break": False, "f_stat": None, "p_value": None, "note": "split too close to boundary"}

    # Subperiod 1
    sub1 = clean.iloc[:split_idx]
    x1, y1 = sub1["benchmark_return"].to_numpy(), sub1["return"].to_numpy()
    b1, a1 = np.polyfit(x1, y1, 1)
    res1 = y1 - (a1 + b1 * x1)
    ss1 = float(np.sum(res1**2))

    # Subperiod 2
    sub2 = clean.iloc[split_idx:]
    x2, y2 = sub2["benchmark_return"].to_numpy(), sub2["return"].to_numpy()
    b2, a2 = np.polyfit(x2, y2, 1)
    res2 = y2 - (a2 + b2 * x2)
    ss2 = float(np.sum(res2**2))

    # Pooled
    x, y = clean["benchmark_return"].to_numpy(), clean["return"].to_numpy()
    b_p, a_p = np.polyfit(x, y, 1)
    res_p = y - (a_p + b_p * x)
    ss_p = float(np.sum(res_p**2))

    # Chow F-statistic: ((SS_p - (SS_1 + SS_2)) / k) / ((SS_1 + SS_2) / (N_1 + N_2 - 2k))
    df1 = k
    df2 = N - 2 * k
    num = (ss_p - (ss1 + ss2)) / df1
    den = (ss1 + ss2) / df2 if df2 > 0 else 1.0

    f_stat = float(num / den) if den > 0 else 0.0
    p_val = float(stats.f.sf(f_stat, df1, df2)) if np.isfinite(f_stat) else 1.0

    return {
        "has_break": bool(p_val < 0.05),
        "f_stat": round(f_stat, 3),
        "p_value": round(p_val, 4),
        "subperiod_1_beta": round(float(b1), 3),
        "subperiod_2_beta": round(float(b2), 3),
        "beta_shift": round(float(b2 - b1), 3),
        "split_date": clean.index[split_idx].date().isoformat(),
    }


def fit_multifactor_model(
    frame: pd.DataFrame,
    factor_returns: pd.DataFrame,
    analysis_start: date,
    model_type: str = "fama-french-3",
    estimation_days: int = DEFAULT_ESTIMATION_DAYS,
    gap_days: int = ESTIMATION_GAP_DAYS,
) -> MultiFactorModel:
    """Fit multi-factor asset pricing model: R_i = alpha + sum(beta_k * Factor_k) + epsilon.

    Factors typically include:
    - MKT: Benchmark market excess return (Nifty 50)
    - SMB: Size factor (Midcap vs Largecap)
    - HML: Value factor (Value vs Growth)
    - MOM: Momentum factor (Nifty Momentum)
    """
    cutoff = pd.Timestamp(analysis_start)
    joined = frame[["return"]].join(factor_returns, how="inner")
    window = joined.loc[joined.index < cutoff].dropna()

    if gap_days and len(window) > gap_days:
        window = window.iloc[:-gap_days]
    window = window.tail(estimation_days)

    factor_cols = [c for c in factor_returns.columns if c in window.columns]
    k_factors = len(factor_cols)

    if len(window) < MIN_ESTIMATION_DAYS or k_factors == 0:
        note = (f"only {len(window)} estimation observations or {k_factors} factors before "
                f"{analysis_start} (need {MIN_ESTIMATION_DAYS}); using market-adjusted returns")
        log.warning("multifactor model: %s", note)
        betas = {c: 1.0 if c == "MKT" or c == "benchmark_return" else 0.0 for c in factor_cols}
        return MultiFactorModel(
            alpha=0.0, betas=betas, t_stats={c: float("nan") for c in factor_cols},
            residual_sd=float("nan"), observations=len(window), r_squared=float("nan"),
            adj_r_squared=float("nan"), fitted=False, model_type=model_type, note=note,
        )

    Y = window["return"].to_numpy()
    X_factors = window[factor_cols].to_numpy()
    # Add constant column for alpha
    X = np.column_stack([np.ones(len(window)), X_factors])

    try:
        # OLS estimation: (X^T X)^-1 X^T Y
        beta_hat, residuals, rank, s = np.linalg.lstsq(X, Y, rcond=None)
        alpha = float(beta_hat[0])
        betas = {factor_cols[i]: float(beta_hat[i + 1]) for i in range(k_factors)}

        resids = Y - (X @ beta_hat)
        df_e = max(len(Y) - (k_factors + 1), 1)
        residual_sd = float(np.std(resids, ddof=k_factors + 1)) if len(resids) > k_factors + 1 else float("nan")

        ss_res = float(np.sum(resids**2))
        ss_tot = float(np.sum((Y - Y.mean()) ** 2))
        r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else float("nan")
        adj_r_squared = 1 - (1 - r_squared) * (len(Y) - 1) / df_e if np.isfinite(r_squared) else float("nan")

        # Standard errors and t-statistics
        var_e = ss_res / df_e
        XtX_inv = np.linalg.pinv(X.T @ X)
        se_betas = np.sqrt(np.diagonal(XtX_inv) * var_e)
        t_stats = {
            "alpha": float(alpha / se_betas[0]) if se_betas[0] > 0 else float("nan"),
        }
        for i, c in enumerate(factor_cols):
            se = se_betas[i + 1]
            t_stats[c] = float(betas[c] / se) if se > 0 else float("nan")

        log.info("multifactor model (%s): fitted on %d trading days before %s (alpha=%.5f R2=%.3f)",
                 model_type, len(window), analysis_start, alpha, r_squared)
        return MultiFactorModel(
            alpha=alpha, betas=betas, t_stats=t_stats, residual_sd=residual_sd,
            observations=len(window), r_squared=r_squared, adj_r_squared=adj_r_squared,
            fitted=True, model_type=model_type,
            note=f"{model_type} fitted on {len(window)} trading days before {analysis_start}",
        )
    except Exception as exc:
        log.warning("multifactor regression failed: %s; falling back", exc)
        return MultiFactorModel(
            alpha=0.0, betas={c: 1.0 for c in factor_cols}, t_stats={},
            residual_sd=float("nan"), observations=len(window), r_squared=float("nan"),
            adj_r_squared=float("nan"), fitted=False, model_type=model_type, note=str(exc),
        )


def build_macro_transmission_factors(
    benchmark_df: pd.DataFrame,
    crude_df: pd.DataFrame | None = None,
    usdinr_df: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Construct multi-asset macro transmission factor returns.

    Columns:
    - MKT: Equity market benchmark return
    - CRUDE: Brent crude oil return
    - USDINR: USD/INR currency exchange return
    """
    factors = pd.DataFrame(index=benchmark_df.index)
    if "return" in benchmark_df.columns:
        factors["MKT"] = benchmark_df["return"]
    elif "close" in benchmark_df.columns:
        factors["MKT"] = daily_returns(benchmark_df["close"])

    if crude_df is not None and not crude_df.empty:
        c_ret = crude_df["return"] if "return" in crude_df.columns else daily_returns(crude_df["close"])
        factors = factors.join(c_ret.rename("CRUDE"), how="left")

    if usdinr_df is not None and not usdinr_df.empty:
        fx_ret = usdinr_df["return"] if "return" in usdinr_df.columns else daily_returns(usdinr_df["close"])
        factors = factors.join(fx_ret.rename("USDINR"), how="left")

    return factors.fillna(0.0)


def compute_factor_attribution(
    model: MultiFactorModel,
    factor_returns: pd.DataFrame,
    stock_returns: pd.Series | None = None,
) -> pd.DataFrame:
    """Compute daily return contribution from each risk factor.

    Attribution columns:
    - {factor}_attrib: beta_k * Factor_k,t
    - total_factor_explained: alpha + sum_k (beta_k * Factor_k,t)
    - idiosyncratic_return: R_i,t - total_factor_explained (if stock_returns provided)
    """
    df = pd.DataFrame(index=factor_returns.index)
    total_explained = pd.Series(model.alpha, index=factor_returns.index)

    for factor_name, beta_val in model.betas.items():
        if factor_name in factor_returns.columns:
            contrib = beta_val * factor_returns[factor_name]
            df[f"{factor_name}_attrib"] = contrib
            total_explained += contrib

    df["total_factor_explained"] = total_explained
    if stock_returns is not None:
        joined_stock = stock_returns.reindex(factor_returns.index)
        df["idiosyncratic_return"] = joined_stock - total_explained
    return df


def compute_cross_asset_lead_lag(
    stock_returns: pd.Series,
    macro_factors: pd.DataFrame,
    max_lag: int = 5,
) -> dict[str, Any]:
    """Compute cross-correlation function r(tau) = Corr(R_{stock, t}, F_{macro, t - tau})
    for horizons tau in [-max_lag, +max_lag] to determine lead-lag transmission dynamics.

    A positive tau > 0 indicates macro factor leads the stock by tau days.
    A negative tau < 0 indicates stock leads the macro factor by |tau| days.
    """
    clean_stock = stock_returns.dropna()
    results: dict[str, Any] = {}

    for factor_col in macro_factors.columns:
        clean_factor = macro_factors[factor_col].dropna()
        common_idx = clean_stock.index.intersection(clean_factor.index)
        if len(common_idx) < 2 * max_lag + 10:
            continue

        s_arr = clean_stock.reindex(common_idx).to_numpy()
        f_arr = clean_factor.reindex(common_idx).to_numpy()

        corrs: dict[int, float] = {}
        for tau in range(-max_lag, max_lag + 1):
            if tau > 0:
                # Factor leads stock by tau days: s[t] vs f[t - tau] -> s_arr[tau:] vs f_arr[:-tau]
                if len(s_arr[tau:]) > 5:
                    cc = np.corrcoef(s_arr[tau:], f_arr[:-tau])[0, 1]
                    r = float(cc) if np.isfinite(cc) else 0.0
                else:
                    r = 0.0
            elif tau < 0:
                # Stock leads factor by |tau| days: s[t - |tau|] vs f[t] -> s_arr[:-abs_tau] vs f_arr[abs_tau:]
                abs_tau = abs(tau)
                if len(s_arr[:-abs_tau]) > 5:
                    cc = np.corrcoef(s_arr[:-abs_tau], f_arr[abs_tau:])[0, 1]
                    r = float(cc) if np.isfinite(cc) else 0.0
                else:
                    r = 0.0
            else:
                cc = np.corrcoef(s_arr, f_arr)[0, 1]
                r = float(cc) if np.isfinite(cc) else 0.0
            corrs[tau] = round(float(r), 3)

        best_tau = max(corrs.keys(), key=lambda t: abs(corrs[t]))
        results[factor_col] = {
            "correlations": corrs,
            "optimal_horizon_days": best_tau,
            "optimal_correlation": corrs[best_tau],
            "transmission_nature": (
                f"{factor_col} leads stock by {best_tau}d" if best_tau > 0
                else f"Stock leads {factor_col} by {-best_tau}d" if best_tau < 0
                else f"Contemporaneous ({factor_col})"
            ),
        }

    return results


def compute_multiscale_variance_decomposition(
    returns: pd.Series,
) -> dict[str, Any]:
    """Multi-scale frequency variance decomposition for transient vs persistent return shocks.

    Decomposes total variance into:
    - High-Frequency (Scale D1, 1-2 days): Microstructure noise / transient order-flow shocks
    - Intermediate-Frequency (Scale D2, 3-5 days): Cyclical momentum / event drift
    - Low-Frequency (Scale D3, 6-20 days): Structural fundamental trend & persistent re-rating
    """
    clean = returns.dropna()
    N = len(clean)
    if N < 20:
        return {
            "total_variance": float(np.var(clean, ddof=1)) if N > 1 else 0.0,
            "d1_high_freq_pct": 50.0,
            "d2_medium_freq_pct": 30.0,
            "d3_low_freq_pct": 20.0,
            "shock_persistence_regime": "Unassessed (<20 obs)",
        }

    tot_var = float(np.var(clean, ddof=1)) or 1e-6

    smooth_2d = clean.rolling(2, min_periods=1).mean()
    d1 = clean - smooth_2d
    var_d1 = float(np.var(d1, ddof=1))

    smooth_5d = clean.rolling(5, min_periods=1).mean()
    d2 = smooth_2d - smooth_5d
    var_d2 = float(np.var(d2, ddof=1))

    smooth_20d = clean.rolling(20, min_periods=1).mean()
    d3 = smooth_5d - smooth_20d
    var_d3 = float(np.var(d3, ddof=1))

    sum_var = var_d1 + var_d2 + var_d3
    if sum_var > 0:
        p1 = round(var_d1 / sum_var * 100, 1)
        p2 = round(var_d2 / sum_var * 100, 1)
        p3 = round(var_d3 / sum_var * 100, 1)
    else:
        p1, p2, p3 = 50.0, 30.0, 20.0

    if p3 >= 35.0:
        regime = "Dominantly Fundamental (High Persistence)"
    elif p1 >= 55.0:
        regime = "High-Frequency Noise (Transient Shocks)"
    else:
        regime = "Mixed Momentum (Multi-Scale Diffusion)"

    return {
        "total_variance": round(tot_var, 6),
        "d1_high_freq_pct": p1,
        "d2_medium_freq_pct": p2,
        "d3_low_freq_pct": p3,
        "shock_persistence_regime": regime,
    }


def compute_event_drawdown_and_recovery(
    prices: pd.Series,
    event_idx: int,
    max_lookahead_days: int = 60,
) -> dict[str, Any]:
    """Compute post-event peak-to-trough drawdown and subsequent recovery duration.

    Metrics:
    - pre_event_price: Price P_0 at t = event_idx - 1 (or event_idx)
    - post_event_trough: Minimum price achieved in [event_idx, event_idx + max_lookahead_days]
    - max_drawdown_pct: (P_trough - P_0) / P_0 * 100
    - is_recovered: True if price re-attained P_0 within lookahead window
    - recovery_days: Number of trading days taken to regain P_0 (or None)
    - remaining_deficit_pct: Deficit at end of lookahead window if unrecovered
    """
    clean_p = prices.dropna()
    N = len(clean_p)
    if N == 0 or event_idx < 0 or event_idx >= N:
        return {
            "max_drawdown_pct": 0.0,
            "is_recovered": True,
            "recovery_days": 0,
            "status": "No data",
        }

    base_idx = max(0, event_idx - 1)
    p0 = float(clean_p.iloc[base_idx])
    if p0 <= 0:
        return {"max_drawdown_pct": 0.0, "is_recovered": True, "recovery_days": 0, "status": "Invalid price"}

    end_idx = min(N, event_idx + max_lookahead_days + 1)
    post_window = clean_p.iloc[event_idx:end_idx]
    if post_window.empty:
        return {"max_drawdown_pct": 0.0, "is_recovered": True, "recovery_days": 0, "status": "End of series"}

    trough_price = float(post_window.min())
    trough_offset = int(np.argmin(post_window.to_numpy()))
    max_dd = (trough_price - p0) / p0 * 100.0

    is_recov = False
    recov_days = None
    for i, p in enumerate(post_window.to_numpy()):
        if p >= p0:
            is_recov = True
            recov_days = i
            break

    last_p = float(post_window.iloc[-1])
    remaining_deficit = (last_p - p0) / p0 * 100.0 if not is_recov else 0.0

    return {
        "pre_event_price": round(p0, 2),
        "post_event_trough": round(trough_price, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "trough_day_offset": trough_offset,
        "is_recovered": is_recov,
        "recovery_days": recov_days,
        "remaining_deficit_pct": round(remaining_deficit, 2),
        "status": f"Recovered in {recov_days}d" if is_recov else f"Unrecovered ({remaining_deficit:.1f}% deficit)",
    }


def simulate_macro_stress_scenarios(
    model: MultiFactorModel | MarketModel,
) -> dict[str, dict[str, Any]]:
    """Simulate expected stock return shocks under historical and synthetic extreme macroeconomic stress scenarios.

    Scenarios:
    1. 2020 Covid Liquidity Crash: Market -25%, Crude -40%, USD/INR +6%
    2. 2022 Geopolitical Energy Spike: Market -8%, Crude +50%, USD/INR +4%
    3. 2013 Taper Tantrum Currency Shock: Market -12%, Crude +10%, USD/INR +15%
    4. 2008 Global Financial Crisis: Market -35%, Crude -55%, USD/INR +12%
    5. Stagflation Scenario: Market -10%, Crude +25%, USD/INR +5%
    """
    scenarios = {
        "2020 Covid Liquidity Crash": {"MKT": -0.25, "CRUDE": -0.40, "USDINR": 0.06},
        "2022 Energy Shock": {"MKT": -0.08, "CRUDE": 0.50, "USDINR": 0.04},
        "2013 Taper Tantrum": {"MKT": -0.12, "CRUDE": 0.10, "USDINR": 0.15},
        "2008 Global Financial Crisis": {"MKT": -0.35, "CRUDE": -0.55, "USDINR": 0.12},
        "Stagflation Scenario": {"MKT": -0.10, "CRUDE": 0.25, "USDINR": 0.05},
    }

    betas: dict[str, float] = {}
    if isinstance(model, MultiFactorModel) and model.fitted:
        for k, v in model.betas.items():
            betas[k.upper()] = float(v)
    elif isinstance(model, MarketModel) and model.fitted:
        betas["MKT"] = float(model.beta)
    else:
        betas["MKT"] = 1.0

    results: dict[str, dict[str, Any]] = {}

    for name, shock_vec in scenarios.items():
        total_impact = 0.0
        breakdown: dict[str, float] = {}

        for factor, shock_val in shock_vec.items():
            matched_beta = None
            for b_name, b_val in betas.items():
                if factor in b_name or (factor == "MKT" and ("MARKET" in b_name or "BENCHMARK" in b_name)):
                    matched_beta = b_val
                    break

            if matched_beta is not None:
                contrib = matched_beta * shock_val
                total_impact += contrib
                breakdown[factor] = round(contrib * 100, 2)
            elif factor == "MKT" and "MKT" in betas:
                contrib = betas["MKT"] * shock_val
                total_impact += contrib
                breakdown[factor] = round(contrib * 100, 2)

        results[name] = {
            "expected_shock_pct": round(total_impact * 100, 2),
            "factor_contributions_pct": breakdown,
            "severity_tier": (
                "Severe Drawdown (>20%)" if total_impact <= -0.20
                else "Moderate Drawdown (10-20%)" if total_impact <= -0.10
                else "Mild Impact (<10%)" if total_impact < 0
                else "Positive / Resilient"
            ),
        }

    return results


def detect_volatility_regimes(
    returns: pd.Series,
) -> dict[str, Any]:
    """Detect 2-state discrete volatility regimes (Low Volatility Compounding vs High Volatility Shock).

    Uses robust empirical mixture partitioning on rolling standard deviations to estimate:
    - State 0 (Low Volatility): Calm, stationary drift state
    - State 1 (High Volatility): Turbulence / event shock state
    """
    clean_ret = returns.dropna()
    N = len(clean_ret)
    if N < 20:
        return {
            "current_regime": "Unassessed (<20 obs)",
            "state_0_daily_vol": 0.01,
            "state_1_daily_vol": 0.03,
            "p_high_vol_state": 0.0,
            "turbulence_index": 1.0,
        }

    roll_vol = clean_ret.rolling(10, min_periods=5).std(ddof=1).dropna()
    if roll_vol.empty:
        roll_vol = pd.Series([float(np.std(clean_ret, ddof=1))], index=clean_ret.index[-1:])

    median_vol = float(np.median(roll_vol))
    low_vols = roll_vol[roll_vol <= median_vol]
    high_vols = roll_vol[roll_vol > median_vol]

    sigma_0 = float(low_vols.mean()) if not low_vols.empty else median_vol * 0.7
    sigma_1 = float(high_vols.mean()) if not high_vols.empty else median_vol * 1.5
    sigma_0 = max(sigma_0, 0.002)
    sigma_1 = max(sigma_1, sigma_0 * 1.2)

    current_vol = float(roll_vol.iloc[-1])
    odds_1 = np.exp(-0.5 * ((current_vol - sigma_1) / (0.5 * sigma_1))**2)
    odds_0 = np.exp(-0.5 * ((current_vol - sigma_0) / (0.5 * sigma_0))**2)
    p_high = float(odds_1 / (odds_1 + odds_0 + 1e-8))

    current_regime = "High Volatility Shock" if p_high >= 0.50 or current_vol >= 1.4 * sigma_0 else "Low Volatility Stable"
    turbulence_ratio = current_vol / sigma_0

    return {
        "current_regime": current_regime,
        "current_10d_vol": round(current_vol, 4),
        "state_0_daily_vol": round(sigma_0, 4),
        "state_1_daily_vol": round(sigma_1, 4),
        "p_high_vol_state": round(p_high, 3),
        "turbulence_index": round(turbulence_ratio, 2),
    }


def compute_peer_cross_elasticity_spillover(
    stock_returns: pd.Series,
    peer_returns: pd.DataFrame,
    shock_dates: list[date] | None = None,
) -> dict[str, Any]:
    """Compute empirical cross-elasticity and peer contagion spillover matrix: gamma_{ij} = Cov(R_i, R_peer) / Var(R_i).

    Quantifies the degree to which an abnormal shock to the target stock induces sympathy moves in peer stocks.
    """
    clean_stock = stock_returns.dropna()
    results: dict[str, Any] = {}

    for peer_col in peer_returns.columns:
        clean_peer = peer_returns[peer_col].dropna()
        common_idx = clean_stock.index.intersection(clean_peer.index)
        if len(common_idx) < 10:
            continue

        s = clean_stock.reindex(common_idx)
        p = clean_peer.reindex(common_idx)

        # Baseline spillover elasticity
        cov_full = float(np.cov(s, p)[0, 1])
        gamma_full = cov_full / (float(np.var(s, ddof=1)) or 1e-6)
        corr_full = float(s.corr(p))

        # Event-conditional spillover elasticity (if shock dates provided)
        gamma_shock = None
        if shock_dates:
            shock_idx = [d for d in common_idx if (isinstance(d, date) and d in shock_dates) or (hasattr(d, "date") and d.date() in shock_dates)]
            if len(shock_idx) >= 2:
                s_shock = s.reindex(shock_idx)
                p_shock = p.reindex(shock_idx)
                cov_s = float(np.cov(s_shock, p_shock)[0, 1])
                var_s = float(np.var(s_shock, ddof=1)) or 1e-6
                gamma_shock = round(cov_s / var_s, 3)

        spillover_nature = (
            "High Sympathy Mover (>0.6x elasticity)" if gamma_full >= 0.60
            else "Moderate Sector Spillover (0.3-0.6x)" if gamma_full >= 0.30
            else "Low / Idiosyncratic Insulation (<0.3x)"
        )

        results[peer_col] = {
            "full_sample_elasticity": round(gamma_full, 3),
            "correlation": round(corr_full, 3),
            "shock_conditional_elasticity": gamma_shock,
            "spillover_nature": spillover_nature,
        }

    return results


def compute_asymmetric_downside_beta(
    stock_returns: pd.Series,
    benchmark_returns: pd.Series,
) -> dict[str, Any]:
    """Compute upside beta (beta^+), downside beta (beta^-), and downside capture ratio.

    beta^- = Cov(R_s, R_m | R_m < 0) / Var(R_m | R_m < 0)
    beta^+ = Cov(R_s, R_m | R_m > 0) / Var(R_m | R_m > 0)
    """
    clean_stock = stock_returns.dropna()
    clean_bench = benchmark_returns.dropna()
    common_idx = clean_stock.index.intersection(clean_bench.index)
    if len(common_idx) < 20:
        return {
            "upside_beta": 1.0,
            "downside_beta": 1.0,
            "asymmetry_spread": 0.0,
            "downside_capture_pct": 100.0,
            "upside_capture_pct": 100.0,
            "profile": "Unassessed (<20 obs)",
        }

    s = clean_stock.reindex(common_idx)
    b = clean_bench.reindex(common_idx)

    down_mask = b < 0
    up_mask = b > 0

    s_down, b_down = s[down_mask], b[down_mask]
    s_up, b_up = s[up_mask], b[up_mask]

    var_b_down = float(np.var(b_down, ddof=1)) if len(b_down) > 2 else 1e-6
    var_b_up = float(np.var(b_up, ddof=1)) if len(b_up) > 2 else 1e-6

    cov_down = float(np.cov(s_down, b_down)[0, 1]) if len(s_down) > 2 else var_b_down
    cov_up = float(np.cov(s_up, b_up)[0, 1]) if len(s_up) > 2 else var_b_up

    beta_down = float(cov_down / var_b_down)
    beta_up = float(cov_up / var_b_up)

    mean_b_down = float(b_down.mean()) if not b_down.empty else -0.01
    mean_s_down = float(s_down.mean()) if not s_down.empty else -0.01
    down_capture = (mean_s_down / mean_b_down * 100.0) if mean_b_down != 0 else 100.0

    mean_b_up = float(b_up.mean()) if not b_up.empty else 0.01
    mean_s_up = float(s_up.mean()) if not s_up.empty else 0.01
    up_capture = (mean_s_up / mean_b_up * 100.0) if mean_b_up != 0 else 100.0

    asymmetry = beta_down - beta_up
    profile = (
        "Downside Fragility (Beta- > Beta+)" if asymmetry > 0.20
        else "Downside Resilient (Beta- < Beta+)" if asymmetry < -0.20
        else "Symmetric Market Sensitivity"
    )

    return {
        "upside_beta": round(beta_up, 3),
        "downside_beta": round(beta_down, 3),
        "asymmetry_spread": round(asymmetry, 3),
        "downside_capture_pct": round(down_capture, 1),
        "upside_capture_pct": round(up_capture, 1),
        "profile": profile,
    }


def compute_amihud_illiquidity_and_slippage(
    returns: pd.Series,
    volumes: pd.Series,
    prices: pd.Series | None = None,
    baseline_window: int = 30,
) -> pd.DataFrame:
    """Compute Amihud (2002) illiquidity ratio and estimated transaction slippage.

    ILLIQ_t = |R_t| / (Turnover_t / 10^6)
    Measures basis-point price impact per 1 Million currency traded.
    """
    df = pd.DataFrame(index=returns.index)
    df["return"] = returns.fillna(0.0)
    df["volume"] = volumes.fillna(1.0)
    if prices is not None:
        df["price"] = prices.fillna(1.0)
        turnover_millions = (df["volume"] * df["price"]) / 1e6
    else:
        turnover_millions = df["volume"] / 1e6

    turnover_clamped = turnover_millions.clip(lower=0.01)
    df["turnover_millions"] = turnover_millions
    df["amihud_illiq"] = (df["return"].abs() / turnover_clamped) * 100.0

    df["baseline_illiq"] = (
        df["amihud_illiq"]
        .rolling(baseline_window, min_periods=5)
        .mean()
        .shift(1)
        .bfill()
        .clip(lower=1e-4)
    )

    df["illiq_shock_ratio"] = df["amihud_illiq"] / df["baseline_illiq"]
    df["slippage_bps_10lakh"] = df["amihud_illiq"] * 0.10

    def _regime(row):
        ratio = row["illiq_shock_ratio"]
        if ratio >= 3.0:
            return "Severe Liquidity Shock / Order Book Evaporation"
        elif ratio >= 1.75:
            return "Elevated Slippage Regime"
        else:
            return "Deep Liquidity / Normal Slippage"

    df["liquidity_regime"] = df.apply(_regime, axis=1)
    return df.round(4)


def compute_crash_risk_metrics(residual_returns: pd.Series) -> dict[str, Any]:
    """Compute Negative Coefficient of Skewness (NCSKEW) and Down-to-Up Volatility Ratio (DUVOL).

    NCSKEW = - (n*(n-1)^(3/2) * sum(e^3)) / ((n-1)*(n-2) * (sum(e^2))^(3/2))
    DUVOL = ln( (n_u - 1)*sum_down(e^2) / ((n_d - 1)*sum_up(e^2)) )
    """
    clean_res = residual_returns.dropna()
    n = len(clean_res)
    if n < 15:
        return {
            "ncskew": 0.0,
            "duvol": 0.0,
            "crash_risk_regime": "Unassessed (<15 obs)",
        }

    # Demean residuals
    e = clean_res - clean_res.mean()
    sum_e2 = float(np.sum(e**2))
    sum_e3 = float(np.sum(e**3))

    if sum_e2 <= 1e-12:
        return {
            "ncskew": 0.0,
            "duvol": 0.0,
            "crash_risk_regime": "Zero Variance",
        }

    # NCSKEW
    numerator = n * ((n - 1) ** 1.5) * sum_e3
    denominator = (n - 1) * (n - 2) * (sum_e2 ** 1.5)
    ncskew = -float(numerator / denominator) if denominator != 0 else 0.0

    # DUVOL
    e_down = e[e < 0]
    e_up = e[e >= 0]
    n_d = len(e_down)
    n_u = len(e_up)

    if n_d > 1 and n_u > 1:
        sum_down_e2 = float(np.sum(e_down**2))
        sum_up_e2 = float(np.sum(e_up**2))
        if sum_up_e2 > 1e-12 and sum_down_e2 > 1e-12:
            ratio = ((n_u - 1) * sum_down_e2) / ((n_d - 1) * sum_up_e2)
            duvol = float(np.log(max(1e-4, ratio)))
        else:
            duvol = 0.0
    else:
        duvol = 0.0

    regime = (
        "Elevated Tail Crash Risk (High NCSKEW/DUVOL)" if (ncskew > 0.40 or duvol > 0.25)
        else "Moderate Negative Asymmetry" if (ncskew > 0.10 or duvol > 0.10)
        else "Low Crash Risk / Symmetric Return Profile"
    )

    return {
        "ncskew": round(ncskew, 3),
        "duvol": round(duvol, 3),
        "crash_risk_regime": regime,
    }


def compute_volatility_structural_break(
    pre_returns: pd.Series,
    post_returns: pd.Series,
) -> dict[str, Any]:
    """Compute F-test for structural shift in return volatility across pre- vs post-event regimes.

    F = Var(R_post) / Var(R_pre) ~ F(n_post - 1, n_pre - 1)
    """
    clean_pre = pre_returns.dropna()
    clean_post = post_returns.dropna()
    n_pre = len(clean_pre)
    n_post = len(clean_post)

    if n_pre < 5 or n_post < 5:
        return {
            "pre_volatility_pct": 0.0,
            "post_volatility_pct": 0.0,
            "volatility_shift_ratio": 1.0,
            "f_statistic": 1.0,
            "p_value": 1.0,
            "break_regime": "Unassessed (<5 obs)",
        }

    var_pre = float(np.var(clean_pre, ddof=1))
    var_post = float(np.var(clean_post, ddof=1))

    if var_pre <= 1e-12 or var_post <= 1e-12:
        return {
            "pre_volatility_pct": 0.0,
            "post_volatility_pct": 0.0,
            "volatility_shift_ratio": 1.0,
            "f_statistic": 1.0,
            "p_value": 1.0,
            "break_regime": "Zero Variance",
        }

    f_stat = var_post / var_pre
    df1 = n_post - 1
    df2 = n_pre - 1

    from scipy.stats import f as f_dist
    p_val = float(2 * min(f_dist.cdf(f_stat, df1, df2), 1 - f_dist.cdf(f_stat, df1, df2)))
    p_val = min(max(p_val, 0.0), 1.0)

    vol_pre_ann = float(np.sqrt(var_pre * 252.0)) * 100.0
    vol_post_ann = float(np.sqrt(var_post * 252.0)) * 100.0
    shift_ratio = float(np.sqrt(var_post) / np.sqrt(var_pre))

    if p_val < 0.05 and shift_ratio > 1.25:
        regime = "Structural Volatility Expansion (p < 0.05)"
    elif p_val < 0.05 and shift_ratio < 0.80:
        regime = "Structural Volatility Compression (p < 0.05)"
    else:
        regime = "Stable Volatility Regime"

    return {
        "pre_volatility_pct": round(vol_pre_ann, 2),
        "post_volatility_pct": round(vol_post_ann, 2),
        "volatility_shift_ratio": round(shift_ratio, 3),
        "f_statistic": round(f_stat, 3),
        "p_value": round(p_val, 4),
        "break_regime": regime,
    }


def compute_higher_moment_coskewness_cokurtosis(
    stock_returns: pd.Series,
    benchmark_returns: pd.Series,
) -> dict[str, Any]:
    """Compute Systematic Coskewness and Cokurtosis (Harvey & Siddique 2000).

    Coskewness = E[e_i * e_m^2] / (sqrt(Var(e_i)) * Var(e_m))
    Cokurtosis = E[e_i * e_m^3] / (sqrt(Var(e_i)) * Var(e_m)^(3/2))
    """
    clean_s = stock_returns.dropna()
    clean_m = benchmark_returns.dropna()
    common_idx = clean_s.index.intersection(clean_m.index)

    if len(common_idx) < 20:
        return {
            "coskewness": 0.0,
            "cokurtosis": 3.0,
            "tail_risk_exposure": "Unassessed (<20 obs)",
        }

    s = clean_s.reindex(common_idx)
    m = clean_m.reindex(common_idx)

    e_s = s - s.mean()
    e_m = m - m.mean()

    var_s = float(np.var(e_s, ddof=1))
    var_m = float(np.var(e_m, ddof=1))

    if var_s <= 1e-12 or var_m <= 1e-12:
        return {
            "coskewness": 0.0,
            "cokurtosis": 3.0,
            "tail_risk_exposure": "Zero Variance",
        }

    std_s = np.sqrt(var_s)

    m_coskew = float(np.mean(e_s * (e_m**2)))
    m_cokurt = float(np.mean(e_s * (e_m**3)))

    coskew = m_coskew / (std_s * var_m)
    cokurt = m_cokurt / (std_s * (var_m**1.5))

    if coskew < -0.20:
        exposure = "Negative Coskewness (Crash Vulnerability / Demands Higher Risk Premium)"
    elif coskew > 0.20:
        exposure = "Positive Coskewness (Tail-Hedging Asset)"
    else:
        exposure = "Neutral Systematic Tail Exposure"

    return {
        "coskewness": round(coskew, 3),
        "cokurtosis": round(cokurt, 3),
        "tail_risk_exposure": exposure,
    }


def compute_copula_tail_dependence(
    stock_returns: pd.Series,
    benchmark_returns: pd.Series,
    tail_quantile: float = 0.10,
) -> dict[str, Any]:
    """Compute empirical lower-tail crash dependence (lambda_L) and upper-tail dependence (lambda_U).

    Measures extreme co-movement probability during market crashes vs market rallies.
    """
    clean_s = stock_returns.dropna()
    clean_m = benchmark_returns.dropna()
    common_idx = clean_s.index.intersection(clean_m.index)

    if len(common_idx) < 25:
        return {
            "lower_tail_dependence_lambda_L": 0.0,
            "upper_tail_dependence_lambda_U": 0.0,
            "tail_asymmetry_ratio": 1.0,
            "tail_dependence_regime": "Unassessed (<25 obs)",
        }

    s = clean_s.reindex(common_idx)
    m = clean_m.reindex(common_idx)
    N = len(s)

    # Convert to empirical uniform margins
    from scipy.stats import rankdata
    u = rankdata(s) / (N + 1.0)
    v = rankdata(m) / (N + 1.0)

    # Lower tail: both in bottom tail_quantile
    q_low = tail_quantile
    lower_joint = np.sum((u <= q_low) & (v <= q_low))
    lambda_l = float(lower_joint / (q_low * N))

    # Upper tail: both in top tail_quantile
    q_high = 1.0 - tail_quantile
    upper_joint = np.sum((u >= q_high) & (v >= q_high))
    lambda_u = float(upper_joint / (tail_quantile * N))

    lambda_l = min(max(lambda_l, 0.0), 1.0)
    lambda_u = min(max(lambda_u, 0.0), 1.0)

    asym_ratio = lambda_l / lambda_u if lambda_u > 1e-4 else (2.0 if lambda_l > 0 else 1.0)

    if lambda_l > 0.40 and asym_ratio > 1.3:
        regime = "High Crash Tail Dependence (Systemic Fragility)"
    elif lambda_u > 0.40 and asym_ratio < 0.7:
        regime = "High Upside Tail Dependence (Beta Rally Asset)"
    else:
        regime = "Symmetric / Moderate Tail Co-movement"

    return {
        "lower_tail_dependence_lambda_L": round(lambda_l, 3),
        "upper_tail_dependence_lambda_U": round(lambda_u, 3),
        "tail_asymmetry_ratio": round(asym_ratio, 2),
        "tail_dependence_regime": regime,
    }


def compute_roll_effective_spread(
    prices: pd.Series,
    returns: pd.Series | None = None,
) -> dict[str, Any]:
    """Compute Roll (1984) effective bid-ask spread proxy from serial price covariance.

    Spread = 2 * sqrt(max(0, -Cov(Delta P_t, Delta P_{t-1})))
    """
    clean_p = prices.dropna()
    if len(clean_p) < 15:
        return {
            "roll_effective_spread_rupees": 0.0,
            "roll_effective_spread_pct": 0.0,
            "market_depth_status": "Unassessed (<15 obs)",
        }

    dp = clean_p.diff().dropna()
    dp_t = dp.iloc[1:].values
    dp_t_minus_1 = dp.iloc[:-1].values

    cov = float(np.cov(dp_t, dp_t_minus_1)[0, 1]) if len(dp_t) > 2 else 0.0
    mean_price = float(clean_p.mean()) if not clean_p.empty else 100.0

    if cov < 0:
        spread_abs = 2.0 * np.sqrt(-cov)
        spread_pct = (spread_abs / mean_price) * 100.0
    else:
        spread_abs = 0.0
        spread_pct = 0.0

    depth = (
        "Wide Spread / Illiquid Depth (>1.0%)" if spread_pct > 1.0
        else "Moderate Institutional Depth (0.3% - 1.0%)" if spread_pct >= 0.3
        else "Tight Effective Spread / High Market Depth"
    )

    return {
        "roll_effective_spread_rupees": round(spread_abs, 2),
        "roll_effective_spread_pct": round(spread_pct, 3),
        "market_depth_status": depth,
    }


def compute_kyle_lambda_and_vpin(
    returns: pd.Series,
    volumes: pd.Series,
    prices: pd.Series,
    buckets: int = 10,
) -> dict[str, Any]:
    """Compute Kyle's Lambda (price impact per block volume) and VPIN (Volume-Synchronized Probability of Toxicity).

    Kyle's Lambda: Cov(Delta P, Signed Flow) / Var(Signed Flow)
    VPIN Proxy: Sum |V_buy - V_sell| / (2 * V_total)
    """
    common_idx = returns.dropna().index.intersection(volumes.dropna().index).intersection(prices.dropna().index)
    if len(common_idx) < 5:
        return {
            "kyle_lambda_price_impact": 0.0,
            "vpin_toxicity_probability": 0.0,
            "toxicity_regime": "Unassessed (<5 obs)",
        }

    clean_r = returns.reindex(common_idx)
    clean_v = volumes.reindex(common_idx)
    clean_p = prices.reindex(common_idx)

    # Estimate signed order flow
    dp = clean_p.diff().fillna(0.0)
    # Lee-Ready signed volume proxy: sign of return * volume in millions INR
    flow_millions = np.sign(clean_r) * (clean_v * clean_p / 1e6)

    var_flow = float(np.var(flow_millions, ddof=1)) if len(flow_millions) > 5 else 1.0
    cov_dp_flow = float(np.cov(dp, flow_millions)[0, 1]) if len(dp) > 5 else 0.0

    kyle_lambda = (cov_dp_flow / var_flow) if var_flow > 1e-6 else 0.0
    kyle_lambda_clamped = max(0.0, kyle_lambda)

    # VPIN proxy
    v_buy = clean_v[clean_r > 0].sum()
    v_sell = clean_v[clean_r < 0].sum()
    v_total = clean_v.sum()

    vpin = float(abs(v_buy - v_sell) / (2.0 * max(1.0, v_total))) if v_total > 0 else 0.0

    toxicity_regime = (
        "High Adverse Selection / Informed Toxic Flow (VPIN > 0.35)" if vpin > 0.35
        else "Moderate Informed Trading (0.20 - 0.35)" if vpin >= 0.20
        else "Benign Liquidity / Uninformed Order Flow"
    )

    return {
        "kyle_lambda_price_impact": round(kyle_lambda_clamped, 4),
        "vpin_toxicity_probability": round(vpin, 3),
        "toxicity_regime": toxicity_regime,
    }


def abnormal_returns(frame: pd.DataFrame, model: MarketModel | MultiFactorModel, factor_returns: pd.DataFrame | None = None) -> pd.DataFrame:
    """Add ``expected_return``, ``abnormal_return`` and a standardised score."""
    out = frame.copy()
    if isinstance(model, MultiFactorModel) and factor_returns is not None and model.fitted:
        expected = pd.Series(model.alpha, index=out.index)
        for factor_name, beta_val in model.betas.items():
            if factor_name in factor_returns.columns:
                expected += beta_val * factor_returns[factor_name]
        out["expected_return"] = expected
    else:
        out["expected_return"] = model.alpha + model.beta * out["benchmark_return"]
    out["abnormal_return"] = out["return"] - out["expected_return"]

    # Standardise against the estimation-window residual spread where we have
    # one, else against the analysis period's own spread.
    scale = model.residual_sd
    scale_source = "estimation-window residual SD"
    k_params = len(model.betas) + 1 if isinstance(model, MultiFactorModel) else 2
    df = max(model.observations - k_params, 0)
    if not np.isfinite(scale) or scale == 0:
        scale = float(out["abnormal_return"].std(ddof=1))
        scale_source = "analysis-window SD (weaker: inflated by the events in it)"
        df = max(len(out) - 1, 0)
    out.attrs["ar_scale"] = scale
    out.attrs["ar_scale_source"] = scale_source
    out.attrs["ar_scale_df"] = df
    out["abnormal_return_z"] = (
        out["abnormal_return"] / scale if scale and np.isfinite(scale) else np.nan
    )
    return out


def t_equivalent_threshold(z_threshold: float, df: int) -> float:
    """The t-distribution critical value with the same two-tailed tail
    probability a z-threshold has under the standard normal.

    Always >= ``z_threshold`` (equal only as ``df`` -> infinity), and more so
    the smaller ``df`` is - a short estimation window makes the same
    "how many standard deviations is unusual" input a harder bar to clear,
    which is the correct behaviour: a standard deviation estimated from few
    observations is itself less certain, and a z-test silently ignores that.
    Falls back to ``z_threshold`` unchanged when ``df`` is too small for a
    t-distribution to be meaningful (there's no better answer available).
    """
    if df <= 0:
        return z_threshold
    tail_prob = stats.norm.sf(z_threshold)
    return float(stats.t.isf(tail_prob, df))


def cumulative_abnormal_return(
    frame: pd.DataFrame, event_day: date, window: tuple[int, int]
) -> dict:
    """CAR over ``window`` trading days relative to ``event_day``.

    Window offsets are in **trading days**, not calendar days, so (-1, +3)
    around a Friday spans Thursday through the following Wednesday.
    """
    index = frame.index
    target = pd.Timestamp(event_day)
    positions = index.get_indexer([target], method="bfill")
    position = int(positions[0]) if positions[0] != -1 else -1
    if position == -1:
        return {"car": float("nan"), "days": 0, "start": None, "end": None,
                "note": "event day falls after the last trading day available"}

    start_pos = position + window[0]
    end_pos = position + window[1]
    if start_pos > len(index) - 1 or end_pos < 0 or start_pos > end_pos:
        return {
            "car": None, "days": 0, "start": None, "end": None,
            "t_stat": None, "p_value_t": None, "truncated": True,
            "note": "window lies outside available price series",
        }
    start = max(0, start_pos)
    end = min(len(index) - 1, end_pos)
    if start > end:
        return {
            "car": None, "days": 0, "start": None, "end": None,
            "t_stat": None, "p_value_t": None, "truncated": True,
            "note": "window lies outside available price series",
        }
    slice_ = frame.iloc[start:end + 1]
    car = float(slice_["abnormal_return"].sum())

    scale = frame.attrs.get("ar_scale")
    df = frame.attrs.get("ar_scale_df", 0)
    days = len(slice_)
    # Under the usual independence assumption the CAR's SD scales with sqrt(N).
    t_stat = (car / (scale * np.sqrt(days))
              if scale and np.isfinite(scale) and days else float("nan"))
    # A classic two-tailed Student's-t p-value for that t_stat, using the
    # estimation window's own degrees of freedom (where ``scale`` came from -
    # see abnormal_returns()) rather than the CAR window's day count, since
    # it's the SD estimate's uncertainty this is testing against. Shown
    # alongside, not instead of, the permutation-test p-value below: the
    # permutation test makes no distributional assumption about returns at
    # all, which is the more rigorous of the two - this is the familiar
    # textbook number for a reader who wants it, not a replacement.
    p_value_t = (2 * float(stats.t.sf(abs(t_stat), df))
                if np.isfinite(t_stat) and df > 0 else None)

    truncated = (position + window[0] < 0) or (position + window[1] > len(index) - 1)
    return {
        "car": car,
        "days": days,
        "start": index[start].date().isoformat(),
        "end": index[end].date().isoformat(),
        "t_stat": float(t_stat) if np.isfinite(t_stat) else None,
        "p_value_t": p_value_t,
        "truncated": truncated,
        "note": ("window truncated at the edge of the available price series"
                 if truncated else ""),
    }


def build(
    ticker: str,
    benchmark: str,
    start: date,
    end: date,
    lead_in_days: int = 200,
    providers: list[PriceProvider] | None = None,
    estimation_days: int = DEFAULT_ESTIMATION_DAYS,
    tail_days: int = TAIL_BUFFER_DAYS,
) -> tuple[pd.DataFrame, MarketModel, dict]:
    """Load prices and return ``(frame, model, metadata)``.

    ``lead_in_days`` is calendar days of history fetched *before* ``start``, to
    give the market model something to fit on (PRD Section 8).

    ``tail_days`` extends the series *past* ``end``, which is not cosmetic: news
    published after the close on the last day of the window needs the following
    trading day to exist, and a CAR window of (-1, +3) reaches three sessions
    beyond any incident on that day. Without the tail, both silently degrade -
    the news becomes unattributed and the CAR comes back truncated.
    """
    fetch_start = start - timedelta(days=lead_in_days)
    fetch_end = end + timedelta(days=tail_days)
    company, company_provider = load_prices(ticker, fetch_start, fetch_end, providers)
    index_frame, benchmark_provider = load_prices(benchmark, fetch_start, fetch_end, providers)
    log.info("prices: %s via %s (%d rows), %s via %s (%d rows), requested "
             "%s to %s (%d lead-in day(s))",
             ticker, company_provider, len(company),
             benchmark, benchmark_provider, len(index_frame),
             fetch_start, fetch_end, lead_in_days)

    frame = align_series(company, index_frame)
    if frame.empty:
        raise PriceError(
            f"no overlapping trading dates for {ticker} and {benchmark}")
    log.info("prices: %d rows share a trading date on both series "
             "(dropped %d company-only, %d benchmark-only)",
             len(frame), len(company) - len(frame), len(index_frame) - len(frame))

    model = fit_market_model(frame, start, estimation_days=estimation_days)
    frame = abnormal_returns(frame, model)

    analysis = frame.loc[pd.Timestamp(start):pd.Timestamp(end)]
    metadata = {
        "ticker": ticker,
        "benchmark": benchmark,
        "company_provider": company_provider,
        "benchmark_provider": benchmark_provider,
        "lead_in_start": fetch_start.isoformat(),
        "tail_end": fetch_end.isoformat(),
        "rows_total": len(frame),
        "rows_in_analysis_window": len(analysis),
        "model": model.kind,
        "alpha": model.alpha,
        "beta": model.beta,
        "r_squared": model.r_squared,
        "estimation_observations": model.observations,
        "model_note": model.note,
        "ar_scale_source": frame.attrs.get("ar_scale_source"),
    }
    return frame, model, metadata


# Default draws for the permutation test below. 2000 is enough for a stable
# empirical p-value to 2-3 significant figures while staying fast even on a
# multi-year price series; the function itself uses fewer when the series
# does not offer that many non-overlapping placebo windows.
DEFAULT_PERMUTATIONS = 2000


def permutation_test_car(
    frame: pd.DataFrame,
    event_day: date,
    window: tuple[int, int],
    exclude_days: set[date] = frozenset(),
    n_permutations: int = DEFAULT_PERMUTATIONS,
    seed: int = 42,
) -> dict:
    """Empirical p-value for a CAR via placebo (pseudo-event) resampling.

    The t-stat next to CAR assumes independent, normally distributed abnormal
    returns spanning a large sample - an assumption a single company's own
    handful of trading days does not meet, and every place that t-stat is
    printed says so. This does not fix that assumption; it sidesteps it:
    draw many random same-length windows from this same abnormal-return
    series - excluding any day already flagged as a candidate, so the null
    distribution is not contaminated by the very events being tested - and
    ask what fraction of those placebo CARs are at least as extreme (two-
    sided) as the real one. That fraction *is* the p-value, by construction,
    for this specific company, series and window length - no distributional
    assumption required, at the cost of only being valid for this one run
    (it says nothing about whether the effect would replicate elsewhere).

    Deterministic by default (fixed seed): re-running the same analysis
    reproduces the same p-value, matching the reproducibility the rest of
    this pipeline works hard for (see the dominant_emotion/dominant_event
    tie-break note in ``eventstudy.py``).
    """
    if n_permutations <= 0:
        return {"p_value": None, "n": 0, "p_value_note": "permutation test disabled."}

    # Note the "p_value_note" key name rather than "note": the caller merges
    # this dict into cumulative_abnormal_return()'s own result, which already
    # has a "note" key (e.g. "window truncated..."); a same-named key here
    # would silently clobber it rather than error, exactly the kind of quiet
    # bug this project has repeatedly hunted down elsewhere.
    real = cumulative_abnormal_return(frame, event_day, window)
    real_car = real.get("car")
    days_span = real.get("days") or 0
    if real_car is None or not np.isfinite(real_car) or days_span < 1:
        return {"p_value": None, "n": 0,
                "p_value_note": "actual CAR unavailable - nothing to test against."}

    usable = frame.dropna(subset=["abnormal_return"])
    ar = usable["abnormal_return"].to_numpy()
    if len(ar) < days_span + 1:
        return {"p_value": None, "n": 0,
                "p_value_note": (f"only {len(ar)} usable trading day(s) in the "
                                f"series - too few to draw {days_span}-day "
                                "placebo windows.")}

    excluded_positions = {i for i, ts in enumerate(usable.index)
                          if ts.date() in exclude_days}
    max_start = len(ar) - days_span
    candidates = [
        s for s in range(max_start + 1)
        if not any(p in excluded_positions for p in range(s, s + days_span))
    ]
    if len(candidates) < 10:
        return {"p_value": None, "n": 0,
                "p_value_note": ("too few non-flagged windows available in "
                                 "this price series to build a null "
                                 "distribution.")}

    rng = np.random.default_rng(seed)
    if len(candidates) <= n_permutations:
        starts = candidates
    else:
        starts = rng.choice(candidates, size=n_permutations, replace=False)

    placebo_cars = np.array([ar[s:s + days_span].sum() for s in starts])
    p_value = float(np.mean(np.abs(placebo_cars) >= abs(real_car)))

    return {
        "p_value": round(p_value, 4),
        "n": len(starts),
        "p_value_note": (f"empirical p-value from {len(starts)} placebo "
                         f"window(s) of the same {days_span}-day length, "
                         "drawn from this company's own abnormal-return "
                         f"series (excluding other flagged days); "
                         f"deterministic (seed={seed})."),
    }


def trading_days(frame: pd.DataFrame) -> set[date]:
    """The real exchange calendar, for news attribution.

    This closes the Phase 1 gap where the weekday fallback treated exchange
    holidays (26 January, say) as tradeable.
    """
    return {ts.date() for ts in frame.index}


def compute_drawdown_metrics(
    close_series: pd.Series,
    returns_series: pd.Series | None = None,
) -> dict[str, Any]:
    """Compute Share Price Drawdown Dynamics & Calmar Ratio.

    Returns:
    - max_drawdown_pct: Maximum peak-to-trough drop in %
    - current_drawdown_pct: Drawdown from all-time peak at end of period
    - peak_date: Date of peak before maximum drawdown
    - trough_date: Date of lowest price in maximum drawdown
    - peak_to_trough_days: Duration in trading days from peak to trough
    - calmar_ratio: Annualized return divided by maximum drawdown
    - drawdown_series: Normalized percentage drawdown series (0.0 to -1.0)
    """
    clean_p = close_series.dropna()
    if len(clean_p) < 2:
        return {
            "max_drawdown_pct": 0.0,
            "current_drawdown_pct": 0.0,
            "peak_date": None,
            "trough_date": None,
            "peak_to_trough_days": 0,
            "calmar_ratio": 0.0,
            "drawdown_series": pd.Series(dtype=float),
        }

    cum_max = clean_p.cummax()
    dd_series = (clean_p - cum_max) / cum_max

    mdd = float(dd_series.min())
    curr_dd = float(dd_series.iloc[-1])

    trough_idx = dd_series.idxmin()
    peak_idx = clean_p.loc[:trough_idx].idxmax()

    try:
        trough_pos = clean_p.index.get_loc(trough_idx)
        peak_pos = clean_p.index.get_loc(peak_idx)
        p2t_days = int(trough_pos - peak_pos)
    except Exception:
        p2t_days = 0

    # Calmar ratio
    if returns_series is not None and not returns_series.empty:
        ann_ret = float(returns_series.mean() * 252)
    else:
        ret = clean_p.pct_change().dropna()
        ann_ret = float(ret.mean() * 252) if not ret.empty else 0.0

    calmar = abs(ann_ret / mdd) if mdd < -0.001 else 0.0

    return {
        "max_drawdown_pct": round(abs(mdd) * 100.0, 2),
        "current_drawdown_pct": round(abs(curr_dd) * 100.0, 2),
        "peak_date": str(peak_idx)[:10] if peak_idx is not None else None,
        "trough_date": str(trough_idx)[:10] if trough_idx is not None else None,
        "peak_to_trough_days": p2t_days,
        "calmar_ratio": round(calmar, 2),
        "drawdown_series": dd_series,
    }

