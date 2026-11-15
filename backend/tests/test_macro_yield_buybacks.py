"""Macro, yield-curve and buyback desks: parsers of the publishing bodies' own data, tested on fixed samples."""

from __future__ import annotations

import unittest
from datetime import date
from unittest.mock import patch

from app.services import buybacks_live, macro_live, sme_live, yield_curve_live

try:
    from starlette.testclient import TestClient

    from app.cache import CACHE
    from app.main import app

    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False

CPI = {"data": [
    {"year": 2025, "month": "December", "index": "198.0", "inflation": "1.33"},
    {"year": 2025, "month": "November", "index": "197.9", "inflation": "0.71"},
    {"year": 2026, "month": "January", "index": "198.4", "inflation": "1.90"},
]}
IIP = {"data": [
    {"year": 2026, "month": "March", "index": "173.2", "growth_rate": "4.1"},
    {"year": 2026, "month": "February", "index": "158.8", "growth_rate": "5.1"},
]}
GDP = {"data": [
    {"base_year": "2022-23", "year": "2026-27", "quarter": "Q1", "current_price": "8826871", "constant_price": "8136153"},
    {"base_year": "2022-23", "year": "2025-26", "quarter": "Q1", "current_price": "8000192", "constant_price": "7546230"},
    {"base_year": "2022-23", "year": "2025-26", "quarter": "Q4", "current_price": "9467047", "constant_price": "8880334"},
    # an older base for the same quarter: not comparable with the rows above
    {"base_year": "2011-12", "year": "2025-26", "quarter": "Q1", "current_price": "7000000", "constant_price": "4788000"},
    {"base_year": "2011-12", "year": "2024-25", "quarter": "Q1", "current_price": "6500000", "constant_price": "4500000"},
]}
RBI_PAGE = """<div>Policy&nbsp; Rates <ul><li>Policy Repo Rate : 5.50%</li><li>Standing Deposit Facility Rate : 5.25%</li>
<li>Marginal Standing Facility Rate : 5.75%</li><li>Bank Rate : 5.75%</li><li>Fixed Reverse Repo Rate : 3.35%</li></ul>
Reserve &nbsp;Ratios <ul><li>CRR : 3.00%</li><li>SLR : 18.00%</li></ul></div>"""

CCIL_PAGE = """<html><table><tr><th>Date</th><th>Tenor Bucket</th><th>Security</th><th>YTM (%)</th></tr>
<tr><td>2026-11-13 00:00:00.0</td><td>91D</td><td>91 DTB (11/02/2027)</td><td>5.8681</td></tr>
<tr><td>2026-11-13 00:00:00.0</td><td>1Y-2Y</td><td>7.06% GS 2028</td><td>6.6841</td></tr>
<tr><td>2026-11-13 00:00:00.0</td><td>9Y-10Y</td><td>6.94% GS 2036</td><td>7.3069</td></tr>
<tr><td>2026-11-13 00:00:00.0</td><td>28Y-30Y</td><td>7.24% GS 2055</td><td>7.7589</td></tr>
<tr><td>2026-11-13 00:00:00.0</td><td>10Y</td><td>7.82% GUJARAT SGS 2036</td><td>7.82</td></tr>
<tr><td>2026-11-13 00:00:00.0</td><td>ODD</td><td>Unknown bucket GS</td><td>7.00</td></tr>
</table></html>"""

ACTIONS = [
    {"symbol": "GLOBAL", "comp": "Global Education Limited", "subject": "Buy Back", "series": "EQ", "faceVal": "2", "exDate": "18-Nov-2026", "recDate": "18-Nov-2026"},
    {"symbol": "OLDBB", "comp": "Old Buyback Limited", "subject": "Buyback", "series": "EQ", "faceVal": "10", "exDate": "01-Nov-2026", "recDate": "01-Nov-2026"},
    {"symbol": "DIV", "comp": "Dividend Co", "subject": "Dividend - Rs 5 Per Share", "exDate": "20-Nov-2026", "recDate": "20-Nov-2026"},
]


class MacroTests(unittest.TestCase):
    def test_cpi_takes_the_latest_month_as_published(self):
        cpi = macro_live.parse_cpi(CPI)
        self.assertEqual((cpi["period"], cpi["value"], cpi["previous"]), ("January 2026", 1.9, 1.33))
        self.assertEqual([p["period"] for p in cpi["series"]], ["November 2025", "December 2025", "January 2026"])

    def test_iip_growth_is_the_published_rate(self):
        iip = macro_live.parse_iip(IIP)
        self.assertEqual((iip["period"], iip["value"], iip["previous"]), ("March 2026", 4.1, 5.1))

    def test_gdp_growth_is_computed_within_one_base_year(self):
        gdp = macro_live.parse_gdp(GDP)
        self.assertEqual(gdp["period"], "Q1 2026-27")
        self.assertEqual(gdp["value"], round((8136153 / 7546230 - 1) * 100, 2))  # 7.82, not a cross-base figure
        self.assertIn("base 2022-23", gdp["detail"])

    def test_gdp_without_a_year_ago_quarter_is_an_error(self):
        with self.assertRaises(ValueError):
            macro_live.parse_gdp({"data": GDP["data"][:1]})

    def test_rbi_rates_are_read_from_the_panel(self):
        rates = macro_live.parse_rbi_rates(RBI_PAGE)
        self.assertEqual(rates, {"repo": 5.5, "sdf": 5.25, "msf": 5.75, "bankRate": 5.75, "reverseRepo": 3.35, "crr": 3.0, "slr": 18.0})
        with self.assertRaises(ValueError):
            macro_live.parse_rbi_rates("<html>maintenance</html>")

    def test_one_failed_source_is_named_and_the_rest_load(self):
        def get_json(url):
            if "cpi" in url:
                raise RuntimeError("timeout")
            return IIP if "iip" in url else GDP

        out = macro_live.build(get_json, lambda url: RBI_PAGE)
        self.assertEqual([i["id"] for i in out["indicators"]], ["gdp", "iip"])
        self.assertIn("cpi", out["unavailable"])
        self.assertIn("wpi", out["unavailable"])
        self.assertEqual(out["policyRates"]["repo"], 5.5)

    def test_nothing_answering_is_an_error(self):
        def broken(url):
            raise RuntimeError("down")

        with self.assertRaises(ValueError):
            macro_live.build(broken, broken)


