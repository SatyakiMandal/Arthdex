"""NSE security-wise Bhavcopy with delivery positions.

One public CSV per trading day (nsearchives.nseindia.com) carries OHLC, traded
quantity, turnover and delivered quantity for every security. Files never change
once published, so they are cached for the life of the process.
"""

from __future__ import annotations

import io
from datetime import date, timedelta
from typing import Any

import pandas as pd
import requests

from ..cache import CACHE
from .insights import bhav_insights

URL = "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{d}.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
SERIES = {"EQ", "BE"}

# Screens only rank names with real money behind them; otherwise the lists fill
# with illiquid counters where 100% delivery on a few lots means nothing.
MIN_TURNOVER_CR = 5.0
ACCUMULATION_DELIVERY_PCT = 68.0
ANOMALY_VOLUME_MULTIPLE = 2.0


def _fetch(d: date) -> pd.DataFrame | None:
    res = requests.get(URL.format(d=d.strftime("%d%m%Y")), headers=HEADERS, timeout=25)
    if res.status_code == 404:
        return None
    res.raise_for_status()
    df = pd.read_csv(io.StringIO(res.text), skipinitialspace=True)
    df.columns = [c.strip() for c in df.columns]
    df["SERIES"] = df["SERIES"].astype(str).str.strip()
    df = df[df["SERIES"].isin(SERIES)].copy()
    df["SYMBOL"] = df["SYMBOL"].astype(str).str.strip()
    for c in ("PREV_CLOSE", "CLOSE_PRICE", "TTL_TRD_QNTY", "TURNOVER_LACS", "HIGH_PRICE", "LOW_PRICE", "DELIV_QTY", "DELIV_PER"):
        df[c] = pd.to_numeric(df[c], errors="coerce")  # '-' appears for rows with no delivery data
    df["CHG_PCT"] = (df["CLOSE_PRICE"] / df["PREV_CLOSE"] - 1.0) * 100.0
    df["TURNOVER_CR"] = df["TURNOVER_LACS"] / 100.0
    return df


def load_day(d: date) -> pd.DataFrame | None:
    """None means NSE has no file for that date (weekend or holiday)."""
    key = f"bhav:{d.isoformat()}"
    hit = CACHE.get_entry(key)
    if hit is not None:
        return hit.value
    df = _fetch(d)
    if df is not None:  # never cache a miss: today's file appears after the close
        CACHE.set(key, df)
    return df


def latest_session(on_or_before: date | None = None, max_back: int = 10) -> date | None:
    d = on_or_before or date.today()
    for _ in range(max_back):
        if d.weekday() < 5 and load_day(d) is not None:
            return d
        d -= timedelta(days=1)
    return None


def previous_sessions(d: date, n: int) -> list[tuple[date, pd.DataFrame]]:
    out: list[tuple[date, pd.DataFrame]] = []
    cur = d - timedelta(days=1)
    for _ in range(n * 3 + 4):
        if len(out) == n:
            break
        if cur.weekday() < 5:
            df = load_day(cur)
            if df is not None:
                out.append((cur, df))
        cur -= timedelta(days=1)
    return out


def delivery_map(d: date) -> dict[str, float]:
    df = load_day(d)
    if df is None:
        return {}
    ok = df.dropna(subset=["DELIV_PER"])
    return dict(zip(ok["SYMBOL"], ok["DELIV_PER"].astype(float)))


def _f(v: Any, nd: int = 2) -> float | None:
    return None if pd.isna(v) else round(float(v), nd)


def _row(r: pd.Series, **extra: Any) -> dict[str, Any]:
    return {
        "symbol": r["SYMBOL"],
        "close": _f(r["CLOSE_PRICE"]),
        "changePct": _f(r["CHG_PCT"]),
        "turnoverCr": _f(r["TURNOVER_CR"]),
        "volume": int(r["TTL_TRD_QNTY"]) if pd.notna(r["TTL_TRD_QNTY"]) else None,
        "deliveryPct": _f(r["DELIV_PER"], 1),
        **extra,
    }


