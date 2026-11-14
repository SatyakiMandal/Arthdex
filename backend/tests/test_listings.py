"""NSE and BSE listings: the ISIN join, route ids, BSE units and exchange routing."""

import unittest
from unittest import mock

from app import listings
from app.providers import bse, yahoo

NSE_MAIN = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Limited", "series": "EQ", "isin": "INE002A01018"},
    {"symbol": "ONLYNSE", "name": "Only On NSE Ltd", "series": "EQ", "isin": "INE000N00001"},
    # Same letters as a BSE scrip ID below, but a different company (different ISIN)
    {"symbol": "ANDHRA", "name": "Andhra Something NSE Ltd", "series": "EQ", "isin": "INE000N00002"},
]
NSE_SME = [{"symbol": "SMEONE", "name": "Sme One Ltd", "series": "SM", "isin": "INE000S00001"}]
BSE_MASTER = [
    {"code": "500325", "scripId": "RELIANCE", "name": "Reliance Industries Ltd", "isin": "INE002A01018", "group": "A", "sme": False, "status": "active"},
    {"code": "500012", "scripId": "ANDHRA", "name": "Andhra Petrochemicals Ltd", "isin": "INE714B01016", "group": "X", "sme": False, "status": "active"},
    {"code": "543000", "scripId": "SMEBSE", "name": "Bse Sme Ltd", "isin": "INE000B00001", "group": "M", "sme": True, "status": "active"},
    {"code": "512000", "scripId": "HALTED", "name": "Halted Ltd", "isin": "INE000B00002", "group": "Z", "sme": False, "status": "suspended"},
]


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.rows = listings.build(NSE_MAIN, NSE_SME, BSE_MASTER)
        self.by_id = {r["id"]: r for r in self.rows}

    def test_dual_listing_joins_by_isin_and_keeps_nse_symbol(self):
        r = self.by_id["RELIANCE"]
        self.assertEqual(r["exchanges"], ["NSE", "BSE"])
        self.assertEqual(r["bse"]["code"], "500325")

    def test_bse_only_company_is_addressed_by_code(self):
        r = self.by_id["500012"]
        self.assertEqual(r["exchanges"], ["BSE"])
        self.assertIsNone(r["nse"])

    def test_same_ticker_different_isin_stays_two_companies(self):
        # NSE "ANDHRA" and BSE scrip ID "ANDHRA" are different entities: never merged
        self.assertEqual(self.by_id["ANDHRA"]["exchanges"], ["NSE"])
        self.assertEqual(self.by_id["500012"]["name"], "Andhra Petrochemicals Ltd")

    def test_every_listing_counted_once(self):
        # 4 on NSE (one also on BSE) + 3 only on BSE
        self.assertEqual(len(self.rows), 7)
        self.assertEqual(self.by_id["SMEONE"]["nse"]["board"], "sme")
        self.assertEqual(self.by_id["543000"]["bse"]["board"], "sme")
        self.assertEqual(self.by_id["512000"]["bse"]["status"], "suspended")


class ResolveTests(unittest.TestCase):
    def setUp(self):
        rows = listings.build(NSE_MAIN, NSE_SME, BSE_MASTER)
        patcher = mock.patch.object(listings, "all_listings", return_value=rows)
        patcher.start()
        self.addCleanup(patcher.stop)
        listings.CACHE.clear()

    def test_nse_symbol_wins_over_a_colliding_bse_scrip_id(self):
        self.assertEqual(listings.resolve("ANDHRA")["id"], "ANDHRA")

    def test_exchange_routing(self):
        self.assertEqual(listings.exchange_for("500012"), "BSE")
        self.assertEqual(listings.exchange_for("RELIANCE", "BSE"), "BSE")
        self.assertEqual(listings.exchange_for("ONLYNSE", "BSE"), "NSE")  # not on BSE: priced where it trades
        self.assertEqual(listings.bse_code("RELIANCE"), "500325")
        self.assertIsNone(listings.bse_code("ONLYNSE"))

    def test_yahoo_ticker_uses_bse_scrip_id_not_code(self):
        self.assertEqual(yahoo.to_yahoo_symbol("500012"), "ANDHRA.BO")
        self.assertEqual(yahoo.to_yahoo_symbol("RELIANCE", "BSE"), "RELIANCE.BO")
        self.assertEqual(yahoo.to_yahoo_symbol("RELIANCE"), "RELIANCE.NS")

    def test_search_finds_bse_only_names_and_codes(self):
        self.assertEqual(listings.search("andhra petro")[0]["id"], "500012")
        self.assertEqual(listings.search("500325")[0]["id"], "RELIANCE")


class BseUnitTests(unittest.TestCase):
    def test_scaled_reads_the_unit_label(self):
        self.assertEqual(bse._scaled("498.52", "(Cr.)"), 498.52e7)
        self.assertAlmostEqual(bse._scaled("10.55", "(Lakh)"), 10.55e5)
        self.assertEqual(bse._scaled("1,234", ""), 1234.0)

    def test_unknown_unit_is_blank_not_guessed(self):
        self.assertIsNone(bse._scaled("5", "(Million)"))

    def test_code_detection(self):
        self.assertTrue(bse.is_code("500325"))
        self.assertFalse(bse.is_code("RELIANCE"))
        self.assertFalse(bse.is_code("12345"))


if __name__ == "__main__":
    unittest.main()
