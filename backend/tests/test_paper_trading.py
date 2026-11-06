"""
Unit tests for Paper Trading & Indian Statutory Charges Engine:
- Exact STT, GST, Stamp Duty, and Exchange Turnover calculation
- Virtual account execution and margin deductions
"""

import unittest
from app.services import paper_trading


class TestPaperTrading(unittest.TestCase):
    def test_regulatory_charges_calculation(self):
        """Delivery buy charges include 0.1% STT, 0.015% stamp duty, GST, and turnover fees."""
        trade_val = 100000.0  # ₹1 Lakh trade
        charges = paper_trading.calculate_regulatory_charges(trade_val, "BUY", "CNC")

        self.assertEqual(charges["tradeValue"], 100000.0)
        self.assertAlmostEqual(charges["brokerage"], 20.0, places=1)  # Capped at 20
        self.assertAlmostEqual(charges["stt"], 100.0, places=1)  # 0.1% of 1L
        self.assertAlmostEqual(charges["stampDuty"], 15.0, places=1)  # 0.015% of 1L
        self.assertGreater(charges["gst"], 3.0)  # 18% on fees
        self.assertGreater(charges["totalCharges"], 135.0)
        self.assertLess(charges["netCashFlow"], -100000.0)  # Outflow = trade_value + charges

    def test_virtual_account_and_order_execution(self):
        """Order execution deducts cash, updates position, and creates trade record."""
        acc_before = paper_trading.get_virtual_account()
        cash_start = acc_before["cashBalance"]

        res = paper_trading.execute_paper_order(
            symbol="INFY",
            action="BUY",
            quantity=10,
            price=1850.0,
            product="CNC",
        )
        self.assertTrue(res["success"])
        self.assertIn("order", res)

        acc_after = paper_trading.get_virtual_account()
        # Cash must decrease by trade value + charges
        self.assertLess(acc_after["cashBalance"], cash_start)

        infy_pos = next((p for p in acc_after["positions"] if p["symbol"] == "INFY"), None)
        self.assertIsNotNone(infy_pos)
        self.assertEqual(infy_pos["quantity"], 10)


if __name__ == "__main__":
    unittest.main()
