"""
Reported financial statements, from Yahoo's filing data.

Everything here is computed from reported figures rather than read off Yahoo's
summary fields, which are patchy for Indian tickers — `returnOnEquity` in
particular is frequently absent. Deriving it from the statements means a figure
either has a real basis or is reported as null; it is never guessed.

All money is converted to rupees crore (the reporting unit used across the UI).
"""

from __future__ import annotations

import math
from typing import Any

import pandas as pd
import yfinance as yf

from .yahoo import to_yahoo_symbol

CRORE = 1e7

# Indian fiscal years end 31 March: the June quarter is Q1 of the *next* FY.
_FQ_BY_MONTH = {6: 1, 9: 2, 12: 3, 3: 4}


def _fiscal_label(ts: pd.Timestamp) -> str:
    month, year = ts.month, ts.year
    quarter = _FQ_BY_MONTH.get(month)
    if quarter is None:
        return ts.strftime("%b %Y")
    fy_end_year = year + 1 if month >= 6 else year
    return f"Q{quarter} FY{str(fy_end_year)[-2:]}"


def _val(frame: pd.DataFrame, row: str, col: Any) -> float | None:
    if row not in frame.index:
        return None
    try:
        v = float(frame.loc[row, col])
    except (KeyError, TypeError, ValueError):
        return None
    return None if math.isnan(v) or math.isinf(v) else v


def _cr(value: float | None) -> float | None:
    return None if value is None else round(value / CRORE, 2)


def _first_available(frame: pd.DataFrame, names: list[str], col: Any) -> float | None:
    for name in names:
        v = _val(frame, name, col)
        if v is not None:
            return v
    return None


def fetch_quarterly_pnl(symbol: str, exchange: str = "NSE", limit: int = 8) -> list[dict[str, Any]]:
    """
    Quarterly P&L, oldest first.

    Yahoo exposes roughly four to six quarters for Indian issuers, and the
    series can have gaps where a filing was not picked up. Periods are rendered
    exactly as reported rather than being interpolated into a tidy run.
    """
    ticker = yf.Ticker(to_yahoo_symbol(symbol, exchange))
    try:
        frame = ticker.quarterly_income_stmt
    except Exception:
        return []

    if frame is None or frame.empty:
        return []

    rows: list[dict[str, Any]] = []
    for col in list(frame.columns)[:limit]:
        revenue = _first_available(frame, ["Total Revenue", "Operating Revenue"], col)
        if revenue in (None, 0):
            continue

        operating_profit = _first_available(frame, ["Operating Income", "EBIT"], col)
        net_profit = _val(frame, "Net Income", col)
        ebitda = _val(frame, "EBITDA", col)

        # Opex is the residual against revenue so the panel always reconciles,
        # rather than summing Yahoo's partially-populated expense lines.
        operating_expenses = None if operating_profit is None else revenue - operating_profit

        rows.append(
            {
                "quarter": _fiscal_label(pd.Timestamp(col)),
                "periodEnd": pd.Timestamp(col).strftime("%Y-%m-%d"),
                "revenue": _cr(revenue),
                "operatingExpenses": _cr(operating_expenses),
                "operatingProfit": _cr(operating_profit),
                "opmPct": (
                    round((operating_profit / revenue) * 100, 2)
                    if operating_profit is not None
                    else None
                ),
                "ebitda": _cr(ebitda),
                "netProfit": _cr(net_profit),
                "netMarginPct": (
                    round((net_profit / revenue) * 100, 2) if net_profit is not None else None
                ),
                "eps": _first_available(frame, ["Basic EPS", "Diluted EPS"], col),
            }
        )

    rows.reverse()  # oldest first, matching the UI's left-to-right reading order
    return rows


def fetch_balance_sheet(symbol: str, exchange: str = "NSE", limit: int = 4) -> list[dict[str, Any]]:
    """Annual balance-sheet highlights, oldest first."""
    ticker = yf.Ticker(to_yahoo_symbol(symbol, exchange))
    try:
        frame = ticker.balance_sheet
    except Exception:
        return []

    if frame is None or frame.empty:
        return []

    rows: list[dict[str, Any]] = []
    for col in list(frame.columns)[:limit]:
        equity = _first_available(
            frame, ["Stockholders Equity", "Total Equity Gross Minority Interest"], col
        )
        total_assets = _val(frame, "Total Assets", col)
        if equity is None and total_assets is None:
            continue

        debt = _val(frame, "Total Debt", col) or 0.0
        current_assets = _val(frame, "Current Assets", col)
        current_liabilities = _val(frame, "Current Liabilities", col)
        ts = pd.Timestamp(col)

        rows.append(
            {
                "period": f"FY{str(ts.year if ts.month <= 3 else ts.year + 1)[-2:]}",
                "periodEnd": ts.strftime("%Y-%m-%d"),
                "borrowings": _cr(debt),
                "equityCapital": _cr(_val(frame, "Common Stock", col)),
                "reserves": _cr(_val(frame, "Retained Earnings", col)),
                "netWorth": _cr(equity),
                "totalAssets": _cr(total_assets),
                "currentAssets": _cr(current_assets),
                # Needed as the short-term leg of the Merton default barrier
                "currentLiabilities": _cr(current_liabilities),
                "debtToEquity": (
                    round(debt / equity, 3) if equity not in (None, 0) else None
                ),
                "currentRatio": (
                    round(current_assets / current_liabilities, 2)
                    if current_assets is not None and current_liabilities not in (None, 0)
                    else None
                ),
            }
        )

    rows.reverse()
    return rows


