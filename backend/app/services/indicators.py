"""Technical indicators on OHLCV frames.

Pure pandas/numpy, no I/O. Every function takes and returns Series aligned to
the input index, so any bar size works: the same code runs on 5-minute and on
daily bars. Smoothing follows the textbook definitions (Wilder's RMA for RSI,
ATR and ADX; standard EMAs for MACD) so figures line up with charting tools.

Expected columns: Open, High, Low, Close, Volume.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def sma(close: pd.Series, n: int) -> pd.Series:
    return close.rolling(n, min_periods=n).mean()


def ema(close: pd.Series, n: int) -> pd.Series:
    return close.ewm(span=n, adjust=False, min_periods=n).mean()


def _rma(x: pd.Series, n: int) -> pd.Series:
    """Wilder's smoothing: an EMA with alpha = 1/n."""
    return x.ewm(alpha=1.0 / n, adjust=False, min_periods=n).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    gain = _rma(delta.clip(lower=0.0), n)
    loss = _rma((-delta).clip(lower=0.0), n)
    rs = gain / loss.replace(0.0, np.nan)
    out = 100.0 - 100.0 / (1.0 + rs)
    # No losses in the window is an RSI of 100, not undefined
    return out.where(~((loss == 0) & gain.notna()), 100.0)


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    line = ema(close, fast) - ema(close, slow)
    sig = line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return pd.DataFrame({"macd": line, "signal": sig, "hist": line - sig})


def stochastic(df: pd.DataFrame, k: int = 14, smooth_k: int = 3, d: int = 3) -> pd.DataFrame:
    lo = df["Low"].rolling(k, min_periods=k).min()
    hi = df["High"].rolling(k, min_periods=k).max()
    raw = 100.0 * (df["Close"] - lo) / (hi - lo).replace(0.0, np.nan)
    slow_k = raw.rolling(smooth_k, min_periods=smooth_k).mean()
    return pd.DataFrame({"k": slow_k, "d": slow_k.rolling(d, min_periods=d).mean()})


def mfi(df: pd.DataFrame, n: int = 14) -> pd.Series:
    """Money Flow Index: a volume-weighted RSI on typical price."""
    tp = (df["High"] + df["Low"] + df["Close"]) / 3.0
    flow = tp * df["Volume"]
    up = flow.where(tp > tp.shift(1), 0.0)
    down = flow.where(tp < tp.shift(1), 0.0)
    pos = up.rolling(n, min_periods=n).sum()
    neg = down.rolling(n, min_periods=n).sum()
    ratio = pos / neg.replace(0.0, np.nan)
    out = 100.0 - 100.0 / (1.0 + ratio)
    return out.where(~((neg == 0) & pos.notna() & (pos > 0)), 100.0)


def true_range(df: pd.DataFrame) -> pd.Series:
    prev = df["Close"].shift(1)
    return pd.concat(
        [df["High"] - df["Low"], (df["High"] - prev).abs(), (df["Low"] - prev).abs()], axis=1
    ).max(axis=1)


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    return _rma(true_range(df), n)


def bollinger(close: pd.Series, n: int = 20, k: float = 2.0) -> pd.DataFrame:
    mid = sma(close, n)
    sd = close.rolling(n, min_periods=n).std(ddof=0)
    upper, lower = mid + k * sd, mid - k * sd
    return pd.DataFrame(
        {
            "upper": upper,
            "middle": mid,
            "lower": lower,
            "percentB": (close - lower) / (upper - lower).replace(0.0, np.nan),
            "bandwidth": (upper - lower) / mid * 100.0,
        }
    )


def adx(df: pd.DataFrame, n: int = 14) -> pd.DataFrame:
    up = df["High"].diff()
    down = -df["Low"].diff()
    plus_dm = pd.Series(np.where((up > down) & (up > 0), up, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((down > up) & (down > 0), down, 0.0), index=df.index)
    atr_n = _rma(true_range(df), n)
    plus_di = 100.0 * _rma(plus_dm, n) / atr_n
    minus_di = 100.0 * _rma(minus_dm, n) / atr_n
    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0.0, np.nan)
    return pd.DataFrame({"adx": _rma(dx.dropna(), n).reindex(df.index), "plusDI": plus_di, "minusDI": minus_di})


def supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> pd.DataFrame:
    """Supertrend line and direction (+1 uptrend, -1 downtrend).

    Bands ratchet: the upper band may only fall and the lower band may only
    rise while price stays on the same side, and the line flips when the close
    breaks the active band.
    """
    a = atr(df, period)
    hl2 = (df["High"] + df["Low"]) / 2.0
    basic_up, basic_dn = (hl2 + multiplier * a).to_numpy(), (hl2 - multiplier * a).to_numpy()
    close = df["Close"].to_numpy()
    n = len(df)
    upper, lower = np.full(n, np.nan), np.full(n, np.nan)
    line, direction = np.full(n, np.nan), np.zeros(n)

    start = int(np.argmax(~np.isnan(basic_up))) if (~np.isnan(basic_up)).any() else n
    for i in range(start, n):
        if i == start:
            upper[i], lower[i] = basic_up[i], basic_dn[i]
            direction[i] = 1.0 if close[i] >= basic_dn[i] else -1.0
        else:
            upper[i] = basic_up[i] if (basic_up[i] < upper[i - 1] or close[i - 1] > upper[i - 1]) else upper[i - 1]
            lower[i] = basic_dn[i] if (basic_dn[i] > lower[i - 1] or close[i - 1] < lower[i - 1]) else lower[i - 1]
            if direction[i - 1] == 1.0:
                direction[i] = -1.0 if close[i] < lower[i] else 1.0
            else:
                direction[i] = 1.0 if close[i] > upper[i] else -1.0
        line[i] = lower[i] if direction[i] == 1.0 else upper[i]
    return pd.DataFrame({"line": line, "direction": np.where(np.isnan(line), np.nan, direction)}, index=df.index)


def vwap(df: pd.DataFrame, intraday: bool) -> pd.Series:
    """Volume-weighted average price.

    Intraday it restarts every session, which is how VWAP is defined. On daily
    bars a per-session reset is meaningless, so it becomes a cumulative VWAP
    anchored at the first bar shown.
    """
    tp = (df["High"] + df["Low"] + df["Close"]) / 3.0
    pv = tp * df["Volume"]
    if intraday:
        day = df.index.normalize() if df.index.tz is None else df.index.tz_localize(None).normalize()
        g = pd.Series(day, index=df.index)
        return pv.groupby(g).cumsum() / df["Volume"].groupby(g).cumsum().replace(0.0, np.nan)
    return pv.cumsum() / df["Volume"].cumsum().replace(0.0, np.nan)


def support_resistance(df: pd.DataFrame, window: int = 5, per_side: int = 3) -> dict[str, list[dict[str, float]]]:
    """Horizontal levels from swing highs and lows, merged when close together.

    A swing high is a bar whose high is the highest of `window` bars either
    side. Swings within 0.6 ATR of one another are one level; a level's
    strength is how many swings formed it. Levels below the last close are
    support, above it resistance.
    """
    if len(df) < window * 2 + 5:
        return {"support": [], "resistance": []}
    hi, lo = df["High"].to_numpy(), df["Low"].to_numpy()
    last = float(df["Close"].iloc[-1])
    tol = float(atr(df, 14).iloc[-1])
    tol = 0.006 * last if not np.isfinite(tol) or tol <= 0 else 0.6 * tol

    swings: list[float] = []
    for i in range(window, len(df) - window):
        if hi[i] == hi[i - window : i + window + 1].max():
            swings.append(float(hi[i]))
        if lo[i] == lo[i - window : i + window + 1].min():
            swings.append(float(lo[i]))

    levels: list[list[float]] = []  # [mean price, touches]
    for p in sorted(swings):
        if levels and abs(p - levels[-1][0]) <= tol:
            m, c = levels[-1]
            levels[-1] = [(m * c + p) / (c + 1), c + 1]
        else:
            levels.append([p, 1])

    def pick(side: list[list[float]], near_first_desc: bool) -> list[dict[str, float]]:
        ranked = sorted(side, key=lambda lv: abs(lv[0] - last))[:per_side]
        ranked.sort(key=lambda lv: lv[0], reverse=near_first_desc)
        return [{"price": round(p, 2), "touches": int(c)} for p, c in ranked]

    return {
        "support": pick([lv for lv in levels if lv[0] < last], True),
        "resistance": pick([lv for lv in levels if lv[0] > last], False),
    }


