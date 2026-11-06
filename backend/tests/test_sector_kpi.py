"""
Unit tests for Arthdex Sector Operating KPIs Dashboard (M19).
"""

import unittest

try:
    from app.services.sector_kpi import (
        SECTOR_MAP,
        TAG_ACTUAL_FILING,
        get_all_sectors_summary,
        get_auto_kpis,
        get_aviation_kpis,
        get_banking_kpis,
        get_power_kpis,
        get_sector_kpi,
        get_telecom_kpis,
    )
except ImportError:
    from backend.app.services.sector_kpi import (
        SECTOR_MAP,
        TAG_ACTUAL_FILING,
        get_all_sectors_summary,
        get_auto_kpis,
        get_aviation_kpis,
        get_banking_kpis,
        get_power_kpis,
        get_sector_kpi,
        get_telecom_kpis,
    )


class TestSectorKPI(unittest.TestCase):
    def test_auto_kpis(self):
        auto = get_auto_kpis()
        self.assertEqual(auto["sector_code"], "auto")
        self.assertEqual(auto["provenance"], TAG_ACTUAL_FILING)

        summary = auto["summary_kpis"]
        self.assertGreater(summary["total_monthly_wholesale_units"], 2_000_000)
        self.assertGreater(summary["total_monthly_vahan_retail_units"], 2_000_000)
        self.assertAlmostEqual(summary["overall_ev_penetration_pct"], 7.35, places=1)
        self.assertEqual(summary["pv_dealer_inventory_days"], 62)

        # Check OEM dispatches
        oems = auto["oem_wholesale_volumes"]
        symbols = [o["symbol"] for o in oems]
        self.assertIn("MARUTI", symbols)
        self.assertIn("TATAMOTORS", symbols)
        self.assertIn("M&M", symbols)
        self.assertIn("BAJAJ-AUTO", symbols)
        self.assertIn("HEROMOTOCO", symbols)
        self.assertIn("TVSMOTOR", symbols)

        # Check Segments & EV Breakdown
        segments = auto["segment_breakdown"]
        self.assertIn("passenger_vehicles_pv", segments)
        self.assertIn("two_wheelers_2w", segments)
        self.assertIn("commercial_vehicles_cv", segments)
        self.assertIn("three_wheelers_3w", segments)
        self.assertIn("tractors_agri", segments)

        ev = auto["ev_penetration_rates"]
        self.assertGreater(ev["three_wheeler_ev_share_pct"], 50.0)  # >50% electrification in 3W
        self.assertGreater(ev["two_wheeler_ev_share_pct"], 5.0)

        # Historical series
        self.assertGreaterEqual(len(auto["historical_trend_series"]), 12)

    def test_banking_kpis(self):
        banking = get_banking_kpis()
        self.assertEqual(banking["sector_code"], "banking")
        self.assertEqual(banking["provenance"], TAG_ACTUAL_FILING)

        summary = banking["summary_kpis"]
        self.assertGreater(summary["total_non_food_credit_lakh_cr"], 150.0)
        self.assertGreater(summary["aggregate_deposits_lakh_cr"], 200.0)
        self.assertLess(summary["scb_gross_npa_ratio_pct"], 3.0)  # SCB Gross NPA at 12-year low <3%
        self.assertLess(summary["scb_net_npa_ratio_pct"], 1.0)
        self.assertGreater(summary["provision_coverage_ratio_pct"], 70.0)
        self.assertGreater(summary["credit_to_deposit_ratio_pct"], 75.0)

        # Check RBI sectoral credit deployment
        deployment = banking["fortnightly_sectoral_credit_deployment"]
        self.assertIn("industry", deployment)
        self.assertIn("services", deployment)
        self.assertIn("personal_loans_retail", deployment)
        self.assertIn("agriculture_and_allied", deployment)

        # Check Bank Groups
        groups = banking["bank_group_comparison"]
        group_names = [g["group"] for g in groups]
        self.assertTrue(any("Public Sector" in n for n in group_names))
        self.assertTrue(any("Private Sector" in n for n in group_names))

        # Historical series
        self.assertGreaterEqual(len(banking["historical_trend_series"]), 5)

    def test_power_kpis(self):
        power = get_power_kpis()
        self.assertEqual(power["sector_code"], "power")
        self.assertEqual(power["provenance"], TAG_ACTUAL_FILING)

        summary = power["summary_kpis"]
        self.assertGreater(summary["all_india_peak_demand_met_gw"], 240.0)
        self.assertGreater(summary["all_india_thermal_plf_pct"], 65.0)
        self.assertGreater(summary["renewable_generation_share_pct"], 18.0)
        self.assertGreater(summary["thermal_coal_stock_days"], 15.0)

        # Check Thermal PLF breakdown
        plf = power["thermal_plant_load_factor_plf"]
        self.assertGreater(plf["central_sector_gencos"]["plf_pct"], 75.0)
        self.assertIn("NTPC Ltd (NTPC)", plf["central_sector_gencos"]["leading_players"])

        # Fuel Mix
        mix = power["generation_fuel_mix"]
        self.assertIn("thermal_fossil_pct", mix)
        self.assertIn("renewable_energy_sources_res_pct", mix)
        self.assertIn("solar_power_pct", mix["renewable_breakdown"])
        self.assertIn("wind_power_pct", mix["renewable_breakdown"])

        # IEX Telemetry
        iex = power["iex_power_exchange_telemetry"]
        self.assertGreater(iex["day_ahead_market_dam"]["average_market_clearing_price_inr_kwh"], 3.0)
        self.assertEqual(iex["day_ahead_market_dam"]["cerc_regulatory_price_cap_inr_kwh"], 10.0)

        # Historical series
        self.assertGreaterEqual(len(power["historical_trend_series"]), 12)

    def test_aviation_kpis(self):
        aviation = get_aviation_kpis()
        self.assertEqual(aviation["sector_code"], "aviation")
        self.assertEqual(aviation["provenance"], TAG_ACTUAL_FILING)

        summary = aviation["summary_kpis"]
        self.assertGreater(summary["monthly_domestic_passengers_lakh"], 130.0)
        self.assertGreater(summary["system_passenger_load_factor_pct"], 80.0)
        self.assertGreater(summary["current_atf_price_delhi_inr_per_kl"], 80000.0)

        # Market Shares
        shares = aviation["airline_market_shares"]
        indigo = next(a for a in shares if a["symbol"] == "INDIGO")
        self.assertGreater(indigo["market_share_pct"], 60.0)  # IndiGo holds >60%
        self.assertGreater(indigo["passenger_load_factor_plf_pct"], 85.0)

        tata = next(a for a in shares if a["symbol"] == "TATA-AI")
        self.assertGreater(tata["market_share_pct"], 25.0)  # Air India Group >25%

        akasa = next(a for a in shares if a["symbol"] == "AKASA")
        self.assertGreater(akasa["passenger_load_factor_plf_pct"], 88.0)

        # OTP rankings
        self.assertGreaterEqual(len(aviation["metro_airports_otp_ranking"]), 5)

        # Historical series
        self.assertGreaterEqual(len(aviation["historical_trend_series"]), 12)

    def test_telecom_kpis(self):
        telecom = get_telecom_kpis()
        self.assertEqual(telecom["sector_code"], "telecom")
        self.assertEqual(telecom["provenance"], TAG_ACTUAL_FILING)

        summary = telecom["summary_kpis"]
        self.assertGreater(summary["total_wireless_subscribers_million"], 1150.0)
        self.assertGreater(summary["total_5g_bts_deployed"], 400_000)
        self.assertGreater(summary["total_5g_subscribers_million"], 180.0)
        self.assertGreater(summary["industry_blended_arpu_inr"], 170.0)

        # Operator breakdown
        operators = telecom["operator_breakdown"]
        jio = next(o for o in operators if o["operator"].startswith("Reliance Jio"))
        self.assertGreater(jio["subscriber_market_share_pct"], 38.0)
        self.assertGreater(jio["monthly_net_additions_million"], 1.0)
        self.assertGreater(jio["five_g_bts_deployed"], 300_000)

        airtel = next(o for o in operators if o["operator"].startswith("Bharti Airtel"))
        self.assertGreater(airtel["active_vlr_pct"], 98.0)  # Airtel active VLR quality leader >98%
        self.assertGreater(airtel["arpu_inr_per_month"], 200.0)  # Airtel ARPU >200

        vi = next(o for o in operators if o["symbol"] == "IDEA")
        self.assertLess(vi["monthly_net_additions_million"], 0.0)  # Vi ongoing subscriber net loss

        # Historical series
        self.assertGreaterEqual(len(telecom["historical_trend_series"]), 12)

    def test_sector_dispatcher_and_summary(self):
        # Dispatcher valid sectors
        for code in ["auto", "banking", "power", "aviation", "telecom"]:
            data = get_sector_kpi(code)
            self.assertEqual(data["sector_code"], code)

        # Case-insensitivity
        self.assertEqual(get_sector_kpi("AuTo")["sector_code"], "auto")

        # Unknown sector raises ValueError
        with self.assertRaises(ValueError):
            get_sector_kpi("unknown_cryptocurrency")

        # Summary of all sectors
        summary = get_all_sectors_summary()
        self.assertEqual(summary["total_sectors_tracked"], 5)
        self.assertEqual(len(summary["sectors"]), 5)
        sector_codes = [s["sector_code"] for s in summary["sectors"]]
        self.assertIn("auto", sector_codes)
        self.assertIn("banking", sector_codes)
        self.assertIn("power", sector_codes)
        self.assertIn("aviation", sector_codes)
        self.assertIn("telecom", sector_codes)
        self.assertEqual(summary["provenance"], TAG_ACTUAL_FILING)

    def test_router_endpoints(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        try:
            from app.routers.sector_kpi import router
        except ImportError:
            from backend.app.routers.sector_kpi import router

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        # GET /api/sectors/kpis
        res_summary = client.get("/api/sectors/kpis")
        self.assertEqual(res_summary.status_code, 200)
        s_data = res_summary.json()
        self.assertIn("data", s_data)
        self.assertEqual(s_data["data"]["total_sectors_tracked"], 5)

        # GET /api/sectors/kpis/{sector_code} for all 5 sectors
        for sec in ["auto", "banking", "power", "aviation", "telecom"]:
            res_sec = client.get(f"/api/sectors/kpis/{sec}")
            self.assertEqual(res_sec.status_code, 200, f"Failed for sector {sec}")
            data = res_sec.json()["data"]
            self.assertEqual(data["sector_code"], sec)

        # GET /api/sectors/kpis/invalid -> 404
        res_invalid = client.get("/api/sectors/kpis/non_existent_sector")
        self.assertEqual(res_invalid.status_code, 404)


if __name__ == "__main__":
    unittest.main()
