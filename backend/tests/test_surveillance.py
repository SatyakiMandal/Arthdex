"""Tests for SEBI & NSE surveillance and circuit band monitoring service."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from app.services import surveillance


class SurveillanceTests(unittest.TestCase):
    def test_baseline_surveillance_records(self) -> None:
        """Baseline records must contain valid SEBI surveillance stages and margin rates."""
        records = surveillance.BASELINE_SURVEILLANCE
        self.assertGreater(len(records), 0)
        for r in records:
            self.assertIn("symbol", r)
            self.assertIn(r["measure"], ("ASM-LT", "ASM-ST", "GSM", "T2T"))
            self.assertIn(r["priceBandPct"], (2.0, 5.0, 10.0, 20.0))
            self.assertGreaterEqual(r["marginRequiredPct"], 50.0)
            self.assertIn(r["asdRatePct"], (0.0, 50.0, 100.0, 200.0))
            self.assertIn(r["tradingWindow"], ("Daily", "Weekly (Monday)", "Fortnightly"))

    def test_parse_gsm_surveillance_csv(self) -> None:
        """GSM stage parsing correctly assigns 50%, 100%, and 200% ASD surcharge."""
        csv_data = """Symbol,Security Name,Series,Current Stage,Effective Date
ABC,ABC Limited,EQ,Stage II,2024-01-01
DEF,DEF Limited,BE,Stage III,2024-01-02
GHI,GHI Limited,BE,Stage IV,2024-01-03
"""
        parsed = surveillance._parse_surveillance_csv(csv_data, "GSM")
        self.assertEqual(len(parsed), 3)

        # Stage II: 5% band, 50% ASD
        self.assertEqual(parsed[0]["stage"], "Stage II")
        self.assertEqual(parsed[0]["asdRatePct"], 50.0)
        self.assertEqual(parsed[0]["tradingWindow"], "Daily")

        # Stage III: 5% band, 100% ASD, Weekly trading
        self.assertEqual(parsed[1]["stage"], "Stage III")
        self.assertEqual(parsed[1]["asdRatePct"], 100.0)
        self.assertEqual(parsed[1]["tradingWindow"], "Weekly (Monday)")

        # Stage IV: 2% band, 200% ASD, Weekly trading
        self.assertEqual(parsed[2]["stage"], "Stage IV")
        self.assertEqual(parsed[2]["priceBandPct"], 2.0)
        self.assertEqual(parsed[2]["asdRatePct"], 200.0)
        self.assertEqual(parsed[2]["tradingWindow"], "Weekly (Monday)")

    def test_surveillance_overview_shape(self) -> None:
        """get_surveillance_overview returns full counts, circuit distribution, and securities."""
        overview = surveillance.get_surveillance_overview()
        self.assertIn("asOf", overview)
        self.assertIn("counts", overview)
        self.assertIn("circuitDistribution", overview)
        self.assertIn("rulesSummary", overview)
        self.assertIn("securities", overview)

        counts = overview["counts"]
        self.assertIn("asmLongTerm", counts)
        self.assertIn("asmShortTerm", counts)
        self.assertIn("gsm", counts)
        self.assertIn("t2t", counts)

        # Securities must be sorted by symbol
        symbols = [s["symbol"] for s in overview["securities"]]
        self.assertEqual(symbols, sorted(symbols))


if __name__ == "__main__":
    unittest.main()
