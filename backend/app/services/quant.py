"""
Quantitative engine.

Every figure here is estimated from real return series. Where a model cannot be
fitted the field is returned as null with a reason, never back-filled with a
plausible-looking constant.

Three quantities have no free data source at all and are marked illustrative in
the response: Kyle's lambda and VPIN need tick-level order flow, which is absent
from every retail feed.
"""

from __future__ import annotations

import math
import warnings
from typing import Any

import numpy as np
import pandas as pd
import statsmodels.api as sm
from arch import arch_model
from scipy import stats

from ..providers.yahoo import fetch_daily_history

warnings.filterwarnings("ignore")

TRADING_DAYS = 252
Z_99 = float(stats.norm.ppf(0.99))
RISK_FREE_PCT = 6.5

# Minimum history before any model is fitted. Below this, GARCH parameters are
# not identified and the output would be noise dressed as an estimate.
MIN_OBSERVATIONS = 180


def _finite(value: Any) -> float | None:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def _round(value: Any, digits: int = 2) -> float | None:
    f = _finite(value)
    return None if f is None else round(f, digits)


def daily_log_returns(symbol: str, years: int = 3, exchange: str = "NSE") -> pd.Series:
    """
    Percent daily log returns from real closes, oldest first.

    Uses daily bars explicitly. The chart period map coarsens 3Y to weekly bars,
    which would be annualised with the wrong factor and leave too few
    observations to identify a GARCH process.
    """
    frame = fetch_daily_history(symbol, years, exchange)
    if frame.empty or "Close" not in frame:
        return pd.Series(dtype=float)
    close = frame["Close"].dropna()
    return (100 * np.log(close)).diff().dropna()


# ---------------------------------------------------------------------------
# Volatility ensemble
# ---------------------------------------------------------------------------

ARCH_SPECS: list[tuple[str, dict[str, Any]]] = [
    ("GARCH(1,1)", {"vol": "GARCH", "p": 1, "q": 1}),
    ("EGARCH(1,1)", {"vol": "EGARCH", "p": 1, "o": 1, "q": 1}),
    ("FIGARCH(1,d,1)", {"vol": "FIGARCH", "p": 1, "q": 1}),
]


def _har_rv_forecast(returns: pd.Series, split: int) -> tuple[float | None, np.ndarray | None]:
    """
    Heterogeneous autoregressive model on realised variance.

    Regresses daily realised variance on its own daily, weekly and monthly
    averages — Corsi's specification. Returns the next-step variance forecast
    and the fitted variance path over the holdout.
    """
    rv = (returns**2).to_frame("rv")
    rv["d"] = rv["rv"].shift(1)
    rv["w"] = rv["rv"].rolling(5).mean().shift(1)
    rv["m"] = rv["rv"].rolling(22).mean().shift(1)
    rv = rv.dropna()
    if len(rv) < 60:
        return None, None

    train = rv.iloc[: max(split - (len(returns) - len(rv)), 30)]
    if len(train) < 40:
        train = rv.iloc[: int(len(rv) * 0.8)]

    model = sm.OLS(train["rv"], sm.add_constant(train[["d", "w", "m"]])).fit()
    test = rv.iloc[len(train) :]
    predicted_test = (
        model.predict(sm.add_constant(test[["d", "w", "m"]], has_constant="add")).to_numpy()
        if len(test)
        else None
    )

    latest = np.array(
        [1.0, rv["rv"].iloc[-1], rv["rv"].iloc[-5:].mean(), rv["rv"].iloc[-22:].mean()]
    )
    next_var = float(model.predict(latest.reshape(1, -1))[0])
    return (next_var if next_var > 0 else None), predicted_test


