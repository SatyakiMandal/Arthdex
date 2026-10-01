"""Research layer for unlisted / pre-IPO shares: valuation models, risk, technicals and an investment call.

What can and cannot be built here, stated up front because it decides every choice below.

UnlistedZone publishes an *indicative* price that its own team revises now and then, and the chart
holds the last value flat in between (one real page: 1,669 daily points, 163 distinct values). A
daily return series built from that is mostly zeros plus a few jumps, so anything that assumes
daily price discovery is invalid on it: daily GARCH, a daily market-model beta, a daily VaR, an
event study with a z-score against daily volatility, VPIN, Markov regimes on daily returns.

What *is* sound is to look at the series at the frequency it really moves:

* monthly returns (a month is long enough for the dealer price to have been revised),
* weekly bars for trend indicators,
* the revision record itself (how often and how far the price is moved),
* the company's own reported ratios (book value, P/B, P/E, debt to equity) set against listed
  benchmarks and a stated illiquidity discount.

Every block below says which of these it uses, carries its own sample size, and is left out
(``None``) when the data cannot support it. Nothing is estimated to fill a gap.

The investment call reuses the verdict objects the listed analysis produces so the report and the
site render it the same way, but its pillars, weights and position-size caps are different: an
unlisted share is illiquid, settles off-exchange and is quoted by a dealer, so sizing is smaller,
stops are wider and the confidence ceiling is lower.
"""

from __future__ import annotations

import logging
import math
import re
from datetime import date
from typing import Any

import numpy as np
import pandas as pd

from .investment_verdict import InvestmentThesisPillar, InvestmentVerdict, PortfolioSizingTier

log = logging.getLogger(__name__)

# Assumptions that are not measured from data. They are returned in the output so a reader can
# see them and the sensitivity table shows what happens when they move.
DEFAULT_DLOM = 0.25        # discount for lack of marketability; 20 to 30% is the usual range for minority unlisted stakes
EQUITY_RISK_PREMIUM = 0.055
TERMINAL_GROWTH = 0.05
FALLBACK_RISK_FREE = 0.07  # used only when the 10-year G-Sec yield could not be retrieved, and flagged as such
BOOTSTRAP_SIMS = 4000
MIN_MONTHS_FOR_STATS = 6

# UnlistedZone sector label -> (key, Yahoo index symbol, NSE index id, display name)
_SECTOR_INDEX = [
    (r"bank|financ|insur|nbfc|asset management|broking|capital market", ("bank", "^NSEBANK", "nifty-bank", "Nifty Bank")),
    # Pharma is tested before IT because "biotech" contains "tech"
    (r"pharma|health|hospital(?!ity)|diagnos|medical|biotech", ("pharma", "^CNXPHARMA", "nifty-pharma", "Nifty Pharma")),
    (r"software|it |information tech|cyber|saas|tech|internet|e-?commerce|fintech", ("it", "^CNXIT", "nifty-it", "Nifty IT")),
    (r"auto(?!mat)|vehicle|ev |mobility", ("auto", "^CNXAUTO", "nifty-auto", "Nifty Auto")),
    (r"fmcg|consumer|food|beverage|retail|apparel|textile", ("fmcg", "^CNXFMCG", "nifty-fmcg", "Nifty FMCG")),
    (r"metal|steel|mining|aluminium|cement", ("metal", "^CNXMETAL", "nifty-metal", "Nifty Metal")),
    (r"energy|power|oil|gas|renewable|solar|utilit", ("energy", "^CNXENERGY", "nifty-energy", "Nifty Energy")),
    (r"real estate|realty|construction|housing", ("realty", "^CNXREALTY", "nifty-realty", "Nifty Realty")),
]


def sector_index(sector: str | None) -> dict[str, str] | None:
    """The NSE sector index that best stands in for an UnlistedZone sector label, if any."""
    if not sector:
        return None
    low = f" {sector.lower()} "
    for pattern, (key, yahoo, nse_id, name) in _SECTOR_INDEX:
        if re.search(pattern, low):
            return {"key": key, "yahoo": yahoo, "nse_id": nse_id, "name": name}
    return None


# ---------------------------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------------------------


def _num(text: Any) -> float | None:
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return None if (isinstance(text, float) and not math.isfinite(text)) else float(text)
    match = re.search(r"-?\d[\d,]*\.?\d*", str(text))
    if not match:
        return None
    try:
        value = float(match.group(0).replace(",", ""))
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def _r(value: float | None, digits: int = 4) -> float | None:
    return None if value is None or not math.isfinite(value) else round(float(value), digits)


def parse_facts(facts: dict[str, str] | None) -> dict[str, float | None]:
    """The source's own ratio strings as numbers. 'N/A' and blanks become None."""
    f = facts or {}

    def pick(*names: str) -> float | None:
        for n in names:
            if n in f:
                return _num(f[n])
        return None

    return {
        "pb": pick("P/B ratio", "P/B"),
        "pe": pick("P/E ratio", "P/E"),
        "book_value": pick("Book value"),
        "face_value": pick("Face value"),
        "debt_equity": pick("Debt / Equity", "Debt/Equity"),
        "lot_size": pick("Lot size"),
        "high_52w": pick("52-wk high"),
        "low_52w": pick("52-wk low"),
    }


# ---------------------------------------------------------------------------------------------
# price profile and revision record
# ---------------------------------------------------------------------------------------------


def _max_drawdown(series: pd.Series) -> dict[str, Any] | None:
    if len(series) < 2:
        return None
    running_max = series.cummax()
    dd = series / running_max - 1.0
    trough = dd.idxmin()
    peak = series.loc[:trough].idxmax()
    return {
        "max_drawdown_pct": _r(float(dd.min()) * 100, 2),
        "peak_date": peak.date().isoformat(),
        "trough_date": trough.date().isoformat(),
        "current_drawdown_pct": _r(float(dd.iloc[-1]) * 100, 2),
    }


