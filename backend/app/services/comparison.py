"""Multi-company comparison matrix.

Assembles side-by-side valuation, profitability, health and quality metrics
for up to 4 companies simultaneously.
"""

from __future__ import annotations

from typing import Any

from ..cache import CACHE
from ..config import SETTINGS
from ..providers import fundamentals, screener, yahoo
from ..services import forensics, quote_sources, yahoo_company


def compare(symbols: list[str]) -> dict[str, Any]:
    """Compare up to 4 companies side by side across valuation, quality and health."""
    clean_syms = [s.strip().upper() for s in symbols if s.strip()][:4]
    if not clean_syms:
        return {"companies": [], "metrics": []}

    companies: list[dict[str, Any]] = []

    for sym in clean_syms:
        # Quote
        try:
            quote, _ = CACHE.get_or_fetch(
                f"company:quote:NSE:{sym}",
                SETTINGS.quote_ttl,
                lambda s=sym: quote_sources.fetch(s, "NSE"),
            )
        except Exception:
            quote = None

        # Profile
        try:
            profile, _ = CACHE.get_or_fetch(
                f"company:profile:NSE:{sym}",
                SETTINGS.fundamentals_ttl,
                lambda s=sym: yahoo.fetch_profile(s, "NSE"),
            )
        except Exception:
            profile = None

        # Valuation
        try:
            val, _ = CACHE.get_or_fetch(
                f"company:valuation:NSE:{sym}",
                SETTINGS.fundamentals_ttl,
                lambda s=sym: yahoo.fetch_valuation(s, "NSE"),
            )
        except Exception:
            val = {}

        # Financials / Ratios
        ratios: dict[str, Any] = {}
        quarterly: list[dict[str, Any]] = []
        annual: list[dict[str, Any]] = []
        balance: list[dict[str, Any]] = []
        company_data: dict[str, Any] | None = None
        mcap = quote.get("marketCapCr") if quote else None

        try:
            company_data = screener.fetch_company(sym)
            quarterly = fundamentals.fetch_quarterly_pnl(sym, "NSE")
            balance = fundamentals.fetch_balance_sheet(sym, "NSE")
            annual = fundamentals.fetch_annual_pnl(sym, "NSE")
            ratios = fundamentals.compute_ratios(quarterly, balance, mcap, annual)
        except Exception:
            ratios = {}

        # Forensics (Piotroski, Altman, Beneish)
        f_scores: dict[str, Any] = {}
        try:
            stmts = yahoo_company.statements(sym, "NSE")
            f_scores = forensics.build(
                stmts,
                {"quarterly": quarterly, "annual": annual, "balanceSheet": balance, "ratios": ratios},
                mcap,
                lender=False,
                screener_annual=company_data.get("annual") if company_data else None,
            )
        except Exception:
            f_scores = {}

        companies.append({
            "symbol": sym,
            "name": (profile or {}).get("name") or sym,
            "sector": (profile or {}).get("sector") or "—",
            "industry": (profile or {}).get("industry") or "—",
            "price": (quote or {}).get("cmp"),
            "changePct": (quote or {}).get("change", {}).get("percent"),
            "marketCapCr": (quote or {}).get("marketCapCr"),
            "valuation": {
                "peRatio": val.get("peRatio"),
                "pbRatio": val.get("pbRatio"),
                "evToEbitda": val.get("evToEbitda"),
                "evToSales": val.get("evToSales"),
                "dividendYieldPct": val.get("dividendYieldPct"),
                "eps": val.get("eps"),
                "bookValue": val.get("bookValue"),
            },
            "profitability": {
                "rocePct": ratios.get("rocePct"),
                "roePct": ratios.get("roePct"),
                "netProfitCr": ratios.get("netProfitCr"),
                "revenueCr": ratios.get("revenueCr"),
            },
            "financialHealth": {
                "debtToEquity": ratios.get("debtToEquity"),
                "currentRatio": ratios.get("currentRatio"),
            },
            "forensics": {
                "piotroskiFScore": f_scores.get("piotroski", {}).get("score"),
                "altmanZScore": f_scores.get("altman", {}).get("score"),
                "beneishMScore": f_scores.get("beneish", {}).get("score"),
                "beneishVerdict": f_scores.get("beneish", {}).get("verdict"),
            },
        })

    return {
        "symbols": clean_syms,
        "companies": companies,
        "count": len(companies),
    }
