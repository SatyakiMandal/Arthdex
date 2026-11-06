"""
Options Strategy Builder and Multi-Leg Payoff Engine for Indian Derivatives.

Supports constructing, pricing, and risk-analyzing arbitrary multi-leg option strategies
(Bull Call Spread, Bear Put Spread, Long/Short Straddle, Strangle, Iron Condor, Iron Butterfly, Ratio Spreads)
for NSE indices (NIFTY 50, BANK NIFTY, FINNIFTY) and F&O equity underlyings.

Computes:
- Expiry payoff curve across spot domain [0.80 * S0, 1.20 * S0]
- T+0 Greeks-based theoretical curve using Black-Scholes pricing
- Max Profit, Max Loss, Breakeven spot levels
- Net Cash Outflow / Inflow (Debit vs Credit)
- Net Greeks (Delta, Gamma, Theta, Vega)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Literal


def _norm_cdf(x: float) -> float:
    """Cumulative normal distribution function using math.erf."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
    """Standard normal probability density function."""
    return (1.0 / math.sqrt(2.0 * math.pi)) * math.exp(-0.5 * x * x)


def black_scholes_price_and_greeks(
    spot: float,
    strike: float,
    tte: float,  # Time to expiry in years
    risk_free_rate: float,
    iv: float,
    option_type: Literal["CE", "PE", "call", "put"],
) -> dict[str, float]:
    """Calculates Black-Scholes option theoretical price and first/second order Greeks."""
    opt = option_type.upper()
    is_call = opt in ("CE", "CALL")

    if tte <= 0.0001:  # At expiry
        intrinsic = max(0.0, spot - strike) if is_call else max(0.0, strike - spot)
        return {
            "price": intrinsic,
            "delta": 1.0 if (is_call and spot > strike) else (-1.0 if (not is_call and spot < strike) else 0.0),
            "gamma": 0.0,
            "theta": 0.0,
            "vega": 0.0,
        }

    vol_sqrt_t = iv * math.sqrt(tte)
    if vol_sqrt_t < 1e-6:
        vol_sqrt_t = 1e-6

    d1 = (math.log(spot / strike) + (risk_free_rate + 0.5 * iv * iv) * tte) / vol_sqrt_t
    d2 = d1 - vol_sqrt_t

    df = math.exp(-risk_free_rate * tte)
    pdf_d1 = _norm_pdf(d1)

    if is_call:
        price = spot * _norm_cdf(d1) - strike * df * _norm_cdf(d2)
        delta = _norm_cdf(d1)
        theta_ann = -(spot * pdf_d1 * iv) / (2.0 * math.sqrt(tte)) - risk_free_rate * strike * df * _norm_cdf(d2)
    else:
        price = strike * df * _norm_cdf(-d2) - spot * _norm_cdf(-d1)
        delta = _norm_cdf(d1) - 1.0
        theta_ann = -(spot * pdf_d1 * iv) / (2.0 * math.sqrt(tte)) + risk_free_rate * strike * df * _norm_cdf(-d2)

    gamma = pdf_d1 / (spot * vol_sqrt_t)
    theta_daily = theta_ann / 365.0  # Daily rupee theta decay
    vega_1pct = (spot * math.sqrt(tte) * pdf_d1) / 100.0  # Per 1% IV change

    return {
        "price": max(0.0, round(price, 2)),
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta_daily, 2),
        "vega": round(vega_1pct, 2),
    }


def calculate_leg_payoff(
    spot_at_expiry: float,
    option_type: str,
    action: str,
    strike: float,
    premium: float,
) -> float:
    """Calculates per-share payoff of an option leg at expiry."""
    is_call = option_type.upper() in ("CE", "CALL")
    is_buy = action.lower() in ("buy", "long")

    if is_call:
        intrinsic = max(0.0, spot_at_expiry - strike)
    else:
        intrinsic = max(0.0, strike - spot_at_expiry)

    if is_buy:
        return intrinsic - premium
    else:
        return premium - intrinsic