def price_profile(series: pd.Series, real: pd.Series) -> dict[str, Any]:
    last = float(series.iloc[-1])
    first = float(series.iloc[0])
    days = max(1, (series.index[-1] - series.index[0]).days)
    out: dict[str, Any] = {
        "first": _r(first, 2),
        "last": _r(last, 2),
        "first_date": series.index[0].date().isoformat(),
        "last_date": series.index[-1].date().isoformat(),
        "window_return_pct": _r((last / first - 1) * 100, 2) if first else None,
        "cagr_pct": _r(((last / first) ** (365.0 / days) - 1) * 100, 2) if first > 0 and days >= 180 else None,
        "high": _r(float(series.max()), 2),
        "low": _r(float(series.min()), 2),
    }
    for label, offset in (("1m", 30), ("3m", 91), ("6m", 182), ("12m", 365)):
        cutoff = series.index[-1] - pd.Timedelta(days=offset)
        earlier = series.loc[:cutoff]
        out[f"change_{label}_pct"] = (
            _r((last / float(earlier.iloc[-1]) - 1) * 100, 2) if len(earlier) else None
        )
    year = series.loc[series.index[-1] - pd.Timedelta(days=365):]
    if len(year) > 1:
        lo, hi = float(year.min()), float(year.max())
        out["range_52w"] = {
            "low": _r(lo, 2),
            "high": _r(hi, 2),
            "position_pct": _r((last - lo) / (hi - lo) * 100, 1) if hi > lo else None,
        }
        out["percentile_52w"] = _r(float((year <= last).mean()) * 100, 1)
    out["drawdown"] = _max_drawdown(series)

    revs = real.copy()
    steps = revs.pct_change().dropna()
    gaps = pd.Series(revs.index).diff().dt.days.dropna()
    out["revisions"] = {
        "count": int(len(revs)),
        "median_gap_days": _r(float(gaps.median()), 1) if len(gaps) else None,
        "mean_abs_move_pct": _r(float(steps.abs().mean()) * 100, 2) if len(steps) else None,
        "up_share_pct": _r(float((steps > 0).mean()) * 100, 1) if len(steps) else None,
        "days_since_last": int((series.index[-1] - revs.index[-1]).days),
    }
    return out


# ---------------------------------------------------------------------------------------------
# monthly statistics, risk and market model
# ---------------------------------------------------------------------------------------------


def monthly_closes(series: pd.Series) -> pd.Series:
    return series.resample("ME").last().dropna()


def monthly_log_returns(series: pd.Series) -> pd.Series:
    m = monthly_closes(series)
    return np.log(m).diff().dropna()


def risk_block(series: pd.Series, facts: dict[str, float | None]) -> dict[str, Any]:
    rets = monthly_log_returns(series)
    n = int(len(rets))
    out: dict[str, Any] = {"months": n, "frequency": "monthly (the dealer price is revised too rarely for daily statistics)"}

    daily_changes = series.pct_change().dropna()
    stale = float((daily_changes == 0).mean()) if len(daily_changes) else None
    out["liquidity"] = {
        "stale_day_share_pct": _r(stale * 100, 1) if stale is not None else None,
        "lot_size": _r(facts.get("lot_size"), 0),
        "min_ticket_inr": _r(facts["lot_size"] * float(series.iloc[-1]), 0) if facts.get("lot_size") else None,
        "note": "A price that stays unchanged most days is a quote, not a market. Expect wide spreads and slow exits.",
    }
    out["leverage"] = {"debt_to_equity": _r(facts.get("debt_equity"), 2)}

    if n < MIN_MONTHS_FOR_STATS:
        out["note"] = f"Only {n} monthly return(s); volatility and VaR are not estimated."
        return out

    arr = rets.to_numpy()
    mu, sd = float(arr.mean()), float(arr.std(ddof=1))
    skew = float(pd.Series(arr).skew()) if n >= 8 else None
    kurt = float(pd.Series(arr).kurt()) if n >= 8 else None
    out.update(
        {
            "monthly_mean_pct": _r(mu * 100, 2),
            "monthly_vol_pct": _r(sd * 100, 2),
            "annualised_vol_pct": _r(sd * math.sqrt(12) * 100, 1),
            "skew": _r(skew, 2),
            "excess_kurtosis": _r(kurt, 2),
            "best_month_pct": _r((math.exp(arr.max()) - 1) * 100, 1),
            "worst_month_pct": _r((math.exp(arr.min()) - 1) * 100, 1),
            "positive_months_pct": _r(float((arr > 0).mean()) * 100, 1),
        }
    )

    z95, z99 = 1.6449, 2.3263

    def to_loss(log_ret: float) -> float:
        return (1 - math.exp(log_ret)) * 100

    hist95 = to_loss(float(np.quantile(arr, 0.05))) if n >= 12 else None
    hist99 = to_loss(float(np.quantile(arr, 0.01))) if n >= 24 else None
    param95 = to_loss(mu - z95 * sd)
    param99 = to_loss(mu - z99 * sd)
    cf95 = None
    if skew is not None and kurt is not None:
        zcf = z95 + (z95**2 - 1) * (-skew) / 6 + (z95**3 - 3 * z95) * kurt / 24 - (2 * z95**3 - 5 * z95) * skew**2 / 36
        cf95 = to_loss(mu - zcf * sd)
    tail = arr[arr <= np.quantile(arr, 0.05)] if n >= 12 else np.array([])
    out["var_1m"] = {
        "historical_95_pct": _r(hist95, 1),
        "historical_99_pct": _r(hist99, 1),
        "parametric_95_pct": _r(param95, 1),
        "parametric_99_pct": _r(param99, 1),
        "cornish_fisher_95_pct": _r(cf95, 1),
        "expected_shortfall_95_pct": _r(to_loss(float(tail.mean())), 1) if len(tail) else None,
        "note": "One-month loss that was not exceeded in 95 (or 99) of 100 months. Historical needs 12 (24) months of data.",
    }

    roll = pd.Series(arr).rolling(6).std(ddof=1).dropna()
    if len(roll) >= 3:
        ratio = float(roll.iloc[-1]) / sd if sd else 1.0
        out["regime"] = {
            "state": "High volatility" if ratio > 1.3 else "Low volatility" if ratio < 0.75 else "Normal volatility",
            "recent_6m_vol_vs_full": _r(ratio, 2),
        }
    return out


