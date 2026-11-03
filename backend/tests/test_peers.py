import unittest
from datetime import date
from unittest import mock

import pandas as pd

from app.providers import screener
from app.services import peers


class IndustryParseTests(unittest.TestCase):
    HTML = """<table>
      <tr><th>S.No.</th><th>Company</th><th>CMP Rs.</th><th>P/E</th><th>Mar Cap Rs.Cr.</th><th>ROCE %</th></tr>
      <tr><td>1.</td><td><a href="/company/HAL/consolidated/">Hind.Aeronautics</a></td><td>4958.60</td><td>35.64</td><td>332227.80</td><td>31.97</td></tr>
      <tr><td>2.</td><td><a href="/company/543350/">BSE-only Co</a></td><td>10</td><td>5</td><td>100</td><td>1</td></tr>
    </table>"""

    def test_symbols_from_links_and_bse_only_rows_skipped(self):
        rows = screener.parse_industry(self.HTML)
        self.assertEqual([r["symbol"] for r in rows], ["HAL"])
        self.assertEqual(rows[0]["marketCapCr"], 332227.8)
        self.assertEqual(rows[0]["rocePct"], 31.97)


class BandTests(unittest.TestCase):
    def test_band_uses_only_published_eps(self):
        # FY25 EPS (year to 31 Mar 2025) is usable only from 30 May 2025
        annual = [
            {"period": "FY24", "periodEnd": "2024-03-31", "eps": 10.0},
            {"period": "FY25", "periodEnd": "2025-03-31", "eps": 20.0},
        ]
        idx = pd.to_datetime(["2025-04-15", "2025-06-15"] + [f"2025-07-{d:02d}" for d in range(1, 25)])
        frame = pd.DataFrame({"Close": [100.0] * len(idx)}, index=idx)
        with mock.patch.object(screener, "fetch_company", return_value={"annual": annual}),              mock.patch.object(peers.yahoo, "fetch_history", return_value=frame):
            band = peers.pe_band("X", 100.0)
        self.assertEqual(band["points"][0]["pe"], 10.0)  # April: FY24 EPS of 10, FY25 not yet out
        self.assertEqual(band["points"][0]["epsYear"], "FY24")
        self.assertEqual(band["points"][1]["pe"], 5.0)  # June: FY25 EPS of 20

    def test_tidy_names(self):
        self.assertEqual(peers._tidy("SIGMA ADVANCED SYSTEMS LIMITED"), "Sigma Advanced Systems Limited")
        self.assertEqual(peers._tidy("Data Patterns (India) Limited"), "Data Patterns (India) Limited")


if __name__ == "__main__":
    unittest.main()
