"""
The rupee against major currencies: the RBI's reference rates.

The RBI publishes a daily reference rate for the US dollar, pound, euro, yen (per 100),
dirham, rupiah (per 10,000) and rouble on its home page. Those are the rates shown here.
Day-on-day changes come from this service's own earlier snapshots of the same rates.

India's macro indicators (CPI, GDP, IIP, GST, the current account) and forward premia
or REER indices have no feed Arthdex reads yet, so they are not served; see the macro
router.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from ..cache import CACHE
from ..store import STORE
from . import fixed_income

SERIES = "rbi:fx"


def get_forex_monitor() -> dict[str, Any]:
    def build() -> dict[str, Any]:
        data = fixed_income.fetch_rates()
        rates = data.get("fx") or []
        if not rates:
            raise ValueError("The RBI home page carried no reference rates")
        today = date.today().isoformat()
        try:
            history = STORE.history(SERIES, limit=60)
        except Exception:
            history = []
        previous = next((h for h in reversed(history) if h["asOf"] < today), None)
        before = {r["currency"]: r["rate"] for r in (previous or {}).get("value", {}).get("rates", [])}
        pairs = []
        for r in rates:
            prev = before.get(r["currency"])
            pairs.append({
                **r,
                "pair": f"{r['currency']}/INR" + (f" (per {r['units']:,})" if r["units"] != 1 else ""),
                "previous": {"asOf": previous["asOf"], "rate": prev, "change": round(r["rate"] - prev, 4), "changePct": round((r["rate"] / prev - 1) * 100, 3)} if prev else None,
            })
        try:
            STORE.put(SERIES, today, {"rates": rates}, source=fixed_income.RBI_HOME)
        except Exception:
            pass
        return {
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "baseCurrency": "INR",
            "pairs": pairs,
            "source": fixed_income.RBI_HOME,
        }

    data, _ = CACHE.get_or_fetch("macro:forex:inr", 3600, build)
    return data
