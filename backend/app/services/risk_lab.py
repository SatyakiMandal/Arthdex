"""
Risk lab: stress tests and a backtest computed from recorded prices.

Three tools, none of which carries any market figure in the code:

  * Historical replay. A crisis is defined only by its dates. What the Nifty 50 and each
    holding did across those dates is read from their daily price history. A holding that
    was not listed then is estimated as its regression beta times the index move and is
    marked as an estimate.
  * Index move. The reader picks a market move; each holding moves by its beta times that.
  * Moving-average backtest on the symbol's real daily closes, split into an earlier and a
    later stretch, after Indian transaction charges.

Every function here takes price series as arguments, so the arithmetic is tested offline.
"""

from __future__ import annotations

import math
from datetime import date
from typing import Any

Series = list[tuple[date, float]]

TAG_HISTORICAL = "[RECORDED PRICES]"
TAG_ESTIMATE = "[ESTIMATE: BETA × INDEX]"
TAG_MODELLED = "[MODELLED / ALGORITHMIC]"

INDEX_SYMBOL = "NIFTY50"
BETA_LOOKBACK_DAYS = 750
MIN_BETA_OBSERVATIONS = 120

# Dates only. The Nifty's fall over each window is computed from its history when served.
SCENARIOS: list[dict[str, Any]] = [
    {
        "scenario_id": "gfc_2008",
        "name": "2008 global financial crisis",
        "start": "2008-01-08",
        "end": "2008-10-27",
        "description": "From the January 2008 market peak to the low after the Lehman Brothers collapse.",
    },
    {
        "scenario_id": "taper_tantrum_2013",
        "name": "2013 taper tantrum",
        "start": "2013-05-22",
        "end": "2013-08-28",
        "description": "From the US Federal Reserve's signal that bond purchases would slow to the rupee's low that August.",
    },
    {
        "scenario_id": "covid_2020",
        "name": "2020 COVID crash",
        "start": "2020-02-19",
        "end": "2020-03-23",
        "description": "From the February 2020 high to the low on the day before the national lockdown.",
    },
    {
        "scenario_id": "election_2024",
        "name": "4 June 2024 election result",
        "start": "2024-06-03",
        "end": "2024-06-04",
        "description": "The single session in which the general election result was counted.",
    },
]

# Statutory charges on a delivery equity trade
STT_RATE = 0.001            # 0.1% on buy and sell
EXCHANGE_TXN_RATE = 0.0000297
SEBI_RATE = 0.000001        # Rs 10 per crore
STAMP_DUTY_RATE = 0.00015   # buy side only
GST_RATE = 0.18             # on brokerage, exchange and SEBI charges


def scenario_by_id(scenario_id: str) -> dict[str, Any] | None:
    return next((s for s in SCENARIOS if s["scenario_id"] == scenario_id), None)


def _close_on_or_before(series: Series, day: date) -> float | None:
    value = None
    for d, close in series:
        if d > day:
            break
        value = close
    return value


def window_change_pct(series: Series, start: date, end: date) -> float | None:
    """
    Percentage change from the last close on or before `start` to the last close on or
    before `end`. None when the series does not reach back to `start`: a later first
    print is not a stand-in for the price before the crisis.
    """
    if not series or series[0][0] > start:
        return None
    base, last = _close_on_or_before(series, start), _close_on_or_before(series, end)
    if not base or last is None:
        return None
    return (last / base - 1.0) * 100.0


def regression_beta(stock: Series, index: Series, lookback: int = BETA_LOOKBACK_DAYS) -> tuple[float, int] | None:
    """Slope of the stock's daily returns on the index's, over their common recent dates."""
    index_by_day = dict(index)
    common = [(d, c, index_by_day[d]) for d, c in stock if d in index_by_day][-(lookback + 1):]
    xs, ys = [], []
    for (_, s0, i0), (_, s1, i1) in zip(common, common[1:]):
        if s0 > 0 and i0 > 0:
            ys.append(s1 / s0 - 1.0)
            xs.append(i1 / i0 - 1.0)
    n = len(xs)
    if n < MIN_BETA_OBSERVATIONS:
        return None
    mean_x, mean_y = sum(xs) / n, sum(ys) / n
    var_x = sum((x - mean_x) ** 2 for x in xs)
    if var_x <= 0:
        return None
    return sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / var_x, n


