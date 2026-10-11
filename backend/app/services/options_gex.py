"""Option greeks, gamma exposure (GEX), open interest and 0DTE from listed option chains.

Chains come from Yahoo for SPY and QQQ. NQ and MNQ futures options and ES options are not on the free feed,
so the Nasdaq-100 and S&P 500 ETFs stand in, with levels scaled to the futures price by the live ratio.
Greeks are Black-Scholes from each contract's own implied volatility.

GEX needs an assumption about who holds the contracts. The common convention (SqueezeMetrics) used here is that
customers overwrite calls and buy puts, so dealers are long calls and short puts: call gamma counts positive and
put gamma negative in dealer GEX. It is a model of positioning, not a measurement.
"""

from __future__ import annotations

import math
from datetime import date, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import yfinance as yf

from .technicals import _f

ET = ZoneInfo("America/New_York")
RISK_FREE = 0.04
PROXY = {"SPY": "SPY", "QQQ": "QQQ", "ES": "SPY", "MES": "SPY", "NQ": "QQQ", "MNQ": "QQQ", "NNQ": "QQQ"}
FUTURES_FOR = {"ES", "MES", "NQ", "MNQ", "NNQ"}
MAX_EXPIRIES = 6
MAX_DAYS = 45

_erf = np.frompyfunc(math.erf, 1, 1)


def _ndtr(x: np.ndarray) -> np.ndarray:
    return 0.5 * (1.0 + _erf(x / math.sqrt(2.0)).astype(float))


def _pdf(x: np.ndarray) -> np.ndarray:
    return np.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def greeks(spot: float | np.ndarray, strike: np.ndarray, t: np.ndarray, iv: np.ndarray, is_call: np.ndarray, r: float = RISK_FREE) -> dict[str, np.ndarray]:
    """Black-Scholes delta, gamma, theta (per calendar day) and vega (per vol point)."""
    spot = np.asarray(spot, dtype=float)
    sq = np.sqrt(t)
    d1 = (np.log(spot / strike) + (r + 0.5 * iv * iv) * t) / (iv * sq)
    d2 = d1 - iv * sq
    pdf1 = _pdf(d1)
    delta = np.where(is_call, _ndtr(d1), _ndtr(d1) - 1.0)
    gamma = pdf1 / (spot * iv * sq)
    decay = -(spot * pdf1 * iv) / (2.0 * sq)
    theta_call = decay - r * strike * np.exp(-r * t) * _ndtr(d2)
    theta_put = decay + r * strike * np.exp(-r * t) * _ndtr(-d2)
    theta = np.where(is_call, theta_call, theta_put) / 365.0
    vega = spot * pdf1 * sq / 100.0
    return {"delta": delta, "gamma": gamma, "theta": theta, "vega": vega}


def _years_to_expiry(expiry: date, now: datetime) -> float:
    close = datetime.combine(expiry, time(16, 0), tzinfo=ET)
    seconds = max((close - now).total_seconds(), 15 * 60)
    return seconds / (365.0 * 24 * 3600)


def _load_chain(etf: str) -> tuple[float, pd.DataFrame, list[str]]:
    tk = yf.Ticker(etf)
    hist = tk.history(period="5d", interval="1d", auto_adjust=False)
    if hist.empty:
        raise ValueError(f"No price for {etf}")
    spot = float(hist["Close"].iloc[-1])
    now = datetime.now(ET)
    frames, skipped = [], []
    for exp in tk.options:
        d = date.fromisoformat(exp)
        if (d - now.date()).days > MAX_DAYS or len(frames) >= MAX_EXPIRIES:
            break
        chain = tk.option_chain(exp)
        for side, df in (("C", chain.calls), ("P", chain.puts)):
            cols = df[["strike", "openInterest", "impliedVolatility", "volume"]].copy()
            cols["side"], cols["expiry"] = side, d
            frames.append(cols)
        skipped.append(exp)
    if not frames:
        raise ValueError(f"No option chain for {etf}")
    return spot, pd.concat(frames, ignore_index=True), skipped


def _gamma_flip(rows: pd.DataFrame, spot: float) -> float | None:
    """Spot level where dealer net gamma changes sign, found by repricing at a grid of spots."""
    grid = spot * np.linspace(0.90, 1.10, 81)
    k, t, iv = rows["strike"].to_numpy(float), rows["t"].to_numpy(float), rows["iv"].to_numpy(float)
    sign = np.where(rows["side"].to_numpy() == "C", 1.0, -1.0)  # dealer sign: long calls, short puts
    oi = rows["oi"].to_numpy(float)
    totals = []
    for s in grid:
        g = greeks(s, k, t, iv, rows["side"].to_numpy() == "C")["gamma"]
        totals.append(float(np.sum(sign * g * oi * 100.0 * s * s * 0.01)))
    totals_a = np.array(totals)
    for i in range(len(grid) - 1):
        if totals_a[i] == 0 or totals_a[i] * totals_a[i + 1] < 0:
            frac = totals_a[i] / (totals_a[i] - totals_a[i + 1]) if totals_a[i] != totals_a[i + 1] else 0.0
            return float(grid[i] + frac * (grid[i + 1] - grid[i]))
    return None


def _max_pain(rows: pd.DataFrame) -> float | None:
    strikes = np.sort(rows["strike"].unique())
    if len(strikes) == 0:
        return None
    calls = rows[rows["side"] == "C"]
    puts = rows[rows["side"] == "P"]
    best, best_pay = None, None
    for s in strikes:
        pay = float(((s - calls["strike"]).clip(lower=0) * calls["oi"]).sum() + ((puts["strike"] - s).clip(lower=0) * puts["oi"]).sum())
        if best_pay is None or pay < best_pay:
            best, best_pay = float(s), pay
    return best


