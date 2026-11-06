"""Option chains, their analytics and the market-wide futures-and-options build-up."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import nse, nse_options
from ..schemas import envelope
from ..services import earnings_moves, fno_ban, fno_participants, options, options_strategy, quote_sources, volatility_surface

router = APIRouter(prefix="/api/v1/derivatives", tags=["derivatives"])

INDEX_REFERENCE = {"NIFTY": "nifty-50", "BANKNIFTY": "nifty-bank", "NIFTYNXT50": "nifty-next-50"}


def _reference_price(symbol: str) -> float | None:
    """Arthdex's own price for the underlying, to vet the chain's."""
    try:
        if symbol in INDEX_REFERENCE:
            levels, _ = CACHE.get_or_fetch("market:indices", SETTINGS.index_ttl, nse.fetch_indices)
            return next((r["level"] for r in levels if r["id"] == INDEX_REFERENCE[symbol]), None)
        if symbol not in nse_options.INDEX_SYMBOLS:
            quote, _ = CACHE.get_or_fetch(f"company:quote:NSE:{symbol}", SETTINGS.quote_ttl, lambda: quote_sources.fetch(symbol, "NSE"))
            return (quote or {}).get("cmp")
    except Exception:
        return None
    return None


@router.get("/expiries")
def get_expiries(symbol: str = Query("NIFTY")):
    sym = symbol.upper()
    try:
        data, age = CACHE.get_or_fetch(f"options:expiries:{sym}", 3600, lambda: nse_options.expiries(sym))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Expiries unavailable: {exc}") from exc
    if not data:
        raise HTTPException(status_code=404, detail=f"{sym} has no listed options")
    return envelope(data, age, source="NSE option contract information", delayed_minutes=0)


@router.get("/chain")
def get_chain(symbol: str = Query("NIFTY"), expiry: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$")):
    """One expiry's chain with PCR, max pain, ATM IV, implied move, OI walls and Greeks, vetted for consistency."""
    sym = symbol.upper()
    try:
        expiries, _ = CACHE.get_or_fetch(f"options:expiries:{sym}", 3600, lambda: nse_options.expiries(sym))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Expiries unavailable: {exc}") from exc
    today_ist = datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat()
    upcoming = [e for e in expiries if e >= today_ist]
    if not upcoming:
        raise HTTPException(status_code=404, detail=f"{sym} has no upcoming expiry")
    chosen = expiry if expiry in upcoming else upcoming[0]

    def build():
        return options.analyse(nse_options.chain(sym, chosen), _reference_price(sym))

    try:
        data, age = CACHE.get_or_fetch(f"options:chain:{sym}:{chosen}", 120, build)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Option chain unavailable: {exc}") from exc
    return envelope(
        {**data, "expiries": upcoming}, age, source="NSE option chain", delayed_minutes=SETTINGS.quote_delay_minutes,
        note=None if data["vetting"]["ok"] is not False else "One or more consistency checks failed; see vetting.",
    )


@router.get("/buildup")
def get_buildup():
    """F&O stocks classified as long or short build-up, short covering or long unwinding today."""

    def build():
        spurts = nse_options.oi_spurts()
        traded, _ = CACHE.get_or_fetch("market:traded", 60, nse.fetch_stocks_traded)
        changes = {sym: r.get("changePct") for sym, r in (traded.get("rows") or {}).items() if r.get("changePct") is not None}
        try:
            indices, _ = CACHE.get_or_fetch("market:indices", 45, nse.fetch_indices)
            underlying = {"NIFTY 50": "NIFTY", "NIFTY BANK": "BANKNIFTY", "NIFTY FINANCIAL SERVICES": "FINNIFTY", "NIFTY MIDCAP SELECT": "MIDCPNIFTY", "NIFTY NEXT 50": "NIFTYNXT50"}
            for idx in indices or []:
                sym = underlying.get((idx.get("name") or "").strip().upper())
                if sym and idx.get("changePercent") is not None:
                    changes[sym] = idx["changePercent"]
        except Exception:
            pass
        return {**options.build_up(spurts, changes), "asOf": traded.get("asOf")}

    try:
        data, age = CACHE.get_or_fetch("options:buildup", 300, build)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"F&O build-up unavailable: {exc}") from exc
    return envelope(data, age, source="NSE open-interest changes and traded prices", delayed_minutes=SETTINGS.quote_delay_minutes)