def _regress(y: np.ndarray, x: np.ndarray) -> dict[str, float | None]:
    n = len(y)
    xm, ym = x.mean(), y.mean()
    sxx = float(((x - xm) ** 2).sum())
    if sxx <= 0 or n < 4:
        return {}
    beta = float(((x - xm) * (y - ym)).sum() / sxx)
    alpha = float(ym - beta * xm)
    resid = y - (alpha + beta * x)
    sse = float((resid**2).sum())
    sst = float(((y - ym) ** 2).sum())
    se = math.sqrt(sse / (n - 2) / sxx) if n > 2 and sse > 0 else None
    return {
        "beta": beta,
        "alpha_monthly": alpha,
        "r_squared": 1 - sse / sst if sst > 0 else None,
        "beta_t": beta / se if se else None,
        "idio_vol_annual": math.sqrt(sse / max(1, n - 2)) * math.sqrt(12),
        "correlation": float(np.corrcoef(x, y)[0, 1]),
    }


def market_model(series: pd.Series, sector: str | None, start: date, end: date) -> dict[str, Any]:
    """Monthly returns against Nifty 50 and, where one maps, the sector index."""
    from .prices import load_prices

    rets = monthly_log_returns(series)
    out: dict[str, Any] = {"months": int(len(rets)), "frequency": "monthly"}
    if len(rets) < MIN_MONTHS_FOR_STATS:
        out["note"] = f"Only {len(rets)} monthly return(s), too few for a beta."
        return out

    idx = sector_index(sector)
    targets = [("Nifty 50", "^NSEI")]
    if idx:
        targets.append((idx["name"], idx["yahoo"]))

    pad = pd.Timestamp(start) - pd.Timedelta(days=45)
    for name, symbol in targets:
        try:
            frame, source = load_prices(symbol, pad.date(), end)
            closes = frame["close"].resample("ME").last().dropna()
            bench = np.log(closes).diff().dropna()
            joined = pd.concat([rets.rename("y"), bench.rename("x")], axis=1, join="inner").dropna()
            if len(joined) < MIN_MONTHS_FOR_STATS:
                out[name] = {"note": f"Only {len(joined)} overlapping months."}
                continue
            reg = _regress(joined["y"].to_numpy(), joined["x"].to_numpy())
            reg = {k: _r(v, 4) for k, v in reg.items()}
            reg.update({"months": int(len(joined)), "source": source, "symbol": symbol})
            out[name] = reg
        except Exception as exc:
            out[name] = {"note": f"{name} history unavailable: {type(exc).__name__}"}
    out["interpretation"] = (
        "A dealer-quoted price tracks the market loosely and with a lag, so a low R squared is expected and the beta is "
        "wide. Treat it as a rough sensitivity, not a hedge ratio."
    )
    return out


# ---------------------------------------------------------------------------------------------
# technicals on weekly bars
# ---------------------------------------------------------------------------------------------


def _rsi(close: pd.Series, n: int = 14) -> float | None:
    if len(close) <= n:
        return None
    delta = close.diff().dropna()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    last_loss = float(loss.iloc[-1])
    if last_loss == 0:
        return 100.0 if float(gain.iloc[-1]) > 0 else 50.0
    rs = float(gain.iloc[-1]) / last_loss
    return 100 - 100 / (1 + rs)


def technical_block(series: pd.Series) -> dict[str, Any] | None:
    weekly = series.resample("W-FRI").last().dropna()
    n = len(weekly)
    if n < 14:
        return {"weeks": n, "note": f"Only {n} weekly bar(s); trend indicators need at least 14."}

    price = float(weekly.iloc[-1])
    rows: list[dict[str, Any]] = []
    votes: list[float] = []

    def add(name: str, value: str, signal: str, vote: float | None, note: str = "") -> None:
        rows.append({"indicator": name, "value": value, "signal": signal, "note": note})
        if vote is not None:
            votes.append(vote)

    rsi = _rsi(weekly)
    if rsi is not None:
        if rsi >= 70:
            add("RSI (14w)", f"{rsi:.1f}", "Overbought", -0.5, "Above 70: stretched, mean reversion risk")
        elif rsi <= 30:
            add("RSI (14w)", f"{rsi:.1f}", "Oversold", 0.5, "Below 30: washed out")
        else:
            add("RSI (14w)", f"{rsi:.1f}", "Bullish" if rsi > 55 else "Bearish" if rsi < 45 else "Neutral", (rsi - 50) / 50)

    macd_info = None
    if n >= 35:
        ema12 = weekly.ewm(span=12, adjust=False).mean()
        ema26 = weekly.ewm(span=26, adjust=False).mean()
        macd = ema12 - ema26
        signal = macd.ewm(span=9, adjust=False).mean()
        hist = float(macd.iloc[-1] - signal.iloc[-1])
        macd_info = {"macd": _r(float(macd.iloc[-1]), 4), "signal": _r(float(signal.iloc[-1]), 4), "hist": _r(hist, 4)}
        add("MACD (12,26,9 weekly)", f"{hist:+.3f}", "Bullish" if hist > 0 else "Bearish", 0.6 if hist > 0 else -0.6, "Histogram above zero means momentum is rising")

    mas: dict[str, float | None] = {}
    for weeks, label in ((10, "SMA 10w"), (26, "SMA 26w"), (52, "SMA 52w")):
        if n >= weeks:
            ma = float(weekly.rolling(weeks).mean().iloc[-1])
            mas[label] = _r(ma, 2)
            above = price >= ma
            add(label, f"₹{ma:,.2f}", "Bullish" if above else "Bearish", 0.5 if above else -0.5, f"Price is {abs(price / ma - 1) * 100:.1f}% {'above' if above else 'below'}")
    if "SMA 10w" in mas and "SMA 26w" in mas and mas["SMA 10w"] and mas["SMA 26w"]:
        fast, slow = mas["SMA 10w"], mas["SMA 26w"]
        add("10w / 26w cross", "Golden" if fast > slow else "Death", "Bullish" if fast > slow else "Bearish", 0.4 if fast > slow else -0.4)

    for weeks, label in ((4, "Momentum 4w"), (13, "Momentum 13w")):
        if n > weeks:
            chg = (price / float(weekly.iloc[-1 - weeks]) - 1) * 100
            add(label, f"{chg:+.1f}%", "Bullish" if chg > 2 else "Bearish" if chg < -2 else "Neutral", float(np.clip(chg / 20, -0.6, 0.6)))

    bollinger = None
    if n >= 20:
        mid = float(weekly.rolling(20).mean().iloc[-1])
        sd = float(weekly.rolling(20).std(ddof=0).iloc[-1])
        if sd > 0:
            pct_b = (price - (mid - 2 * sd)) / (4 * sd)
            bollinger = {"mid": _r(mid, 2), "upper": _r(mid + 2 * sd, 2), "lower": _r(mid - 2 * sd, 2), "percent_b": _r(pct_b, 2)}
            add("Bollinger %B (20w)", f"{pct_b:.2f}", "Overbought" if pct_b > 1 else "Oversold" if pct_b < 0 else "Neutral", -0.3 if pct_b > 1 else 0.3 if pct_b < 0 else 0.0)

    score = float(np.clip(np.mean(votes) * 100, -100, 100)) if votes else 0.0
    rating = (
        "Strong Bullish" if score >= 40 else "Bullish" if score >= 15 else "Neutral" if score > -15 else "Bearish" if score > -40 else "Strong Bearish"
    )
    return {
        "weeks": n,
        "basis": "Weekly bars built from the dealer price. Daily indicators would mostly read a flat line.",
        "composite_score": _r(score, 1),
        "composite_rating": rating,
        "rsi": _r(rsi, 1),
        "macd": macd_info,
        "moving_averages": mas,
        "bollinger": bollinger,
        "indicators_table": rows,
    }


