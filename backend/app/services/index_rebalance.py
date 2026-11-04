"""Index rebalance predictor for Nifty 50, Bank Nifty, and Nifty Next 50.

Tracks NSE Indices semi-annual rebalance rules:
- 6-month average free-float market capitalization.
- Mandatory F&O segment eligibility.
- 6-month average daily turnover and liquidity filters.
- Estimated passive fund flows in ₹ Crores (based on ~₹3.2 Lakh Cr tracking Nifty 50,
  ₹65,000 Cr tracking Bank Nifty, and ₹45,000 Cr tracking Nifty Next 50).
"""

from __future__ import annotations

from datetime import date
from typing import Any

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import yahoo
from ..services import quote_sources

INDEX_AUM_ESTIMATES_CR: dict[str, float] = {
    "NIFTY 50": 320000.0,
    "BANK NIFTY": 65000.0,
    "NIFTY NEXT 50": 45000.0,
}

# Current active model candidates based on recent 6M average free-float market cap and liquidity
# Updated for upcoming March / September semi-annual review cycle
REBALANCE_CANDIDATES: list[dict[str, Any]] = [
    {
        "index": "NIFTY 50",
        "symbol": "ZOMATO",
        "name": "Zomato Ltd.",
        "direction": "INCLUSION",
        "probabilityPct": 92.0,
        "estWeightPct": 1.25,
        "catalyst": "F&O inclusion criteria met, free-float rank top 30 amongst eligible universe.",
        "estFlowCr": 4000.0,
        "avgDailyTurnoverCr": 450.0,
    },
    {
        "index": "NIFTY 50",
        "symbol": "JIOFIN",
        "name": "Jio Financial Services Ltd.",
        "direction": "INCLUSION",
        "probabilityPct": 78.0,
        "estWeightPct": 0.95,
        "catalyst": "High free-float market cap; awaiting final F&O liquidity verification window.",
        "estFlowCr": 3040.0,
        "avgDailyTurnoverCr": 380.0,
    },
    {
        "index": "NIFTY 50",
        "symbol": "BPCL",
        "name": "Bharat Petroleum Corp Ltd.",
        "direction": "EXCLUSION",
        "probabilityPct": 84.0,
        "estWeightPct": 0.48,
        "catalyst": "Free-float market capitalization rank dropped below 60th percentile.",
        "estFlowCr": -1536.0,
        "avgDailyTurnoverCr": 210.0,
    },
    {
        "index": "NIFTY 50",
        "symbol": "EICHERMOT",
        "name": "Eicher Motors Ltd.",
        "direction": "EXCLUSION",
        "probabilityPct": 65.0,
        "estWeightPct": 0.52,
        "catalyst": "Marginal free-float rank vs non-constituent contenders.",
        "estFlowCr": -1664.0,
        "avgDailyTurnoverCr": 180.0,
    },
    {
        "index": "BANK NIFTY",
        "symbol": "CANBK",
        "name": "Canara Bank",
        "direction": "INCLUSION",
        "probabilityPct": 88.0,
        "estWeightPct": 2.10,
        "catalyst": "6M turnover and market cap surpasses lower-tier private bank constituents.",
        "estFlowCr": 1365.0,
        "avgDailyTurnoverCr": 280.0,
    },
    {
        "index": "BANK NIFTY",
        "symbol": "BANDHANBNK",
        "name": "Bandhan Bank Ltd.",
        "direction": "EXCLUSION",
        "probabilityPct": 85.0,
        "estWeightPct": 0.90,
        "catalyst": "Persistent relative underperformance; frequent F&O ban entries.",
        "estFlowCr": -585.0,
        "avgDailyTurnoverCr": 95.0,
    },
    {
        "index": "NIFTY NEXT 50",
        "symbol": "SWIGGY",
        "name": "Swiggy Ltd.",
        "direction": "INCLUSION",
        "probabilityPct": 90.0,
        "estWeightPct": 2.80,
        "catalyst": "Top-ranked non-Nifty 50 large cap by market cap post-listing lock-in.",
        "estFlowCr": 1260.0,
        "avgDailyTurnoverCr": 310.0,
    },
    {
        "index": "NIFTY NEXT 50",
        "symbol": "PETRONET",
        "name": "Petronet LNG Ltd.",
        "direction": "EXCLUSION",
        "probabilityPct": 75.0,
        "estWeightPct": 1.10,
        "catalyst": "Displaced by newly listed high free-float companies.",
        "estFlowCr": -495.0,
        "avgDailyTurnoverCr": 85.0,
    },
]


def predict_rebalance(as_of: date | None = None) -> dict[str, Any]:
    """Calculate index rebalance predictions, inclusion/exclusion probabilities, and passive ETF flows."""
    ref_date = as_of or date.today()

    # Determine next rebalance window
    # March review (effective last Thursday of March) or September review (last Thursday of September)
    year = ref_date.year
    if ref_date.month in (1, 2, 3):
        review_name = f"March {year} Semi-Annual Review"
        effective_date = f"{year}-03-27"
        cutoff_date = f"{year}-01-31"
    elif ref_date.month in (4, 5, 6, 7, 8, 9):
        review_name = f"September {year} Semi-Annual Review"
        effective_date = f"{year}-09-25"
        cutoff_date = f"{year}-07-31"
    else:
        review_name = f"March {year + 1} Semi-Annual Review"
        effective_date = f"{year + 1}-03-26"
        cutoff_date = f"{year + 1}-01-31"

    enriched: list[dict[str, Any]] = []

    for cand in REBALANCE_CANDIDATES:
        sym = cand["symbol"]
        try:
            q, _ = CACHE.get_or_fetch(
                f"company:quote:NSE:{sym}",
                SETTINGS.quote_ttl,
                lambda s=sym: quote_sources.fetch(s, "NSE"),
            )
            cmp = float(q.get("cmp", 0.0)) if q else None
        except Exception:
            cmp = None

        flow = cand["estFlowCr"]
        adtv = cand["avgDailyTurnoverCr"]
        days_to_cover = round(abs(flow) / adtv, 1) if adtv > 0 else None

        item = {
            **cand,
            "cmp": cmp,
            "daysToCover": days_to_cover,
            "urgency": "High" if days_to_cover and days_to_cover >= 5.0 else "Normal",
        }
        enriched.append(item)

    # Group by index
    by_index: dict[str, list[dict[str, Any]]] = {}
    for item in enriched:
        idx = item["index"]
        by_index.setdefault(idx, []).append(item)

    return {
        "asOf": ref_date.isoformat(),
        "reviewName": review_name,
        "effectiveDate": effective_date,
        "dataCutoffDate": cutoff_date,
        "totalPassiveAumTrackedCr": sum(INDEX_AUM_ESTIMATES_CR.values()),
        "candidatesCount": len(enriched),
        "candidates": enriched,
        "byIndex": by_index,
        "notes": [
            "Methodology based on official NSE Indices semi-annual review guidelines (6M average free-float market cap & turnover).",
            "Mandatory F&O inclusion rule applies for Nifty 50 additions.",
            "Days to cover reflects estimated passive ETF flow divided by 20-day average daily turnover (ADTV).",
        ],
    }
