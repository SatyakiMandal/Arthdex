"""Order-flow analytics modelled from OHLCV bars.

The free feed carries open, high, low, close and volume, but no trade-by-trade
tape and no order book. Everything here that needs aggressor side is therefore
an *estimate*: each bar's volume is split into buying and selling by where the
close sits in the bar's range (a close at the high is all buying, at the low
all selling). Volume profile, value area and the absorption and big-volume
screens are exact functions of the bars; delta, CVD, footprint and imbalances
are modelled. A resting-liquidity heatmap needs a depth feed and is not
produced.
"""

from __future__ import annotations

import math
import re
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

from . import indicators as ind
from .technicals import _f, clean_frame

# interval id -> (yfinance period, yfinance interval, bars returned, intraday?)
INTERVALS: dict[str, tuple[str, str, int, bool]] = {
    "1m": ("5d", "1m", 600, True),
    "5m": ("30d", "5m", 500, True),
    "15m": ("60d", "15m", 500, True),
    "1h": ("6mo", "60m", 400, True),
    "1d": ("2y", "1d", 400, False),
}
INTERVAL_LABELS = {"1m": "1 minute", "5m": "5 minute", "15m": "15 minute", "1h": "1 hour", "1d": "Daily"}

FUTURES = {"NQ", "MNQ", "NNQ", "ES", "MES"}
US_ETFS = {"SPY", "QQQ"}
NSE_SYMBOL = re.compile(r"^[A-Z0-9&_-]{1,20}$")

METHOD = (
    "Buy and sell volume are estimated from each bar: buy = volume x (close - low) / (high - low), "
    "sell = the rest. Footprint cells spread each bar's buy volume towards its high and sell volume towards "
    "its low. These are models, not exchange tape, so treat delta, CVD, footprint and imbalances as "
    "indications. Volume profile, absorption and large-volume bars are exact functions of the bars."
)
HEATMAP_NOTE = (
    "A resting-liquidity heatmap needs Level 2 order-book depth over time. The free data service has no depth "
    "feed, so nothing is drawn rather than inventing it."
)


def yahoo_symbol(symbol: str, market: str) -> str:
    sym = symbol.upper()
    if market == "futures":
        if sym not in FUTURES:
            raise ValueError(f"Futures symbol must be one of {sorted(FUTURES)}")
        return f"{sym}=F"
    if market == "us":
        if sym not in US_ETFS:
            raise ValueError(f"US symbol must be one of {sorted(US_ETFS)}")
        return sym
    if not NSE_SYMBOL.match(sym):
        raise ValueError("Invalid NSE symbol")
    return f"{sym}.NS"


def fetch_bars(symbol: str, market: str, interval: str) -> pd.DataFrame:
    period, yf_interval, _n, _intra = INTERVALS[interval]
    frame = yf.Ticker(yahoo_symbol(symbol, market)).history(period=period, interval=yf_interval, auto_adjust=False)
    return clean_frame(frame)


# -- estimated delta -------------------------------------------------------------