@router.get("/fno-ban")
def get_fno_ban():
    """Securities currently in the NSE F&O ban period (>=95% MWPL) and ban rules."""
    try:
        data = fno_ban.get_fno_ban_status()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"F&O ban list unavailable: {exc}") from exc
    return envelope(
        data,
        60,
        source="NSE official security ban list (fo_secban.csv)",
        delayed_minutes=0,
        note="Ban is triggered at 95% MWPL; exit occurs when open interest drops below 80% MWPL.",
    )


@router.get("/earnings-moves")
def get_earnings_moves():
    """Upcoming results meetings matched with at-the-money straddle implied moves."""
    try:
        data = earnings_moves.get_earnings_implied_moves()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Earnings implied moves unavailable: {exc}") from exc
    return envelope(
        data,
        300,
        source="NSE event calendar and options chain ATM straddles",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="Implied move is (Price(ATM CE) + Price(ATM PE)) / Spot, indicating market-expected volatility.",
    )


@router.get("/participant-oi")
def get_participant_oi():
    """Daily participant-wise open interest and net institutional derivatives positioning (FII, DII, Pro, Client)."""
    try:
        data = fno_participants.get_participant_oi_overview()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Participant OI unavailable: {exc}") from exc
    return envelope(
        data,
        1800,
        source="NSE daily participant-wise open interest report (fao_participant_oi)",
        delayed_minutes=0,
        note="Aggregates long vs short positions in Index Futures, Stock Futures, Index Options and Stock Options.",
    )


@router.get("/strategy/templates")
def get_strategy_templates(symbol: str = Query("NIFTY"), spot: float = Query(24500.0)):
    """Pre-calibrated multi-leg option strategy templates (Bull Spread, Straddle, Condor, Butterfly)."""
    templates = options_strategy.get_standard_strategy_templates(symbol=symbol.upper(), spot=spot)
    return envelope(
        templates,
        3600,
        source="Arthdex Derivatives Strategy Engine",
        delayed_minutes=0,
    )


@router.post("/strategy/payoff")
def calculate_strategy_payoff(payload: dict[str, Any]):
    """Computes expiry payoff curves, Greeks, and risk metrics for a user-configured multi-leg option strategy."""
    symbol = payload.get("symbol", "NIFTY")
    spot_price = float(payload.get("spotPrice", 24500.0))
    lot_size = int(payload.get("lotSize", 50 if symbol.upper() == "NIFTY" else 15))
    legs = payload.get("legs", [])
    days_to_expiry = int(payload.get("daysToExpiry", 7))
    risk_free_rate = float(payload.get("riskFreeRate", 0.068))

    res = options_strategy.build_options_strategy_payoff(
        symbol=symbol,
        spot_price=spot_price,
        lot_size=lot_size,
        legs=legs,
        days_to_expiry=days_to_expiry,
        risk_free_rate=risk_free_rate,
    )
    return envelope(
        res,
        0,
        source="Arthdex Multi-Leg Payoff & Black-Scholes Greeks Engine",
        delayed_minutes=0,
    )


@router.get("/{symbol}/vol-surface")
def get_vol_surface(symbol: str):
    """Implied volatility surface across strikes and expiries, 25-Delta skew, and term structure."""
    try:
        data = volatility_surface.get_volatility_surface(symbol=symbol)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Volatility surface unavailable: {exc}") from exc
    return envelope(
        data,
        300,
        source="NSE traded option chains & SVI smile interpolation",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note="25-Delta Risk Reversal measures downside put skew; Butterfly measures smile curvature.",
    )

