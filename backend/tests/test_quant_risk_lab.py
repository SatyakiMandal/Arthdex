"""
Unit tests for Arthdex Quant Risk Lab & Crisis Stress-Testing (M22).
"""

import math
import unittest

try:
    from app.services.quant_risk_lab import (
        HISTORICAL_CRISIS_SCENARIOS,
        STOCK_FACTOR_PROFILES,
        TAG_ACTUAL_FILING,
        TAG_MODELLED,
        calculate_indian_statutory_charges,
        calculate_var_suite,
        get_crisis_scenario_by_id,
        get_crisis_scenarios,
        invert_matrix,
        mat_mul,
        ols_regression,
        run_multi_factor_regression,
        run_portfolio_stress_test,
        run_walk_forward_backtest,
    )
except ImportError:
    from backend.app.services.quant_risk_lab import (
        HISTORICAL_CRISIS_SCENARIOS,
        STOCK_FACTOR_PROFILES,
        TAG_ACTUAL_FILING,
        TAG_MODELLED,
        calculate_indian_statutory_charges,
        calculate_var_suite,
        get_crisis_scenario_by_id,
        get_crisis_scenarios,
        invert_matrix,
        mat_mul,
        ols_regression,
        run_multi_factor_regression,
        run_portfolio_stress_test,
        run_walk_forward_backtest,
    )


