"""Risk lab: every result is arithmetic on supplied price series; the code holds no market figures."""

from __future__ import annotations

import unittest
from datetime import date, timedelta
from unittest.mock import patch

from app.services import risk_lab
from app.services.risk_lab import index_move, regression_beta, replay, sma_backtest, trade_charges, window_change_pct

try:
    from starlette.testclient import TestClient

    from app.main import app
    from app.routers import quant_risk_lab as router_module

    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False


def series(start: date, closes: list[float]) -> list[tuple[date, float]]:
    return [(start + timedelta(days=i), c) for i, c in enumerate(closes)]


def geometric(start: date, n: int, base: float, step: float, wobble: float = 0.0) -> list[tuple[date, float]]:
    out, price = [], base
    for i in range(n):
        out.append((start + timedelta(days=i), price))
        price *= 1.0 + step + (wobble if i % 2 else -wobble)
    return out


SCENARIO = {"scenario_id": "t", "name": "Test window", "start": "2020-01-10", "end": "2020-01-20", "description": "d"}
INDEX = series(date(2020, 1, 1), [100.0] * 10 + [100, 98, 96, 94, 92, 90, 88, 86, 84, 82, 80] + [80.0] * 5)


class WindowTests(unittest.TestCase):
    def test_change_between_the_two_dates(self):
        self.assertAlmostEqual(window_change_pct(INDEX, date(2020, 1, 10), date(2020, 1, 20)), -18.0, places=6)

    def test_series_that_starts_after_the_window_gives_none(self):
        late = series(date(2020, 1, 15), [50.0] * 20)
        self.assertIsNone(window_change_pct(late, date(2020, 1, 10), date(2020, 1, 20)))
        self.assertIsNone(window_change_pct([], date(2020, 1, 10), date(2020, 1, 20)))

    def test_non_trading_start_uses_the_last_close_before_it(self):
        gappy = [(date(2020, 1, 8), 200.0), (date(2020, 1, 13), 150.0), (date(2020, 1, 20), 100.0)]
        self.assertAlmostEqual(window_change_pct(gappy, date(2020, 1, 10), date(2020, 1, 20)), -50.0)


class BetaTests(unittest.TestCase):
    def test_beta_of_a_series_that_moves_twice_the_index(self):
        start = date(2018, 1, 1)
        idx, stock, i, s = [], [], 100.0, 100.0
        for k in range(300):
            r = 0.01 if k % 3 == 0 else -0.004
            i *= 1 + r
            s *= 1 + 2 * r
            idx.append((start + timedelta(days=k), i))
            stock.append((start + timedelta(days=k), s))
        beta, n = regression_beta(stock, idx)
        self.assertAlmostEqual(beta, 2.0, places=6)
        self.assertEqual(n, 299)

    def test_too_little_history_gives_none(self):
        self.assertIsNone(regression_beta(series(date(2020, 1, 1), [1.0, 1.1, 1.2]), INDEX))


