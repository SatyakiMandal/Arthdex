import unittest
from unittest import mock

import pandas as pd

from app import reconcile
from app.providers import yahoo


class CompareTests(unittest.TestCase):
    def test_relative_and_absolute(self):
        self.assertEqual(reconcile.compare("x", 100, 100.4, 0.005)[0], "pass")
        self.assertEqual(reconcile.compare("x", 100, 101, 0.005)[0], "fail")
        self.assertEqual(reconcile.compare("x", 1.92, 4.48, 0.05, absolute=True)[0], "fail")

    def test_missing_side_is_skip_not_pass(self):
        self.assertEqual(reconcile.compare("x", None, 3, 0.1)[0], "skip")

    def test_fiscal_quarter(self):
        self.assertEqual(reconcile.fiscal_quarter("2026-09-30"), "Q2 FY27")
        self.assertEqual(reconcile.fiscal_quarter("2026-03-31"), "Q4 FY26")
        self.assertEqual(reconcile.fiscal_quarter("2025-12-31"), "Q3 FY26")

    def test_stale_pe_is_caught(self):
        # The original bug: a cached P/E of 17.45 beside a live price of 2,499.10 and EPS 142.66
        payload = {"quote": {"cmp": 2499.1}, "valuation": {"peRatio": 17.454, "eps": 142.66}}
        pe = dict(reconcile.checks(payload))["multiple.pe_arith"]()
        self.assertEqual(pe[0], "fail")

    def test_dollar_statements_are_caught(self):
        # Infosys read as rupees: revenue of about 2,000 crore against a 4.65 lakh crore market cap
        payload = {"quote": {"marketCapCr": 465023}, "financials": {"ratios": {"revenueCr": 2036}}}
        self.assertEqual(dict(reconcile.checks(payload))["size.units_sane"]()[0], "fail")


class CurrencyTests(unittest.TestCase):
    def _ticker(self, currency, summary_revenue, statement_revenue):
        t = mock.Mock()
        t.get_info.return_value = {"financialCurrency": currency, "totalRevenue": summary_revenue}
        t.income_stmt = pd.DataFrame({pd.Timestamp("2026-03-31"): [statement_revenue]}, index=["Total Revenue"])
        return t

    def test_infosys_statements_in_dollars(self):
        self.assertEqual(yahoo.statement_currency(self._ticker("USD", 2.0e10, 2.0e10)), "USD")

    def test_hcltech_statements_already_in_rupees(self):
        self.assertEqual(yahoo.statement_currency(self._ticker("USD", 1.48e10, 1.4e12)), "INR")

    def test_rupee_filer_untouched(self):
        frame = pd.DataFrame({pd.Timestamp("2026-03-31"): [5.0, 12.5]}, index=["Total Revenue", "Basic EPS"])
        self.assertIs(yahoo.frame_in_inr(frame, "INR"), frame)

    def test_conversion_uses_period_rate_and_keeps_counts(self):
        frame = pd.DataFrame({pd.Timestamp("2026-03-31"): [10.0, 0.2, 4.0]}, index=["Total Revenue", "Basic EPS", "Diluted Average Shares"])
        with mock.patch.object(yahoo, "inr_rate", return_value=90.0):
            out = yahoo.frame_in_inr(frame, "USD")
        col = out.columns[0]
        self.assertEqual(out.loc["Total Revenue", col], 900.0)
        self.assertEqual(out.loc["Basic EPS", col], 18.0)
        self.assertEqual(out.loc["Diluted Average Shares", col], 4.0)


if __name__ == "__main__":
    unittest.main()


class WatchdogFigureIncidentTests(unittest.TestCase):
    def test_mismatch_opens_then_resolves(self):
        import tempfile
        from pathlib import Path

        from app import watchdog

        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(watchdog, "STATE_PATH", Path(tmp) / "s.json"):
            bad = [reconcile.Result("TCS", "multiple.pe_arith", "fail", "P/E vs price / EPS: 17.45 vs 17.52")]
            with mock.patch.object(reconcile, "reconcile", return_value=bad), mock.patch.object(reconcile, "reconcile_market", return_value=[]):
                state = watchdog.reconcile_figures("http://x")
            inc = state["open"]["Figures: multiple.pe_arith"]
            self.assertEqual(inc["kind"], "mismatch")
            self.assertIn("TCS", inc["problem"])

            good = [reconcile.Result("TCS", "multiple.pe_arith", "pass", "ok")]
            with mock.patch.object(reconcile, "reconcile", return_value=good), mock.patch.object(reconcile, "reconcile_market", return_value=[]):
                state = watchdog.reconcile_figures("http://x")
            self.assertNotIn("Figures: multiple.pe_arith", state["open"])
            self.assertEqual(state["resolved"][-1]["resolvedBy"], "figures agree again")