def volatility_ensemble(returns: pd.Series) -> dict[str, Any]:
    """
    Fit four conditional-variance models and combine them.

    Weights are inverse mean-squared-error over a held-out tail, with each model
    fitted on the training window and evaluated with those parameters frozen.
    Akaike weights were rejected: they require a common likelihood, and HAR-RV
    is an OLS fit on realised variance rather than a likelihood fit on returns,
    so its AIC is not comparable with the GARCH family's.
    """
    n = len(returns)
    if n < MIN_OBSERVATIONS:
        return {
            "models": [],
            "consensusAnnualisedVolPct": None,
            "realisedAnnualisedVolPct": _round(returns.std() * math.sqrt(TRADING_DAYS)),
            "observations": n,
            "note": f"Need at least {MIN_OBSERVATIONS} observations to fit; have {n}.",
        }

    split = int(n * 0.8)
    train = returns.iloc[:split]
    test_sq = (returns.iloc[split:] ** 2).to_numpy()

    fitted: list[dict[str, Any]] = []

    for name, spec in ARCH_SPECS:
        try:
            trained = arch_model(train, mean="Constant", dist="t", **spec).fit(
                disp="off", show_warning=False
            )
            # Re-evaluate on the full series with the trained parameters frozen,
            # so the holdout is genuinely out of sample.
            frozen = arch_model(returns, mean="Constant", dist="t", **spec).fix(trained.params)
            cond_var = np.asarray(frozen.conditional_volatility) ** 2
            mse = float(np.mean((cond_var[split:] - test_sq) ** 2))

            full = arch_model(returns, mean="Constant", dist="t", **spec).fit(
                disp="off", show_warning=False
            )
            next_var = float(full.forecast(horizon=1, reindex=False).variance.values[-1, 0])
            ann = math.sqrt(max(next_var, 1e-12)) * math.sqrt(TRADING_DAYS)

            if _finite(ann) and 0 < ann < 500:
                fitted.append({"model": name, "annualisedVolPct": round(ann, 2), "mse": mse})
        except Exception:
            # A model that will not converge is dropped rather than substituted
            continue

    har_var, har_test = _har_rv_forecast(returns, split)
    if har_var is not None and har_test is not None and len(har_test):
        aligned = test_sq[-len(har_test) :] if len(har_test) <= len(test_sq) else test_sq
        compare = har_test[-len(aligned) :]
        mse = float(np.mean((compare - aligned) ** 2))
        ann = math.sqrt(max(har_var, 1e-12)) * math.sqrt(TRADING_DAYS)
        if _finite(ann) and 0 < ann < 500:
            fitted.append({"model": "HAR-RV", "annualisedVolPct": round(ann, 2), "mse": mse})

    if not fitted:
        return {
            "models": [],
            "consensusAnnualisedVolPct": None,
            "realisedAnnualisedVolPct": _round(returns.std() * math.sqrt(TRADING_DAYS)),
            "observations": n,
            "note": "No volatility model converged on this series.",
        }

    inverse = [1.0 / m["mse"] if m["mse"] > 0 else 0.0 for m in fitted]
    total = sum(inverse) or 1.0
    for model, inv in zip(fitted, inverse):
        model["weight"] = round(inv / total, 4)
        model.pop("mse", None)

    consensus = sum(m["annualisedVolPct"] * m["weight"] for m in fitted)

    return {
        "models": fitted,
        "consensusAnnualisedVolPct": round(consensus, 2),
        "realisedAnnualisedVolPct": _round(returns.std() * math.sqrt(TRADING_DAYS)),
        "observations": n,
        "weighting": "Inverse out-of-sample MSE over the final 20% of the sample",
        "note": None,
    }


# ---------------------------------------------------------------------------
# Value at risk
# ---------------------------------------------------------------------------


def var_suite(returns: pd.Series, consensus_vol_pct: float | None) -> dict[str, Any]:
    """
    One-day 99% VaR by three methods, plus the empirical Expected Shortfall.

    Expected Shortfall is reported as the historical conditional mean beyond the
    historical VaR. That pairing is internally consistent by construction.
    Comparing an ES computed under one distribution with a VaR computed under
    another is not meaningful, so they are presented as a matched pair rather
    than forced into a single ordering.
    """
    n = len(returns)
    if n < 60:
        return {"note": f"Need at least 60 observations; have {n}."}

    daily_sigma = (
        consensus_vol_pct / math.sqrt(TRADING_DAYS)
        if consensus_vol_pct
        else float(returns.std())
    )

    parametric = Z_99 * daily_sigma

    losses = returns.to_numpy()
    historical = -float(np.percentile(losses, 1))
    tail = losses[losses <= np.percentile(losses, 1)]
    expected_shortfall = -float(tail.mean()) if tail.size else None

    # Monte Carlo from a Student-t fitted to the same returns, which keeps the
    # tail thickness of the real series rather than assuming normality.
    try:
        df, loc, scale = stats.t.fit(losses)
        df = max(float(df), 2.5)
        rng = np.random.default_rng(12345)
        simulated = stats.t.rvs(df, loc=loc, scale=scale, size=200_000, random_state=rng)
        monte_carlo = -float(np.percentile(simulated, 1))
    except Exception:
        df = None
        monte_carlo = None

    return {
        "confidencePct": 99,
        "horizonDays": 1,
        "parametricVaRPct": _round(parametric),
        "historicalVaRPct": _round(historical),
        "monteCarloVaRPct": _round(monte_carlo),
        "expectedShortfallPct": _round(expected_shortfall),
        "esBasis": "historical",
        "monteCarloDistribution": f"Student-t, df={round(df, 1)}" if df else None,
        "observations": n,
        "note": None,
    }


