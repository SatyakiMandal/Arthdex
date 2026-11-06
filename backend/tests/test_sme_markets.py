"""
Unittest test suite for Phase 14: Dedicated SME Exchange Board (NSE Emerge & BSE SME).
"""

from __future__ import annotations

import unittest

try:
    from app.services.sme_markets import (
        MIGRATED_MAINBOARD_STARS,
        SME_ACTIVE_LISTINGS,
        SME_IPO_PIPELINE,
        MainboardMigrationCandidate,
        MigratedCompanyRecord,
        SMEIPOItem,
        SMEListing,
        check_mainboard_eligibility,
        get_sme_ipos,
        get_sme_migrations,
        get_sme_overview,
        screen_sme_stocks,
    )
except ImportError:
    from backend.app.services.sme_markets import (
        MIGRATED_MAINBOARD_STARS,
        SME_ACTIVE_LISTINGS,
        SME_IPO_PIPELINE,
        MainboardMigrationCandidate,
        MigratedCompanyRecord,
        SMEIPOItem,
        SMEListing,
        check_mainboard_eligibility,
        get_sme_ipos,
        get_sme_migrations,
        get_sme_overview,
        screen_sme_stocks,
    )

try:
    from starlette.testclient import TestClient
    from app.main import app
    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False
    TestClient = None
    app = None