class ReplayTests(unittest.TestCase):
    def test_listed_holding_uses_its_own_prices(self):
        stock = series(date(2020, 1, 1), [50.0] * 10 + [50, 45, 45, 45, 45, 45, 45, 45, 45, 40, 40] + [40.0] * 5)
        out = replay([{"symbol": "AAA", "value_inr": 100_000}], SCENARIO, {"AAA": stock}, INDEX)
        row = out["holdings"][0]
        self.assertEqual((row["method"], row["change_pct"], row["pnl_inr"]), ("recorded", -20.0, -20_000.0))
        self.assertEqual(out["index_change_pct"], -18.0)
        self.assertEqual(out["relative_to_index_pct"], -2.0)
        self.assertEqual(out["coverage_pct"], 100.0)

    def test_holding_with_no_history_is_unavailable_and_left_out_of_the_total(self):
        stock = series(date(2020, 1, 1), [50.0] * 10 + [50.0] * 9 + [40.0] * 7)
        out = replay(
            [{"symbol": "AAA", "value_inr": 100_000}, {"symbol": "GHOST", "value_inr": 100_000}],
            SCENARIO, {"AAA": stock, "GHOST": []}, INDEX,
        )
        ghost = next(r for r in out["holdings"] if r["symbol"] == "GHOST")
        self.assertEqual((ghost["method"], ghost["change_pct"], ghost["pnl_inr"]), ("unavailable", None, None))
        self.assertEqual(out["coverage_pct"], 50.0)
        self.assertEqual(out["pnl_inr"], -20_000.0)
        self.assertEqual(out["methods"], {"recorded": 1, "estimated": 0, "unavailable": 1})

    def test_holding_listed_later_is_estimated_from_beta_and_marked(self):
        start = date(2019, 6, 1)
        idx, stock, i, s = [], [], 100.0, 100.0
        for k in range(400):
            r = 0.01 if k % 3 == 0 else -0.006
            i *= 1 + r
            s *= 1 + 1.5 * r
            idx.append((start + timedelta(days=k), i))
            if k >= 250:  # listed after the window opens
                stock.append((start + timedelta(days=k), s))
        scenario = dict(SCENARIO, start=(start + timedelta(days=100)).isoformat(), end=(start + timedelta(days=200)).isoformat())
        out = replay([{"symbol": "NEW", "value_inr": 10_000}], scenario, {"NEW": stock}, idx)
        row = out["holdings"][0]
        self.assertEqual(row["method"], "estimate")
        self.assertAlmostEqual(row["beta"], 1.5, places=2)
        self.assertAlmostEqual(row["change_pct"], round(1.5 * out["index_change_pct"], 2), delta=0.05)
        self.assertIn("estimated", row["note"])

    def test_bad_portfolios_are_refused(self):
        for bad in ([], [{"symbol": "A", "value_inr": -5}], [{"symbol": "", "value_inr": 5}], [{"symbol": "A", "value_inr": float("nan")}]):
            with self.assertRaises(ValueError):
                replay(bad, SCENARIO, {}, INDEX)

    def test_scenarios_carry_dates_only(self):
        for s in risk_lab.SCENARIOS:
            self.assertEqual(set(s), {"scenario_id", "name", "start", "end", "description"})
            self.assertFalse(any(ch.isdigit() and "%" in s["description"] for ch in s["description"]))


class IndexMoveTests(unittest.TestCase):
    def test_holding_moves_by_beta_times_the_index(self):
        start = date(2018, 1, 1)
        idx, stock, i, s = [], [], 100.0, 100.0
        for k in range(300):
            r = 0.01 if k % 3 == 0 else -0.004
            i *= 1 + r
            s *= 1 + 0.5 * r
            idx.append((start + timedelta(days=k), i))
            stock.append((start + timedelta(days=k), s))
        out = index_move([{"symbol": "LOW", "value_inr": 200_000}], -10.0, {"LOW": stock}, idx)
        self.assertEqual(out["holdings"][0]["change_pct"], -5.0)
        self.assertEqual(out["pnl_inr"], -10_000.0)


