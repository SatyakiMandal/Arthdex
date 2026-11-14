"""Regression tests for the 2026-11-13 security review (docs/code-review/addendum-2026-11-13.md)."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

try:
    from starlette.testclient import TestClient

    from app.main import MAX_BODY_BYTES, app
    from app.services import paper_trading, risk_lab, tear_sheet

    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class SecurityHardeningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    # -- authentication ---------------------------------------------------------

    def test_writes_are_refused_from_the_network_when_no_token_is_set(self) -> None:
        remote = TestClient(app, client=("203.0.113.9", 50000))
        with patch.dict(os.environ, {"ARTHDEX_API_TOKEN": "", "ARTHDEX_ALLOW_OPEN_WRITES": ""}):
            res = remote.post("/api/v1/paper/order", json={"symbol": "TCS", "quantity": 1, "price": 10})
            self.assertEqual(res.status_code, 401)
            # reads stay open: the data is public market data
            self.assertEqual(remote.get("/api/v1/health").status_code, 200)

    def test_gateway_opt_out_allows_network_writes(self) -> None:
        remote = TestClient(app, client=("203.0.113.9", 50000))
        with patch.dict(os.environ, {"ARTHDEX_API_TOKEN": "", "ARTHDEX_ALLOW_OPEN_WRITES": "1"}):
            res = remote.post("/api/v1/paper/calculate-charges", json={"tradeValue": 1000})
            self.assertEqual(res.status_code, 200)

    def test_non_ascii_authorization_header_is_a_401_not_a_500(self) -> None:
        with patch.dict(os.environ, {"ARTHDEX_API_TOKEN": "secret-test-token"}):
            res = self.client.get("/api/v1/cache", headers={"Authorization": "Bearer caf\u00e9".encode("latin-1")})
            self.assertEqual(res.status_code, 401)

    def test_docs_are_not_exempt_from_the_token(self) -> None:
        with patch.dict(os.environ, {"ARTHDEX_API_TOKEN": "secret-test-token"}):
            self.assertIn(self.client.get("/openapi.json").status_code, (401, 404))

    # -- request size -----------------------------------------------------------

    def test_oversized_body_is_refused(self) -> None:
        res = self.client.post(
            "/api/v1/paper/calculate-charges",
            content=b"x" * (MAX_BODY_BYTES + 1),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(res.status_code, 413)

    # -- paper trading ----------------------------------------------------------

    def test_negative_quantity_cannot_mint_cash(self) -> None:
        before = paper_trading.VIRTUAL_ACCOUNT["cashBalance"]
        res = self.client.post(
            "/api/v1/paper/order", json={"symbol": "TCS", "action": "BUY", "quantity": -1000, "price": 100}
        )
        self.assertEqual(res.status_code, 422)
        direct = paper_trading.execute_paper_order("TCS", "BUY", -1000, 100.0)
        self.assertFalse(direct["success"])
        self.assertEqual(paper_trading.VIRTUAL_ACCOUNT["cashBalance"], before)

    def test_non_finite_price_is_refused(self) -> None:
        before = paper_trading.VIRTUAL_ACCOUNT["cashBalance"]
        for price in (float("nan"), float("inf"), 0.0, -5.0):
            self.assertFalse(paper_trading.execute_paper_order("TCS", "BUY", 1, price)["success"])
        self.assertEqual(paper_trading.VIRTUAL_ACCOUNT["cashBalance"], before)

    def test_order_history_is_capped(self) -> None:
        saved = {k: (list(v) if isinstance(v, list) else v) for k, v in paper_trading.VIRTUAL_ACCOUNT.items()}
        try:
            for _ in range(paper_trading.MAX_ORDER_HISTORY + 5):
                paper_trading.execute_paper_order("ZZTEST", "BUY", 1, 1.0)
            self.assertLessEqual(len(paper_trading.VIRTUAL_ACCOUNT["orders"]), paper_trading.MAX_ORDER_HISTORY)
        finally:
            paper_trading.VIRTUAL_ACCOUNT.clear()
            paper_trading.VIRTUAL_ACCOUNT.update(saved)

    # -- research notes ---------------------------------------------------------

    def _note(self, **over):
        body = {"title": "Thesis", "author": "QA", "firm": "Test House", "recommendation": "HOLD", "target_price": 100}
        body.update(over)
        return body

    def test_research_note_fields_are_length_limited(self) -> None:
        res = self.client.post("/api/v1/company/ZZTEST/notes", json=self._note(content="x" * 10_001))
        self.assertEqual(res.status_code, 422)
        res = self.client.post("/api/v1/company/ZZTEST/notes", json=self._note(tags=["t"] * 13))
        self.assertEqual(res.status_code, 422)

    def test_research_notes_per_symbol_are_capped(self) -> None:
        try:
            for i in range(tear_sheet.MAX_NOTES_PER_SYMBOL + 3):
                tear_sheet.add_research_note("ZZCAP", f"Note {i}", "QA", "Test House", "HOLD", 100.0)
            self.assertEqual(len(tear_sheet.get_research_notes_for_symbol("ZZCAP")), tear_sheet.MAX_NOTES_PER_SYMBOL)
        finally:
            tear_sheet._RESEARCH_NOTES_STORE.pop("ZZCAP", None)

    # -- model inputs -----------------------------------------------------------

    def test_dcf_projection_years_are_bounded(self) -> None:
        body = {
            "symbol": "TCS",
            "current_price": 100,
            "shares_outstanding_cr": 10,
            "base_fcff_cr": 100,
            "stage1_years": 10_000_000,
        }
        self.assertEqual(self.client.post("/api/v1/valuation/dcf/calculate", json=body).status_code, 422)

    def test_backtest_refuses_a_zero_period(self) -> None:
        from datetime import date, timedelta

        prices = [(date(2020, 1, 1) + timedelta(days=i), 100.0 + i % 7) for i in range(400)]
        for fast, slow in ((0, 50), (-3, 2), (50, 20)):
            with self.assertRaises(ValueError):
                risk_lab.sma_backtest("X", prices, fast=fast, slow=slow)
        res = self.client.post("/api/v1/risk-lab/backtest", json={"symbol": "TCS", "fast_period": 0})
        self.assertEqual(res.status_code, 422)

    # -- error bodies and the report sandbox --------------------------------------

    def test_server_errors_do_not_echo_exception_text(self) -> None:
        with patch.object(paper_trading, "get_virtual_account", side_effect=RuntimeError("C:\\secret\\path.db locked")):
            res = self.client.get("/api/v1/paper/account")
        self.assertEqual(res.status_code, 503)
        self.assertNotIn("secret", res.text)
        self.assertIn("Paper trading account unavailable", res.text)

    def test_report_sandbox_has_an_opaque_origin(self) -> None:
        import inspect

        from app.routers import analyzer

        self.assertNotIn('"sandbox allow-same-origin', inspect.getsource(analyzer.get_report))


if __name__ == "__main__":
    unittest.main()