def build_options_strategy_payoff(
    symbol: str,
    spot_price: float,
    lot_size: int,
    legs: list[dict[str, Any]],
    days_to_expiry: int = 7,
    risk_free_rate: float = 0.068,  # Grounded in 91D T-Bill par rate (6.8%)
) -> dict[str, Any]:
    """
    Builds the payoff curve and analytical Greeks summary for a multi-leg strategy.

    legs specification:
    [
      {
        "id": "leg-1",
        "action": "buy" | "sell",
        "type": "CE" | "PE",
        "strike": 24500,
        "premium": 120.50,
        "contracts": 1,
        "iv": 0.14
      }
    ]
    """
    if not legs:
        return {
            "error": "No legs provided",
            "symbol": symbol,
            "spotPrice": spot_price,
            "points": [],
        }

    tte = max(0.001, days_to_expiry / 365.0)

    # 1. Net Cash Flow (Positive = Net Credit received, Negative = Net Debit paid)
    net_cash_flow = 0.0
    for leg in legs:
        action = leg.get("action", "buy").lower()
        prem = float(leg.get("premium", 0.0))
        qty = int(leg.get("contracts", 1)) * lot_size
        if action == "buy":
            net_cash_flow -= prem * qty
        else:
            net_cash_flow += prem * qty

    # 2. Portfolio Greeks (Sum across all legs weighted by signed quantity)
    net_delta = 0.0
    net_gamma = 0.0
    net_theta = 0.0
    net_vega = 0.0

    for leg in legs:
        action = leg.get("action", "buy").lower()
        opt_type = leg.get("type", "CE")
        strike = float(leg.get("strike", spot_price))
        iv = float(leg.get("iv", 0.14))
        qty = int(leg.get("contracts", 1)) * lot_size
        sign = 1.0 if action == "buy" else -1.0

        greeks = black_scholes_price_and_greeks(
            spot=spot_price,
            strike=strike,
            tte=tte,
            risk_free_rate=risk_free_rate,
            iv=iv,
            option_type=opt_type,
        )

        net_delta += sign * greeks["delta"] * qty
        net_gamma += sign * greeks["gamma"] * qty
        net_theta += sign * greeks["theta"] * qty
        net_vega += sign * greeks["vega"] * qty

    # 3. Spot Domain for Payoff Curve: min strike * 0.85 to max strike * 1.15
    strikes = [float(l.get("strike", spot_price)) for l in legs]
    min_k = min(strikes + [spot_price])
    max_k = max(strikes + [spot_price])

    domain_min = round(min(min_k * 0.88, spot_price * 0.88), 0)
    domain_max = round(max(max_k * 1.12, spot_price * 1.12), 0)
    step = max(5.0, round((domain_max - domain_min) / 100.0, 1))

    points = []
    curr_spot = domain_min
    max_pnl = -float("inf")
    min_pnl = float("inf")

    prev_pnl = None
    prev_spot = None
    breakevens: list[float] = []

    while curr_spot <= domain_max + 1e-5:
        pnl_at_expiry = 0.0
        pnl_today = 0.0

        for leg in legs:
            action = leg.get("action", "buy").lower()
            opt_type = leg.get("type", "CE")
            strike = float(leg.get("strike", spot_price))
            prem = float(leg.get("premium", 0.0))
            iv = float(leg.get("iv", 0.14))
            qty = int(leg.get("contracts", 1)) * lot_size

            # Expiry P&L
            leg_exp_pnl = calculate_leg_payoff(curr_spot, opt_type, action, strike, prem) * qty
            pnl_at_expiry += leg_exp_pnl

            # Today theoretical P&L using Black-Scholes at simulated spot
            today_bs = black_scholes_price_and_greeks(
                spot=curr_spot,
                strike=strike,
                tte=tte,
                risk_free_rate=risk_free_rate,
                iv=iv,
                option_type=opt_type,
            )
            sign = 1.0 if action == "buy" else -1.0
            today_val = (today_bs["price"] - prem) * sign * qty
            pnl_today += today_val

        pnl_exp_round = round(pnl_at_expiry, 2)
        pnl_today_round = round(pnl_today, 2)

        if pnl_exp_round > max_pnl:
            max_pnl = pnl_exp_round
        if pnl_exp_round < min_pnl:
            min_pnl = pnl_exp_round

        # Breakeven detection (sign change)
        if prev_pnl is not None and prev_spot is not None:
            if (prev_pnl < 0 and pnl_at_expiry >= 0) or (prev_pnl > 0 and pnl_at_expiry <= 0):
                # Linear interpolation for zero crossing
                if abs(pnl_at_expiry - prev_pnl) > 1e-6:
                    fraction = abs(prev_pnl) / abs(pnl_at_expiry - prev_pnl)
                    be_spot = prev_spot + fraction * (curr_spot - prev_spot)
                    breakevens.append(round(be_spot, 2))

        points.append({
            "spot": round(curr_spot, 1),
            "pnlExpiry": pnl_exp_round,
            "pnlToday": pnl_today_round,
        })

        prev_pnl = pnl_at_expiry
        prev_spot = curr_spot
        curr_spot += step

    # Check for unbounded profit or loss
    # If the slope at edges is positive or negative
    left_slope = (points[1]["pnlExpiry"] - points[0]["pnlExpiry"]) / (points[1]["spot"] - points[0]["spot"])
    right_slope = (points[-1]["pnlExpiry"] - points[-2]["pnlExpiry"]) / (points[-1]["spot"] - points[-2]["spot"])

    is_max_profit_unlimited = right_slope > 0.05 or left_slope < -0.05
    is_max_loss_unlimited = right_slope < -0.05 or left_slope > 0.05

    risk_reward = None
    if not is_max_profit_unlimited and not is_max_loss_unlimited and abs(min_pnl) > 1e-4:
        risk_reward = round(abs(max_pnl / min_pnl), 2)

    return {
        "symbol": symbol.upper(),
        "spotPrice": spot_price,
        "lotSize": lot_size,
        "daysToExpiry": days_to_expiry,
        "netCashFlow": round(net_cash_flow, 2),
        "isDebit": net_cash_flow < 0,
        "maxProfit": "Unlimited" if is_max_profit_unlimited else round(max_pnl, 2),
        "maxLoss": "Unlimited" if is_max_loss_unlimited else round(abs(min_pnl), 2),
        "breakevens": breakevens,
        "riskRewardRatio": risk_reward,
        "greeks": {
            "netDelta": round(net_delta, 2),
            "netGamma": round(net_gamma, 4),
            "netTheta": round(net_theta, 2),
            "netVega": round(net_vega, 2),
        },
        "points": points,
        "legs": legs,
    }


