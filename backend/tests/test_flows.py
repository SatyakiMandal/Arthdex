import tempfile
import unittest
from pathlib import Path

from app.providers import nsdl
from app.services import flows
from app.store import Store


def nse_payload(day, fii, dii):
    row = lambda net: {"buy": 10000.0 + max(net, 0), "sell": 10000.0 - min(net, 0), "net": net}
    return {"date": day, "allExchanges": {"fii": row(fii), "dii": row(dii)}, "nseOnly": None}


class VetTests(unittest.TestCase):
    def test_clean_record_passes(self):
        self.assertEqual(flows.vet_nse(nse_payload("2026-11-03", 6836.81, -3678.85)), [])

    def test_net_that_does_not_reconcile_is_caught(self):
        p = nse_payload("2026-11-03", 100.0, 50.0)
        p["allExchanges"]["fii"]["net"] = 999.0
        self.assertIn("not the stated net", flows.vet_nse(p)[0])

    def test_implausible_day_is_caught(self):
        self.assertIn("implausible", flows.vet_nse(nse_payload("2026-11-03", 90000.0, 0.0))[0])


class SummaryTests(unittest.TestCase):
    def test_totals_streak_and_direction(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(url="", sqlite_path=Path(tmp) / "t.db")
            nets = [(-500, 900), (1200, -300), (2500, -800), (3100, 100), (6836.81, -3678.85)]
            days = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02", "2026-11-03"]
            for d, (f, di) in zip(days, nets):
                store.put(flows.NSE_SERIES, d, nse_payload(d, f, di))
            # NSDL's report on 3 Nov covers the 2 Nov trades: same direction
            store.put(flows.NSDL_SERIES, "2026-11-03", {"equity": {"stockExchange": {"net": 3271.21}}})
            s = flows.summary(days=3650, store=store)
            self.assertEqual(s["totals"]["fii5d"], round(sum(n[0] for n in nets), 2))
            self.assertEqual(s["streak"]["fii"], 4)  # four buying days in a row
            self.assertEqual(s["directionCheck"][0]["tradeDate"], "2026-11-02")
            self.assertTrue(s["directionCheck"][0]["agree"])


class NsdlParseTests(unittest.TestCase):
    HTML = ("<td>Daily Trends in FPI Investments on 03-Nov-2026</td><td>03-Nov-2026</td><td>Equity</td>"
            "<td>Stock Exchange</td><td>16749.21</td><td>13478.00</td><td>3271.21</td><td>344.79</td><td>Rs.94.8755</td>"
            "<td>Primary market &amp; others</td>".replace("&amp;", "&") +
            "<td>86.01</td><td>5.10</td><td>80.91</td><td>8.53</td><td>Sub-total</td><td>16835.22</td><td>13483.10</td><td>3352.12</td><td>353.32</td>")

    def test_parses_equity_rows_and_rate(self):
        out = nsdl.parse_latest(self.HTML)
        self.assertEqual(out["reportedOn"], "2026-11-03")
        self.assertEqual(out["equity"]["stockExchange"]["net"], 3271.21)
        self.assertEqual(out["equity"]["total"]["net"], 3352.12)
        self.assertEqual(out["usdInr"], 94.8755)

    def test_bracketed_values_are_negative(self):
        self.assertEqual(nsdl._num("(28.94)"), -28.94)


if __name__ == "__main__":
    unittest.main()
