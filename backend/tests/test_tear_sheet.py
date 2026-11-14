"""
Tear sheet (M25) and research notes.

The sheet is assembled from the company page's own data, so these tests feed `assemble`
fixed sections and check that every printed figure traces to one of them, that nothing is
invented when a section is missing, and that the routes behave.
"""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app.services import tear_sheet, tear_sheet_live
from app.services.tear_sheet import add_research_note, get_research_notes_for_symbol
from app.services.tear_sheet_live import TearSheetUnavailable, assemble, cagr_pct

try:
    from starlette.testclient import TestClient

    from app.main import app

    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False
    TestClient = None
    app = None


def _parts() -> dict:
    annual = [
        {"period": "FY23", "periodEnd": "2023-03-31", "revenue": 1000.0, "operatingProfit": 200.0, "opmPct": 20.0, "netProfit": 100.0, "eps": 10.0},
        {"period": "FY24", "periodEnd": "2024-03-31", "revenue": 1100.0, "operatingProfit": 231.0, "opmPct": 21.0, "netProfit": 121.0, "eps": 12.1},
        {"period": "FY25", "periodEnd": "2025-03-31", "revenue": 1210.0, "operatingProfit": 266.2, "opmPct": 22.0, "netProfit": 146.41, "eps": 14.64},
    ]
    balance = [
        {"period": "FY25", "netWorth": 732.05, "debtToEquity": 0.2, "currentRatio": 1.8},
    ]
    return {
        "quote": {
            "symbol": "TESTCO", "exchange": "NSE", "cmp": 500.0, "change": {"absolute": 5.0, "percent": 1.01},
            "dayHigh": 505.0, "dayLow": 495.0, "high52w": 600.0, "low52w": 400.0, "marketCapCr": 5000.0,
            "isin": "INE000T01011", "name": "Test Company Limited", "sector": "Capital Goods",
            "basicIndustry": "Industrial Products", "asOf": "2026-11-12T10:00:00+00:00",
        },
        "profile": {"name": "Test Company Limited", "website": "https://example.test", "summary": "Makes things.", "employees": 1200},
        "financials": {
            "annual": annual,
            "balanceSheet": balance,
            "quarterly": [],
            "ratios": {"roePct": 20.0, "rocePct": 24.0, "debtToEquity": 0.2, "currentRatio": 1.8, "basis": "last four reported quarters"},
        },
        "valuation": {"peRatio": 34.15, "pbRatio": 6.83, "evToEbitda": 18.2, "dividendYieldPct": 1.1, "eps": 14.64, "epsBasis": "last four reported quarters"},
        "shareholding": {
            "pattern": {"quarterly": {
                "labels": ["Jun 2026", "Sep 2026"], "promoters": [60.0, 60.0], "fiis": [15.0, 16.0],
                "diis": [10.0, 9.5], "government": [0.0, 0.0], "public": [15.0, 14.5],
            }},
            "pledge": {"asOf": "30-Sep-2026", "pledgedPct": 1.25},
        },
        "peers": {
            "classification": {"industry": "Industrial Products"},
            "peers": [{"symbol": "TESTCO", "name": "Test Company Limited", "pe": 34.15, "marketCapCr": 5000.0, "rocePct": 24.0}],
        },
        "analysts": {
            "targets": {"median": 550.0, "high": 650.0, "low": 450.0, "analysts": 9, "key": "buy"},
            "recommendations": [{"strongBuy": 2, "buy": 4, "hold": 2, "sell": 1, "strongSell": 0}],
            "earningsEstimate": [{"key": "0y", "avg": 16.0, "numberOfAnalysts": 9}],
            "revenueEstimate": [{"key": "0y", "avg": 1350.0}],
        },
        "statistics": {
            "about": {"city": "Pune", "country": "India"},
            "officers": [{"name": "A. Person", "title": "Managing Director"}],
            "valuation": {"enterpriseValue": 5200.0, "forwardPE": 30.0},
            "trading": {"sharesOutstanding": 100_000_000, "floatShares": 40_000_000, "avgVolume": 200_000},
        },
        "candles": [
            {"date": "2025-11-10", "close": 400.0},
            {"date": "2026-05-12", "close": 450.0},
            {"date": "2026-08-12", "close": 480.0},
            {"date": "2026-10-12", "close": 490.0},
            {"date": "2026-11-12", "close": 500.0},
        ],
    }


