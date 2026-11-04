"""Unit tests for Phase 1: Portfolio Analytics (XIRR & Section 112A Tax Harvesting) and Catalysts (Index Rebalance, IPO Lock-in, Buybacks)."""

from datetime import date, timedelta
import unittest
from unittest.mock import patch

from app.services import buyback_arbitrage, index_rebalance, ipo_lockin, portfolio_analytics


class PortfolioAnalyticsTests(unittest.TestCase):
    def test_xirr_exact_one_year_return(self):
        # Invest ₹10,000 on 2024-01-01, receives ₹12,000 on 2025-01-01
        flows = [(date(2024, 1, 1), -10000.0), (date(2025, 1, 1), 12000.0)]
        xirr = portfolio_analytics.calculate_xirr(flows)
        self.assertIsNotNone(xirr)
        # 366 days in leap year 2024, return ~19.9% - 20.0%
        self.assertAlmostEqual(xirr, 20.0, delta=0.5)

    def test_xirr_all_positive_or_negative_returns_none(self):
        # Invalid cash flows with no sign changes
        self.assertIsNone(portfolio_analytics.calculate_xirr([(date(2024, 1, 1), -100.0)]))
        self.assertIsNone(
            portfolio_analytics.calculate_xirr(
                [(date(2024, 1, 1), 100.0), (date(2025, 1, 1), 200.0)]
            )
        )

    @patch("app.services.portfolio_analytics._get_live_price")
    @patch("app.providers.yahoo.fetch_profile")
    def test_tax_harvesting_budget2024_rates(self, mock_profile, mock_price):
        mock_price.return_value = 3000.0
        mock_profile.return_value = {"name": "TCS", "sector": "Technology"}

        today = date(2025, 3, 1)
        # Lot 1: Bought 100 days ago (STCG), at ₹3500 (Current ₹3000) -> Loss of ₹5,000 (10 shares)
        # Lot 2: Bought 400 days ago (LTCG), at ₹3500 (Current ₹3000) -> Loss of ₹5,000 (10 shares)
        holdings = [
            {
                "symbol": "TCS",
                "quantity": 10,
                "buyPrice": 3500.0,
                "buyDate": (today - timedelta(days=100)).isoformat(),
                "currentPrice": 3000.0,
            },
            {
                "symbol": "TCS",
                "quantity": 10,
                "buyPrice": 3500.0,
                "buyDate": (today - timedelta(days=400)).isoformat(),
                "currentPrice": 3000.0,
            },
        ]

        res = portfolio_analytics.analyze_portfolio(holdings, as_of=today)
        tax = res["taxHarvesting"]
        # STCG loss = 5000 * 20% = 1000 tax saving
        self.assertEqual(tax["stcg"]["unrealizedLosses"], 5000.0)
        # LTCG loss = 5000 * 12.5% = 625 tax saving
        self.assertEqual(tax["ltcg"]["unrealizedLosses"], 5000.0)
        self.assertEqual(tax["potentialTaxSavings"], 1625.0)

        # Opportunities should suggest peer replacements (e.g. INFY, HCLTECH)
        opps = tax["opportunities"]
        self.assertEqual(len(opps), 2)
        self.assertIn("INFY", opps[0]["recommendedSwaps"])


class IndexRebalanceTests(unittest.TestCase):
    @patch("app.services.quote_sources.fetch")
    def test_rebalance_prediction_flows(self, mock_fetch):
        mock_fetch.return_value = {"cmp": 280.0}
        data = index_rebalance.predict_rebalance(as_of=date(2025, 2, 10))
        self.assertIn("March", data["reviewName"])
        self.assertTrue(len(data["candidates"]) > 0)

        # Candidate should have estimated flows and days to cover
        c0 = data["candidates"][0]
        self.assertIn("estFlowCr", c0)
        self.assertIn("daysToCover", c0)
        self.assertTrue(c0["daysToCover"] > 0)


class IpoLockinTests(unittest.TestCase):
    @patch("app.services.quote_sources.fetch")
    def test_lockin_tranches_and_supply_ratio(self, mock_fetch):
        mock_fetch.return_value = {"cmp": 450.0}
        data = ipo_lockin.build_lockin_calendar(as_of=date(2025, 2, 1))
        self.assertTrue(data["totalEventsTracked"] > 0)
        e0 = data["events"][0]
        self.assertIn("lockinCategory", e0)
        self.assertIn("sharesUnlocking", e0)
        self.assertIn("supplyImpactRatio", e0)
        self.assertIn("riskLevel", e0)


class BuybackArbitrageTests(unittest.TestCase):
    @patch("app.services.quote_sources.fetch")
    def test_retail_arbitrage_scenarios(self, mock_fetch):
        mock_fetch.return_value = {"cmp": 4000.0}
        data = buyback_arbitrage.get_buyback_desk(as_of=date(2025, 2, 1))
        self.assertTrue(len(data["buybacks"]) > 0)
        bb0 = data["buybacks"][0]
        self.assertIn("arbitrageSimulation", bb0)
        sim = bb0["arbitrageSimulation"]
        if sim:
            self.assertEqual(sim["maxCapitalLimit"], 200000.0)
            self.assertEqual(len(sim["scenarios"]), 3)
            self.assertEqual(sim["scenarios"][0]["acceptanceRatioPct"], 20.0)


if __name__ == "__main__":
    unittest.main()
