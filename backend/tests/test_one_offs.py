"""One-off items in trailing earnings: read from the filings, adjusted figures only when they can be supported."""

from __future__ import annotations

import unittest

from app.providers import nse_xbrl
from app.services import one_offs, peers


def quarter(exceptional=0.0, discontinued=0.0, pbt=1000.0, tax=250.0):
    return {"exceptionalBeforeTax": exceptional, "discontinuedAfterTax": discontinued, "profitBeforeTax": pbt, "taxExpense": tax}


class SummariseTests(unittest.TestCase):
    def test_no_one_offs_means_no_second_figure(self):
        out = one_offs.summarise([quarter()] * 4, 3000.0, 30.0)
        self.assertFalse(out["material"])
        self.assertIsNone(out["epsBeforeOneOffs"])
        self.assertIn("no exceptional items", out["note"])

    def test_exceptional_charge_is_added_back_after_tax(self):
        # one quarter took a 400 charge before tax at a 25% rate: 300 after tax, on 3,000 of profit
        out = one_offs.summarise([quarter(exceptional=-400.0), quarter(), quarter(), quarter()], 3000.0, 30.0)
        self.assertEqual(out["exceptionalBeforeTaxCr"], -400.0)
        self.assertEqual(out["afterTaxEffectCr"], -300.0)
        self.assertTrue(out["material"])
        self.assertEqual(out["epsBeforeOneOffs"], 33.0)  # 30 x 3,300 / 3,000
        self.assertIn("charges of ₹400 crore", out["note"])
        self.assertIn("lower reported profit by about 10%", out["note"])

    def test_discontinued_profit_is_removed_in_full(self):
        out = one_offs.summarise([quarter(discontinued=1000.0), quarter(), quarter(), quarter()], 4000.0, 40.0)
        self.assertEqual(out["afterTaxEffectCr"], 1000.0)
        self.assertEqual(out["epsBeforeOneOffs"], 30.0)
        self.assertIn("raise reported profit by about 25%", out["note"])

    def test_small_items_are_reported_but_not_adjusted_for(self):
        out = one_offs.summarise([quarter(exceptional=-40.0), quarter(), quarter(), quarter()], 3000.0, 30.0)
        self.assertEqual(out["exceptionalBeforeTaxCr"], -40.0)
        self.assertFalse(out["material"])
        self.assertIsNone(out["epsBeforeOneOffs"])

    def test_missing_filing_gives_facts_but_no_adjusted_figure(self):
        out = one_offs.summarise([quarter(exceptional=-400.0), quarter(), quarter(), None], 3000.0, 30.0)
        self.assertEqual((out["quartersRead"], out["complete"]), (3, False))
        self.assertIsNone(out["epsBeforeOneOffs"])
        self.assertIn("Only 3 of the four filings", out["note"])

    def test_unusable_tax_rate_gives_no_after_tax_figure(self):
        for pbt, tax in ((-50.0, 10.0), (100.0, 90.0), (None, None)):
            out = one_offs.summarise([quarter(exceptional=-400.0, pbt=pbt, tax=tax), quarter(), quarter(), quarter()], 3000.0, 30.0)
            self.assertIsNone(out["afterTaxEffectCr"])
            self.assertIsNone(out["epsBeforeOneOffs"])

    def test_nothing_read_is_none(self):
        self.assertIsNone(one_offs.summarise([None] * 4, 3000.0, 30.0))

    def test_for_symbol_reads_the_last_four_quarter_ends(self):
        asked = []

        def filing_for(symbol, end):
            asked.append(end)
            return {"quarter": quarter(exceptional=-400.0 if end == "2026-09-30" else 0.0)}

        ends = ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"]
        out = one_offs.for_symbol("X", ends, 3000.0, 30.0, filing_for)
        self.assertEqual(asked, ends[-4:])
        self.assertEqual(out["epsBeforeOneOffs"], 33.0)


FILING = """<?xml version="1.0"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in="http://example/in">
  <xbrli:context id="OneD"><xbrli:period><xbrli:startDate>2026-07-01</xbrli:startDate><xbrli:endDate>2026-09-30</xbrli:endDate></xbrli:period></xbrli:context>
  <in:DateOfEndOfReportingPeriod contextRef="OneD">2026-09-30</in:DateOfEndOfReportingPeriod>
  <in:DateOfStartOfReportingPeriod contextRef="OneD">2026-07-01</in:DateOfStartOfReportingPeriod>
  <in:NatureOfReportStandaloneConsolidated contextRef="OneD">Consolidated</in:NatureOfReportStandaloneConsolidated>
  <in:RevenueFromOperations contextRef="OneD">145000000000</in:RevenueFromOperations>
  <in:ExceptionalItemsBeforeTax contextRef="OneD">-12688000000</in:ExceptionalItemsBeforeTax>
  <in:ProfitBeforeTax contextRef="OneD">31590000000</in:ProfitBeforeTax>
  <in:TaxExpense contextRef="OneD">11580000000</in:TaxExpense>
  <in:ProfitLossFromDiscontinuedOperationsAfterTax contextRef="OneD">0</in:ProfitLossFromDiscontinuedOperationsAfterTax>
  <in:ProfitLossForPeriod contextRef="OneD">19950000000</in:ProfitLossForPeriod>
</xbrli:xbrl>"""


class ParserTests(unittest.TestCase):
    def test_one_off_lines_are_read_in_crore(self):
        q = nse_xbrl.parse(FILING)["quarter"]
        self.assertEqual(q["exceptionalBeforeTax"], -1268.8)
        self.assertEqual(q["discontinuedAfterTax"], 0.0)
        self.assertEqual((q["profitBeforeTax"], q["taxExpense"]), (3159.0, 1158.0))
        self.assertEqual(q["netProfit"], 1995.0)


class PeerVettingTests(unittest.TestCase):
    def test_gap_explained_by_one_offs_is_agreement_on_that_basis(self):
        self.assertAlmostEqual(peers._gap(36.56, 36.6), 0.0011, places=3)
        self.assertGreater(peers._gap(36.56, 41.08), peers.TOLERANCE["pe"])  # reported earnings alone would fail


if __name__ == "__main__":
    unittest.main()
