"""
Option-chain analytics and futures-and-options build-up.

From one expiry's chain: put-call ratio, max pain, the at-the-money strike and implied
volatility, the move the straddle prices in, the strikes with the most open interest
(where writers are defending), and Black-Scholes Greeks per strike.

Each strike's Greeks use the implied volatility of its out-of-the-money option (calls
above spot, puts below), the standard way to read a smile: in-the-money options trade
thinly, and their last price can be hours old (NIFTY's 23,550 call showed 4.9% IV on
3 Nov 2026 against a VIX of 15.7). Prices use the bid-ask midpoint where quoted.

Vetting, with no second source for the chain itself:
  - the chain's underlying must match Arthdex's index level or vetted quote,
  - per-strike open interest must add up to NSE's own totals for the expiry,
  - at the money, call minus put must be close to spot minus the discounted strike
    (put-call parity), which catches stale or mismatched quotes.

Build-up classifies each F&O stock by the direction of price and open interest:
long build-up (price up, OI up), short build-up (down, up), short covering (up, down),
long unwinding (down, down).
"""

from __future__ import annotations

import math
from datetime import date
from typing import Any

RISK_FREE = 0.065  # the rate the site uses elsewhere (benchmark sensitivity)
# Parity gap allowed, as a share of the straddle's price: dividends, the futures basis and
# bid-ask width leave some gap, but a call priced below its put with spot above the strike
# (stale last trades, NIFTY 3 Nov 2026: 28% of the straddle) should fail
PARITY_TOLERANCE = 0.15
# A leg's IV this far from its strike's out-of-the-money IV is marked as a stale quote
STALE_IV_POINTS = 5.0


def _price(leg: dict[str, Any] | None) -> float | None:
    """The bid-ask midpoint where both sides are quoted, otherwise the last trade."""
    if not leg:
        return None
    bid, ask = leg.get("bid") or 0, leg.get("ask") or 0
    if bid > 0 and ask > 0 and ask >= bid:
        return (bid + ask) / 2
    return leg.get("ltp")


def _otm_iv(row: dict[str, Any], spot: float) -> float | None:
    """The strike's IV from its out-of-the-money option, which trades actively; the other leg if missing."""
    first, second = ("ce", "pe") if row["strike"] >= spot else ("pe", "ce")
    return (row[first] or {}).get("iv") or (row[second] or {}).get("iv")


def _ncdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _npdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)


def greeks(kind: str, spot: float, strike: float, years: float, iv_pct: float | None, r: float = RISK_FREE) -> dict[str, float] | None:
    """Black-Scholes delta, gamma, theta (per day) and vega (per volatility point)."""
    if not iv_pct or iv_pct <= 0 or years <= 0 or spot <= 0 or strike <= 0:
        return None
    s = iv_pct / 100
    d1 = (math.log(spot / strike) + (r + s * s / 2) * years) / (s * math.sqrt(years))
    d2 = d1 - s * math.sqrt(years)
    gamma = _npdf(d1) / (spot * s * math.sqrt(years))
    vega = spot * _npdf(d1) * math.sqrt(years) / 100
    if kind == "ce":
        delta = _ncdf(d1)
        theta = (-spot * _npdf(d1) * s / (2 * math.sqrt(years)) - r * strike * math.exp(-r * years) * _ncdf(d2)) / 365
    else:
        delta = _ncdf(d1) - 1
        theta = (-spot * _npdf(d1) * s / (2 * math.sqrt(years)) + r * strike * math.exp(-r * years) * _ncdf(-d2)) / 365
    return {"delta": round(delta, 4), "gamma": round(gamma, 6), "theta": round(theta, 2), "vega": round(vega, 2)}


def max_pain(rows: list[dict[str, Any]]) -> float | None:
    """The expiry price at which option holders, in total, would be paid least."""
    strikes = [r["strike"] for r in rows]
    if not strikes:
        return None

    def payout(settle: float) -> float:
        total = 0.0
        for r in rows:
            if r["ce"] and r["ce"]["oi"]:
                total += max(settle - r["strike"], 0) * r["ce"]["oi"]
            if r["pe"] and r["pe"]["oi"]:
                total += max(r["strike"] - settle, 0) * r["pe"]["oi"]
        return total

    return min(strikes, key=payout)


