"""
Buybacks announced on NSE, from the exchange's corporate-actions list.

The list gives the company, the ex-date and the record date. It does not give the offer
price, the size or the route (tender or open market): those are in each company's public
announcement, which is not connected. So this desk is a calendar, not an arbitrage
calculator, and it says so.

``build`` takes the corporate-actions rows as an argument and is tested offline.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

NOT_SHOWN = (
    "Offer price, offer size, tender or open-market route and acceptance entitlement are in each company's "
    "public announcement and are not connected, so no premium or acceptance estimate is shown."
)


def _date(text: Any) -> str | None:
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(text).strip(), fmt).date().isoformat()
        except (TypeError, ValueError):
            continue
    return None


def build(actions: list[dict[str, Any]] | None, today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    rows = []
    for item in actions or []:
        subject = str(item.get("subject") or "")
        if "buy back" not in subject.lower() and "buyback" not in subject.lower():
            continue
        ex_date, record_date = _date(item.get("exDate")), _date(item.get("recDate"))
        reference = record_date or ex_date
        days = (date.fromisoformat(reference) - today).days if reference else None
        rows.append({
            "symbol": item.get("symbol"),
            "companyName": item.get("comp") or item.get("symbol"),
            "subject": subject,
            "series": item.get("series"),
            "faceValue": item.get("faceVal"),
            "exDate": ex_date,
            "recordDate": record_date,
            "daysToRecordDate": days,
            "status": "UPCOMING" if days is not None and days >= 0 else "PAST" if days is not None else "UNDATED",
        })
    rows.sort(key=lambda r: (r["daysToRecordDate"] is None, r["daysToRecordDate"] if r["daysToRecordDate"] is not None and r["daysToRecordDate"] >= 0 else 10**6))
    return {
        "asOf": today.isoformat(),
        "count": len(rows),
        "upcomingCount": sum(1 for r in rows if r["status"] == "UPCOMING"),
        "buybacks": rows,
        "recordDateRule": "To take part in a tender-offer buyback you must hold the shares on the record date; with T+1 settlement that means buying at least one trading day before it.",
        "notShown": NOT_SHOWN,
    }
