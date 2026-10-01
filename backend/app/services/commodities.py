"""Commodity tracker: metals, energy and agricultural futures.

One batch download of a year of daily bars backs the whole table. Prices are
front-month futures in US dollars (COMEX / NYMEX / CBOT / ICE), delayed, and are
not MCX prices; the rupee equivalents for gold and silver are indicative
conversions that exclude import duty, GST and local premiums.
"""

from __future__ import annotations

import math
import warnings
from typing import Any

import pandas as pd
import yfinance as yf

from .insights import commodity_insights

warnings.filterwarnings("ignore")

# id, symbol, name, unit, group, what moves it (for an Indian reader)
COMMODITIES: list[tuple[str, str, str, str, str, str]] = [
    ("gold", "GC=F", "Gold", "$/oz", "Precious metals", "Safe-haven demand, real yields, rupee; central-bank buying"),
    ("silver", "SI=F", "Silver", "$/oz", "Precious metals", "Part monetary, part industrial (solar, electronics)"),
    ("platinum", "PL=F", "Platinum", "$/oz", "Precious metals", "Auto catalysts, hydrogen, jewellery"),
    ("palladium", "PA=F", "Palladium", "$/oz", "Precious metals", "Petrol-car catalysts"),
    ("copper", "HG=F", "Copper", "$/lb", "Base metals", "Global capex, power grids, EVs; a growth bellwether"),
    ("aluminium", "ALI=F", "Aluminium", "$/t", "Base metals", "Autos, aerospace, packaging, power lines"),
    ("zinc", "ZNC=F", "Zinc", "$/t", "Base metals", "Steel galvanising, infrastructure"),
    ("brent", "BZ=F", "Brent crude", "$/bbl", "Energy", "India's import benchmark: inflation, current account, OMCs"),
    ("wti", "CL=F", "WTI crude", "$/bbl", "Energy", "US benchmark; drives refining spreads"),
    ("natgas", "NG=F", "Natural gas", "$/MMBtu", "Energy", "Fertiliser, power and city-gas inputs"),
    ("heating-oil", "HO=F", "Heating oil", "$/gal", "Energy", "Diesel proxy"),
    ("gasoline", "RB=F", "Gasoline", "$/gal", "Energy", "Petrol proxy"),
    ("wheat", "ZW=F", "Wheat", "¢/bu", "Agriculture", "Food inflation, export policy"),
    ("corn", "ZC=F", "Corn", "¢/bu", "Agriculture", "Ethanol blending, feed costs"),
    ("soybean", "ZS=F", "Soybeans", "¢/bu", "Agriculture", "Edible-oil and feed costs"),
    ("cotton", "CT=F", "Cotton", "¢/lb", "Agriculture", "Textile input costs"),
    ("sugar", "SB=F", "Sugar", "¢/lb", "Agriculture", "Sugar-mill margins, ethanol"),
    ("coffee", "KC=F", "Coffee", "¢/lb", "Agriculture", "Plantation and export earnings"),
    ("cocoa", "CC=F", "Cocoa", "$/t", "Agriculture", "Confectionery input costs"),
]
FX_SYMBOL = "USDINR=X"
TROY_OZ_G = 31.1034768

HORIZONS = {"1W": 5, "1M": 21, "3M": 63, "1Y": 252}


def _f(v: Any, nd: int = 2) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(x) or math.isinf(x) else round(x, nd)


def _change(close: pd.Series, bars: int) -> float | None:
    if len(close) <= bars:
        if bars < 252 or len(close) < 200:
            return None
        bars = len(close) - 1  # a "1Y" window that Yahoo serves as 251 bars is still one year
    base = float(close.iloc[-1 - bars])
    return _f((float(close.iloc[-1]) / base - 1) * 100) if base else None


def fetch() -> dict[str, Any]:
    symbols = [c[1] for c in COMMODITIES] + [FX_SYMBOL]
    raw = yf.download(
        symbols, period="1y", interval="1d", group_by="ticker", auto_adjust=False, threads=True, progress=False
    )
    if raw is None or raw.empty:
        raise RuntimeError("no commodity data returned")

    def closes(sym: str) -> pd.Series:
        try:
            return raw[sym]["Close"].dropna()
        except KeyError:
            return pd.Series(dtype=float)

    fx = closes(FX_SYMBOL)
    usdinr = _f(fx.iloc[-1]) if len(fx) else None

    rows: list[dict[str, Any]] = []
    for cid, sym, name, unit, group, driver in COMMODITIES:
        c = closes(sym)
        if len(c) < 5:
            continue
        last = float(c.iloc[-1])
        hi, lo = float(c.max()), float(c.min())
        step = max(1, len(c) // 60)
        rows.append(
            {
                "id": cid,
                "symbol": sym,
                "name": name,
                "unit": unit,
                "group": group,
                "driver": driver,
                "price": _f(last, 4 if last < 10 else 2),
                "change": {"1D": _change(c, 1), **{k: _change(c, n) for k, n in HORIZONS.items()}},
                "high52w": _f(hi),
                "low52w": _f(lo),
                "rangePosition": _f((last - lo) / (hi - lo)) if hi > lo else None,
                "spark": [_f(v, 4) for v in c.iloc[::step].to_numpy()][-60:],
                "asOf": c.index[-1].strftime("%Y-%m-%d"),
            }
        )

    inr: dict[str, Any] = {}
    by_id = {r["id"]: r for r in rows}
    if usdinr:
        if "gold" in by_id:
            inr["goldPer10g"] = _f(by_id["gold"]["price"] * usdinr / TROY_OZ_G * 10, 0)
        if "silver" in by_id:
            inr["silverPerKg"] = _f(by_id["silver"]["price"] * usdinr / TROY_OZ_G * 1000, 0)
    insights = None
    try:
        insights = commodity_insights({c[1]: closes(c[1]) for c in COMMODITIES}, rows, fx)
    except Exception:
        insights = None
    return {"rows": rows, "usdinr": usdinr, "indicativeInr": inr, "insights": insights}