def analyse(chain: dict[str, Any], reference_price: float | None, today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    rows, spot = chain["rows"], chain["underlying"]
    if not rows or not spot:
        raise ValueError(f"NSE returned no option chain for {chain['symbol']} {chain['expiry']}")
    years = max((date.fromisoformat(chain["expiry"]) - today).days, 0) / 365 + 1 / 365 / 4  # include the expiry day's session
    ce_oi = sum((r["ce"] or {}).get("oi") or 0 for r in rows)
    pe_oi = sum((r["pe"] or {}).get("oi") or 0 for r in rows)
    atm = min(rows, key=lambda r: abs(r["strike"] - spot))
    below = max((r for r in rows if r["strike"] <= spot), key=lambda r: r["strike"], default=None)
    above = min((r for r in rows if r["strike"] > spot), key=lambda r: r["strike"], default=None)
    atm_ivs = [x for x in (_otm_iv(below, spot) if below else None, _otm_iv(above, spot) if above else None) if x]
    c_mid, p_mid = _price(atm["ce"]), _price(atm["pe"])
    straddle = (c_mid or 0) + (p_mid or 0)

    stale = 0
    for r in rows:
        iv = _otm_iv(r, spot)
        r["iv"] = iv
        for kind in ("ce", "pe"):
            if r[kind]:
                r[kind]["greeks"] = greeks(kind, spot, r["strike"], years, iv)
                own = r[kind].get("iv")
                r[kind]["stale"] = bool(own and iv and abs(own - iv) > STALE_IV_POINTS)
                stale += r[kind]["stale"]

    def top(kind: str, n: int = 3) -> list[dict[str, Any]]:
        legs = [(r["strike"], (r[kind] or {}).get("oi") or 0) for r in rows]
        return [{"strike": s, "oi": oi} for s, oi in sorted(legs, key=lambda x: -x[1])[:n] if oi]

    # -- vetting ----------------------------------------------------------------------
    checks = []
    if reference_price:
        gap = abs(spot - reference_price) / reference_price
        checks.append({"check": "underlying matches Arthdex's price", "chain": spot, "arthdex": reference_price, "gapPct": round(gap * 100, 3), "ok": gap <= 0.005})
    totals = chain.get("nseTotals") or {}
    for side, ours in (("ceOi", ce_oi), ("peOi", pe_oi)):
        if totals.get(side):
            gap = abs(ours - totals[side]) / totals[side]
            checks.append({"check": f"{'call' if side == 'ceOi' else 'put'} open interest adds up to NSE's total", "chain": ours, "arthdex": totals[side], "gapPct": round(gap * 100, 3), "ok": gap <= 0.001})
    if c_mid and p_mid:
        parity = spot - atm["strike"] * math.exp(-RISK_FREE * years)
        gap = abs((c_mid - p_mid) - parity) / straddle
        checks.append({"check": "put-call parity at the money, as a share of the straddle", "chain": round(c_mid - p_mid, 2), "arthdex": round(parity, 2), "gapPct": round(gap * 100, 2), "ok": gap <= PARITY_TOLERANCE})

    return {
        "symbol": chain["symbol"],
        "expiry": chain["expiry"],
        "timestamp": chain["timestamp"],
        "underlying": spot,
        "daysToExpiry": (date.fromisoformat(chain["expiry"]) - today).days,
        "pcr": round(pe_oi / ce_oi, 2) if ce_oi else None,
        "maxPain": max_pain(rows),
        "atmStrike": atm["strike"],
        "atmIv": round(sum(atm_ivs) / len(atm_ivs), 2) if atm_ivs else None,
        "impliedMove": {"points": round(straddle, 2), "pct": round(straddle / spot * 100, 2)} if straddle else None,
        "resistance": top("ce"),
        "support": top("pe"),
        "totals": {"ceOi": ce_oi, "peOi": pe_oi},
        "rows": rows,
        "staleLegs": stale,
        "vetting": {"checks": checks, "ok": all(c["ok"] for c in checks) if checks else None},
    }


def build_up(spurts: list[dict[str, Any]], price_changes: dict[str, float]) -> dict[str, Any]:
    """Classify F&O stocks by price and open-interest direction."""
    buckets: dict[str, list[dict[str, Any]]] = {"longBuildUp": [], "shortBuildUp": [], "shortCovering": [], "longUnwinding": []}
    for s in spurts:
        chg = price_changes.get(s["symbol"])
        oi = s.get("oiChange")
        if chg is None or oi is None or oi == 0 or chg == 0:
            continue
        key = ("longBuildUp" if oi > 0 else "shortCovering") if chg > 0 else ("shortBuildUp" if oi > 0 else "longUnwinding")
        buckets[key].append({**s, "priceChangePct": chg})
    for key in buckets:
        buckets[key].sort(key=lambda x: -abs(x.get("oiChangePct") or 0))
    return {"buckets": buckets, "classified": sum(len(v) for v in buckets.values()), "of": len(spurts)}
