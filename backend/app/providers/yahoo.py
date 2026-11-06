"""
Yahoo Finance provider.

Supplies quotes, OHLCV history, light fundamentals and global index levels.
Data is delayed (typically 15-20 minutes for NSE) and the endpoint is
unofficial — both facts are surfaced to the client rather than hidden.
"""

from __future__ import annotations

import math
import threading
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf

# Period -> (yfinance period, interval). Intraday history is limited upstream:
# 1m data only goes back ~7 days, so 1D/5D use the finest interval available.
PERIOD_MAP: dict[str, tuple[str, str]] = {
    "1D": ("1d", "5m"),
    "5D": ("5d", "15m"),
    "1M": ("1mo", "1d"),
    "6M": ("6mo", "1d"),
    "1Y": ("1y", "1d"),
    "3Y": ("3y", "1wk"),
    "5Y": ("5y", "1wk"),
    "MAX": ("max", "1mo"),
}

INTRADAY_PERIODS = {"1D", "5D"}


def to_yahoo_symbol(symbol: str, exchange: str = "NSE") -> str:
    """NSE tickers carry a .NS suffix on Yahoo; BSE uses .BO."""
    s = symbol.upper().strip()
    if s.startswith("^") or "." in s:
        return s
    return f"{s}.BO" if exchange.upper() == "BSE" else f"{s}.NS"


# Rows of a statement frame that are not amounts of money: counts, ratios and rates.
_NON_MONEY = ("EPS", "Shares", "Rate", "Ratio")
_FX_CACHE: dict[str, tuple[float, pd.Series]] = {}
_FX_LOCK = threading.Lock()


def statement_currency(ticker: yf.Ticker) -> str:
    """
    The currency Yahoo's statement frames for this company are in.

    `financialCurrency` alone is not enough. For Infosys it says USD and the
    statements are in dollars; for HCLTECH it also says USD, but the statements
    are in rupees and only the summary totals are in dollars. So the statements'
    revenue is compared with the summary revenue (which is in `financialCurrency`):
    a ratio near one means the same currency, a ratio near the exchange rate means
    the statements are already in rupees.
    """
    try:
        info = ticker.get_info() or {}
    except Exception:
        return "INR"
    cur = (info.get("financialCurrency") or "INR").upper()
    if cur == "INR":
        return "INR"
    summary = info.get("totalRevenue")
    try:
        annual = ticker.income_stmt
        stated = float(annual.loc["Total Revenue"].dropna().iloc[0]) if annual is not None and "Total Revenue" in annual.index else None
    except Exception:
        stated = None
    if not summary or not stated:
        return cur
    # Same currency: about 1. Rupees against a dollar summary: about the USD/INR rate.
    return "INR" if stated / summary > 8 else cur


def _get_fx_series(cur: str) -> pd.Series:
    now_ts = datetime.now(timezone.utc).timestamp()
    with _FX_LOCK:
        cached = _FX_CACHE.get(cur)
        if cached is not None and now_ts - cached[0] <= 6 * 3600:
            return cached[1]
    closes = yf.Ticker(f"{cur}INR=X").history(period="10y")["Close"].dropna()
    if closes.empty:
        raise ValueError(f"No {cur}/INR rate available to convert statements")
    closes.index = closes.index.tz_localize(None)
    with _FX_LOCK:
        _FX_CACHE[cur] = (datetime.now(timezone.utc).timestamp(), closes)
        return _FX_CACHE[cur][1]


def inr_rate(currency: str, on: Any = None) -> float:
    """
    Rupees per unit of `currency` on a date (the latest close when no date is given).

    Raises when the rate cannot be fetched: a statement left in dollars and labelled
    rupees is off by a factor of ninety, so no figure is better than that figure.
    """
    cur = (currency or "INR").upper()
    if cur == "INR":
        return 1.0
    closes = _get_fx_series(cur)
    if on is None:
        return float(closes.iloc[-1])
    before = closes[closes.index <= pd.Timestamp(on).tz_localize(None)]
    return float(before.iloc[-1] if len(before) else closes.iloc[0])