def order_blocks(
    df: pd.DataFrame, window: int = 5, max_each: int = 6, min_displacement_atr: float = 1.0, lookback: int = 10
) -> list[dict[str, Any]]:
    """Bullish and bearish order blocks (a smart-money-concepts zone).

    A bullish order block is the last bearish candle before an impulsive move
    that breaks above the most recent swing high ("break of structure"); a
    bearish order block mirrors this on the downside. The zone is that
    candle's high-low range. A block is mitigated once price later trades
    back into its zone.

    Returned indices are positions into `df` (0-based), matching the bar
    array the chart already renders.
    """
    n = len(df)
    if n < window * 2 + 10:
        return []
    o, h, l, c = (df[col].to_numpy() for col in ("Open", "High", "Low", "Close"))
    a = atr(df, 14).to_numpy()

    swing_high = np.full(n, np.nan)
    swing_low = np.full(n, np.nan)
    for i in range(window, n - window):
        if h[i] == h[i - window : i + window + 1].max():
            swing_high[i] = h[i]
        if l[i] == l[i - window : i + window + 1].min():
            swing_low[i] = l[i]

    def last_opposite(idx: int, want_bear: bool) -> int | None:
        for j in range(idx - 1, max(idx - lookback, -1), -1):
            if (c[j] < o[j]) == want_bear:
                return j
        return None

    blocks: list[dict[str, Any]] = []
    last_high: float | None = None
    last_high_idx = used_high_idx = -1
    last_low: float | None = None
    last_low_idx = used_low_idx = -1

    for i in range(n):
        if not np.isnan(swing_high[i]):
            last_high, last_high_idx = float(swing_high[i]), i
        if not np.isnan(swing_low[i]):
            last_low, last_low_idx = float(swing_low[i]), i

        disp = a[i] if np.isfinite(a[i]) and a[i] > 0 else None
        if disp is None:
            continue

        if last_high is not None and c[i] > last_high and last_high_idx != used_high_idx:
            ob = last_opposite(i, want_bear=True)
            if ob is not None and (h[i] - l[ob]) >= min_displacement_atr * disp:
                blocks.append({"type": "bullish", "start": ob, "formed": i, "high": float(h[ob]), "low": float(l[ob]), "mitigated": None})
                used_high_idx = last_high_idx

        if last_low is not None and c[i] < last_low and last_low_idx != used_low_idx:
            ob = last_opposite(i, want_bear=False)
            if ob is not None and (h[ob] - l[i]) >= min_displacement_atr * disp:
                blocks.append({"type": "bearish", "start": ob, "formed": i, "high": float(h[ob]), "low": float(l[ob]), "mitigated": None})
                used_low_idx = last_low_idx

    for b in blocks:
        for k in range(b["formed"] + 1, n):
            if l[k] <= b["high"] and h[k] >= b["low"]:
                b["mitigated"] = k
                break

    bullish = [b for b in blocks if b["type"] == "bullish"][-max_each:]
    bearish = [b for b in blocks if b["type"] == "bearish"][-max_each:]
    return sorted(bullish + bearish, key=lambda b: b["start"])


