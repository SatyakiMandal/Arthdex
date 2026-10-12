"""Deterministic risk assessment for a listed stock, from its own daily bars.

No model opinion is involved: every figure is arithmetic on a year of closes and volumes, and the score shows
its parts. Position sizing answers a plain question: if a stop sits 2 ATR away and a loss there should cost 1%
of capital, how much of the capital can be in the stock?
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from . import indicators as ind
from .technicals import _f

WINDOW = 252
LIQ_WINDOW = 60


def _scale(x: float, lo: float, hi: float) -> float:
    """Map x from [lo, hi] onto 0-100, clamped. lo is the calm end, hi the dangerous end."""
    if hi == lo:
        return 0.0
    return float(np.clip((x - lo) / (hi - lo) * 100.0, 0.0, 100.0))


def _liquidity_tier(crore: float) -> str:
    return "High" if crore >= 50 else "Moderate" if crore >= 5 else "Low" if crore >= 0.5 else "Thin"


def _tier(score: float) -> str:
    return "Low" if score < 25 else "Moderate" if score < 50 else "High" if score < 75 else "Very high"


def assess(symbol: str, df: pd.DataFrame) -> dict[str, Any]:
    if len(df) < 60:
        raise ValueError(f"Only {len(df)} daily bars for {symbol}; need at least 60 to assess risk.")
    d = df.iloc[-WINDOW:]
    close = d["Close"]
    ret = np.log(close).diff().dropna()
    last = float(close.iloc[-1])

    vol = float(ret.std(ddof=1) * np.sqrt(252) * 100)
    peak = close.cummax()
    dd = (close / peak - 1.0) * 100
    max_dd = float(-dd.min())
    cur_dd = float(-dd.iloc[-1])
    simple = close.pct_change().dropna() * 100
    var95 = float(-np.percentile(simple, 5))
    tail = simple[simple <= -var95]
    cvar95 = float(-tail.mean()) if len(tail) else var95
    worst = float(-simple.min())

    atr_v = float(ind.atr(df, 14).iloc[-1])
    atr_pct = atr_v / last * 100 if last else float("nan")

    traded = (d["Close"] * d["Volume"].fillna(0)).iloc[-LIQ_WINDOW:]
    median_cr = float(traded.median() / 1e7)
    liq_tier = _liquidity_tier(median_cr)

    parts = [
        ("Volatility", f"{vol:.1f}% a year", _scale(vol, 15, 60), 0.35),
        ("Current drawdown", f"{cur_dd:.1f}% below the 1-year high", _scale(cur_dd, 0, 40), 0.20),
        ("1-day VaR (95%)", f"{var95:.2f}%", _scale(var95, 1, 5), 0.20),
        ("Liquidity", f"₹{median_cr:,.1f} Cr traded a day (median)", _scale(float(np.log10(max(median_cr, 0.01))), np.log10(50), np.log10(0.5)), 0.15),
        ("Worst day", f"-{worst:.1f}%", _scale(worst, 2, 12), 0.10),
    ]
    score = sum(s * w for _n, _v, s, w in parts)

    stop_pct = 2.0 * atr_pct
    max_position = min(1.0 / stop_pct * 100.0, 100.0) if np.isfinite(stop_pct) and stop_pct > 0 else None

    return {
        "symbol": symbol,
        "asOf": df.index[-1].strftime("%Y-%m-%d"),
        "lastClose": _f(last),
        "score": _f(score, 0),
        "tier": _tier(score),
        "components": [{"name": n, "reading": v, "score": _f(s, 0), "weight": w} for n, v, s, w in parts],
        "metrics": {
            "volatilityPct": _f(vol, 1),
            "maxDrawdownPct": _f(max_dd, 1),
            "currentDrawdownPct": _f(cur_dd, 1),
            "var95Pct": _f(var95, 2),
            "cvar95Pct": _f(cvar95, 2),
            "worstDayPct": _f(worst, 2),
            "atr": _f(atr_v),
            "atrPct": _f(atr_pct, 2),
            "medianTradedCrore": _f(median_cr, 1),
            "liquidity": liq_tier,
        },
        "sizing": {
            "stopAtr": 2.0,
            "stopPrice": _f(last - 2.0 * atr_v),
            "stopPct": _f(stop_pct, 2),
            "riskPerTradePct": 1.0,
            "maxPositionPct": _f(max_position, 1) if max_position is not None else None,
        },
        "method": (
            "Computed from the last year of daily bars. The score is a weighted blend of volatility (15% to 60% a year "
            "maps to 0-100), distance below the 1-year high (0-40%), 95% 1-day VaR (1-5%), median daily traded value "
            "(₹50 Cr down to ₹0.5 Cr) and the worst single day (2-12%). Position size is capital at risk (1%) divided by "
            "a 2-ATR stop. It describes past behaviour; it is not a forecast or a recommendation."
        ),
    }