def inr_rate_average(currency: str, end: Any, days: int) -> float:
    """Average rupees per unit over the `days` up to `end`: the rate an income statement's flows were earned at."""
    cur = (currency or "INR").upper()
    if cur == "INR":
        return 1.0
    inr_rate(cur)  # fills the cache
    with _FX_LOCK:
        cached = _FX_CACHE.get(cur)
    closes = cached[1] if cached is not None else _get_fx_series(cur)
    stop = pd.Timestamp(end).tz_localize(None)
    window = closes[(closes.index > stop - pd.Timedelta(days=days)) & (closes.index <= stop)]
    return float(window.mean()) if len(window) else inr_rate(cur, end)


def frame_in_inr(frame: pd.DataFrame | None, currency: str, flow_days: int | None = None) -> pd.DataFrame | None:
    """
    A statement frame with money rows converted to rupees at each period-end's rate.

    `flow_days` marks an income or cash-flow frame, converted at the average rate over
    that many days to each period end (a quarter is 91, a year 365); balance sheets
    convert at the period-end rate. Per-share rows are recomputed by callers from
    converted totals where possible, since Yahoo rounds dollar EPS to the cent.
    """
    if frame is None or frame.empty or (currency or "INR").upper() == "INR":
        return frame
    out = frame.copy()
    money = [r for r in out.index if not any(k in str(r) for k in _NON_MONEY)]
    eps_rows = [r for r in out.index if "EPS" in str(r)]
    for col in out.columns:
        # Flows (income, cash flow) at the period's average rate; stocks (balance sheet) at its end
        rate = inr_rate_average(currency, col, flow_days) if flow_days else inr_rate(currency, col)
        out.loc[money + eps_rows, col] = out.loc[money + eps_rows, col].astype(float) * rate
    out.attrs["convertedFrom"] = currency.upper()
    return out


def _clean_number(value: Any) -> float | None:
    """Yahoo returns NaN for incomplete sessions; treat that as missing."""
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def fetch_history(symbol: str, period: str, exchange: str = "NSE") -> pd.DataFrame:
    """
    OHLCV history, oldest first.

    The most recent row of an in-progress session comes back with NaN OHLC but a
    real volume figure. Those rows are dropped: a chart point with no price is
    worse than no point at all.
    """
    y_period, interval = PERIOD_MAP.get(period.upper(), PERIOD_MAP["1Y"])
    ticker = yf.Ticker(to_yahoo_symbol(symbol, exchange))
    frame = ticker.history(period=y_period, interval=interval, auto_adjust=False)

    if frame is None or frame.empty:
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

    frame = frame.dropna(subset=["Close"])
    return frame


def fetch_daily_history(symbol: str, years: int = 3, exchange: str = "NSE") -> pd.DataFrame:
    """
    Daily bars over N years, regardless of the chart period map.

    The chart periods deliberately coarsen to weekly and monthly bars for long
    horizons, which is right for plotting and wrong for model fitting: the quant
    engine annualises with sqrt(252) and needs genuinely daily observations.
    """
    ticker = yf.Ticker(to_yahoo_symbol(symbol, exchange))
    frame = ticker.history(period=f"{years}y", interval="1d", auto_adjust=False)
    if frame is None or frame.empty:
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
    return frame.dropna(subset=["Close"])


def history_to_candles(frame: pd.DataFrame, intraday: bool) -> list[dict[str, Any]]:
    candles: list[dict[str, Any]] = []
    for ts, row in frame.iterrows():
        close = _clean_number(row.get("Close"))
        if close is None:
            continue
        stamp = ts.isoformat() if intraday else ts.strftime("%Y-%m-%d")
        candles.append(
            {
                "date": stamp,
                "open": round(_clean_number(row.get("Open")) or close, 2),
                "high": round(_clean_number(row.get("High")) or close, 2),
                "low": round(_clean_number(row.get("Low")) or close, 2),
                "close": round(close, 2),
                "volume": int(_clean_number(row.get("Volume")) or 0),
            }
        )
    return candles