class TestAssemble(unittest.TestCase):
    def test_every_figure_traces_to_a_section(self):
        sheet = assemble("testco", _parts())
        self.assertEqual(sheet["header"]["symbol"], "TESTCO")
        self.assertEqual(sheet["header"]["name"], "Test Company Limited")
        self.assertEqual(sheet["header"]["isin"], "INE000T01011")
        self.assertEqual(sheet["header"]["headquarters"], "Pune, India")
        self.assertEqual(sheet["header"]["key_executives"], [{"designation": "Managing Director", "name": "A. Person"}])
        stats = sheet["trading_stats"]
        self.assertEqual(stats["current_price"], 500.0)
        self.assertEqual(stats["shares_outstanding_cr"], 10.0)
        self.assertEqual(stats["free_float_pct"], 40.0)
        self.assertEqual(stats["avg_daily_value_cr"], 10.0)  # 2,00,000 shares x Rs 500
        self.assertEqual(sheet["multiples"]["pe_ttm"], 34.15)
        self.assertEqual(sheet["returns_on_capital"]["roce_pct"], 24.0)
        self.assertEqual(sheet["unavailable"], [])

    def test_growth_is_computed_from_the_annual_rows(self):
        sheet = assemble("TESTCO", _parts())
        rows = sheet["financials"]
        self.assertEqual([r["fiscal_year"] for r in rows], ["FY23", "FY24", "FY25"])
        self.assertIsNone(rows[0]["revenue_growth_pct"])
        self.assertEqual(rows[1]["revenue_growth_pct"], 10.0)
        self.assertEqual(rows[2]["pat_margin_pct"], 12.1)
        self.assertEqual(rows[2]["roe_pct"], 20.0)  # 146.41 / 732.05
        self.assertIsNone(rows[0]["roe_pct"])  # no balance sheet on file for FY23
        growth = sheet["growth"]
        self.assertEqual((growth["span_years"], growth["from"], growth["to"]), (2, "FY23", "FY25"))
        by_metric = {m["metric"]: m for m in growth["metrics"]}
        self.assertEqual(by_metric["Revenue"]["cagr_pct"], 10.0)
        self.assertEqual(by_metric["Net profit"]["cagr_pct"], 21.0)

    def test_returns_need_history_that_reaches_back(self):
        returns = assemble("TESTCO", _parts())["trading_stats"]["returns"]
        self.assertEqual(returns["1M_pct"], 2.0)   # 490 -> 500
        self.assertEqual(returns["3M_pct"], 4.2)   # 480 -> 500
        self.assertEqual(returns["6M_pct"], 11.1)  # 450 -> 500
        self.assertEqual(returns["1Y_pct"], 25.0)  # 400 -> 500
        short = _parts()
        short["candles"] = short["candles"][-2:]
        self.assertIsNone(assemble("TESTCO", short)["trading_stats"]["returns"]["1Y_pct"])

    def test_shareholding_and_consensus(self):
        sheet = assemble("TESTCO", _parts())
        latest = sheet["shareholding_trend"][-1]
        self.assertEqual(latest["quarter"], "Sep 2026")
        total = sum(latest[k] for k in ("promoter_holding_pct", "fii_holding_pct", "dii_holding_pct", "government_holding_pct", "public_holding_pct"))
        self.assertAlmostEqual(total, 100.0, delta=0.01)
        self.assertEqual(sheet["promoter_pledge_status"]["pledged_pct_of_total"], 1.25)
        consensus = sheet["analyst_consensus"]
        self.assertEqual(consensus["ratings_breakdown"], {"buy": 6, "hold": 2, "sell": 1})
        self.assertEqual(consensus["target_price"]["implied_upside_pct"], 10.0)
        self.assertEqual(consensus["forecasts"]["Current year"]["eps"], 16.0)

    def test_missing_sections_are_blank_not_invented(self):
        parts = {"quote": _parts()["quote"]}
        sheet = assemble("TESTCO", parts)
        self.assertEqual(sheet["financials"], [])
        self.assertEqual(sheet["peers"], [])
        self.assertEqual(sheet["shareholding_trend"], [])
        self.assertIsNone(sheet["analyst_consensus"])
        self.assertIsNone(sheet["promoter_pledge_status"])
        self.assertIsNone(sheet["multiples"]["pe_ttm"])
        self.assertEqual(sheet["header"]["key_executives"], [])
        self.assertIn("financials", sheet["unavailable"])
        self.assertIn("analysts", sheet["unavailable"])

    def test_no_quote_means_no_sheet(self):
        with self.assertRaises(TearSheetUnavailable):
            assemble("NOSUCH", {"quote": None})

    def test_cagr_is_undefined_across_a_loss(self):
        self.assertIsNone(cagr_pct(-5.0, 10.0, 3))
        self.assertIsNone(cagr_pct(5.0, -10.0, 3))
        self.assertIsNone(cagr_pct(None, 10.0, 3))
        self.assertEqual(cagr_pct(100.0, 121.0, 2), 10.0)


