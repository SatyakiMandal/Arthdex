"""Multi-timeframe technical analysis and the MACD crossover screener."""

from __future__ import annotations

import math
import warnings
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

from . import indicators as ind

warnings.filterwarnings("ignore")

# interval id -> (yfinance period, yfinance interval, bars returned to the chart, intraday?)
# Yahoo serves 5m and 15m for ~60 days and 1h for ~2 years; daily is unrestricted.
INTERVALS: dict[str, tuple[str, str, int, bool]] = {
    "5m": ("30d", "5m", 375, True),
    "15m": ("60d", "15m", 400, True),
    "1h": ("6mo", "60m", 400, True),
    "1d": ("2y", "1d", 400, False),
}
INTERVAL_LABELS = {"5m": "5 minute", "15m": "15 minute", "1h": "1 hour", "1d": "Daily"}


def _f(v: Any, nd: int = 2) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(x) or math.isinf(x) else round(x, nd)


def _series(s: pd.Series, tail: int, nd: int = 2) -> list[float | None]:
    return [_f(v, nd) for v in s.iloc[-tail:].to_numpy()]


def clean_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Drop the in-progress bar Yahoo returns with NaN OHLC, and keep bars in order."""
    if frame is None or frame.empty:
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
    out = frame[["Open", "High", "Low", "Close", "Volume"]].dropna(subset=["Close", "High", "Low"])
    out = out[~out.index.duplicated(keep="last")].sort_index()
    return out


def fetch_bars(symbol: str, interval: str) -> pd.DataFrame:
    period, yf_interval, _n, _intra = INTERVALS[interval]
    frame = yf.Ticker(f"{symbol}.NS").history(period=period, interval=yf_interval, auto_adjust=False)
    return clean_frame(frame)


def _tone(label: str, tone: str, detail: str = "") -> dict[str, str]:
    return {"label": label, "tone": tone, "detail": detail}


def build(symbol: str, interval: str, df: pd.DataFrame) -> dict[str, Any]:
    _period, _yfi, n_bars, intraday = INTERVALS[interval]
    if len(df) < 40:
        raise ValueError(f"Only {len(df)} {INTERVAL_LABELS[interval].lower()} bars available; not enough to compute indicators.")

    close = df["Close"]
    m = ind.macd(close)
    bb = ind.bollinger(close)
    st = ind.stochastic(df)
    ad = ind.adx(df)
    sup = ind.supertrend(df)
    rsi14 = ind.rsi(close)
    mfi14 = ind.mfi(df)
    atr14 = ind.atr(df)
    # Daily VWAP is cumulative from the first bar shown, so anchor it to the chart window
    window = min(n_bars, len(df))
    vw = ind.vwap(df, True) if intraday else ind.vwap(df.iloc[-window:], False).reindex(df.index)
    cross = ind.macd_crossovers(m["hist"])
    tail = min(n_bars, len(df))

    last = float(close.iloc[-1])
    idx = df.index[-tail:]

    def stamp(ts: pd.Timestamp) -> str:
        return ts.isoformat() if intraday else ts.strftime("%Y-%m-%d")

    bars = [
        {
            "t": stamp(ts),
            "o": _f(r.Open),
            "h": _f(r.High),
            "l": _f(r.Low),
            "c": _f(r.Close),
            "v": int(r.Volume) if pd.notna(r.Volume) else 0,
        }
        for ts, r in zip(idx, df.iloc[-tail:].itertuples())
    ]

    series = {
        "sma20": _series(ind.sma(close, 20), tail),
        "sma50": _series(ind.sma(close, 50), tail),
        "sma200": _series(ind.sma(close, 200), tail),
        "ema20": _series(ind.ema(close, 20), tail),
        "ema50": _series(ind.ema(close, 50), tail),
        "bbUpper": _series(bb["upper"], tail),
        "bbMiddle": _series(bb["middle"], tail),
        "bbLower": _series(bb["lower"], tail),
        "supertrend": _series(sup["line"], tail),
        "supertrendDir": _series(sup["direction"], tail, 0),
        "vwap": _series(vw, tail),
        "rsi": _series(rsi14, tail),
        "macd": _series(m["macd"], tail, 3),
        "signal": _series(m["signal"], tail, 3),
        "hist": _series(m["hist"], tail, 3),
        "stochK": _series(st["k"], tail),
        "stochD": _series(st["d"], tail),
        "mfi": _series(mfi14, tail),
        "adx": _series(ad["adx"], tail),
        "plusDI": _series(ad["plusDI"], tail),
        "minusDI": _series(ad["minusDI"], tail),
        "atr": _series(atr14, tail, 3),
    }

    # -- readings ------------------------------------------------------------
    def at(s: pd.Series) -> float | None:
        return _f(s.iloc[-1])

    rsi_v, mfi_v, adx_v = at(rsi14), at(mfi14), at(ad["adx"])
    k_v, d_v = at(st["k"]), at(st["d"])
    atr_v = at(atr14)
    vwap_v = at(vw)
    dirn = sup["direction"].iloc[-1]
    hist_v = _f(m["hist"].iloc[-1], 3)

    crossings = cross[cross != 0]
    last_cross = None
    if len(crossings):
        pos = df.index.get_loc(crossings.index[-1])
        last_cross = {
            "direction": "above" if crossings.iloc[-1] > 0 else "below",
            "at": stamp(crossings.index[-1]),
            "barsAgo": int(len(df) - 1 - pos),
        }

    signals: dict[str, dict[str, str]] = {}
    for name, n in (("SMA 20", 20), ("SMA 50", 50), ("SMA 200", 200)):
        v = at(ind.sma(close, n))
        if v is not None:
            signals[name] = _tone(f"{v:,.2f}", "up" if last > v else "down", "Price above" if last > v else "Price below")
    for name, n in (("EMA 20", 20), ("EMA 50", 50)):
        v = at(ind.ema(close, n))
        if v is not None:
            signals[name] = _tone(f"{v:,.2f}", "up" if last > v else "down", "Price above" if last > v else "Price below")
    if adx_v is not None:
        strength = "Strong trend" if adx_v >= 25 else "Weak / ranging" if adx_v < 20 else "Developing"
        lean = "bullish" if (at(ad["plusDI"]) or 0) > (at(ad["minusDI"]) or 0) else "bearish"
        signals["ADX (14)"] = _tone(f"{adx_v:.1f}", ("up" if lean == "bullish" else "down") if adx_v >= 25 else "flat", f"{strength}, {lean} bias")
    if not pd.isna(dirn):
        signals["Supertrend (10, 3)"] = _tone(
            "Uptrend" if dirn > 0 else "Downtrend", "up" if dirn > 0 else "down",
            f"Line at {_f(sup['line'].iloc[-1]):,.2f}",
        )
    if rsi_v is not None:
        signals["RSI (14)"] = _tone(f"{rsi_v:.1f}", "down" if rsi_v > 70 else "up" if rsi_v < 30 else "flat", "Overbought" if rsi_v > 70 else "Oversold" if rsi_v < 30 else "Neutral")
    if hist_v is not None:
        above = (hist_v or 0) > 0
        detail = f"Last crossover {last_cross['direction']} signal, {last_cross['barsAgo']} bars ago" if last_cross else "No crossover in range"
        signals["MACD (12, 26, 9)"] = _tone("Above signal" if above else "Below signal", "up" if above else "down", detail)
    if k_v is not None and d_v is not None:
        signals["Stochastic (14, 3, 3)"] = _tone(f"%K {k_v:.1f} / %D {d_v:.1f}", "down" if k_v > 80 else "up" if k_v < 20 else "flat", "Overbought" if k_v > 80 else "Oversold" if k_v < 20 else "Neutral")
    if mfi_v is not None:
        signals["Money Flow Index (14)"] = _tone(f"{mfi_v:.1f}", "down" if mfi_v > 80 else "up" if mfi_v < 20 else "flat", "Overbought" if mfi_v > 80 else "Oversold" if mfi_v < 20 else "Neutral")
    if atr_v is not None:
        signals["ATR (14)"] = _tone(f"{atr_v:.2f}", "flat", f"{atr_v / last * 100:.2f}% of price per bar")
    pb = at(bb["percentB"])
    if pb is not None:
        signals["Bollinger (20, 2σ)"] = _tone(f"%B {pb:.2f}", "down" if pb > 1 else "up" if pb < 0 else "flat", f"Bandwidth {at(bb['bandwidth'])}%")
    if vwap_v is not None:
        signals["VWAP"] = _tone(f"{vwap_v:,.2f}", "up" if last > vwap_v else "down", "Price above" if last > vwap_v else "Price below")

    bullish = sum(1 for s in signals.values() if s["tone"] == "up")
    bearish = sum(1 for s in signals.values() if s["tone"] == "down")

    return {
        "symbol": symbol,
        "interval": interval,
        "intervalLabel": INTERVAL_LABELS[interval],
        "intraday": intraday,
        "barsAvailable": int(len(df)),
        "lastClose": _f(last),
        "asOf": stamp(df.index[-1]),
        "bars": bars,
        "series": series,
        "levels": ind.support_resistance(df.iloc[-min(len(df), 300):]),
        "signals": signals,
        "tally": {"bullish": bullish, "bearish": bearish, "neutral": len(signals) - bullish - bearish},
        "lastCrossover": last_cross,
    }


# -- MACD crossover screener ---------------------------------------------------

SCREEN_PERIOD = {"5m": "5d", "15m": "10d", "1h": "1mo", "1d": "6mo"}


def _download(symbols: list[str], interval: str) -> dict[str, pd.DataFrame]:
    _p, yf_interval, _n, _i = INTERVALS[interval]
    raw = yf.download(
        [f"{s}.NS" for s in symbols],
        period=SCREEN_PERIOD[interval],
        interval=yf_interval,
        group_by="ticker",
        auto_adjust=False,
        threads=True,
        progress=False,
    )
    out: dict[str, pd.DataFrame] = {}
    if raw is None or raw.empty:
        return out
    for s in symbols:
        try:
            sub = raw[f"{s}.NS"]
        except KeyError:
            continue
        sub = clean_frame(sub)
        if len(sub) >= 40:
            out[s] = sub
    return out


def macd_crossover_screen(
    constituents: list[dict[str, Any]], interval: str, direction: str, within: int
) -> dict[str, Any]:
    """Stocks whose MACD crossed its signal line in the last `within` bars, with an analysis
    of the whole scanned universe.

    Outside market hours "the last bars" are the tail of the most recent session.
    Both directions are counted so the analysis can say which way the market is leaning, not
    only list the stocks matching the requested one.
    """
    from .insights import finding, table, tile

    symbols = [c["symbol"] for c in constituents]
    names = {c["symbol"]: c for c in constituents}
    frames = _download(symbols, interval)
    want = 1 if direction == "above" else -1
    intraday = INTERVALS[interval][3]

    rows: list[dict[str, Any]] = []
    n_up = n_dn = above_sig = above_zero = 0
    scanned = 0
    for s_, df in frames.items():
        close = df["Close"]
        m = ind.macd(close)
        cross = ind.macd_crossovers(m["hist"])
        recent = cross.iloc[-within:]
        scanned += 1
        above_sig += int(m["hist"].iloc[-1] > 0)
        above_zero += int(m["macd"].iloc[-1] > 0)
        # a cross that has since reversed no longer counts
        up_hit = bool((recent == 1).any() and m["hist"].iloc[-1] > 0)
        dn_hit = bool((recent == -1).any() and m["hist"].iloc[-1] < 0)
        n_up += int(up_hit)
        n_dn += int(dn_hit)
        if not ((up_hit and want == 1) or (dn_hit and want == -1)):
            continue
        hits = recent[recent == want]
        ts = hits.index[-1]
        pos = df.index.get_loc(ts)
        earlier = df[df.index.normalize() < df.index[-1].normalize()] if intraday else df.iloc[:-1]
        prev_close = float(earlier["Close"].iloc[-1]) if len(earlier) else float("nan")
        last = float(close.iloc[-1])
        rsi_v = float(ind.rsi(close).iloc[-1])
        adx_v = float(ind.adx(df)["adx"].iloc[-1])
        ema50 = float(ind.ema(close, 50).iloc[-1]) if len(close) >= 50 else float("nan")
        macd_v = float(m["macd"].iloc[-1])
        # confirmations that agree with the direction of the cross
        if want == 1:
            checks = [macd_v > 0, last > ema50, adx_v >= 20, rsi_v < 70]
        else:
            checks = [macd_v < 0, last < ema50, adx_v >= 20, rsi_v > 30]
        score = int(sum(bool(c_) for c_ in checks))
        rows.append(
            {
                "symbol": s_,
                "name": names[s_]["name"],
                "industry": names[s_]["industry"],
                "price": _f(last),
                "changePct": _f((last / prev_close - 1) * 100) if prev_close == prev_close else None,
                "crossedAt": ts.isoformat() if intraday else ts.strftime("%Y-%m-%d"),
                "barsAgo": int(len(df) - 1 - pos),
                "macd": _f(macd_v, 3),
                "signal": _f(m["signal"].iloc[-1], 3),
                "hist": _f(m["hist"].iloc[-1], 3),
                "histPct": _f(float(m["hist"].iloc[-1]) / last * 100, 3),
                "rsi": _f(rsi_v, 1),
                "adx": _f(adx_v, 1),
                "score": score,
            }
        )
    rows.sort(key=lambda r: (-r["score"], r["barsAgo"], -abs(r["hist"] or 0)))

    # ---- analysis
    findings = []
    metrics = []
    word = "above" if want == 1 else "below"
    if scanned:
        metrics += [
            tile("Crossed above signal", str(n_up), f"in the last {within} {'days' if interval == '1d' else 'bars'}", "up"),
            tile("Crossed below signal", str(n_dn), f"of {scanned} scanned", "down"),
            tile("MACD above signal now", f"{above_sig / scanned * 100:.0f}%", "momentum breadth", "up" if above_sig / scanned > 0.55 else "down" if above_sig / scanned < 0.45 else "flat"),
            tile("MACD above zero", f"{above_zero / scanned * 100:.0f}%", "trend breadth", "up" if above_zero / scanned > 0.55 else "down" if above_zero / scanned < 0.45 else "flat"),
        ]
        if n_up + n_dn >= 4:
            lean = n_up / (n_up + n_dn)
            if lean >= 0.65:
                findings.append(finding("up", "Momentum is turning up broadly", f"{n_up} stocks crossed up against {n_dn} down ({lean * 100:.0f}% of crosses are bullish). Crosses clustering one way point to a market-wide shift, not stock-specific noise."))
            elif lean <= 0.35:
                findings.append(finding("down", "Momentum is turning down broadly", f"{n_dn} stocks crossed down against {n_up} up ({(1 - lean) * 100:.0f}% of crosses are bearish). A one-sided tally like this usually reflects the whole market rather than individual stories."))
            else:
                findings.append(finding("flat", "Crosses are evenly split", f"{n_up} bullish against {n_dn} bearish crosses, so there is no market-wide lean at this bar size."))
        if above_sig / scanned >= 0.7:
            findings.append(finding("flat", "Momentum is already stretched", f"{above_sig / scanned * 100:.0f}% of the universe has MACD above its signal line, so fresh bullish crosses are harder to find and the move may be mature."))
        elif above_sig / scanned <= 0.3:
            findings.append(finding("flat", "Momentum is washed out", f"Only {above_sig / scanned * 100:.0f}% of the universe has MACD above its signal line, the kind of base from which bullish crosses tend to cluster."))
    if rows:
        strong = [r for r in rows if r["score"] >= 3]
        findings.append(finding("info", "Quality of the crosses", f"{len(strong)} of {len(rows)} crosses have at least three of four confirmations (MACD on the right side of zero, price on the right side of its 50-bar EMA, ADX at least 20, RSI not already stretched). A cross with few confirmations is more likely a short-lived wiggle."))
        weak = [r for r in rows if (want == 1 and (r["rsi"] or 0) >= 70) or (want == -1 and (r["rsi"] or 100) <= 30)]
        if weak:
            findings.append(finding("flat", "Some crosses arrive stretched", ", ".join(r["symbol"] for r in weak[:5]) + f" crossed {word} with RSI already {'above 70' if want == 1 else 'below 30'}; late-stage signals like these often stall."))
        ind_counts: dict[str, int] = {}
        for r in rows:
            ind_counts[r["industry"]] = ind_counts.get(r["industry"], 0) + 1
        uni_counts: dict[str, int] = {}
        for c in constituents:
            uni_counts[c["industry"]] = uni_counts.get(c["industry"], 0) + 1
        top = sorted(ind_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
        tbl_rows = [[k, v, f"{v / len(rows) * 100:.0f}%", f"{uni_counts.get(k, 0) / max(len(constituents), 1) * 100:.0f}%"] for k, v in top]
        lead_ind, lead_n = top[0]
        if lead_n >= 3 and lead_n / len(rows) >= 0.3:
            share_uni = uni_counts.get(lead_ind, 0) / max(len(constituents), 1) * 100
            findings.append(finding("info", f"{lead_ind} is over-represented", f"{lead_n} of the {len(rows)} crosses ({lead_n / len(rows) * 100:.0f}%) are in {lead_ind}, a sector that is {share_uni:.0f}% of the universe. A sector moving together is a stronger signal than scattered stocks."))
        tables = [table("Where the crosses are", ["Industry", "Crosses", "Share of crosses", "Share of universe"], tbl_rows)]
        best = rows[0]
        headline = f"{len(rows)} stocks crossed {word} their signal line; {best['symbol']} leads on confirmations ({best['score']} of 4)."
    else:
        tables = []
        headline = f"No stock in this universe crossed {word} its signal line in the last {within} {'days' if interval == '1d' else 'bars'}."
    return {
        "interval": interval,
        "intervalLabel": INTERVAL_LABELS[interval],
        "direction": direction,
        "within": within,
        "scanned": len(frames),
        "universeSize": len(symbols),
        "asOf": max((df.index[-1] for df in frames.values()), default=None).isoformat() if frames else None,
        "results": rows,
        "insights": {
            "headline": headline,
            "metrics": metrics,
            "findings": findings,
            "tables": tables,
            "method": "MACD (12, 26, 9) on the chosen bar size across the whole selected universe. Confirmations are four simple checks aligned with the cross; a stock can pass them and still reverse. Delayed bars; the latest bar can change before it closes. Not a recommendation.",
        },
    }
