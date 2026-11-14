"""SME board: every row and aggregate comes from the exchange feed; nothing is hand-entered."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app.services import sme_live

try:
    from starlette.testclient import TestClient

    from app.cache import CACHE
    from app.main import app

    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False

TRADED = {
    "asOf": "13-Nov-2026 15:30:00",
    "rows": {
        "BIGSME": {"last": 800.0, "changePct": 4.0, "volume": 50_000, "turnoverCr": 4.0, "marketCapCr": 900.0, "series": "SM"},
        "MIDSME": {"last": 120.0, "changePct": -2.5, "volume": 20_000, "turnoverCr": 0.24, "marketCapCr": 180.0, "series": "SM"},
        "TINYSME": {"last": 40.0, "changePct": 0.0, "volume": 3_000, "turnoverCr": 0.01, "marketCapCr": 35.0, "series": "ST"},
        "NOCAP": {"last": 10.0, "changePct": 1.0, "volume": None, "turnoverCr": None, "marketCapCr": None, "series": "SM"},
        "MAINBOARD": {"last": 2400.0, "changePct": 1.0, "volume": 9_000_000, "turnoverCr": 2100.0, "marketCapCr": 880000.0, "series": "EQ"},
    },
}
UNIVERSE = [{"symbol": "BIGSME", "name": "Big SME Limited"}, {"symbol": "MAINBOARD", "name": "Mainboard Limited"}]
PIPELINE = {
    "issues": [
        {"symbol": "NEWSME", "segment": "sme", "status": "ongoing", "priceBandHigh": 120, "gmp": 40},
        {"symbol": "OLDSME", "segment": "sme", "status": "listed"},
        {"symbol": "BIGIPO", "segment": "mainboard", "status": "ongoing"},
    ]
}


class BoardTests(unittest.TestCase):
    def test_only_emerge_series_are_on_the_board(self):
        b = sme_live.board(TRADED, UNIVERSE)
        self.assertEqual([r["symbol"] for r in b["rows"]], ["BIGSME", "MIDSME", "TINYSME", "NOCAP"])
        self.assertEqual(b["count"], 4)
        self.assertEqual(b["rows"][0]["name"], "Big SME Limited")
        self.assertIsNone(b["rows"][1]["name"])  # not in the universe list: left blank, not invented

    def test_aggregates_are_sums_of_the_rows(self):
        b = sme_live.board(TRADED, UNIVERSE)
        self.assertEqual(b["totalMarketCapCr"], 1115.0)
        self.assertEqual(b["totalTurnoverCr"], 4.25)
        self.assertEqual(b["breadth"], {"advances": 2, "declines": 1, "unchanged": 1})
        self.assertEqual(b["marketCapTiers"], {"under100Cr": 1, "from100To250Cr": 1, "from250To500Cr": 0, "over500Cr": 1})
        self.assertEqual(b["gainers"][0]["symbol"], "BIGSME")
        self.assertEqual([r["symbol"] for r in b["losers"]], ["MIDSME"])
        self.assertEqual(b["mostTraded"][0]["symbol"], "BIGSME")

    def test_empty_feed_gives_an_empty_board(self):
        b = sme_live.board({"rows": {}, "asOf": None})
        self.assertEqual((b["count"], b["rows"], b["totalMarketCapCr"]), (0, [], None))

    def test_gaps_are_declared(self):
        b = sme_live.board(TRADED)
        for key in ("bseSme", "fundamentals", "migration", "greyMarketPremium"):
            self.assertIn(key, b["unavailable"])

    def test_screen_filters_and_sorts(self):
        rows = sme_live.board(TRADED)["rows"]
        self.assertEqual([r["symbol"] for r in sme_live.screen(rows, min_market_cap_cr=100)], ["BIGSME", "MIDSME"])
        self.assertEqual([r["symbol"] for r in sme_live.screen(rows, max_market_cap_cr=100)], ["TINYSME"])
        self.assertEqual(sme_live.screen(rows, sort="changePct")[0]["symbol"], "BIGSME")
        self.assertEqual(len(sme_live.screen(rows, limit=2)), 2)


class IpoTests(unittest.TestCase):
    def test_only_sme_issues_and_no_grey_market_field_added(self):
        out = sme_live.sme_ipos(PIPELINE)
        self.assertEqual([i["symbol"] for i in out["issues"]], ["NEWSME", "OLDSME"])
        self.assertEqual(out["counts"]["ongoing"], 1)
        self.assertIn("greyMarketPremium", out["unavailable"])
        self.assertEqual([i["symbol"] for i in sme_live.sme_ipos(PIPELINE, "listed")["issues"]], ["OLDSME"])

    def test_service_has_no_hand_entered_listings(self):
        for name in ("SME_ACTIVE_LISTINGS", "SME_IPO_PIPELINE", "MIGRATED_MAINBOARD_STARS"):
            self.assertFalse(hasattr(sme_live, name))


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class EndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        CACHE.expire("sme:board:v2")
        CACHE.expire("ipo:pipeline")
        self.addCleanup(CACHE.expire, "sme:board:v2")
        self.addCleanup(CACHE.expire, "ipo:pipeline")

    def test_overview_and_screener(self):
        with patch("app.routers.sme_markets.nse.fetch_stocks_traded", return_value=TRADED), \
             patch("app.routers.search.load_universe", return_value=(UNIVERSE, 0)):
            overview = self.client.get("/api/v1/sme/overview")
            screener = self.client.get("/api/v1/sme/screener?min_market_cap_cr=100&sort=changePct")
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.json()["data"]["count"], 4)
        self.assertNotIn("rows", overview.json()["data"])
        self.assertEqual(screener.status_code, 200)
        self.assertEqual([r["symbol"] for r in screener.json()["data"]["rows"]], ["BIGSME", "MIDSME"])

    def test_ipos(self):
        with patch("app.routers.sme_markets.ipo_service.build_pipeline", return_value=PIPELINE):
            res = self.client.get("/api/v1/sme/ipos?status=ongoing")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([i["symbol"] for i in res.json()["data"]["issues"]], ["NEWSME"])

    def test_migration_tracker_is_not_offered(self):
        res = self.client.get("/api/v1/sme/migrations")
        self.assertEqual(res.status_code, 404)
        self.assertIn("paid-up capital", res.json()["detail"])


if __name__ == "__main__":
    unittest.main()