def get_standard_strategy_templates(symbol: str = "NIFTY", spot: float = 24500.0) -> list[dict[str, Any]]:
    """Returns canonical multi-leg option strategy templates pre-calibrated to spot."""
    # Round to nearest 50 strike for Nifty
    atm = round(spot / 50.0) * 50.0

    return [
        {
            "id": "bull-call-spread",
            "name": "Bull Call Spread",
            "type": "Directional Bullish",
            "description": "Buy ATM Call, Sell OTM Call to cap cost and downside risk.",
            "legs": [
                {"action": "buy", "type": "CE", "strike": atm, "premium": 180.0, "contracts": 1, "iv": 0.135},
                {"action": "sell", "type": "CE", "strike": atm + 200, "premium": 85.0, "contracts": 1, "iv": 0.130},
            ],
        },
        {
            "id": "bear-put-spread",
            "name": "Bear Put Spread",
            "type": "Directional Bearish",
            "description": "Buy ATM Put, Sell OTM Put to profit from moderate market decline.",
            "legs": [
                {"action": "buy", "type": "PE", "strike": atm, "premium": 175.0, "contracts": 1, "iv": 0.142},
                {"action": "sell", "type": "PE", "strike": atm - 200, "premium": 80.0, "contracts": 1, "iv": 0.150},
            ],
        },
        {
            "id": "long-straddle",
            "name": "Long Straddle",
            "type": "Non-Directional High Volatility",
            "description": "Buy ATM Call and ATM Put anticipating violent breakout in either direction.",
            "legs": [
                {"action": "buy", "type": "CE", "strike": atm, "premium": 180.0, "contracts": 1, "iv": 0.135},
                {"action": "buy", "type": "PE", "strike": atm, "premium": 175.0, "contracts": 1, "iv": 0.142},
            ],
        },
        {
            "id": "short-straddle",
            "name": "Short Straddle",
            "type": "Delta Neutral / Short Volatility",
            "description": "Sell ATM Call and ATM Put collecting maximum premium decay.",
            "legs": [
                {"action": "sell", "type": "CE", "strike": atm, "premium": 180.0, "contracts": 1, "iv": 0.135},
                {"action": "sell", "type": "PE", "strike": atm, "premium": 175.0, "contracts": 1, "iv": 0.142},
            ],
        },
        {
            "id": "iron-condor",
            "name": "Iron Condor",
            "type": "Range-Bound Delta Neutral",
            "description": "Sell OTM Put Spread and OTM Call Spread with defined risk on both wings.",
            "legs": [
                {"action": "buy", "type": "PE", "strike": atm - 400, "premium": 25.0, "contracts": 1, "iv": 0.160},
                {"action": "sell", "type": "PE", "strike": atm - 200, "premium": 75.0, "contracts": 1, "iv": 0.148},
                {"action": "sell", "type": "CE", "strike": atm + 200, "premium": 80.0, "contracts": 1, "iv": 0.132},
                {"action": "buy", "type": "CE", "strike": atm + 400, "premium": 28.0, "contracts": 1, "iv": 0.128},
            ],
        },
        {
            "id": "iron-butterfly",
            "name": "Iron Butterfly",
            "type": "Pin-Risk Income Strategy",
            "description": "Sell ATM Straddle, Buy OTM Strangle wings for complete capital protection.",
            "legs": [
                {"action": "buy", "type": "PE", "strike": atm - 300, "premium": 42.0, "contracts": 1, "iv": 0.155},
                {"action": "sell", "type": "PE", "strike": atm, "premium": 175.0, "contracts": 1, "iv": 0.142},
                {"action": "sell", "type": "CE", "strike": atm, "premium": 180.0, "contracts": 1, "iv": 0.135},
                {"action": "buy", "type": "CE", "strike": atm + 300, "premium": 45.0, "contracts": 1, "iv": 0.130},
            ],
        },
    ]
