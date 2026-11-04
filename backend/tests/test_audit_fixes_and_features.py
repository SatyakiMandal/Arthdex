import unittest
from datetime import date, datetime, timezone
import pandas as pd
import numpy as np
from unittest import mock

from app.cache import TTLCache
from app.store import Store
from app import scheduler
from app.services import options_gex, forensics, news
from app.providers import nse_xbrl


class CacheEnhancementTests(unittest.TestCase):
    def test_single_flight_and_lru_eviction(self):
        cache = TTLCache(max_entries=3)
        calls = 0

        def fetch():
            nonlocal calls
            calls += 1
            return calls

        # Initial fetch
        val, _ = cache.get_or_fetch("k1", 60, fetch)
        self.assertEqual(val, 1)
        self.assertEqual(calls, 1)

        # Cache hit
        val2, _ = cache.get_or_fetch("k1", 60, fetch)
        self.assertEqual(val2, 1)
        self.assertEqual(calls, 1)

        # Add more entries to trigger LRU eviction
        cache.set("k2", 2)
        cache.set("k3", 3)
        cache.set("k4", 4)  # k1 should be evicted (oldest)

        self.assertIsNone(cache.get_entry("k1"))
        self.assertIsNotNone(cache.get_entry("k4"))


class SchedulerPreserveTests(unittest.TestCase):
    def test_failure_preserves_existing_last_finished(self):
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmp:
            store = Store(url="", sqlite_path=Path(tmp) / "s.db")
            store.ensure_schema()
            
            # Record a successful run
            job = scheduler.Job("test_job", lambda: True, every_minutes=5)
            self.assertTrue(scheduler.run_job(job, store))
            row1 = store.query("SELECT last_finished, last_ok FROM job_runs WHERE job = ?", ("test_job",))[0]
            first_finished = row1[0]
            self.assertIsNotNone(first_finished)
            self.assertEqual(row1[1], 1)

            # Now run a failing job
            def boom():
                raise RuntimeError("temporary failure")
            failing_job = scheduler.Job("test_job", boom, every_minutes=5)
            self.assertFalse(scheduler.run_job(failing_job, store))

            row2 = store.query("SELECT last_finished, last_ok FROM job_runs WHERE job = ?", ("test_job",))[0]
            # last_finished should NOT be overwritten with None!
            self.assertEqual(row2[0], first_finished)
            self.assertEqual(row2[1], 0)


class OptionsGexTests(unittest.TestCase):
    def test_greeks_dealer_sign_consistency(self):
        # Calls: dealer is +1, Puts: dealer is -1
        # Greeks: delta for call > 0, delta for put < 0
        # When dealer sign is applied:
        # call dealer * delta > 0
        # put dealer * delta = (-1) * (<0) > 0
        c_g = options_gex.greeks(100.0, np.array([100.0]), np.array([0.1]), np.array([0.2]), np.array([True]))
        p_g = options_gex.greeks(100.0, np.array([100.0]), np.array([0.1]), np.array([0.2]), np.array([False]))
        
        c_dealer_delta = 1.0 * c_g["delta"][0]
        p_dealer_delta = -1.0 * p_g["delta"][0]
        
        self.assertGreater(c_dealer_delta, 0)
        self.assertGreater(p_dealer_delta, 0)


class ForensicsEnhancementTests(unittest.TestCase):
    def test_piotroski_debt_free_passes_leverage(self):
        class MockLines:
            def get(self, name, i):
                if name == "Operating Cash Flow": return 10.0
                if name == "Total Assets": return 100.0
                if name == "Current Assets": return 50.0
                if name == "Current Liabilities": return 25.0
                if name == "Total Revenue": return 80.0
                if name == "Gross Profit": return 40.0
                return 10.0
            def first(self, names, i):
                if "Debt" in str(names): return 0.0  # Zero debt both years
                if "Shares" in str(names): return 1000.0
                return 10.0
        
        signals = forensics.piotroski(MockLines())
        lev_sig = next(s for s in signals["signals"] if s["test"] == "Long-term leverage fell")
        self.assertTrue(lev_sig["pass"])

    def test_reverse_dcf_year_gap_cagr(self):
        class MockLines:
            def get(self, name, i):
                if name == "Free Cash Flow": return 10.0
                if name == "Total Debt": return 0.0
                return None
            def first(self, names, i):
                return 10.0
        
        # Revenue history with 2-year jump between 2024 and 2026
        annual_rev = [
            {"period": "2024-03-31", "revenue": 100.0},
            {"period": "2026-03-31", "revenue": 144.0},
        ]
        out = forensics.reverse_dcf_inputs(MockLines(), 1000.0, annual_rev)
        self.assertIsNotNone(out)
        # CAGR over 2 years: sqrt(144/100) - 1 = 1.2 - 1 = 20%
        self.assertEqual(out["revenueCagr"]["3y"], None)


class XbrlChronologicalSortTests(unittest.TestCase):
    def test_parse_broadcast_date_sorting(self):
        # Check date string parsing helper
        dates = ["02-Nov-2026 10:00:00", "25-Oct-2026 15:00:00", "01-Nov-2026 09:00:00"]
        def _to_sort_key(d_str):
            for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M", "%d-%b-%Y"):
                try:
                    return datetime.strptime(d_str, fmt).isoformat()
                except Exception:
                    pass
            return d_str
        
        sorted_dates = sorted(dates, key=_to_sort_key, reverse=True)
        self.assertEqual(sorted_dates[0], "02-Nov-2026 10:00:00")
        self.assertEqual(sorted_dates[1], "01-Nov-2026 09:00:00")
        self.assertEqual(sorted_dates[2], "25-Oct-2026 15:00:00")


class FilingClassificationTests(unittest.TestCase):
    def test_classify_filing_categories(self):
        self.assertEqual(news.classify_filing("Outcome of Board Meeting - Financial Results"), "Results")
        self.assertEqual(news.classify_filing("Bagging of Order worth Rs 500 Cr"), "Order Win")
        self.assertEqual(news.classify_filing("Acquisition of 51% stake in XYZ Ltd"), "Acquisition / M&A")
        self.assertEqual(news.classify_filing("Recommendation of Final Dividend"), "Dividend / Action")
        self.assertEqual(news.classify_filing("Resignation of Chief Financial Officer"), "Board / KMP / Auditor")
        self.assertEqual(news.classify_filing("CRISIL upgrades rating to AAA"), "Credit Rating")
        self.assertEqual(news.classify_filing("Receipt of tax notice from Department"), "Litigation / Regulatory")
        self.assertEqual(news.classify_filing("Investor Presentation on Q2"), "Investor Presentation")
        self.assertEqual(news.classify_filing("General disclosure"), "General")


if __name__ == "__main__":
    unittest.main()