class TestSMEMarketsService(unittest.TestCase):
    def test_sme_listings_dataset(self):
        """Verifies active listings dataset coverage across NSE Emerge and BSE SME."""
        self.assertGreaterEqual(len(SME_ACTIVE_LISTINGS), 10)
        nse_listings = [i for i in SME_ACTIVE_LISTINGS if i.exchange == "NSE Emerge"]
        bse_listings = [i for i in SME_ACTIVE_LISTINGS if i.exchange == "BSE SME"]
        self.assertGreater(len(nse_listings), 0)
        self.assertGreater(len(bse_listings), 0)

        for item in SME_ACTIVE_LISTINGS:
            self.assertGreater(item.market_cap_cr, 0.0)
            self.assertGreater(item.lot_size, 0)
            self.assertGreater(item.bid_ask_spread_pct, 0.0)

    def test_sebi_minimum_application_amount_mandate(self):
        """
        SEBI mandate test: All SME IPO lots must have minimum application amounts
        strictly between ₹1.0 Lakh and ₹1.5 Lakh.
        """
        for ipo in SME_IPO_PIPELINE:
            app_amount = ipo.lot_size * ipo.issue_price
            self.assertAlmostEqual(ipo.min_application_amount, app_amount, places=1)
            self.assertGreaterEqual(
                app_amount,
                100000.0,
                f"{ipo.company_name} min application ({app_amount}) is below SEBI ₹1.0 Lakh minimum threshold",
            )
            self.assertLessEqual(
                app_amount,
                150000.0,
                f"{ipo.company_name} min application ({app_amount}) exceeds SEBI ₹1.5 Lakh upper bound",
            )

    def test_sme_overview_metrics(self):
        """Validates market overview aggregation, sector breakdown, and market breadth."""
        overview = get_sme_overview()
        board = overview["board_summary"]
        self.assertEqual(board["total_active_listings"], len(SME_ACTIVE_LISTINGS))
        self.assertGreater(board["total_market_cap_cr"], 5000.0)
        self.assertGreater(board["daily_turnover_lakhs"], 500.0)

        # Market breadth check
        breadth = board["market_breadth"]
        total_breadth = breadth["advances"] + breadth["declines"] + breadth["unchanged"]
        self.assertEqual(total_breadth, len(SME_ACTIVE_LISTINGS))

        # Sectors
        sectors = overview["sector_distribution"]
        self.assertGreaterEqual(len(sectors), 5)
        sector_names = [s["sector"] for s in sectors]
        self.assertIn("Renewable Energy & CleanTech", sector_names)
        self.assertIn("IT, SaaS & Cybersecurity", sector_names)

    def test_mainboard_migration_eligibility_checks(self):
        """
        Verifies SEBI 5-point eligibility check logic:
          1. >= 36 months on SME
          2. Paid-up capital >= 10 Cr
          3. Market cap >= 25 Cr
          4. Positive PAT in at least 2 of 3 years
          5. Public shareholders >= 250
        """
        remus = next(i for i in SME_ACTIVE_LISTINGS if i.symbol == "REMUS")
        cand_remus = check_mainboard_eligibility(remus)
        self.assertTrue(cand_remus.is_fully_eligible)
        self.assertEqual(cand_remus.criteria_met, 5)
        self.assertEqual(cand_remus.migration_status, "Ready for Migration")

        alpex = next(i for i in SME_ACTIVE_LISTINGS if i.symbol == "ALPEXSOLAR")
        cand_alpex = check_mainboard_eligibility(alpex)
        # Alpex listed in Feb 2024 -> ~33 months -> tenure not met yet
        self.assertFalse(cand_alpex.is_fully_eligible)
        self.assertFalse(cand_alpex.eligibility_details["tenure_3y_met"])
        self.assertEqual(cand_alpex.criteria_met, 4)

    def test_mainboard_migration_tracker(self):
        """Checks migration tracker candidates list and graduated stars dataset."""
        tracker = get_sme_migrations()
        self.assertIn("eligible_candidates", tracker)
        self.assertIn("graduated_mainboard_stars", tracker)

        graduated = tracker["graduated_mainboard_stars"]
        self.assertGreaterEqual(len(graduated), 4)
        symbols = [g["symbol"] for g in graduated]
        self.assertIn("GENSOL", symbols)
        self.assertIn("FOCUS", symbols)
        self.assertIn("DPABHUSHAN", symbols)

        # All graduated stars have positive multi-bagger post-migration CAGR
        for star in graduated:
            self.assertGreater(star["post_migration_cagr_pct"], 0.0)

    def test_sme_screener_filtering(self):
        """Tests SME stock screener with various multi-factor filters."""
        # Test 1: Renewable Energy sector filter
        solar_stocks = screen_sme_stocks(sector="Renewable")
        self.assertGreaterEqual(len(solar_stocks), 2)
        for s in solar_stocks:
            self.assertIn("Renewable", s["sector"])

        # Test 2: Migration ready only
        mig_ready = screen_sme_stocks(migration_ready_only=True)
        self.assertGreaterEqual(len(mig_ready), 3)
        for s in mig_ready:
            self.assertTrue(s["is_migration_eligible"])

        # Test 3: Tight bid-ask spread (<= 1.0%)
        tight = screen_sme_stocks(max_spread_pct=1.0)
        self.assertGreater(len(tight), 0)
        for s in tight:
            self.assertLessEqual(s["bid_ask_spread_pct"], 1.0)

        # Test 4: Market cap sorting
        sorted_mcap = screen_sme_stocks(sort_by="market_cap_cr", order="desc")
        for i in range(len(sorted_mcap) - 1):
            self.assertGreaterEqual(sorted_mcap[i]["market_cap_cr"], sorted_mcap[i + 1]["market_cap_cr"])


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class TestSMEMarketsEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not HAS_TESTCLIENT:
            return
        cls.client = TestClient(app)

    def test_get_sme_overview_endpoint(self):
        res = self.client.get("/api/sme/overview")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("data", body)
        data = body["data"]
        self.assertIn("board_summary", data)
        self.assertIn("sector_distribution", data)

    def test_get_sme_ipos_endpoint(self):
        res = self.client.get("/api/sme/ipos")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("data", body)
        data = body["data"]
        self.assertIn("ipos", data)
        self.assertGreater(data["count"], 0)

    def test_get_sme_migrations_endpoint(self):
        res = self.client.get("/api/sme/migrations")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        data = body["data"]
        self.assertIn("eligible_candidates", data)
        self.assertIn("graduated_mainboard_stars", data)

    def test_get_sme_screener_endpoint(self):
        res = self.client.get("/api/sme/screener?sector=Renewable&order=desc")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        data = body["data"]
        self.assertIn("results", data)
        self.assertGreaterEqual(data["count"], 1)


if __name__ == "__main__":
    unittest.main()