def fair_value_gaps(df: pd.DataFrame, min_gap_atr: float = 0.1, max_each: int = 8) -> list[dict[str, Any]]:
    """Three-candle imbalances ("fair value gaps"): a bullish gap is where the
    low of bar i sits above the high of bar i-2, leaving a price range the
    middle candle never traded through; a bearish gap mirrors this below. The
    gap is "filled" once price later trades back through the whole range.
    """
    n = len(df)
    if n < 10:
        return []
    h, l = df["High"].to_numpy(), df["Low"].to_numpy()
    a = atr(df, 14).to_numpy()

    gaps: list[dict[str, Any]] = []
    for i in range(2, n):
        disp = a[i] if np.isfinite(a[i]) and a[i] > 0 else None
        if disp is None:
            continue
        if l[i] > h[i - 2] and (l[i] - h[i - 2]) >= min_gap_atr * disp:
            gaps.append({"type": "bullish", "start": i - 2, "end": i, "high": float(l[i]), "low": float(h[i - 2]), "filled": None})
        if h[i] < l[i - 2] and (l[i - 2] - h[i]) >= min_gap_atr * disp:
            gaps.append({"type": "bearish", "start": i - 2, "end": i, "high": float(l[i - 2]), "low": float(h[i]), "filled": None})

    for g in gaps:
        for k in range(g["end"] + 1, n):
            if l[k] <= g["high"] and h[k] >= g["low"]:
                g["filled"] = k
                break

    bullish = [g for g in gaps if g["type"] == "bullish"][-max_each:]
    bearish = [g for g in gaps if g["type"] == "bearish"][-max_each:]
    return sorted(bullish + bearish, key=lambda g: g["start"])


def liquidity_sweeps(df: pd.DataFrame, window: int = 5, max_each: int = 8) -> list[dict[str, Any]]:
    """Stop-hunt reversals: a bar wicks beyond the most recent swing high or
    low (through resting liquidity) and closes back on the other side. A
    sweep above a swing high is bearish (buy-side liquidity taken before a
    drop); a sweep below a swing low is bullish.
    """
    n = len(df)
    if n < window * 2 + 10:
        return []
    h, l, c = (df[col].to_numpy() for col in ("High", "Low", "Close"))

    swing_high = np.full(n, np.nan)
    swing_low = np.full(n, np.nan)
    for i in range(window, n - window):
        if h[i] == h[i - window : i + window + 1].max():
            swing_high[i] = h[i]
        if l[i] == l[i - window : i + window + 1].min():
            swing_low[i] = l[i]

    sweeps: list[dict[str, Any]] = []
    last_high: float | None = None
    last_high_idx = used_high_idx = -1
    last_low: float | None = None
    last_low_idx = used_low_idx = -1

    for i in range(n):
        if not np.isnan(swing_high[i]):
            last_high, last_high_idx = float(swing_high[i]), i
        if not np.isnan(swing_low[i]):
            last_low, last_low_idx = float(swing_low[i]), i

        if last_high is not None and h[i] > last_high and c[i] < last_high and last_high_idx != used_high_idx:
            sweeps.append({"type": "bearish", "at": i, "level": last_high, "wick": float(h[i])})
            used_high_idx = last_high_idx
        if last_low is not None and l[i] < last_low and c[i] > last_low and last_low_idx != used_low_idx:
            sweeps.append({"type": "bullish", "at": i, "level": last_low, "wick": float(l[i])})
            used_low_idx = last_low_idx

    bullish = [s for s in sweeps if s["type"] == "bullish"][-max_each:]
    bearish = [s for s in sweeps if s["type"] == "bearish"][-max_each:]
    return sorted(bullish + bearish, key=lambda s: s["at"])


def macd_crossovers(hist: pd.Series) -> pd.Series:
    """+1 where MACD crosses above its signal line, -1 where it crosses below."""
    prev = hist.shift(1)
    out = pd.Series(0, index=hist.index, dtype=int)
    out[(prev <= 0) & (hist > 0)] = 1
    out[(prev >= 0) & (hist < 0)] = -1
    return out
