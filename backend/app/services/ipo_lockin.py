"""IPO lock-in expiry tracker and supply impact forecaster.

Tracks SEBI mandated lock-in schedules for recently listed Indian IPOs:
- 30-day Anchor lock-in (50% of anchor allocation).
- 90-day Anchor lock-in (remaining 50% of anchor allocation).
- 180-day (6-month) & 365-day (1-year) Pre-IPO and Promoter lock-ins.
- Calculates the Supply Impact Ratio (Unlocking Shares / 30D Average Daily Volume)
  to flag potential post-unlock sell-off pressure.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import yahoo
from ..services import ipo as ipo_service, quote_sources


# Curated verified anchor and pre-IPO lockin dataset for recent major listings
KNOWN_LOCKIN_SCHEDULES: list[dict[str, Any]] = [
    {
        "symbol": "SWIGGY",
        "name": "Swiggy Ltd.",
        "listingDate": "2024-11-13",
        "anchorSharesTotal": 130200000,
        "preIpoSharesTotal": 1250000000,
        "avgDailyVolume": 18500000,
    },
    {
        "symbol": "HYUNDAI",
        "name": "Hyundai Motor India Ltd.",
        "listingDate": "2024-10-22",
        "anchorSharesTotal": 42424240,
        "preIpoSharesTotal": 670000000,
        "avgDailyVolume": 4200000,
    },
    {
        "symbol": "WAARIEE",
        "name": "Waaree Energies Ltd.",
        "listingDate": "2024-10-28",
        "anchorSharesTotal": 7250000,
        "preIpoSharesTotal": 185000000,
        "avgDailyVolume": 3100000,
    },
    {
        "symbol": "AFCONS",
        "name": "Afcons Infrastructure Ltd.",
        "listingDate": "2024-11-04",
        "anchorSharesTotal": 16200000,
        "preIpoSharesTotal": 290000000,
        "avgDailyVolume": 2400000,
    },
    {
        "symbol": "PREMIERENE",
        "name": "Premier Energies Ltd.",
        "listingDate": "2024-09-03",
        "anchorSharesTotal": 8600000,
        "preIpoSharesTotal": 310000000,
        "avgDailyVolume": 2900000,
    },
    {
        "symbol": "BAJAJHFL",
        "name": "Bajaj Housing Finance Ltd.",
        "listingDate": "2024-09-16",
        "anchorSharesTotal": 51000000,
        "preIpoSharesTotal": 4500000000,
        "avgDailyVolume": 14000000,
    },
    {
        "symbol": "NTPCGREEN",
        "name": "NTPC Green Energy Ltd.",
        "listingDate": "2024-11-27",
        "anchorSharesTotal": 358000000,
        "preIpoSharesTotal": 6500000000,
        "avgDailyVolume": 22000000,
    },
]


def _parse_date(s: str) -> date:
    return date.fromisoformat(s)


def build_lockin_calendar(as_of: date | None = None) -> dict[str, Any]:
    """Compile upcoming and recent IPO lock-in expiry events with supply impact metrics."""
    ref_date = as_of or date.today()

    events: list[dict[str, Any]] = []

    for item in KNOWN_LOCKIN_SCHEDULES:
        sym = item["symbol"]
        name = item["name"]
        l_date = _parse_date(item["listingDate"])
        anchor_tot = item["anchorSharesTotal"]
        pre_ipo_tot = item["preIpoSharesTotal"]
        adv = item["avgDailyVolume"]

        # Fetch live quote for valuation calculation
        try:
            q, _ = CACHE.get_or_fetch(
                f"company:quote:NSE:{sym}",
                SETTINGS.quote_ttl,
                lambda s=sym: quote_sources.fetch(s, "NSE"),
            )
            cmp = float(q.get("cmp", 0.0)) if q else None
        except Exception:
            cmp = None

        # 4 Standard SEBI Lock-in tranches:
        # 1. 30-Day Anchor (50% of anchor book)
        # 2. 90-Day Anchor (remaining 50% of anchor book)
        # 3. 180-Day (6-month pre-IPO shareholder lock-in)
        # 4. 365-Day (1-year promoter & pre-IPO lock-in)
        tranches = [
            ("Anchor 30-Day (50%)", l_date + timedelta(days=30), int(anchor_tot * 0.5)),
            ("Anchor 90-Day (50%)", l_date + timedelta(days=90), int(anchor_tot * 0.5)),
            ("Pre-IPO 6-Month", l_date + timedelta(days=180), int(pre_ipo_tot * 0.2)),
            ("Pre-IPO 1-Year", l_date + timedelta(days=365), int(pre_ipo_tot * 0.8)),
        ]

        for label, u_date, shares in tranches:
            diff_days = (u_date - ref_date).days
            if diff_days < 0:
                status = "EXPIRED"
            elif diff_days <= 14:
                status = "IMMINENT"
            elif diff_days <= 45:
                status = "UPCOMING_SOON"
            else:
                status = "FUTURE"

            supply_ratio = round(shares / adv, 1) if adv > 0 else None
            unlock_val_cr = round((shares * cmp) / 1e7, 2) if cmp else None

            # Risk level based on supply impact ratio
            if supply_ratio and supply_ratio >= 5.0:
                risk = "High Selling Pressure"
            elif supply_ratio and supply_ratio >= 2.0:
                risk = "Moderate Selling Pressure"
            else:
                risk = "Absorbable"

            events.append({
                "symbol": sym,
                "companyName": name,
                "listingDate": l_date.isoformat(),
                "lockinCategory": label,
                "unlockDate": u_date.isoformat(),
                "daysRemaining": diff_days,
                "status": status,
                "sharesUnlocking": shares,
                "unlockValueCr": unlock_val_cr,
                "cmp": cmp,
                "avgDailyVolume": adv,
                "supplyImpactRatio": supply_ratio,
                "riskLevel": risk,
            })

    # Sort: Imminent and upcoming events first, chronologically
    upcoming_events = [e for e in events if e["status"] != "EXPIRED"]
    upcoming_events.sort(key=lambda x: x["daysRemaining"])

    expired_events = [e for e in events if e["status"] == "EXPIRED"]
    expired_events.sort(key=lambda x: -x["daysRemaining"])

    all_sorted = upcoming_events + expired_events

    return {
        "asOf": ref_date.isoformat(),
        "totalEventsTracked": len(all_sorted),
        "upcomingCount": len(upcoming_events),
        "imminentCount": sum(1 for e in upcoming_events if e["status"] == "IMMINENT"),
        "events": all_sorted,
        "rules": {
            "anchor30d": "50% of the shares allocated to anchor investors are locked in for 30 days from allotment.",
            "anchor90d": "Remaining 50% of anchor shares unlock 90 days after allotment.",
            "preIpo": "Pre-IPO shareholder equity is locked in for 6 months to 1 year under SEBI ICDR guidelines.",
            "supplyRatio": "Supply Impact Ratio = Unlocking Shares / 30D Average Traded Volume. Ratios >3x typically trigger high morning volatility.",
        },
    }
