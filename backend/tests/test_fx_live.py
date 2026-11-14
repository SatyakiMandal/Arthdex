"""Rupee cross rates are arithmetic on the supplied daily closes."""

from __future__ import annotations

import unittest
from datetime import date, timedelta

from app.services import fx_live


def bars(start: date, closes: list[float]) -> list[dict]:
    return [{"date": start + timedelta(days=i), "close": c, "high": c + 0.1, "low": c - 0.1} for i, c in enumerate(closes)]


class PairTests(unittest.TestCase):
    def test_rate_and_day_change(self):
        row = fx_live.pair_row("USD/INR", bars(date(2026, 11, 1), [90.0, 91.8]))
        self.assertEqual((row["rate"], row["change"], row["changePct"], row["trend"]), (91.8, 1.8, 2.0, "up"))
        self.assertEqual((row["high"], row["low"], row["asOf"]), (91.9, 91.7, "2026-11-02"))

    def test_yen_is_quoted_per_hundred(self):
        row = fx_live.pair_row("JPY/INR (100)", bars(date(2026, 11, 1), [0.58, 0.59]), 100.0)
        self.assertEqual(row["rate"], 59.0)
        self.assertEqual(row["change"], 1.0)

    def test_longer_changes_need_history_that_reaches_back(self):
        long = bars(date(2025, 11, 1), [80.0] * 340 + [88.0] * 30 + [96.8])
        row = fx_live.pair_row("USD/INR", long)
        self.assertEqual(row["change1mPct"], 10.0)
        self.assertEqual(row["change1yPct"], 21.0)
        short = fx_live.pair_row("USD/INR", bars(date(2026, 11, 1), [90.0, 91.0]))
        self.assertIsNone(short["change1mPct"])
        self.assertIsNone(short["change1yPct"])

    def test_single_bar_has_a_rate_and_no_change(self):
        row = fx_live.pair_row("CNY/INR", bars(date(2026, 11, 14), [14.1262]))
        self.assertEqual(row["rate"], 14.1262)
        self.assertIsNone(row["change"])
        self.assertEqual(row["trend"], "neutral")

    def test_no_data_gives_no_row(self):
        self.assertIsNone(fx_live.pair_row("USD/INR", []))
        self.assertIsNone(fx_live.pair_row("USD/INR", [{"date": date(2026, 1, 1), "close": None}]))


class BuildTests(unittest.TestCase):
    def test_missing_pairs_are_named_not_filled(self):
        out = fx_live.build({"USDINR=X": bars(date(2026, 11, 1), [90.0, 91.0])})
        self.assertEqual([p["pair"] for p in out["pairs"]], ["USD/INR"])
        self.assertIn("EUR/INR", out["missingPairs"])
        for key in ("fbilReference", "forwardPremia", "reer"):
            self.assertIn(key, out["unavailable"])

    def test_nothing_at_all_is_an_error(self):
        with self.assertRaises(ValueError):
            fx_live.build({})


if __name__ == "__main__":
    unittest.main()