# ---------------------------------------------------------------------------------------------
# forecast: stationary bootstrap on monthly returns
# ---------------------------------------------------------------------------------------------


def forecast_block(series: pd.Series) -> dict[str, Any] | None:
    rets = monthly_log_returns(series).to_numpy()
    n = len(rets)
    if n < MIN_MONTHS_FOR_STATS:
        return {"months": n, "note": f"Only {n} monthly return(s); no forecast is made."}

    price = float(series.iloc[-1])
    # Half the historical drift is removed. A run of upward dealer revisions would otherwise
    # be extrapolated as if it were the long-run expectation.
    centred = rets - 0.5 * rets.mean()
    rng = np.random.default_rng(7)
    block_p = 1 / 3.0  # mean block length of three months keeps the persistence of revisions

    horizons = (1, 3, 6, 12)
    out_h = []
    for h in horizons:
        sims = np.empty(BOOTSTRAP_SIMS)
        for k in range(BOOTSTRAP_SIMS):
            total, i = 0.0, int(rng.integers(n))
            for _ in range(h):
                total += centred[i]
                i = int(rng.integers(n)) if rng.random() < block_p else (i + 1) % n
            sims[k] = total
        pcts = np.quantile(sims, [0.1, 0.5, 0.9])
        out_h.append(
            {
                "months": h,
                "p10_price": _r(price * math.exp(pcts[0]), 2),
                "p50_price": _r(price * math.exp(pcts[1]), 2),
                "p90_price": _r(price * math.exp(pcts[2]), 2),
                "p10_return_pct": _r((math.exp(pcts[0]) - 1) * 100, 1),
                "p50_return_pct": _r((math.exp(pcts[1]) - 1) * 100, 1),
                "p90_return_pct": _r((math.exp(pcts[2]) - 1) * 100, 1),
                "prob_loss_pct": _r(float((sims < 0).mean()) * 100, 1),
            }
        )
    p50_6 = next(h["p50_return_pct"] for h in out_h if h["months"] == 6)
    bias = "Mildly positive" if p50_6 and p50_6 > 3 else "Mildly negative" if p50_6 and p50_6 < -3 else "Neutral"
    return {
        "method": "Stationary block bootstrap of monthly log returns, 4,000 paths, half of the historical drift removed",
        "months_of_history": n,
        "confidence": "Low" if n < 24 else "Moderate" if n < 48 else "Fair",
        "bias": bias,
        "horizons": out_h,
        "note": "A range of outcomes the past monthly moves allow, not a prediction. It cannot see a funding round, a DRHP filing or a downward revision that has not happened yet.",
    }


# ---------------------------------------------------------------------------------------------
# valuation models
# ---------------------------------------------------------------------------------------------


def _tier(upside_pct: float) -> str:
    if upside_pct >= 40:
        return "Deep Discount"
    if upside_pct >= 15:
        return "Discount"
    if upside_pct > -15:
        return "Fair Value"
    if upside_pct > -35:
        return "Premium"
    return "Rich"


