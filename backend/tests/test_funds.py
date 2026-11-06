"""
Unit tests for Mutual Funds & AMFI Master:
- Scheme master and category filtering
- Pairwise portfolio overlap calculation
"""

import unittest
from app.services import funds


class TestFundsService(unittest.TestCase):
    def test_funds_overview(self):
        """Funds screener returns active schemes with CAGRs and ratios."""
        data = funds.get_funds_overview()
        self.assertIn("funds", data)
        self.assertIn("categories", data)
        self.assertGreater(data["totalSchemes"], 0)

        ppfas = next(f for f in data["funds"] if f["schemeCode"] == "122639")
        self.assertEqual(ppfas["amc"], "PPFAS Mutual Fund")
        self.assertGreater(ppfas["returns3y"], 15.0)
        self.assertGreater(ppfas["aumCr"], 10000.0)

    def test_portfolio_overlap(self):
        """Portfolio overlap computes common holdings and min-weight overlap sum."""
        # PPFAS Flexi Cap vs HDFC Flexi Cap
        res = funds.calculate_portfolio_overlap("122639", "118989")
        self.assertIn("totalOverlapPct", res)
        self.assertIn("commonHoldingsCount", res)
        self.assertGreater(res["totalOverlapPct"], 0.0)
        # HDFC Bank and ICICI Bank should be common holdings
        common_symbols = [h["symbol"] for h in res["holdings"]]
        self.assertIn("HDFCBANK", common_symbols)
        self.assertIn("ICICIBANK", common_symbols)


if __name__ == "__main__":
    unittest.main()
