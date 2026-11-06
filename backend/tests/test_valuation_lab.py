"""
Unittest test suite for Phase 13: Valuation Lab (Interactive DCF, WACC, Reverse DCF, Sensitivity).
"""

from __future__ import annotations

import unittest
from unittest.mock import patch

try:
    from app.services.valuation_lab import (
        DEFAULT_CORPORATE_TAX_RATE,
        DEFAULT_EQUITY_RISK_PREMIUM,
        DEFAULT_PRETAX_COST_OF_DEBT,
        DEFAULT_RISK_FREE_RATE,
        DEFAULT_TERMINAL_GROWTH_RATE,
        TAG_ACTUAL,
        TAG_CONSENSUS,
        TAG_MODELLED,
        CAPMInputs,
        DCFResult,
        ReverseDCFResult,
        WACCBreakdown,
        calculate_dcf,
        calculate_wacc,
        compute_sensitivity_matrix,
        get_company_dcf_defaults,
        lever_beta,
        solve_reverse_dcf,
        unlever_beta,
    )
except ImportError:
    from backend.app.services.valuation_lab import (
        DEFAULT_CORPORATE_TAX_RATE,
        DEFAULT_EQUITY_RISK_PREMIUM,
        DEFAULT_PRETAX_COST_OF_DEBT,
        DEFAULT_RISK_FREE_RATE,
        DEFAULT_TERMINAL_GROWTH_RATE,
        TAG_ACTUAL,
        TAG_CONSENSUS,
        TAG_MODELLED,
        CAPMInputs,
        DCFResult,
        ReverseDCFResult,
        WACCBreakdown,
        calculate_dcf,
        calculate_wacc,
        compute_sensitivity_matrix,
        get_company_dcf_defaults,
        lever_beta,
        solve_reverse_dcf,
        unlever_beta,
    )

try:
    from starlette.testclient import TestClient
    from app.main import app
    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False
    TestClient = None
    app = None