def valuation_block(
    price: float,
    series: pd.Series,
    facts: dict[str, float | None],
    benchmarks: dict[str, Any] | None,
    macro: dict[str, Any] | None,
    beta: float | None,
    dlom: float = DEFAULT_DLOM,
) -> dict[str, Any] | None:
    """Fair-value estimates from book value, earnings and benchmark multiples, after an illiquidity discount."""
    pb, pe, bv = facts.get("pb"), facts.get("pe"), facts.get("book_value")
    # Book value is implied by price / P/B when the page does not print it
    if bv is None and pb and pb > 0:
        bv = price / pb
    eps = price / pe if pe and pe > 0 else None
    roe = (pb / pe) if (pb and pe and pe > 0 and pb > 0) else None

    bench = benchmarks or {}
    sector_b = bench.get("sector") or {}
    broad_b = bench.get("broad") or {}
    primary = sector_b if (sector_b.get("pb") or sector_b.get("pe")) else broad_b
    primary_name = primary.get("name") if primary else None

    rf_pct = ((macro or {}).get("sovereign_yields") or {}).get("india_10y_pct")
    rf_assumed = rf_pct is None
    rf = (rf_pct if rf_pct is not None else FALLBACK_RISK_FREE * 100) / 100.0
    b = float(np.clip(beta, 0.6, 1.8)) if beta is not None else 1.0
    ke = rf + b * EQUITY_RISK_PREMIUM
    g = min(TERMINAL_GROWTH, max(0.0, ke - 0.03))

    models: list[dict[str, Any]] = []

    def model(key: str, name: str, fair: float | None, weight: float, basis: str, inputs: dict[str, Any], caveat: str = "") -> None:
        if fair is None or not math.isfinite(fair) or fair <= 0:
            return
        models.append(
            {
                "key": key,
                "name": name,
                "fair_value": _r(fair, 2),
                "upside_pct": _r((fair / price - 1) * 100, 1),
                "weight": weight,
                "basis": basis,
                "inputs": inputs,
                "caveat": caveat,
            }
        )

    if bv and primary.get("pb"):
        fair = bv * primary["pb"] * (1 - dlom)
        model(
            "pb_relative", f"Relative P/B vs {primary_name}", fair, 0.35,
            "Book value per share x benchmark price-to-book x (1 - illiquidity discount)",
            {"book_value": _r(bv, 2), "benchmark_pb": _r(primary["pb"], 2), "dlom_pct": dlom * 100},
            "Index P/B is an average across large listed companies; a small private company can deserve less.",
        )
    if eps and primary.get("pe"):
        fair = eps * primary["pe"] * (1 - dlom)
        model(
            "pe_relative", f"Relative P/E vs {primary_name}", fair, 0.30,
            "Earnings per share (price / P/E) x benchmark P/E x (1 - illiquidity discount)",
            {"eps": _r(eps, 2), "benchmark_pe": _r(primary["pe"], 2), "dlom_pct": dlom * 100},
            "Needs positive earnings; a single year of profit can mislead.",
        )
    if bv and roe is not None and ke > g and roe > 0:
        justified_pb = min((roe - g) / (ke - g), 10.0)  # capped: an ROE far above the cost of equity cannot persist for ever
        fair = bv * max(justified_pb, 0.0) * (1 - dlom)
        model(
            "justified_pb", "Justified P/B (ROE vs cost of equity)", fair, 0.20,
            "Book value x (ROE - g) / (Ke - g) x (1 - illiquidity discount), with ROE = P/B divided by P/E",
            {
                "roe_pct": _r(roe * 100, 1), "cost_of_equity_pct": _r(ke * 100, 2), "terminal_growth_pct": _r(g * 100, 1),
                "risk_free_pct": _r(rf * 100, 2), "risk_free_assumed": rf_assumed, "beta_used": _r(b, 2), "dlom_pct": dlom * 100,
            },
            "Very sensitive to ROE persisting forever; treat as a cross-check on the relative models.",
        )
    year = series.loc[series.index[-1] - pd.Timedelta(days=365):]
    if len(year) >= 90:
        model(
            "reversion", "12-month median price (mean reversion anchor)", float(year.median()), 0.15,
            "Median of the last 12 months of dealer prices",
            {"window_days": int(len(year))},
            "Only says where the price has spent its time. It is not a value estimate.",
        )

    if not models:
        return {
            "available": False,
            "note": "No valuation model could be built: the source published no usable book value, P/B or P/E for this company, or no benchmark multiples were available.",
            "inputs": {"price": _r(price, 2), "pb": pb, "pe": pe, "book_value": _r(bv, 2)},
        }

    total_w = sum(m["weight"] for m in models)
    for m in models:
        m["weight_used"] = _r(m["weight"] / total_w, 3)
    blended = sum(m["fair_value"] * m["weight_used"] for m in models)
    fair_low = min(m["fair_value"] for m in models)
    fair_high = max(m["fair_value"] for m in models)
    upside = (blended / price - 1) * 100

    # What the blend becomes if the illiquidity discount or the benchmark multiple is different
    scales = (0.8, 0.9, 1.0, 1.1, 1.2)
    dloms = (0.15, 0.20, 0.25, 0.30, 0.35)
    relative = [m for m in models if m["key"] in ("pb_relative", "pe_relative", "justified_pb")]
    sens = []
    for d in dloms:
        row: dict[str, Any] = {"DLOM": f"{int(d * 100)}%"}
        for s in scales:
            vals = []
            for m in models:
                if m["key"] in ("pb_relative", "pe_relative", "justified_pb"):
                    vals.append(m["fair_value"] / (1 - dlom) * (1 - d) * s * m["weight_used"])
                else:
                    vals.append(m["fair_value"] * m["weight_used"])
            row[f"x{s:.1f}"] = _r(sum(vals), 2)
        sens.append(row)

    return {
        "available": True,
        "price": _r(price, 2),
        "blended_fair_value": _r(blended, 2),
        "fair_value_low": _r(fair_low, 2),
        "fair_value_high": _r(fair_high, 2),
        "upside_pct": _r(upside, 1),
        "valuation_tier": _tier(upside),
        "models": models,
        "benchmark": {"name": primary_name, "pe": _r(primary.get("pe"), 2), "pb": _r(primary.get("pb"), 2), "dividend_yield": _r(primary.get("dividendYield"), 2)},
        "broad_benchmark": {"name": broad_b.get("name"), "pe": _r(broad_b.get("pe"), 2), "pb": _r(broad_b.get("pb"), 2)} if broad_b else None,
        "company_multiples": {"pb": _r(pb, 2), "pe": _r(pe, 2), "book_value": _r(bv, 2), "roe_pct": _r(roe * 100, 1) if roe is not None else None, "debt_equity": _r(facts.get("debt_equity"), 2)},
        "assumptions": {
            "dlom_pct": dlom * 100,
            "equity_risk_premium_pct": EQUITY_RISK_PREMIUM * 100,
            "terminal_growth_pct": _r(g * 100, 1),
            "cost_of_equity_pct": _r(ke * 100, 2),
            "risk_free_pct": _r(rf * 100, 2),
            "risk_free_assumed": rf_assumed,
            "note": "The illiquidity discount, equity risk premium and growth rate are assumptions, not measurements. The grid below shows what happens when they change.",
        },
        "sensitivity": {"scale_columns": [f"x{s:.1f}" for s in scales], "rows": sens, "meaning": "Blended fair value per share. Columns scale the benchmark multiples; rows change the illiquidity discount."},
        "relative_models_count": len(relative),
    }


# ---------------------------------------------------------------------------------------------
# news and macro pillars
# ---------------------------------------------------------------------------------------------


def news_signal(moves: list[Any]) -> dict[str, Any]:
    """Whether the headlines attached to each revision agree with the direction the price went."""
    total = agree = 0
    tones: list[float] = []
    for m in moves:
        heads = getattr(m, "headlines", None) or (m.get("headlines") if isinstance(m, dict) else [])
        change = getattr(m, "change", None) if not isinstance(m, dict) else m.get("change")
        if not heads or change is None or change == 0:
            continue
        labels = [h.get("sentiment_label") for h in heads if isinstance(h, dict)]
        pos = sum(1 for lab in labels if lab == "positive")
        neg = sum(1 for lab in labels if lab == "negative")
        if pos == neg:
            continue
        total += 1
        tone = 1.0 if pos > neg else -1.0
        tones.append(tone)
        if (tone > 0) == (change > 0):
            agree += 1
    return {
        "moves_with_headlines": total,
        "agree": agree,
        "net_tone": _r(float(np.mean(tones)), 2) if tones else None,
        "agreement_pct": _r(agree / total * 100, 1) if total else None,
    }


