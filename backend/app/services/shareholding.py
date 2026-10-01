"""Shareholder analysis for a listed company.

Sources, each independent so one failing does not blank the page:
  * screener.in: promoter / FII / DII / government / public holding by quarter and by
    year, and the number of shareholders.
  * NSE: promoter pledge, SEBI Regulation 29 disclosures (acquirers and sellers above
    the 5% threshold) and insider-trading (PIT) disclosures by directors and other
    designated persons.
  * Yahoo Finance: insider and institutional share of the float.

Everything derived here (signals, streaks, net insider flow) is computed from those
filings; nothing is estimated.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Any

import requests
from bs4 import BeautifulSoup

from ..providers.nse import nse_get

log = logging.getLogger("arthdex.shareholding")

SCREENER = "https://www.screener.in/company/{symbol}/{kind}/"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

CATEGORIES = [("promoters", "Promoters"), ("fiis", "FIIs"), ("diis", "DIIs"), ("government", "Government"), ("public", "Public")]
# A category moving less than this between two filings is noise, not a decision
SIGNAL_THRESHOLD_PP = 0.25


def _pct(text: str) -> float | None:
    m = re.search(r"-?\d+(?:\.\d+)?", (text or "").replace(",", ""))
    return float(m.group()) if m else None


def _int(text: str) -> int | None:
    digits = re.sub(r"[^\d]", "", text or "")
    return int(digits) if digits else None


def _parse_table(table: Any) -> dict[str, Any]:
    rows = [[c.get_text(" ", strip=True) for c in r.select("th,td")] for r in table.select("tr")]
    if not rows:
        return {}
    labels = rows[0][1:]
    out: dict[str, Any] = {"labels": labels}
    for r in rows[1:]:
        name = re.sub(r"\s*\+\s*$", "", r[0]).strip().lower()
        vals = r[1:]
        if name.startswith("promoter"):
            out["promoters"] = [_pct(v) for v in vals]
        elif name.startswith("fii"):
            out["fiis"] = [_pct(v) for v in vals]
        elif name.startswith("dii"):
            out["diis"] = [_pct(v) for v in vals]
        elif name.startswith("government"):
            out["government"] = [_pct(v) for v in vals]
        elif name.startswith("public"):
            out["public"] = [_pct(v) for v in vals]
        elif "shareholders" in name:
            out["shareholders"] = [_int(v) for v in vals]
    return out


def _screener(symbol: str) -> dict[str, Any] | None:
    for kind in ("consolidated", ""):
        url = SCREENER.format(symbol=symbol, kind=kind).replace("//", "/").replace("https:/", "https://")
        res = requests.get(url, headers=UA, timeout=30)
        if res.status_code != 200:
            continue
        soup = BeautifulSoup(res.text, "lxml")
        sec = soup.select_one("#shareholding")
        if sec is None:
            continue
        tables = sec.select("table")
        if not tables:
            continue
        quarterly = _parse_table(tables[0])
        yearly = _parse_table(tables[1]) if len(tables) > 1 else {}
        if any(quarterly.get(k) for k in ("promoters", "fiis", "diis", "public")):
            return {"quarterly": quarterly, "yearly": yearly, "url": url}
    return None


def _nse_pledge(symbol: str) -> dict[str, Any] | None:
    data = nse_get(f"/api/corporate-pledgedata?index=equities&symbol={symbol}").get("data") or []
    if not data:
        return None
    r = data[0]
    return {
        "asOf": r.get("shp"),
        "pledgedPct": _pct(r.get("percSharesPledged")),
        "promoterPct": _pct(r.get("percPromoterHolding")),
        "sharesPledged": _int(r.get("numSharesPledged")),
        "totalShares": _int(r.get("totIssuedShares")),
    }


def _date(s: str | None) -> datetime | None:
    if not s:
        return None
    for fmt in ("%d-%b-%Y %H:%M", "%d-%b-%Y", "%d-%b-%Y, %H-%M"):
        try:
            return datetime.strptime(s.strip().title(), fmt)
        except ValueError:
            continue
    return None


def _nse_sast(symbol: str) -> list[dict[str, Any]]:
    rows = nse_get(f"/api/corporate-sast-reg29?index=equities&symbol={symbol}").get("data") or []
    out = []
    for r in rows:
        acq = (r.get("acqSaleType") or "").lower().startswith("acq")
        out.append(
            {
                "name": r.get("acquirerName"),
                "action": "Acquired" if acq else "Sold",
                "period": r.get("acquirerDate"),
                "shares": _int(r.get("noOfShareAcq") if acq else r.get("noOfShareSale")),
                "pctChange": _pct(r.get("totAcqShare") if acq else r.get("totSaleShare")),
                "sharesAfter": _int(r.get("noOfShareAft")),
                "pctAfter": _pct(r.get("totAftShare")),
                "promoterGroup": (r.get("promoterType") or "").upper() == "P",
                "mode": r.get("acquisitionMode"),
                "regulation": r.get("regType"),
                "filedOn": r.get("timestamp"),
                "_ts": _date(r.get("timestamp")),
            }
        )
    out.sort(key=lambda x: x["_ts"] or datetime.min, reverse=True)
    for r in out:
        r.pop("_ts")
    return out[:15]


def _nse_insiders(symbol: str) -> list[dict[str, Any]]:
    rows = nse_get(f"/api/corporates-pit?index=equities&symbol={symbol}").get("data") or []
    out = []
    for r in rows:
        kind = (r.get("tdpTransactionType") or "").strip()
        if kind not in ("Buy", "Sell", "Pledge", "Revoke", "Invoke"):
            kind = kind or (r.get("acqMode") or "")
        out.append(
            {
                "name": r.get("acqName"),
                "category": r.get("personCategory"),
                "action": kind,
                "mode": r.get("acqMode"),
                "securities": _int(r.get("secAcq")),
                "valueInr": _int(r.get("secVal")),
                "afterPct": _pct(r.get("afterAcqSharesPer")),
                "tradedOn": r.get("acqtoDt") or r.get("acqfromDt"),
                "filedOn": r.get("intimDt"),
                "_ts": _date(r.get("acqtoDt") or r.get("intimDt")),
            }
        )
    out.sort(key=lambda x: x["_ts"] or datetime.min, reverse=True)
    for r in out:
        r["_ts"] = r["_ts"].isoformat() if r["_ts"] else None
    return out[:25]


def _yahoo(symbol: str) -> dict[str, Any] | None:
    import yfinance as yf

    mh = yf.Ticker(f"{symbol}.NS").major_holders
    if mh is None or mh.empty:
        return None
    v = {str(k): float(x) for k, x in zip(mh.index, mh.iloc[:, 0]) if x == x}
    return {
        "insidersPct": round(v["insidersPercentHeld"] * 100, 2) if "insidersPercentHeld" in v else None,
        "institutionsPct": round(v["institutionsPercentHeld"] * 100, 2) if "institutionsPercentHeld" in v else None,
        "institutionsOfFloatPct": round(v["institutionsFloatPercentHeld"] * 100, 2) if "institutionsFloatPercentHeld" in v else None,
    }


def _signal(delta: float | None) -> str:
    if delta is None:
        return "unknown"
    return "increasing" if delta > SIGNAL_THRESHOLD_PP else "decreasing" if delta < -SIGNAL_THRESHOLD_PP else "stable"


def analytics(pattern: dict[str, Any], pledge: dict[str, Any] | None, insiders: list[dict[str, Any]]) -> dict[str, Any]:
    q = pattern.get("quarterly") or {}
    labels = q.get("labels") or []
    out: dict[str, Any] = {"asOf": labels[-1] if labels else None, "categories": [], "notes": []}

    def at(series: list[float | None] | None, back: int) -> float | None:
        if not series or len(series) <= back:
            return None
        return series[-1 - back]

    for key, title in CATEGORIES:
        s = q.get(key) or []
        if not s:
            continue
        now = at(s, 0)
        qoq = None if at(s, 1) is None or now is None else round(now - at(s, 1), 2)
        yoy = None if at(s, 4) is None or now is None else round(now - at(s, 4), 2)
        # how many consecutive quarters the holding has moved the same way
        streak, direction = 0, 0
        for i in range(len(s) - 1, 0, -1):
            if s[i] is None or s[i - 1] is None:
                break
            d = s[i] - s[i - 1]
            step = 1 if d > 0.05 else -1 if d < -0.05 else 0
            if step == 0 or (direction and step != direction):
                break
            direction = step
            streak += 1
        out["categories"].append(
            {
                "key": key,
                "label": title,
                "latest": now,
                "qoq": qoq,
                "yoy": yoy,
                "signal": _signal(qoq if qoq is not None else yoy),
                "yoySignal": _signal(yoy),
                "streak": streak * direction,
                "high": max((v for v in s if v is not None), default=None),
                "low": min((v for v in s if v is not None), default=None),
            }
        )

    by = {c["key"]: c for c in out["categories"]}
    inst_now = sum((by[k]["latest"] or 0) for k in ("fiis", "diis") if k in by)
    inst_yoy = sum((by[k]["yoy"] or 0) for k in ("fiis", "diis") if k in by and by[k]["yoy"] is not None)
    out["institutionalPct"] = round(inst_now, 2)
    out["institutionalYoy"] = round(inst_yoy, 2)
    out["freeFloatPct"] = round((by.get("public", {}).get("latest") or 0) + inst_now + (by.get("government", {}).get("latest") or 0), 2)

    sh = q.get("shareholders") or []
    if len(sh) >= 5 and sh[-1] and sh[-5]:
        out["shareholderCount"] = {"latest": sh[-1], "yoyPct": round((sh[-1] / sh[-5] - 1) * 100, 1)}
    elif sh and sh[-1]:
        out["shareholderCount"] = {"latest": sh[-1], "yoyPct": None}

    if pledge and pledge.get("pledgedPct") is not None:
        p = pledge["pledgedPct"]
        out["pledgeTier"] = "None" if p == 0 else "Low" if p < 5 else "Moderate" if p < 20 else "High"

    # Net insider flow over the disclosures returned (Buy vs Sell, by value)
    cutoff = (datetime.now().replace(microsecond=0) - timedelta(days=365)).isoformat()
    recent = [r for r in insiders if r.get("_ts") and r["_ts"] >= cutoff]
    buys = sum(r["valueInr"] or 0 for r in recent if r["action"] == "Buy")
    sells = sum(r["valueInr"] or 0 for r in recent if r["action"] == "Sell")
    if buys or sells:
        out["insiderFlow"] = {"buyValueInr": buys, "sellValueInr": sells, "net": "Net buying" if buys > sells else "Net selling" if sells > buys else "Balanced", "count": len(recent), "window": "12 months"}

    p = by.get("promoters")
    if p and p["yoy"] is not None:
        if p["yoy"] <= -1:
            out["notes"].append(f"Promoter holding fell {abs(p['yoy']):.2f} points over the year.")
        elif p["yoy"] >= 1:
            out["notes"].append(f"Promoter holding rose {p['yoy']:.2f} points over the year.")
    return out


def fetch(symbol: str) -> dict[str, Any]:
    sym = symbol.upper()
    notes: list[str] = []

    def guard(name: str, fn, default=None):
        try:
            return fn()
        except Exception as exc:
            log.warning("shareholding %s failed for %s: %s", name, sym, exc)
            notes.append(f"{name} unavailable")
            return default

    pattern = guard("screener.in shareholding pattern", lambda: _screener(sym))
    pledge = guard("NSE promoter pledge", lambda: _nse_pledge(sym))
    sast = guard("NSE large-holder (SAST) disclosures", lambda: _nse_sast(sym), [])
    insiders = guard("NSE insider-trading disclosures", lambda: _nse_insiders(sym), [])
    yahoo = guard("Yahoo holder summary", lambda: _yahoo(sym))

    if not pattern and not (pledge or sast or insiders or yahoo):
        raise ValueError(f"No shareholding data could be retrieved for {sym}.")

    return {
        "symbol": sym,
        "pattern": pattern,
        "pledge": pledge,
        "largeHolders": sast,
        "insiders": insiders,
        "yahoo": yahoo,
        "analytics": analytics(pattern, pledge, insiders) if pattern else None,
        "notes": notes,
    }
