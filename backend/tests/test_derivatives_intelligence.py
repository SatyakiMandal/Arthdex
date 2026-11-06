"""
Unit tests for Derivatives Intelligence:
- Participant OI Analytics (FII, DII, Pro, Client)
- Multi-Leg Options Strategy Payoff Calculator & Black-Scholes Greeks
- Implied Volatility Surface, 25-Delta Skew & SVI Model
"""

import unittest
from app.services import fno_participants, options_strategy, volatility_surface


class TestDerivativesIntelligence(unittest.TestCase):
    def test_participant_oi_overview(self):
        """Participant OI overview computes institutional metrics and sentiment classification."""
        data = fno_participants.get_participant_oi_overview()
        self.assertIn("fiiIndexLongPct", data)
        self.assertIn("fiiNetIndexContracts", data)
        self.assertIn("marketRegime", data)
        self.assertIn("participants", data)
        self.assertEqual(len(data["participants"]), 4)

        fii = next(p for p in data["participants"] if p["participant"] == "FII")
        self.assertEqual(fii["label"], "Foreign Institutional Investors")
        self.assertTrue(fii["indexFutures"]["net"] < 0)  # Institutional short bias baseline

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

    def test_volatility_surface(self):
        """Volatility surface computes 25D Risk Reversal, Term Structure, and Strike matrix."""
        data = volatility_surface.build_volatility_surface("NIFTY")
        self.assertEqual(data["symbol"], "NIFTY")
        self.assertIn("skewSummary", data)
        self.assertIn("termStructure", data)
        self.assertIn("surface", data)

        skew = data["skewSummary"]
        # Downside put skew should be positive in RR25 (IV Put 25D > IV Call 25D)
        self.assertTrue(skew["riskReversal25D"] > 0)
        self.assertEqual(len(data["termStructure"]), 4)
        self.assertTrue(len(data["surface"]) > 5)


if __name__ == "__main__":
    unittest.main()