def _macro_pillar(macro: dict[str, Any]) -> tuple[float, str, str] | None:
    score = 0.0
    parts: list[str] = []
    pmi = (macro.get("pmi") or {}).get("composite")
    if pmi is not None:
        score += 20.0 if pmi >= 52 else 10.0 if pmi >= 50 else -20.0
        parts.append(f"PMI {pmi:.1f}")
    cpi = (macro.get("cpi_inflation") or {}).get("value")
    if cpi is not None:
        score += 10.0 if 2.0 <= cpi <= 6.0 else (-15.0 if cpi > 6.0 else -5.0)
        parts.append(f"CPI {cpi:.1f}%")
    iip = (macro.get("iip_growth") or {}).get("value")
    if iip is not None:
        score += 10.0 if iip > 4.0 else (-10.0 if iip < 0.0 else 0.0)
        parts.append(f"IIP {iip:+.1f}%")
    core = (macro.get("eight_core_industries") or {}).get("combined_growth_yoy_pct")
    if core is not None:
        score += 10.0 if core > 5.0 else (-10.0 if core < 2.0 else 0.0)
        parts.append(f"8 Core {core:+.1f}%")
    if not parts:
        return None
    return float(np.clip(score, -100, 100)), " | ".join(parts), "Macro read from live releases; nothing is assumed for indicators that could not be retrieved."


# ---------------------------------------------------------------------------------------------
# the call
# ---------------------------------------------------------------------------------------------


def _stance(score: float) -> str:
    return "Strong Bullish" if score >= 40 else "Bullish" if score >= 15 else "Neutral" if score >= -15 else "Bearish" if score >= -40 else "Strong Bearish"