class TestValuationLabMath(unittest.TestCase):
    def test_indian_benchmark_constants(self):
        """Verifies default Indian financial benchmarks according to SEBI and market norms."""
        self.assertAlmostEqual(DEFAULT_RISK_FREE_RATE, 0.0718, places=4)
        self.assertAlmostEqual(DEFAULT_EQUITY_RISK_PREMIUM, 0.0600, places=4)
        self.assertAlmostEqual(DEFAULT_CORPORATE_TAX_RATE, 0.2517, places=4)
        self.assertAlmostEqual(DEFAULT_PRETAX_COST_OF_DEBT, 0.0850, places=4)
        self.assertAlmostEqual(DEFAULT_TERMINAL_GROWTH_RATE, 0.0500, places=4)

    def test_beta_unlevering_and_relevering(self):
        """Hamada equation test: Unlevering and then relevering should return original beta."""
        orig_beta = 1.25
        de_ratio = 0.40
        tax_rate = 0.2517

        unlevered = unlever_beta(orig_beta, de_ratio, tax_rate)
        # 1.25 / (1 + (1 - 0.2517)*0.40) = 1.25 / (1 + 0.7483 * 0.40) = 1.25 / 1.29932 = 0.962
        self.assertLess(unlevered, orig_beta)
        self.assertAlmostEqual(unlevered, 0.962, places=2)

        relevered = lever_beta(unlevered, de_ratio, tax_rate)
        self.assertAlmostEqual(relevered, orig_beta, places=2)

    def test_wacc_zero_debt_company(self):
        """Company with zero debt (e.g. TCS) should have WACC equal to its Cost of Equity."""
        wacc = calculate_wacc(
            beta=1.0,
            debt_to_equity=0.0,
            risk_free_rate=0.0718,
            equity_risk_premium=0.0600,
        )
        expected_ke = 0.0718 + 1.0 * 0.0600  # 0.1318 or 13.18%
        self.assertAlmostEqual(wacc.cost_of_equity, expected_ke, places=4)
        self.assertAlmostEqual(wacc.wacc, expected_ke, places=4)
        self.assertEqual(wacc.debt_weight, 0.0)
        self.assertEqual(wacc.equity_weight, 1.0)

    def test_wacc_levered_company(self):
        """Calculates WACC for levered firm with post-tax cost of debt."""
        wacc = calculate_wacc(
            beta=1.2,
            debt_to_equity=0.25,
            pretax_cost_of_debt=0.085,
            tax_rate=0.2517,
        )
        # Post tax Kd = 8.5% * (1 - 0.2517) = 6.36055%
        self.assertAlmostEqual(wacc.post_tax_cost_of_debt, 0.0636, places=3)
        # Weight equity = 1 / 1.25 = 0.80, Weight debt = 0.20
        self.assertAlmostEqual(wacc.equity_weight, 0.80, places=2)
        self.assertAlmostEqual(wacc.debt_weight, 0.20, places=2)
        self.assertGreater(wacc.cost_of_equity, wacc.wacc)
        self.assertGreater(wacc.wacc, wacc.post_tax_cost_of_debt)

    def test_dcf_2stage_calculation(self):
        """Tests 2-stage DCF valuation and validates equity value per share."""
        # Simple test setup
        res = calculate_dcf(
            symbol="TESTCO",
            current_price=100.0,
            shares_outstanding_cr=10.0,
            cash_and_equivalents_cr=100.0,
            total_debt_cr=200.0,
            base_fcff_cr=50.0,
            stage1_growth_rate=0.10,
            stage1_years=5,
            terminal_growth_rate=0.05,
            wacc=0.12,
            model_type="2-stage",
        )
        self.assertEqual(res.symbol, "TESTCO")
        self.assertEqual(res.model_type, "2-stage")
        self.assertEqual(len(res.projections), 5)
        self.assertGreater(res.enterprise_value_cr, 0.0)
        self.assertGreater(res.terminal_value_cr, 0.0)
        self.assertGreater(res.pv_terminal_value_cr, 0.0)

        # Equity value = EV + Cash - Debt
        expected_equity_val = res.enterprise_value_cr + 100.0 - 200.0
        self.assertAlmostEqual(res.equity_value_cr, expected_equity_val, places=1)
        expected_fair_val = expected_equity_val / 10.0
        self.assertAlmostEqual(res.fair_value_per_share, expected_fair_val, places=1)

    def test_dcf_3stage_calculation(self):
        """Tests 3-stage DCF valuation with explicit transition fade stage."""
        res = calculate_dcf(
            symbol="TESTGROWTH",
            current_price=500.0,
            shares_outstanding_cr=5.0,
            cash_and_equivalents_cr=50.0,
            total_debt_cr=50.0,
            base_fcff_cr=30.0,
            stage1_growth_rate=0.20,
            stage1_years=5,
            terminal_growth_rate=0.05,
            wacc=0.13,
            model_type="3-stage",
            stage2_years=5,
        )
        self.assertEqual(res.model_type, "3-stage")
        # 5 years stage 1 + 5 years stage 2 = 10 projections
        self.assertEqual(len(res.projections), 10)
        # Verify growth rate fades from > 15% towards 5% in stage 2
        g_year6 = res.projections[5]["growth_rate"]
        g_year10 = res.projections[9]["growth_rate"]
        self.assertLess(g_year6, 0.20)
        self.assertGreater(g_year6, g_year10)
        self.assertAlmostEqual(g_year10, 0.075, places=2)

    def test_dcf_invalid_inputs(self):
        """Gordon growth requires WACC > terminal growth rate, and shares > 0."""
        with self.assertRaises(ValueError):
            calculate_dcf(
                symbol="ERR",
                current_price=100.0,
                shares_outstanding_cr=0.0,  # Zero shares
                cash_and_equivalents_cr=0.0,
                total_debt_cr=0.0,
                base_fcff_cr=10.0,
                wacc=0.12,
            )

        with self.assertRaises(ValueError):
            calculate_dcf(
                symbol="ERR",
                current_price=100.0,
                shares_outstanding_cr=10.0,
                cash_and_equivalents_cr=0.0,
                total_debt_cr=0.0,
                base_fcff_cr=10.0,
                wacc=0.05,  # WACC <= terminal growth (0.05 <= 0.05)
                terminal_growth_rate=0.05,
            )

    def test_reverse_dcf_solver_accuracy(self):
        """
        Consistency test: If we calculate DCF fair value with growth rate g,
        feeding that fair value as current price into Reverse DCF must recover g!
        """
        target_g = 0.14  # 14% CAGR
        wacc = 0.12
        term_g = 0.05

        forward_dcf = calculate_dcf(
            symbol="CONSISTENCY",
            current_price=100.0,
            shares_outstanding_cr=20.0,
            cash_and_equivalents_cr=200.0,
            total_debt_cr=100.0,
            base_fcff_cr=80.0,
            stage1_growth_rate=target_g,
            stage1_years=5,
            terminal_growth_rate=term_g,
            wacc=wacc,
        )
        calculated_fair_val = forward_dcf.fair_value_per_share

        # Now solve Reverse DCF using calculated_fair_val as the market price
        rev = solve_reverse_dcf(
            symbol="CONSISTENCY",
            current_price=calculated_fair_val,
            shares_outstanding_cr=20.0,
            cash_and_equivalents_cr=200.0,
            total_debt_cr=100.0,
            base_fcff_cr=80.0,
            wacc=wacc,
            terminal_growth_rate=term_g,
            projection_years=5,
        )

        # Implied growth % should equal 14.0%
        self.assertAlmostEqual(rev.implied_5y_fcf_cagr_pct, target_g * 100.0, delta=0.2)
        self.assertIn("Fair / Sustainable", rev.valuation_classification)

    def test_sensitivity_matrix_dimensions_and_properties(self):
        """Tests 5x5 sensitivity matrix grid, directional behavior, and base case."""
        matrix_data = compute_sensitivity_matrix(
            symbol="TCS",
            current_price=4000.0,
            shares_outstanding_cr=360.0,
            cash_and_equivalents_cr=15000.0,
            total_debt_cr=0.0,
            base_fcff_cr=40000.0,
            stage1_growth_rate=0.10,
            base_wacc=0.12,
            base_terminal_growth=0.05,
        )
        self.assertEqual(len(matrix_data["rows"]), 5)
        for row in matrix_data["rows"]:
            self.assertEqual(len(row["columns"]), 5)

        # Valuation inverse relationship with WACC:
        # At same terminal growth, lower WACC gives higher fair value
        val_low_wacc = matrix_data["rows"][0]["columns"][2]["fair_value"]
        val_high_wacc = matrix_data["rows"][4]["columns"][2]["fair_value"]
        self.assertGreater(val_low_wacc, val_high_wacc)

        # Direct relationship with terminal growth:
        # At same WACC, higher terminal growth gives higher fair value
        val_low_g = matrix_data["rows"][2]["columns"][0]["fair_value"]
        val_high_g = matrix_data["rows"][2]["columns"][4]["fair_value"]
        self.assertGreater(val_high_g, val_low_g)


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class TestValuationLabEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not HAS_TESTCLIENT:
            return
        cls.client = TestClient(app)

    def test_get_dcf_endpoint(self):
        res = self.client.get("/api/valuation/RELIANCE/dcf")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("data", body)
        data = body["data"]
        self.assertIn("dcf", data)
        self.assertEqual(data["dcf"]["symbol"], "RELIANCE")
        self.assertGreater(data["dcf"]["fair_value_per_share"], 0)
        self.assertEqual(body["meta"]["delayedMinutes"], 0)

    def test_post_dcf_calculate_endpoint(self):
        payload = {
            "symbol": "CUSTOM",
            "current_price": 500.0,
            "shares_outstanding_cr": 10.0,
            "cash_and_equivalents_cr": 100.0,
            "total_debt_cr": 50.0,
            "base_fcff_cr": 60.0,
            "stage1_growth_rate": 0.15,
            "stage1_years": 5,
            "terminal_growth_rate": 0.05,
            "wacc": 0.12,
            "model_type": "2-stage",
        }
        res = self.client.post("/api/valuation/dcf/calculate", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        data = body["data"]
        self.assertEqual(data["symbol"], "CUSTOM")
        self.assertGreater(data["fair_value_per_share"], 0)

    def test_get_reverse_dcf_endpoint(self):
        res = self.client.get("/api/valuation/INFY/reverse-dcf")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        data = body["data"]
        self.assertEqual(data["symbol"], "INFY")
        self.assertIn("implied_5y_fcf_cagr_pct", data)
        self.assertIn("valuation_classification", data)

    def test_get_sensitivity_endpoint(self):
        res = self.client.get("/api/valuation/TCS/sensitivity")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        data = body["data"]
        self.assertEqual(data["symbol"], "TCS")
        self.assertEqual(len(data["rows"]), 5)


if __name__ == "__main__":
    unittest.main()
