"""Universe screener endpoints: factor screens and multi-window movers."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import constituents
from ..schemas import envelope
from ..services import screener, technicals

router = APIRouter(prefix="/api/v1/screener", tags=["screener"])

# The batch download is the expensive call, so the derived screens share one
# cached universe rather than each triggering their own.
UNIVERSE_TTL = 3_600


def _universe(index: str):
    return CACHE.get_or_fetch(
        f"screener:universe:{index}",
        UNIVERSE_TTL,
        lambda: screener.build_universe_stats(index),
    )


@router.get("/indices")
def available_indices():
    return {
        "default": "nifty100",
        "indices": [
            {"id": key, "label": label} for key, (label, _f) in constituents.INDEX_FILES.items()
        ],
    }


@router.get("/factors")
def get_factors(
    index: str = Query("nifty100"),
    limit: int = Query(10, ge=3, le=30),
):
    if index not in constituents.INDEX_FILES:
        raise HTTPException(status_code=400, detail=f"unknown index '{index}'")

    try:
        stats, age = _universe(index)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Screener unavailable: {exc}") from exc

    screens = screener.factor_screens(stats, limit)
    return envelope(
        {
            **screens,
            "index": stats.get("index"),
            "indexLabel": stats.get("indexLabel"),
            "benchmark": stats.get("benchmark"),
            "computed": stats.get("computed"),
            "universeSize": stats.get("universeSize"),
        },
        age,
        source="Computed from Yahoo Finance history over NSE index constituents",
        delayed_minutes=15,
        note="Beta and alpha regressed on Nifty 50 over one year of daily returns.",
    )


@router.get("/movers")
def get_windowed_movers(
    window: str = Query("weekly", pattern="^(daily|weekly|monthly)$"),
    index: str = Query("nifty100"),
    limit: int = Query(15, ge=3, le=30),
):
    if index not in constituents.INDEX_FILES:
        raise HTTPException(status_code=400, detail=f"unknown index '{index}'")

    try:
        stats, age = _universe(index)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Screener unavailable: {exc}") from exc

    result = screener.windowed_movers(stats, window, limit)
    return envelope(
        {**result, "index": stats.get("index"), "indexLabel": stats.get("indexLabel")},
        age,
        source="Computed from Yahoo Finance history over NSE index constituents",
        delayed_minutes=15,
        note="NSE publishes daily variations only; weekly and monthly windows are computed from price history.",
    )


@router.get("/macd-crossover")
def macd_crossover(
    direction: str = Query("above", pattern="^(above|below)$"),
    interval: str = Query("15m"),
    within: int = Query(3, ge=1, le=50, description="Crossed within the last N bars"),
    index: str = Query("nifty50"),
):
    """Stocks whose MACD line crossed above / below its signal line in the last N bars."""
    if interval not in technicals.INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of {list(technicals.INTERVALS)}")
    if index not in constituents.INDEX_FILES:
        raise HTTPException(status_code=400, detail=f"unknown index '{index}'")

    def compute():
        members, _ = CACHE.get_or_fetch(
            f"screener:members:{index}", 86_400, lambda: constituents.fetch_constituents(index)
        )
        return technicals.macd_crossover_screen(members, interval, direction, within)

    intraday = technicals.INTERVALS[interval][3]
    try:
        data, age = CACHE.get_or_fetch(
            f"screener:macd:{index}:{interval}:{direction}:{within}", 120 if intraday else 900, compute
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Screener unavailable: {exc}") from exc
    return envelope(
        {**data, "index": index},
        age,
        source="Yahoo Finance",
        delayed_minutes=15,
        note="Computed from 15-minute delayed bars; a crossover on the latest bar can still flip before the bar closes.",
    )


def _fundamental_inputs(symbol: str) -> tuple[dict, dict, list]:
    """A company's vetted financials and valuation, as its page shows them, and screener.in's longer quarterly series."""
    from ..providers import screener as screener_provider
    from . import company

    try:
        alt = screener_provider.fetch_company(symbol).get("quarterly") or []
    except Exception:
        alt = []
    return company.get_financials(symbol, "NSE")["data"], company.get_valuation(symbol, "NSE")["data"], alt


@router.get("/fundamental")
def get_fundamental_screen(
    q: str = Query("", max_length=400),
    preset: str | None = Query(None),
    sort: str = Query("mcap"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = Query(50, ge=1, le=200),
):
    """Screen the Nifty 500 on vetted fundamentals, with price-based multiples from live prices."""
    from ..providers import nse as nse_provider
    from ..services import fundamental_screen as fs

    formula = fs.PRESETS[preset][1] if preset in fs.PRESETS else q
    snapshots = fs.load()
    if not snapshots:
        raise HTTPException(status_code=503, detail="Fundamental snapshots are still being recorded; the first slice is taken shortly after start-up.")
    try:
        traded, _ = CACHE.get_or_fetch("market:traded", 300, nse_provider.fetch_stocks_traded)
        live = traded.get("rows") or {}
    except Exception:
        live = {}
    try:
        data = fs.screen(formula, snapshots, live, sort=sort, descending=order == "desc", limit=limit)
    except fs.FilterError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    data["fields"] = {k: {"label": v[0], "unit": v[1], "basis": v[2]} for k, v in fs.FIELDS.items()}
    data["presets"] = {k: {"label": v[0], "formula": v[1]} for k, v in fs.PRESETS.items()}
    data["preset"] = preset if preset in fs.PRESETS else None
    return envelope(
        data, 0, source="Arthdex vetted financials (snapshots); NSE traded prices for multiples", delayed_minutes=SETTINGS.quote_delay_minutes,
        note=f"{data['universe']} companies snapshotted so far; the rest are recorded over the coming nights." if data["universe"] < 450 else None,
    )
