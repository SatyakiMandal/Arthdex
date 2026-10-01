"""Unit tests for the unlisted research layer (valuation, risk, forecast, call).

Run from ``backend/``:  python -m unittest discover -s tests -v

These use synthetic series and fixed inputs, so no network is needed. They pin the arithmetic
that the site shows to users: a fair value that is wrong by a factor is exactly the kind of
error that would pass type checks and look plausible on screen.
"""

from __future__ import annotations

import math
import unittest
from datetime import date

import numpy as np
import pandas as pd

from ceia import unlisted_research as ur


def step_series(prices: list[float], start: str = "2025-01-01", days_each: int = 20) -> pd.Series:
    """A forward-filled daily series that changes value every ``days_each`` days, like a dealer quote."""
    idx = pd.date_range(start, periods=len(prices) * days_each, freq="D")
    values = np.repeat(prices, days_each).astype(float)
    return pd.Series(values, index=idx, name="close")


class FactsAndSectors(unittest.TestCase):
    def test_parse_facts_handles_rupees_commas_and_na(self):
        f = ur.parse_facts(
            {"P/B ratio": "6.05", "P/E ratio": "N/A", "Book value": "₹1,240.50", "Lot size": "10,000", "Debt / Equity": "0"}
        )
        self.assertEqual(f["pb"], 6.05)
        self.assertIsNone(f["pe"])
        self.assertEqual(f["book_value"], 1240.5)
        self.assertEqual(f["lot_size"], 10000.0)
        self.assertEqual(f["debt_equity"], 0.0)

    def test_sector_mapping_edge_cases(self):
        name = lambda s: (ur.sector_index(s) or {}).get("name")  # noqa: E731
        self.assertEqual(name("Healthcare & Pharmaceuticals"), "Nifty Pharma")
        self.assertEqual(name("Biotech"), "Nifty Pharma", "biotech contains 'tech' but is not software")
        self.assertIsNone(name("Hospitality & Tourism"), "hospitality is not hospitals")
        self.assertIsNone(name("Industrial Automation"), "automation is not autos")
        self.assertEqual(name("Banking"), "Nifty Bank")
        self.assertIsNone(name("Defence"))
        self.assertIsNone(ur.sector_index(None))


class Valuation(unittest.TestCase):
    def setUp(self):
        self.series = step_series([100.0] * 20)  # 400 flat days: median anchor is 100
        self.bench = {"sector": {"name": "Nifty Test", "pe": 15.0, "pb": 3.0}, "broad": {"name": "Nifty 500", "pe": 20.0, "pb": 3.5}}

    def test_relative_models_apply_the_illiquidity_discount(self):
        facts = {"pb": 2.0, "pe": 20.0, "book_value": 50.0}
        v = ur.valuation_block(100.0, self.series, facts, self.bench, {"sovereign_yields": {"india_10y_pct": 7.0}}, beta=None)
        models = {m["key"]: m for m in v["models"]}
        # book value 50 x benchmark P/B 3.0 x (1 - 25%)
        self.assertAlmostEqual(models["pb_relative"]["fair_value"], 112.5, places=2)
        # EPS = 100 / 20 = 5, x benchmark P/E 15 x 0.75
        self.assertAlmostEqual(models["pe_relative"]["fair_value"], 56.25, places=2)
        self.assertAlmostEqual(models["reversion"]["fair_value"], 100.0, places=2)
        # weights are renormalised across the models that exist and sum to one
        self.assertAlmostEqual(sum(m["weight_used"] for m in v["models"]), 1.0, places=2)
        blended = sum(m["fair_value"] * m["weight_used"] for m in v["models"])
        self.assertAlmostEqual(v["blended_fair_value"], blended, delta=0.05)

    def test_justified_pb_is_capped(self):
        # ROE = P/B / P/E = 12 / 2 = 600%: without the cap the model would value the share at many times book
        facts = {"pb": 12.0, "pe": 2.0, "book_value": 10.0}
        v = ur.valuation_block(120.0, self.series, facts, self.bench, {"sovereign_yields": {"india_10y_pct": 7.0}}, beta=None)
        jb = next(m for m in v["models"] if m["key"] == "justified_pb")
        self.assertLessEqual(jb["fair_value"], 10.0 * 10.0 * 0.75 + 0.01)

    def test_no_inputs_means_no_valuation_not_a_guess(self):
        v = ur.valuation_block(100.0, step_series([100.0] * 2), {"pb": None, "pe": None, "book_value": None}, None, {}, beta=None)
        self.assertFalse(v["available"])

    def test_missing_risk_free_rate_is_flagged_as_assumed(self):
        facts = {"pb": 3.0, "pe": 15.0, "book_value": 40.0}
        v = ur.valuation_block(100.0, self.series, facts, self.bench, {}, beta=None)
        self.assertTrue(v["assumptions"]["risk_free_assumed"])

    def test_sensitivity_centre_equals_the_blend(self):
        facts = {"pb": 2.0, "pe": 20.0, "book_value": 50.0}
        v = ur.valuation_block(100.0, self.series, facts, self.bench, {"sovereign_yields": {"india_10y_pct": 7.0}}, beta=None)
        centre = next(r for r in v["sensitivity"]["rows"] if r["DLOM"] == "25%")["x1.0"]
        self.assertAlmostEqual(centre, v["blended_fair_value"], delta=0.05)


