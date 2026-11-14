"""Fund screener: schemes, NAVs and returns come from AMFI's files; nothing is stored in the code."""

from __future__ import annotations

import unittest
from datetime import date
from unittest.mock import patch

from app.services import funds_live

try:
    from starlette.testclient import TestClient

    from app.cache import CACHE
    from app.main import app

    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False

CURRENT = """Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date

Open Ended Schemes(Equity Scheme - Large Cap Fund)

Alpha Mutual Fund

1001;INF000A01011;-;Alpha Large Cap Fund;Direct Plan;Growth Option;121.0000;13-Nov-2026
1002;INF000A01029;-;Alpha Large Cap Fund;Direct Plan;IDCW Option;40.0000;13-Nov-2026
1003;INF000A01037;-;Alpha Large Cap Fund;Regular Plan;Growth Option;110.0000;13-Nov-2026

Beta Mutual Fund

2001;INF000B01019;-;Beta Bluechip Fund;Direct Plan;Growth Option;50.0000;13-Nov-2026
2002;INF000B01027;-;Beta Closed Fund;Direct Plan;Growth Option;10.0000;01-Jan-2020
2003;INF000B01035;-;Beta Odd Fund;Direct Plan;Growth Option;N.A.;13-Nov-2026

Open Ended Schemes(Debt Scheme - Liquid Fund)

Alpha Mutual Fund

1010;INF000A01102;-;Alpha Liquid Fund;Direct Plan;Growth Option;3000.0000;13-Nov-2026
"""

HISTORY_1Y = """Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date

Open Ended Schemes ( Equity Scheme - Large Cap Fund )

Alpha Mutual Fund
1001;Alpha Large Cap Fund - Direct Plan - Growth;;Growth;;;100.0000;11-Nov-2025
1001;Alpha Large Cap Fund - Direct Plan - Growth;;Growth;;;110.0000;13-Nov-2025
1002;Alpha Large Cap Fund - Direct Plan - IDCW;;IDCW;;;45.0000;13-Nov-2025
"""

HISTORY_3Y = HISTORY_1Y.replace("2025", "2023").replace("110.0000", "90.9091").replace("100.0000", "80.0000")


def get_text(url: str) -> str:
    if url == funds_live.CURRENT_URL:
        return CURRENT
    if "2025" in url:
        return HISTORY_1Y
    if "2023" in url:
        return HISTORY_3Y
    raise RuntimeError("AMFI history not reachable")  # the five-year file


class ParseTests(unittest.TestCase):
    def test_schemes_carry_their_section_and_fund_house(self):
        schemes = {s["schemeCode"]: s for s in funds_live.parse(CURRENT)}
        alpha = schemes["1001"]
        self.assertEqual((alpha["amc"], alpha["category"], alpha["subCategory"]), ("Alpha Mutual Fund", "Equity", "Large Cap Fund"))
        self.assertEqual((alpha["plan"], alpha["option"], alpha["nav"], alpha["navDate"]), ("Direct", "Growth", 121.0, "2026-11-13"))
        self.assertEqual(schemes["2001"]["amc"], "Beta Mutual Fund")
        self.assertEqual((schemes["1010"]["category"], schemes["1010"]["subCategory"]), ("Debt", "Liquid Fund"))
        self.assertNotIn("2003", schemes)  # no NAV published

    def test_history_file_has_a_different_column_order(self):
        rows = funds_live.parse(HISTORY_1Y)
        self.assertEqual([(r["schemeCode"], r["nav"], r["navDate"]) for r in rows][:2], [("1001", 100.0, "2025-11-11"), ("1001", 110.0, "2025-11-13")])
        self.assertEqual(rows[0]["option"], "Growth")

    def test_unrecognised_file_is_an_error(self):
        with self.assertRaises(ValueError):
            funds_live.parse("<html>Service unavailable</html>")


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.data = funds_live.build(get_text, today=date(2026, 11, 14))
        self.by_code = {s["schemeCode"]: s for s in self.data["schemes"]}

    def test_returns_are_nav_to_nav_from_the_latest_past_nav(self):
        alpha = self.by_code["1001"]
        self.assertEqual(alpha["return1yPct"], 10.0)   # 121 / 110, the NAV closest to a year ago
        self.assertEqual(alpha["cagr3yPct"], 10.0)     # 121 / 90.9091 over three years
        self.assertIsNone(alpha["cagr5yPct"])          # that file could not be fetched
        self.assertEqual(self.data["returnsMissingFor"], ["cagr5yPct"])

    def test_idcw_options_and_schemes_with_no_history_get_no_return(self):
        self.assertIsNone(self.by_code["1002"]["return1yPct"])
        self.assertIsNone(self.by_code["2001"]["return1yPct"])

    def test_stale_schemes_are_dropped(self):
        self.assertNotIn("2002", self.by_code)
        self.assertEqual(self.data["totalSchemes"], 5)

    def test_filters_and_sorting(self):
        rows = funds_live.screen(self.data["schemes"], category="Equity", plan="Direct", option="Growth", sort="return1yPct")
        self.assertEqual([r["schemeCode"] for r in rows], ["1001", "2001"])  # the scheme with no return sorts last
        self.assertEqual([r["schemeCode"] for r in funds_live.screen(self.data["schemes"], query="liquid")], ["1010"])
        self.assertEqual(len(funds_live.screen(self.data["schemes"], amc="beta")), 1)
        self.assertEqual(self.data["categories"], {"Debt": ["Liquid Fund"], "Equity": ["Large Cap Fund"]})

    def test_gaps_are_declared_and_nothing_is_stored(self):
        for key in ("aum", "expenseRatio", "riskRatios", "holdings"):
            self.assertIn(key, self.data["unavailable"])
        self.assertFalse(hasattr(funds_live, "BASELINE_FUNDS"))

    def test_unreadable_current_file_is_unavailable(self):
        def broken(url):
            raise RuntimeError("blocked")

        with self.assertRaises(funds_live.FundDataUnavailable):
            funds_live.build(broken)


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class EndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_screener_route(self):
        CACHE.expire("funds:amfi:v1")
        self.addCleanup(CACHE.expire, "funds:amfi:v1")
        with patch.object(funds_live, "fetch", side_effect=lambda: funds_live.build(get_text, today=date(2026, 11, 14))):
            res = self.client.get("/api/v1/funds/screener?category=Equity&sort=return1yPct")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual([s["schemeCode"] for s in data["schemes"]], ["1001", "2001"])
        self.assertEqual((data["matched"], data["totalSchemes"]), (2, 5))

    def test_overlap_is_not_offered(self):
        res = self.client.get("/api/v1/funds/overlap")
        self.assertEqual(res.status_code, 404)
        self.assertIn("no data source is connected", res.json()["detail"])


if __name__ == "__main__":
    unittest.main()
