"""
India's government bond curve and the RBI policy corridor, from the RBI's own website.

The RBI publishes, on its home page, the policy rates (repo, SDF, MSF, bank rate, fixed
reverse repo), the reserve ratios (CRR, SLR), the cut-off yields of the 91, 182 and
364-day T-bills, and the traded yields of its benchmark government securities (five
papers, maturing 2029 to 2056), with an "as on" date. That is the whole curve this
desk draws: eight points, each named by its own paper. Tenors the RBI does not publish
are not interpolated into existence.

History comes from this service's own daily snapshots in the point-in-time store, so a
"one week ago" figure exists only once a snapshot from a week ago does. State loans and
corporate bonds have no free published yields, so no spreads over them are shown.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from ..cache import CACHE
from ..store import STORE

RBI_HOME = "https://www.rbi.org.in/"
SERIES = "rbi:rates"

POLICY_FIELDS = {
    "Policy Repo Rate": "repoRate",
    "Standing Deposit Facility Rate": "sdfRate",
    "Marginal Standing Facility Rate": "msfRate",
    "Bank Rate": "bankRate",
    "Fixed Reverse Repo Rate": "reverseRepoRate",
    "CRR": "crrPct",
    "SLR": "slrPct",
}
T_BILLS = {"91 day T-bills": ("91D", 91 / 365), "182 day T-bills": ("182D", 182 / 365), "364 day T-bills": ("364D", 364 / 365)}
GSEC = re.compile(r"^(\d+(?:\.\d+)?)% GS (\d{4})$")
FX = re.compile(r"^INR / (\d+) ([A-Z]{3})\*?$")


def _pct(text: str) -> float | None:
    m = re.search(r"-?\d+(?:\.\d+)?", text or "")
    return float(m.group()) if m else None


def parse_home(html: str) -> dict[str, Any]:
    """The rates block of the RBI home page: policy rates, T-bills and benchmark G-secs."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    policy: dict[str, float] = {}
    points: list[dict[str, Any]] = []
    fx: list[dict[str, Any]] = []
    for tr in soup.select("tr"):
        th, td = tr.find("th"), tr.find("td")
        if not th or not td:
            continue
        label = " ".join(th.get_text(" ").split())
        value = _pct(td.get_text(" "))
        if value is None:
            continue
        if label in POLICY_FIELDS:
            policy[POLICY_FIELDS[label]] = value
        elif label in T_BILLS:
            tenor, years = T_BILLS[label]
            points.append({"tenor": tenor, "paper": label.replace(" T-bills", " T-bill"), "category": "T-Bill", "maturityYear": None, "years": years, "yieldPct": value})
        elif f := FX.match(label):
            # Rupees per `units` of the currency (100 for the yen, 10,000 for the rupiah)
            fx.append({"currency": f.group(2), "units": int(f.group(1)), "rate": value})
        elif m := GSEC.match(label):
            points.append({"tenor": f"GS {m.group(2)}", "paper": label, "category": "G-Sec", "maturityYear": int(m.group(2)), "years": None, "yieldPct": value})

    text = " ".join(soup.get_text(" ").split())
    as_on = re.search(r"as on\s+([A-Z][a-z]+ \d{1,2}, \d{4})\s+Government Securities Market", text)
    gsec_as_on = None
    if as_on:
        try:
            gsec_as_on = datetime.strptime(as_on.group(1), "%B %d, %Y").date().isoformat()
        except ValueError:
            gsec_as_on = None
    if not policy.get("repoRate") or not any(p["category"] == "G-Sec" for p in points):
        raise ValueError("The RBI home page did not carry the expected rates block")
    return {"policy": policy, "points": points, "gsecAsOn": gsec_as_on, "fx": fx}


def fetch_rates() -> dict[str, Any]:
    from curl_cffi import requests as curl_requests

    res = curl_requests.get(RBI_HOME, impersonate="chrome", timeout=30)
    res.raise_for_status()
    return parse_home(res.text)


def _record(data: dict[str, Any]) -> None:
    try:
        STORE.put(SERIES, data.get("gsecAsOn") or date.today().isoformat(), data, source=RBI_HOME)
    except Exception:
        pass  # history is a bonus; the curve still answers without it


def _yield_on(history: list[dict[str, Any]], tenor: str, on_or_before: str) -> tuple[str, float] | None:
    """The latest stored yield for a tenor on or before a date, from this service's own snapshots."""
    for row in reversed(history):
        if row["asOf"] <= on_or_before:
            for p in row["value"].get("points") or []:
                if p["tenor"] == tenor:
                    return row["asOf"], p["yieldPct"]
            return None
    return None


def build_curve(data: dict[str, Any], history: list[dict[str, Any]]) -> dict[str, Any]:
    as_of = data.get("gsecAsOn") or date.today().isoformat()
    year = date.fromisoformat(as_of).year

    tenors = []
    for p in data["points"]:
        # A G-sec's remaining life to its maturity year; the RBI line gives the year, not the day
        years = p["years"] if p["category"] == "T-Bill" else max(p["maturityYear"] - year, 0.5)
        changes: dict[str, Any] = {}
        for key, days in (("1w", 7), ("1m", 30), ("1y", 365)):
            then = _yield_on(history, p["tenor"], (date.fromisoformat(as_of) - timedelta(days=days)).isoformat())
            changes[key] = {"asOf": then[0], "yieldPct": then[1], "changeBps": round((p["yieldPct"] - then[1]) * 100, 1)} if then else None
        tenors.append({**p, "years": round(years, 2), "history": changes})
    tenors.sort(key=lambda t: t["years"])

    gsecs = [t for t in tenors if t["category"] == "G-Sec"]
    ten = min(gsecs, key=lambda t: abs(t["years"] - 10)) if gsecs else None
    bill = next((t for t in tenors if t["tenor"] == "91D"), None)
    spreads = []
    for a, b in ((ten, gsecs[0] if gsecs else None), (gsecs[-1] if gsecs else None, ten), (ten, bill)):
        if a and b and a is not b:
            spreads.append({"long": a["paper"], "short": b["paper"], "bps": round((a["yieldPct"] - b["yieldPct"]) * 100, 1)})
    policy = data["policy"]
    if ten and policy.get("repoRate") is not None:
        spreads.append({"long": ten["paper"], "short": "Policy repo rate", "bps": round((ten["yieldPct"] - policy["repoRate"]) * 100, 1)})

    return {
        "asOf": as_of,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "tenors": tenors,
        "benchmark": ten,
        "spreads": spreads,
        "rbiCorridor": policy,
        "historyDays": len(history),
        "source": RBI_HOME,
    }


def get_sovereign_yield_curve() -> dict[str, Any]:
    def build() -> dict[str, Any]:
        data = fetch_rates()
        _record(data)
        as_of = data.get("gsecAsOn") or date.today().isoformat()
        try:
            history = STORE.history(SERIES, since=(date.fromisoformat(as_of) - timedelta(days=400)).isoformat())
        except Exception:
            history = []
        return build_curve(data, history)

    data, _ = CACHE.get_or_fetch("market:fixed-income:yield-curve", 3600, build)
    return data
