"""The one-page summary: assembled from the company routes, with failures reported, never filled."""

import unittest
from unittest import mock

from app.services import tear_sheet


def env(data):
    return {"data": data}


class TearSheetTests(unittest.TestCase):
    def test_sections_come_from_the_company_routes(self):
        from app.routers import company

        candles = [{"date": "2025-11-01", "close": 100.0}, {"date": "2026-10-01", "close": 110.0}, {"date": "2026-11-01", "close": 120.0}]
        with mock.patch.multiple(
            company,
            get_quote=lambda s, e: env({"cmp": 120.0, "change": {"absolute": 1.0, "percent": 0.84}, "exchange": "NSE", "listing": {"isin": "INE000X01010", "exchanges": ["NSE"], "nse": {"symbol": "TESTCO"}, "bse": None}}),
            get_statistics=lambda s: env({"about": {"name": "Test Co"}, "valuation": {"trailingPE": 20.0}, "trading": {}, "dividends": {}}),
            get_financials=lambda s, e: env({"annual": [{"period": "FY26", "periodEnd": "2026-03-31", "revenue": 10.0}], "ratios": None, "sources": {"annual": {"used": "screener"}}}),
            get_peers=mock.Mock(side_effect=ValueError("No industry classification for TESTCO")),
            get_shareholding=lambda s: env({"pattern": {"quarterly": {"labels": ["Sep 2026"], "promoters": [50.0], "fiis": [20.0], "diis": [10.0], "government": [0.0], "public": [20.0]}}, "analytics": {}}),
            get_analysts=mock.Mock(side_effect=ValueError("No analyst coverage")),
            get_candles=lambda s, p, e: env({"candles": candles}),
        ):
            d = tear_sheet.get_company_tear_sheet("TESTCO")
        self.assertEqual(d["header"]["name"], "Test Co")
        self.assertEqual(d["price"]["cmp"], 120.0)
        self.assertEqual(d["returns"]["1M"], 9.09)
        self.assertIsNone(d["returns"]["5Y"])  # history does not reach back five years
        self.assertIsNone(d["peers"])
        self.assertIsNone(d["analysts"])
        self.assertEqual(set(d["missing"]), {"peers", "analysts"})
        self.assertEqual(d["shareholding"][0]["promoters"], 50.0)

    def test_notes_are_only_what_users_write(self):
        self.assertEqual(tear_sheet.get_research_notes_for_symbol("NEVERWRITTEN"), [])
        note = tear_sheet.add_research_note("TESTCO", "Thesis", "A. Reader", "Self", "HOLD", 100.0)
        self.assertEqual(tear_sheet.get_research_notes_for_symbol("TESTCO")[0]["id"], note["id"])


if __name__ == "__main__":
    unittest.main()
