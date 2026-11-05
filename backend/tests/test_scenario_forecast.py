"""
Unit tests for Multi-Algorithm Scenario Forecasting, AHCI Synthesis, and Execution Sizer.
"""

from __future__ import annotations

import unittest
import numpy as np
import pandas as pd

from app.services import scenario_forecast


class ScenarioForecastTests(unittest.TestCase):
    def setUp(self):
        # Generate 100 days of synthetic geometric random walk for deterministic unit tests
        np.random.seed(42)
        n = 120
        rets = np.random.normal(0.0005, 0.012, n)
        prices = 1000.0 * np.exp(np.cumsum(rets))
        highs = prices * (1.0 + np.abs(np.random.normal(0.005, 0.003, n)))
        lows = prices * (1.0 - np.abs(np.random.normal(0.005, 0.003, n)))
        volumes = np.random.randint(100000, 5000000, n)

        dates = pd.date_range("2026-01-01", periods=n, freq="B")
        self.df = pd.DataFrame(
            {
                "Open": prices * 0.998,
                "High": highs,
                "Low": lows,
                "Close": prices,
                "Volume": volumes,
            },
            index=dates,
        )
        self.spot = float(prices[-1])

    def test_merton_jump_diffusion_bounds(self):
        res = scenario_forecast.algo_merton_jump_diffusion(
            spot=self.spot, drift=0.10, vol=0.20, days=5, paths=5000
        )
        self.assertIsNotNone(res["bear"])
        self.assertIsNotNone(res["base"])
        self.assertIsNotNone(res["bull"])
        self.assertTrue(res["bear"] < res["base"] < res["bull"])
        self.assertTrue(res["bear_pct"] < 0)
        self.assertTrue(res["bull_pct"] > 0)

    def test_garch_volatility_projection(self):
        res = scenario_forecast.algo_garch_volatility(
            spot=self.spot, drift=0.10, current_vol=0.22, days=5
        )
        self.assertTrue(res["bear"] < res["base"] < res["bull"])
        self.assertIn("persistence", res["rationale"])

    def test_options_implied_straddle_move(self):
        chain = {
            "underlying": {
                "atm": 1000,
                "atmIv": 20.0,
                "straddle": 45.0,
            }
        }
        res = scenario_forecast.algo_options_implied(
            spot=self.spot, option_chain=chain, days=5
        )
        self.assertTrue(res["bear"] < res["base"] < res["bull"])
        self.assertIn("Live NSE Option Chain", res["rationale"])

    def test_orderflow_auction_market(self):
        of = {
            "poc": self.spot * 0.99,
            "valueAreaHigh": self.spot * 1.03,
            "valueAreaLow": self.spot * 0.97,
        }
        res = scenario_forecast.algo_orderflow_auction(
            spot=self.spot, of_data=of, df=self.df, days=5
        )
        self.assertTrue(res["bear"] < res["base"] < res["bull"])

    def test_holt_winters_atr_channels(self):
        res = scenario_forecast.algo_holt_winters_atr(
            spot=self.spot, df=self.df, atr_val=15.0, days=5
        )
        self.assertTrue(res["bear"] < res["base"] < res["bull"])

    def test_institutional_liquidity_matrix(self):
        res = scenario_forecast.algo_liquidity_matrix(
            spot=self.spot, df=self.df, days=5
        )
        self.assertTrue(res["bear"] < res["bull"])

    def test_hybrid_consensus_synthesis(self):
        m1 = scenario_forecast.algo_merton_jump_diffusion(self.spot, 0.1, 0.2, 5, 2000)
        m2 = scenario_forecast.algo_garch_volatility(self.spot, 0.1, 0.2, 5)
        m3 = scenario_forecast.algo_options_implied(self.spot, None, 5, 0.2)
        m4 = scenario_forecast.algo_orderflow_auction(self.spot, None, self.df, 5)
        m5 = scenario_forecast.algo_holt_winters_atr(self.spot, self.df, 15.0, 5)
        m6 = scenario_forecast.algo_liquidity_matrix(self.spot, self.df, 5)

        models = [m1, m2, m3, m4, m5, m6]
        consensus = scenario_forecast.synthesize_hybrid_consensus(self.spot, models)

        self.assertIn("consensus_bear", consensus)
        self.assertIn("consensus_base", consensus)
        self.assertIn("consensus_bull", consensus)
        self.assertTrue(
            consensus["consensus_bear"]
            < consensus["consensus_base"]
            < consensus["consensus_bull"]
        )
        self.assertIn("ahci_score", consensus)
        self.assertTrue(-100.0 <= consensus["ahci_score"] <= 100.0)
        self.assertIn(
            consensus["directional_bias"],
            [
                "STRONG ACCUMULATE",
                "ACCUMULATE ON DIPS",
                "NEUTRAL / CHOP",
                "TRIM / DEFENSIVE",
                "STRONG SHORT HEDGE",
            ],
        )

    def test_trade_execution_sizer(self):
        plan = scenario_forecast.generate_trade_execution_plan(
            spot=1000.0,
            consensus_bear=950.0,
            consensus_base=1040.0,
            consensus_bull=1100.0,
            atr_val=18.0,
            portfolio_capital=500000.0,
            risk_pct=1.0,
        )

        self.assertEqual(plan["portfolio_capital"], 500000.0)
        self.assertEqual(plan["risk_pct"], 1.0)
        self.assertEqual(plan["max_risk_inr"], 5000.0)
        self.assertTrue(plan["total_quantity"] > 0)
        self.assertTrue(plan["structural_stop_loss"] < plan["blended_entry"])
        self.assertTrue(plan["risk_reward_ratio"] >= 1.0)
        self.assertEqual(len(plan["buy_tranches"]), 2)
        self.assertEqual(len(plan["sell_tranches"]), 3)


if __name__ == "__main__":
    unittest.main()