def analyse(d: date) -> dict[str, Any] | None:
    df = load_day(d)
    if df is None:
        return None
    df = df.dropna(subset=["CLOSE_PRICE", "PREV_CLOSE"])
    adv = int((df["CHG_PCT"] > 0).sum())
    dec = int((df["CHG_PCT"] < 0).sum())
    unch = int(len(df) - adv - dec)
    turnover_cr = float(df["TURNOVER_CR"].sum())
    with_deliv = df.dropna(subset=["DELIV_QTY"])
    traded_qty = float(with_deliv["TTL_TRD_QNTY"].sum())
    weighted = float(with_deliv["DELIV_QTY"].sum() / traded_qty * 100) if traded_qty else None
    simple = float(df["DELIV_PER"].mean()) if df["DELIV_PER"].notna().any() else None

    liquid = df[df["TURNOVER_CR"] >= MIN_TURNOVER_CR]
    accumulation = liquid[liquid["DELIV_PER"] > ACCUMULATION_DELIVERY_PCT].sort_values("TURNOVER_CR", ascending=False)

    prior = previous_sessions(d, 5)
    anomalies: list[dict[str, Any]] = []
    if len(prior) >= 3:
        avg = pd.concat([p[1].set_index("SYMBOL")["TTL_TRD_QNTY"] for p in prior], axis=1).mean(axis=1)
        work = liquid.copy()
        work["AVG5"] = work["SYMBOL"].map(avg)
        work = work[work["AVG5"] > 0]
        work["MULT"] = work["TTL_TRD_QNTY"] / work["AVG5"]
        hits = work[work["MULT"] > ANOMALY_VOLUME_MULTIPLE].sort_values("MULT", ascending=False).head(25)
        anomalies = [_row(r, volumeMultiple=round(float(r["MULT"]), 2)) for _, r in hits.iterrows()]

    bands: dict[str, list[dict[str, Any]]] = {"upper": [], "lower": []}
    # A circuit is a move of exactly the band that also closed on the day's extreme; a
    # 5% move that faded from a higher high is ordinary volatility, not a circuit.
    for limit in (20, 10, 5):
        near = df[((df["CHG_PCT"].abs() - limit).abs() <= 0.05) & (df["TURNOVER_CR"] > 0)]
        for _, r in near.iterrows():
            up = r["CHG_PCT"] > 0
            if (up and r["CLOSE_PRICE"] >= r["HIGH_PRICE"]) or (not up and r["CLOSE_PRICE"] <= r["LOW_PRICE"]):
                bands["upper" if up else "lower"].append(_row(r, band=limit))
    for side in bands:
        bands[side].sort(key=lambda x: x["turnoverCr"] or 0, reverse=True)
        bands[side] = bands[side][:40]

    lead = df.sort_values("TURNOVER_CR", ascending=False).iloc[0]["SYMBOL"] if len(df) else None
    ratio = adv / dec if dec else None
    tone = "broad-based strength" if ratio and ratio > 1.5 else "broad-based weakness" if ratio and ratio < 0.67 else "a mixed tape"
    narrative = f"{adv:,} securities advanced against {dec:,} that declined"
    narrative += f" ({ratio:.2f}x), {tone}." if ratio else "."
    narrative += f" Turnover was ₹{turnover_cr:,.0f} Cr" + (f", led by {lead}." if lead else ".")
    if weighted is not None:
        narrative += (
            f" {weighted:.1f}% of traded quantity was taken into delivery, and {len(accumulation)} liquid names"
            f" cleared {ACCUMULATION_DELIVERY_PCT:.0f}%."
        )

    return {
        "date": d.isoformat(),
        "kpis": {
            "securities": int(len(df)),
            "advances": adv,
            "declines": dec,
            "unchanged": unch,
            "advanceDeclineRatio": round(ratio, 2) if ratio else None,
            "turnoverCr": round(turnover_cr, 0),
            "weightedDeliveryPct": round(weighted, 1) if weighted is not None else None,
            "averageDeliveryPct": round(simple, 1) if simple is not None else None,
        },
        "narrative": narrative,
        "accumulation": [_row(r) for _, r in accumulation.head(25).iterrows()],
        "volumeAnomalies": anomalies,
        "bandMoves": bands,
        "insights": bhav_insights(df, prior, MIN_TURNOVER_CR, anomalies, bands),
        "criteria": {
            "minTurnoverCr": MIN_TURNOVER_CR,
            "accumulationDeliveryPct": ACCUMULATION_DELIVERY_PCT,
            "anomalyVolumeMultiple": ANOMALY_VOLUME_MULTIPLE,
            "baselineSessions": len(prior),
        },
    }