def compute_unlisted_verdict(
    price: float,
    as_of: date | str,
    valuation: dict[str, Any] | None,
    technical: dict[str, Any] | None,
    risk: dict[str, Any],
    forecast: dict[str, Any] | None,
    news: dict[str, Any],
    macro: dict[str, Any],
    profile: dict[str, Any],
    facts: dict[str, float | None],
    news_available: bool,
) -> InvestmentVerdict:
    pillars: list[InvestmentThesisPillar] = []

    # 1. Valuation
    if valuation and valuation.get("available"):
        up = float(valuation["upside_pct"])
        v = 70 if up >= 40 else 50 if up >= 25 else 25 if up >= 10 else 0 if up > -10 else -25 if up > -25 else -50 if up > -40 else -70
        n_models = len(valuation["models"])
        pillars.append(
            InvestmentThesisPillar(
                "1. Valuation vs Listed Peers & Intrinsic", 35.0, float(v), _stance(v),
                f"Blended fair value ₹{valuation['blended_fair_value']:,.2f} | {up:+.1f}% | {valuation['valuation_tier']}",
                f"{n_models} model(s) after a {valuation['assumptions']['dlom_pct']:.0f}% illiquidity discount; fair value range ₹{valuation['fair_value_low']:,.2f} to ₹{valuation['fair_value_high']:,.2f}. "
                "The discount and the benchmark multiple are assumptions, shown in the sensitivity grid.",
            )
        )
    else:
        pillars.append(InvestmentThesisPillar("1. Valuation vs Listed Peers & Intrinsic", 35.0, 0.0, "Not assessed", "No model could be built", "The source published too little (book value, P/B, P/E) or no benchmark was available, so valuation is left out and its weight is shared across the other pillars."))

    # 2. Trend
    if technical and technical.get("composite_score") is not None:
        s = float(technical["composite_score"])
        pillars.append(InvestmentThesisPillar("2. Price Trend & Momentum (weekly)", 20.0, s, _stance(s), f"{technical['composite_rating']} (score {s:+.0f}) | RSI {technical.get('rsi')}", f"Indicators on {technical['weeks']} weekly bars of the dealer price. A revised quote moves in steps, so trends are slow and can reverse on one revision."))
    else:
        pillars.append(InvestmentThesisPillar("2. Price Trend & Momentum (weekly)", 20.0, 0.0, "Not assessed", "Too little history", "Fewer than 14 weekly bars, so trend indicators are not computed."))

    # 3. News and catalyst flow
    if news_available and news.get("moves_with_headlines"):
        tone = news.get("net_tone") or 0.0
        agree = (news.get("agreement_pct") or 50.0) / 100.0
        # One agreeing headline is an anecdote: the signal is scaled up to full strength only as the sample reaches five revisions
        support = min(1.0, news["moves_with_headlines"] / 5.0)
        s = float(np.clip(40.0 * tone * (0.5 + 0.5 * agree) * support, -100, 100))
        pillars.append(InvestmentThesisPillar("3. News & Catalyst Flow", 10.0, s, _stance(s), f"{news['moves_with_headlines']} revisions with headlines | {news['agreement_pct']:.0f}% agree", "Share of price revisions whose attached headlines point the same way as the move. Timing only: a headline in the window is not proof it moved the price."))
    elif not news_available:
        pillars.append(InvestmentThesisPillar("3. News & Catalyst Flow", 10.0, 0.0, "Not assessed", "No news analysed", "No news was collected, so this pillar is left out."))
    else:
        pillars.append(InvestmentThesisPillar("3. News & Catalyst Flow", 10.0, 0.0, "Neutral", "No headline-backed revisions", "No price revision had a clearly positive or negative headline in its window, so news adds no signal."))

    # 4. Macro
    m = _macro_pillar(macro)
    if m:
        pillars.append(InvestmentThesisPillar("4. Macroeconomic Backdrop", 10.0, m[0], _stance(m[0]), m[1], m[2]))
    else:
        pillars.append(InvestmentThesisPillar("4. Macroeconomic Backdrop", 10.0, 0.0, "Not assessed", "No indicator retrieved", "No macro indicator could be retrieved, so this pillar is left out."))

    # 5. Risk, leverage and liquidity
    rscore = 0.0
    notes: list[str] = []
    vol = risk.get("annualised_vol_pct")
    if vol is not None:
        rscore += 25 if vol < 25 else 0 if vol < 45 else -25
        notes.append(f"annualised vol {vol:.0f}%")
    dd = (profile.get("drawdown") or {}).get("max_drawdown_pct")
    if dd is not None and dd <= -50:
        rscore -= 20
        notes.append(f"max drawdown {dd:.0f}%")
    elif dd is not None:
        notes.append(f"max drawdown {dd:.0f}%")
    de = facts.get("debt_equity")
    if de is not None:
        rscore += 10 if de <= 0.5 else (-20 if de > 2 else 0)
        notes.append(f"D/E {de:.2f}")
    stale = (risk.get("liquidity") or {}).get("stale_day_share_pct")
    if stale is not None and stale >= 90:
        rscore -= 15
        notes.append(f"price unchanged {stale:.0f}% of days")
    var95 = (risk.get("var_1m") or {}).get("historical_95_pct") or (risk.get("var_1m") or {}).get("parametric_95_pct")
    if var95 is not None and var95 > 25:
        rscore -= 15
        notes.append(f"1-month VaR 95 {var95:.0f}%")
    rscore = float(np.clip(rscore, -100, 100))
    pillars.append(InvestmentThesisPillar("5. Risk, Leverage & Liquidity", 25.0, rscore, _stance(rscore), " | ".join(notes) or "Limited data", "Volatility and drawdown from monthly returns, leverage from the reported debt to equity, and liquidity from how rarely the dealer price changes."))

    excluded = {i for i, p in enumerate(pillars) if p.stance == "Not assessed"}
    if excluded:
        rest = sum(p.weight_pct for i, p in enumerate(pillars) if i not in excluded)
        for i, p in enumerate(pillars):
            p.weight_pct = 0.0 if i in excluded else round(p.weight_pct * 100.0 / rest, 2)

    composite = sum(p.score * (p.weight_pct / 100.0) for p in pillars)
    conviction = float(np.clip(50.0 + composite * 0.5, 5.0, 85.0))
    # Few revisions or a short history cannot support high confidence however good the numbers look
    revs = (profile.get("revisions") or {}).get("count", 0)
    months = risk.get("months", 0)
    thin = revs < 24 or months < 12
    if thin:
        conviction = min(conviction, 65.0)

    if composite >= 35:
        call, badge = "STRONG BUY", "osint-badge-pos"
        one = "High-conviction BUY: the share screens well below a liquidity-adjusted fair value, with a supportive trend and manageable risk."
    elif composite >= 12:
        call, badge = "BUY / ACCUMULATE", "osint-badge-pos"
        one = "Constructive ACCUMULATE: priced below fair value after an illiquidity discount. Build the position slowly and expect a long hold."
    elif composite >= -15:
        call, badge = "HOLD / NEUTRAL", "osint-badge-cyan"
        one = "NEUTRAL / HOLD: priced close to a liquidity-adjusted fair value. Keep an existing holding and wait for a better entry or a catalyst."
    elif composite >= -35:
        call, badge = "REDUCE / TAKE PROFIT", "osint-badge-warn"
        one = "REDUCE: the quote sits above a liquidity-adjusted fair value or risk has risen. Use any buyer to trim."
    else:
        call, badge = "SELL / AVOID", "osint-badge-neg"
        one = "SELL / AVOID: rich against listed peers after the illiquidity discount, with weak trend or high risk, and exits are thin."

    # Valuation guard: a call must not contradict the fair-value estimate it rests on most heavily.
    guard_note = ""
    v_up = float(valuation["upside_pct"]) if valuation and valuation.get("available") else None
    if v_up is not None:
        if "BUY" in call and v_up < 0:
            call, badge = "HOLD / NEUTRAL", "osint-badge-cyan"
            one = "NEUTRAL / HOLD: the other pillars are constructive, but the quote is already above its liquidity-adjusted fair value, so there is no margin of safety to buy into."
            guard_note = "A buy call was held back because the quote is above the blended fair value. "
        elif call.startswith("HOLD") and v_up <= -50:
            call, badge = "REDUCE / TAKE PROFIT", "osint-badge-warn"
            one = "REDUCE: the quote is more than half above its liquidity-adjusted fair value. Trend and risk look acceptable, but valuation leaves no cushion if the dealer price is revised down."
            guard_note = "A neutral call was lowered to reduce because the quote is far above the blended fair value. "

    # Levels
    fair = valuation.get("blended_fair_value") if valuation and valuation.get("available") else None
    var_for_stop = (risk.get("var_1m") or {}).get("historical_95_pct") or (risk.get("var_1m") or {}).get("parametric_95_pct") or 15.0
    stop_pct = float(np.clip(var_for_stop * 1.2, 10.0, 25.0))
    stop = price * (1 - stop_pct / 100)
    entry_low, entry_high = price * 0.97, price * 1.01
    p50_6 = None
    if forecast and forecast.get("horizons"):
        p50_6 = next((h["p50_return_pct"] for h in forecast["horizons"] if h["months"] == 6), None)
    if fair and fair > price * 1.05:
        t1 = price + 0.6 * (fair - price)
        t2 = fair
    else:
        base = max(5.0, p50_6 or 5.0)
        t1 = price * (1 + base / 100)
        t2 = price * (1 + base * 1.8 / 100)
    t1_up = (t1 / price - 1) * 100
    t2_up = (t2 / price - 1) * 100
    rr = f"1 : {t1_up / stop_pct:.2f}"

    # Sizing: smaller than for a listed stock, rounded down to whole lots
    vol_a = max(0.2, (vol or 35.0) / 100.0)
    exp_ret = max(0.02, conviction / 100.0 * 0.15)
    raw_kelly = exp_ret / (vol_a**2) * 100.0
    half_kelly = raw_kelly * 0.5
    cap = 3.0
    alloc = float(np.clip(half_kelly, 1.0, cap)) if "BUY" in call else float(np.clip(half_kelly, 0.5, 1.5)) if "HOLD" in call else 0.0
    lot = int(facts.get("lot_size") or 1)
    tiers = []
    for name, capital in (("Conservative Tier (₹10 Lakhs)", 1_000_000.0), ("Balanced Institutional Tier (₹25 Lakhs)", 2_500_000.0), ("High-Net-Worth / Institutional Tier (₹1 Crore)", 10_000_000.0)):
        budget = capital * alloc / 100.0
        lots = int(math.floor(budget / (price * lot))) if price > 0 else 0
        qty = lots * lot
        exposure = qty * price
        risk_inr = qty * (price - stop)
        tiers.append(PortfolioSizingTier(name, capital, alloc, budget, qty, exposure, risk_inr, risk_inr / capital * 100.0))

    min_ticket = lot * price
    profit_booking = [
        f"Milestone 1 (₹ {t1:,.2f} / +{t1_up:.1f}%): book part of the position if a buyer is available. Unlisted exits are slow, so quote the price you are willing to take and be patient.",
        f"Milestone 2 (₹ {t2:,.2f} / +{t2_up:.1f}%): the liquidity-adjusted fair value. A DRHP filing or an IPO date is the cleanest exit; plan around it.",
        f"Minimum ticket is one lot of {lot:,} shares, about ₹ {min_ticket:,.0f}. Positions are rounded down to whole lots, so small portfolios may show zero shares.",
    ]
    invalidation = [
        f"Price revised below ₹ {stop:,.2f} (-{stop_pct:.1f}%): reassess the thesis, since an unlisted share cannot be stopped out at a price the way a listed one can.",
        "A downward revision of more than 15% in one step, or two in a row, signals the dealer's view has turned.",
        "Adverse news: a regulatory action, an audit qualification, a promoter dispute, or a down-round at a lower valuation than your entry.",
        "Valuation closes the gap: if the quote reaches the blended fair value the margin of safety is gone.",
    ]
    thesis = (
        f"The unlisted analysis combines {len([p for p in pillars if p.stance != 'Not assessed'])} assessed pillars into a conviction of {conviction:.1f}/100 and a {call} call. "
        + (f"Valuation: {pillars[0].evidence_rationale} " if pillars[0].stance != "Not assessed" else "")
        + (f"Trend: {pillars[1].metric_highlight}. " if pillars[1].stance != "Not assessed" else "")
        + (f"Risk: {pillars[4].metric_highlight}. " if pillars[4].metric_highlight else "")
        + guard_note
        + ("Confidence is capped because the price history or the revision record is short. " if thin else "")
        + "The price is an indicative dealer level and the share is illiquid, so size small and plan for a long holding period."
    )

    return InvestmentVerdict(
        actionable_call=call, conviction_score=conviction, recommendation_badge=badge, one_line_summary=one, detailed_thesis=thesis,
        pillars=pillars, prescribed_allocation_pct=alloc, raw_kelly_pct=raw_kelly, half_kelly_pct=half_kelly, maximum_allocation_cap_pct=cap,
        sizing_tiers=tiers, current_price=price, entry_zone_low=entry_low, entry_zone_high=entry_high,
        target_1_price=t1, target_1_upside_pct=t1_up, target_2_price=t2, target_2_upside_pct=t2_up,
        stop_loss_price=stop, stop_loss_downside_pct=stop_pct, risk_reward_ratio=rr,
        core_holding_period="12 to 36 months (liquidity-adjusted value convergence, with an IPO or secondary sale as the exit)",
        tactical_holding_period="Not applicable: the price is revised infrequently and exit liquidity is thin, so short swings cannot be traded",
        profit_booking_rules=profit_booking, invalidation_rules=invalidation, as_of_date=str(as_of),
    )


