import tempfile
import unittest
from pathlib import Path

from app.services import fundamental_screen as fs
from app.store import Store


class ParseTests(unittest.TestCase):
    def test_reads_clauses(self):
        self.assertEqual(fs.parse("PE < 20 and roe>=18.5"), [("pe", "<", 20.0), ("roe", ">=", 18.5)])

    def test_rejects_unknown_fields_and_code(self):
        for bad in ("foo < 1", "pe < 20 OR roe > 5", "__import__('os') > 1", "pe < abc"):
            with self.assertRaises(fs.FilterError):
                fs.parse(bad)

    def test_empty_formula_matches_everything(self):
        self.assertEqual(fs.parse("  "), [])


class ScreenTests(unittest.TestCase):
    SNAPS = {
        "AAA": {"symbol": "AAA", "eps": 10.0, "bookValue": 50.0, "dividendsTtm": 4.0, "roe": 25.0, "de": 0.1, "asOf": "2026-11-03"},
        "BBB": {"symbol": "BBB", "eps": 10.0, "bookValue": 50.0, "dividendsTtm": None, "roe": None, "de": 0.1, "asOf": "2026-11-02"},
        "CCC": {"symbol": "CCC", "eps": -2.0, "bookValue": 50.0, "dividendsTtm": 0.0, "roe": 30.0, "de": 2.0, "asOf": "2026-11-03"},
    }
    LIVE = {"AAA": {"last": 150.0, "marketCapCr": 1000}, "BBB": {"last": 100.0, "marketCapCr": 2000}, "CCC": {"last": 80.0, "marketCapCr": 500}}

    def test_live_multiples(self):
        row = fs.with_live(self.SNAPS["AAA"], self.LIVE["AAA"])
        self.assertEqual((row["pe"], row["pb"], row["divyield"]), (15.0, 3.0, 2.67))
        self.assertIsNone(fs.with_live(self.SNAPS["CCC"], self.LIVE["CCC"])["pe"])  # no P/E on a loss

    def test_missing_figure_never_passes(self):
        out = fs.screen("roe > 10", self.SNAPS, self.LIVE)
        self.assertEqual(sorted(r["symbol"] for r in out["rows"]), ["AAA", "CCC"])

    def test_sort_and_range(self):
        out = fs.screen("de < 1", self.SNAPS, self.LIVE, sort="mcap")
        self.assertEqual([r["symbol"] for r in out["rows"]], ["BBB", "AAA"])
        self.assertEqual(out["snapshotRange"], {"oldest": "2026-11-02", "newest": "2026-11-03"})


class RefreshTests(unittest.TestCase):
    def test_only_stale_companies_are_refreshed(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(url="", sqlite_path=Path(tmp) / "t.db")
            from datetime import date

            store.put(fs.SERIES, date.today(), {"symbol": "FRESH"}, key="FRESH")
            calls = []

            def fetch(sym):
                calls.append(sym)
                return {"ratios": {"revenueCr": 100, "netProfitCr": 10}, "annual": [], "quarterly": []}, {"eps": 1}

            out = fs.refresh(["FRESH", "NEW"], fetch, {}, store=store, pace=0)
            self.assertEqual(calls, ["NEW"])
            self.assertEqual(out["refreshed"], ["NEW"])
            self.assertEqual(set(fs.load(store)), {"FRESH", "NEW"})


if __name__ == "__main__":
    unittest.main()
