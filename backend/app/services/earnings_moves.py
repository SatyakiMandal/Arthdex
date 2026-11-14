"""Implied move before results: combining the earnings calendar with ATM option straddles.

Retail traders and options desks price binary events (like quarterly earnings)
by reading the at-the-money (ATM) straddle:
    Implied Move % = (Price(ATM CE) + Price(ATM PE)) / Spot * 100

Comparing the implied move with historical 1-day post-earnings moves shows whether
the options market is overpricing volatility (favouring straddle sellers) or
underpricing it (favouring straddle buyers).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from ..cache import CACHE
from ..providers import nse_options
from ..services import options, results_season


def get_earnings_implied_moves() -> list[dict[str, Any]]:
    """Retrieve upcoming results meetings and match them with ATM straddle implied moves."""

    def _build():
        today_ist = datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat()
        scheduled = results_season.calendar()
        if not scheduled:
            return []

        # Filter for upcoming results in the next 30 days
        upcoming = [
            s for s in scheduled
            if s.get("date") and s["date"] >= today_ist and s.get("symbol")
        ]
        upcoming.sort(key=lambda s: s["date"])

        results: list[dict[str, Any]] = []
        for item in upcoming[:20]:
            sym = item["symbol"].strip().upper()
            try:
                expiries = nse_options.expiries(sym)
                valid_expiries = [e for e in expiries if e >= today_ist]
                if not valid_expiries:
                    continue

                # Nearest expiry covering the earnings date
                target_expiry = next((e for e in valid_expiries if e >= item["date"]), valid_expiries[0])
                chain_raw = nse_options.chain(sym, target_expiry)
                if not chain_raw or not chain_raw.get("rows") or not chain_raw.get("underlying"):
                    continue

                spot = float(chain_raw["underlying"])
                rows = chain_raw["rows"]
                atm = min(rows, key=lambda r: abs(r["strike"] - spot))
                c_mid = options._price(atm.get("ce")) or 0.0
                p_mid = options._price(atm.get("pe")) or 0.0
                straddle = c_mid + p_mid

                if straddle > 0 and spot > 0:
                    implied_pct = round((straddle / spot) * 100.0, 2)
                    # A label for the size of the implied move itself. There is no comparison
                    # with past post-result moves: those are not computed yet.
                    verdict = (
                        "High Volatility Priced" if implied_pct > 6.0
                        else "Low Volatility Priced" if implied_pct < 3.0
                        else "Normal Volatility Priced"
                    )
                    results.append({
                        "symbol": sym,
                        "companyName": item.get("company") or sym,
                        "resultDate": item["date"],
                        "status": "upcoming",
                        "spotPrice": spot,
                        "atmStrike": atm["strike"],
                        "straddleAtmPrice": round(straddle, 2),
                        "impliedMovePct": implied_pct,
                        "pricingVerdict": verdict,
                        "callIv": (atm.get("ce") or {}).get("iv"),
                        "putIv": (atm.get("pe") or {}).get("iv"),
                        "nearestExpiry": target_expiry,
                        "asOf": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(timespec="seconds"),
                    })
            except Exception:
                continue

        return results

    data, _ = CACHE.get_or_fetch("derivatives:earnings_moves:v2", 600, _build)
    return data
