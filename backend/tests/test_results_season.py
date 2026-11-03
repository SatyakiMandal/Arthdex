import unittest
from datetime import date, timedelta

from app.services import fundamental_screen as fs
from app.services import results_season as rs


def snap(end, rev, profit, ya_rev=None, ya_profit=None):
    return {
        "latestQuarter": {"quarter": "Q2 FY27", "periodEnd": end, "revenue": rev, "netProfit": profit, "opmPct": 20.0, "eps": profit / 10},
        "yearAgoQuarter": {"periodEnd": "2025-09-30", "revenue": ya_rev, "netProfit": ya_profit, "opmPct": 18.0, "eps": (ya_profit or 0) / 10} if ya_rev else None,
        "asOf": "2026-11-03",
    }


class SeasonTests(unittest.TestCase):
    def test_season_reported_pending_and_aggregates(self):
        snaps = {
            "A": snap("2026-09-30", 110, 22, 100, 20),
            "B": snap("2026-09-30", 90, 8, 100, 10),
            "C": snap("2026-06-30", 50, 5),
            "D": snap("2026-06-30", 50, 5),
        }
        later = (date.today() + timedelta(days=3)).isoformat()
        out = rs.build(snaps, [{"symbol": "C", "date": later}], {"A": "Alpha"})
        self.assertEqual(out["season"], "2026-09-30")
        self.assertEqual(out["summary"]["reported"], 2)
        self.assertEqual(out["summary"]["revenueUp"], 1)
        self.assertEqual(out["summary"]["aggregateRevenueGrowth"], 0.0)  # 200 against 200
        self.assertEqual(out["summary"]["aggregateProfitGrowth"], 0.0)  # 30 against 30
        self.assertEqual([u["symbol"] for u in out["upcoming"]], ["C"])
        self.assertEqual(out["notScheduled"], 1)
        a = next(r for r in out["reported"] if r["symbol"] == "A")
        self.assertEqual((a["revenueGrowth"], a["profitGrowth"], a["marginChange"], a["name"]), (10.0, 10.0, 2.0, "Alpha"))

    def test_a_few_early_reporters_do_not_start_the_season(self):
        snaps = {f"S{i}": snap("2026-06-30", 10, 1) for i in range(9)}
        snaps["EARLY"] = snap("2026-09-30", 10, 1)
        self.assertEqual(rs._season(snaps), "2026-06-30")  # 1 of 10 is under a fifth
        snaps.update({"E2": snap("2026-09-30", 10, 1), "E3": snap("2026-09-30", 10, 1)})
        self.assertEqual(rs._season(snaps), "2026-09-30")  # 3 of 12 is a quarter


class ComparisonTests(unittest.TestCase):
    def test_falls_back_to_one_alternative_source_for_both_quarters(self):
        primary = [{"periodEnd": d, "revenue": 1} for d in ("2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30")]
        alt = [{"periodEnd": d, "revenue": 2} for d in ("2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30")]
        out = fs._comparison(primary, alt)
        self.assertEqual(out["comparisonSource"], "screener.in")
        self.assertEqual((out["latestQuarter"]["revenue"], out["yearAgoQuarter"]["revenue"]), (2, 2))

    def test_no_comparison_when_neither_has_the_year_ago_quarter(self):
        primary = [{"periodEnd": "2026-09-30", "revenue": 1}]
        self.assertIsNone(fs._comparison(primary, [])["yearAgoQuarter"])


class YearAgoTests(unittest.TestCase):
    def test_finds_same_quarter_last_year(self):
        q = [{"periodEnd": d} for d in ("2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30")]
        self.assertEqual(fs._year_ago(q)["periodEnd"], "2025-09-30")
        self.assertIsNone(fs._year_ago(q[1:]))


if __name__ == "__main__":
    unittest.main()
