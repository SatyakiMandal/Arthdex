import unittest
from datetime import date

from app.providers import screener
from app.services import financial_sources, quote_sources

TODAY = date(2026, 11, 3)


def q(end, revenue, net=10.0, eps=1.0):
    return {"periodEnd": end, "revenue": revenue, "netProfit": net, "eps": eps}


RUN = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"]


class ChooseTests(unittest.TestCase):
    def test_current_yahoo_wins_and_overlap_is_vetted(self):
        rows, rep = financial_sources.choose("quarterly", [q(d, 100) for d in RUN], [q(d, 100.5) for d in RUN], TODAY)
        self.assertEqual(rep["used"], "yahoo")
        self.assertEqual(rep["overlap"], 4)
        self.assertEqual(rep["disagreements"], [])

    def test_stale_yahoo_falls_back(self):
        # HDFCBANK: Yahoo's newest quarter was June 2025
        stale = [q(d, 100) for d in ["2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30"]]
        rows, rep = financial_sources.choose("quarterly", stale, [q(d, 100) for d in RUN], TODAY)
        self.assertEqual(rep["used"], "screener")
        self.assertIn("days ago", rep["reason"])
        self.assertEqual(rows[-1]["periodEnd"], "2026-09-30")

    def test_gapped_yahoo_falls_back(self):
        gapped = [q(d, 100) for d in ["2025-09-30", "2026-03-31", "2026-06-30", "2026-09-30"]]
        _, rep = financial_sources.choose("quarterly", gapped, [q(d, 100) for d in RUN], TODAY)
        self.assertEqual(rep["used"], "screener")

    def test_steady_offset_is_a_definition_not_an_error(self):
        # ITC: revenue gross of excise on one side, net on the other, in every period
        _, rep = financial_sources.choose("quarterly", [q(d, 1000) for d in RUN], [q(d, 1060) for d in RUN], TODAY)
        self.assertEqual(rep["disagreements"], [])
        self.assertEqual(rep["basis"][0]["field"], "revenue")
        self.assertTrue(rep["basis"][0]["confirmed"])

    def test_one_period_off_the_pattern_is_an_error(self):
        screener_rows = [q(d, 1060) for d in RUN]
        screener_rows[1] = q(RUN[1], 1300)
        _, rep = financial_sources.choose("quarterly", [q(d, 1000) for d in RUN], screener_rows, TODAY)
        self.assertEqual([d["period"] for d in rep["disagreements"]], [RUN[1]])

    def test_units_error_fails_even_when_steady(self):
        # Infosys in dollars read as rupees: about 1/90 in every period
        _, rep = financial_sources.choose("quarterly", [q(d, 514) for d in RUN], [q(d, 45026) for d in RUN], TODAY)
        self.assertEqual(len(rep["disagreements"]), 4)
        self.assertIn("too far apart", rep["disagreements"][0]["why"])

    def test_minority_interest_gap_is_tolerated(self):
        # Screener's net profit includes minority interest: TCS 13,934 vs 13,884
        _, rep = financial_sources.choose("quarterly", [q(RUN[-1], 100, net=13884)], [q(RUN[-1], 100, net=13934)], TODAY)
        self.assertEqual(rep["disagreements"], [])


class ScreenerParseTests(unittest.TestCase):
    HTML = """<section id="quarters"><table>
      <tr><th></th><th>Jun 2026</th><th>Sep 2026</th></tr>
      <tr><td>Sales +</td><td>72,275</td><td>73,188</td></tr>
      <tr><td>Operating Profit</td><td>18,556</td><td>18,815</td></tr>
      <tr><td>Other Income +</td><td>900</td><td>1,337</td></tr>
      <tr><td>Depreciation</td><td>1,239</td><td>1,262</td></tr>
      <tr><td>Net Profit +</td><td>13,420</td><td>13,934</td></tr>
      <tr><td>EPS in Rs</td><td>36.90</td><td>38.37</td></tr>
    </table></section>"""

    def test_maps_to_yahoo_definitions(self):
        row = screener.parse_quarters(self.HTML)[-1]
        self.assertEqual(row["quarter"], "Q2 FY27")
        self.assertEqual(row["periodEnd"], "2026-09-30")
        self.assertEqual(row["operatingProfit"], 17553)  # Yahoo's EBIT for TCS
        self.assertEqual(row["ebitda"], 20152)  # Yahoo's EBITDA for TCS
        self.assertEqual(row["eps"], 38.37)

    def test_lender_has_no_operating_line(self):
        html = self.HTML.replace("Operating Profit", "Financing Profit")
        row = screener.parse_quarters(html)[-1]
        self.assertIsNone(row["operatingProfit"])
        self.assertIsNone(row["ebitda"])


class QuoteChooseTests(unittest.TestCase):
    def test_exchange_first_with_cross_check(self):
        out = quote_sources.choose(lambda: {"cmp": 100.0, "isin": "X"}, lambda: {"cmp": 100.2, "volume": 5})
        self.assertEqual(out["sources"]["used"], "nse")
        self.assertTrue(out["sources"]["agree"])
        self.assertEqual(out["volume"], 5)  # filled from the other source

    def test_yahoo_carries_when_exchange_refuses(self):
        def refused():
            raise RuntimeError("status=403")
        out = quote_sources.choose(refused, lambda: {"cmp": 100.0})
        self.assertEqual(out["sources"]["used"], "yahoo")
        self.assertIn("403", out["sources"]["nseError"])

    def test_disagreement_flagged(self):
        out = quote_sources.choose(lambda: {"cmp": 100.0}, lambda: {"cmp": 102.0})
        self.assertFalse(out["sources"]["agree"])


