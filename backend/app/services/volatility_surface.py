"""
Implied volatility surface read from NSE's option chains.

NSE publishes an implied volatility for every traded option. This module takes the next
few expiries of a symbol, reads each strike's volatility from its out-of-the-money option
(the liquid side) and arranges them by strike and expiry. Nothing is modelled: a strike
with no quoted volatility is blank, and the skew measures are interpolated between quoted
strikes.

``build`` takes fetched chains as arguments and is tested offline.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Any, Callable

from ..cache import CACHE

MAX_EXPIRIES = 4
MONEYNESS_BAND = 0.10   # strikes within 10% of spot
MAX_ROWS = 25
Z_25_DELTA = 0.674      # |d1| at a 25-delta option, ignoring rates and the drift term


class VolSurfaceUnavailable(Exception):
    """No expiry of the symbol has a usable option chain."""


def _otm_iv(row: dict[str, Any], spot: float) -> float | None:
    first, second = ("ce", "pe") if row["strike"] >= spot else ("pe", "ce")
    iv = (row.get(first) or {}).get("iv") or (row.get(second) or {}).get("iv")
    return float(iv) if isinstance(iv, (int, float)) and iv > 0 else None


def atm_iv(rows: list[dict[str, Any]], spot: float) -> tuple[float, float] | None:
    """(strike, IV) at the strike nearest spot: the mean of the call's and the put's where both are quoted."""
    quoted = [r for r in rows if (r.get("ce") or {}).get("iv") or (r.get("pe") or {}).get("iv")]
    if not quoted:
        return None
    row = min(quoted, key=lambda r: abs(r["strike"] - spot))
    ivs = [leg["iv"] for leg in (row.get("ce"), row.get("pe")) if leg and leg.get("iv")]
    return row["strike"], sum(ivs) / len(ivs)


def iv_at(points: list[tuple[float, float]], strike: float) -> float | None:
    """Linear interpolation between the two quoted strikes around `strike`; None outside them."""
    below = [p for p in points if p[0] <= strike]
    above = [p for p in points if p[0] >= strike]
    if not below or not above:
        return None
    (k0, v0), (k1, v1) = below[-1], above[0]
    return v0 if k1 == k0 else v0 + (v1 - v0) * (strike - k0) / (k1 - k0)


def _label(expiry: date, today: date) -> str:
    return f"{expiry.strftime('%d %b')} ({(expiry - today).days}d)"


def build(symbol: str, chains: list[dict[str, Any]], today: date | None = None) -> dict[str, Any]:
    """``chains`` are nse_options.chain payloads, nearest expiry first."""
    today = today or date.today()
    usable = []
    for chain in chains:
        spot = chain.get("underlying")
        rows = chain.get("rows") or []
        expiry = date.fromisoformat(chain["expiry"])
        days = (expiry - today).days
        centre = atm_iv(rows, spot) if spot else None
        if not centre or days < 0:
            continue
        usable.append({"expiry": expiry, "days": days, "spot": float(spot), "rows": rows, "atm": centre, "label": _label(expiry, today),
                       "timestamp": chain.get("timestamp")})
    if not usable:
        raise VolSurfaceUnavailable(f"No option chain with quoted implied volatility for {symbol.upper()}")

    near = usable[0]
    spot = near["spot"]
    term = [
        {"label": u["label"], "daysToExpiry": u["days"], "expiryDate": u["expiry"].isoformat(), "atmIv": round(u["atm"][1], 2)}
        for u in usable
    ]

    # strike grid from the near expiry, thinned evenly if the chain is dense
    near_points = [(r["strike"], _otm_iv(r, spot)) for r in near["rows"]]
    near_points = [(k, v) for k, v in near_points if v is not None and abs(k / spot - 1.0) <= MONEYNESS_BAND]
    if not near_points:
        raise VolSurfaceUnavailable(f"No strikes near the money carry a volatility for {symbol.upper()}")
    step = max(1, math.ceil(len(near_points) / MAX_ROWS))
    atm_strike = near["atm"][0]
    grid = sorted({k for i, (k, _) in enumerate(near_points) if i % step == 0} | {atm_strike})

    by_expiry = [{r["strike"]: _otm_iv(r, u["spot"]) for r in u["rows"]} for u in usable]
    surface = []
    for strike in grid:
        row: dict[str, Any] = {"strike": strike, "moneynessPct": round((strike / spot - 1.0) * 100.0, 1), "isAtm": strike == atm_strike}
        for u, ivs in zip(usable, by_expiry):
            iv = ivs.get(strike)
            row[u["label"]] = round(iv, 2) if iv is not None else None
        surface.append(row)
    near_smile = [{"strike": k, "moneynessPct": round((k / spot - 1.0) * 100.0, 1), "iv": round(v, 2)} for k, v in near_points]

    # 25-delta strikes sit about 0.674 standard deviations either side of spot
    sigma, t = near["atm"][1] / 100.0, max(near["days"], 1) / 365.0
    width = Z_25_DELTA * sigma * math.sqrt(t)
    put_strike, call_strike = spot * math.exp(-width), spot * math.exp(width)
    all_points = [(r["strike"], _otm_iv(r, spot)) for r in near["rows"]]
    all_points = [(k, v) for k, v in all_points if v is not None]
    put_iv, call_iv = iv_at(all_points, put_strike), iv_at(all_points, call_strike)
    risk_reversal = round(put_iv - call_iv, 2) if put_iv is not None and call_iv is not None else None
    butterfly = round((put_iv + call_iv) / 2.0 - near["atm"][1], 2) if risk_reversal is not None else None

    upward = len(term) > 1 and term[-1]["atmIv"] > term[0]["atmIv"]
    if len(term) < 2:
        regime = "Only one expiry has quoted volatility"
    else:
        regime = (
            f"Rising with maturity: {term[0]['atmIv']}% near, {term[-1]['atmIv']}% far"
            if upward
            else f"Falling with maturity: {term[0]['atmIv']}% near, {term[-1]['atmIv']}% far"
        )
    if risk_reversal is None:
        skew_text = "The chain has no quoted volatility at the 25-delta strikes, so skew is not computed."
    else:
        side = "puts" if risk_reversal > 0 else "calls"
        skew_text = (
            f"Out-of-the-money {side} are priced {abs(risk_reversal):.2f} volatility points above the other side "
            f"(strikes near {put_strike:,.0f} and {call_strike:,.0f}, about 25 delta)."
        )

    return {
        "symbol": symbol.upper(),
        "spotPrice": round(spot, 2),
        "asOf": near["timestamp"] or datetime.now().isoformat(timespec="seconds"),
        "skewSummary": {
            "nearAtmIv": round(near["atm"][1], 2),
            "riskReversal25D": risk_reversal,
            "butterfly25D": butterfly,
            "termStructureRegime": regime,
            "isContango": upward,
            "skewInterpretation": skew_text,
        },
        "termStructure": term,
        "surface": surface,
        "nearSmile": near_smile,
        "method": (
            "Implied volatilities as published by NSE for each option. Each strike uses its out-of-the-money option. "
            "25-delta strikes are approximated at 0.674 standard deviations from spot and interpolated between quoted strikes."
        ),
    }


def fetch(symbol: str, expiries_fn: Callable[[str], list[str]] | None = None, chain_fn: Callable[[str, str], dict] | None = None) -> dict[str, Any]:
    from ..providers import nse_options

    expiries_fn = expiries_fn or nse_options.expiries
    chain_fn = chain_fn or nse_options.chain
    sym = symbol.upper()
    today = date.today()
    upcoming = [e for e in expiries_fn(sym) if e >= today.isoformat()][:MAX_EXPIRIES]
    if not upcoming:
        raise VolSurfaceUnavailable(f"{sym} has no listed option expiries")
    chains = []
    for expiry in upcoming:
        try:
            chains.append(chain_fn(sym, expiry))
        except Exception:
            continue  # a missing expiry leaves a shorter surface
    return build(sym, chains, today)


def get_volatility_surface(symbol: str = "NIFTY") -> dict[str, Any]:
    sym = symbol.upper()
    return CACHE.get_or_fetch(f"derivatives:vol-surface:v2:{sym}", 300, lambda: fetch(sym))[0]
