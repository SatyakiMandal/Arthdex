"""Market-wide endpoints: indices, movers, global sentiment."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import constituents, nse, yahoo
from ..schemas import envelope
from ..services import bhavcopy, commodities, sector_rotation, surveillance

router = APIRouter(prefix="/api/v1/market", tags=["market"])


@router.get("/indices")
def get_indices():
    """Broad, sectoral and thematic NSE indices for the ticker bar."""
    try:
        data, age = CACHE.get_or_fetch("market:indices", SETTINGS.index_ttl, nse.fetch_indices)
        return envelope(data, age, source="NSE (nseindia.com public API)", delayed_minutes=1)
    except Exception as nse_exc:
        # NSE refuses some networks outright; Yahoo carries the same levels (vetted to the paisa)
        try:
            data, age = CACHE.get_or_fetch(
                "market:indices:yahoo", SETTINGS.index_ttl, lambda: yahoo.fetch_nse_index_levels(nse.TICKER_INDICES)
            )
        except Exception:
            data, age = [], 0
        if not data:
            raise HTTPException(status_code=503, detail=f"NSE indices unavailable: {nse_exc}") from nse_exc
        return envelope(
            data, age, source="Yahoo Finance (NSE unavailable)", delayed_minutes=SETTINGS.quote_delay_minutes,
            note="Breadth and index valuation come from NSE only and are missing until it answers again.",
        )


@router.get("/mover-universes")
def get_mover_universes():
    """Selectable universes for the movers table, for building a UI selector."""
    return {
        "default": nse.DEFAULT_MOVER_UNIVERSE,
        "universes": [
            {"id": key, "label": label} for key, (_nse_key, label) in nse.MOVER_UNIVERSES.items()
        ],
    }


@router.get("/movers")
def get_movers(
    direction: str = Query("gainers", pattern="^(gainers|losers)$"),
    universe: str = Query(nse.DEFAULT_MOVER_UNIVERSE),
    limit: int = Query(15, ge=1, le=50),
):
    """
    Top gainers or losers for a chosen universe.

    NSE publishes daily variations only. Weekly and monthly windows are computed
    in the screener service from historical candles, not here.
    """
    if universe not in nse.MOVER_UNIVERSES:
        raise HTTPException(
            status_code=400,
            detail=f"universe must be one of {sorted(nse.MOVER_UNIVERSES)}",
        )

    key = f"market:movers:{direction}:{universe}"
    try:
        data, age = CACHE.get_or_fetch(
            key, SETTINGS.movers_ttl, lambda: nse.fetch_movers(direction, universe)
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"NSE movers unavailable: {exc}") from exc

    ordered = sorted(
        data,
        key=lambda r: r["change"]["percent"],
        reverse=direction == "gainers",
    )
    rows = ordered[:limit]
    # Delivery is only published after the close, so this is the last completed session
    try:
        session = bhavcopy.latest_session()
        deliv = bhavcopy.delivery_map(session) if session else {}
    except Exception:
        session, deliv = None, {}
    rows = [
        {**r, "deliveryPct": deliv.get(r["symbol"]), "deliveryDate": session.isoformat() if session else None}
        for r in rows
    ]
    return envelope(
        rows,
        age,
        source="NSE live analysis",
        delayed_minutes=1,
        note=f"Universe: {nse.MOVER_UNIVERSES[universe][1]}. Rights entitlements excluded.",
    )


@router.get("/global")
def get_global_indices():
    """Overnight global cues."""
    try:
        data, age = CACHE.get_or_fetch(
            "market:global", SETTINGS.index_ttl, yahoo.fetch_global_indices
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Global indices unavailable: {exc}") from exc
    return envelope(data, age, source="Yahoo Finance", delayed_minutes=15)


@router.get("/commodities")
def get_commodities():
    """Metals, energy and agricultural futures with multi-horizon changes."""
    try:
        data, age = CACHE.get_or_fetch("market:commodities", 600, commodities.fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Commodities unavailable: {exc}") from exc
    return envelope(
        data,
        age,
        source="Yahoo Finance (front-month futures)",
        delayed_minutes=15,
        note="US-dollar futures from COMEX, NYMEX, CBOT and ICE, not MCX prices. Rupee equivalents exclude duty, GST and premiums.",
    )


@router.get("/pulse")
def get_pulse(index: str = Query("nifty50", pattern="^(nifty50|nifty100|nifty200|nifty500)$")):
    """
    Every constituent of an index with today's move, plus sector and market breadth.

    Joins NSE's index membership file with its whole-market traded list, so the
    pulse grid on the home page shows all members, not just the top-20 movers.
    """
    try:
        members, _ = CACHE.get_or_fetch(f"constituents:{index}", 86_400, lambda: constituents.fetch_constituents(index))
        traded, age = CACHE.get_or_fetch("market:traded", SETTINGS.movers_ttl, nse.fetch_stocks_traded)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"NSE market breadth unavailable: {exc}") from exc

    stocks = []
    for m in members:
        row = traded["rows"].get(m["symbol"])
        if row:
            stocks.append({"symbol": m["symbol"], "name": m["name"], "industry": m["industry"], **row})
    stocks.sort(key=lambda s: s["marketCapCr"] or 0, reverse=True)

    sectors: dict[str, dict] = {}
    for s in stocks:
        sec = sectors.setdefault(s["industry"], {"industry": s["industry"], "count": 0, "cap": 0.0, "weighted": 0.0})
        cap = s["marketCapCr"] or 0
        sec["count"] += 1
        sec["cap"] += cap
        sec["weighted"] += cap * s["changePct"]
    sector_rows = sorted(
        (
            {"industry": v["industry"], "count": v["count"], "marketCapCr": round(v["cap"]),
             "changePct": round(v["weighted"] / v["cap"], 2) if v["cap"] else 0.0}
            for v in sectors.values()
        ),
        key=lambda r: r["marketCapCr"],
        reverse=True,
    )
    label = constituents.INDEX_FILES[index][0]
    return envelope(
        {
            "index": index,
            "label": label,
            "advances": sum(s["changePct"] > 0 for s in stocks),
            "declines": sum(s["changePct"] < 0 for s in stocks),
            "unchanged": sum(s["changePct"] == 0 for s in stocks),
            "market": traded["breadth"],
            "stocks": stocks,
            "sectors": sector_rows,
            "asOf": traded["asOf"],
        },
        age,
        source="NSE index constituents and whole-market traded list",
        delayed_minutes=1,
        note="Sector moves are weighted by market capitalisation.",
    )


@router.get("/flows")
def get_flows(days: int = Query(90, ge=5, le=730)):
    """
    Foreign and domestic institutional cash flows: NSE's provisional figure by trade date,
    and NSDL's custodial FPI figure, side by side, with the history recorded so far.
    """
    from ..services import flows

    def build():
        # Record the latest day if the scheduler has not yet: the page should never be empty
        # just because the service started after the evening run
        try:
            CACHE.get_or_fetch("market:flows:record", 1800, flows.record)
        except Exception:
            pass
        return flows.summary(days)

    try:
        data, age = CACHE.get_or_fetch(f"market:flows:{days}", 1800, build)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Institutional flows unavailable: {exc}") from exc
    if not data.get("latest"):
        raise HTTPException(status_code=503, detail="No institutional flow data recorded yet")
    return envelope(
        data, age, source="NSE provisional (trade date); NSDL FPI report (custodial, a day later)", delayed_minutes=0,
        note=f"History recorded daily since {data.get('historyStarts')}; NSE publishes only the latest day.",
    )


@router.get("/results-season")
def get_results_season():
    """The current results season across the Nifty 500: who reported, how they did, who is next."""
    from ..services import fundamental_screen, results_season

    def build():
        snapshots = fundamental_screen.load()
        if not snapshots:
            raise ValueError("No company snapshots recorded yet")
        try:
            members, _ = CACHE.get_or_fetch("constituents:nifty500", 86_400, lambda: constituents.fetch_constituents("nifty500"))
            names = {m["symbol"]: m["name"] for m in members}
        except Exception:
            names = {}
        try:
            scheduled = results_season.calendar()
        except Exception:
            scheduled = []
        return results_season.build(snapshots, scheduled, names)

    try:
        data, age = CACHE.get_or_fetch("market:results-season", 900, build)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Results season unavailable: {exc}") from exc
    return envelope(
        data, age, source="Arthdex vetted quarterly results (Nifty 500 snapshots); NSE event calendar", delayed_minutes=0,
        note=f"{data['covered']} of the Nifty 500 snapshotted so far." if data["covered"] < 450 else None,
    )


@router.get("/sector-rotation")
def get_sector_rotation():
    """Relative Rotation Graph (RRG) of 10 major NSE sectors vs Nifty 50."""
    try:
        data = sector_rotation.compute_rrg()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Sector rotation unavailable: {exc}") from exc
    return envelope(
        data,
        900,
        source="Yahoo Finance / NSE daily sectoral histories",
        delayed_minutes=15,
        note="JdK RS-Ratio (trend) vs RS-Momentum (acceleration) centered at 100 with 4-session trails.",
    )


@router.get("/surveillance")
def get_surveillance(
    measure: str = Query("all", description="Filter by measure: all, asm_lt, asm_st, gsm, t2t"),
    band: str = Query("all", description="Filter by circuit band: all, 2, 5, 10, 20"),
    q: str = Query("", description="Symbol or company name search query"),
):
    """SEBI & NSE surveillance lists (ASM Long/Short Term, GSM, T2T) and circuit price bands."""
    try:
        overview = surveillance.get_surveillance_overview()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Surveillance data unavailable: {exc}") from exc

    securities = overview.get("securities", [])

    # Apply measure filter
    if measure != "all":
        m_norm = measure.upper().replace("_", "-")
        securities = [s for s in securities if s["measure"] == m_norm]

    # Apply circuit band filter
    if band != "all":
        try:
            b_val = float(band)
            securities = [s for s in securities if s.get("priceBandPct") == b_val]
        except ValueError:
            pass

    # Apply search filter
    if q.strip():
        query = q.strip().upper()
        securities = [s for s in securities if query in s["symbol"].upper() or query in s.get("name", "").upper()]

    payload = {
        **overview,
        "filteredCount": len(securities),
        "securities": securities,
    }
    return envelope(
        payload,
        3600,
        source="SEBI & NSE Surveillance Archives (ASM, GSM, T2T and Price Bands)",
        delayed_minutes=0,
        note="100% margin applies to ASM-LT and T2T. GSM Stage II-IV carries 50%–200% Buyer Additional Surveillance Deposit.",
    )