if __name__ == "__main__":
    unittest.main()


def bs(end, worth):
    return {"periodEnd": end, "netWorth": worth, "totalAssets": 1000000.0, "borrowings": 1000.0}


class SettleTests(unittest.TestCase):
    YEARS = ["2025-03-31", "2026-03-31"]

    def test_filing_corrects_the_wrong_source(self):
        # HDFCBANK FY25: Yahoo 7,67,689 against a filed 5,17,984; screener.in 5,21,789
        yahoo = [bs("2025-03-31", 767689.0), bs("2026-03-31", 586000.0)]
        scr = [bs("2025-03-31", 521789.0), bs("2026-03-31", 586059.0)]
        filing = lambda end: {"balance": {"netWorth": 517984.2}} if end == "2025-03-31" else None
        rows, rep = financial_sources.choose("balanceSheet", yahoo, scr, TODAY, filing_for=filing)
        self.assertEqual(rep["used"], "yahoo")
        self.assertEqual(rep["unresolved"], [])
        self.assertEqual(rep["disagreements"][0]["settled"]["correct"], "screener")
        fy25 = rows[0]
        self.assertEqual(fy25["netWorth"], 517984.2)
        self.assertEqual(fy25["corrected"]["netWorth"]["from"], 767689.0)
        self.assertEqual(yahoo[0]["netWorth"], 767689.0)  # the source rows are not mutated

    def test_split_restatement_is_not_an_error(self):
        self.assertEqual(financial_sources._matches("eps", 0.03, 12.31, 24.62), "restated")

    def test_no_filing_leaves_it_open(self):
        yahoo = [q(d, 100, eps=12.66) for d in RUN]
        scr = [q(d, 100, eps=12.66) for d in RUN]
        scr[2] = q(RUN[2], 100, eps=11.45)
        _, rep = financial_sources.choose("quarterly", yahoo, scr, TODAY, filing_for=lambda end: None)
        self.assertEqual(len(rep["unresolved"]), 1)


class XbrlParseTests(unittest.TestCase):
    XML = b"""<?xml version="1.0"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in-capmkt="x">
 <xbrli:context id="OneD"><xbrli:entity/><xbrli:period><xbrli:startDate>2026-07-01</xbrli:startDate><xbrli:endDate>2026-09-30</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:context id="OneI"><xbrli:entity/><xbrli:period><xbrli:instant>2026-09-30</xbrli:instant></xbrli:period></xbrli:context>
 <xbrli:context id="Seg"><xbrli:entity><xbrli:segment/></xbrli:entity><xbrli:period><xbrli:startDate>2026-07-01</xbrli:startDate><xbrli:endDate>2026-09-30</xbrli:endDate></xbrli:period></xbrli:context>
 <in-capmkt:DateOfEndOfReportingPeriod contextRef="OneD">2026-09-30</in-capmkt:DateOfEndOfReportingPeriod>
 <in-capmkt:NatureOfReportStandaloneConsolidated contextRef="OneD">Consolidated</in-capmkt:NatureOfReportStandaloneConsolidated>
 <in-capmkt:RevenueFromOperations contextRef="Seg">1</in-capmkt:RevenueFromOperations>
 <in-capmkt:RevenueFromOperations contextRef="OneD">161802000000</in-capmkt:RevenueFromOperations>
 <in-capmkt:BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations contextRef="OneD">17.88</in-capmkt:BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations>
 <in-capmkt:EquityAttributableToOwnersOfParent contextRef="OneI">296729000000</in-capmkt:EquityAttributableToOwnersOfParent>
</xbrli:xbrl>"""

    def test_quarter_and_balance_in_crore_skipping_segments(self):
        from app.providers import nse_xbrl

        out = nse_xbrl.parse(self.XML)
        self.assertTrue(out["consolidated"])
        self.assertEqual(out["quarter"]["revenue"], 16180.2)
        self.assertEqual(out["quarter"]["eps"], 17.88)
        self.assertEqual(out["balance"]["netWorth"], 29672.9)
        self.assertIsNone(out["year"])


class RestatedSettleTests(unittest.TestCase):
    def test_split_adjusted_match_wins_and_shows_restated_value(self):
        years = ["2023-03-31", "2024-03-31", "2025-03-31", "2026-03-31"]
        yahoo = [{"periodEnd": d, "revenue": 100.0, "eps": 50.0} for d in years]
        scr = [{"periodEnd": d, "revenue": 100.0, "eps": 50.0} for d in years]
        yahoo[0]["eps"], scr[0]["eps"] = 44.51, 41.22
        filing = lambda end: {"year": {"eps": 82.64}} if end == "2023-03-31" else None
        rows, rep = financial_sources.choose("annual", yahoo, scr, TODAY, filing_for=filing)
        self.assertEqual(rep["unresolved"], [])
        self.assertEqual(rep["disagreements"][0]["settled"]["correct"], "screener")
        self.assertEqual(rows[0]["eps"], 41.22)
