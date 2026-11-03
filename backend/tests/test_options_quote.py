import unittest
from datetime import date
from unittest import mock

from app.providers import nse
from app.services import options


class ExDateQuoteTests(unittest.TestCase):
    def test_change_is_measured_from_the_adjusted_base(self):
        # Infosys ex-dividend on 3 Nov 2026: close 1,161, base 1,135, last 1,148.10
        payload = {"equityResponse": [{
            "metaData": {"previousClose": 1161, "basePrice": 1135, "closePrice": 1148.1, "isinCode": "X", "companyName": "Infosys"},
            "tradeInfo": {"lastPrice": 1148.1}, "priceInfo": {}, "secInfo": {},
        }]}
        with mock.patch.object(nse, "nse_get", return_value=payload):
            q = nse.fetch_quote("INFY")
        self.assertEqual(q["change"]["percent"], 1.15)
        self.assertEqual(q["adjustedBase"], 1135)
        self.assertEqual(q["previousClose"], 1161)

    def test_ordinary_day_has_no_adjusted_base(self):
        payload = {"equityResponse": [{
            "metaData": {"previousClose": 2501.7, "basePrice": 2501.7, "closePrice": 2499.1},
            "tradeInfo": {"lastPrice": 2499.1}, "priceInfo": {}, "secInfo": {},
        }]}
        with mock.patch.object(nse, "nse_get", return_value=payload):
            q = nse.fetch_quote("TCS")
        self.assertIsNone(q["adjustedBase"])
        self.assertEqual(q["change"]["percent"], -0.1)


def leg(ltp, oi, iv=15.0):
    return {"ltp": ltp, "oi": oi, "oiChange": 0, "volume": 0, "iv": iv, "bid": None, "ask": None, "change": 0}


class OptionsTests(unittest.TestCase):
    CHAIN = {
        "symbol": "NIFTY", "expiry": "2026-11-09", "underlying": 100.0, "timestamp": "x",
        "rows": [
            {"strike": 90.0, "ce": leg(10.5, 10), "pe": leg(0.4, 500)},
            {"strike": 100.0, "ce": leg(2.2, 300), "pe": leg(2.0, 300)},
            {"strike": 110.0, "ce": leg(0.3, 600), "pe": leg(10.2, 20)},
        ],
        "nseTotals": {"ceOi": 910, "peOi": 820},
    }

    def test_summary_figures(self):
        a = options.analyse(self.CHAIN, 100.0, today=date(2026, 11, 4))
        self.assertEqual(a["atmStrike"], 100.0)
        self.assertEqual(a["pcr"], round(820 / 910, 2))
        self.assertEqual(a["resistance"][0]["strike"], 110.0)
        self.assertEqual(a["support"][0]["strike"], 90.0)
        self.assertEqual(a["impliedMove"]["points"], 4.2)
        self.assertTrue(a["vetting"]["ok"])

    def test_max_pain_is_the_cheapest_settlement_for_writers(self):
        self.assertEqual(options.max_pain(self.CHAIN["rows"]), 100.0)

    def test_totals_mismatch_fails_vetting(self):
        chain = dict(self.CHAIN, nseTotals={"ceOi": 999, "peOi": 820})
        a = options.analyse(chain, 100.0, today=date(2026, 11, 4))
        self.assertFalse(a["vetting"]["ok"])

    def test_greeks_signs(self):
        c = options.greeks("ce", 100, 100, 0.05, 20)
        p = options.greeks("pe", 100, 100, 0.05, 20)
        self.assertTrue(0 < c["delta"] < 1 and -1 < p["delta"] < 0)
        self.assertLess(c["theta"], 0)
        self.assertAlmostEqual(c["gamma"], p["gamma"], places=6)

    def test_build_up_quadrants(self):
        spurts = [{"symbol": s, "oiChange": oi, "oiChangePct": 5} for s, oi in (("A", 10), ("B", 10), ("C", -10), ("D", -10))]
        out = options.build_up(spurts, {"A": 1.0, "B": -1.0, "C": 1.0, "D": -1.0})
        self.assertEqual([x["symbol"] for x in out["buckets"]["longBuildUp"]], ["A"])
        self.assertEqual([x["symbol"] for x in out["buckets"]["shortBuildUp"]], ["B"])
        self.assertEqual([x["symbol"] for x in out["buckets"]["shortCovering"]], ["C"])
        self.assertEqual([x["symbol"] for x in out["buckets"]["longUnwinding"]], ["D"])


if __name__ == "__main__":
    unittest.main()
