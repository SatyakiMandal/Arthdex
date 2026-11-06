"""
Unittest test suite for Phase 15: Institutional Tear-Sheet & Research Notes (M25).
"""

from __future__ import annotations

import unittest

try:
    from app.services.tear_sheet import (
        TAG_ACTUAL,
        TAG_CONSENSUS,
        TAG_MODELLED,
        TEAR_SHEET_CURATED_DATA,
        ResearchNote,
        add_research_note,
        get_company_tear_sheet,
        get_research_notes_for_symbol,
    )
except ImportError:
    from backend.app.services.tear_sheet import (
        TAG_ACTUAL,
        TAG_CONSENSUS,
        TAG_MODELLED,
        TEAR_SHEET_CURATED_DATA,
        ResearchNote,
        add_research_note,
        get_company_tear_sheet,
        get_research_notes_for_symbol,
    )

try:
    from starlette.testclient import TestClient
    from app.main import app
    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False
    TestClient = None
    app = None


class TestTearSheetService(unittest.TestCase):
    def test_curated_marquee_tear_sheets(self):
        """Verifies institutional tear sheet details for RELIANCE and TCS."""
        for sym in ["RELIANCE", "TCS"]:
            sheet = get_company_tear_sheet(sym)
            self.assertEqual(sheet["header"]["symbol"], sym)
            self.assertIn("trading_stats", sheet)
            self.assertIn("financials_10y", sheet)
            self.assertIn("peers", sheet)
            self.assertIn("shareholding_trend", sheet)
            self.assertIn("analyst_consensus", sheet)

            # 10 Years of financial data
            fin = sheet["financials_10y"]
            self.assertEqual(len(fin), 10)
            for row in fin:
                self.assertIn("fiscal_year", row)
                self.assertGreater(row["revenue_cr"], 0.0)
                self.assertGreater(row["ebitda_cr"], 0.0)
                self.assertGreater(row["pat_cr"], 0.0)
                self.assertGreater(row["eps"], 0.0)
                self.assertGreater(row["roce_pct"], 0.0)

            # Peers
            peers = sheet["peers"]
            self.assertGreaterEqual(len(peers), 4)
            for p in peers:
                self.assertIn("symbol", p)
                self.assertIn("pe_ttm", p)
                self.assertIn("ev_ebitda", p)

            # Shareholding quarters
            sh = sheet["shareholding_trend"]
            self.assertGreaterEqual(len(sh), 4)
            for q in sh:
                total_pct = q["promoter_holding_pct"] + q["fii_holding_pct"] + q["dii_holding_pct"] + q["public_holding_pct"]
                self.assertAlmostEqual(total_pct, 100.0, delta=1.0)

            # Analyst consensus
            ac = sheet["analyst_consensus"]
            self.assertGreater(ac["total_coverage"], 20)
            self.assertIn("FY25E", ac["forecasts"])
            self.assertIn("FY26E", ac["forecasts"])

    def test_synthetic_fallback_any_symbol(self):
        """Arbitrary ticker should generate a valid, complete 10-year institutional tear sheet."""
        sheet = get_company_tear_sheet("WIPRO")
        self.assertEqual(sheet["header"]["symbol"], "WIPRO")
        self.assertEqual(len(sheet["financials_10y"]), 10)
        self.assertGreater(sheet["trading_stats"]["current_price"], 0)
        self.assertGreater(len(sheet["peers"]), 2)

    def test_research_notes_storage_lifecycle(self):
        """Tests adding and retrieving institutional research notes."""
        symbol = "TATAMOTORS"
        existing = get_research_notes_for_symbol(symbol)
        initial_count = len(existing)

        # Add a new research note
        new_note = add_research_note(
            symbol=symbol,
            title="Commercial Vehicle Cycle Bottoming Out; Fleet Modernization Tailwinds",
            author="Sameer Mehta, CFA",
            firm="Arthdex Institutional Equities",
            recommendation="BUY",
            target_price=1220.0,
            horizon="12 Months",
            key_catalysts=["Scrappage policy enforcement", "Defense mobility vehicle contracts"],
            key_risks=["Raw steel commodity price volatility"],
            tags=["Automobile", "Commercial Vehicles", "Infrastructure"],
            content="Q3 fleet utilization has risen to 82%. Operating leverage will expand CV margins to double digits.",
        )

        self.assertIn("id", new_note)
        self.assertEqual(new_note["symbol"], symbol)
        self.assertEqual(new_note["recommendation"], "BUY")
        self.assertEqual(new_note["target_price"], 1220.0)

        # Retrieve and verify count incremented
        updated = get_research_notes_for_symbol(symbol)
        self.assertEqual(len(updated), initial_count + 1)
        self.assertEqual(updated[0]["id"], new_note["id"])


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class TestTearSheetEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not HAS_TESTCLIENT:
            return
        cls.client = TestClient(app)

    def test_get_tear_sheet_endpoint(self):
        res = self.client.get("/api/company/RELIANCE/tear-sheet")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("data", body)
        data = body["data"]
        self.assertEqual(data["header"]["symbol"], "RELIANCE")
        self.assertEqual(len(data["financials_10y"]), 10)

    def test_get_and_post_notes_endpoints(self):
        # 1. Fetch notes for TCS
        res_get = self.client.get("/api/company/TCS/notes")
        self.assertEqual(res_get.status_code, 200)
        body_get = res_get.json()
        self.assertIn("data", body_get)
        self.assertGreaterEqual(body_get["data"]["count"], 1)

        # 2. Post a new research note for TCS
        note_payload = {
            "title": "Cloud Migration Momentum & Banking Deal Resurgence",
            "author": "Kavita Rao",
            "firm": "Morgan Capital (Simulated)",
            "recommendation": "ACCUMULATE",
            "target_price": 4750.0,
            "horizon": "12 Months",
            "key_catalysts": ["US Regional Banking tech refresh", "BFSI cloud transformation"],
            "key_risks": ["Wage inflation in offshore centers"],
            "tags": ["IT", "BFSI", "Cloud"],
            "content": "TCS is well-positioned for discretionary tech spending revival.",
        }
        res_post = self.client.post("/api/company/TCS/notes", json=note_payload)
        self.assertEqual(res_post.status_code, 200)
        body_post = res_post.json()
        self.assertEqual(body_post["data"]["symbol"], "TCS")
        self.assertEqual(body_post["data"]["target_price"], 4750.0)

        # 3. Fetch again and verify presence
        res_get2 = self.client.get("/api/company/TCS/notes")
        body_get2 = res_get2.json()
        self.assertEqual(body_get2["data"]["count"], body_get["data"]["count"] + 1)


if __name__ == "__main__":
    unittest.main()
