"""Tests for India Sovereign Yield Curve & Fixed Income Analytics."""

from __future__ import annotations

import unittest

from app.services import fixed_income


class FixedIncomeTests(unittest.TestCase):
    def test_tenor_monotonic_ordering(self) -> None:
        """Tenors must have strictly increasing maturity horizons."""
        tenors = fixed_income.TENOR_DEFINITIONS
        self.assertGreaterEqual(len(tenors), 10)
        years = [t["years"] for t in tenors]
        self.assertEqual(years, sorted(years))

    def test_rbi_corridor_integrity(self) -> None:
        """RBI operating corridor must respect SDF (floor) <= Repo <= MSF (ceiling)."""
        corridor = fixed_income.RBI_CORRIDOR
        self.assertLess(corridor["sdfRate"], corridor["repoRate"])
        self.assertGreater(corridor["msfRate"], corridor["repoRate"])
        self.assertEqual(corridor["msfRate"] - corridor["repoRate"], 0.25)
        self.assertEqual(corridor["repoRate"] - corridor["sdfRate"], 0.25)

    def test_nelson_siegel_par_fitting(self) -> None:
        """Nelson-Siegel interpolation must return plausible positive yields."""
        y_1y = fixed_income.nelson_siegel_yield(1.0)
        y_10y = fixed_income.nelson_siegel_yield(10.0)
        y_30y = fixed_income.nelson_siegel_yield(30.0)

        self.assertGreater(y_1y, 5.0)
        self.assertLess(y_1y, 10.0)
        self.assertGreater(y_10y, y_1y)  # Upward sloping baseline
        self.assertGreater(y_30y, y_10y)

    def test_sovereign_yield_curve_payload(self) -> None:
        """get_sovereign_yield_curve returns complete curve with spreads and corridor."""
        data = fixed_income.get_sovereign_yield_curve()
        self.assertIn("benchmark10y", data)
        self.assertIn("spreads", data)
        self.assertIn("rbiCorridor", data)
        self.assertIn("tenors", data)
        self.assertIn("spreadMatrix", data)

        spreads = data["spreads"]
        self.assertIn("spread2s10sBps", spreads)
        self.assertIn("spread5s10sBps", spreads)
        self.assertIn("spread3m10yBps", spreads)
        self.assertIn("termPremiumRepoBps", spreads)

        # 2s10s spread must match 10Y - 2Y
        tenor_map = {t["tenor"]: t["yieldPct"] for t in data["tenors"]}
        expected_2s10s = round((tenor_map["10Y"] - tenor_map["2Y"]) * 100, 1)
        self.assertEqual(spreads["spread2s10sBps"], expected_2s10s)

        # Spread matrix must have at least 5 benchmarks
        self.assertGreaterEqual(len(data["spreadMatrix"]), 5)


if __name__ == "__main__":
    unittest.main()