def fetch_quote(symbol: str, exchange: str = "NSE") -> dict[str, Any] | None:
    """
    Current quote assembled from fast_info plus the latest completed session.

    Yahoo exposes the 52-week band as yearHigh/yearLow, not fiftyTwoWeek*.
    """
    y_symbol = to_yahoo_symbol(symbol, exchange)
    ticker = yf.Ticker(y_symbol)

    try:
        info = ticker.fast_info
    except Exception:
        return None

    last_price = _clean_number(info.get("lastPrice"))
    previous_close = _clean_number(info.get("previousClose"))

    if last_price is None:
        # Fall back to the last completed close if the live field is unavailable
        frame = fetch_history(symbol, "1M", exchange)
        if frame.empty:
            return None
        last_price = _clean_number(frame["Close"].iloc[-1])
        if last_price is None:
            return None

    change_abs = None if previous_close is None else last_price - previous_close
    change_pct = (
        None
        if previous_close in (None, 0) or change_abs is None
        else (change_abs / previous_close) * 100
    )

    market_cap = _clean_number(info.get("marketCap"))

    return {
        "symbol": symbol.upper(),
        "exchange": exchange.upper(),
        "cmp": round(last_price, 2),
        "change": {
            "absolute": round(change_abs, 2) if change_abs is not None else 0.0,
            "percent": round(change_pct, 2) if change_pct is not None else 0.0,
        },
        "open": round(_clean_number(info.get("open")) or last_price, 2),
        "previousClose": round(previous_close or last_price, 2),
        "dayHigh": round(_clean_number(info.get("dayHigh")) or last_price, 2),
        "dayLow": round(_clean_number(info.get("dayLow")) or last_price, 2),
        "high52w": round(_clean_number(info.get("yearHigh")) or last_price, 2),
        "low52w": round(_clean_number(info.get("yearLow")) or last_price, 2),
        "volume": int(_clean_number(info.get("lastVolume")) or 0),
        # Yahoo reports market cap in rupees; the UI works in crore
        "marketCapCr": round(market_cap / 1e7, 2) if market_cap else 0.0,
        "currency": info.get("currency") or "INR",
        "asOf": datetime.now(timezone.utc).isoformat(),
    }


def fetch_profile(symbol: str, exchange: str = "NSE") -> dict[str, Any]:
    """Company name, sector and industry. Slower than fast_info, cached for a day."""
    ticker = yf.Ticker(to_yahoo_symbol(symbol, exchange))
    try:
        info = ticker.get_info()
    except Exception:
        info = {}

    return {
        "name": info.get("longName") or info.get("shortName") or symbol.upper(),
        "sector": info.get("sector") or "Unclassified",
        "industry": info.get("industry") or "Unclassified",
        "isin": info.get("isin"),
        "website": info.get("website"),
        "summary": info.get("longBusinessSummary"),
        "employees": info.get("fullTimeEmployees"),
    }


def fetch_valuation(symbol: str, exchange: str = "NSE") -> dict[str, Any]:
    """Valuation multiples and returns reported by Yahoo, where available."""
    ticker = yf.Ticker(to_yahoo_symbol(symbol, exchange))
    try:
        info = ticker.get_info()
    except Exception:
        info = {}

    # Yahoo mixes two conventions in the same payload and gives no indication
    # which is which: returnOnEquity and profitMargins are fractions (TCS 0.477
    # = 47.7%), while dividendYield is already a percentage (TCS 3.14 = 3.14%).
    # Scaling both the same way produced an 87% dividend yield for GRSE.
    def as_pct_from_fraction(value: Any) -> float | None:
        v = _clean_number(value)
        return None if v is None else round(v * 100, 2)

    def as_pct_direct(value: Any) -> float | None:
        v = _clean_number(value)
        return None if v is None else round(v, 2)

    # Dividends actually paid (by ex-date) over the last year. Yahoo's dividendYield
    # annualises the latest regular dividend only, which for a company that pays
    # specials (TCS: ₹12 regular, ₹112 paid in the year) understates the yield by half.
    dividends_ttm: float | None = None
    try:
        divs = ticker.dividends
        if divs is not None and len(divs):
            cutoff = pd.Timestamp.now(tz=divs.index.tz) - pd.Timedelta(days=365)
            dividends_ttm = round(float(divs[divs.index >= cutoff].sum()), 2)
    except Exception:
        dividends_ttm = None

    # Yahoo divides a rupee enterprise value by revenue and EBITDA in the filing currency,
    # so for USD filers (Infosys, HCLTech) these two ratios come out about 88 times too high
    try:
        ev_fx = inr_rate(info.get("financialCurrency") or "INR")
    except Exception:
        ev_fx = None

    def ev_multiple(key: str) -> float | None:
        v = _clean_number(info.get(key))
        return None if v is None or not ev_fx else round(v / ev_fx, 2)

    return {
        "dividendsTtm": dividends_ttm,
        "peRatio": _clean_number(info.get("trailingPE")),
        "pbRatio": _clean_number(info.get("priceToBook")),
        "evToEbitda": ev_multiple("enterpriseToEbitda"),
        "evToSales": ev_multiple("enterpriseToRevenue"),
        # Frequently absent for Indian tickers; computed from statements as a
        # fallback in the fundamentals service.
        "roePct": as_pct_from_fraction(info.get("returnOnEquity")),
        "profitMarginPct": as_pct_from_fraction(info.get("profitMargins")),
        "eps": _clean_number(info.get("trailingEps")),
        "bookValue": _clean_number(info.get("bookValue")),
        "dividendYieldPct": as_pct_direct(info.get("dividendYield")),
    }