class TestResearchNotes(unittest.TestCase):
    def test_store_starts_empty_and_keeps_new_notes(self):
        symbol = "ZZNOTES"
        try:
            self.assertEqual(get_research_notes_for_symbol(symbol), [])
            note = add_research_note(symbol, "Order book visibility improving", "QA Analyst", "Test House", "BUY", 1220.0)
            self.assertEqual(note["symbol"], symbol)
            self.assertEqual(note["target_price"], 1220.0)
            stored = get_research_notes_for_symbol(symbol)
            self.assertEqual([n["id"] for n in stored], [note["id"]])
        finally:
            tear_sheet._RESEARCH_NOTES_STORE.pop(symbol, None)

    def test_no_sample_notes_are_seeded(self):
        for symbol in ("RELIANCE", "TCS", "TATAMOTORS"):
            authors = {n["firm"] for n in get_research_notes_for_symbol(symbol)}
            self.assertNotIn("Arthdex Capital Research", authors)


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class TestTearSheetEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_tear_sheet_route_serves_the_assembled_sheet(self):
        with patch.object(tear_sheet_live, "build", side_effect=lambda sym: assemble(sym, _parts())):
            res = self.client.get("/api/v1/company/TESTCO/tear-sheet")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["header"]["symbol"], "TESTCO")
        self.assertEqual(len(data["financials"]), 3)
        self.assertIn("latest_research_notes", data)

    def test_unknown_symbol_is_a_404(self):
        with patch.object(tear_sheet_live, "build", side_effect=TearSheetUnavailable("no quote")):
            res = self.client.get("/api/v1/company/ZZNOSUCH/tear-sheet")
        self.assertEqual(res.status_code, 404)

    def test_malformed_symbol_is_refused(self):
        self.assertEqual(self.client.get("/api/v1/company/A%20B<x/tear-sheet").status_code, 400)

    def test_notes_round_trip(self):
        symbol = "ZZROUTE"
        try:
            before = self.client.get(f"/api/company/{symbol}/notes").json()["data"]["count"]
            res = self.client.post(f"/api/company/{symbol}/notes", json={
                "title": "Margin recovery thesis", "author": "QA Analyst", "firm": "Test House",
                "recommendation": "BUY", "target_price": 4750.0,
            })
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["data"]["target_price"], 4750.0)
            after = self.client.get(f"/api/company/{symbol}/notes").json()["data"]["count"]
            self.assertEqual(after, before + 1)
        finally:
            tear_sheet._RESEARCH_NOTES_STORE.pop(symbol, None)


if __name__ == "__main__":
    unittest.main()