def fetch_annual_pnl(symbol: str, exchange: str = "NSE", limit: int = 4) -> list[dict[str, Any]]:
    """
    Annual P&L, oldest first.

    Yahoo's annual series for Indian issuers is complete where the quarterly one
    has gaps, which makes it the reliable basis for ratio work.
    """
    ticker = yf.Ticker(to_yahoo_symbol(symbol, exchange))
    try:
        frame = ticker.income_stmt
    except Exception:
        return []

    if frame is None or frame.empty:
        return []

    rows: list[dict[str, Any]] = []
    for col in list(frame.columns)[:limit]:
        revenue = _first_available(frame, ["Total Revenue", "Operating Revenue"], col)
        if revenue in (None, 0):
            continue
        operating_profit = _first_available(frame, ["Operating Income", "EBIT"], col)
        net_profit = _val(frame, "Net Income", col)
        ts = pd.Timestamp(col)

        rows.append(
            {
                "period": f"FY{str(ts.year if ts.month <= 3 else ts.year + 1)[-2:]}",
                "periodEnd": ts.strftime("%Y-%m-%d"),
                "revenue": _cr(revenue),
                "operatingProfit": _cr(operating_profit),
                "opmPct": (
                    round((operating_profit / revenue) * 100, 2)
                    if operating_profit is not None
                    else None
                ),
                "netProfit": _cr(net_profit),
            }
        )

    rows.reverse()
    return rows


def _contiguous_tail(quarterly: list[dict[str, Any]], count: int) -> list[dict[str, Any]] | None:
    """
    The last `count` quarters, only if their period-ends are consecutive.

    Consecutive quarter-ends sit 85-95 days apart; anything outside that band
    means a reporting period is missing from the series.
    """
    if len(quarterly) < count:
        return None

    window = quarterly[-count:]
    for earlier, later in zip(window, window[1:]):
        try:
            gap = (pd.Timestamp(later["periodEnd"]) - pd.Timestamp(earlier["periodEnd"])).days
        except (KeyError, ValueError):
            return None
        if not 80 <= gap <= 100:
            return None
    return window


def compute_ratios(
    quarterly: list[dict[str, Any]],
    balance_sheet: list[dict[str, Any]],
    market_cap_cr: float | None,
    annual: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Trailing-twelve-month ratios derived from the statements above.

    ROE is computed here because Yahoo omits `returnOnEquity` for most Indian
    tickers. Anything that cannot be derived is returned as null and the UI
    shows it as unavailable.
    """
    latest_bs = balance_sheet[-1] if balance_sheet else None

    # A trailing-twelve-month figure is only meaningful over four *consecutive*
    # quarters. Yahoo's Indian coverage has gaps (GRSE is missing Q2 FY26), and
    # naively taking the last four rows would sum two Q1s and skip a Q2 — an
    # ROE that looks precise and is simply wrong. Where the run is broken, TTM
    # figures are reported as null and `ttmComplete` says why.
    ttm_window = _contiguous_tail(quarterly, 4)
    ttm_complete = ttm_window is not None

    def _sum(field: str) -> float | None:
        if ttm_window is None:
            return None
        values = [q[field] for q in ttm_window if q.get(field) is not None]
        return sum(values) if len(values) == len(ttm_window) else None

    net_profit_basis = _sum("netProfit")
    operating_basis = _sum("operatingProfit")
    revenue_basis = _sum("revenue")
    basis_label = "TTM"
    basis_period = "last four reported quarters"

    # Fall back to the latest completed fiscal year. It is a few months staler
    # than a true TTM but it is a real, whole period — which a gapped quarterly
    # sum is not.
    if not ttm_complete and annual:
        latest_fy = annual[-1]
        net_profit_basis = latest_fy.get("netProfit")
        operating_basis = latest_fy.get("operatingProfit")
        revenue_basis = latest_fy.get("revenue")
        basis_label = latest_fy.get("period", "FY")
        basis_period = f"full year to {latest_fy.get('periodEnd')}"

    ttm_net_profit = net_profit_basis
    ttm_operating = operating_basis
    ttm_revenue = revenue_basis

    net_worth = latest_bs.get("netWorth") if latest_bs else None
    roe_pct = (
        round((ttm_net_profit / net_worth) * 100, 2)
        if ttm_net_profit is not None and net_worth not in (None, 0)
        else None
    )

    # ROCE approximated as EBIT over capital employed (net worth plus borrowings)
    borrowings = latest_bs.get("borrowings") if latest_bs else None
    capital_employed = (
        (net_worth or 0) + (borrowings or 0) if net_worth is not None else None
    )
    roce_pct = (
        round((ttm_operating / capital_employed) * 100, 2)
        if ttm_operating is not None and capital_employed not in (None, 0)
        else None
    )

    return {
        "period": basis_label,
        # What the ratios below are actually computed over — shown in the UI so
        # a fiscal-year ROE is never mistaken for a trailing-twelve-month one.
        "basis": basis_period,
        "revenueCr": round(ttm_revenue, 2) if ttm_revenue is not None else None,
        "netProfitCr": round(ttm_net_profit, 2) if ttm_net_profit is not None else None,
        "roePct": roe_pct,
        "rocePct": roce_pct,
        "currentRatio": latest_bs.get("currentRatio") if latest_bs else None,
        "debtToEquity": latest_bs.get("debtToEquity") if latest_bs else None,
        # Statutory rate applied uniformly; effective rates are not reported here
        "nopatCr": round(ttm_operating * 0.75, 2) if ttm_operating is not None else None,
        "marketCapCr": market_cap_cr,
        "ttmComplete": ttm_complete,
        "ttmNote": (
            None
            if ttm_complete
            else "Upstream is missing one or more quarters, so a trailing-twelve-month sum "
            "would double-count a period. Ratios use the latest full fiscal year instead."
        ),
        "quartersAvailable": len(quarterly),
    }
