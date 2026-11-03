import tempfile
import unittest
from datetime import datetime, time, timezone
from pathlib import Path

from app import scheduler
from app.store import Store


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(url="", sqlite_path=Path(self.tmp.name) / "t.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_put_history_latest_and_upsert(self):
        self.store.put("flows", "2026-11-02", {"fii": -1.5})
        self.store.put("flows", "2026-11-03", {"fii": 2.0}, source="NSE")
        self.store.put("flows", "2026-11-03", {"fii": 2.5}, source="NSE")  # restated by the source
        hist = self.store.history("flows")
        self.assertEqual([h["asOf"] for h in hist], ["2026-11-02", "2026-11-03"])
        self.assertEqual(self.store.latest("flows")["value"], {"fii": 2.5})

    def test_keys_are_separate_series(self):
        self.store.put("snap", "2026-11-03", 1, key="TCS")
        self.store.put("snap", "2026-11-03", 2, key="INFY")
        self.assertEqual(self.store.latest("snap", key="INFY")["value"], 2)


class DueTests(unittest.TestCase):
    def at(self, h, m, day=4):  # 4 Nov 2026 is a Wednesday; IST = UTC + 5:30
        return datetime(2026, 11, day, h, m, tzinfo=scheduler.IST).astimezone(timezone.utc)

    def test_daily_job_waits_for_its_time_then_runs_once(self):
        job = scheduler.Job("x", lambda: None, daily_after_ist=time(19, 0))
        self.assertFalse(scheduler.due(job, self.at(18, 0), None))
        self.assertTrue(scheduler.due(job, self.at(19, 5), None))
        self.assertFalse(scheduler.due(job, self.at(22, 0), self.at(19, 6)))
        self.assertTrue(scheduler.due(job, self.at(19, 5, day=5), self.at(19, 6)))

    def test_missed_daily_run_catches_up_after_restart(self):
        job = scheduler.Job("x", lambda: None, daily_after_ist=time(19, 0))
        self.assertTrue(scheduler.due(job, self.at(23, 30), self.at(19, 0, day=3)))

    def test_weekdays_only(self):
        job = scheduler.Job("x", lambda: None, daily_after_ist=time(19, 0), weekdays_only=True)
        self.assertFalse(scheduler.due(job, self.at(20, 0, day=7), None))  # Saturday

    def test_failure_is_recorded_not_raised(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(url="", sqlite_path=Path(tmp) / "t.db")

            def boom():
                raise RuntimeError("upstream down")

            ok = scheduler.run_job(scheduler.Job("boom", boom, every_minutes=5), store)
            self.assertFalse(ok)
            row = store.query("SELECT last_ok, last_error, last_finished FROM job_runs WHERE job = ?", ("boom",))[0]
            self.assertEqual(row[0], 0)
            self.assertIn("upstream down", row[1])
            self.assertIsNone(row[2])  # so it is due again, after the backoff
            scheduler.JOBS.append(scheduler.Job("boom", boom, every_minutes=5))
            try:
                self.assertEqual(scheduler.tick(store), [])  # inside the backoff window
                later = datetime.now(timezone.utc) + scheduler.RETRY_AFTER
                self.assertEqual(scheduler.tick(store, later), ["boom"])
            finally:
                scheduler.JOBS.pop()


if __name__ == "__main__":
    unittest.main()