class RiskAndForecast(unittest.TestCase):
    def test_too_few_months_gives_a_note_not_numbers(self):
        r = ur.risk_block(step_series([100, 101, 102], days_each=20), {"lot_size": 100.0})
        self.assertIn("note", r)
        self.assertNotIn("annualised_vol_pct", r)

    def test_volatility_is_monthly_scaled_by_sqrt_12(self):
        rng = np.random.default_rng(1)
        prices = list(100 * np.exp(np.cumsum(rng.normal(0, 0.05, 30))))
        series = step_series(prices, days_each=30)
        rets = ur.monthly_log_returns(series)
        r = ur.risk_block(series, {"lot_size": 1.0})
        self.assertAlmostEqual(r["annualised_vol_pct"], float(rets.std(ddof=1)) * math.sqrt(12) * 100, delta=0.1)

    def test_historical_var_needs_a_year_of_months(self):
        series = step_series(list(100 + np.arange(9) * 2.0 + (np.arange(9) % 3)), days_each=30)
        r = ur.risk_block(series, {})
        self.assertIsNone(r["var_1m"]["historical_95_pct"])
        self.assertIsNotNone(r["var_1m"]["parametric_95_pct"])

    def test_forecast_is_reproducible_and_ordered(self):
        rng = np.random.default_rng(3)
        series = step_series(list(100 * np.exp(np.cumsum(rng.normal(0.01, 0.06, 24)))), days_each=30)
        a, b = ur.forecast_block(series), ur.forecast_block(series)
        self.assertEqual(a["horizons"], b["horizons"])
        for h in a["horizons"]:
            self.assertLessEqual(h["p10_price"], h["p50_price"])
            self.assertLessEqual(h["p50_price"], h["p90_price"])


class Verdict(unittest.TestCase):
    def _verdict(self, upside_price: float, fair: float):
        series = step_series([100.0] * 20)
        val = {
            "available": True, "upside_pct": (fair / upside_price - 1) * 100, "blended_fair_value": fair,
            "fair_value_low": fair, "fair_value_high": fair, "valuation_tier": "x",
            "models": [{}], "assumptions": {"dlom_pct": 25},
        }
        tech = {"composite_score": 60.0, "composite_rating": "Strong Bullish", "weeks": 50, "rsi": 55}
        risk = {"months": 24, "annualised_vol_pct": 18.0, "liquidity": {"stale_day_share_pct": 50}, "var_1m": {"historical_95_pct": 8.0}}
        profile = {"revisions": {"count": 60}, "drawdown": {"max_drawdown_pct": -10}}
        return ur.compute_unlisted_verdict(
            upside_price, date(2026, 10, 1), val, tech, risk, None, {"moves_with_headlines": 0}, {}, profile,
            {"lot_size": 100.0, "debt_equity": 0.2}, news_available=False,
        )

    def test_no_buy_call_above_fair_value(self):
        v = self._verdict(100.0, 90.0)  # quote 11% above fair value, everything else bullish
        self.assertNotIn("BUY", v.actionable_call)

    def test_far_above_fair_value_is_reduce(self):
        v = self._verdict(100.0, 40.0)
        self.assertTrue(v.actionable_call.startswith(("REDUCE", "SELL")), v.actionable_call)

    def test_deep_discount_with_good_trend_is_a_buy(self):
        v = self._verdict(100.0, 170.0)
        self.assertIn("BUY", v.actionable_call)

    def test_conviction_cap_and_whole_lot_sizing(self):
        v = self._verdict(100.0, 170.0)
        self.assertLessEqual(v.conviction_score, 85.0)
        for tier in v.sizing_tiers:
            self.assertEqual(tier.prescribed_shares % 100, 0)
        self.assertLessEqual(v.prescribed_allocation_pct, 3.0)

    def test_pillar_weights_sum_to_100_when_one_is_dropped(self):
        v = self._verdict(100.0, 170.0)
        self.assertAlmostEqual(sum(p.weight_pct for p in v.pillars), 100.0, places=1)


if __name__ == "__main__":
    unittest.main()
