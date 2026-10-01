"""Yahoo Finance company sections: profile and statistics, statements, analysts, history, compare.

Everything is read through yfinance and reshaped for the front end. Money amounts from filings
are converted from rupees to crore so they line up with the rest of the site; per-share figures,
ratios and share counts are left as they are. Fields Yahoo does not supply for a company are
returned as null, never defaulted.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf

CR = 1e7

SKIP_CR = ("Shares", "EPS", "Rate", "Ratio", "Number", "Per Share")


def _clean(v: Any) -> Any:
    if v is None:
        return None
    try:
        if isinstance(v, (pd.Timestamp, datetime)):
            return v.isoformat()
        if hasattr(v, "item"):
            v = v.item()
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v
    except Exception:
        return None


def _cr(v: Any) -> float | None:
    v = _clean(v)
    return round(v / CR, 2) if isinstance(v, (int, float)) else None


def _n(v: Any, nd: int | None = None) -> float | None:
    v = _clean(v)
    if not isinstance(v, (int, float)):
        return None
    return round(v, nd) if nd is not None else v


def _date(epoch: Any) -> str | None:
    try:
        return datetime.fromtimestamp(int(epoch), tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        return None


def _ticker(symbol: str) -> yf.Ticker:
    return yf.Ticker(f"{symbol.upper()}.NS")


# ---------------------------------------------------------------- profile and statistics
def profile_stats(symbol: str) -> dict[str, Any]:
    t = _ticker(symbol)
    info = t.info or {}
    if not info or not (info.get("longName") or info.get("shortName")):
        raise ValueError(f"No Yahoo Finance profile for {symbol.upper()}")

    officers = []
    for o in info.get("companyOfficers") or []:
        officers.append(
            {
                "name": o.get("name"),
                "title": o.get("title"),
                "age": _n(o.get("age")),
                "pay": _cr(o.get("totalPay")),
                "yearBorn": _n(o.get("yearBorn")),
            }
        )

    div_rows: list[dict[str, Any]] = []
    try:
        divs = t.dividends
        if divs is not None and len(divs):
            by_year: dict[int, float] = {}
            for ts, v in divs.items():
                by_year[ts.year] = by_year.get(ts.year, 0.0) + float(v)
            div_rows = [{"year": y, "amount": round(a, 2)} for y, a in sorted(by_year.items())][-20:]
            recent = [{"date": ts.strftime("%Y-%m-%d"), "amount": round(float(v), 2)} for ts, v in divs.tail(8).items()][::-1]
        else:
            recent = []
    except Exception:
        recent = []
    splits = []
    try:
        sp = t.splits
        if sp is not None and len(sp):
            splits = [{"date": ts.strftime("%Y-%m-%d"), "ratio": round(float(v), 4)} for ts, v in sp.items()][::-1]
    except Exception:
        splits = []

    cal: dict[str, Any] = {}
    try:
        c = t.calendar or {}
        ed = c.get("Earnings Date") or []
        cal = {
            "earningsDates": [str(d) for d in ed],
            "exDividendDate": str(c.get("Ex-Dividend Date")) if c.get("Ex-Dividend Date") else None,
            "dividendDate": str(c.get("Dividend Date")) if c.get("Dividend Date") else None,
        }
    except Exception:
        cal = {}

    g = info.get
    return {
        "symbol": symbol.upper(),
        "about": {
            "name": g("longName") or g("shortName"),
            "summary": g("longBusinessSummary"),
            "sector": g("sector"),
            "industry": g("industry"),
            "website": g("website"),
            "city": g("city"),
            "state": g("state"),
            "country": g("country"),
            "address": ", ".join(x for x in (g("address1"), g("address2")) if x) or None,
            "phone": g("phone"),
            "employees": _n(g("fullTimeEmployees")),
        },
        "officers": officers,
        "valuation": {
            "marketCap": _cr(g("marketCap")),
            "enterpriseValue": _cr(g("enterpriseValue")),
            "trailingPE": _n(g("trailingPE"), 2),
            "forwardPE": _n(g("forwardPE"), 2),
            "pegRatio": _n(g("trailingPegRatio") or g("pegRatio"), 2),
            "priceToSales": _n(g("priceToSalesTrailing12Months"), 2),
            "priceToBook": _n(g("priceToBook"), 2),
            "evToRevenue": _n(g("enterpriseToRevenue"), 2),
            "evToEbitda": _n(g("enterpriseToEbitda"), 2),
        },
        "highlights": {
            "profitMargin": _n(g("profitMargins"), 4),
            "operatingMargin": _n(g("operatingMargins"), 4),
            "grossMargin": _n(g("grossMargins"), 4),
            "returnOnAssets": _n(g("returnOnAssets"), 4),
            "returnOnEquity": _n(g("returnOnEquity"), 4),
            "revenue": _cr(g("totalRevenue")),
            "revenueGrowth": _n(g("revenueGrowth"), 4),
            "grossProfit": _cr(g("grossProfits")),
            "ebitda": _cr(g("ebitda")),
            "netIncome": _cr(g("netIncomeToCommon")),
            "eps": _n(g("trailingEps"), 2),
            "forwardEps": _n(g("forwardEps"), 2),
            "earningsGrowth": _n(g("earningsQuarterlyGrowth") or g("earningsGrowth"), 4),
            "cash": _cr(g("totalCash")),
            "debt": _cr(g("totalDebt")),
            "debtToEquity": _n(g("debtToEquity"), 2),
            "currentRatio": _n(g("currentRatio"), 2),
            "bookValue": _n(g("bookValue"), 2),
            "operatingCashflow": _cr(g("operatingCashflow")),
            "freeCashflow": _cr(g("freeCashflow")),
        },
        "trading": {
            "beta": _n(g("beta"), 2),
            "high52w": _n(g("fiftyTwoWeekHigh"), 2),
            "low52w": _n(g("fiftyTwoWeekLow"), 2),
            "change52w": _n(g("52WeekChange"), 4),
            "ma50": _n(g("fiftyDayAverage"), 2),
            "ma200": _n(g("twoHundredDayAverage"), 2),
            "avgVolume": _n(g("averageVolume")),
            "avgVolume10d": _n(g("averageVolume10days")),
            "sharesOutstanding": _n(g("sharesOutstanding")),
            "floatShares": _n(g("floatShares")),
            "heldByInsiders": _n(g("heldPercentInsiders"), 4),
            "heldByInstitutions": _n(g("heldPercentInstitutions"), 4),
            "shortRatio": _n(g("shortRatio"), 2),
        },
        "dividends": {
            "rate": _n(g("dividendRate"), 2),
            "yieldPct": _n(g("dividendYield"), 2),
            "payoutRatio": _n(g("payoutRatio"), 4),
            "fiveYearAvgYieldPct": _n(g("fiveYearAvgDividendYield"), 2),
            "exDividendDate": _date(g("exDividendDate")),
            "lastValue": _n(g("lastDividendValue"), 2),
            "lastDate": _date(g("lastDividendDate")),
            "lastSplitFactor": g("lastSplitFactor"),
            "lastSplitDate": _date(g("lastSplitDate")),
            "byYear": div_rows,
            "recent": recent,
            "splits": splits,
        },
        "calendar": cal,
    }


# ---------------------------------------------------------------- statements
def _frame(df: pd.DataFrame | None) -> dict[str, Any] | None:
    if df is None or df.empty:
        return None
    df = df.dropna(how="all")
    if df.empty:
        return None
    cols = list(df.columns)
    rows = []
    for label, series in df.iterrows():
        label = str(label)
        scale_cr = not any(k in label for k in SKIP_CR)
        vals = [(_cr(series[c]) if scale_cr else _n(series[c], 4)) for c in cols]
        if all(v is None for v in vals):
            continue
        rows.append({"label": label, "values": vals, "perShare": not scale_cr})
    return {"dates": [pd.Timestamp(c).strftime("%Y-%m-%d") for c in cols], "rows": rows}


def statements(symbol: str) -> dict[str, Any]:
    t = _ticker(symbol)
    out = {
        "income": {"annual": _frame(t.income_stmt), "quarterly": _frame(t.quarterly_income_stmt)},
        "balance": {"annual": _frame(t.balance_sheet), "quarterly": _frame(t.quarterly_balance_sheet)},
        "cashflow": {"annual": _frame(t.cashflow), "quarterly": _frame(t.quarterly_cashflow)},
    }
    if not any(v for grp in out.values() for v in grp.values()):
        raise ValueError(f"No Yahoo Finance statements for {symbol.upper()}")
    return out


# ---------------------------------------------------------------- analysts
PERIOD_LABEL = {"0q": "Current quarter", "+1q": "Next quarter", "0y": "Current year", "+1y": "Next year"}


def _table(df: pd.DataFrame | None, cr_cols: tuple[str, ...] = ()) -> list[dict[str, Any]]:
    if df is None or df.empty:
        return []
    out = []
    for idx, r in df.iterrows():
        row: dict[str, Any] = {"period": PERIOD_LABEL.get(str(idx), str(idx)), "key": str(idx)}
        for c in df.columns:
            v = r[c]
            row[str(c)] = _cr(v) if c in cr_cols else _n(v, 4)
        out.append(row)
    return out


def analysts(symbol: str) -> dict[str, Any]:
    t = _ticker(symbol)
    info = t.info or {}
    targets = {}
    try:
        targets = dict(t.analyst_price_targets or {})
    except Exception:
        targets = {}
    recs = []
    try:
        rs = t.recommendations
        if rs is not None and len(rs):
            for _, r in rs.iterrows():
                recs.append({k: (str(r[k]) if k == "period" else _n(r[k])) for k in ("period", "strongBuy", "buy", "hold", "sell", "strongSell") if k in r})
    except Exception:
        recs = []

    hist: list[dict[str, Any]] = []
    upcoming = None
    try:
        ed = t.earnings_dates
        if ed is not None and len(ed):
            now = pd.Timestamp.now(tz=ed.index.tz)
            for ts, r in ed.iterrows():
                if ts > now:
                    upcoming = {"date": ts.strftime("%Y-%m-%d"), "epsEstimate": _n(r.get("EPS Estimate"), 2)}
                elif _clean(r.get("Reported EPS")) is not None:
                    hist.append(
                        {
                            "date": ts.strftime("%Y-%m-%d"),
                            "estimate": _n(r.get("EPS Estimate"), 2),
                            "actual": _n(r.get("Reported EPS"), 2),
                            "surprisePct": _n(r.get("Surprise(%)"), 2),
                        }
                    )
            hist = sorted(hist, key=lambda x: x["date"])[-12:]
            if upcoming is None:
                future = [ts for ts in ed.index if ts > now]
                if future:
                    nxt = min(future)
                    upcoming = {"date": nxt.strftime("%Y-%m-%d"), "epsEstimate": _n(ed.loc[nxt].get("EPS Estimate"), 2)}
    except Exception:
        pass

    growth = []
    try:
        ge = t.growth_estimates
        if ge is not None and len(ge):
            for idx, r in ge.iterrows():
                growth.append({"period": PERIOD_LABEL.get(str(idx), str(idx)), **{str(c): _n(r[c], 4) for c in ge.columns}})
    except Exception:
        growth = []

    result = {
        "symbol": symbol.upper(),
        "currentPrice": _n(info.get("currentPrice") or info.get("regularMarketPrice"), 2),
        "targets": {
            "mean": _n(targets.get("mean") or info.get("targetMeanPrice"), 2),
            "median": _n(targets.get("median") or info.get("targetMedianPrice"), 2),
            "high": _n(targets.get("high") or info.get("targetHighPrice"), 2),
            "low": _n(targets.get("low") or info.get("targetLowPrice"), 2),
            "analysts": _n(info.get("numberOfAnalystOpinions")),
            "key": info.get("recommendationKey"),
            "meanRating": _n(info.get("recommendationMean"), 2),
        },
        "recommendations": recs,
        "earningsEstimate": _table(t.earnings_estimate),
        "revenueEstimate": _table(t.revenue_estimate, cr_cols=("avg", "low", "high", "yearAgoRevenue")),
        "epsTrend": _table(t.eps_trend),
        "epsRevisions": _table(t.eps_revisions),
        "growthEstimates": growth,
        "earningsHistory": hist,
        "nextEarnings": upcoming,
    }
    if not result["targets"]["mean"] and not recs and not result["earningsEstimate"]:
        raise ValueError(f"No analyst coverage on Yahoo Finance for {symbol.upper()}")
    return result


# ---------------------------------------------------------------- history
RANGES = {"1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y", "5Y": "5y", "MAX": "max"}


def history(symbol: str, rng: str, interval: str) -> dict[str, Any]:
    t = _ticker(symbol)
    df = t.history(period=RANGES.get(rng, "1y"), interval=interval, auto_adjust=False)
    if df is None or df.empty:
        raise ValueError(f"No price history for {symbol.upper()}")
    rows = []
    for ts, r in df.iterrows():
        close = _n(r.get("Close"), 2)
        if close is None:
            continue
        rows.append(
            {
                "date": ts.strftime("%Y-%m-%d"),
                "open": _n(r.get("Open"), 2),
                "high": _n(r.get("High"), 2),
                "low": _n(r.get("Low"), 2),
                "close": close,
                "adjClose": _n(r.get("Adj Close"), 2),
                "volume": _n(r.get("Volume")),
                "dividend": _n(r.get("Dividends"), 2) or None,
                "split": _n(r.get("Stock Splits"), 4) or None,
            }
        )
    rows.reverse()
    return {"symbol": symbol.upper(), "range": rng, "interval": interval, "rows": rows[:1500]}


# ---------------------------------------------------------------- compare
def compare(symbol: str, peers: list[str], period: str) -> dict[str, Any]:
    names = {symbol.upper(): symbol.upper(), "^NSEI": "Nifty 50"}
    for p in peers[:6]:
        names[p.upper()] = p.upper()
    tickers = [f"{k}.NS" if not k.startswith("^") else k for k in names]
    raw = yf.download(tickers, period=RANGES.get(period, "1y"), interval="1d", group_by="ticker", auto_adjust=False, progress=False, threads=True)
    series: dict[str, pd.Series] = {}
    for key, tk in zip(names, tickers):
        try:
            s = raw[tk]["Close"].dropna()
        except Exception:
            continue
        if len(s) > 5:
            series[key] = s
    if symbol.upper() not in series:
        raise ValueError(f"No price history for {symbol.upper()}")
    frame = pd.DataFrame(series).sort_index().ffill().dropna(subset=[symbol.upper()])
    base = frame.iloc[0]
    rebased = (frame / base * 100).round(2)
    return {
        "symbol": symbol.upper(),
        "period": period,
        "dates": [d.strftime("%Y-%m-%d") for d in rebased.index],
        "series": [
            {"key": k, "label": names[k], "values": [None if pd.isna(v) else float(v) for v in rebased[k]], "returnPct": round(float(rebased[k].dropna().iloc[-1] - 100), 2)}
            for k in rebased.columns
        ],
    }