class BacktestTests(unittest.TestCase):
    def test_charges_add_up(self):
        c = trade_charges(100_000.0, 0.0, 20.0)
        self.assertAlmostEqual(c["stt"], 100.0)
        self.assertAlmostEqual(c["stamp_duty"], 15.0)
        self.assertAlmostEqual(c["total"], c["stt"] + c["exchange"] + c["sebi"] + c["stamp_duty"] + c["gst"] + c["brokerage"])

    def test_flat_prices_make_no_trades_and_lose_nothing(self):
        out = sma_backtest("FLAT", series(date(2020, 1, 1), [100.0] * 400), fast=5, slow=20)
        for part in ("earlier_period", "later_period"):
            self.assertEqual(out[part]["closed_trades"], 0)
            self.assertEqual(out[part]["net_return_pct"], 0.0)
            self.assertEqual(out[part]["charges_paid_inr"], 0.0)

    def test_result_depends_on_the_prices_supplied(self):
        def waves(up: float, down: float) -> list[tuple[date, float]]:
            out, price = [], 100.0
            for k in range(600):
                out.append((date(2020, 1, 1) + timedelta(days=k), price))
                price *= 1.0 + (up if (k // 40) % 2 == 0 else down)
            return out

        rising = sma_backtest("UP", waves(0.010, -0.006), fast=5, slow=20)
        falling = sma_backtest("DOWN", waves(0.006, -0.010), fast=5, slow=20)
        self.assertGreater(rising["earlier_period"]["closed_trades"], 0)
        self.assertGreater(rising["earlier_period"]["buy_and_hold_return_pct"], 0)
        self.assertLess(falling["earlier_period"]["buy_and_hold_return_pct"], 0)
        self.assertGreater(rising["earlier_period"]["final_capital_inr"], falling["earlier_period"]["final_capital_inr"])
        self.assertGreater(rising["earlier_period"]["charges_paid_inr"], 0)

    def test_capital_is_never_overspent(self):
        out = sma_backtest("UP", geometric(date(2020, 1, 1), 500, 100.0, 0.002, 0.02), fast=5, slow=20, initial_capital=10_000)
        self.assertGreater(out["earlier_period"]["final_capital_inr"], 0)

    def test_bad_periods_and_short_history_are_refused(self):
        long = series(date(2020, 1, 1), [100.0] * 400)
        for fast, slow in ((0, 50), (50, 20), (20, 20)):
            with self.assertRaises(ValueError):
                sma_backtest("X", long, fast=fast, slow=slow)
        with self.assertRaises(ValueError):
            sma_backtest("X", series(date(2020, 1, 1), [100.0] * 60), fast=5, slow=20)


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class EndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        long_index = geometric(date(2007, 1, 1), 7000, 4000.0, 0.0003, 0.004)
        stock = geometric(date(2007, 1, 1), 7000, 100.0, 0.0004, 0.006)

        def history(symbol):
            sym = symbol.upper()
            return long_index if sym == "NIFTY50" else stock if sym == "AAA" else []

        patcher = patch.object(router_module, "_history", side_effect=history)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_scenarios_report_a_computed_index_change(self):
        for path in ("/api/v1/risk-lab/scenarios", "/api/risk-lab/crisis-scenarios"):
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200)
            rows = res.json()["data"]
            self.assertEqual(len(rows), len(risk_lab.SCENARIOS))
            self.assertTrue(all(isinstance(r["index_change_pct"], float) for r in rows))

    def test_stress_test_replay_and_index_move(self):
        body = {"portfolio": [{"symbol": "aaa", "value_inr": 100000}, {"symbol": "GHOST", "value_inr": 50000}], "scenario_id": "covid_2020"}
        res = self.client.post("/api/v1/risk-lab/stress-test", json=body)
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["methods"], {"recorded": 1, "estimated": 0, "unavailable": 1})
        res = self.client.post("/api/v1/risk-lab/stress-test", json={"portfolio": [{"symbol": "AAA", "value_inr": 1000}], "index_move_pct": -10})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["holdings"][0]["method"], "estimate")

    def test_stress_test_input_is_validated(self):
        post = lambda body: self.client.post("/api/v1/risk-lab/stress-test", json=body).status_code  # noqa: E731
        self.assertEqual(post({"portfolio": [], "scenario_id": "covid_2020"}), 422)
        self.assertEqual(post({"portfolio": [{"symbol": "AAA", "value_inr": -1}], "scenario_id": "covid_2020"}), 422)
        self.assertEqual(post({"portfolio": [{"symbol": "AAA", "value_inr": 1}], "scenario_id": "nope"}), 404)
        self.assertEqual(post({"portfolio": [{"symbol": "AAA", "value_inr": 1}]}), 400)
        self.assertEqual(post({"portfolio": [{"symbol": "A", "value_inr": 1}] * 16, "scenario_id": "covid_2020"}), 422)

    def test_backtest(self):
        res = self.client.post("/api/v1/risk-lab/backtest", json={"symbol": "AAA", "fast_period": 10, "slow_period": 30, "years": 5})
        self.assertEqual(res.status_code, 200)
        self.assertIn("later_period", res.json()["data"])
        self.assertEqual(self.client.post("/api/v1/risk-lab/backtest", json={"symbol": "GHOST"}).status_code, 404)
        self.assertEqual(self.client.post("/api/v1/risk-lab/backtest", json={"symbol": "AAA", "fast_period": 0}).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/risk-lab/backtest", json={"symbol": "AAA", "fast_period": 60, "slow_period": 50}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