def split_volume(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Per-bar estimated (buy, sell) volume from the close's position in the range."""
    h, l, c = df["High"].to_numpy(float), df["Low"].to_numpy(float), df["Close"].to_numpy(float)
    v = df["Volume"].fillna(0).to_numpy(float)
    rng = h - l
    loc = np.where(rng > 0, (c - l) / np.where(rng > 0, rng, 1.0), 0.5)
    loc = np.clip(loc, 0.0, 1.0)
    return v * loc, v * (1.0 - loc)


# -- volume / delta profile -------------------------------------------------------


def _spread(lo: float, hi: float, edges: np.ndarray) -> np.ndarray:
    """Fraction of the [lo, hi] range falling in each bin (a flat bar sits in one bin)."""
    n = len(edges) - 1
    out = np.zeros(n)
    if hi <= lo:
        k = int(np.clip(np.searchsorted(edges, lo, side="right") - 1, 0, n - 1))
        out[k] = 1.0
        return out
    overlap = np.clip(np.minimum(edges[1:], hi) - np.maximum(edges[:-1], lo), 0.0, None)
    total = overlap.sum()
    return overlap / total if total > 0 else out


def volume_profile(df: pd.DataFrame, buy: np.ndarray, sell: np.ndarray, nbins: int = 48, value_area: float = 0.70) -> dict[str, Any]:
    lo, hi = float(df["Low"].min()), float(df["High"].max())
    if hi <= lo:
        hi = lo + max(lo * 0.001, 0.01)
    edges = np.linspace(lo, hi, nbins + 1)
    vol, b, s = np.zeros(nbins), np.zeros(nbins), np.zeros(nbins)
    for i, (bl, bh) in enumerate(zip(df["Low"].to_numpy(float), df["High"].to_numpy(float))):
        w = _spread(bl, bh, edges)
        vol += w * (buy[i] + sell[i])
        b += w * buy[i]
        s += w * sell[i]
    total = float(vol.sum())
    poc = int(vol.argmax())
    # value area: grow from the point of control, always taking the heavier neighbouring bin
    lo_i = hi_i = poc
    covered = vol[poc]
    while total > 0 and covered < value_area * total and (lo_i > 0 or hi_i < nbins - 1):
        down = vol[lo_i - 1] if lo_i > 0 else -1.0
        up = vol[hi_i + 1] if hi_i < nbins - 1 else -1.0
        if up >= down:
            hi_i += 1
            covered += vol[hi_i]
        else:
            lo_i -= 1
            covered += vol[lo_i]
    mids = (edges[:-1] + edges[1:]) / 2
    return {
        "bins": [
            {"lo": _f(edges[k]), "hi": _f(edges[k + 1]), "mid": _f(mids[k]), "v": int(vol[k]), "buy": int(b[k]), "sell": int(s[k]), "delta": int(b[k] - s[k])}
            for k in range(nbins)
        ],
        "poc": _f(mids[poc]),
        "vah": _f(edges[hi_i + 1]),
        "val": _f(edges[lo_i]),
        "total": int(total),
        "valueAreaPct": value_area,
    }


# -- footprint & imbalances -------------------------------------------------------


def _nice_step(x: float) -> float:
    if not np.isfinite(x) or x <= 0:
        return 0.01
    mag = 10 ** math.floor(math.log10(x))
    for m in (1, 2, 2.5, 5, 10):
        if m * mag >= x:
            return m * mag
    return 10 * mag


def footprint(df: pd.DataFrame, buy: np.ndarray, sell: np.ndarray, n_bars: int, stamp, imbalance_ratio: float = 3.0, min_volume: float = 0.0):
    """Modelled bid/ask per price row for the last `n_bars`, with diagonal imbalances."""
    tail = df.iloc[-n_bars:]
    off = len(df) - len(tail)
    atr_v = float(ind.atr(df, 14).iloc[-1])
    span = float(tail["High"].max() - tail["Low"].min())
    step = _nice_step(max(atr_v / 3.0, span / 40.0) if np.isfinite(atr_v) and atr_v > 0 else span / 30.0)
    base = math.floor(float(tail["Low"].min()) / step) * step
    top = math.ceil(float(tail["High"].max()) / step) * step
    nlev = max(int(round((top - base) / step)), 1)
    edges = base + step * np.arange(nlev + 1)

    out_bars, imbalances = [], []
    for j, (ts, r) in enumerate(zip(tail.index, tail.itertuples())):
        k = off + j
        w = _spread(float(r.Low), float(r.High), edges)
        rngp = float(r.High) - float(r.Low)
        centres = (edges[:-1] + edges[1:]) / 2
        pos = np.clip((centres - float(r.Low)) / rngp, 0.0, 1.0) if rngp > 0 else np.full(nlev, 0.5)
        bw, sw = w * (1 + 0.6 * (2 * pos - 1)), w * (1 - 0.6 * (2 * pos - 1))
        bw = bw / bw.sum() if bw.sum() > 0 else bw
        sw = sw / sw.sum() if sw.sum() > 0 else sw
        ask, bid = bw * buy[k], sw * sell[k]
        levels = []
        for q in range(nlev):
            if ask[q] + bid[q] <= 0:
                continue
            levels.append({"p": _f(centres[q], 4), "buy": int(round(ask[q])), "sell": int(round(bid[q])), "bImb": False, "sImb": False})
        by_q = {i2: lv for i2, lv in zip([q for q in range(nlev) if ask[q] + bid[q] > 0], levels)}
        for q, lv in by_q.items():
            below, above = by_q.get(q - 1), by_q.get(q + 1)
            if below and below["sell"] > 0 and lv["buy"] >= imbalance_ratio * below["sell"] and lv["buy"] > min_volume:
                lv["bImb"] = True
                imbalances.append({"i": j, "t": stamp(ts), "price": lv["p"], "side": "buy", "ratio": _f(lv["buy"] / below["sell"], 1)})
            if above and above["buy"] > 0 and lv["sell"] >= imbalance_ratio * above["buy"] and lv["sell"] > min_volume:
                lv["sImb"] = True
                imbalances.append({"i": j, "t": stamp(ts), "price": lv["p"], "side": "sell", "ratio": _f(lv["sell"] / above["buy"], 1)})
        if levels:
            poc_lv = max(levels, key=lambda lv: lv["buy"] + lv["sell"])
            poc_p = poc_lv["p"]
        else:
            poc_p = None
        out_bars.append(
            {
                "i": j,
                "t": stamp(ts),
                "o": _f(r.Open),
                "h": _f(r.High),
                "l": _f(r.Low),
                "c": _f(r.Close),
                "volume": int(buy[k] + sell[k]),
                "delta": int(buy[k] - sell[k]),
                "poc": poc_p,
                "levels": levels,
            }
        )
    return {"step": _f(step, 4), "bars": out_bars}, imbalances


# -- absorption & large-volume bars -----------------------------------------------


def absorption(df: pd.DataFrame, buy: np.ndarray, sell: np.ndarray, vol_mult: float = 1.5, range_atr: float = 0.8, lookback: int = 20, limit: int = 12) -> list[dict[str, Any]]:
    """Heavy volume that fails to move price: high effort, small result.

    Where it happens in the recent range gives the read: absorption near the
    lows is potential demand soaking up selling, near the highs potential supply.
    """
    n = len(df)
    if n < lookback + 5:
        return []
    h, l, c = df["High"].to_numpy(float), df["Low"].to_numpy(float), df["Close"].to_numpy(float)
    v = df["Volume"].fillna(0).to_numpy(float)
    a = ind.atr(df, 14).to_numpy(float)
    avg_v = pd.Series(v).rolling(lookback, min_periods=lookback).mean().shift(1).to_numpy()
    hi_n = pd.Series(h).rolling(lookback, min_periods=lookback).max().to_numpy()
    lo_n = pd.Series(l).rolling(lookback, min_periods=lookback).min().to_numpy()
    out = []
    for i in range(lookback, n):
        if not (np.isfinite(a[i]) and a[i] > 0 and np.isfinite(avg_v[i]) and avg_v[i] > 0):
            continue
        ratio = v[i] / avg_v[i]
        rng = h[i] - l[i]
        if ratio < vol_mult or rng > range_atr * a[i]:
            continue
        span = hi_n[i] - lo_n[i]
        loc = (c[i] - lo_n[i]) / span if span > 0 else 0.5
        if loc <= 0.35:
            kind = "bullish"
        elif loc >= 0.65:
            kind = "bearish"
        else:
            continue
        out.append(
            {
                "at": i,
                "type": kind,
                "volume": int(v[i]),
                "volRatio": _f(ratio, 2),
                "rangeAtr": _f(rng / a[i], 2),
                "location": _f(loc, 2),
                "delta": int(buy[i] - sell[i]),
                "price": _f(c[i]),
            }
        )
    return out[-limit:]


def big_volume_bars(df: pd.DataFrame, buy: np.ndarray, sell: np.ndarray, z_min: float = 2.5, window: int = 30, fwd: int = 3, limit: int = 12) -> list[dict[str, Any]]:
    """Bars whose volume is far above recent norm, with what price did next.

    Stands in for "big trades": without the tape, a single trade cannot be seen,
    only the bar it printed in.
    """
    n = len(df)
    v = df["Volume"].fillna(0).to_numpy(float)
    c = df["Close"].to_numpy(float)
    s = pd.Series(v)
    mean = s.rolling(window, min_periods=10).mean().shift(1).to_numpy()
    sd = s.rolling(window, min_periods=10).std(ddof=0).shift(1).to_numpy()
    out = []
    for i in range(n):
        if not (np.isfinite(mean[i]) and np.isfinite(sd[i]) and sd[i] > 0):
            continue
        z = (v[i] - mean[i]) / sd[i]
        if z < z_min:
            continue
        d = buy[i] - sell[i]
        after = (c[i + fwd] / c[i] - 1) * 100 if i + fwd < n and c[i] else None
        out.append(
            {
                "at": i,
                "volume": int(v[i]),
                "z": _f(z, 1),
                "delta": int(d),
                "bias": "buy" if d > 0 else "sell",
                "price": _f(c[i]),
                "fwdPct": _f(after, 2) if after is not None else None,
            }
        )
    return out[-limit:]


# -- assembly ---------------------------------------------------------------------


def build(symbol: str, market: str, interval: str, df: pd.DataFrame, fp_bars: int = 18) -> dict[str, Any]:
    _p, _y, n_bars, intraday = INTERVALS[interval]
    df = df.iloc[-n_bars:]
    if len(df) == 0:
        raise ValueError(f"No {INTERVAL_LABELS[interval].lower()} data found for {symbol.upper()}. Check the symbol; NSE indices have no volume and are not supported.")
    if len(df) < 40:
        raise ValueError(f"Only {len(df)} {INTERVAL_LABELS[interval].lower()} bars available; not enough for order-flow analysis.")
    if float(df["Volume"].fillna(0).sum()) <= 0:
        raise ValueError(f"{symbol} reports no traded volume (it is probably an index), so order flow cannot be computed.")

    buy, sell = split_volume(df)

    def stamp(ts: pd.Timestamp) -> str:
        return ts.isoformat() if intraday else ts.strftime("%Y-%m-%d")

    delta = buy - sell
    cvd = np.cumsum(delta)
    fp, imbalances = footprint(df, buy, sell, min(fp_bars, len(df)), stamp, min_volume=float(np.median(df["Volume"].fillna(0))) * 0.02)
    atr_v = float(ind.atr(df, 14).iloc[-1])

    bars = [
        {"t": stamp(ts), "o": _f(r.Open), "h": _f(r.High), "l": _f(r.Low), "c": _f(r.Close), "v": int(r.Volume) if pd.notna(r.Volume) else 0, "delta": int(delta[k])}
        for k, (ts, r) in enumerate(zip(df.index, df.itertuples()))
    ]
    return {
        "symbol": symbol.upper(),
        "market": market,
        "interval": interval,
        "intervalLabel": INTERVAL_LABELS[interval],
        "intraday": intraday,
        "asOf": stamp(df.index[-1]),
        "lastClose": _f(df["Close"].iloc[-1]),
        "atr": _f(atr_v) if np.isfinite(atr_v) else None,
        "estimated": True,
        "method": METHOD,
        "bars": bars,
        "cvd": [int(x) for x in cvd],
        "profile": volume_profile(df, buy, sell),
        "footprint": fp,
        "imbalances": imbalances[-40:],
        "absorption": absorption(df, buy, sell),
        "bigTrades": big_volume_bars(df, buy, sell),
        "heatmap": {"available": False, "reason": HEATMAP_NOTE},
    }
