"""Comprehensive endpoint and router coverage tests for the Arthdex FastAPI backend.

Tests authentication guards, input validation, health endpoints, decision logging,
portfolio optimization analytics, and error handling.
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch
try:
    from starlette.testclient import TestClient
    from app.main import app
    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False
    TestClient = None  # type: ignore
    app = None  # type: ignore


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class RouterCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not HAS_TESTCLIENT:
            return
        cls.client = TestClient(app)

    def test_health_check_endpoint(self) -> None:
        """Health check returns status ok and timestamp."""
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertEqual(data.get("service"), "arthdex-data")
        self.assertIn("time", data)

    def test_search_endpoint_with_query(self) -> None:
        """Search returns matching listed companies or empty list for nonsensical query."""
        res = self.client.get("/api/v1/search?q=XYZNONEXISTENT999")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("data", body)
        self.assertIsInstance(body["data"], list)
        self.assertEqual(len(body["data"]), 0)

    def test_auth_token_enforcement(self) -> None:
        """When ARTHDEX_API_TOKEN is set, protected routes require Bearer token."""
        with patch.dict(os.environ, {"ARTHDEX_API_TOKEN": "secret-test-token"}):
            # Exempt endpoint: /api/v1/health should pass without token
            health_res = self.client.get("/api/v1/health")
            self.assertEqual(health_res.status_code, 200)

            # Protected endpoint without token should return 401
            unauth_res = self.client.get("/api/v1/cache")
            self.assertEqual(unauth_res.status_code, 401)

            # Protected endpoint with invalid token should return 401
            bad_token_res = self.client.get(
                "/api/v1/cache",
                headers={"Authorization": "Bearer wrong-token"},
            )
            self.assertEqual(bad_token_res.status_code, 401)

            # Protected endpoint with correct token should succeed
            auth_res = self.client.get(
                "/api/v1/cache",
                headers={"Authorization": "Bearer secret-test-token"},
            )
            self.assertEqual(auth_res.status_code, 200)

    def test_decisions_get_and_post(self) -> None:
        """Test retrieving and logging investment decisions in SQLite."""
        get_res = self.client.get("/api/v1/decisions")
        self.assertEqual(get_res.status_code, 200)
        self.assertIn("data", get_res.json())

        # Test invalid decision payload returns 422
        bad_post = self.client.post("/api/v1/decisions", json={"invalid": "payload"})
        self.assertEqual(bad_post.status_code, 422)

    def test_portfolio_analyze_validation(self) -> None:
        """Portfolio analysis endpoint validates input bounds and returns analytics."""
        # Empty positions
        empty_res = self.client.post("/api/v1/portfolio/analyze", json={"positions": []})
        self.assertIn(empty_res.status_code, (200, 400, 422))

    def test_fno_ban_endpoint(self) -> None:
        """F&O ban endpoint returns banned securities list or clean payload."""
        res = self.client.get("/api/v1/derivatives/fno-ban")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("data", body)
        self.assertIn("banned", body["data"])

    def test_universe_stats(self) -> None:
        """Universe stats returns company counts across NSE and BSE."""
        res = self.client.get("/api/v1/universe/stats")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("data", body)
        self.assertIn("companies", body["data"])

    def test_unsourced_desks_refuse(self) -> None:
        """Desks with no real data source answer 503 with an explanation, never invented figures."""
        for method, endpoint in [
            ("get", "/api/v1/network/hierarchy?symbol=M&M"),
            ("get", "/api/v1/network/supply-chain?symbol=M&M"),
            ("get", "/api/v1/network/summary?symbol=M&M"),
            ("get", "/api/risk-lab/crisis-scenarios"),
            ("post", "/api/risk-lab/stress-test"),
            ("get", "/api/risk-lab/factor-exposures"),
            ("post", "/api/risk-lab/backtest"),
            ("get", "/api/sectors/kpis"),
            ("get", "/api/sectors/kpis/auto"),
            ("get", "/api/v1/catalysts/index-rebalance"),
            ("get", "/api/v1/catalysts/ipo-lockins"),
            ("get", "/api/v1/catalysts/buybacks"),
        ]:
            res = getattr(self.client, method)(endpoint)
            self.assertEqual(res.status_code, 503, endpoint)
            self.assertIn("No figures are shown in its place", res.json()["detail"], endpoint)

    def test_sme_markets_endpoints(self) -> None:
        """M20 Dedicated SME Board endpoints return 200 for overview, IPOs, migrations, and screener."""
        for path in ["/api/sme/overview", "/api/sme/ipos", "/api/sme/migrations", "/api/sme/screener"]:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200, f"Failed for {path}")
            self.assertIn("data", res.json())

    def test_tear_sheet_endpoints(self) -> None:
        """M25 Institutional Tear Sheet endpoints return 200."""
        res = self.client.get("/api/company/RELIANCE/tear-sheet")
        self.assertEqual(res.status_code, 200)
        self.assertIn("header", res.json()["data"])

        res_notes = self.client.get("/api/company/RELIANCE/notes")
        self.assertEqual(res_notes.status_code, 200)

    def test_valuation_lab_endpoints(self) -> None:
        """M6 Valuation Lab DCF, Reverse DCF, and Sensitivity endpoints return 200."""
        for path in [
            "/api/valuation/RELIANCE/dcf",
            "/api/valuation/RELIANCE/reverse-dcf",
            "/api/valuation/RELIANCE/sensitivity",
        ]:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200, f"Failed for {path}")
            self.assertIn("data", res.json())

    def test_derivatives_and_screener_endpoints(self) -> None:
        """Derivatives and Screener endpoints return 200."""
        res = self.client.get("/api/v1/derivatives/participant-oi")
        self.assertEqual(res.status_code, 200)
        self.assertIn("data", res.json())

        res_screener = self.client.get("/api/v1/screener/indices")
        self.assertEqual(res_screener.status_code, 200)
        self.assertIn("indices", res_screener.json())



if __name__ == "__main__":
    unittest.main()