class TestQuantRiskLab(unittest.TestCase):
    def test_historical_crisis_scenarios_exist(self):
        scenarios = get_crisis_scenarios()
        self.assertGreaterEqual(len(scenarios), 7)
        keys = [s["scenario_id"] for s in scenarios]
        self.assertIn("gfc_2008", keys)
        self.assertIn("taper_tantrum_2013", keys)
        self.assertIn("covid_shock_2020", keys)
        self.assertIn("election_shock_2024", keys)
        self.assertIn("rates_spike_100bps", keys)
        self.assertIn("crude_spike_30pct", keys)
        self.assertIn("inr_depreciation_5pct", keys)

    def test_gfc_2008_parameters(self):
        gfc = get_crisis_scenario_by_id("gfc_2008")
        self.assertIsNotNone(gfc)
        self.assertEqual(gfc["date_range"]["start"], "2008-01-08")
        self.assertEqual(gfc["date_range"]["end"], "2008-10-27")
        self.assertAlmostEqual(gfc["factor_drawdowns"]["nifty_drawdown_pct"], -59.90, places=1)
        self.assertAlmostEqual(gfc["factor_drawdowns"]["volatility_vix_peak"], 65.0, places=1)
        self.assertEqual(gfc["provenance"], TAG_ACTUAL_FILING)

    def test_taper_tantrum_2013_parameters(self):
        tt = get_crisis_scenario_by_id("taper_tantrum_2013")
        self.assertIsNotNone(tt)
        self.assertEqual(tt["date_range"]["start"], "2013-05-22")
        self.assertEqual(tt["date_range"]["end"], "2013-08-28")
        self.assertAlmostEqual(tt["factor_drawdowns"]["inr_usd_depreciation_pct"], -22.10, places=1)
        self.assertEqual(tt["factor_drawdowns"]["gsec_10y_yield_change_bps"], 210)
        self.assertEqual(tt["provenance"], TAG_ACTUAL_FILING)

    def test_covid_shock_2020_parameters(self):
        covid = get_crisis_scenario_by_id("covid_shock_2020")
        self.assertIsNotNone(covid)
        self.assertEqual(covid["date_range"]["start"], "2020-02-19")
        self.assertEqual(covid["date_range"]["end"], "2020-03-23")
        self.assertAlmostEqual(covid["factor_drawdowns"]["nifty_drawdown_pct"], -38.40, places=1)
        self.assertAlmostEqual(covid["factor_drawdowns"]["volatility_vix_peak"], 86.63, places=1)
        self.assertEqual(covid["factor_drawdowns"]["circuit_breaker_halts"], 2)
        self.assertEqual(covid["provenance"], TAG_ACTUAL_FILING)

    def test_election_shock_2024_parameters(self):
        election = get_crisis_scenario_by_id("election_shock_2024")
        self.assertIsNotNone(election)
        self.assertEqual(election["date_range"]["start"], "2024-06-03")
        self.assertEqual(election["date_range"]["end"], "2024-06-04")
        self.assertAlmostEqual(election["factor_drawdowns"]["nifty_drawdown_pct"], -5.93, places=2)
        self.assertAlmostEqual(election["factor_drawdowns"]["intraday_max_drawdown_pct"], -8.52, places=2)
        self.assertAlmostEqual(election["factor_drawdowns"]["sectoral_drawdowns"]["psu_basket"], -15.40, places=1)
        self.assertEqual(election["provenance"], TAG_ACTUAL_FILING)

    def test_hypothetical_shocks_parameters(self):
        rates = get_crisis_scenario_by_id("rates_spike_100bps")
        self.assertEqual(rates["factor_drawdowns"]["gsec_10y_yield_change_bps"], 100)
        self.assertEqual(rates["provenance"], TAG_MODELLED)

        crude = get_crisis_scenario_by_id("crude_spike_30pct")
        self.assertEqual(crude["factor_drawdowns"]["crude_oil_change_pct"], 30.0)
        self.assertEqual(crude["provenance"], TAG_MODELLED)

        inr = get_crisis_scenario_by_id("inr_depreciation_5pct")
        self.assertEqual(inr["factor_drawdowns"]["inr_usd_depreciation_pct"], -5.0)
        self.assertEqual(inr["provenance"], TAG_MODELLED)

    def test_linear_algebra_and_ols_solver(self):
        # Test identity and invert_matrix
        A = [[2.0, 1.0], [1.0, 3.0]]
        A_inv = invert_matrix(A)
        prod = mat_mul(A, A_inv)
        self.assertAlmostEqual(prod[0][0], 1.0, places=5)
        self.assertAlmostEqual(prod[0][1], 0.0, places=5)
        self.assertAlmostEqual(prod[1][0], 0.0, places=5)
        self.assertAlmostEqual(prod[1][1], 1.0, places=5)

        # Test simple OLS y = 2.0 + 3.0 * x
        X = [[1.0, float(i)] for i in range(10)]
        y = [2.0 + 3.0 * float(i) for i in range(10)]
        res = ols_regression(X, y)
        self.assertAlmostEqual(res["beta"][0], 2.0, places=4)
        self.assertAlmostEqual(res["beta"][1], 3.0, places=4)
        self.assertAlmostEqual(res["r_squared"], 1.0, places=4)

    def test_indian_statutory_charges_calculation(self):
        # Test with Rs 1,00,000 buy and Rs 1,10,000 sell
        buy_val = 100000.0
        sell_val = 110000.0
        turnover = buy_val + sell_val  # Rs 2,10,000
        charges = calculate_indian_statutory_charges(buy_val, sell_val, brokerage_flat_or_pct=20.0)

        # STT: 0.1% on buy (100) + 0.1% on sell (110) = 210
        self.assertAlmostEqual(charges["stt"], 210.0, places=1)
        # NSE Txn: 0.003% of 2,10,000 = 6.30
        self.assertAlmostEqual(charges["nse_transaction_charge"], 6.30, places=1)
        # SEBI Turnover fee: 0.0001% of 2,10,000 = 0.21
        self.assertAlmostEqual(charges["sebi_turnover_fee"], 0.21, places=2)
        # Stamp duty: 0.015% on buy (1,00,000) = 15.00
        self.assertAlmostEqual(charges["stamp_duty"], 15.00, places=1)
        # Brokerage = 20.00
        self.assertEqual(charges["brokerage"], 20.00)
        # GST: 18% of (20.0 + 6.30 + 0.21) = 18% of 26.51 = 4.77
        self.assertAlmostEqual(charges["gst"], 4.77, places=1)
        # Total charges ~ 210 + 6.30 + 0.21 + 15 + 20 + 4.77 = 256.28
        self.assertAlmostEqual(charges["total_statutory_charges"], 256.28, delta=1.0)

    def test_var_suite_calculations(self):
        var_res = calculate_var_suite(portfolio_value=1_000_000.0)
        self.assertIn("parametric_var", var_res)
        self.assertIn("historical_var", var_res)

        p_var = var_res["parametric_var"]
        h_var = var_res["historical_var"]

        # 99% VaR should strictly exceed 95% VaR
        self.assertGreater(p_var["var_1d_99_pct"], p_var["var_1d_95_pct"])
        self.assertGreater(h_var["var_1d_99_pct"], h_var["var_1d_95_pct"])

        # 10-day VaR should be sqrt(10) times 1-day VaR (within floating rounding delta)
        self.assertAlmostEqual(p_var["var_10d_95_pct"], p_var["var_1d_95_pct"] * math.sqrt(10.0), delta=0.05)
        self.assertAlmostEqual(h_var["var_10d_95_pct"], h_var["var_1d_95_pct"] * math.sqrt(10.0), delta=0.05)

        # Expected Shortfall (CVaR) should exceed or equal VaR
        self.assertGreaterEqual(p_var["expected_shortfall_cvar_1d_95_pct"], p_var["var_1d_95_pct"])
        self.assertGreaterEqual(h_var["expected_shortfall_cvar_1d_95_pct"], h_var["var_1d_95_pct"])

    def test_multi_factor_regression_service(self):
        reg = run_multi_factor_regression("RELIANCE", lookback_days=252)
        self.assertEqual(reg["symbol"], "RELIANCE")
        self.assertIn("betas", reg)
        self.assertIn("market_mkt", reg["betas"])
        self.assertIn("size_smb", reg["betas"])
        self.assertIn("value_hml", reg["betas"])
        self.assertIn("momentum_mom", reg["betas"])
        self.assertIn("low_volatility_lvol", reg["betas"])

        # Check R-squared and variance decomposition
        self.assertGreaterEqual(reg["r_squared"], 0.0)
        self.assertLessEqual(reg["r_squared"], 1.0)
        var_decomp = reg["variance_decomposition_pct"]
        total_var_pct = sum(var_decomp.values())
        self.assertAlmostEqual(total_var_pct, 100.0, delta=1.0)
        self.assertEqual(reg["provenance"], TAG_MODELLED)

    def test_portfolio_stress_test_historical(self):
        portfolio = [
            {"symbol": "RELIANCE", "weight": 0.40, "value_inr": 400000.0},
            {"symbol": "SBIN", "weight": 0.30, "value_inr": 300000.0},
            {"symbol": "TCS", "weight": 0.30, "value_inr": 300000.0},
        ]
        stress = run_portfolio_stress_test(portfolio, scenario_id="election_shock_2024")
        self.assertEqual(stress["scenario"]["id"], "election_shock_2024")
        summary = stress["portfolio_stress_summary"]

        self.assertAlmostEqual(summary["initial_capital_inr"], 1000000.0, places=1)
        self.assertGreater(summary["portfolio_loss_inr"], 0.0)
        self.assertLess(summary["portfolio_drawdown_pct"], 0.0)  # negative drawdown

        # On June 4 2024, PSU bank (SBIN) suffered worse than IT (TCS)
        constituents = {c["symbol"]: c for c in stress["constituents_breakdown"]}
        self.assertIn("SBIN", constituents)
        self.assertIn("TCS", constituents)
        self.assertLess(constituents["SBIN"]["drawdown_pct"], constituents["TCS"]["drawdown_pct"])

    def test_portfolio_stress_test_custom_shock(self):
        portfolio = {"RELIANCE": 0.5, "HDFCBANK": 0.5}
        custom_shocks = {"rates_bps": 100.0, "crude_pct": 30.0, "inr_pct": -5.0}
        stress = run_portfolio_stress_test(portfolio, scenario_id="custom", custom_shocks=custom_shocks)
        self.assertEqual(stress["scenario"]["id"], "custom")
        summary = stress["portfolio_stress_summary"]
        self.assertGreater(summary["portfolio_loss_inr"], 0.0)

    def test_walk_forward_backtest(self):
        backtest = run_walk_forward_backtest(
            strategy="sma_crossover",
            symbol="NIFTY50",
            parameters={"fast_period": 20, "slow_period": 50},
            initial_capital=1000000.0,
            in_sample_pct=0.70,
        )
        self.assertEqual(backtest["symbol"], "NIFTY50")
        self.assertIn("in_sample_performance", backtest)
        self.assertIn("out_of_sample_performance", backtest)
        self.assertIn("robustness_verdict", backtest)

        is_perf = backtest["in_sample_performance"]
        self.assertGreater(is_perf["total_trades"], 0)
        self.assertGreater(is_perf["itemized_statutory_charges"]["total_charges_paid_inr"], 0.0)
        self.assertIn("total_stt_inr", is_perf["itemized_statutory_charges"])
        self.assertIn("total_stamp_duty_inr", is_perf["itemized_statutory_charges"])
        self.assertIn("total_gst_inr", is_perf["itemized_statutory_charges"])

    def test_router_endpoints(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        try:
            from app.routers.quant_risk_lab import router
        except ImportError:
            from backend.app.routers.quant_risk_lab import router

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        # GET /api/risk-lab/crisis-scenarios
        res_scenarios = client.get("/api/risk-lab/crisis-scenarios")
        self.assertEqual(res_scenarios.status_code, 200)
        sc_data = res_scenarios.json()
        self.assertIn("data", sc_data)
        self.assertGreaterEqual(len(sc_data["data"]), 7)

        # POST /api/risk-lab/stress-test
        stress_payload = {
            "portfolio": [
                {"symbol": "RELIANCE", "weight": 0.5, "value_inr": 500000.0},
                {"symbol": "TCS", "weight": 0.5, "value_inr": 500000.0},
            ],
            "scenario_id": "covid_shock_2020",
        }
        res_stress = client.post("/api/risk-lab/stress-test", json=stress_payload)
        self.assertEqual(res_stress.status_code, 200)
        st_data = res_stress.json()["data"]
        self.assertEqual(st_data["scenario"]["id"], "covid_shock_2020")
        self.assertIn("portfolio_stress_summary", st_data)

        # GET /api/risk-lab/factor-exposures
        res_factors = client.get("/api/risk-lab/factor-exposures?symbol=RELIANCE&lookback_days=252")
        self.assertEqual(res_factors.status_code, 200)
        f_data = res_factors.json()["data"]
        self.assertEqual(f_data["symbol"], "RELIANCE")
        self.assertIn("betas", f_data)

        # POST /api/risk-lab/backtest
        bt_payload = {
            "strategy": "sma_crossover",
            "symbol": "NIFTY50",
            "parameters": {"fast_period": 20, "slow_period": 50},
            "initial_capital": 1000000.0,
            "in_sample_pct": 0.70,
        }
        res_bt = client.post("/api/risk-lab/backtest", json=bt_payload)
        self.assertEqual(res_bt.status_code, 200)
        bt_data = res_bt.json()["data"]
        self.assertEqual(bt_data["symbol"], "NIFTY50")
        self.assertIn("in_sample_performance", bt_data)
        self.assertIn("out_of_sample_performance", bt_data)


if __name__ == "__main__":
    unittest.main()