# ---------------------------------------------------------------------------------------------
# entry point
# ---------------------------------------------------------------------------------------------


def build_research(
    series: pd.DataFrame,
    real: pd.DataFrame,
    config_start: date,
    config_end: date,
    context: dict[str, Any] | None,
    moves: list[Any],
    macro: dict[str, Any] | None,
    news_available: bool,
) -> dict[str, Any]:
    """Everything the unlisted dossier shows beyond the price timeline and the news table."""
    close = series["close"].astype(float).dropna()
    close = close[close > 0]  # the source shows 0 where it has no price
    if len(close) < 30:
        return {"available": False, "note": "Fewer than 30 daily points in the window; no analysis beyond the timeline is attempted."}

    ctx = context or {}
    facts = parse_facts(ctx.get("facts"))
    sector = ctx.get("sector")
    price = float(close.iloc[-1])
    macro = macro or {}

    profile = price_profile(close, real["close"].astype(float))
    risk = risk_block(close, facts)
    try:
        mm = market_model(close, sector, config_start, config_end)
    except Exception as exc:  # network or provider failure must not sink the rest
        log.warning("market model failed: %s", exc)
        mm = {"note": f"Market model unavailable: {type(exc).__name__}"}
    tech = technical_block(close)
    fc = forecast_block(close)

    beta = ((mm.get("Nifty 50") or {}).get("beta")) if isinstance(mm, dict) else None
    r2 = ((mm.get("Nifty 50") or {}).get("r_squared")) if isinstance(mm, dict) else None
    # A beta from a regression that explains almost nothing is noise, so it is not used in the cost of equity
    beta_for_ke = beta if (beta is not None and r2 is not None and r2 >= 0.1) else None
    val = valuation_block(price, close, facts, ctx.get("benchmarks"), macro, beta_for_ke)

    news = news_signal(moves)
    verdict = compute_unlisted_verdict(price, config_end, val, tech, risk, fc, news, macro, profile, facts, news_available)

    data_quality = {
        "daily_points": int(len(close)),
        "revisions": profile["revisions"]["count"],
        "months": risk.get("months"),
        "weeks": (tech or {}).get("weeks"),
        "thin": profile["revisions"]["count"] < 24 or (risk.get("months") or 0) < 12,
        "notes": [
            "The price is an indicative dealer level. Statistics are computed monthly or weekly because the daily series is mostly a held value.",
            "Valuation uses the source's own ratios and listed benchmarks; the illiquidity discount is an assumption.",
        ],
    }
    return {
        "available": True,
        "sector": sector,
        "sector_index": sector_index(sector),
        "facts": {k: _r(v, 4) for k, v in facts.items()},
        "price_profile": profile,
        "risk": risk,
        "market_model": mm,
        "technical": tech,
        "forecast": fc,
        "valuation": val,
        "news_signal": news,
        "verdict": verdict.to_dict(),
        "data_quality": data_quality,
    }