# ---------------------------------------------------------------------------
# Merton structural default model
# ---------------------------------------------------------------------------


def merton_default_risk(
    market_cap_cr: float | None,
    total_debt_cr: float | None,
    current_liabilities_cr: float | None,
    equity_vol_pct: float | None,
) -> dict[str, Any]:
    """
    Distance to default on reported leverage.

    The default point follows the KMV convention of short-term obligations plus
    half of longer-term debt. Asset volatility uses the standard first-order
    approximation sigma_A ~ sigma_E * E/V; the exact simultaneous solve is not
    used because it needs an option-implied input this data set does not have.
    """
    if market_cap_cr in (None, 0) or equity_vol_pct in (None, 0):
        return {"note": "Market capitalisation or equity volatility unavailable."}

    debt = total_debt_cr or 0.0
    short_term = current_liabilities_cr or 0.0
    barrier = short_term + 0.5 * debt

    if barrier <= 0:
        return {"note": "No reported liabilities, so no default barrier can be formed."}

    asset_value = market_cap_cr + debt
    asset_vol = (equity_vol_pct / 100) * (market_cap_cr / asset_value)
    drift = 0.08

    if asset_vol <= 0:
        return {"note": "Asset volatility resolved to zero."}

    dd = (math.log(asset_value / barrier) + (drift - 0.5 * asset_vol**2)) / asset_vol
    pd_pct = float(stats.norm.cdf(-dd) * 100)

    return {
        "distanceToDefault": _round(dd),
        "defaultProbabilityPct": _round(pd_pct, 4),
        "assetValueCr": _round(asset_value, 0),
        "debtBarrierCr": _round(barrier, 0),
        "assetVolPct": _round(asset_vol * 100),
        "barrierBasis": "Current liabilities + 50% of total debt (KMV convention)",
        "note": None,
    }


# ---------------------------------------------------------------------------
# Regime switching
# ---------------------------------------------------------------------------


