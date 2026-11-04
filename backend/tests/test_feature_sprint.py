"""Unit tests for newly added market intelligence features:
1. F&O Ban & MWPL Tracker
2. Bhavcopy Delivery Accumulation Scanner
3. Sector Rotation RRG (Relative Rotation Graph)
4. Earnings Straddle Implied Moves
5. Multi-Company Comparison Matrix
"""

from __future__ import annotations

import unittest
from datetime import date
from unittest.mock import MagicMock, patch

import pandas as pd

from app.services import bhavcopy, comparison, earnings_moves, fno_ban, sector_rotation


class FnoBanTests(unittest.TestCase):
    @patch("app.services.fno_ban.requests.get")
    def test_parse_ban_file(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "Securities in Ban For Trade Date 05-NOV-2026:\n1,KAYNES\n2,SAIL\n3,BANDHANBNK\n"
        mock_get.return_value = mock_resp

        trade_date, syms = fno_ban.fetch_ban_file()
        self.assertEqual(trade_date, "05-NOV-2026")
        self.assertEqual(syms, ["KAYNES", "SAIL", "BANDHANBNK"])

    @patch("app.services.fno_ban.fetch_ban_file")
    def test_fno_ban_status_payload(self, mock_fetch):
        mock_fetch.return_value = ("05-NOV-2026", ["SAIL", "KAYNES"])
        status = fno_ban.get_fno_ban_status()
        self.assertEqual(status["totalBanned"], 2)
        self.assertEqual(len(status["banned"]), 2)
        self.assertEqual(status["banned"][0]["symbol"], "SAIL")
        self.assertIn("95% of Market-Wide Position Limit", status["rule"]["entryTrigger"])


class BhavcopyScannerTests(unittest.TestCase):
    @patch("app.services.bhavcopy.load_day")
    @patch("app.services.bhavcopy.previous_sessions")
    def test_bhavcopy_scanner_categories(self, mock_prev, mock_load):
        # Mock today's bhavcopy dataframe
        mock_df = pd.DataFrame([
            {
                "SYMBOL": "ACCUM_STOCK",
                "SERIES": "EQ",
                "CLOSE_PRICE": 105.0,
                "PREV_CLOSE": 100.0,
                "CHG_PCT": 5.0,
                "TURNOVER_CR": 25.0,
                "TTL_TRD_QNTY": 100000,
                "DELIV_PER": 72.0,
                "DELIV_QTY": 72000,
            },
            {
                "SYMBOL": "DISTRIB_STOCK",
                "SERIES": "EQ",
                "CLOSE_PRICE": 95.0,
                "PREV_CLOSE": 100.0,
                "CHG_PCT": -5.0,
                "TURNOVER_CR": 20.0,
                "TTL_TRD_QNTY": 80000,
                "DELIV_PER": 65.0,
                "DELIV_QTY": 52000,
            },
            {
                "SYMBOL": "ABSORB_STOCK",
                "SERIES": "EQ",
                "CLOSE_PRICE": 100.2,
                "PREV_CLOSE": 100.0,
                "CHG_PCT": 0.2,
                "TURNOVER_CR": 15.0,
                "TTL_TRD_QNTY": 90000,
                "DELIV_PER": 70.0,
                "DELIV_QTY": 63000,
            },
        ])
        mock_load.return_value = mock_df
        mock_prev.return_value = []

        scan_res = bhavcopy.scan(date(2026, 11, 4))
        self.assertIsNotNone(scan_res)
        self.assertIn("summary", scan_res)
        self.assertIn("results", scan_res)

        accum = scan_res["results"]["accumulation"]
        distrib = scan_res["results"]["distribution"]
        absorb = scan_res["results"]["absorption"]

        self.assertTrue(any(r["symbol"] == "ACCUM_STOCK" for r in accum))
        self.assertTrue(any(r["symbol"] == "DISTRIB_STOCK" for r in distrib))
        self.assertTrue(any(r["symbol"] == "ABSORB_STOCK" for r in absorb))


class SectorRotationRrgTests(unittest.TestCase):
    @patch("app.providers.yahoo.fetch_history")
    def test_rrg_quadrant_assignment(self, mock_fetch):
        # Generate synthetic series
        dates = pd.date_range("2026-06-01", periods=60, freq="B")
        bench_close = pd.Series([24000.0 + i * 20 for i in range(60)], index=dates)

        def side_effect(symbol, period):
            if symbol == "^NSEI":
                return pd.DataFrame({"Close": bench_close})
            # Sector outperforming benchmark
            sec_close = pd.Series([48000.0 + i * 60 for i in range(60)], index=dates)
            return pd.DataFrame({"Close": sec_close})

        mock_fetch.side_effect = side_effect

        data = sector_rotation.compute_rrg()
        self.assertEqual(data["benchmark"], "NIFTY 50")
        self.assertTrue(len(data["sectors"]) > 0)
        s0 = data["sectors"][0]
        self.assertIn(s0["quadrant"], ["Leading", "Weakening", "Lagging", "Improving"])
        self.assertIn("trail", s0)
        self.assertTrue(len(s0["trail"]) > 0)


class ComparisonMatrixTests(unittest.TestCase):
    @patch("app.providers.yahoo.fetch_profile")
    @patch("app.services.quote_sources.fetch")
    @patch("app.providers.yahoo.fetch_valuation")
    @patch("app.providers.screener.fetch_company")
    @patch("app.providers.fundamentals.fetch_quarterly_pnl")
    @patch("app.providers.fundamentals.fetch_balance_sheet")
    @patch("app.providers.fundamentals.fetch_annual_pnl")
    @patch("app.services.yahoo_company.statements")
    def test_compare_two_companies(
        self, mock_stmts, mock_ann, mock_bal, mock_qtr, mock_scr, mock_val, mock_quote, mock_prof
    ):
        mock_prof.return_value = {"name": "Test Company", "sector": "Tech", "industry": "IT"}
        mock_quote.return_value = {"cmp": 3500.0, "change": {"percent": 1.5}, "marketCapCr": 120000.0}
        mock_val.return_value = {"peRatio": 28.5, "pbRatio": 6.2, "evToEbitda": 18.0, "dividendYieldPct": 1.4}
        mock_scr.return_value = {"quarterly": [], "annual": []}
        mock_qtr.return_value = []
        mock_bal.return_value = []
        mock_ann.return_value = []
        mock_stmts.return_value = {"income": [], "balance": [], "cashflow": []}

        res = comparison.compare(["TCS", "INFY"])
        self.assertEqual(res["count"], 2)
        self.assertEqual(res["symbols"], ["TCS", "INFY"])
        c0 = res["companies"][0]
        self.assertEqual(c0["symbol"], "TCS")
        self.assertEqual(c0["valuation"]["peRatio"], 28.5)
        self.assertEqual(c0["price"], 3500.0)


if __name__ == "__main__":
    unittest.main()
