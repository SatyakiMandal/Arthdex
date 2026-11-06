"""
Unit tests for India Macroeconomic Telemetry & Foreign Exchange Monitor.
"""

import unittest
from app.services import macro_economics


class TestMacroEconomics(unittest.TestCase):
    def test_macro_dashboard_payload(self):
        """Macro dashboard contains CPI, GDP, GST, BoP and upcoming releases."""
        data = macro_economics.get_macro_dashboard()
        self.assertIn("headline", data)
        self.assertIn("inflationBreakdown", data)
        self.assertIn("activityIndicators", data)
        self.assertIn("calendar", data)

        cpi = data["headline"]["cpiInflation"]
        self.assertGreater(cpi["value"], 0.0)
        self.assertIn("MOSPI", cpi["source"])

        gdp = data["headline"]["gdpGrowth"]
        self.assertGreater(gdp["value"], 0.0)

        gst = data["headline"]["gstCollections"]
        self.assertGreater(gst["value"], 1.0)  # Over 1 Lakh Cr

    def test_forex_monitor_payload(self):
        """Forex monitor contains key INR cross pairs, forward premia, and REER."""
        data = macro_economics.get_forex_monitor()
        self.assertEqual(data["baseCurrency"], "INR")
        self.assertIn("pairs", data)
        self.assertIn("forwardPremia", data)
        self.assertIn("reerIndices", data)

        usd_inr = next(p for p in data["pairs"] if p["pair"] == "USD/INR")
        self.assertGreater(usd_inr["rate"], 80.0)
        self.assertEqual(len(data["forwardPremia"]), 4)


if __name__ == "__main__":
    unittest.main()
