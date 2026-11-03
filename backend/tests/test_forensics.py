import unittest

from app.services import forensics


def statements(rows: dict[str, list[float]], dates=("2026-03-31", "2025-03-31", "2024-03-31")):
    frame = {"dates": list(dates), "rows": [{"label": k, "values": v} for k, v in rows.items()]}
    return {"income": {"annual": frame}, "balance": {"annual": frame}, "cashflow": {"annual": frame}}


BASE = {
    "Net Income": [120.0, 100.0, 90.0],
    "Total Assets": [1000.0, 950.0, 900.0],
    "Operating Cash Flow": [150.0, 110.0, 95.0],
    "Long Term Debt And Capital Lease Obligation": [50.0, 80.0, 90.0],
    "Current Assets": [500.0, 450.0, 400.0],
    "Current Liabilities": [200.0, 220.0, 230.0],
    "Ordinary Shares Number": [10.0, 10.0, 10.0],
    "Total Revenue": [1200.0, 1050.0, 950.0],
    "Gross Profit": [500.0, 420.0, 370.0],
}


class ForensicsTests(unittest.TestCase):
    def test_piotroski_all_nine_on_improving_company(self):
        f = forensics.piotroski(forensics.Lines(statements(BASE)))
        self.assertEqual((f["score"], f["of"]), (9, 9))

    def test_dilution_fails_one_signal(self):
        rows = dict(BASE, **{"Ordinary Shares Number": [12.0, 10.0, 10.0]})
        f = forensics.piotroski(forensics.Lines(statements(rows)))
        self.assertEqual(f["score"], 8)
        self.assertFalse(next(s for s in f["signals"] if s["test"] == "No new shares issued")["pass"])

    def test_implied_growth_matches_perpetuity(self):
        # 100 growing 5% forever at 12% is worth 105 / 0.07 = 1,500
        self.assertAlmostEqual(forensics.implied_growth(100, 1500, 0.12, 0.05), 5.0, places=1)
        self.assertIsNone(forensics.implied_growth(-50, 1500, 0.12, 0.05))

    def test_scores_withheld_when_yahoo_lines_disagree_with_vetted(self):
        vetted = {"annual": [{"periodEnd": "2026-03-31", "revenue": 1500.0, "netProfit": 120.0}], "balanceSheet": []}
        out = forensics.build(statements(BASE), vetted, 5000.0, lender=False)
        self.assertIn("withheld", out)
        self.assertNotIn("piotroski", out)

    def test_lenders_get_no_operating_scores(self):
        vetted = {"annual": [{"periodEnd": "2026-03-31", "revenue": 1200.0, "netProfit": 120.0}], "balanceSheet": []}
        out = forensics.build(statements(BASE), vetted, 5000.0, lender=True)
        self.assertTrue(out["lender"])
        self.assertNotIn("piotroski", out)


if __name__ == "__main__":
    unittest.main()
