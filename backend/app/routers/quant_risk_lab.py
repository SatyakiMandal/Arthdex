"""Risk lab routes: crisis replay, index-move stress test, benchmark regressions and a backtest."""

from __future__ import annotations

import re
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import yahoo
from ..schemas import envelope
from ..services import risk_lab, sensitivity

_routes = APIRouter(tags=["risk-lab"])

_SYMBOL_RE = re.compile(r"[A-Z0-9&_-]{1,20}")
HISTORY_TTL = 6 * 3600
HISTORY_YEARS = 20  # reaches the 2008 window
MAX_HOLDINGS = 15
PRICE_SOURCE = "Yahoo Finance daily closes"


def _history(symbol: str) -> risk_lab.Series:
    """Daily closes as (date, close), cached. An unknown symbol gives an empty series."""
    sym = symbol.upper()
    yahoo_symbol = "^NSEI" if sym == risk_lab.INDEX_SYMBOL else sym

    def fetch():
        frame = yahoo.fetch_daily_history(yahoo_symbol, HISTORY_YEARS, "NSE")
        return [(ts.date(), float(close)) for ts, close in frame["Close"].items() if close == close and close > 0]

    return CACHE.get_or_fetch(f"risklab:history:{sym}", HISTORY_TTL, fetch)[0]


def _index() -> risk_lab.Series:
    try:
        series = _history(risk_lab.INDEX_SYMBOL)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Index history unavailable: {exc}") from exc
    if not series:
        raise HTTPException(status_code=503, detail="Index history unavailable")
    return series


def _histories(symbols: list[str]) -> dict[str, risk_lab.Series]:
    out: dict[str, risk_lab.Series] = {}
    for sym in symbols:
        try:
            out[sym] = _history(sym)
        except Exception:
            out[sym] = []  # reported per holding as unavailable
    return out


class Holding(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20, pattern=r"^[A-Za-z0-9&_-]+$")
    value_inr: float = Field(..., gt=0, le=1e13, allow_inf_nan=False)


class StressTestRequest(BaseModel):
    portfolio: List[Holding] = Field(..., min_length=1, max_length=MAX_HOLDINGS)
    scenario_id: Optional[str] = Field(None, max_length=40, description="One of the ids from /scenarios")
    index_move_pct: Optional[float] = Field(None, ge=-90, le=90, allow_inf_nan=False, description="A chosen Nifty 50 move, used when scenario_id is not given")


class BacktestRequest(BaseModel):
    symbol: str = Field("NIFTY50", min_length=1, max_length=20, pattern=r"^[A-Za-z0-9&_-]+$")
    fast_period: int = Field(20, ge=2, le=250)
    slow_period: int = Field(50, ge=3, le=500)
    years: int = Field(5, ge=2, le=HISTORY_YEARS)
    initial_capital: float = Field(1_000_000.0, gt=0, le=1e12, allow_inf_nan=False)
    in_sample_pct: float = Field(0.70, ge=0.5, le=0.9)
    slippage_bps: float = Field(5.0, ge=0, le=1000, allow_inf_nan=False)
    brokerage_per_order_inr: float = Field(20.0, ge=0, le=1e6, allow_inf_nan=False)


@_routes.get("/scenarios")
@_routes.get("/crisis-scenarios")
def get_scenarios():
    """Crisis windows with the Nifty 50's change over each, computed from its price history."""
    index = _index()
    rows = []
    for s in risk_lab.SCENARIOS:
        change = risk_lab.window_change_pct(index, date.fromisoformat(s["start"]), date.fromisoformat(s["end"]))
        rows.append({**s, "index_change_pct": round(change, 2) if change is not None else None})
    return envelope(rows, 0, source=PRICE_SOURCE, delayed_minutes=SETTINGS.quote_delay_minutes,
                    note="Each window is a pair of dates; the index change is computed from recorded closes.")


@_routes.post("/stress-test")
def run_stress_test(req: StressTestRequest):
    """Replay a crisis window, or apply a chosen index move, to a portfolio."""
    positions = [{"symbol": h.symbol.upper(), "value_inr": h.value_inr} for h in req.portfolio]
    index = _index()
    histories = _histories(sorted({p["symbol"] for p in positions}))
    try:
        if req.scenario_id:
            scenario = risk_lab.scenario_by_id(req.scenario_id)
            if scenario is None:
                raise HTTPException(status_code=404, detail=f"Unknown scenario: {req.scenario_id}")
            result = risk_lab.replay(positions, scenario, histories, index)
        elif req.index_move_pct is not None:
            result = risk_lab.index_move(positions, req.index_move_pct, histories, index)
        else:
            raise HTTPException(status_code=400, detail="Give a scenario_id or an index_move_pct")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return envelope(result, 0, source=PRICE_SOURCE, delayed_minutes=SETTINGS.quote_delay_minutes,
                    note="Computed from recorded daily closes. Holdings marked 'estimate' were not listed for the whole window.")


@_routes.get("/factor-exposures")
def get_factor_exposures(symbol: str = Query(..., min_length=1, max_length=20)):
    """
    Beta, alpha and R-squared from ordinary least squares on daily returns against each index
    with a real history. Size, value and momentum factor returns for India are not published
    by any free source, so a multi-factor model is not offered.
    """
    sym = symbol.upper()
    if not _SYMBOL_RE.fullmatch(sym):
        raise HTTPException(status_code=400, detail="Invalid symbol")

    def fetch():
        frame = yahoo.fetch_daily_history(sym, 3, "NSE")
        if frame.empty:
            raise ValueError("no price history")
        return sensitivity.compute_sensitivities(frame)

    try:
        data, age = CACHE.get_or_fetch(f"company:sensitivity:NSE:{sym}", SETTINGS.quant_ttl, fetch)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=f"No price history for {sym}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Regression unavailable: {exc}") from exc
    return envelope({"symbol": sym, **data}, age, source=PRICE_SOURCE, delayed_minutes=SETTINGS.quote_delay_minutes,
                    note="Single-index regressions on three years of daily returns. No size, value or momentum factors: India has no free published factor series.")


@_routes.post("/backtest")
def run_backtest(req: BacktestRequest):
    """Moving-average crossover on the symbol's recorded daily closes, after transaction charges."""
    sym = req.symbol.upper()
    try:
        series = _history(sym)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Price history unavailable: {exc}") from exc
    if not series:
        raise HTTPException(status_code=404, detail=f"No price history for {sym}")
    cutoff = date.today().replace(year=date.today().year - req.years)
    series = [(d, c) for d, c in series if d >= cutoff]
    try:
        result = risk_lab.sma_backtest(sym, series, req.fast_period, req.slow_period, req.initial_capital,
                                       req.in_sample_pct, req.slippage_bps, req.brokerage_per_order_inr)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return envelope(result, 0, source=PRICE_SOURCE, delayed_minutes=SETTINGS.quote_delay_minutes,
                    note="A historical simulation, not a forecast or a recommendation.")


# The site's client (lib/api/endpoints.ts) calls every desk under /api/v1; the unversioned
# path is kept for anything already pointed at it.
router = APIRouter()
router.include_router(_routes, prefix="/api/risk-lab")
router.include_router(_routes, prefix="/api/v1/risk-lab", include_in_schema=False)