def normalise_positions(positions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Positions as symbol and rupee value, merged per symbol. Raises ValueError on bad input."""
    merged: dict[str, float] = {}
    for p in positions or []:
        symbol = str(p.get("symbol") or "").upper().strip()
        value = p.get("value_inr")
        if not symbol or isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise ValueError("Each holding needs a symbol and a positive rupee value")
        merged[symbol] = merged.get(symbol, 0.0) + float(value)
    if not merged:
        raise ValueError("The portfolio is empty")
    total = sum(merged.values())
    return [{"symbol": s, "value_inr": v, "weight_pct": v / total * 100.0} for s, v in merged.items()]


def _portfolio_result(rows: list[dict[str, Any]], index_change: float | None) -> dict[str, Any]:
    total = sum(r["value_inr"] for r in rows)
    covered = [r for r in rows if r["change_pct"] is not None]
    covered_value = sum(r["value_inr"] for r in covered)
    pnl = sum(r["pnl_inr"] for r in covered)
    change = pnl / covered_value * 100.0 if covered_value else None
    return {
        "portfolio_value_inr": round(total, 2),
        "covered_value_inr": round(covered_value, 2),
        "coverage_pct": round(covered_value / total * 100.0, 1) if total else 0.0,
        "pnl_inr": round(pnl, 2) if covered else None,
        "change_pct": round(change, 2) if change is not None else None,
        "index_change_pct": round(index_change, 2) if index_change is not None else None,
        "relative_to_index_pct": round(change - index_change, 2) if change is not None and index_change is not None else None,
        "holdings": sorted(rows, key=lambda r: (r["pnl_inr"] is None, r["pnl_inr"] or 0.0)),
        "methods": {
            "recorded": sum(1 for r in rows if r["method"] == "recorded"),
            "estimated": sum(1 for r in rows if r["method"] == "estimate"),
            "unavailable": sum(1 for r in rows if r["method"] == "unavailable"),
        },
    }


def _row(position: dict[str, Any], change: float | None, method: str, note: str | None, beta: float | None) -> dict[str, Any]:
    return {
        "symbol": position["symbol"],
        "value_inr": round(position["value_inr"], 2),
        "weight_pct": round(position["weight_pct"], 2),
        "change_pct": round(change, 2) if change is not None else None,
        "pnl_inr": round(position["value_inr"] * change / 100.0, 2) if change is not None else None,
        "method": method,
        "beta": round(beta, 2) if beta is not None else None,
        "note": note,
    }


def replay(
    positions: list[dict[str, Any]],
    scenario: dict[str, Any],
    histories: dict[str, Series],
    index: Series,
) -> dict[str, Any]:
    """What the portfolio's holdings did, by their own recorded prices, across a crisis window."""
    start, end = date.fromisoformat(scenario["start"]), date.fromisoformat(scenario["end"])
    index_change = window_change_pct(index, start, end)
    rows = []
    for p in normalise_positions(positions):
        series = histories.get(p["symbol"]) or []
        change = window_change_pct(series, start, end)
        if change is not None:
            rows.append(_row(p, change, "recorded", None, None))
            continue
        fit = regression_beta(series, index) if series else None
        if fit and index_change is not None:
            beta, n = fit
            note = f"No price history back to {scenario['start']}; estimated as beta {beta:.2f} (from {n} recent days) times the index move."
            rows.append(_row(p, beta * index_change, "estimate", note, beta))
        else:
            rows.append(_row(p, None, "unavailable", "No usable price history for this symbol.", None))
    out = _portfolio_result(rows, index_change)
    out.update(
        scenario={k: scenario[k] for k in ("scenario_id", "name", "start", "end", "description")},
        provenance=f"{TAG_HISTORICAL} for holdings listed at the time; {TAG_ESTIMATE} otherwise",
        caveats=[
            "Price change only: dividends are not included.",
            "The same companies were different businesses then; a replay is a reference point, not a forecast.",
        ],
    )
    return out


def index_move(
    positions: list[dict[str, Any]],
    move_pct: float,
    histories: dict[str, Series],
    index: Series,
) -> dict[str, Any]:
    """Each holding moved by its regression beta times a chosen index move."""
    rows = []
    for p in normalise_positions(positions):
        series = histories.get(p["symbol"]) or []
        fit = regression_beta(series, index) if series else None
        if fit:
            beta, n = fit
            rows.append(_row(p, beta * move_pct, "estimate", f"Beta {beta:.2f} from {n} recent daily returns against the Nifty 50.", beta))
        else:
            rows.append(_row(p, None, "unavailable", "Too little price history to fit a beta.", None))
    out = _portfolio_result(rows, move_pct)
    out.update(
        scenario={"scenario_id": "index_move", "name": f"Nifty 50 moves {move_pct:+.1f}%", "start": None, "end": None,
                  "description": "A hypothetical market move chosen by the reader."},
        provenance=TAG_ESTIMATE,
        caveats=[
            "Beta is a straight-line fit to ordinary days. In a sharp fall, correlations rise and losses are usually larger than beta implies.",
        ],
    )
    return out


def trade_charges(buy_value: float, sell_value: float, brokerage: float) -> dict[str, float]:
    turnover = buy_value + sell_value
    stt = turnover * STT_RATE
    exchange = turnover * EXCHANGE_TXN_RATE
    sebi = turnover * SEBI_RATE
    stamp = buy_value * STAMP_DUTY_RATE
    gst = (brokerage + exchange + sebi) * GST_RATE
    return {"stt": stt, "exchange": exchange, "sebi": sebi, "stamp_duty": stamp, "gst": gst, "brokerage": brokerage,
            "total": stt + exchange + sebi + stamp + gst + brokerage}


def _simulate(prices: list[float], fast: int, slow: int, capital: float, slippage_bps: float, brokerage: float) -> dict[str, Any]:
    """Long-only: buy when the fast average crosses above the slow one, sell when it crosses back."""
    n = len(prices)
    start_capital = capital

    def sma(period: int) -> list[float | None]:
        out: list[float | None] = [None] * n
        running = 0.0
        for i, price in enumerate(prices):
            running += price
            if i >= period:
                running -= prices[i - period]
            if i >= period - 1:
                out[i] = running / period
        return out

    fast_avg, slow_avg = sma(fast), sma(slow)
    shares, entry, entry_cost = 0, 0.0, 0.0
    charges_paid = 0.0
    trades: list[dict[str, Any]] = []
    equity = [capital]
    peak, max_drawdown = capital, 0.0

    for i in range(slow, n):
        f0, s0, f1, s1 = fast_avg[i - 1], slow_avg[i - 1], fast_avg[i], slow_avg[i]
        if None not in (f0, s0, f1, s1):
            if shares == 0 and f1 > s1 and f0 <= s0:
                price = prices[i] * (1.0 + slippage_bps / 10000.0)
                quantity = int(capital / (price * (1.0 + STT_RATE + STAMP_DUTY_RATE)) if price > 0 else 0)
                if quantity > 0:
                    cost = trade_charges(quantity * price, 0.0, brokerage)["total"]
                    if quantity * price + cost <= capital:
                        capital -= quantity * price + cost
                        charges_paid += cost
                        shares, entry, entry_cost = quantity, price, cost
            elif shares > 0 and f1 < s1 and f0 >= s0:
                price = prices[i] * (1.0 - slippage_bps / 10000.0)
                cost = trade_charges(0.0, shares * price, brokerage)["total"]
                capital += shares * price - cost
                charges_paid += cost
                net = shares * (price - entry) - cost - entry_cost
                trades.append({
                    "shares": shares, "entry_price": round(entry, 2), "exit_price": round(price, 2),
                    "net_pnl_inr": round(net, 2), "return_pct": round(net / (shares * entry) * 100.0, 2),
                })
                shares = 0
        value = capital + shares * prices[i]
        equity.append(value)
        peak = max(peak, value)
        max_drawdown = max(max_drawdown, (peak - value) / peak if peak else 0.0)

    final = equity[-1]
    years = n / 252.0
    daily = [b / a - 1.0 for a, b in zip(equity, equity[1:]) if a > 0]
    sharpe = None
    if len(daily) > 1:
        mean = sum(daily) / len(daily)
        std = math.sqrt(sum((r - mean) ** 2 for r in daily) / (len(daily) - 1))
        sharpe = round(mean / std * math.sqrt(252.0), 2) if std > 0 else None
    wins = [t for t in trades if t["net_pnl_inr"] > 0]
    buy_hold = (prices[-1] / prices[0] - 1.0) * 100.0 if prices[0] > 0 else None
    return {
        "sessions": n,
        "initial_capital_inr": round(start_capital, 2),
        "final_capital_inr": round(final, 2),
        "net_return_pct": round((final / start_capital - 1.0) * 100.0, 2),
        "net_cagr_pct": round(((final / start_capital) ** (1.0 / years) - 1.0) * 100.0, 2) if years > 0 and final > 0 else None,
        "buy_and_hold_return_pct": round(buy_hold, 2) if buy_hold is not None else None,
        "max_drawdown_pct": round(max_drawdown * 100.0, 2),
        "sharpe_ratio": sharpe,
        "closed_trades": len(trades),
        "win_rate_pct": round(len(wins) / len(trades) * 100.0, 1) if trades else None,
        "open_position": shares > 0,
        "charges_paid_inr": round(charges_paid, 2),
        "recent_trades": trades[-5:],
    }


def sma_backtest(
    symbol: str,
    series: Series,
    fast: int = 20,
    slow: int = 50,
    initial_capital: float = 1_000_000.0,
    in_sample_pct: float = 0.7,
    slippage_bps: float = 5.0,
    brokerage: float = 20.0,
) -> dict[str, Any]:
    if not (2 <= fast < slow <= 500):
        raise ValueError("Periods must satisfy 2 <= fast < slow <= 500")
    if len(series) < slow * 4:
        raise ValueError(f"{symbol} has {len(series)} daily closes; at least {slow * 4} are needed for a {slow}-day average and a two-part test")
    split = int(len(series) * min(0.9, max(0.5, in_sample_pct)))
    if len(series) - split <= slow + 5:
        raise ValueError("The later stretch is too short for the chosen slow period")
    prices = [c for _, c in series]
    earlier = _simulate(prices[:split], fast, slow, initial_capital, slippage_bps, brokerage)
    later = _simulate(prices[split:], fast, slow, initial_capital, slippage_bps, brokerage)
    return {
        "symbol": symbol.upper(),
        "strategy": f"{fast}/{slow}-day moving-average crossover, long only",
        "parameters": {"fast_period": fast, "slow_period": slow, "slippage_bps": slippage_bps, "brokerage_per_order_inr": brokerage},
        "data": {"from": series[0][0].isoformat(), "to": series[-1][0].isoformat(), "sessions": len(series)},
        "earlier_period": {"from": series[0][0].isoformat(), "to": series[split - 1][0].isoformat(), **earlier},
        "later_period": {"from": series[split][0].isoformat(), "to": series[-1][0].isoformat(), **later},
        "provenance": f"{TAG_HISTORICAL} daily closes; {TAG_MODELLED} trades",
        "caveats": [
            "Trades fill at the day's close with the stated slippage; real fills differ.",
            "Charges are STT, exchange and SEBI fees, stamp duty, GST and flat brokerage on delivery trades. Capital-gains tax is not included.",
            "A rule that worked on the earlier stretch and not the later one was probably fitted to noise. Past results do not predict future ones.",
        ],
    }
