"""
Company tear sheet assembled from the figures the rest of the site already serves.

Nothing here is generated. Each section is read from the same vetted route as its own tab
on the company page (quote, profile, financials, valuation, shareholding, peers, analyst
estimates), so the sheet cannot disagree with them. A figure no source carries is None and
the page shows a dash; a section whose source failed is listed under ``unavailable``.

``assemble`` is pure, so it is tested offline; ``build`` does the fetching.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Callable

TAG_ACTUAL = "[ACTUAL FILING]"
TAG_MARKET = "[EXCHANGE DATA]"
TAG_CONSENSUS = "[CONSENSUS ESTIMATE]"

SHAREHOLDING_QUARTERS = 6
MAX_PEERS = 8
MAX_OFFICERS = 5


class TearSheetUnavailable(Exception):
    """No quote for the symbol, so there is nothing truthful to print."""


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if value == value and abs(value) != float("inf") else None


def _round(value: Any, digits: int = 2) -> float | None:
    n = _num(value)
    return round(n, digits) if n is not None else None


def _pct(part: Any, whole: Any, digits: int = 2) -> float | None:
    p, w = _num(part), _num(whole)
    return round(p / w * 100.0, digits) if p is not None and w else None


def cagr_pct(first: Any, last: Any, years: float) -> float | None:
    """Compound annual growth, defined only between two positive values."""
    a, b = _num(first), _num(last)
    if a is None or b is None or a <= 0 or b <= 0 or years <= 0:
        return None
    return round(((b / a) ** (1.0 / years) - 1.0) * 100.0, 1)


def _financial_rows(financials: dict | None) -> list[dict[str, Any]]:
    """Annual P&L joined to the balance sheet of the same year."""
    if not financials:
        return []
    sheets = {b.get("period"): b for b in financials.get("balanceSheet") or []}
    rows: list[dict[str, Any]] = []
    previous_revenue: float | None = None
    for year in financials.get("annual") or []:
        bs = sheets.get(year.get("period")) or {}
        revenue, profit = _num(year.get("revenue")), _num(year.get("netProfit"))
        growth = None
        if previous_revenue and revenue is not None and previous_revenue > 0:
            growth = round((revenue / previous_revenue - 1.0) * 100.0, 1)
        rows.append({
            "fiscal_year": year.get("period"),
            "period_end": year.get("periodEnd"),
            "revenue_cr": _round(revenue, 1),
            "revenue_growth_pct": growth,
            "operating_profit_cr": _round(year.get("operatingProfit"), 1),
            "operating_margin_pct": _round(year.get("opmPct"), 1),
            "pat_cr": _round(profit, 1),
            "pat_margin_pct": _pct(profit, revenue, 1),
            "eps": _round(year.get("eps"), 2),
            "roe_pct": _pct(profit, bs.get("netWorth"), 1),
            "debt_to_equity": _round(bs.get("debtToEquity"), 2),
            "current_ratio": _round(bs.get("currentRatio"), 2),
        })
        previous_revenue = revenue
    return rows


def _growth(rows: list[dict[str, Any]], financials: dict | None) -> dict[str, Any]:
    """
    Growth over the span the filings on file actually cover. The sources carry four to
    five fiscal years, so there is no ten-year column to print.
    """
    out: dict[str, Any] = {"span_years": None, "from": None, "to": None, "metrics": []}
    if len(rows) >= 2:
        years = len(rows) - 1
        out.update(span_years=years, **{"from": rows[0]["fiscal_year"], "to": rows[-1]["fiscal_year"]})
        for label, key in (("Revenue", "revenue_cr"), ("Operating profit", "operating_profit_cr"),
                           ("Net profit", "pat_cr"), ("EPS", "eps")):
            out["metrics"].append({
                "metric": label,
                "cagr_pct": cagr_pct(rows[0][key], rows[-1][key], years),
                "latest_yoy_pct": cagr_pct(rows[-2][key], rows[-1][key], 1),
            })
    quarters = (financials or {}).get("quarterly") or []
    if len(quarters) >= 5:
        # quarters run oldest to newest or newest to oldest depending on the source; order by date
        ordered = sorted(quarters, key=lambda q: str(q.get("periodEnd")))
        latest, year_ago = ordered[-1], ordered[-5]
        out["latest_quarter"] = {
            "quarter": latest.get("quarter"),
            "revenue_yoy_pct": cagr_pct(year_ago.get("revenue"), latest.get("revenue"), 1),
            "net_profit_yoy_pct": cagr_pct(year_ago.get("netProfit"), latest.get("netProfit"), 1),
        }
    return out


def _returns(candles: list[dict] | None) -> dict[str, float | None]:
    """Price return over each look-back, from daily closes (not total return)."""
    closes = [(str(c.get("date"))[:10], _num(c.get("close"))) for c in candles or []]
    closes = [(d, c) for d, c in closes if c]
    out: dict[str, float | None] = {"1M_pct": None, "3M_pct": None, "6M_pct": None, "1Y_pct": None}
    if len(closes) < 2:
        return out
    last_day, last = closes[-1]
    try:
        end = date.fromisoformat(last_day)
    except ValueError:
        return out
    for key, days in (("1M_pct", 30), ("3M_pct", 91), ("6M_pct", 182), ("1Y_pct", 365)):
        target = end.toordinal() - days
        base = None
        for day, close in closes:
            try:
                if date.fromisoformat(day).toordinal() <= target:
                    base = close
                else:
                    break
            except ValueError:
                continue
        # the series must reach back that far; the first bar is not a stand-in for a year ago
        if base:
            out[key] = round((last / base - 1.0) * 100.0, 1)
    return out


def _shareholding(holding: dict | None) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    if not holding:
        return [], None
    q = ((holding.get("pattern") or {}).get("quarterly")) or {}
    labels = q.get("labels") or []
    trend = []
    for i in range(max(0, len(labels) - SHAREHOLDING_QUARTERS), len(labels)):
        def at(key: str) -> float | None:
            series = q.get(key) or []
            return _round(series[i], 2) if i < len(series) else None

        trend.append({
            "quarter": labels[i],
            "promoter_holding_pct": at("promoters"),
            "fii_holding_pct": at("fiis"),
            "dii_holding_pct": at("diis"),
            "government_holding_pct": at("government"),
            "public_holding_pct": at("public"),
        })
    pledge = holding.get("pledge") or {}
    status = None
    if pledge:
        status = {
            "pledged_pct_of_total": _round(pledge.get("pledgedPct"), 2),
            "as_of": pledge.get("asOf"),
            "source": "NSE shareholding and pledge disclosures",
        }
    return trend, status


def _consensus(analysts: dict | None, price: float | None) -> dict[str, Any] | None:
    if not analysts:
        return None
    targets = analysts.get("targets") or {}
    recs = (analysts.get("recommendations") or [{}])[0] or {}
    buy = (recs.get("strongBuy") or 0) + (recs.get("buy") or 0)
    hold = recs.get("hold") or 0
    sell = (recs.get("sell") or 0) + (recs.get("strongSell") or 0)
    median = _num(targets.get("median")) or _num(targets.get("mean"))
    if not (buy + hold + sell) and median is None:
        return None
    forecasts = {}
    eps = {e.get("key"): e for e in analysts.get("earningsEstimate") or []}
    rev = {e.get("key"): e for e in analysts.get("revenueEstimate") or []}
    for key, label in (("0y", "Current year"), ("+1y", "Next year")):
        if key in eps or key in rev:
            forecasts[label] = {
                "eps": _round((eps.get(key) or {}).get("avg"), 2),
                "revenue_cr": _round((rev.get(key) or {}).get("avg"), 1),
                "analysts": (eps.get(key) or {}).get("numberOfAnalysts"),
                "provenance": TAG_CONSENSUS,
            }
    return {
        "total_coverage": targets.get("analysts") or (buy + hold + sell) or None,
        "ratings_breakdown": {"buy": buy, "hold": hold, "sell": sell},
        "consensus_rating": targets.get("key"),
        "target_price": {
            "median": _round(median, 2),
            "high": _round(targets.get("high"), 2),
            "low": _round(targets.get("low"), 2),
            "implied_upside_pct": round((median / price - 1.0) * 100.0, 1) if median and price else None,
        },
        "forecasts": forecasts,
    }


def assemble(symbol: str, parts: dict[str, Any]) -> dict[str, Any]:
    """Build the sheet from already-fetched sections. ``parts`` values are payloads or None."""
    sym = symbol.upper()
    quote = parts.get("quote")
    if not quote or _num(quote.get("cmp")) is None:
        raise TearSheetUnavailable(f"No quote for {sym}")
    profile = parts.get("profile") or {}
    stats = parts.get("statistics") or {}
    about, trading = stats.get("about") or {}, stats.get("trading") or {}
    valuation = parts.get("valuation") or {}
    stat_val = stats.get("valuation") or {}
    financials = parts.get("financials")
    price = _num(quote.get("cmp"))

    shares = _num(trading.get("sharesOutstanding"))
    avg_volume = _num(trading.get("avgVolume"))
    rows = _financial_rows(financials)
    ratios = (financials or {}).get("ratios") or {}
    trend, pledge = _shareholding(parts.get("shareholding"))
    peers_payload = parts.get("peers") or {}

    place = ", ".join(str(x) for x in (about.get("city"), about.get("state"), about.get("country")) if x)
    sheet = {
        "header": {
            "symbol": sym,
            "name": quote.get("name") or profile.get("name") or about.get("name") or sym,
            "isin": quote.get("isin") or profile.get("isin"),
            "exchange": quote.get("exchange") or "NSE",
            "sector": quote.get("sector") or profile.get("sector"),
            "sub_industry": quote.get("basicIndustry") or profile.get("industry"),
            "website": profile.get("website") or about.get("website"),
            "headquarters": place or None,
            "employees": profile.get("employees") or about.get("employees"),
            "key_executives": [
                {"designation": o.get("title"), "name": o.get("name")}
                for o in (stats.get("officers") or [])[:MAX_OFFICERS]
                if o.get("name")
            ],
            "business_summary": profile.get("summary") or about.get("summary"),
        },
        "trading_stats": {
            "current_price": _round(price, 2),
            "change": _round((quote.get("change") or {}).get("absolute"), 2),
            "change_pct": _round((quote.get("change") or {}).get("percent"), 2),
            "day_high": _round(quote.get("dayHigh"), 2),
            "day_low": _round(quote.get("dayLow"), 2),
            "week_52_high": _round(quote.get("high52w"), 2),
            "week_52_low": _round(quote.get("low52w"), 2),
            "market_cap_cr": _round(quote.get("marketCapCr"), 1),
            "enterprise_value_cr": _round(stat_val.get("enterpriseValue"), 1),
            "shares_outstanding_cr": round(shares / 1e7, 2) if shares else None,
            "free_float_pct": _pct(trading.get("floatShares"), shares, 1),
            "avg_daily_value_cr": round(avg_volume * price / 1e7, 1) if avg_volume and price else None,
            "as_of": quote.get("asOf"),
            "returns": _returns(parts.get("candles")),
        },
        "multiples": {
            "pe_ttm": _round(valuation.get("peRatio"), 2),
            "pe_forward": _round(stat_val.get("forwardPE"), 2),
            "price_to_book": _round(valuation.get("pbRatio"), 2),
            "ev_ebitda": _round(valuation.get("evToEbitda"), 2),
            "dividend_yield_pct": _round(valuation.get("dividendYieldPct"), 2),
            "eps_ttm": _round(valuation.get("eps"), 2),
            "eps_basis": valuation.get("epsBasis"),
        },
        "returns_on_capital": {
            "roe_pct": _round(ratios.get("roePct"), 1),
            "roce_pct": _round(ratios.get("rocePct"), 1),
            "debt_to_equity": _round(ratios.get("debtToEquity"), 2),
            "current_ratio": _round(ratios.get("currentRatio"), 2),
            "basis": ratios.get("basis"),
        },
        "financials": rows,
        "growth": _growth(rows, financials),
        "peers": [
            {
                "symbol": p.get("symbol"),
                "name": p.get("name"),
                "market_cap_cr": _round(p.get("marketCapCr"), 1),
                "pe_ttm": _round(p.get("pe"), 2),
                "dividend_yield_pct": _round(p.get("dividendYieldPct"), 2),
                "roce_pct": _round(p.get("rocePct"), 1),
                "sales_growth_qtr_pct": _round(p.get("salesGrowthQtrPct"), 1),
                "profit_growth_qtr_pct": _round(p.get("profitGrowthQtrPct"), 1),
            }
            for p in (peers_payload.get("peers") or [])[:MAX_PEERS]
        ],
        "peer_industry": (peers_payload.get("classification") or {}).get("industry"),
        "shareholding_trend": trend,
        "promoter_pledge_status": pledge,
        "analyst_consensus": _consensus(parts.get("analysts"), price),
    }
    sheet["unavailable"] = sorted(
        name for name in ("profile", "financials", "valuation", "shareholding", "peers", "analysts", "statistics", "candles")
        if not parts.get(name)
    )
    sheet["provenance"] = f"{TAG_MARKET} price · {TAG_ACTUAL} financials and shareholding · {TAG_CONSENSUS} estimates"
    sheet["generated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    return sheet


def build(symbol: str) -> dict[str, Any]:
    """Fetch each section through the company routes (their caches and source vetting apply)."""
    from fastapi import HTTPException

    from ..routers import company  # imported here: the router module imports services

    sym = symbol.upper()

    def section(fn: Callable[[], dict]) -> Any:
        try:
            return (fn() or {}).get("data")
        except HTTPException:
            return None
        except Exception:
            return None

    try:
        quote = company.get_quote(sym, "NSE")["data"]
    except HTTPException as exc:
        raise TearSheetUnavailable(str(exc.detail)) from exc

    candles = section(lambda: company.get_candles(sym, "1Y", "NSE"))
    parts = {
        "quote": quote,
        "profile": section(lambda: company.get_profile(sym, "NSE")),
        "financials": section(lambda: company.get_financials(sym, "NSE")),
        "valuation": section(lambda: company.get_valuation(sym, "NSE")),
        "shareholding": section(lambda: company.get_shareholding(sym)),
        "peers": section(lambda: company.get_peers(sym)),
        "analysts": section(lambda: company.get_analysts(sym)),
        "statistics": section(lambda: company.get_statistics(sym)),
        "candles": (candles or {}).get("candles") if isinstance(candles, dict) else None,
    }
    return assemble(sym, parts)
