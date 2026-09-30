"""Company endpoints: quote, profile, candles, valuation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import fundamentals, yahoo
from ..schemas import envelope

router = APIRouter(prefix="/api/v1/company", tags=["company"])

VALID_PERIODS = set(yahoo.PERIOD_MAP.keys())


@router.get("/{symbol}/quote")
def get_quote(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    key = f"company:quote:{exchange}:{symbol.upper()}"
    try:
        data, age = CACHE.get_or_fetch(
            key, SETTINGS.quote_ttl, lambda: yahoo.fetch_quote(symbol, exchange)
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Quote unavailable: {exc}") from exc

    if not data:
        raise HTTPException(status_code=404, detail=f"No quote found for {symbol.upper()}")
    return envelope(data, age, source="Yahoo Finance", delayed_minutes=SETTINGS.quote_delay_minutes)


@router.get("/{symbol}/profile")
def get_profile(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    key = f"company:profile:{exchange}:{symbol.upper()}"
    try:
        data, age = CACHE.get_or_fetch(
            key, SETTINGS.fundamentals_ttl, lambda: yahoo.fetch_profile(symbol, exchange)
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Profile unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance", delayed_minutes=0)


@router.get("/{symbol}/candles")
def get_candles(
    symbol: str,
    period: str = Query("1Y"),
    exchange: str = Query("NSE", pattern="^(NSE|BSE)$"),
):
    period = period.upper()
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"period must be one of {sorted(VALID_PERIODS)}",
        )

    key = f"company:candles:{exchange}:{symbol.upper()}:{period}"
    intraday = period in yahoo.INTRADAY_PERIODS

    def fetch():
        frame = yahoo.fetch_history(symbol, period, exchange)
        return yahoo.history_to_candles(frame, intraday)

    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.candles_ttl, fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Candles unavailable: {exc}") from exc

    if not data:
        raise HTTPException(
            status_code=404, detail=f"No price history for {symbol.upper()} over {period}"
        )

    return envelope(
        {"symbol": symbol.upper(), "period": period, "candles": data},
        age,
        source="Yahoo Finance",
        delayed_minutes=SETTINGS.quote_delay_minutes,
    )


@router.get("/{symbol}/financials")
def get_financials(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    """
    Quarterly P&L, annual balance-sheet highlights and derived TTM ratios.

    Yahoo exposes four to six quarters for most Indian issuers rather than the
    eight a full history would give, and the series can have gaps. Periods are
    returned exactly as reported.
    """
    key = f"company:financials:{exchange}:{symbol.upper()}"

    def fetch():
        quarterly = fundamentals.fetch_quarterly_pnl(symbol, exchange)
        annual = fundamentals.fetch_annual_pnl(symbol, exchange)
        balance = fundamentals.fetch_balance_sheet(symbol, exchange)
        quote = yahoo.fetch_quote(symbol, exchange)
        market_cap = quote.get("marketCapCr") if quote else None
        return {
            "symbol": symbol.upper(),
            "quarterly": quarterly,
            "annual": annual,
            "balanceSheet": balance,
            "ratios": fundamentals.compute_ratios(quarterly, balance, market_cap, annual),
        }

    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.fundamentals_ttl, fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Financials unavailable: {exc}") from exc

    if not data["quarterly"] and not data["balanceSheet"]:
        raise HTTPException(
            status_code=404, detail=f"No reported financials found for {symbol.upper()}"
        )

    return envelope(
        data,
        age,
        source="Yahoo Finance (reported statements)",
        delayed_minutes=0,
        note=f"{len(data['quarterly'])} quarters available upstream.",
    )


@router.get("/{symbol}/valuation")
def get_valuation(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    key = f"company:valuation:{exchange}:{symbol.upper()}"
    try:
        data, age = CACHE.get_or_fetch(
            key, SETTINGS.fundamentals_ttl, lambda: yahoo.fetch_valuation(symbol, exchange)
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Valuation unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance", delayed_minutes=0)
