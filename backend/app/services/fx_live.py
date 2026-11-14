"""
Rupee cross rates from Yahoo Finance's currency series.

Spot only. FBIL reference rates, forward premia and RBI's REER and NEER indices have no free
feed, so they are listed under ``unavailable`` rather than shown.

``build`` takes the daily closes as arguments and is tested offline.
"""

from __future__ import annotations

from datetime import date
from typing import Any

# (label, Yahoo symbol, multiplier): the yen is quoted per 100 by convention
PAIRS: list[tuple[str, str, float]] = [
    ("USD/INR", "USDINR=X", 1.0),
    ("EUR/INR", "EURINR=X", 1.0),
    ("GBP/INR", "GBPINR=X", 1.0),
    ("JPY/INR (100)", "JPYINR=X", 100.0),
    ("AED/INR", "AEDINR=X", 1.0),
    ("CNY/INR", "CNYINR=X", 1.0),
    ("SGD/INR", "SGDINR=X", 1.0),
]

UNAVAILABLE = {
    "fbilReference": "FBIL's daily reference rates are not available from a free feed. The rates here are market quotes collected by Yahoo Finance.",
    "forwardPremia": "Rupee forward premia are interbank quotes with no free feed.",
    "reer": "RBI's REER and NEER indices are published monthly in its bulletin and are not connected.",
}

Bar = dict[str, Any]  # {"date": date, "close": float, "high": float|None, "low": float|None}


def _pct(now: float, then: float | None) -> float | None:
    return round((now / then - 1.0) * 100.0, 2) if then else None


def _close_on_or_before(bars: list[Bar], day: date) -> float | None:
    value = None
    for bar in bars:
        if bar["date"] > day:
            break
        value = bar["close"]
    return value


def pair_row(label: str, bars: list[Bar], multiplier: float = 1.0) -> dict[str, Any] | None:
    """One pair from its daily bars (oldest first). None when there is no usable close."""
    bars = [b for b in bars if isinstance(b.get("close"), (int, float)) and b["close"] > 0]
    if not bars:
        return None
    last = bars[-1]
    previous = bars[-2]["close"] if len(bars) > 1 else None
    rate = last["close"] * multiplier
    change = (last["close"] - previous) * multiplier if previous else None
    change_pct = _pct(last["close"], previous)
    day = last["date"]

    def back(days: int) -> float | None:
        target = date.fromordinal(day.toordinal() - days)
        if bars[0]["date"] > target:
            return None  # history does not reach back that far
        return _pct(last["close"], _close_on_or_before(bars, target))

    return {
        "pair": label,
        "rate": round(rate, 4),
        "change": round(change, 4) if change is not None else None,
        "changePct": change_pct,
        "high": round(last["high"] * multiplier, 4) if last.get("high") else None,
        "low": round(last["low"] * multiplier, 4) if last.get("low") else None,
        "trend": "neutral" if not change_pct else "up" if change_pct > 0 else "down",
        "change1mPct": back(30),
        "change1yPct": back(365),
        "asOf": day.isoformat(),
    }


def build(series: dict[str, list[Bar]]) -> dict[str, Any]:
    """``series`` maps a Yahoo symbol to its daily bars."""
    rows = []
    missing = []
    for label, symbol, multiplier in PAIRS:
        row = pair_row(label, series.get(symbol) or [], multiplier)
        if row:
            rows.append(row)
        else:
            missing.append(label)
    if not rows:
        raise ValueError("no currency series returned any data")
    return {
        "asOf": max(r["asOf"] for r in rows),
        "baseCurrency": "INR",
        "pairs": rows,
        "missingPairs": missing,
        "unavailable": UNAVAILABLE,
    }


def fetch() -> dict[str, Any]:
    import yfinance as yf

    series: dict[str, list[Bar]] = {}
    for _label, symbol, _m in PAIRS:
        try:
            frame = yf.Ticker(symbol).history(period="2y", interval="1d").dropna(subset=["Close"])
            series[symbol] = [
                {"date": ts.date(), "close": float(row["Close"]), "high": float(row["High"]), "low": float(row["Low"])}
                for ts, row in frame.iterrows()
            ]
        except Exception:
            series[symbol] = []  # reported under missingPairs
    return build(series)
