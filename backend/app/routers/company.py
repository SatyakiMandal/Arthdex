"""Company endpoints: quote, profile, candles, valuation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import fundamentals, yahoo
from ..schemas import envelope
from ..services import shareholding, technicals, yahoo_company

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


@router.get("/{symbol}/technicals")
def get_technicals(symbol: str, interval: str = Query("15m")):
    """Indicator suite on 5-minute, 15-minute, hourly or daily bars."""
    if interval not in technicals.INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {list(technicals.INTERVALS)}")
    sym = symbol.upper()
    intraday = technicals.INTERVALS[interval][3]

    def compute():
        return technicals.build(sym, interval, technicals.fetch_bars(sym, interval))

    try:
        data, age = CACHE.get_or_fetch(f"company:technicals:{sym}:{interval}", 120 if intraday else 900, compute)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Technicals unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="Yahoo Finance",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="Intraday history is limited upstream: about 60 days of 5- and 15-minute bars.",
    )


@router.get("/{symbol}/shareholding")
def get_shareholding(symbol: str):
    """Shareholding pattern, promoter pledge, large-holder and insider activity."""
    sym = symbol.upper()
    try:
        data, age = CACHE.get_or_fetch(f"company:shareholding:{sym}", 6 * 3600, lambda: shareholding.fetch(sym))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Shareholding unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="screener.in, NSE filings, Yahoo Finance",
        delayed_minutes=0,
        note="Holding patterns are filed quarterly, within 21 days of quarter end.",
    )


def _yahoo(key: str, ttl: int, fn, label: str):
    try:
        data, age = CACHE.get_or_fetch(key, ttl, fn)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"{label} unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance", delayed_minutes=0)


@router.get("/{symbol}/statistics")
def get_statistics(symbol: str):
    """Profile, valuation measures, financial highlights, trading and dividend data."""
    sym = symbol.upper()
    return _yahoo(f"company:ystats:{sym}", 6 * 3600, lambda: yahoo_company.profile_stats(sym), "Statistics")


@router.get("/{symbol}/statements")
def get_statements(symbol: str):
    sym = symbol.upper()
    return _yahoo(f"company:ystmts:{sym}", 6 * 3600, lambda: yahoo_company.statements(sym), "Statements")


@router.get("/{symbol}/analysts")
def get_analysts(symbol: str):
    sym = symbol.upper()
    return _yahoo(f"company:yanalysts:{sym}", 3 * 3600, lambda: yahoo_company.analysts(sym), "Analyst data")


@router.get("/{symbol}/history")
def get_history(symbol: str, range: str = Query("1Y"), interval: str = Query("1d")):
    rng = range.upper()
    if rng not in yahoo_company.RANGES:
        raise HTTPException(status_code=400, detail=f"range must be one of {list(yahoo_company.RANGES)}")
    if interval not in ("1d", "1wk", "1mo"):
        raise HTTPException(status_code=400, detail="interval must be 1d, 1wk or 1mo")
    sym = symbol.upper()
    return _yahoo(f"company:yhist:{sym}:{rng}:{interval}", 900, lambda: yahoo_company.history(sym, rng, interval), "History")


@router.get("/{symbol}/compare")
def get_compare(symbol: str, peers: str = Query(""), period: str = Query("1Y")):
    per = period.upper()
    if per not in yahoo_company.RANGES:
        raise HTTPException(status_code=400, detail=f"period must be one of {list(yahoo_company.RANGES)}")
    sym = symbol.upper()
    plist = [p.strip().upper() for p in peers.split(",") if p.strip()][:6]
    return _yahoo(f"company:ycmp:{sym}:{','.join(plist)}:{per}", 900, lambda: yahoo_company.compare(sym, plist, per), "Comparison")
