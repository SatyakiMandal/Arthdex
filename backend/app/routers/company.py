"""Company endpoints: quote, profile, candles, valuation."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

from .. import listings
from ..cache import CACHE
from ..config import SETTINGS
from ..providers import bse, fundamentals, nse, nse_xbrl, screener, yahoo
from ..schemas import envelope
from ..services import (
    financial_sources,
    quote_sources,
    risk_layer,
    shareholding,
    technicals,
    yahoo_company,
)

router = APIRouter(prefix="/api/v1/company", tags=["company"])

VALID_PERIODS = set(yahoo.PERIOD_MAP.keys())


@router.get("/{symbol}/quote")
def get_quote(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    exchange = listings.exchange_for(symbol, exchange)
    key = f"company:quote:{exchange}:{symbol.upper()}"
    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.quote_ttl, lambda: _quote(symbol, exchange))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Quote unavailable: {exc}") from exc

    if not data:
        raise HTTPException(status_code=404, detail=f"No quote found for {symbol.upper()}")
    used = (data.get("sources") or {}).get("used")
    return envelope(
        data, age, source=f"{exchange} (Yahoo Finance cross-check)" if used in ("nse", "bse") else f"Yahoo Finance ({exchange} unavailable)",
        delayed_minutes=SETTINGS.quote_delay_minutes,
    )


def _quote(symbol: str, exchange: str) -> dict | None:
    return quote_sources.fetch(symbol, exchange)


@router.get("/{symbol}/profile")
def get_profile(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    key = f"company:profile:{exchange}:{symbol.upper()}"
    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.fundamentals_ttl, lambda: _profile(symbol, exchange))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Profile unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance, NSE for identifiers", delayed_minutes=0)


def _profile(symbol: str, exchange: str) -> dict:
    """
    Yahoo's profile, with the ISIN (which Yahoo leaves empty for Indian listings) from the
    exchange. If Yahoo has no profile, name and classification come from the exchange alone.
    """
    try:
        profile = yahoo.fetch_profile(symbol, exchange)
    except Exception:
        profile = None
    try:
        quote, _ = CACHE.get_or_fetch(f"company:quote:{exchange}:{symbol.upper()}", SETTINGS.quote_ttl, lambda: _quote(symbol, exchange))
    except Exception:
        quote = None
    quote = quote or {}
    if not profile:
        if not quote.get("name"):
            raise ValueError(f"No profile from Yahoo or NSE for {symbol.upper()}")
        profile = {"name": quote["name"], "sector": quote.get("sector") or "", "industry": quote.get("basicIndustry") or "",
                   "isin": None, "website": None, "summary": None, "employees": None}
    if not profile.get("isin") and quote.get("isin"):
        profile = {**profile, "isin": quote["isin"]}
    return profile


@router.get("/{symbol}/candles")
def get_candles(
    symbol: str,
    period: str = Query("1Y"),
    exchange: str = Query("NSE", pattern="^(NSE|BSE)$"),
):
    period = period.upper()
    exchange = listings.exchange_for(symbol, exchange)
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"period must be one of {sorted(VALID_PERIODS)}",
        )

    key = f"company:candles:{exchange}:{symbol.upper()}:{period}"
    intraday = period in yahoo.INTRADAY_PERIODS

    def fetch():
        try:
            frame = yahoo.fetch_history(symbol, period, exchange)
            candles = yahoo.history_to_candles(frame, intraday)
        except Exception:
            candles = []
        if candles:
            if symbol.startswith("^"):
                daily_index = not intraday and yahoo.PERIOD_MAP[period][1] == "1d"
                return {"candles": _fill_index_session(symbol, candles) if daily_index else candles, "source": "yahoo", "vetting": None}
            if exchange.upper() == "BSE" and not intraday:
                # Yahoo's BSE series are often thin (one day for RELIANCE.BO); BSE's own year of
                # daily closes wins whenever Yahoo has fewer sessions over the same window
                code = listings.bse_code(symbol)
                days = NSE_HISTORY_DAYS.get(period)
                if code and days and days <= 366:
                    try:
                        start = (date.today() - timedelta(days=days)).isoformat()
                        own = [c for c in bse.fetch_daily_history(code) if c["date"] >= start]
                    except Exception:
                        own = []
                    if len(own) > len([c for c in candles if str(c.get("date") or c.get("time") or "")[:10] >= start]) * 1.1:
                        return {"candles": own, "source": "bse", "vetting": None}
            if intraday or exchange.upper() != "NSE":
                return {"candles": candles, "source": "yahoo", "vetting": None}
            daily = yahoo.PERIOD_MAP[period][1] == "1d"
            candles, vetting = _vet_and_fill(symbol, candles, fill=daily)
            return {"candles": candles, "source": "yahoo", "vetting": vetting}
        # The exchange's daily history backs up the daily periods (Yahoo's weekly and
        # intraday series have no exchange equivalent here)
        days = NSE_HISTORY_DAYS.get(period)
        if days and exchange.upper() == "NSE":
            nse_candles = nse.fetch_daily_history(symbol, days)
            if nse_candles:
                return {"candles": nse_candles, "source": "nse"}
        code = listings.bse_code(symbol) if exchange.upper() == "BSE" else None
        if days and code and days <= 366:
            # BSE's own chart feed covers the last year, closes only
            bse_candles = [c for c in bse.fetch_daily_history(code) if c["date"] >= (date.today() - timedelta(days=days)).isoformat()]
            if bse_candles:
                return {"candles": bse_candles, "source": "bse"}
        raise ValueError(f"No price history for {symbol.upper()} over {period}")

    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.candles_ttl, fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Candles unavailable: {exc}") from exc

    if not data["candles"]:
        raise HTTPException(
            status_code=404, detail=f"No price history for {symbol.upper()} over {period}"
        )

    from_exchange = data["source"] in ("nse", "bse")
    return envelope(
        {"symbol": symbol.upper(), "period": period, "exchange": exchange, "candles": data["candles"], "vetting": data.get("vetting")},
        age,
        source=f"{data['source'].upper()}'s own daily history" if from_exchange else f"Yahoo Finance ({exchange})",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note=(
            "BSE daily closes as traded; the feed has no open, high or low."
            if data["source"] == "bse"
            else "Exchange prices as traded, not adjusted for splits or bonus issues." if from_exchange else None
        ),
    )


NSE_HISTORY_DAYS = {"1M": 31, "6M": 183, "1Y": 366}


def _fill_index_session(symbol: str, candles: list[dict]) -> list[dict]:
    """
    Add the latest session from NSE's index feed when Yahoo's index history lacks it
    (^NSEI's history ended on 2 November 2026 while NSE showed the 3 November close).
    Only daily series, and only a session newer than Yahoo's last bar.
    """
    index_id = {v: k for k, v in yahoo.NSE_INDEX_SYMBOLS.items()}.get(symbol.upper())
    if not index_id or not candles or len(candles[-1]["date"]) > 10:
        return candles
    try:
        levels, _ = CACHE.get_or_fetch("market:indices", SETTINGS.index_ttl, nse.fetch_indices)
    except Exception:
        return candles
    row = next((r for r in levels if r["id"] == index_id), None)
    session = (row or {}).get("session") or {}
    if not session.get("date") or session["date"] <= candles[-1]["date"][:10] or None in (session.get("open"), session.get("high"), session.get("low")):
        return candles
    return candles + [{**session, "volume": 0}]


def _vet_and_fill(symbol: str, candles: list[dict], fill: bool) -> tuple[list[dict], dict | None]:
    """
    Yahoo's recent daily closes against the exchange's, and, for daily series, any recent
    sessions Yahoo is missing filled from the exchange (Cochin Shipyard's 3 November 2026
    session was absent from Yahoo's history while its quote had it).

    Only the last two weeks are compared: older Yahoo prices are adjusted for later splits
    and the exchange's are not. A failed NSE call leaves the series as Yahoo gave it.
    """
    try:
        exchange_rows = nse.fetch_daily_history(symbol, 14)
    except Exception:
        return candles, None
    by_date = {r["date"]: r for r in exchange_rows}
    filled = 0
    if fill and candles:
        last = candles[-1]["date"][:10]
        newer = [r for r in exchange_rows if r["date"] > last]
        candles = candles + newer
        filled = len(newer)
    pairs = [(c["date"][:10], c["close"], by_date[c["date"][:10]]["close"]) for c in candles[-10:] if c["date"][:10] in by_date]
    if not pairs:
        return candles, None
    worst = max(pairs, key=lambda p: abs(p[1] - p[2]) / p[2])
    gap = abs(worst[1] - worst[2]) / worst[2]
    return candles, {
        "compared": len(pairs), "worstDate": worst[0], "yahoo": worst[1], "nse": worst[2],
        "gapPct": round(gap * 100, 3), "agree": gap <= 0.005, "filledFromNse": filled,
    }


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
        primary = {
            "quarterly": fundamentals.fetch_quarterly_pnl(symbol, exchange),
            "annual": fundamentals.fetch_annual_pnl(symbol, exchange),
            "balanceSheet": fundamentals.fetch_balance_sheet(symbol, exchange),
        }
        # The second source is always fetched, not only when Yahoo looks wrong: vetting
        # needs both, and a stale or gapped Yahoo series is only visible by comparison.
        try:
            backup = screener.fetch_company(symbol)
        except Exception:
            backup = {"quarterly": [], "annual": [], "balanceSheet": [], "url": None}
        chosen, sources = {}, {}
        # The company's own XBRL filing with NSE settles any disagreement left after vetting
        def filing_for(period_end: str) -> dict | None:
            return nse_xbrl.figures_for(symbol, period_end) if exchange.upper() == "NSE" else None

        for kind in ("quarterly", "annual", "balanceSheet"):
            chosen[kind], sources[kind] = financial_sources.choose(kind, primary[kind], backup.get(kind) or [], filing_for=filing_for)
        sources["screenerUrl"] = backup.get("url")
        quote, _ = CACHE.get_or_fetch(f"company:quote:{exchange}:{symbol.upper()}", SETTINGS.quote_ttl, lambda: _quote(symbol, exchange))
        market_cap = quote.get("marketCapCr") if quote else None
        return {
            "symbol": symbol.upper(),
            **chosen,
            "ratios": fundamentals.compute_ratios(chosen["quarterly"], chosen["balanceSheet"], market_cap, chosen["annual"]),
            "sources": sources,
        }

    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.fundamentals_ttl, fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Financials unavailable: {exc}") from exc

    if not data["quarterly"] and not data["balanceSheet"]:
        raise HTTPException(
            status_code=404, detail=f"No reported financials found for {symbol.upper()}"
        )

    # Computed per request, not cached: the panel warns when the newest quarter is overdue
    latest = data["quarterly"][-1]["periodEnd"] if data["quarterly"] else None
    today_ist = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    data = {**data, "latestQuarterAgeDays": (today_ist - date.fromisoformat(latest)).days if latest else None}

    used = {k: data.get("sources", {}).get(k, {}).get("used") for k in ("quarterly", "annual", "balanceSheet")}
    names = {"yahoo": "Yahoo Finance", "screener": "screener.in"}
    series = {"quarterly": "quarterly results", "annual": "annual results", "balanceSheet": "balance sheet"}
    present = {v for v in used.values() if v and v != "none"}
    if len(present) <= 1:
        label = f"{names.get(next(iter(present), 'yahoo'))}, reported statements cross-checked against " + (
            "screener.in" if present != {"screener"} else "Yahoo Finance"
        )
    else:
        by_source: dict[str, list[str]] = {}
        for k, v in used.items():
            if v and v != "none":
                by_source.setdefault(names[v], []).append(series[k])
        label = "; ".join(f"{' and '.join(parts)} from {src}" for src, parts in by_source.items())
        label = label[0].upper() + label[1:] + ", each cross-checked against the other"

    return envelope(
        data,
        age,
        source=label,
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
    return envelope(_live_valuation(symbol, exchange, data), age, source="Yahoo Finance", delayed_minutes=0)


def _live_valuation(symbol: str, exchange: str, cached: dict) -> dict:
    """
    Price-based multiples re-derived from the live quote on every request.

    The fundamentals cache holds Yahoo's multiples for hours, so its P/E was priced
    at whatever the stock traded at when it was fetched (TCS: 17.45 against a live
    17.52). Per-share earnings and book value change only with filings, so dividing
    the current price by them gives the multiple a reader expects beside that price.
    ROE comes from the same statements calculation the key-ratios panel shows, so
    the page never prints two different ROEs.
    """
    data = dict(cached)
    try:
        quote, _ = CACHE.get_or_fetch(
            f"company:quote:{exchange}:{symbol.upper()}", SETTINGS.quote_ttl, lambda: _quote(symbol, exchange)
        )
        price = quote.get("cmp") if quote else None
    except Exception:
        price = None
    try:
        ratios = get_financials(symbol, exchange)["data"]["ratios"]
    except Exception:
        ratios = {}
    if ratios.get("roePct") is not None:
        data["roePct"] = ratios["roePct"]
    # EPS from the vetted filed quarters (or latest full year), the same basis as
    # screener.in's P/E; Yahoo's trailingEps can trail the filings by a year
    if isinstance(ratios.get("eps"), (int, float)) and ratios["eps"] > 0:
        data["eps"] = ratios["eps"]
        data["epsBasis"] = ratios.get("basis")
    if price:
        eps, book, paid = data.get("eps"), data.get("bookValue"), data.get("dividendsTtm")
        if eps and eps > 0:
            data["peRatio"] = round(price / eps, 2)
        if book and book > 0:
            data["pbRatio"] = round(price / book, 2)
        if paid is not None:
            data["dividendYieldPct"] = round(paid / price * 100, 2)
    one_off = _one_offs(symbol, exchange, ratios)
    if one_off:
        data["oneOffs"] = one_off
        adjusted = one_off.get("epsBeforeOneOffs")
        if price and adjusted and adjusted > 0:
            data["peBeforeOneOffs"] = round(price / adjusted, 2)
    return data


def _one_offs(symbol: str, exchange: str, ratios: dict) -> dict | None:
    """Exceptional and discontinued items in the trailing four quarters, from the filings (cached)."""
    if ratios.get("period") != "TTM" or not ratios.get("eps") or not ratios.get("netProfitCr"):
        return None  # a full-year basis has its own filing; only the quarter sum is adjusted here
    sym = symbol.upper()

    def build():
        from ..services import one_offs

        quarters = get_financials(sym, exchange)["data"].get("quarterly") or []
        ends = [q["periodEnd"][:10] for q in quarters if q.get("periodEnd")]
        return one_offs.for_symbol(sym, ends, ratios.get("netProfitCr"), ratios.get("eps"), nse_xbrl.figures_for)

    try:
        return CACHE.get_or_fetch(f"company:oneoffs:{sym}:{ratios.get('eps')}", 12 * 3600, build)[0]
    except Exception:
        return None


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


@router.get("/{symbol}/risk")
def get_risk(symbol: str):
    """Deterministic risk score, drawdown, VaR, liquidity and position sizing from daily bars."""
    sym = symbol.upper()

    def compute():
        return risk_layer.assess(sym, technicals.fetch_bars(sym, "1d"))

    try:
        data, age = CACHE.get_or_fetch(f"company:risk:{sym}", 900, compute)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Risk unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance", delayed_minutes=SETTINGS.quote_delay_minutes)


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
    res = _yahoo(f"company:ystats:{sym}", 6 * 3600, lambda: yahoo_company.profile_stats(sym), "Statistics")
    # Yahoo's own TTM revenue and profit lag the filed quarters and treat one-offs
    # differently (HINDUNILVR: 10,585 against 15,062 filed). The overview's figures
    # come from the filed quarters, so the statistics tab shows the same ones.
    try:
        ratios = get_financials(sym, "NSE")["data"]["ratios"]
        if ratios.get("ttmComplete"):
            data = dict(res["data"])
            highlights = dict(data.get("highlights") or {})
            if ratios.get("revenueCr") is not None:
                highlights["revenue"] = ratios["revenueCr"]
            if ratios.get("netProfitCr") is not None:
                highlights["netIncome"] = ratios["netProfitCr"]
            if isinstance(ratios.get("eps"), (int, float)) and ratios["eps"] > 0:
                highlights["eps"] = ratios["eps"]
            data["highlights"] = highlights
            res = {**res, "data": data}
    except Exception:
        pass
    # The 52-week range is the exchange's own record when NSE answered (Yahoo's, built
    # from its own bars, differed by up to 1.7% for ITC and Titan)
    try:
        quote, _ = CACHE.get_or_fetch(f"company:quote:NSE:{sym}", SETTINGS.quote_ttl, lambda: _quote(sym, "NSE"))
        if quote and (quote.get("sources") or {}).get("used") == "nse" and quote.get("high52w") and quote.get("low52w"):
            data = dict(res["data"])
            data["trading"] = {**(data.get("trading") or {}), "high52w": quote["high52w"], "low52w": quote["low52w"]}
            res = {**res, "data": data}
        # Price-based multiples from the live quote, as in the masthead (Yahoo's are cached
        # for hours: Cochin Shipyard's P/E read 44.35 here against a live 46.44)
        price = (quote or {}).get("cmp")
        if price:
            data = dict(res["data"])
            highlights, valuation = data.get("highlights") or {}, dict(data.get("valuation") or {})
            eps, book = highlights.get("eps"), highlights.get("bookValue")
            if eps and eps > 0:
                valuation["trailingPE"] = round(price / eps, 2)
            if book and book > 0:
                valuation["priceToBook"] = round(price / book, 2)
            if quote.get("marketCapCr"):
                valuation["marketCap"] = quote["marketCapCr"]
            data["valuation"] = valuation
            res = {**res, "data": data}
    except Exception:
        pass
    return res


@router.get("/{symbol}/statements")
def get_statements(symbol: str):
    sym = symbol.upper()
    res = _yahoo(f"company:ystmts:{sym}", 6 * 3600, lambda: yahoo_company.statements(sym), "Statements")
    # Full line items have no second source, so a stale series is flagged rather than replaced
    try:
        newest = (res["data"]["income"]["quarterly"] or {}).get("dates", [None])[0]
        age = (date.today() - date.fromisoformat(newest)).days if newest else None
        res = {**res, "data": {**res["data"], "latestQuarterAgeDays": age, "latestQuarter": newest}}
    except Exception:
        pass
    return res


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


@router.get("/{symbol}/peers")
def get_peers(symbol: str):
    """The company's industry peers from screener.in, vetted through the company's own row."""
    sym = symbol.upper()

    def build():
        from ..services import peers

        quote, _ = CACHE.get_or_fetch(f"company:quote:NSE:{sym}", SETTINGS.quote_ttl, lambda: _quote(sym, "NSE"))
        try:
            valuation = get_valuation(sym, "NSE")["data"]
        except Exception:
            valuation = None
        return peers.peers(sym, quote, valuation)

    try:
        data, age = CACHE.get_or_fetch(f"company:peers:{sym}", 6 * 3600, build)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Peers unavailable: {exc}") from exc
    return envelope(
        data, age, source="screener.in industry classification and peer figures", delayed_minutes=0,
        note=None if data["vetting"]["vetted"] else "The company's own row did not agree with Arthdex's vetted figures, so the peer figures are unvetted.",
    )


@router.get("/{symbol}/valuation-bands")
def get_valuation_bands(symbol: str):
    """P/E over five years on the full-year EPS known at each date, and where today's sits."""
    sym = symbol.upper()

    def build():
        from ..services import peers

        quote, _ = CACHE.get_or_fetch(f"company:quote:NSE:{sym}", SETTINGS.quote_ttl, lambda: _quote(sym, "NSE"))
        return peers.pe_band(sym, (quote or {}).get("cmp"))

    try:
        data, age = CACHE.get_or_fetch(f"company:pe-band:{sym}", 6 * 3600, build)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Valuation bands unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance weekly prices; screener.in annual EPS", delayed_minutes=0)


@router.get("/{symbol}/forensics")
def get_forensics(symbol: str):
    """Piotroski, Altman, Beneish, cash conversion and reverse-DCF inputs, withheld if Yahoo's lines fail vetting."""
    sym = symbol.upper()

    def build():
        from ..services import forensics

        statements = get_statements(sym)["data"]
        vetted = get_financials(sym, "NSE")["data"]
        quote, _ = CACHE.get_or_fetch(f"company:quote:NSE:{sym}", SETTINGS.quote_ttl, lambda: _quote(sym, "NSE"))
        company = screener.fetch_company(sym)
        lender = any(r.get("lender") for r in company.get("quarterly") or [])
        return forensics.build(statements, vetted, (quote or {}).get("marketCapCr"), lender, company.get("annual"))

    try:
        data, age = CACHE.get_or_fetch(f"company:forensics:{sym}", 6 * 3600, build)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Quality checks unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance line items, vetted against Yahoo, screener.in and NSE filings", delayed_minutes=0)


@router.get("/{symbol}/filings")
def get_company_filings(symbol: str, limit: int = Query(40, ge=1, le=100)):
    """Exchange disclosures classified by category with event-day abnormal returns."""
    sym = symbol.upper()
    from ..services import news as news_service

    def build():
        fn = getattr(news_service, "company_filings_with_reaction", None)
        if callable(fn):
            return fn(sym, limit=limit)
        return {"symbol": sym, "asOf": None, "filings": [], "categoryCounts": {}}

    try:
        data, age = CACHE.get_or_fetch(f"company:filings:{sym}:{limit}", 300, build)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Filings unavailable: {exc}") from exc
    return envelope(data, age, source="NSE corporate announcements + 1D price reaction", delayed_minutes=0)


@router.get("/compare")
def compare_companies(symbols: str = Query(..., description="Comma-separated NSE tickers, e.g. TCS,INFY,WIPRO")):
    """Side-by-side comparison matrix for up to 4 companies across valuation, returns, balance sheet and forensics."""
    from ..services import comparison
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not sym_list:
        raise HTTPException(status_code=400, detail="Provide at least one symbol to compare")
    try:
        data = comparison.compare(sym_list)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Comparison unavailable: {exc}") from exc
    return envelope(data, 120, source="Arthdex vetted fundamentals & forensics", delayed_minutes=0)


@router.get("/{symbol}/exchanges")
def get_exchange_comparison(symbol: str):
    """
    NSE and BSE side by side for a company listed on both: each exchange's own quote,
    the price gap between them, each one's share of the day's volume, and a year of
    daily closes from each exchange's own records with the gap on every shared day.
    """
    entry = listings.resolve(symbol)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} is not a listed company")
    if len(entry["exchanges"]) < 2:
        raise HTTPException(status_code=404, detail=f"{entry['name']} is listed only on {entry['exchanges'][0]}")
    sym, code = entry["nse"]["symbol"], entry["bse"]["code"]

    def build() -> dict:
        def quote(ex: str):
            try:
                q, _ = CACHE.get_or_fetch(f"company:quote:{ex}:{entry['id']}", SETTINGS.quote_ttl, lambda: _quote(entry["id"], ex))
                return q
            except Exception:
                return None

        nq, bq = quote("NSE"), quote("BSE")
        try:
            n_hist = nse.fetch_daily_history(sym, 366)
        except Exception:
            n_hist = []
        try:
            b_hist = bse.fetch_daily_history(code)
        except Exception:
            b_hist = []

        def side(q, ex: str) -> dict | None:
            if not q or (q.get("sources") or {}).get("used") != ex.lower():
                return None  # only the exchange's own quote is compared, never Yahoo's stand-in
            keys = ("cmp", "change", "open", "previousClose", "dayHigh", "dayLow", "high52w", "low52w", "volume", "turnoverCr", "vwap", "exchangeTime", "asOf")
            return {k: q.get(k) for k in keys}

        n, b = side(nq, "NSE"), side(bq, "BSE")
        gap = None
        if n and b and n["cmp"] and b["cmp"]:
            diff = n["cmp"] - b["cmp"]
            gap = {"absolute": round(diff, 2), "percent": round(diff / ((n["cmp"] + b["cmp"]) / 2) * 100, 3)}
        volume_share = None
        if n and b and (n["volume"] or 0) + (b["volume"] or 0) > 0:
            volume_share = {"nse": round(n["volume"] / (n["volume"] + b["volume"]) * 100, 1), "bse": round(b["volume"] / (n["volume"] + b["volume"]) * 100, 1)}

        b_by_day = {c["date"]: c for c in b_hist}
        history = []
        for c in n_hist:
            other = b_by_day.get(c["date"])
            if other and c["close"] and other["close"]:
                history.append({
                    "date": c["date"], "nse": c["close"], "bse": other["close"],
                    "gapPct": round((c["close"] - other["close"]) / ((c["close"] + other["close"]) / 2) * 100, 3),
                    "nseVolume": c["volume"], "bseVolume": other["volume"],
                })
        gaps = [abs(h["gapPct"]) for h in history]
        return {
            "id": entry["id"], "name": entry["name"], "isin": entry["isin"],
            "nseSymbol": sym, "bseCode": code, "bseScripId": entry["bse"].get("scripId"),
            "nse": n, "bse": b, "gap": gap, "volumeShare": volume_share,
            "history": history,
            "historySummary": {
                "days": len(history),
                "meanAbsGapPct": round(sum(gaps) / len(gaps), 3) if gaps else None,
                "maxAbsGapPct": round(max(gaps), 3) if gaps else None,
                "daysNseHigher": sum(1 for h in history if h["gapPct"] > 0),
                "daysBseHigher": sum(1 for h in history if h["gapPct"] < 0),
                "nseVolumeSharePct": round(sum(h["nseVolume"] for h in history) / max(1, sum(h["nseVolume"] + h["bseVolume"] for h in history)) * 100, 1) if history else None,
            },
        }

    try:
        data, age = CACHE.get_or_fetch(f"company:exchanges:{entry['id']}", 300, build)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Exchange comparison unavailable: {exc}") from exc
    return envelope(
        data, age, source="NSE and BSE quotes and daily histories, each from its own exchange",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="Gaps are measured against the average of the two prices. Daily closes are as traded on each exchange.",
    )


@router.get("/{symbol}/listing")
def get_listing(symbol: str):
    """Where a company trades: exchanges, tickers, boards and BSE status, from the exchanges' own lists."""
    try:
        data = listings.describe(symbol)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Listings unavailable: {exc}") from exc
    if data is None:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} is not a listed company")
    return envelope({**data, "name": listings.resolve(symbol)["name"]}, CACHE.age("listings:all") or 0.0, source="NSE and BSE listing files, joined by ISIN")
