"""Quant engine endpoints — all estimated from real return series."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import fundamentals, yahoo
from ..schemas import envelope
from ..services import quant, sensitivity

router = APIRouter(prefix="/api/v1/company", tags=["quant"])


def _latest_balance(symbol: str, exchange: str) -> dict:
    rows = fundamentals.fetch_balance_sheet(symbol, exchange)
    return rows[-1] if rows else {}


@router.get("/{symbol}/quant")
def get_quant(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    """
    Volatility ensemble, VaR suite, Merton default risk, regime and forecasts.

    Model fitting is expensive, so results are cached for an hour. Any component
    that fails to converge returns a `note` explaining why rather than a value.
    """
    key = f"company:quant:{exchange}:{symbol.upper()}"

    def fetch():
        returns = quant.daily_log_returns(symbol, 3, exchange)
        if returns.empty:
            raise ValueError("no return history")

        ensemble = quant.volatility_ensemble(returns)
        consensus = ensemble.get("consensusAnnualisedVolPct") or ensemble.get(
            "realisedAnnualisedVolPct"
        )

        quote = yahoo.fetch_quote(symbol, exchange) or {}
        balance = _latest_balance(symbol, exchange)

        return {
            "symbol": symbol.upper(),
            "volatility": ensemble,
            "var": quant.var_suite(returns, consensus),
            "merton": quant.merton_default_risk(
                market_cap_cr=quote.get("marketCapCr"),
                total_debt_cr=balance.get("borrowings"),
                current_liabilities_cr=balance.get("currentLiabilities"),
                equity_vol_pct=consensus,
            ),
            "regime": quant.markov_regime(returns),
            "forecasts": quant.return_forecasts(returns),
            "microstructure": {
                "illustrative": True,
                "note": (
                    "Kyle's lambda and VPIN require tick-level order flow, which no free "
                    "or retail data feed exposes. These are not estimated."
                ),
                "kylesLambdaBps": None,
                "vpin": None,
            },
        }

    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.quant_ttl, fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Quant engine failed: {exc}") from exc

    return envelope(
        data,
        age,
        source="Computed from Yahoo Finance price history",
        delayed_minutes=SETTINGS.quote_delay_minutes,
        note=(
            "Models fitted on 3 years of daily log returns. Signal confidence is the "
            "drift-to-interval-width ratio, which rises with horizon because drift scales "
            "with time while the interval scales with its square root — it is not a claim "
            "that longer forecasts are more reliable."
        ),
    )


@router.get("/{symbol}/sensitivity")
def get_sensitivity(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    """OLS beta, alpha and R-squared against every benchmark with real history."""
    key = f"company:sensitivity:{exchange}:{symbol.upper()}"

    def fetch():
        frame = yahoo.fetch_daily_history(symbol, 3, exchange)
        if frame.empty:
            raise ValueError("no price history")
        return sensitivity.compute_sensitivities(frame)

    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.quant_ttl, fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Sensitivity failed: {exc}") from exc

    return envelope(
        data,
        age,
        source="Computed from Yahoo Finance index and stock history",
        delayed_minutes=SETTINGS.quote_delay_minutes,
    )
