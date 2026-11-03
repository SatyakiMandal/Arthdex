"""Option chains, their analytics and the market-wide futures-and-options build-up."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import nse, nse_options
from ..schemas import envelope
from ..services import options, quote_sources

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
    from datetime import date

    sym = symbol.upper()
    try:
        expiries, _ = CACHE.get_or_fetch(f"options:expiries:{sym}", 3600, lambda: nse_options.expiries(sym))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Expiries unavailable: {exc}") from exc
    upcoming = [e for e in expiries if e >= date.today().isoformat()]
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
        traded = nse.fetch_stocks_traded()
        # rows is keyed by symbol
        changes = {sym: r.get("changePct") for sym, r in (traded.get("rows") or {}).items() if r.get("changePct") is not None}
        return {**options.build_up(spurts, changes), "asOf": traded.get("asOf")}

    try:
        data, age = CACHE.get_or_fetch("options:buildup", 300, build)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"F&O build-up unavailable: {exc}") from exc
    return envelope(data, age, source="NSE open-interest changes and traded prices", delayed_minutes=SETTINGS.quote_delay_minutes)
