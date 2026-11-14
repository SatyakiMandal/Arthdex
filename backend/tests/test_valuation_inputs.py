"""DCF starting inputs are read from company figures; nothing is generated when one is missing."""

from __future__ import annotations

import unittest

from app.services.valuation_inputs import (
    TAG_ACTUAL,
    TAG_ASSUMPTION,
    TAG_MODELLED,
    DcfInputsUnavailable,
    derive,
)

QUOTE = {"cmp": 500.0, "marketCapCr": 5000.0, "name": "Test Company Limited", "sector": "Capital Goods", "asOf": "2026-11-12T10:00:00+00:00"}
STATS = {
    "highlights": {"freeCashflow": 300.0, "cash": 100.0, "debt": 50.0},
    "trading": {"sharesOutstanding": 100_000_000},
}
FINANCIALS = {
    "annual": [
        {"period": "FY23", "revenue": 1000.0},
        {"period": "FY24", "revenue": 1100.0},
        {"period": "FY25", "revenue": 1210.0},
    ],
    "ratios": {"debtToEquity": 0.12},
}
SENS = {"rows": [{"benchmarkId": "nifty-50", "beta": 0.86, "rSquared": 0.31, "observationWindowDays": 740}]}


class DeriveTests(unittest.TestCase):
    def test_facts_come_from_the_company_figures(self):
        d = derive("testco", QUOTE, STATS, FINANCIALS, SENS)
        self.assertEqual(d["symbol"], "TESTCO")
        self.assertEqual(d["current_price"], 500.0)
        self.assertEqual(d["shares_outstanding_cr"], 10.0)
        self.assertEqual((d["base_fcff_cr"], d["cash_and_equivalents_cr"], d["total_debt_cr"]), (300.0, 100.0, 50.0))
        self.assertEqual(d["debt_to_equity"], 0.12)
        self.assertEqual(d["beta"], 0.86)
        self.assertEqual(d["input_provenance"]["base_fcff_cr"], TAG_ACTUAL)
        self.assertEqual(d["input_provenance"]["beta"], TAG_MODELLED)

    def test_growth_starts_at_revenue_cagr_and_is_labelled_an_assumption(self):
        d = derive("TESTCO", QUOTE, STATS, FINANCIALS, SENS)
        self.assertAlmostEqual(d["historical_revenue_cagr"], 0.10, places=4)
        self.assertAlmostEqual(d["stage1_growth_rate"], 0.10, places=4)
        self.assertEqual(d["input_provenance"]["stage1_growth_rate"], TAG_ASSUMPTION)
        fast = {"annual": [{"period": "FY23", "revenue": 100.0}, {"period": "FY24", "revenue": 200.0}, {"period": "FY25", "revenue": 400.0}]}
        self.assertEqual(derive("TESTCO", QUOTE, STATS, fast, SENS)["stage1_growth_rate"], 0.20)

    def test_two_symbols_with_the_same_figures_get_the_same_inputs(self):
        # the removed generator derived prices from the letters of the ticker
        a = derive("AAAA", QUOTE, STATS, FINANCIALS, SENS)
        b = derive("ZZZZ", QUOTE, STATS, FINANCIALS, SENS)
        for key in ("current_price", "shares_outstanding_cr", "base_fcff_cr", "beta", "total_debt_cr"):
            self.assertEqual(a[key], b[key])

    def test_missing_or_negative_cash_flow_stops_the_model(self):
        for highlights in ({}, {"freeCashflow": None}, {"freeCashflow": -40.0}):
            with self.assertRaises(DcfInputsUnavailable):
                derive("TESTCO", QUOTE, {"highlights": highlights, "trading": STATS["trading"]}, FINANCIALS, SENS)

    def test_no_quote_stops_the_model(self):
        with self.assertRaises(DcfInputsUnavailable):
            derive("TESTCO", None, STATS, FINANCIALS, SENS)
        with self.assertRaises(DcfInputsUnavailable):
            derive("TESTCO", {"cmp": None}, STATS, FINANCIALS, SENS)

    def test_lenders_are_not_offered_a_cash_flow_dcf(self):
        bank = dict(QUOTE, sector="Financial Services", basicIndustry="Private Sector Bank")
        with self.assertRaises(DcfInputsUnavailable) as ctx:
            derive("TESTBANK", bank, STATS, FINANCIALS, SENS)
        self.assertIn("lender", str(ctx.exception))

    def test_weak_or_missing_regression_falls_back_to_a_labelled_beta_of_one(self):
        weak = {"rows": [{"benchmarkId": "nifty-50", "beta": 0.07, "rSquared": 0.001}]}
        for sens in (None, {"rows": []}, weak):
            d = derive("TESTCO", QUOTE, STATS, FINANCIALS, sens)
            self.assertEqual(d["beta"], 1.0)
            self.assertEqual(d["input_provenance"]["beta"], TAG_ASSUMPTION)

    def test_unreported_cash_and_debt_are_zero_and_say_so(self):
        d = derive("TESTCO", QUOTE, {"highlights": {"freeCashflow": 300.0}, "trading": STATS["trading"]}, FINANCIALS, SENS)
        self.assertEqual((d["cash_and_equivalents_cr"], d["total_debt_cr"]), (0.0, 0.0))
        self.assertEqual(d["input_provenance"]["total_debt_cr"], TAG_ASSUMPTION)
        self.assertTrue(any("Debt is not reported" in n for n in d["notes"]))


if __name__ == "__main__":
    unittest.main()
