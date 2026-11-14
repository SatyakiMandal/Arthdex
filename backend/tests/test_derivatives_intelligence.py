"""
Unit tests for Derivatives Intelligence:
- Participant OI Analytics (FII, DII, Pro, Client)
- Multi-Leg Options Strategy Payoff Calculator & Black-Scholes Greeks
- Implied Volatility Surface, 25-Delta Skew & SVI Model
"""

import unittest
from app.services import fno_participants, options_strategy, volatility_surface


class TestDerivativesIntelligence(unittest.TestCase):
    def test_options_strategy_payoff(self):
        """Bull Call Spread payoff calculates net debit, capped profit, and defined risk."""
        legs = [
            {"action": "buy", "type": "CE", "strike": 24500, "premium": 180.0, "contracts": 1, "iv": 0.135},
            {"action": "sell", "type": "CE", "strike": 24700, "premium": 80.0, "contracts": 1, "iv": 0.130},
        ]
        res = options_strategy.build_options_strategy_payoff(
            symbol="NIFTY",
            spot_price=24500.0,
            lot_size=50,
            legs=legs,
            days_to_expiry=7,
        )

        self.assertEqual(res["symbol"], "NIFTY")
        self.assertTrue(res["isDebit"])
        # Net debit paid per lot = (180 - 80) * 50 = 5000
        self.assertAlmostEqual(res["netCashFlow"], -5000.0, places=1)
        self.assertEqual(res["maxLoss"], 5000.0)
        # Max profit = (200 spread - 100 net debit) * 50 = 5000.0
        self.assertEqual(res["maxProfit"], 5000.0)
        # Breakeven = 24500 + 100 = 24600
        self.assertTrue(any(abs(b - 24600.0) < 5.0 for b in res["breakevens"]))
        self.assertIn("netDelta", res["greeks"])
        self.assertTrue(len(res["points"]) > 50)

    def _chain(self, expiry, spot, skew):
        """A chain whose put-side volatility rises by `skew` points per 100 below spot."""
        rows = []
        for strike in range(int(spot) - 1000, int(spot) + 1001, 50):
            iv = 12.0 + max(0.0, (spot - strike) / 100.0) * skew + max(0.0, (strike - spot) / 100.0) * 0.1
            leg = {"iv": round(iv, 4)}
            rows.append({"strike": float(strike), "ce": leg if strike >= spot else None, "pe": leg if strike <= spot else None})
        return {"symbol": "TEST", "expiry": expiry, "underlying": spot, "timestamp": "13-Nov-2026 15:30:00", "rows": rows}

    def test_volatility_surface_is_read_from_the_chains(self):
        from datetime import date

        today = date(2026, 11, 14)
        chains = [self._chain("2026-11-17", 25000.0, 0.5), self._chain("2026-12-29", 25000.0, 0.5)]
        data = volatility_surface.build("test", chains, today)
        self.assertEqual((data["symbol"], data["spotPrice"]), ("TEST", 25000.0))
        self.assertEqual([t["daysToExpiry"] for t in data["termStructure"]], [3, 45])
        self.assertEqual(data["skewSummary"]["nearAtmIv"], 12.0)
        atm = next(r for r in data["surface"] if r["isAtm"])
        self.assertEqual(atm["strike"], 25000.0)
        self.assertEqual(atm[data["termStructure"][0]["label"]], 12.0)
        below = next(r for r in data["surface"] if r["strike"] == 24000.0)
        self.assertEqual(below[data["termStructure"][0]["label"]], 17.0)  # 12 + 10 x 0.5, straight from the chain
        self.assertGreater(data["skewSummary"]["riskReversal25D"], 0)  # puts dearer than calls in this chain
        self.assertLessEqual(len(data["surface"]), volatility_surface.MAX_ROWS + 1)

    def test_strike_missing_in_a_far_expiry_is_blank(self):
        from datetime import date

        near = self._chain("2026-11-17", 25000.0, 0.5)
        far = self._chain("2026-12-29", 25000.0, 0.5)
        far["rows"] = [r for r in far["rows"] if r["strike"] != 24000.0]
        data = volatility_surface.build("TEST", [near, far], date(2026, 11, 14))
        row = next(r for r in data["surface"] if r["strike"] == 24000.0)
        self.assertIsNone(row[data["termStructure"][1]["label"]])

    def test_no_quoted_volatility_means_unavailable(self):
        from datetime import date

        empty = {"symbol": "X", "expiry": "2026-11-17", "underlying": 100.0, "rows": [{"strike": 100.0, "ce": {"iv": None}, "pe": None}]}
        with self.assertRaises(volatility_surface.VolSurfaceUnavailable):
            volatility_surface.build("X", [empty], date(2026, 11, 14))
        with self.assertRaises(volatility_surface.VolSurfaceUnavailable):
            volatility_surface.build("X", [], date(2026, 11, 14))

    def test_interpolation_stays_between_quoted_strikes(self):
        points = [(100.0, 20.0), (110.0, 30.0)]
        self.assertEqual(volatility_surface.iv_at(points, 105.0), 25.0)
        self.assertEqual(volatility_surface.iv_at(points, 100.0), 20.0)
        self.assertIsNone(volatility_surface.iv_at(points, 95.0))
        self.assertIsNone(volatility_surface.iv_at(points, 120.0))


if __name__ == "__main__":
    unittest.main()
