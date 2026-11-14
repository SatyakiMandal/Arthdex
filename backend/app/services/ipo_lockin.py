"""
IPO lock-in expiry dates, derived from listing dates in the live IPO pipeline.

SEBI's rules fix how long each class of pre-listing shareholder is locked in, so the expiry
dates follow from the calendar alone:

  * anchor investors: half their shares for 30 days, the rest for 90 days;
  * pre-IPO shareholders other than promoters: six months.

The periods run from the date of allotment, which the exchange feed does not carry. Listing
normally follows allotment by one to three working days, so dates here are counted from the
listing date and may be a few days late. That is stated in the payload.

How many shares unlock on each date is in each company's prospectus and is not connected,
so share counts, rupee values and volume ratios are not shown.

``build`` takes the pipeline as an argument and is tested offline.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

TRANCHES: list[tuple[str, int]] = [
    ("Anchor investors: first half", 30),
    ("Anchor investors: remainder", 90),
    ("Pre-IPO shareholders (non-promoter)", 180),
]
LOOK_BACK_DAYS = 14     # recently expired, still worth showing
LOOK_AHEAD_DAYS = 200   # covers the six-month tranche of a company listed today

RULES = {
    "anchor30d": "Half of the shares allotted to anchor investors are locked in for 30 days.",
    "anchor90d": "The other half of the anchor allotment is locked in for 90 days.",
    "preIpo": "Shares held before the issue by anyone other than the promoters are locked in for six months.",
    "basis": (
        "Periods run from the allotment date, which is not published in the exchange feed. Dates here are counted "
        "from the listing date, usually one to three working days later, so the true expiry may be slightly earlier."
    ),
    "notShown": "Share counts unlocking on each date come from each prospectus and are not connected.",
}


def _status(days: int) -> str:
    if days < 0:
        return "EXPIRED"
    if days <= 14:
        return "IMMINENT"
    if days <= 45:
        return "UPCOMING_SOON"
    return "FUTURE"


def build(pipeline: dict[str, Any] | None, as_of: date | None = None) -> dict[str, Any]:
    today = as_of or date.today()
    events: list[dict[str, Any]] = []
    for issue in (pipeline or {}).get("issues") or []:
        if not issue.get("listingDate"):
            continue
        try:
            listed = date.fromisoformat(str(issue["listingDate"])[:10])
        except ValueError:
            continue
        if listed > today:
            continue  # not listed yet: its lock-ins have not started
        for label, days in TRANCHES:
            unlock = listed + timedelta(days=days)
            remaining = (unlock - today).days
            if remaining < -LOOK_BACK_DAYS or remaining > LOOK_AHEAD_DAYS:
                continue
            events.append({
                "symbol": issue.get("symbol"),
                "companyName": issue.get("name") or issue.get("symbol"),
                "segment": issue.get("segment"),
                "listingDate": listed.isoformat(),
                "lockinCategory": label,
                "unlockDate": unlock.isoformat(),
                "daysRemaining": remaining,
                "status": _status(remaining),
                "cmp": issue.get("cmp"),
                # Not available without the prospectus:
                "sharesUnlocking": None,
                "unlockValueCr": None,
                "avgDailyVolume": None,
                "supplyImpactRatio": None,
                "riskLevel": None,
            })
    upcoming = sorted((e for e in events if e["status"] != "EXPIRED"), key=lambda e: e["daysRemaining"])
    expired = sorted((e for e in events if e["status"] == "EXPIRED"), key=lambda e: -e["daysRemaining"])
    return {
        "asOf": today.isoformat(),
        "totalEventsTracked": len(events),
        "upcomingCount": len(upcoming),
        "imminentCount": sum(1 for e in upcoming if e["status"] == "IMMINENT"),
        "events": upcoming + expired,
        "rules": RULES,
    }