class YieldCurveTests(unittest.TestCase):
    def test_table_rows_are_read(self):
        rows = yield_curve_live.parse(CCIL_PAGE)
        self.assertEqual(len(rows), 6)
        self.assertEqual(rows[0], {"date": "2026-11-13", "bucket": "91D", "security": "91 DTB (11/02/2027)", "yieldPct": 5.8681})
        with self.assertRaises(ValueError):
            yield_curve_live.parse("<html>no table</html>")

    def test_curve_points_and_spreads(self):
        out = yield_curve_live.build(yield_curve_live.parse(CCIL_PAGE), {"repo": 5.5})
        self.assertEqual([(p["tenor"], p["yieldPct"]) for p in out["curve"]], [("3M", 5.8681), ("2Y", 6.6841), ("10Y", 7.3069), ("30Y", 7.7589)])
        self.assertEqual(out["curve"][0]["kind"], "Treasury bill")
        self.assertEqual(out["stateBonds"], [{"tenor": "10Y", "security": "7.82% GUJARAT SGS 2036", "yieldPct": 7.82}])
        spreads = {s["label"]: s["bps"] for s in out["spreads"]}
        self.assertEqual(spreads["10Y minus 2Y"], 62.3)
        self.assertEqual(spreads["10Y minus policy repo rate"], 180.7)
        self.assertNotIn("10Y minus 5Y", spreads)  # there is no 5Y point, so no spread is invented
        self.assertEqual(out["asOf"], "2026-11-13")

    def test_curve_without_policy_rates(self):
        out = yield_curve_live.build(yield_curve_live.parse(CCIL_PAGE), None)
        self.assertNotIn("10Y minus policy repo rate", {s["label"] for s in out["spreads"]})


class BuybackTests(unittest.TestCase):
    def test_only_buybacks_with_their_dates(self):
        out = buybacks_live.build(ACTIONS, today=date(2026, 11, 15))
        self.assertEqual([b["symbol"] for b in out["buybacks"]], ["GLOBAL", "OLDBB"])
        first = out["buybacks"][0]
        self.assertEqual((first["recordDate"], first["daysToRecordDate"], first["status"]), ("2026-11-18", 3, "UPCOMING"))
        self.assertEqual(out["buybacks"][1]["status"], "PAST")
        self.assertEqual((out["count"], out["upcomingCount"]), (2, 1))
        self.assertNotIn("offerPrice", first)
        self.assertIn("Offer price", out["notShown"])

    def test_empty_list(self):
        self.assertEqual(buybacks_live.build([], today=date(2026, 11, 15))["buybacks"], [])


class SmeMasterTests(unittest.TestCase):
    def test_names_from_the_master_list(self):
        text = "SYMBOL,NAME_OF_COMPANY,SERIES,DATE_OF_LISTING,PAID_UP_VALUE,ISIN_NUMBER,FACE_VALUE,\nVPFL,Vedant Poly Fabs Limited,ST,09-Nov-26,10,INE2RWX01016,10,\n"
        self.assertEqual(sme_live.parse_master(text), [{"symbol": "VPFL", "name": "Vedant Poly Fabs Limited"}])
        with self.assertRaises(ValueError):
            sme_live.parse_master("<html>blocked</html>")


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class RouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _fresh(self, key):
        CACHE.expire(key)
        self.addCleanup(CACHE.expire, key)

    def test_macro_dashboard(self):
        self._fresh("macro:dashboard:v2")
        sample = macro_live.build(lambda url: CPI if "cpi" in url else IIP if "iip" in url else GDP, lambda url: RBI_PAGE)
        with patch.object(macro_live, "fetch", return_value=sample):
            res = self.client.get("/api/v1/macro/dashboard")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["policyRates"]["repo"], 5.5)

    def test_yield_curve(self):
        self._fresh("market:yield-curve:v2")
        sample = yield_curve_live.build(yield_curve_live.parse(CCIL_PAGE), {"repo": 5.5})
        with patch.object(yield_curve_live, "fetch", return_value=sample):
            res = self.client.get("/api/v1/market/yield-curve")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["data"]["curve"]), 4)

    def test_buybacks(self):
        self._fresh("catalysts:buybacks:v2")
        with patch("app.routers.catalysts.nse.nse_get", return_value=ACTIONS):
            res = self.client.get("/api/v1/catalysts/buybacks")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["count"], 2)

    def test_source_failure_is_a_503(self):
        self._fresh("macro:dashboard:v2")
        CACHE._data.pop("macro:dashboard:v2", None) if hasattr(CACHE, "_data") else None
        with patch.object(macro_live, "fetch", side_effect=ValueError("neither MOSPI nor RBI answered")):
            res = self.client.get("/api/v1/macro/dashboard")
        self.assertEqual(res.status_code, 503)


if __name__ == "__main__":
    unittest.main()
