"""Watchdog classification, repair ladder and incident lifecycle, against a fake caller.

Run from ``backend/``:  python -m unittest tests.test_watchdog -v
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app import watchdog
from app.watchdog import Check, _keys, _list


def _caller(responses):
    """Serve queued (status, body) pairs per path; the last one repeats."""
    queues = {path: list(items) for path, items in responses.items()}

    def call(method, path):
        q = queues[path]
        return q.pop(0) if len(q) > 1 else q[0]

    return call


@mock.patch.object(watchdog.time, "sleep", lambda s: None)
class WatchdogTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        patcher = mock.patch.object(watchdog, "STATE_PATH", self.tmp / "state.json")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_classifies_failures(self):
        c = Check("X", "/x", _keys(rows=1))
        kind = lambda status, body, check=c: watchdog._classify(status, body, check)[0]  # noqa: E731
        self.assertEqual(kind(0, {"detail": "refused"}), "unreachable")
        self.assertEqual(kind(403, {}), "blocked")
        self.assertEqual(kind(502, {"detail": "NSE returned 403 Forbidden"}), "blocked")
        self.assertEqual(kind(504, {}), "timeout")
        self.assertEqual(kind(500, {"detail": "KeyError: 'data'"}), "upstream_error")
        self.assertEqual(kind(200, {"data": {"other": 1}}), "schema")
        self.assertEqual(kind(200, {"data": [1]}), "schema")
        self.assertEqual(kind(200, {"data": {"rows": []}}), "empty")
        self.assertEqual(kind(200, {"data": {"rows": [1], "errors": ["rss down"]}}), "degraded")
        self.assertIsNone(kind(200, {"data": {"rows": [1]}}))
        self.assertIsNone(kind(200, {"data": [1, 2]}, Check("L", "/l", _list(2))))
        self.assertEqual(kind(200, {"data": [1]}, Check("L", "/l", _list(2))), "empty")

    def test_retry_repairs_transient_failure(self):
        call = _caller({"/x": [(504, {}), (200, {"data": {"rows": [1]}})]})
        r = watchdog.run_check(call, Check("X", "/x", _keys(rows=1)), in_process=False)
        self.assertTrue(r.ok)
        self.assertEqual(r.repaired_by, "retry after back-off")

    def test_unfixable_failure_opens_then_closes_incident(self):
        check = Check("X", "/x", _keys(rows=1))
        with mock.patch.object(watchdog, "CHECKS", (check,)):
            broken = _caller({"/x": [(200, {"data": {"renamed": []}})]})
            state = watchdog.run_all(broken, in_process=False, mode="test")
            inc = state["open"]["X"]
            self.assertEqual(inc["kind"], "schema")
            self.assertEqual(inc["occurrences"], 1)
            self.assertIn("code fix", inc["advice"])

            state = watchdog.run_all(broken, in_process=False, mode="test")
            self.assertEqual(state["open"]["X"]["occurrences"], 2)

            fixed = _caller({"/x": [(200, {"data": {"rows": [1]}})]})
            state = watchdog.run_all(fixed, in_process=False, mode="test")
            self.assertEqual(state["open"], {})
            self.assertEqual(state["resolved"][-1]["feed"], "X")

    def test_service_down_incident_closes_when_routes_answer(self):
        watchdog._save_state({"open": {"Data service": {"feed": "Data service", "kind": "unreachable"}}, "resolved": []})
        with mock.patch.object(watchdog, "CHECKS", ()):
            state = watchdog.run_all(_caller({}), in_process=False, mode="test")
        self.assertNotIn("Data service", state["open"])


if __name__ == "__main__":
    unittest.main()
