"""A track record of the platform's own calls.

A call is a snapshot taken on request: the indicator tally on daily bars (its bullish minus bearish share) plus
the risk score, with the price and the Nifty level at that moment. Calls are scored later against what the stock
and Nifty actually did over the next 1, 5 and 20 trading days. The snapshot is built server-side from the symbol,
so a record cannot carry a made-up price.

Stored in SQLite under backend/app_data. One call per symbol per day, and the log is capped.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from . import risk_layer, technicals
from .technicals import _f

DB_PATH = Path(__file__).resolve().parents[2] / "app_data" / "decisions.db"
HORIZONS = (1, 5, 20)
MAX_ROWS = 500
IST = timezone(timedelta(hours=5, minutes=30))
NIFTY = "^NSEI"

BULL_AT = 0.25  # net share of bullish over bearish indicators needed to call it


@contextmanager
def _conn():
    """Open, commit on success, and always close, so the file is never left locked."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        _init(con)
        with con:
            yield con
    finally:
        con.close()


def _init(con: sqlite3.Connection) -> None:
    con.execute(
        """CREATE TABLE IF NOT EXISTS decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            created_at TEXT NOT NULL,
            day TEXT NOT NULL,
            as_of TEXT NOT NULL,
            price REAL NOT NULL,
            nifty REAL,
            call TEXT NOT NULL,
            net REAL NOT NULL,
            bullish INTEGER NOT NULL,
            bearish INTEGER NOT NULL,
            neutral INTEGER NOT NULL,
            risk_score REAL,
            risk_tier TEXT,
            UNIQUE(symbol, day)
        )"""
    )


def _daily(symbol: str) -> pd.DataFrame:
    import yfinance as yf

    frame = yf.Ticker(symbol).history(period="2y", interval="1d", auto_adjust=False)
    return technicals.clean_frame(frame)


def snapshot(symbol: str) -> dict[str, Any]:
    df = technicals.fetch_bars(symbol, "1d")
    t = technicals.build(symbol, "1d", df)
    tally = t["tally"]
    total = max(tally["bullish"] + tally["bearish"] + tally["neutral"], 1)
    net = (tally["bullish"] - tally["bearish"]) / total
    call = "Bullish" if net >= BULL_AT else "Bearish" if net <= -BULL_AT else "Neutral"
    risk = risk_layer.assess(symbol, df)
    nifty = _daily(NIFTY)
    return {
        "symbol": symbol,
        "asOf": t["asOf"],
        "price": t["lastClose"],
        "nifty": _f(nifty["Close"].iloc[-1]) if len(nifty) else None,
        "call": call,
        "net": round(net, 3),
        "bullish": tally["bullish"],
        "bearish": tally["bearish"],
        "neutral": tally["neutral"],
        "riskScore": risk["score"],
        "riskTier": risk["tier"],
    }


def add(symbol: str) -> dict[str, Any]:
    snap = snapshot(symbol)
    now = datetime.now(timezone.utc)
    day = now.astimezone(IST).strftime("%Y-%m-%d")
    with _conn() as con:
        count = con.execute("SELECT COUNT(*) FROM decisions").fetchone()[0]
        if count >= MAX_ROWS:
            raise OverflowError(f"The log holds {MAX_ROWS} calls, its limit. Delete some first.")
        try:
            cur = con.execute(
                """INSERT INTO decisions (symbol, created_at, day, as_of, price, nifty, call, net, bullish, bearish, neutral, risk_score, risk_tier)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (snap["symbol"], now.isoformat(timespec="seconds"), day, snap["asOf"], snap["price"], snap["nifty"], snap["call"], snap["net"],
                 snap["bullish"], snap["bearish"], snap["neutral"], snap["riskScore"], snap["riskTier"]),
            )
        except sqlite3.IntegrityError as exc:
            raise FileExistsError(f"{symbol} already has a logged call for {day}.") from exc
        return {"id": cur.lastrowid, **snap}


def remove(decision_id: int) -> bool:
    with _conn() as con:
        return con.execute("DELETE FROM decisions WHERE id = ?", (decision_id,)).rowcount > 0


def _forward(df: pd.DataFrame, as_of: str, base: float | None) -> dict[int, float | None]:
    """Return over the h-th trading day after `as_of`, or None if that day has not happened yet."""
    out: dict[int, float | None] = {h: None for h in HORIZONS}
    if base is None or base <= 0 or df.empty:
        return out
    after = df[df.index.strftime("%Y-%m-%d") > as_of]["Close"]
    for h in HORIZONS:
        if len(after) >= h:
            out[h] = (float(after.iloc[h - 1]) / base - 1.0) * 100.0
    return out


def listing() -> dict[str, Any]:
    with _conn() as con:
        rows = [dict(r) for r in con.execute("SELECT * FROM decisions ORDER BY id DESC").fetchall()]
    cache: dict[str, pd.DataFrame] = {}

    def frame(sym: str) -> pd.DataFrame:
        if sym not in cache:
            try:
                cache[sym] = _daily(sym if sym == NIFTY else f"{sym}.NS")
            except Exception:
                cache[sym] = pd.DataFrame()
        return cache[sym]

    items = []
    for r in rows:
        stock = _forward(frame(r["symbol"]), r["as_of"], r["price"])
        idx = _forward(frame(NIFTY), r["as_of"], r["nifty"])
        sign = 1.0 if r["call"] == "Bullish" else -1.0 if r["call"] == "Bearish" else 0.0
        scored = {}
        for h in HORIZONS:
            s, n = stock[h], idx[h]
            scored[str(h)] = (
                None
                if s is None
                else {
                    "returnPct": _f(s, 2),
                    "niftyPct": _f(n, 2) if n is not None else None,
                    "excessPct": _f(s - n, 2) if n is not None else None,
                    "hit": (s * sign > 0) if sign else None,
                    "adjExcessPct": _f((s - n) * sign, 2) if (n is not None and sign) else None,
                }
            )
        items.append(
            {
                "id": r["id"],
                "symbol": r["symbol"],
                "createdAt": r["created_at"],
                "asOf": r["as_of"],
                "price": _f(r["price"]),
                "call": r["call"],
                "net": r["net"],
                "bullish": r["bullish"],
                "bearish": r["bearish"],
                "neutral": r["neutral"],
                "riskScore": r["risk_score"],
                "riskTier": r["risk_tier"],
                "results": scored,
            }
        )

    summary = {}
    for h in HORIZONS:
        done = [i["results"][str(h)] for i in items if i["call"] != "Neutral" and i["results"][str(h)] is not None]
        hits = [d["hit"] for d in done if d["hit"] is not None]
        excess = [d["adjExcessPct"] for d in done if d["adjExcessPct"] is not None]
        summary[str(h)] = {
            "scored": len(done),
            "hitRatePct": _f(100.0 * sum(hits) / len(hits), 0) if hits else None,
            "avgExcessPct": _f(sum(excess) / len(excess), 2) if excess else None,
        }
    return {
        "items": items,
        "summary": summary,
        "horizons": list(HORIZONS),
        "note": (
            "A call is Bullish or Bearish when the indicator tally leans at least 25% one way, else Neutral (not scored). "
            "A call hits when the stock moves the called way over the horizon; excess is against Nifty 50, sign-adjusted so "
            "positive always means the call beat the index. Small samples say little: treat anything under about 30 scored "
            "calls as anecdote."
        ),
    }
