"""
Universe screener.

One batch price download backs both the factor screens and the multi-window
mover lists. NSE publishes daily variations only, so weekly and monthly windows
have to be computed from history rather than fetched — which is why they were
absent until now.

A hundred tickers plus the benchmark download in roughly four seconds, so the
whole universe is refreshed in a single request rather than per-symbol.
"""

from __future__ import annotations

import math
import warnings
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

from ..providers import constituents

warnings.filterwarnings("ignore")

TRADING_DAYS = 252
RISK_FREE_PCT = 6.5
BENCHMARK = "^NSEI"

# Minimum overlap before a regression is trusted. Below this the beta estimate
# is dominated by whichever few sessions happen to be present.
MIN_OVERLAP = 150

WINDOWS: dict[str, int] = {"daily": 1, "weekly": 5, "monthly": 21}


def _load_prices(symbols: list[str]) -> pd.DataFrame:
    tickers = [f"{s}.NS" for s in symbols] + [BENCHMARK]
    frame = yf.download(
        tickers,
        period="1y",
        interval="1d",
        group_by="column",
        auto_adjust=False,
        threads=True,
        progress=False,
    )
    if frame is None or frame.empty:
        return pd.DataFrame()
    close = frame["Close"] if "Close" in frame else pd.DataFrame()
    return close.dropna(how="all")


def _finite(value: Any) -> float | None:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def build_universe_stats(index: str = "nifty100") -> dict[str, Any]:
    """
    Per-symbol beta, volatility, alpha and windowed returns.

    Beta and alpha come from a genuine covariance against the Nifty 50 over the
    overlapping sessions; a symbol with too little overlap is dropped rather
    than given a default of 1.0.
    """
    members = constituents.fetch_constituents(index)
    meta = {row["symbol"]: row for row in members}
    close = _load_prices(list(meta))

    if close.empty or BENCHMARK not in close.columns:
        return {"rows": [], "index": index, "note": "Price download returned nothing."}

    returns = np.log(close).diff().dropna(how="all")
    benchmark = returns[BENCHMARK].dropna()
    daily_rf = RISK_FREE_PCT / TRADING_DAYS / 100

    rows: list[dict[str, Any]] = []

    for symbol, info in meta.items():
        column = f"{symbol}.NS"
        if column not in returns.columns:
            continue

        series = returns[column].dropna()
        joined = pd.concat([series, benchmark], axis=1, join="inner").dropna()
        if len(joined) < MIN_OVERLAP:
            continue

        stock_returns = joined.iloc[:, 0]
        bench_returns = joined.iloc[:, 1]

        covariance = np.cov(stock_returns, bench_returns)
        bench_variance = float(covariance[1, 1])
        if bench_variance <= 0:
            continue

        beta = float(covariance[0, 1]) / bench_variance
        correlation = float(np.corrcoef(stock_returns, bench_returns)[0, 1])
        volatility = float(stock_returns.std()) * math.sqrt(TRADING_DAYS) * 100
        alpha = (
            float(stock_returns.mean() - daily_rf) - beta * float(bench_returns.mean() - daily_rf)
        ) * TRADING_DAYS * 100

        prices = close[column].dropna()
        last = _finite(prices.iloc[-1]) if len(prices) else None
        if last is None:
            continue

        changes: dict[str, float | None] = {}
        for label, lookback in WINDOWS.items():
            if len(prices) <= lookback:
                changes[label] = None
                continue
            prior = _finite(prices.iloc[-1 - lookback])
            changes[label] = (
                round(((last - prior) / prior) * 100, 2) if prior not in (None, 0) else None
            )

        rows.append(
            {
                "symbol": symbol,
                "name": info["name"],
                "industry": info["industry"],
                "cmp": round(last, 2),
                "beta": round(beta, 2),
                "rSquared": round(correlation**2, 3),
                "annualisedVolPct": round(volatility, 1),
                "jensensAlphaPct": round(alpha, 1),
                "observations": len(joined),
                "changePct": changes,
                "high52w": round(float(prices.max()), 2),
                "low52w": round(float(prices.min()), 2),
            }
        )

    return {
        "rows": rows,
        "index": index,
        "indexLabel": members[0]["index"] if members else index,
        "benchmark": "Nifty 50",
        "universeSize": len(meta),
        "computed": len(rows),
        "riskFreePct": RISK_FREE_PCT,
        "note": None,
    }


def factor_screens(stats: dict[str, Any], limit: int = 10) -> dict[str, Any]:
    """High-beta, low-volatility and positive-alpha screens over the universe."""
    rows = stats.get("rows", [])
    if not rows:
        return {"highVolatility": [], "lowVolatility": [], "alpha": []}

    by_beta = sorted(rows, key=lambda r: r["beta"], reverse=True)
    by_vol = sorted(rows, key=lambda r: r["annualisedVolPct"])
    by_alpha = sorted(rows, key=lambda r: r["jensensAlphaPct"], reverse=True)

    return {
        "highVolatility": by_beta[:limit],
        "lowVolatility": by_vol[:limit],
        "alpha": by_alpha[:limit],
    }


def windowed_movers(
    stats: dict[str, Any], window: str = "weekly", limit: int = 15
) -> dict[str, Any]:
    """
    Gainers and losers over a five- or twenty-one-session window.

    Symbols without a full lookback are excluded rather than treated as flat.
    """
    if window not in WINDOWS:
        window = "weekly"

    rows = [r for r in stats.get("rows", []) if r["changePct"].get(window) is not None]
    ordered = sorted(rows, key=lambda r: r["changePct"][window], reverse=True)

    return {
        "window": window,
        "sessions": WINDOWS[window],
        "gainers": ordered[:limit],
        "losers": list(reversed(ordered[-limit:])),
        "universeCovered": len(rows),
    }
