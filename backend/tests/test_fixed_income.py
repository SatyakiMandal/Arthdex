"""The RBI rates parser, and how the curve uses (and never invents) history."""

import unittest

from app.services import fixed_income

HOME = """
<table>
<tr><th>Policy Repo Rate</th><td>: 5.50%</td></tr>
<tr><th>Standing Deposit Facility Rate</th><td>: 5.25%</td></tr>
<tr><th>CRR</th><td>: 3.00%</td></tr>
<tr><th>INR / 1 USD</th><td>: 94.1997</td></tr>
<tr><th>INR / 100 JPY</th><td>: 58.9400</td></tr>
<tr><th>6.20% GS 2029</th><td>: 6.8894% #</td></tr>
<tr><th>6.94% GS 2036</th><td>: 7.2430% #</td></tr>
<tr><th>91 day T-bills</th><td>: 5.8681%*</td></tr>
</table>
<p>as on November 12, 2026 Government Securities Market</p>
"""


class ParseTests(unittest.TestCase):
    def test_reads_policy_curve_and_fx_as_published(self):
        d = fixed_income.parse_home(HOME)
        self.assertEqual(d["policy"]["repoRate"], 5.5)
        self.assertEqual(d["gsecAsOn"], "2026-11-12")
        papers = {p["paper"]: p["yieldPct"] for p in d["points"]}
        self.assertEqual(papers["6.94% GS 2036"], 7.243)
        self.assertEqual(papers["91 day T-bill"], 5.8681)
        self.assertIn({"currency": "JPY", "units": 100, "rate": 58.94}, d["fx"])

    def test_page_without_the_rates_block_is_an_error_not_a_default(self):
        with self.assertRaises(ValueError):
            fixed_income.parse_home("<html><body>maintenance</body></html>")


class CurveTests(unittest.TestCase):
    def setUp(self):
        self.data = fixed_income.parse_home(HOME)

    def test_no_history_means_no_changes(self):
        curve = fixed_income.build_curve(self.data, [])
        for t in curve["tenors"]:
            self.assertEqual(t["history"], {"1w": None, "1m": None, "1y": None})

    def test_changes_come_from_stored_snapshots(self):
        older = {"asOf": "2026-11-05", "value": {"points": [{"tenor": "GS 2036", "yieldPct": 7.20}]}}
        curve = fixed_income.build_curve(self.data, [older])
        bench = next(t for t in curve["tenors"] if t["tenor"] == "GS 2036")
        self.assertEqual(bench["history"]["1w"], {"asOf": "2026-11-05", "yieldPct": 7.2, "changeBps": 4.3})
        self.assertIsNone(bench["history"]["1y"])

    def test_benchmark_is_the_published_paper_nearest_ten_years(self):
        curve = fixed_income.build_curve(self.data, [])
        self.assertEqual(curve["benchmark"]["paper"], "6.94% GS 2036")
        self.assertEqual([t["tenor"] for t in curve["tenors"]], ["91D", "GS 2029", "GS 2036"])


if __name__ == "__main__":
    unittest.main()
