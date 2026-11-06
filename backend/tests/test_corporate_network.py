import unittest

try:
    from corporate_network import (
        get_corporate_hierarchy,
        get_supply_chain_network,
        get_network_summary,
        CONGLOMERATE_HIERARCHIES,
        SUPPLY_CHAIN_NETWORKS,
    )
except ImportError:
    from backend.corporate_network import (
        get_corporate_hierarchy,
        get_supply_chain_network,
        get_network_summary,
        CONGLOMERATE_HIERARCHIES,
        SUPPLY_CHAIN_NETWORKS,
    )

class TestCorporateNetwork(unittest.TestCase):
    def test_mand_m_hierarchy(self):
        hold = get_corporate_hierarchy("M&M")
        self.assertEqual(hold["group_name"], "Mahindra Group")
        self.assertEqual(hold["parent_symbol"], "M&M")
        entities = hold["holding_entities"]
        self.assertGreaterEqual(len(entities), 5)
        symbols = [e["symbol"] for e in entities if e["symbol"]]
        self.assertIn("TECHM", symbols)
        self.assertIn("M&MFIN", symbols)
        self.assertIn("MAHLOG", symbols)

    def test_mand_m_supply_chain(self):
        splc = get_supply_chain_network("M&M")
        self.assertEqual(splc["symbol"], "M&M")
        suppliers = splc["suppliers"]
        self.assertGreaterEqual(len(suppliers), 8)
        supplier_symbols = [s["symbol"] for s in suppliers if s["symbol"]]
        self.assertIn("BOSCHLTD", supplier_symbols)
        self.assertIn("SONACOMS", supplier_symbols)
        self.assertIn("MRF", supplier_symbols)
        self.assertIn("TATASTEEL", supplier_symbols)

        # Verify sole source flags
        bosch = next(s for s in suppliers if s["symbol"] == "BOSCHLTD")
        self.assertTrue(bosch["is_sole_source"])
        self.assertEqual(bosch["provenance"], "ACTUAL FILING")

        # Verify customers
        customers = splc["customers"]
        self.assertGreaterEqual(len(customers), 4)

    def test_tatamotors_network(self):
        splc = get_supply_chain_network("TATAMOTORS")
        self.assertEqual(splc["symbol"], "TATAMOTORS")
        suppliers = splc["suppliers"]
        symbols = [s["symbol"] for s in suppliers if s["symbol"]]
        self.assertIn("TATASTEEL", symbols)
        self.assertIn("TATATECH", symbols)

    def test_generic_symbol_fallback(self):
        # Should gracefully return a realistic corporate structure and supply chain for any symbol
        hold = get_corporate_hierarchy("WIPRO")
        self.assertIn("WIPRO", hold["parent_name"])
        self.assertGreaterEqual(len(hold["holding_entities"]), 2)

        splc = get_supply_chain_network("WIPRO")
        self.assertEqual(splc["symbol"], "WIPRO")
        self.assertGreaterEqual(len(splc["suppliers"]), 2)

    def test_network_summary(self):
        summary = get_network_summary("M&M")
        self.assertEqual(summary["symbol"], "M&M")
        self.assertGreater(summary["total_suppliers_tracked"], 5)
        self.assertGreaterEqual(summary["sole_source_bottlenecks"], 1)
        self.assertIn("Powertrain & Fuel Injection", summary["product_clusters"])
        self.assertGreater(summary["provenance_summary"]["audited_filing_nodes"], 0)

if __name__ == "__main__":
    unittest.main()