# Yahoo symbols for the NSE ticker indices. Vetted on 2026-11-03: every level matched
# NSE's own to the paisa (India VIX within 0.4%, as it ticks between the two reads).
NSE_INDEX_SYMBOLS: dict[str, str] = {
    "nifty-50": "^NSEI", "nifty-next-50": "^NSMIDCP", "nifty-100": "^CNX100", "nifty-500": "^CRSLDX",
    "nifty-midcap-100": "NIFTY_MIDCAP_100.NS", "nifty-smallcap-100": "^CNXSC", "nifty-bank": "^NSEBANK",
    "nifty-it": "^CNXIT", "nifty-auto": "^CNXAUTO", "nifty-pharma": "^CNXPHARMA", "nifty-fmcg": "^CNXFMCG",
    "nifty-metal": "^CNXMETAL", "nifty-energy": "^CNXENERGY", "nifty-realty": "^CNXREALTY",
    "nifty-psu-bank": "^CNXPSUBANK", "india-vix": "^INDIAVIX",
}


def fetch_nse_index_levels(indices: list[tuple[str, str, str]]) -> list[dict[str, Any]]:
    """
    Backup for nse.fetch_indices: the same rows, level and day change only. Breadth,
    valuation and 30/365-day changes are NSE-only and are left empty, not estimated.
    """
    out: list[dict[str, Any]] = []
    for index_id, name, family in indices:
        y_symbol = NSE_INDEX_SYMBOLS.get(index_id)
        if not y_symbol:
            continue
        try:
            info = yf.Ticker(y_symbol).fast_info
            level, prev = _clean_number(info.get("lastPrice")), _clean_number(info.get("previousClose"))
        except Exception:
            continue
        if level is None:
            continue
        change = level - prev if prev else 0.0
        out.append({
            "id": index_id, "name": name, "family": family, "exchange": "NSE", "level": round(level, 2),
            "change": {"absolute": round(change, 2), "percent": round(change / prev * 100, 2) if prev else 0.0},
            "peRatio": None, "pbRatio": None, "dividendYieldPct": None, "advances": 0, "declines": 0,
            "oneMonthChangePct": None, "oneYearChangePct": None,
            "high52w": _clean_number(info.get("yearHigh")), "low52w": _clean_number(info.get("yearLow")),
            "asOf": datetime.now(timezone.utc).isoformat(),
        })
    return out


GLOBAL_INDEX_SYMBOLS: list[tuple[str, str, str, str]] = [
    # (id, display name, region, yahoo symbol)
    ("sp-500", "S&P 500", "United States", "^GSPC"),
    ("nasdaq", "Nasdaq Composite", "United States", "^IXIC"),
    ("dow-jones", "Dow Jones", "United States", "^DJI"),
    ("ftse-100", "FTSE 100", "United Kingdom", "^FTSE"),
    ("hang-seng", "Hang Seng", "Hong Kong", "^HSI"),
    ("nikkei-225", "Nikkei 225", "Japan", "^N225"),
]


def fetch_global_indices() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for index_id, name, region, y_symbol in GLOBAL_INDEX_SYMBOLS:
        try:
            info = yf.Ticker(y_symbol).fast_info
            level = _clean_number(info.get("lastPrice"))
            prev = _clean_number(info.get("previousClose"))
            if level is None:
                continue
            change_pct = 0.0 if not prev else ((level - prev) / prev) * 100
            out.append(
                {
                    "id": index_id,
                    "name": name,
                    "region": region,
                    "level": round(level, 2),
                    "changePct": round(change_pct, 2),
                    "asOf": datetime.now(timezone.utc).isoformat(),
                }
            )
        except Exception:
            # One unavailable index must not take down the whole strip
            continue
    return out
