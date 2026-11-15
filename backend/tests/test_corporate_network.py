"""Ownership network: holders and stakes are read from the company's shareholding filing."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app.services import ownership_live

try:
    from starlette.testclient import TestClient

    from app.cache import CACHE
    from app.main import app

    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False

NS = 'xmlns:in-bse-shp="http://www.bseindia.com/xbrl/shp/2025-10-31/in-bse-shp"'


def holder(table: str, n: int, name: str, shares: int, fraction: float, promoter: bool, category: str | None = None) -> str:
    ctx = f"{table}_Context{n}"
    parts = [f'<in-bse-shp:NameOfTheShareholder contextRef="D_{ctx}">{name}</in-bse-shp:NameOfTheShareholder>']
    if promoter:
        parts.append(f'<in-bse-shp:TypeOfPromoterShareholding contextRef="D_{ctx}">******</in-bse-shp:TypeOfPromoterShareholding>')
    if category:
        parts.append(f'<in-bse-shp:CategoryOfOtherIndianShareholders contextRef="D_{ctx}">{category}</in-bse-shp:CategoryOfOtherIndianShareholders>')
    parts.append(f'<in-bse-shp:NumberOfFullyPaidUpEquityShares contextRef="{ctx}" decimals="INF" unitRef="shares">{shares}</in-bse-shp:NumberOfFullyPaidUpEquityShares>')
    parts.append(f'<in-bse-shp:ShareholdingAsAPercentageOfTotalNumberOfShares contextRef="{ctx}" decimals="INF" unitRef="pure">{fraction}</in-bse-shp:ShareholdingAsAPercentageOfTotalNumberOfShares>')
    return "".join(parts)


FILING = f"""<?xml version="1.0"?><xbrli:xbrl {NS}>
{holder("OthersIndianShareholders", 1, "Parent Holdings &amp; Company Limited", 253000, 0.253, True, "Bodies Corporate")}
{holder("OthersIndianShareholders", 2, "Founder Benefit Trust", 96100, 0.0961, True, "Trusts")}
{holder("OthersIndianShareholders", 3, "Group Idle Entity Private Limited", 0, 0, True, "Bodies Corporate")}
{holder("IndividualsOrHinduUndividedFamily", 1, "A Founder", 1300, 0.0013, True)}
{holder("InsuranceCompanies", 1, "Life Insurance Corporation Of India", 98600, 0.0986, False)}
{holder("MutualFundsOrUTI", 1, "Sbi Nifty 50 Etf", 50300, 0.0503, False)}
</xbrli:xbrl>"""

MASTER = [{
    "symbol": "TESTCO", "name": "Test Company Limited", "date": "30-SEP-2026", "submissionDate": "21-OCT-2026",
    "pr_and_prgrp": "35.04", "public_val": "64.96", "xbrl": "https://example.test/SHP_1.xml", "shareholdingPatternNotes": "",
}]
UNIVERSE = [
    {"symbol": "PARENT", "name": "Parent Holdings and Company Ltd"},
    {"symbol": "LICI", "name": "Life Insurance Corporation of India"},
]


class ParseTests(unittest.TestCase):
    def setUp(self):
        self.parsed = ownership_live.parse(FILING)

    def test_promoters_with_their_filed_stakes(self):
        names = [(p["name"], p["shares"], p["pct"]) for p in self.parsed["promoters"]]
        self.assertEqual(names, [
            ("Parent Holdings & Company Limited", 253000, 25.3),
            ("Founder Benefit Trust", 96100, 9.61),
            ("A Founder", 1300, 0.13),
        ])
        self.assertEqual(self.parsed["promoters"][0]["holderType"], "Indian entity (bodies corporate)")
        self.assertEqual(self.parsed["promoters"][2]["holderType"], "Individual or HUF")
        self.assertEqual(self.parsed["promoterNamedTotalPct"], 35.04)

    def test_group_entities_holding_nothing_are_listed_separately(self):
        self.assertEqual(self.parsed["promoterGroupWithoutShares"], ["Group Idle Entity Private Limited"])
        self.assertEqual(self.parsed["promoterGroupWithoutSharesCount"], 1)

    def test_public_holders_are_not_promoters(self):
        public = [(p["name"], p["pct"], p["holderType"]) for p in self.parsed["publicHoldersAbove1Pct"]]
        self.assertEqual(public, [
            ("Life Insurance Corporation Of India", 9.86, "Insurance company"),
            ("Sbi Nifty 50 Etf", 5.03, "Mutual fund"),
        ])

    def test_document_without_holders_is_an_error(self):
        with self.assertRaises(ValueError):
            ownership_live.parse("<html>Access denied</html>")


class BuildTests(unittest.TestCase):
    def test_filing_metadata_and_links_to_listed_holders(self):
        out = ownership_live.build("testco", MASTER, lambda url: FILING, UNIVERSE)
        self.assertEqual((out["symbol"], out["asOf"], out["promoterAndGroupPct"], out["publicPct"]), ("TESTCO", "30-SEP-2026", 35.04, 64.96))
        self.assertEqual(out["promoters"][0]["symbol"], "PARENT")  # same company once "&"/"and" and "Limited"/"Ltd" are normalised
        self.assertIsNone(out["promoters"][1]["symbol"])
        self.assertEqual(out["publicHoldersAbove1Pct"][0]["symbol"], "LICI")
        self.assertEqual(out["promoterNamedTotalPct"], out["promoterAndGroupPct"])  # the names add up to the filed total
        self.assertIn("subsidiaries", out["unavailable"])

    def test_ambiguous_names_are_not_linked(self):
        twins = [{"symbol": "AAA", "name": "Twin Industries Limited"}, {"symbol": "BBB", "name": "Twin Industries Ltd"}]
        rows = [{"name": "Twin Industries Limited"}]
        ownership_live.link_listed(rows, twins)
        self.assertIsNone(rows[0]["symbol"])

    def test_unreadable_latest_filing_falls_back_to_the_previous_one(self):
        master = [dict(MASTER[0], xbrl="https://example.test/bad.xml", date="31-DEC-2026"), MASTER[0]]
        out = ownership_live.build("TESTCO", master, lambda url: "<html/>" if "bad" in url else FILING)
        self.assertEqual(out["asOf"], "30-SEP-2026")

    def test_no_filing_means_unavailable_and_nothing_generated(self):
        for master in ([], [{"symbol": "X", "xbrl": None}], [dict(MASTER[0], xbrl="https://example.test/file.pdf")]):
            with self.assertRaises(ownership_live.OwnershipUnavailable):
                ownership_live.build("WIPRO", master, lambda url: FILING)
        with self.assertRaises(ownership_live.OwnershipUnavailable):
            ownership_live.build("TESTCO", MASTER, lambda url: "<html/>")

    def test_no_hand_compiled_tables_remain(self):
        for name in ("CONGLOMERATE_HIERARCHIES", "SUPPLY_CHAIN_NETWORKS"):
            self.assertFalse(hasattr(ownership_live, name))
        with self.assertRaises(ImportError):
            __import__("app.services.corporate_network")


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class RouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_ownership_route(self):
        CACHE.expire("network:ownership:v1:TESTCO")
        self.addCleanup(CACHE.expire, "network:ownership:v1:TESTCO")

        class Response:
            text = FILING

            def raise_for_status(self):
                return None

        class Session:
            def get(self, url, timeout=0):
                return Response()

        with patch("app.routers.corporate_network.nse.nse_get", return_value=MASTER), \
             patch("app.routers.corporate_network.nse._get_session", return_value=Session()), \
             patch("app.routers.corporate_network._universe", return_value=UNIVERSE):
            res = self.client.get("/api/v1/network/ownership?symbol=testco")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["promoters"][0]["symbol"], "PARENT")

    def test_company_without_a_filing_is_a_404(self):
        with patch("app.routers.corporate_network.nse.nse_get", return_value=[]):
            res = self.client.get("/api/v1/network/ownership?symbol=ZZNOFILING")
        self.assertEqual(res.status_code, 404)

    def test_bad_symbol_and_removed_routes(self):
        self.assertEqual(self.client.get("/api/v1/network/ownership?symbol=a%20b").status_code, 400)
        for old in ("hierarchy", "supply-chain", "summary"):
            self.assertEqual(self.client.get(f"/api/v1/network/{old}?symbol=RELIANCE").status_code, 404)


if __name__ == "__main__":
    unittest.main()
