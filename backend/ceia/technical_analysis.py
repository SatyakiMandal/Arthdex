"""Institutional Technical Analysis & 1-Week Quantitative Surveillance Suite.

Implements econometric and quantitative technical indicators on daily and weekly horizons:
1. Trendlines & Multi-Horizon Moving Averages:
   - 20-day SMA, 50-day SMA, 200-day SMA
   - 12-day EMA, 26-day EMA
   - Trend slopes, moving average distances (%), and Golden Cross / Death Cross diagnostics.
2. ADX (Average Directional Index - Wilder 1978):
   - +DI (14), -DI (14), and 14-period smoothed ADX measuring pure directional trend strength.
   - Quantifies trend regimes (Strong Trend vs Choppy / Rangebound Squeeze).
3. MACD (Moving Average Convergence Divergence - Appel 1979):
   - Fast 12 EMA - Slow 26 EMA (MACD Line), 9 EMA (Signal Line), and MACD Histogram.
   - Quantifies momentum velocity, divergences, and crossover triggers.
4. RSI (Relative Strength Index - Wilder 1978):
   - 14-period Wilder's smoothed momentum oscillator with Overbought (>70) / Oversold (<30) thresholds.
5. Bollinger Bands (Bollinger 2001):
   - 20-period 2.0σ Upper, Middle (20 SMA), Lower bands.
   - %B position, Bandwidth volatility expansion/contraction, and ADX-integrated Squeeze detection.
6. Stochastic Oscillator (Lane 1984):
   - 14-period Fast %K, 3-period Slow %D, and Overbought (>80) / Oversold (<20) crossover alerts.
7. Classical & Fibonacci Pivot Points:
   - Key support (S1, S2, S3) and resistance (R1, R2, R3) price levels for the 1-week horizon.
8. Composite 1-Week Technical Synthesis:
   - Multi-indicator weighted consensus score (-100 to +100) and actionable execution playbook.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)


@dataclass
class MovingAverageSnapshot:
    sma_20: float
    sma_50: float
    sma_200: float
    ema_12: float
    ema_26: float
    dist_to_sma_20_pct: float
    dist_to_sma_50_pct: float
    dist_to_sma_200_pct: float
    golden_cross_status: str  # Golden Cross (Bullish), Death Cross (Bearish), Neutral
    ma_trend_bias: str  # Strongly Bullish, Bullish, Neutral, Bearish, Strongly Bearish


@dataclass
class ADXSnapshot:
    adx_14: float
    plus_di_14: float
    minus_di_14: float
    trend_strength: str  # Very Strong Trend (>50), Strong Trend (>25), Developing (20-25), Weak / Rangebound (<20)
    directional_bias: str  # Bullish (+DI > -DI), Bearish (-DI > +DI)


@dataclass
class MACDSnapshot:
    macd_line: float
    signal_line: float
    histogram: float
    crossover_signal: str  # Bullish Crossover, Bearish Crossover, Bullish Expansion, Bearish Expansion, Neutral
    momentum_velocity: str  # Accelerating Upward, Decelerating Upward, Accelerating Downward, Decelerating Downward


@dataclass
class RSISnapshot:
    rsi_14: float
    condition: str  # Overbought (>70), Bullish Momentum (55-70), Neutral (45-55), Bearish Momentum (30-45), Oversold (<30)
    reversal_risk: str  # High Exhaustion, Moderate, Low


@dataclass
class BollingerBandsSnapshot:
    upper_band: float
    middle_band: float
    lower_band: float
    bandwidth_pct: float
    percent_b: float
    squeeze_status: str  # Active Volatility Squeeze (Breakout Imminent), Normal Band Expansion, Extreme Volatility Expansion
    channel_position: str  # Testing Upper Band, Upper Half, Neutral Mean, Lower Half, Testing Lower Band


@dataclass
class StochasticSnapshot:
    slow_k: float
    slow_d: float
    condition: str  # Overbought (>80), Bullish Range (50-80), Bearish Range (20-50), Oversold (<20)
    crossover: str  # Bullish (%K > %D), Bearish (%K < %D)


@dataclass
class PivotPointsSnapshot:
    pivot: float
    r1: float
    r2: float
    r3: float
    s1: float
    s2: float
    s3: float
    fib_r1: float
    fib_r2: float
    fib_s1: float
    fib_s2: float


@dataclass
class TechnicalAnalysisResult:
    """Consolidated 1-Week Technical Surveillance Report."""

    current_price: float
    weekly_return_pct: float
    composite_score: float  # -100 (Strongly Bearish) to +100 (Strongly Bullish)
    composite_rating: str  # Strong Buy, Buy, Neutral, Sell, Strong Sell
    moving_averages: MovingAverageSnapshot
    adx: ADXSnapshot
    macd: MACDSnapshot
    rsi: RSISnapshot
    bollinger: BollingerBandsSnapshot
    stochastic: StochasticSnapshot
    pivots: PivotPointsSnapshot
    indicators_table: list[dict[str, Any]] = field(default_factory=list)
    weekly_playbook: list[dict[str, Any]] = field(default_factory=list)
    summary_verdict: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "current_price": round(self.current_price, 2),
            "weekly_return_pct": round(self.weekly_return_pct, 2),
            "composite_score": round(self.composite_score, 1),
            "composite_rating": self.composite_rating,
            "moving_averages": asdict(self.moving_averages),
            "adx": asdict(self.adx),
            "macd": asdict(self.macd),
            "rsi": asdict(self.rsi),
            "bollinger": asdict(self.bollinger),
            "stochastic": asdict(self.stochastic),
            "pivots": asdict(self.pivots),
            "indicators_table": self.indicators_table,
            "weekly_playbook": self.weekly_playbook,
            "summary_verdict": self.summary_verdict,
        }


def compute_technical_analysis(
    df: pd.DataFrame,
    current_price: float | None = None,
) -> TechnicalAnalysisResult:
    """Compute comprehensive 1-week institutional technical analysis suite."""
    if df.empty or "close" not in df.columns:
        raise ValueError("DataFrame must contain 'close' price column.")

    prices = df["close"].dropna().astype(float)
    highs = df.get("high", prices).dropna().astype(float)
    lows = df.get("low", prices).dropna().astype(float)

    n = len(prices)
    curr_p = float(current_price or prices.iloc[-1])

    # 1-Week Return (last 5 trading sessions)
    w_ret = float(((curr_p - prices.iloc[-5]) / prices.iloc[-5]) * 100.0) if n >= 5 else 0.0

    # -------------------------------------------------------------------------
    # 1. Moving Averages
    # -------------------------------------------------------------------------
    sma_20 = float(prices.rolling(window=min(20, n), min_periods=1).mean().iloc[-1])
    sma_50 = float(prices.rolling(window=min(50, n), min_periods=1).mean().iloc[-1])
    sma_200 = float(prices.rolling(window=min(200, n), min_periods=1).mean().iloc[-1])

    ema_12 = float(prices.ewm(span=min(12, n), adjust=False).mean().iloc[-1])
    ema_26 = float(prices.ewm(span=min(26, n), adjust=False).mean().iloc[-1])

    d_20 = ((curr_p - sma_20) / sma_20) * 100.0 if sma_20 > 0 else 0.0
    d_50 = ((curr_p - sma_50) / sma_50) * 100.0 if sma_50 > 0 else 0.0
    d_200 = ((curr_p - sma_200) / sma_200) * 100.0 if sma_200 > 0 else 0.0

    golden_status = "Neutral"
    if n >= 50:
        if sma_50 > sma_200:
            golden_status = "Golden Cross (Bullish Regime: 50 SMA > 200 SMA)"
        elif sma_50 < sma_200:
            golden_status = "Death Cross (Bearish Regime: 50 SMA < 200 SMA)"

    ma_score = 0
    if curr_p > sma_20: ma_score += 1
    if curr_p > sma_50: ma_score += 1
    if curr_p > sma_200: ma_score += 1
    if ema_12 > ema_26: ma_score += 1

    ma_bias = (
        "Strongly Bullish (Above 20, 50, 200 SMA)" if ma_score == 4
        else "Bullish Alignment (Above Primary MAs)" if ma_score == 3
        else "Neutral / Mixed Moving Averages" if ma_score == 2
        else "Bearish Pressure" if ma_score == 1
        else "Strongly Bearish (Below 20, 50, 200 SMA)"
    )

    ma_snap = MovingAverageSnapshot(
        sma_20=round(sma_20, 2),
        sma_50=round(sma_50, 2),
        sma_200=round(sma_200, 2),
        ema_12=round(ema_12, 2),
        ema_26=round(ema_26, 2),
        dist_to_sma_20_pct=round(d_20, 2),
        dist_to_sma_50_pct=round(d_50, 2),
        dist_to_sma_200_pct=round(d_200, 2),
        golden_cross_status=golden_status,
        ma_trend_bias=ma_bias,
    )

    # -------------------------------------------------------------------------
    # 2. ADX (Average Directional Index) & Directional Movement
    # -------------------------------------------------------------------------
    h_arr = highs.to_numpy()
    l_arr = lows.to_numpy()
    c_arr = prices.to_numpy()

    if n >= 15:
        tr_list = [h_arr[0] - l_arr[0]]
        plus_dm_list = [0.0]
        minus_dm_list = [0.0]

        for i in range(1, n):
            h_diff = h_arr[i] - h_arr[i - 1]
            l_diff = l_arr[i - 1] - l_arr[i]

            plus_dm = h_diff if (h_diff > l_diff and h_diff > 0) else 0.0
            minus_dm = l_diff if (l_diff > h_diff and l_diff > 0) else 0.0

            tr = max(h_arr[i] - l_arr[i], abs(h_arr[i] - c_arr[i - 1]), abs(l_arr[i] - c_arr[i - 1]))
            tr_list.append(tr)
            plus_dm_list.append(plus_dm)
            minus_dm_list.append(minus_dm)

        tr_s = pd.Series(tr_list).ewm(alpha=1/14, adjust=False).mean()
        pdm_s = pd.Series(plus_dm_list).ewm(alpha=1/14, adjust=False).mean()
        mdm_s = pd.Series(minus_dm_list).ewm(alpha=1/14, adjust=False).mean()

        plus_di = (pdm_s / tr_s.replace(0, 1e-6)) * 100.0
        minus_di = (mdm_s / tr_s.replace(0, 1e-6)) * 100.0

        dx = (abs(plus_di - minus_di) / (plus_di + minus_di).replace(0, 1e-6)) * 100.0
        adx_s = dx.ewm(alpha=1/14, adjust=False).mean()

        final_adx = float(adx_s.iloc[-1])
        final_pdi = float(plus_di.iloc[-1])
        final_mdi = float(minus_di.iloc[-1])
    else:
        final_adx = 22.5
        final_pdi = 24.0
        final_mdi = 20.0

    adx_strength = (
        "Extremely Strong Trend (ADX > 50)" if final_adx >= 50
        else "Strong Directional Trend (ADX > 25)" if final_adx >= 25
        else "Moderate / Developing Trend (ADX 20-25)" if final_adx >= 20
        else "Rangebound / Choppy Market (ADX < 20)"
    )
    adx_bias = "Bullish Dominance (+DI > -DI)" if final_pdi >= final_mdi else "Bearish Dominance (-DI > +DI)"

    adx_snap = ADXSnapshot(
        adx_14=round(final_adx, 2),
        plus_di_14=round(final_pdi, 2),
        minus_di_14=round(final_mdi, 2),
        trend_strength=adx_strength,
        directional_bias=adx_bias,
    )

    # -------------------------------------------------------------------------
    # 3. MACD (Moving Average Convergence Divergence)
    # -------------------------------------------------------------------------
    ema12_s = prices.ewm(span=12, adjust=False).mean()
    ema26_s = prices.ewm(span=26, adjust=False).mean()
    macd_line_s = ema12_s - ema26_s
    signal_line_s = macd_line_s.ewm(span=9, adjust=False).mean()
    hist_s = macd_line_s - signal_line_s

    macd_val = float(macd_line_s.iloc[-1])
    signal_val = float(signal_line_s.iloc[-1])
    hist_val = float(hist_s.iloc[-1])
    prev_hist = float(hist_s.iloc[-2]) if n >= 2 else hist_val

    if macd_val > signal_val:
        macd_cross = "Bullish Crossover" if (n >= 2 and float(macd_line_s.iloc[-2]) <= float(signal_line_s.iloc[-2])) else "Bullish Momentum"
    else:
        macd_cross = "Bearish Crossover" if (n >= 2 and float(macd_line_s.iloc[-2]) >= float(signal_line_s.iloc[-2])) else "Bearish Pressure"

    macd_vel = (
        "Accelerating Upward" if hist_val > prev_hist and hist_val > 0
        else "Decelerating Upward" if hist_val <= prev_hist and hist_val > 0
        else "Accelerating Downward" if hist_val < prev_hist and hist_val < 0
        else "Decelerating Downward / Recovering"
    )

    macd_snap = MACDSnapshot(
        macd_line=round(macd_val, 2),
        signal_line=round(signal_val, 2),
        histogram=round(hist_val, 2),
        crossover_signal=macd_cross,
        momentum_velocity=macd_vel,
    )

    # -------------------------------------------------------------------------
    # 4. RSI (Relative Strength Index)
    # -------------------------------------------------------------------------
    deltas = prices.diff()
    gains = deltas.clip(lower=0)
    losses = -deltas.clip(upper=0)

    avg_gain = gains.ewm(alpha=1/14, adjust=False).mean()
    avg_loss = losses.ewm(alpha=1/14, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, 1e-6)
    rsi_s = 100 - (100 / (1 + rs))

    rsi_val = float(rsi_s.iloc[-1]) if n >= 14 else 50.0

    rsi_cond = (
        "Overbought (> 70) — Reversal Alert" if rsi_val >= 70
        else "Bullish Momentum (55 - 70)" if rsi_val >= 55
        else "Neutral / Equilibrium (45 - 55)" if rsi_val >= 45
        else "Bearish Momentum (30 - 45)" if rsi_val >= 30
        else "Oversold (< 30) — Capitulation / Bounce Alert"
    )
    rev_risk = "High Exhaustion Risk" if (rsi_val >= 75 or rsi_val <= 25) else "Moderate" if (rsi_val >= 65 or rsi_val <= 35) else "Low Risk"

    rsi_snap = RSISnapshot(
        rsi_14=round(rsi_val, 2),
        condition=rsi_cond,
        reversal_risk=rev_risk,
    )

    # -------------------------------------------------------------------------
    # 5. Bollinger Bands (20, 2σ)
    # -------------------------------------------------------------------------
    bb_window = min(20, n)
    bb_mid = prices.rolling(window=bb_window, min_periods=1).mean()
    bb_std = prices.rolling(window=bb_window, min_periods=1).std(ddof=0).fillna(curr_p * 0.02)

    bb_upper = bb_mid + (bb_std * 2.0)
    bb_lower = bb_mid - (bb_std * 2.0)

    u_val = float(bb_upper.iloc[-1])
    m_val = float(bb_mid.iloc[-1])
    l_val = float(bb_lower.iloc[-1])

    bw_pct = ((u_val - l_val) / m_val) * 100.0 if m_val > 0 else 5.0
    pct_b = ((curr_p - l_val) / (u_val - l_val)) if (u_val - l_val) > 0 else 0.5

    squeeze = (
        "Active Volatility Squeeze (ADX < 20 & Tight Bands) — Impending Explosion" if (bw_pct < 6.5 and final_adx < 22)
        else "High Volatility Expansion" if bw_pct > 18.0
        else "Normal Volatility Envelope"
    )

    chan_pos = (
        "Piercing Upper Band (> 1.0 %B)" if pct_b >= 1.0
        else "Upper Volatility Quartile (0.75 - 1.0 %B)" if pct_b >= 0.75
        else "Middle Equilibrium Band (0.25 - 0.75 %B)" if pct_b >= 0.25
        else "Lower Volatility Quartile (0.0 - 0.25 %B)" if pct_b >= 0.0
        else "Piercing Lower Band (< 0.0 %B)"
    )

    bb_snap = BollingerBandsSnapshot(
        upper_band=round(u_val, 2),
        middle_band=round(m_val, 2),
        lower_band=round(l_val, 2),
        bandwidth_pct=round(bw_pct, 2),
        percent_b=round(pct_b, 3),
        squeeze_status=squeeze,
        channel_position=chan_pos,
    )

    # -------------------------------------------------------------------------
    # 6. Stochastic Oscillator (14, 3, 3)
    # -------------------------------------------------------------------------
    stoch_window = min(14, n)
    low_14 = lows.rolling(window=stoch_window, min_periods=1).min()
    high_14 = highs.rolling(window=stoch_window, min_periods=1).max()

    fast_k = ((prices - low_14) / (high_14 - low_14).replace(0, 1e-6)) * 100.0
    slow_k = fast_k.rolling(window=3, min_periods=1).mean()
    slow_d = slow_k.rolling(window=3, min_periods=1).mean()

    k_val = float(slow_k.iloc[-1])
    d_val = float(slow_d.iloc[-1])

    stoch_cond = (
        "Overbought (> 80)" if k_val >= 80
        else "Bullish Range (50 - 80)" if k_val >= 50
        else "Bearish Range (20 - 50)" if k_val >= 20
        else "Oversold (< 20)"
    )
    stoch_cross = "Bullish Momentum (%K > %D)" if k_val >= d_val else "Bearish Momentum (%K < %D)"

    stoch_snap = StochasticSnapshot(
        slow_k=round(k_val, 2),
        slow_d=round(d_val, 2),
        condition=stoch_cond,
        crossover=stoch_cross,
    )

    # -------------------------------------------------------------------------
    # 7. Pivot Points & 1-Week Support / Resistance
    # -------------------------------------------------------------------------
    h_week = float(highs.iloc[-5:].max()) if n >= 5 else curr_p * 1.03
    l_week = float(lows.iloc[-5:].min()) if n >= 5 else curr_p * 0.97
    c_week = curr_p

    p_val = (h_week + l_week + c_week) / 3.0
    r1_val = (2 * p_val) - l_week
    s1_val = (2 * p_val) - h_week
    r2_val = p_val + (h_week - l_week)
    s2_val = p_val - (h_week - l_week)
    r3_val = h_week + 2 * (p_val - l_week)
    s3_val = l_week - 2 * (h_week - p_val)

    # Fibonacci Pivots
    diff_hl = h_week - l_week
    fib_r1 = p_val + (0.382 * diff_hl)
    fib_r2 = p_val + (0.618 * diff_hl)
    fib_s1 = p_val - (0.382 * diff_hl)
    fib_s2 = p_val - (0.618 * diff_hl)

    pivot_snap = PivotPointsSnapshot(
        pivot=round(p_val, 2),
        r1=round(r1_val, 2),
        r2=round(r2_val, 2),
        r3=round(r3_val, 2),
        s1=round(s1_val, 2),
        s2=round(s2_val, 2),
        s3=round(s3_val, 2),
        fib_r1=round(fib_r1, 2),
        fib_r2=round(fib_r2, 2),
        fib_s1=round(fib_s1, 2),
        fib_s2=round(fib_s2, 2),
    )

    # -------------------------------------------------------------------------
    # 8. Composite Scoring & Synthesis
    # -------------------------------------------------------------------------
    score = 0.0
    # MA scoring (-30 to +30)
    if curr_p > sma_20: score += 10
    else: score -= 10
    if curr_p > sma_50: score += 10
    else: score -= 10
    if curr_p > sma_200: score += 10
    else: score -= 10

    # MACD scoring (-20 to +20)
    if macd_val > signal_val: score += 15
    else: score -= 15
    if hist_val > prev_hist: score += 5
    else: score -= 5

    # RSI scoring (-20 to +20)
    if 50 <= rsi_val < 70: score += 20
    elif 40 <= rsi_val < 50: score += 5
    elif rsi_val >= 70: score += 5 # Overbought
    elif 30 <= rsi_val < 40: score -= 10
    else: score -= 20 # Oversold

    # ADX & Bollinger Multiplier (-15 to +15)
    if final_pdi > final_mdi: score += 10
    else: score -= 10
    if pct_b > 0.5: score += 5
    else: score -= 5

    # Stochastic (-15 to +15)
    if k_val > d_val: score += 10
    else: score -= 10
    if 20 <= k_val <= 80: score += 5
    else: score -= 5

    score = max(-100.0, min(100.0, score))

    rating = (
        "Strong Buy" if score >= 60
        else "Buy" if score >= 20
        else "Neutral / Hold" if score >= -20
        else "Sell" if score >= -60
        else "Strong Sell"
    )

    indicators_table = [
        {"Indicator": "20-Day SMA", "Value": f"₹ {sma_20:,.2f}", "Distance (%)": f"{d_20:+.2f}%", "Signal": "Bullish" if d_20 > 0 else "Bearish"},
        {"Indicator": "50-Day SMA", "Value": f"₹ {sma_50:,.2f}", "Distance (%)": f"{d_50:+.2f}%", "Signal": "Bullish" if d_50 > 0 else "Bearish"},
        {"Indicator": "200-Day SMA", "Value": f"₹ {sma_200:,.2f}", "Distance (%)": f"{d_200:+.2f}%", "Signal": "Bullish" if d_200 > 0 else "Bearish"},
        {"Indicator": "14-Period ADX", "Value": f"{final_adx:.2f}", "Distance (%)": f"+DI: {final_pdi:.1f} / -DI: {final_mdi:.1f}", "Signal": adx_strength},
        {"Indicator": "MACD (12, 26, 9)", "Value": f"{macd_val:+.2f}", "Distance (%)": f"Signal: {signal_val:+.2f} (Hist: {hist_val:+.2f})", "Signal": macd_cross},
        {"Indicator": "14-Period RSI", "Value": f"{rsi_val:.2f}", "Distance (%)": "Neutral Band (30-70)", "Signal": rsi_cond},
        {"Indicator": "Bollinger Bands (20, 2σ)", "Value": f"₹ {u_val:,.1f} / {l_val:,.1f}", "Distance (%)": f"Bandwidth: {bw_pct:.1f}% (%B: {pct_b:.2f})", "Signal": squeeze},
        {"Indicator": "Stochastic (%K, %D)", "Value": f"%K: {k_val:.1f} / %D: {d_val:.1f}", "Distance (%)": "Range (20-80)", "Signal": stoch_cross},
    ]

    playbook = [
        {"Pillar": "Trend Bias", "Condition": ma_bias, "Action": f"Support base at 50 SMA (₹{sma_50:,.2f}); trail stops below 20 SMA (₹{sma_20:,.2f})."},
        {"Pillar": "Momentum (MACD/RSI)", "Condition": f"RSI: {rsi_val:.1f} · {macd_cross}", "Action": "Align tactical trade entries with histogram acceleration."},
        {"Pillar": "Volatility Regime", "Condition": squeeze, "Action": "Position for volatility expansion; avoid selling naked options during squeeze."},
        {"Pillar": "Support & Resistance", "Condition": f"Weekly Pivot: ₹{p_val:,.2f}", "Action": f"Upside targets R1: ₹{r1_val:,.2f} / R2: ₹{r2_val:,.2f}; Downside buffers S1: ₹{s1_val:,.2f} / S2: ₹{s2_val:,.2f}."},
    ]

    verdict = (
        f"1-Week Quantitative Technical Verdict: {rating.upper()} (Composite Score: {score:+.1f}/100). "
        f"Price is trading at ₹{curr_p:,.2f} ({d_20:+.1f}% vs 20 SMA, {d_50:+.1f}% vs 50 SMA). "
        f"Momentum indicators show {rsi_cond} with {macd_cross}. ADX trend strength is {final_adx:.1f} ({adx_strength})."
    )

    return TechnicalAnalysisResult(
        current_price=curr_p,
        weekly_return_pct=w_ret,
        composite_score=score,
        composite_rating=rating,
        moving_averages=ma_snap,
        adx=adx_snap,
        macd=macd_snap,
        rsi=rsi_snap,
        bollinger=bb_snap,
        stochastic=stoch_snap,
        pivots=pivot_snap,
        indicators_table=indicators_table,
        weekly_playbook=playbook,
        summary_verdict=verdict,
    )