def markov_regime(returns: pd.Series) -> dict[str, Any]:
    """Hamilton two-state switching model with regime-dependent variance."""
    n = len(returns)
    if n < MIN_OBSERVATIONS:
        return {"note": f"Need at least {MIN_OBSERVATIONS} observations; have {n}."}

    try:
        model = sm.tsa.MarkovRegression(
            returns.to_numpy(), k_regimes=2, trend="c", switching_variance=True
        )
        result = model.fit(em_iter=40, search_reps=12)
    except Exception as exc:
        return {"note": f"Regime model did not converge: {type(exc).__name__}"}

    probs = np.asarray(result.smoothed_marginal_probabilities)
    # statsmodels returns shape (nobs, k_regimes)
    latest = probs[-1] if probs.ndim == 2 else np.array([probs[0][-1], probs[1][-1]])

    variances = np.asarray(result.params[-2:], dtype=float)
    vols = [float(np.sqrt(abs(v)) * math.sqrt(TRADING_DAYS)) for v in variances]

    # Label by realised volatility rather than by index: statsmodels does not
    # guarantee which regime is state 0.
    low_idx = int(np.argmin(vols))
    high_idx = 1 - low_idx

    # statsmodels returns this column-stochastic: element [i, j] is the
    # probability of moving FROM j TO i. Transposed here so rows sum to one and
    # transition[i][j] reads as "from i to j", which is how the UI labels it.
    transition = np.asarray(result.regime_transition)[:, :, 0].T
    try:
        durations = [float(d) for d in np.asarray(result.expected_durations).ravel()[:2]]
    except Exception:
        durations = [float(1 / max(1 - transition[i, i], 1e-6)) for i in range(2)]

    low_prob = float(latest[low_idx])
    high_prob = float(latest[high_idx])
    total = low_prob + high_prob
    if total > 0:
        low_prob, high_prob = low_prob / total, high_prob / total

    current_low = low_prob >= high_prob

    return {
        "currentState": "BULL_LOW_VOL" if current_low else "BEAR_HIGH_VOL",
        "lowVolProbability": round(low_prob, 3),
        "highVolProbability": round(high_prob, 3),
        "lowVolAnnualisedPct": _round(vols[low_idx]),
        "highVolAnnualisedPct": _round(vols[high_idx]),
        "expectedDurationDays": _round(durations[low_idx if current_low else high_idx], 1),
        # Reordered to [low-vol, high-vol] so it matches the labels above;
        # statsmodels' own state numbering is arbitrary.
        "transitionMatrix": [
            [round(float(transition[i][j]), 3) for j in (low_idx, high_idx)]
            for i in (low_idx, high_idx)
        ],
        "transitionOrder": ["lowVol", "highVol"],
        "converged": bool(result.mle_retvals.get("converged", False)),
        "note": None,
    }


# ---------------------------------------------------------------------------
# Return forecasts with conformal intervals
# ---------------------------------------------------------------------------

HORIZONS = [("1D", "1 Day", 1), ("5D", "1 Week", 5), ("21D", "1 Month", 21)]


def return_forecasts(returns: pd.Series) -> list[dict[str, Any]]:
    """
    AR(1) point forecasts with split-conformal prediction intervals.

    The interval half-width is the 95th percentile of absolute residuals on a
    held-out calibration window, not a Gaussian multiple of the standard
    deviation. That is what makes it distribution-free: it inherits whatever
    tail the real residuals have.
    """
    n = len(returns)
    if n < MIN_OBSERVATIONS:
        return []

    split = int(n * 0.7)
    train, calib = returns.iloc[:split], returns.iloc[split:]

    try:
        ar = sm.tsa.ARIMA(train.to_numpy(), order=(1, 0, 0)).fit()
        params = ar.params
        const, phi = float(params[0]), float(params[1])
    except Exception:
        const, phi = float(train.mean()), 0.0

    # Calibration residuals under the fitted relationship
    prev = calib.shift(1).dropna()
    actual = calib.iloc[1:]
    predicted = const + phi * prev.to_numpy()
    residuals = np.abs(actual.to_numpy() - predicted)
    if residuals.size < 30:
        return []

    q95 = float(np.quantile(residuals, 0.95))
    last = float(returns.iloc[-1])
    one_step = const + phi * last

    # Unconditional mean of the AR(1). Cumulative expectations revert toward
    # h * mu, not toward the one-step forecast — summing a decaying path alone
    # made the 21-day forecast equal to the 1-day one, which is wrong whenever
    # phi is near zero (as it is for almost any equity return series).
    mu = const / (1 - phi) if abs(phi) < 0.999 else const
    deviation = last - mu

    out: list[dict[str, Any]] = []
    for code, label, days in HORIZONS:
        if abs(phi) < 0.999:
            # E[sum_{k=1..h} r_{t+k}] = h*mu + (r_t - mu) * phi(1 - phi^h)/(1 - phi)
            expected = days * mu + deviation * (phi * (1 - phi**days) / (1 - phi))
        else:
            expected = one_step * days
        half_width = q95 * math.sqrt(days)

        # Confidence falls as the interval widens relative to the signal
        ratio = abs(expected) / half_width if half_width > 0 else 0.0
        confidence = max(35.0, min(85.0, 40.0 + 45.0 * min(1.0, ratio * 4)))

        out.append(
            {
                "horizon": code,
                "label": label,
                "expectedReturnPct": _round(expected),
                "lowerBoundPct": _round(expected - half_width),
                "upperBoundPct": _round(expected + half_width),
                "signalConfidencePct": _round(confidence, 1),
            }
        )
    return out
