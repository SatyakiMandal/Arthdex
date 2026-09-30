"""
Benchmark sensitivity.

Beta, alpha and R-squared come from an actual OLS regression of the stock's
excess returns on each index's excess returns over the overlapping trading days.
Nothing is parameterised: if a regression cannot be run, the benchmark is
omitted rather than filled in.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
import statsmodels.api as sm
import yfinance as yf

from .quant import RISK_FREE_PCT, TRADING_DAYS, _round

# Only indices with a genuine Yahoo history are listed. Nifty Auto, Energy,
# Metal, FMCG, Realty, PSU Bank and Infrastructure all return a single row
# upstream — there is no series to regress against, so they are not offered.
BENCHMARKS: list[tuple[str, str, str]] = [
    ("nifty-50", "Nifty 50", "^NSEI"),
    ("nifty-next-50", "Nifty Next 50", "^NSMIDCP"),
    ("nifty-100", "Nifty 100", "^CNX100"),
    ("nifty-500", "Nifty 500", "^CRSLDX"),
    ("nifty-bank", "Nifty Bank", "^NSEBANK"),
    ("nifty-it", "Nifty IT", "^CNXIT"),
    ("nifty-pharma", "Nifty Pharma", "^CNXPHARMA"),
    ("nifty-midcap-50", "Nifty Midcap 50", "^NSEMDCP50"),
]

UNAVAILABLE_BENCHMARKS = [
    "Nifty Auto",
    "Nifty Energy",
    "Nifty Metal",
    "Nifty FMCG",
    "Nifty Realty",
    "Nifty PSU Bank",
]


def _index_returns(yahoo_symbol: str, period: str = "2y") -> pd.Series:
    try:
        frame = yf.Ticker(yahoo_symbol).history(period=period, interval="1d")
    except Exception:
        return pd.Series(dtype=float)
    if frame is None or frame.empty or "Close" not in frame:
        return pd.Series(dtype=float)
    close = frame["Close"].dropna()
    series = (100 * np.log(close)).diff().dropna()
    series.index = pd.to_datetime(series.index).tz_localize(None).normalize()
    return series


def _stock_returns(frame: pd.DataFrame) -> pd.Series:
    close = frame["Close"].dropna()
    series = (100 * np.log(close)).diff().dropna()
    series.index = pd.to_datetime(series.index).tz_localize(None).normalize()
    return series


def compute_sensitivities(stock_frame: pd.DataFrame) -> dict[str, Any]:
    stock = _stock_returns(stock_frame)
    if len(stock) < 120:
        return {
            "rows": [],
            "primary": None,
            "unavailableBenchmarks": UNAVAILABLE_BENCHMARKS,
            "note": f"Need at least 120 overlapping observations; have {len(stock)}.",
        }

    daily_rf = RISK_FREE_PCT / TRADING_DAYS
    rows: list[dict[str, Any]] = []

    for bench_id, name, y_symbol in BENCHMARKS:
        index = _index_returns(y_symbol)
        if index.empty:
            continue

        joined = pd.concat([stock, index], axis=1, join="inner").dropna()
        joined.columns = ["stock", "index"]
        if len(joined) < 120:
            continue

        y = joined["stock"] - daily_rf
        x = sm.add_constant(joined["index"] - daily_rf)

        try:
            model = sm.OLS(y, x).fit()
        except Exception:
            continue

        beta = float(model.params.iloc[1])
        alpha_daily = float(model.params.iloc[0])
        r_squared = float(model.rsquared)

        stock_total = float(joined["stock"].sum())
        index_total = float(joined["index"].sum())

        rows.append(
            {
                "benchmarkId": bench_id,
                "benchmarkName": name,
                "beta": _round(beta),
                # Annualised regression intercept — Jensen's alpha
                "alphaPct": _round(alpha_daily * TRADING_DAYS),
                "rSquared": _round(r_squared, 3),
                # Plain cumulative excess of the stock over the index, which is
                # a different quantity from the risk-adjusted alpha above
                "abnormalReturnPct": _round(stock_total - index_total),
                "indexReturnPct": _round(index_total),
                "stockReturnPct": _round(stock_total),
                "observationWindowDays": len(joined),
                "tStatBeta": _round(float(model.tvalues.iloc[1])),
                "pValueAlpha": _round(float(model.pvalues.iloc[0]), 4),
            }
        )

    if not rows:
        return {
            "rows": [],
            "primary": None,
            "unavailableBenchmarks": UNAVAILABLE_BENCHMARKS,
            "note": "No benchmark had enough overlapping history.",
        }

    primary = max(rows, key=lambda r: r["rSquared"] or 0)

    return {
        "rows": rows,
        "primary": primary["benchmarkId"],
        "riskFreePct": RISK_FREE_PCT,
        "unavailableBenchmarks": UNAVAILABLE_BENCHMARKS,
        "note": (
            "Sector indices for Auto, Energy, Metal, FMCG, Realty and PSU Bank "
            "have no usable history on the free data source, so they are not shown."
        ),
    }


def annualised_vol_pct(stock_frame: pd.DataFrame) -> float | None:
    stock = _stock_returns(stock_frame)
    if len(stock) < 30:
        return None
    return _round(float(stock.std()) * math.sqrt(TRADING_DAYS))