def build(symbol: str, futures_last: float | None = None) -> dict[str, Any]:
    sym = symbol.upper()
    if sym not in PROXY:
        raise ValueError(f"Options analytics are available for {sorted(PROXY)}")
    etf = PROXY[sym]
    spot, raw, expiries = _load_chain(etf)
    now = datetime.now(ET)

    raw = raw.rename(columns={"openInterest": "oi", "impliedVolatility": "iv"})
    raw["oi"] = raw["oi"].fillna(0)
    raw = raw[(raw["oi"] > 0) & (raw["iv"] > 0.01) & (raw["iv"] < 5.0)]
    raw = raw[(raw["strike"] > spot * 0.85) & (raw["strike"] < spot * 1.15)].copy()
    if raw.empty:
        raise ValueError(
            f"{etf} option chain has no open interest with a usable implied volatility right now. "
            "Yahoo often returns blank open interest outside market hours; try again in the session."
        )
    raw["t"] = raw["expiry"].map(lambda d: _years_to_expiry(d, now))
    is_call = (raw["side"] == "C").to_numpy()
    g = greeks(spot, raw["strike"].to_numpy(float), raw["t"].to_numpy(float), raw["iv"].to_numpy(float), is_call)
    mult = raw["oi"].to_numpy(float) * 100.0
    dealer = np.where(is_call, 1.0, -1.0)
    raw["gex"] = dealer * g["gamma"] * mult * spot * spot * 0.01
    raw["dex"] = g["delta"] * mult * spot
    raw["tex"] = g["theta"] * mult
    raw["vex"] = g["vega"] * mult
    today = now.date()
    raw["zero"] = raw["expiry"] == today

    by = raw.groupby("strike")
    strikes = []
    for strike, grp in by:
        calls, puts = grp[grp["side"] == "C"], grp[grp["side"] == "P"]
        strikes.append(
            {
                "strike": _f(strike),
                "callOi": int(calls["oi"].sum()),
                "putOi": int(puts["oi"].sum()),
                "gex": _f(grp["gex"].sum() / 1e6, 2),
                "callGex": _f(calls["gex"].sum() / 1e6, 2),
                "putGex": _f(puts["gex"].sum() / 1e6, 2),
                "dex": _f(grp["dex"].sum() / 1e6, 2),
                "tex": _f(grp["tex"].sum(), 0),
            }
        )
    near = [s for s in strikes if spot * 0.90 <= s["strike"] <= spot * 1.10]
    above = [s for s in strikes if s["strike"] >= spot]
    below = [s for s in strikes if s["strike"] <= spot]
    call_wall = max(above, key=lambda s: s["callOi"], default=None)
    put_wall = max(below, key=lambda s: s["putOi"], default=None)
    flip = _gamma_flip(raw, spot)

    nearest = min(raw["expiry"])
    pain = _max_pain(raw[raw["expiry"] == nearest])
    total_gex = float(raw["gex"].sum())
    zero_rows = raw[raw["zero"]]
    total_oi = float(raw["oi"].sum())
    ratio = (futures_last / spot) if (sym in FUTURES_FOR and futures_last) else None

    def scale(x: float | None) -> float | None:
        return _f(x * ratio) if (x is not None and ratio) else None

    return {
        "symbol": sym,
        "underlying": etf,
        "spot": _f(spot),
        "asOf": now.isoformat(timespec="seconds"),
        "expiries": [str(e) for e in sorted(raw["expiry"].unique())],
        "nearestExpiry": str(nearest),
        "proxy": {"etf": etf, "futures": sym if ratio else None, "ratio": _f(ratio, 4) if ratio else None},
        "totals": {
            "gexMillions": _f(total_gex / 1e6, 1),
            "callOi": int(raw[raw["side"] == "C"]["oi"].sum()),
            "putOi": int(raw[raw["side"] == "P"]["oi"].sum()),
            "putCallOi": _f(raw[raw["side"] == "P"]["oi"].sum() / max(raw[raw["side"] == "C"]["oi"].sum(), 1), 2),
            "dexMillions": _f(raw["dex"].sum() / 1e6, 1),
            "thetaPerDay": _f(raw["tex"].sum(), 0),
            "vegaPerPoint": _f(raw["vex"].sum(), 0),
        },
        "regime": "positive" if total_gex > 0 else "negative",
        "levels": {
            "gammaFlip": _f(flip),
            "callWall": call_wall["strike"] if call_wall else None,
            "putWall": put_wall["strike"] if put_wall else None,
            "maxPain": _f(pain),
            "scaled": {"gammaFlip": scale(flip), "callWall": scale(call_wall["strike"]) if call_wall else None, "putWall": scale(put_wall["strike"]) if put_wall else None, "maxPain": scale(pain), "spot": scale(spot)},
        },
        "zeroDte": (
            {
                "expiry": str(today),
                "oiShare": _f(float(zero_rows["oi"].sum()) / total_oi, 3),
                "gexMillions": _f(float(zero_rows["gex"].sum()) / 1e6, 1),
                "gexShare": _f(float(zero_rows["gex"].abs().sum()) / max(float(raw["gex"].abs().sum()), 1.0), 3),
            }
            if not zero_rows.empty
            else None
        ),
        "strikes": near,
        "assumption": "Dealer positioning is modelled: customers are assumed to overwrite calls and buy puts, so dealers are long calls and short puts. Greeks are Black-Scholes from each contract's implied volatility. Open interest is end-of-day.",
    }
