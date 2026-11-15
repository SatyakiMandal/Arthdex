"""Desks with no data source refuse instead of serving hand-entered figures; participant OI reads NSE's file."""

from __future__ import annotations

import unittest
from datetime import date
from unittest.mock import patch

from app import not_connected
from app.services import earnings_moves, fno_participants, paper_trading, surveillance

try:
    from starlette.testclient import TestClient

    from app.cache import CACHE
    from app.main import app

    HAS_TESTCLIENT = True
except Exception:
    HAS_TESTCLIENT = False

PARTICIPANT_CSV = '''""Participant wise Open Interest (no. of contracts) in Equity Derivatives as on Nov 12, 2026"",,,,,,,,,,,,,,
Client Type,Future Index Long,Future Index Short,Future Stock Long,Future Stock Short       ,Option Index Call Long,Option Index Put Long,Option Index Call Short,Option Index Put Short,Option Stock Call Long,Option Stock Put Long,Option Stock Call Short,Option Stock Put Short,Total Long Contracts      ,Total Short Contracts
Client,172115,114170,3162126,376004,3402088,3246842,3254568,3635977,2132835,1276708,1176409,1186294,13392714,9743422
DII,54372,27224,344641,4302204,2661,107306,1600,1200,2741,40248,442624,32571,551969,4807423
FII,70744,120463,3576742,2551402,774429,1097979,982538,719084,330725,416801,446804,328820,6267420,5149111
Pro,25432,60806,728203,582102,1201859,1142747,1142331,1238613,1361646,1069755,1762110,1255827,5529642,6041789
TOTAL,322663,322663,7811712,7811712,5381037,5594874,5381037,5594874,3827947,2803512,3827947,2803512,25741745,25741745
'''


class ParticipantFileTests(unittest.TestCase):
    def test_rows_and_date_are_read_from_the_file(self):
        parsed = fno_participants.parse(PARTICIPANT_CSV)
        self.assertEqual(parsed["asOf"], "2026-11-12")
        fii = next(p for p in parsed["participants"] if p["participant"] == "FII")
        self.assertEqual(fii["indexFutures"], {"long": 70744, "short": 120463, "net": -49719, "longPct": 37.0})
        self.assertEqual(fii["indexPuts"]["net"], 1097979 - 719084)
        self.assertEqual(fii["stockFutures"]["net"], 3576742 - 2551402)
        self.assertEqual(len(parsed["participants"]), 4)  # the TOTAL row is not a participant

    def test_summary_is_arithmetic_on_the_rows(self):
        out = fno_participants.summarise(fno_participants.parse(PARTICIPANT_CSV))
        self.assertEqual(out["fiiNetIndexContracts"], -49719)
        self.assertEqual(out["clientNetIndexContracts"], 172115 - 114170)
        self.assertEqual(out["fiiIndexLongPct"], 37.0)
        self.assertEqual(out["regimeTone"], "down")
        self.assertEqual(out["divergenceSignal"]["divergenceMagnitude"], (172115 - 114170) + 49719)
        self.assertIn("opposite sides", out["divergenceSignal"]["description"])

    def test_unrecognised_layout_is_an_error_not_a_guess(self):
        for text in ("", "<html>blocked</html>", "Client Type,Something Else\nFII,1\n"):
            with self.assertRaises(ValueError):
                fno_participants.parse(text)

    def test_latest_file_is_found_by_walking_back_over_the_weekend(self):
        asked: list[str] = []

        def get_text(url: str):
            asked.append(url)
            return PARTICIPANT_CSV if url.endswith("13112026.csv") else None

        out = fno_participants.fetch_latest(get_text, today=date(2026, 11, 16))  # a Monday with no file yet
        self.assertEqual(out["asOf"], "2026-11-12")
        self.assertEqual([u[-12:-4] for u in asked], ["16112026", "13112026"])  # Saturday and Sunday skipped

    def test_no_file_means_unavailable_with_no_stored_copy(self):
        with self.assertRaises(fno_participants.ParticipantDataUnavailable):
            fno_participants.fetch_latest(lambda url: None, today=date(2026, 11, 16))
        self.assertFalse(hasattr(fno_participants, "BASELINE_PARTICIPANT_OI"))


class NoStoredDataTests(unittest.TestCase):
    def test_surveillance_has_no_stored_rows(self):
        self.assertFalse(hasattr(surveillance, "BASELINE_SURVEILLANCE"))

    def test_paper_account_starts_as_cash_only(self):
        import importlib
        import inspect

        source = inspect.getsource(importlib.import_module("app.services.paper_trading"))
        self.assertNotIn('"symbol": "RELIANCE"', source)
        self.assertEqual(paper_trading.INITIAL_CASH_BALANCE, paper_trading.VIRTUAL_ACCOUNT["initialCapital"])

    def test_earnings_moves_carry_no_invented_average(self):
        import inspect

        source = inspect.getsource(earnings_moves)
        self.assertNotIn("hist_avg", source)
        self.assertNotIn("historicalAvgMovePct", source)

    def test_every_refusal_names_what_the_desk_needs(self):
        for desk, (name, needs) in not_connected.NEEDS.items():
            self.assertTrue(name and len(needs) > 30, desk)


@unittest.skipUnless(HAS_TESTCLIENT, "Starlette TestClient dependencies not available")
class RouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_desks_without_a_source_answer_404_with_the_reason(self):
        for path in (
            "/api/v1/sectors/kpis",
            "/api/sectors/kpis/auto",
            "/api/v1/funds/overlap",
            "/api/v1/catalysts/index-rebalance",
        ):
            res = self.client.get(path)
            self.assertEqual(res.status_code, 404, path)
            self.assertIn("no data source is connected", res.json()["detail"], path)

    def test_participant_route_serves_the_parsed_file(self):
        CACHE.expire("derivatives:participant-oi:v2")
        self.addCleanup(CACHE.expire, "derivatives:participant-oi:v2")
        parsed = fno_participants.summarise(fno_participants.parse(PARTICIPANT_CSV))
        with patch.object(fno_participants, "fetch_latest", return_value=parsed):
            res = self.client.get("/api/v1/derivatives/participant-oi")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["asOf"], "2026-11-12")
        self.assertIn("2026-11-12", res.json()["meta"]["note"])


if __name__ == "__main__":
    unittest.main()
