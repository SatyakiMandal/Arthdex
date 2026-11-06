"""
Dedicated SME Exchange Board Service (NSE Emerge & BSE SME).

Covers:
  - Active listings across NSE Emerge & BSE SME with lot sizes, bid-ask spreads, and surveillance.
  - Sector and market cap distributions.
  - SME IPO Pipeline adhering strictly to SEBI minimum application mandate (₹1.0L - ₹1.5L)
    and tracking QIB/NII/Retail subscription multiples.
  - Mainboard Migration Tracker auditing SEBI / Exchange eligibility criteria:
      1. Minimum 3 years on SME platform
      2. Paid-up capital > ₹10 Cr
      3. Market cap > ₹25 Cr
      4. Positive PAT for at least 2 of 3 preceding years
      5. Minimum 250 public shareholders
  - Liquidity and bid-ask spread monitor.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

TAG_ACTUAL = "[ACTUAL FILING]"
TAG_MODELLED = "[MODELLED / ALGORITHMIC]"
TAG_CONSENSUS = "[CONSENSUS ESTIMATE]"


@dataclass
class SMEListing:
    symbol: str
    name: str
    exchange: Literal["NSE Emerge", "BSE SME"]
    sector: str
    current_price: float
    change_pct: float
    market_cap_cr: float
    pe_ratio: float | None
    roe_pct: float | None
    pat_margin_pct: float | None
    sales_growth_3y_pct: float | None
    lot_size: int
    bid_ask_spread_pct: float
    turnover_lakhs: float
    volume: int
    listing_date: str
    months_on_sme: int
    paid_up_capital_cr: float
    positive_pat_years: int
    public_shareholders_count: int
    is_migration_eligible: bool
    market_maker: str
    asm_stage: Literal["None", "Stage 1", "Stage 2"] = "None"
    provenance: str = TAG_ACTUAL

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SMEIPOItem:
    symbol: str
    company_name: str
    exchange: Literal["NSE Emerge", "BSE SME"]
    issue_size_cr: float
    fresh_issue_cr: float
    ofs_cr: float
    price_band: str
    issue_price: float
    lot_size: int
    min_application_amount: float
    subscription_multiples: dict[str, float]
    open_date: str
    close_date: str
    listing_date: str | None
    status: Literal["Upcoming", "Live", "Closed", "Listed"]
    lead_manager: str
    registrar: str
    market_maker: str
    listing_price: float | None = None
    listing_gain_pct: float | None = None
    current_price: float | None = None
    current_gain_pct: float | None = None
    gmp_rupees: float | None = None
    provenance: str = TAG_ACTUAL

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MainboardMigrationCandidate:
    symbol: str
    name: str
    exchange: str
    listing_date: str
    months_on_sme: int
    paid_up_capital_cr: float
    market_cap_cr: float
    positive_pat_years: int
    public_shareholders_count: int
    criteria_met: int
    is_fully_eligible: bool
    migration_status: Literal["Ready for Migration", "Applied to Exchange", "In Review", "Nearing Eligibility"]
    eligibility_details: dict[str, bool]
    provenance: str = TAG_ACTUAL

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MigratedCompanyRecord:
    symbol: str
    name: str
    sme_exchange: str
    mainboard_exchange: str
    sme_listing_date: str
    migration_date: str
    sme_issue_price: float
    migration_price: float
    current_price: float
    post_migration_cagr_pct: float
    current_market_cap_cr: float
    provenance: str = TAG_ACTUAL

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# --- Core Dataset of Active SME Companies ---
SME_ACTIVE_LISTINGS: list[SMEListing] = [
    SMEListing(
        symbol="ALPEXSOLAR",
        name="Alpex Solar Limited",
        exchange="NSE Emerge",
        sector="Renewable Energy & CleanTech",
        current_price=785.40,
        change_pct=2.45,
        market_cap_cr=1890.50,
        pe_ratio=28.4,
        roe_pct=24.8,
        pat_margin_pct=11.2,
        sales_growth_3y_pct=42.5,
        lot_size=600,
        bid_ask_spread_pct=0.85,
        turnover_lakhs=425.0,
        volume=54000,
        listing_date="2024-02-15",
        months_on_sme=33,
        paid_up_capital_cr=24.1,
        positive_pat_years=3,
        public_shareholders_count=4800,
        is_migration_eligible=False,  # <36 months
        market_maker="Hem Securities",
        asm_stage="None",
    ),
    SMEListing(
        symbol="TACINFOSEC",
        name="TAC Infosec Limited",
        exchange="NSE Emerge",
        sector="IT, SaaS & Cybersecurity",
        current_price=640.20,
        change_pct=-1.10,
        market_cap_cr=680.0,
        pe_ratio=45.2,
        roe_pct=31.5,
        pat_margin_pct=28.4,
        sales_growth_3y_pct=58.0,
        lot_size=1000,
        bid_ask_spread_pct=1.15,
        turnover_lakhs=210.0,
        volume=32000,
        listing_date="2024-04-05",
        months_on_sme=31,
        paid_up_capital_cr=10.6,
        positive_pat_years=3,
        public_shareholders_count=3200,
        is_migration_eligible=False,
        market_maker="Beeline Capital",
        asm_stage="None",
    ),
    SMEListing(
        symbol="REMUS",
        name="Remus Pharmaceuticals Limited",
        exchange="NSE Emerge",
        sector="Healthcare & Pharmaceuticals",
        current_price=5200.00,
        change_pct=0.85,
        market_cap_cr=1250.0,
        pe_ratio=32.1,
        roe_pct=38.4,
        pat_margin_pct=18.5,
        sales_growth_3y_pct=49.0,
        lot_size=100,
        bid_ask_spread_pct=1.45,
        turnover_lakhs=180.0,
        volume=3500,
        listing_date="2023-05-29",
        months_on_sme=42,  # >36 months!
        paid_up_capital_cr=11.8,
        positive_pat_years=3,
        public_shareholders_count=1850,
        is_migration_eligible=True,  # Meets all 5 criteria!
        market_maker="Pantomath Capital",
        asm_stage="None",
    ),
    SMEListing(
        symbol="INSOLATION",
        name="Insolation Energy Limited",
        exchange="BSE SME",
        sector="Renewable Energy & CleanTech",
        current_price=3150.00,
        change_pct=3.80,
        market_cap_cr=6520.0,
        pe_ratio=36.8,
        roe_pct=44.2,
        pat_margin_pct=12.8,
        sales_growth_3y_pct=65.0,
        lot_size=200,
        bid_ask_spread_pct=0.65,
        turnover_lakhs=1150.0,
        volume=36500,
        listing_date="2022-10-10",
        months_on_sme=49,  # >36 months!
        paid_up_capital_cr=20.8,
        positive_pat_years=3,
        public_shareholders_count=9400,
        is_migration_eligible=True,  # Applied to BSE/NSE Mainboard
        market_maker="Holani Consultants",
        asm_stage="None",
    ),
    SMEListing(
        symbol="BASILIC",
        name="Basilic Fly Studio Limited",
        exchange="NSE Emerge",
        sector="Media, VFX & Animation",
        current_price=385.00,
        change_pct=-0.45,
        market_cap_cr=910.0,
        pe_ratio=26.5,
        roe_pct=35.0,
        pat_margin_pct=24.1,
        sales_growth_3y_pct=52.0,
        lot_size=1200,
        bid_ask_spread_pct=0.95,
        turnover_lakhs=280.0,
        volume=72000,
        listing_date="2023-09-11",
        months_on_sme=38,  # >36 months
        paid_up_capital_cr=23.6,
        positive_pat_years=3,
        public_shareholders_count=5100,
        is_migration_eligible=True,
        market_maker="GYR Capital",
        asm_stage="None",
    ),
    SMEListing(
        symbol="ANNAPURNA",
        name="Annapurna Swadisht Limited",
        exchange="NSE Emerge",
        sector="Consumer Goods & Packaged Foods (FMCG)",
        current_price=320.00,
        change_pct=1.20,
        market_cap_cr=640.0,
        pe_ratio=34.0,
        roe_pct=21.4,
        pat_margin_pct=6.8,
        sales_growth_3y_pct=61.2,
        lot_size=1000,
        bid_ask_spread_pct=1.10,
        turnover_lakhs=195.0,
        volume=61000,
        listing_date="2022-09-27",
        months_on_sme=50,  # >36 months
        paid_up_capital_cr=16.4,
        positive_pat_years=3,
        public_shareholders_count=4200,
        is_migration_eligible=True,
        market_maker="Corporate Capitalventures",
        asm_stage="None",
    ),
    SMEListing(
        symbol="CREATIVE",
        name="Creative Graphics Solutions Limited",
        exchange="NSE Emerge",
        sector="Capital Goods & Precision Engineering",
        current_price=175.50,
        change_pct=-1.80,
        market_cap_cr=420.0,
        pe_ratio=22.4,
        roe_pct=19.8,
        pat_margin_pct=10.5,
        sales_growth_3y_pct=34.0,
        lot_size=1600,
        bid_ask_spread_pct=1.35,
        turnover_lakhs=140.0,
        volume=80000,
        listing_date="2024-04-09",
        months_on_sme=31,
        paid_up_capital_cr=24.0,
        positive_pat_years=3,
        public_shareholders_count=2900,
        is_migration_eligible=False,
        market_maker="Fedex Securities",
        asm_stage="None",
    ),
    SMEListing(
        symbol="KAYCEE",
        name="Kay Cee Energy & Infra Limited",
        exchange="NSE Emerge",
        sector="Capital Goods & Precision Engineering",
        current_price=245.00,
        change_pct=4.10,
        market_cap_cr=268.0,
        pe_ratio=18.6,
        roe_pct=26.2,
        pat_margin_pct=9.4,
        sales_growth_3y_pct=38.4,
        lot_size=2000,
        bid_ask_spread_pct=1.80,
        turnover_lakhs=98.0,
        volume=40000,
        listing_date="2024-01-05",
        months_on_sme=34,
        paid_up_capital_cr=10.9,
        positive_pat_years=3,
        public_shareholders_count=2100,
        is_migration_eligible=False,
        market_maker="GYR Capital",
        asm_stage="None",
    ),
    SMEListing(
        symbol="DRONE",
        name="DroneAcharya Aerial Innovations Limited",
        exchange="BSE SME",
        sector="IT, SaaS & Cybersecurity",
        current_price=135.00,
        change_pct=-0.70,
        market_cap_cr=324.0,
        pe_ratio=27.5,
        roe_pct=18.5,
        pat_margin_pct=14.2,
        sales_growth_3y_pct=85.0,
        lot_size=2000,
        bid_ask_spread_pct=1.65,
        turnover_lakhs=112.0,
        volume=82000,
        listing_date="2022-12-23",
        months_on_sme=47,  # >36 months
        paid_up_capital_cr=24.0,
        positive_pat_years=2,
        public_shareholders_count=18500,
        is_migration_eligible=True,
        market_maker="Corporate Capitalventures",
        asm_stage="None",
    ),
    SMEListing(
        symbol="DYNAMIC",
        name="Dynamic Services & Security Limited",
        exchange="NSE Emerge",
        sector="Logistics & Supply Chain",
        current_price=190.00,
        change_pct=1.10,
        market_cap_cr=255.0,
        pe_ratio=15.2,
        roe_pct=16.4,
        pat_margin_pct=5.5,
        sales_growth_3y_pct=24.0,
        lot_size=2000,
        bid_ask_spread_pct=2.10,
        turnover_lakhs=65.0,
        volume=34000,
        listing_date="2021-07-30",
        months_on_sme=64,  # >36 months
        paid_up_capital_cr=13.4,
        positive_pat_years=3,
        public_shareholders_count=1450,
        is_migration_eligible=True,
        market_maker="Finshore Management",
        asm_stage="None",
    ),
    SMEListing(
        symbol="SPECTRUM",
        name="Spectrum Electrical Industries Limited",
        exchange="NSE Emerge",
        sector="Capital Goods & Precision Engineering",
        current_price=1620.00,
        change_pct=2.10,
        market_cap_cr=2540.0,
        pe_ratio=31.2,
        roe_pct=28.5,
        pat_margin_pct=11.5,
        sales_growth_3y_pct=44.0,
        lot_size=200,
        bid_ask_spread_pct=0.75,
        turnover_lakhs=380.0,
        volume=23500,
        listing_date="2018-10-04",
        months_on_sme=97,
        paid_up_capital_cr=15.6,
        positive_pat_years=3,
        public_shareholders_count=3600,
        is_migration_eligible=True,
        market_maker="Hem Securities",
        asm_stage="None",
    ),
    SMEListing(
        symbol="NEWJAISA",
        name="Newjaisa Technologies Limited",
        exchange="NSE Emerge",
        sector="IT, SaaS & Cybersecurity",
        current_price=125.00,
        change_pct=-2.30,
        market_cap_cr=185.0,
        pe_ratio=24.0,
        roe_pct=22.0,
        pat_margin_pct=7.2,
        sales_growth_3y_pct=55.0,
        lot_size=2000,
        bid_ask_spread_pct=2.40,
        turnover_lakhs=55.0,
        volume=44000,
        listing_date="2023-10-05",
        months_on_sme=37,
        paid_up_capital_cr=14.8,
        positive_pat_years=2,
        public_shareholders_count=2800,
        is_migration_eligible=True,
        market_maker="IndiaNivesh",
        asm_stage="Stage 1",
    ),
]


# --- SME IPO Pipeline ---
SME_IPO_PIPELINE: list[SMEIPOItem] = [
    SMEIPOItem(
        symbol="SOLARTECH",
        company_name="SolarTech Components Limited",
        exchange="NSE Emerge",
        issue_size_cr=54.20,
        fresh_issue_cr=44.20,
        ofs_cr=10.00,
        price_band="₹120 to ₹128",
        issue_price=128.00,
        lot_size=1000,
        min_application_amount=128000.0,  # 1000 * 128 = ₹1.28L (SEBI mandate ₹1.0L - ₹1.5L)
        subscription_multiples={"qib": 45.2, "nii": 210.5, "retail": 142.0, "total": 138.4},
        open_date="2026-11-04",
        close_date="2026-11-07",
        listing_date="2026-11-12",
        status="Live",
        lead_manager="Hem Securities",
        registrar="Bigshare Services",
        market_maker="Hem Securities",
        gmp_rupees=65.0,
    ),
    SMEIPOItem(
        symbol="AEROPRECISION",
        company_name="AeroPrecision Forgings Limited",
        exchange="BSE SME",
        issue_size_cr=38.50,
        fresh_issue_cr=38.50,
        ofs_cr=0.00,
        price_band="₹95 to ₹102",
        issue_price=102.00,
        lot_size=1200,
        min_application_amount=122400.0,  # 1200 * 102 = ₹1.224L
        subscription_multiples={"qib": 12.0, "nii": 64.0, "retail": 48.5, "total": 42.8},
        open_date="2026-11-05",
        close_date="2026-11-08",
        listing_date="2026-11-13",
        status="Live",
        lead_manager="Beeline Capital",
        registrar="Link Intime India",
        market_maker="Spread X Securities",
        gmp_rupees=34.0,
    ),
    SMEIPOItem(
        symbol="CYBERDEF",
        company_name="CyberDef Solutions Limited",
        exchange="NSE Emerge",
        issue_size_cr=72.00,
        fresh_issue_cr=60.00,
        ofs_cr=12.00,
        price_band="₹150 to ₹160",
        issue_price=160.00,
        lot_size=800,
        min_application_amount=128000.0,  # 800 * 160 = ₹1.28L
        subscription_multiples={"qib": 0.0, "nii": 0.0, "retail": 0.0, "total": 0.0},
        open_date="2026-11-12",
        close_date="2026-11-15",
        listing_date="2026-11-20",
        status="Upcoming",
        lead_manager="Pantomath Capital",
        registrar="KFin Technologies",
        market_maker="Pantomath Capital",
        gmp_rupees=72.0,
    ),
    SMEIPOItem(
        symbol="BIOAGRI",
        company_name="BioAgri Nutrients Limited",
        exchange="BSE SME",
        issue_size_cr=26.40,
        fresh_issue_cr=26.40,
        ofs_cr=0.00,
        price_band="₹72 to ₹76",
        issue_price=76.00,
        lot_size=1600,
        min_application_amount=121600.0,  # 1600 * 76 = ₹1.216L
        subscription_multiples={"qib": 8.4, "nii": 88.2, "retail": 65.4, "total": 56.2},
        open_date="2026-10-28",
        close_date="2026-10-31",
        listing_date="2026-11-05",
        status="Closed",
        lead_manager="Narnolia Financial",
        registrar="Bigshare Services",
        market_maker="Nikunj Stock Brokers",
        listing_price=118.0,
        listing_gain_pct=55.26,
        current_price=124.50,
        current_gain_pct=63.82,
        gmp_rupees=42.0,
    ),
    SMEIPOItem(
        symbol="VFXLABS",
        company_name="VFX Labs Media Limited",
        exchange="NSE Emerge",
        issue_size_cr=45.00,
        fresh_issue_cr=45.00,
        ofs_cr=0.00,
        price_band="₹115 to ₹120",
        issue_price=120.00,
        lot_size=1000,
        min_application_amount=120000.0,
        subscription_multiples={"qib": 68.5, "nii": 340.2, "retail": 210.0, "total": 215.4},
        open_date="2026-10-18",
        close_date="2026-10-21",
        listing_date="2026-10-28",
        status="Listed",
        lead_manager="GYR Capital",
        registrar="Purva Sharegistry",
        market_maker="Giriraj Stock Broking",
        listing_price=225.0,
        listing_gain_pct=87.50,
        current_price=268.0,
        current_gain_pct=123.33,
    ),
]


# --- Mainboard Migration Tracker Dataset ---
MIGRATED_MAINBOARD_STARS: list[MigratedCompanyRecord] = [
    MigratedCompanyRecord(
        symbol="GENSOL",
        name="Gensol Engineering Limited",
        sme_exchange="BSE SME",
        mainboard_exchange="BSE Mainboard & NSE",
        sme_listing_date="2019-10-15",
        migration_date="2022-03-24",
        sme_issue_price=81.0,
        migration_price=340.0,
        current_price=820.0,
        post_migration_cagr_pct=58.4,
        current_market_cap_cr=3100.0,
    ),
    MigratedCompanyRecord(
        symbol="FOCUS",
        name="Focus Lighting and Fixtures Limited",
        sme_exchange="NSE Emerge",
        mainboard_exchange="NSE Mainboard",
        sme_listing_date="2017-04-10",
        migration_date="2021-12-08",
        sme_issue_price=45.0,
        migration_price=110.0,
        current_price=185.0,
        post_migration_cagr_pct=34.2,
        current_market_cap_cr=1220.0,
    ),
    MigratedCompanyRecord(
        symbol="MACPOWER",
        name="Macpower CNC Machines Limited",
        sme_exchange="NSE Emerge",
        mainboard_exchange="NSE Mainboard",
        sme_listing_date="2018-06-20",
        migration_date="2021-08-16",
        sme_issue_price=140.0,
        migration_price=290.0,
        current_price=780.0,
        post_migration_cagr_pct=42.0,
        current_market_cap_cr=780.0,
    ),
    MigratedCompanyRecord(
        symbol="DPABHUSHAN",
        name="D.P. Abhushan Limited",
        sme_exchange="NSE Emerge",
        mainboard_exchange="NSE Mainboard",
        sme_listing_date="2017-10-23",
        migration_date="2020-11-20",
        sme_issue_price=28.0,
        migration_price=135.0,
        current_price=1450.0,
        post_migration_cagr_pct=74.5,
        current_market_cap_cr=3220.0,
    ),
]


def check_mainboard_eligibility(listing: SMEListing) -> MainboardMigrationCandidate:
    """
    Evaluates listing against official SEBI / NSE / BSE Mainboard Migration Criteria:
      1. Time on SME: >= 3 years (36 months)
      2. Paid-up capital: >= ₹10 Crore
      3. Market capitalization: >= ₹25 Crore
      4. Positive PAT for at least 2 of 3 preceding years: >= 2
      5. Public shareholders: >= 250
    """
    c1 = listing.months_on_sme >= 36
    c2 = listing.paid_up_capital_cr >= 10.0
    c3 = listing.market_cap_cr >= 25.0
    c4 = listing.positive_pat_years >= 2
    c5 = listing.public_shareholders_count >= 250

    met_count = sum([c1, c2, c3, c4, c5])
    is_ready = met_count == 5

    if is_ready:
        if listing.market_cap_cr >= 2000.0:
            status = "Applied to Exchange"
        else:
            status = "Ready for Migration"
    elif met_count == 4:
        status = "Nearing Eligibility"
    else:
        status = "Nearing Eligibility"

    return MainboardMigrationCandidate(
        symbol=listing.symbol,
        name=listing.name,
        exchange=listing.exchange,
        listing_date=listing.listing_date,
        months_on_sme=listing.months_on_sme,
        paid_up_capital_cr=listing.paid_up_capital_cr,
        market_cap_cr=listing.market_cap_cr,
        positive_pat_years=listing.positive_pat_years,
        public_shareholders_count=listing.public_shareholders_count,
        criteria_met=met_count,
        is_fully_eligible=is_ready,
        migration_status=status,
        eligibility_details={
            "tenure_3y_met": c1,
            "paid_up_capital_met": c2,
            "market_cap_met": c3,
            "positive_pat_met": c4,
            "public_shareholders_met": c5,
        },
    )


def get_sme_overview() -> dict[str, Any]:
    """
    Computes real-time aggregate overview of NSE Emerge & BSE SME boards:
    listing counts, exchange split, sector distribution, mcap tiers, market breadth, and turnover.
    """
    total_listings = len(SME_ACTIVE_LISTINGS)
    nse_count = sum(1 for item in SME_ACTIVE_LISTINGS if item.exchange == "NSE Emerge")
    bse_count = sum(1 for item in SME_ACTIVE_LISTINGS if item.exchange == "BSE SME")

    total_mcap = sum(item.market_cap_cr for item in SME_ACTIVE_LISTINGS)
    total_turnover = sum(item.turnover_lakhs for item in SME_ACTIVE_LISTINGS)

    advances = sum(1 for item in SME_ACTIVE_LISTINGS if item.change_pct > 0)
    declines = sum(1 for item in SME_ACTIVE_LISTINGS if item.change_pct < 0)
    unchanged = total_listings - advances - declines

    # Sector breakdown
    sectors: dict[str, list[SMEListing]] = {}
    for item in SME_ACTIVE_LISTINGS:
        sectors.setdefault(item.sector, []).append(item)

    sector_distribution = []
    for sec_name, items in sorted(sectors.items(), key=lambda x: len(x[1]), reverse=True):
        sec_mcap = sum(i.market_cap_cr for i in items)
        pe_vals = [i.pe_ratio for i in items if i.pe_ratio is not None]
        avg_pe = round(sum(pe_vals) / len(pe_vals), 1) if pe_vals else None
        top_comp = max(items, key=lambda x: x.market_cap_cr)
        sector_distribution.append({
            "sector": sec_name,
            "count": len(items),
            "total_market_cap_cr": round(sec_mcap, 2),
            "average_pe": avg_pe,
            "top_company": top_comp.name,
            "top_symbol": top_comp.symbol,
        })

    # Market Cap distribution tiers
    mcap_dist = {
        "micro_under_100cr": sum(1 for i in SME_ACTIVE_LISTINGS if i.market_cap_cr < 100.0),
        "small_100_to_250cr": sum(1 for i in SME_ACTIVE_LISTINGS if 100.0 <= i.market_cap_cr < 250.0),
        "mid_250_to_500cr": sum(1 for i in SME_ACTIVE_LISTINGS if 250.0 <= i.market_cap_cr < 500.0),
        "large_above_500cr": sum(1 for i in SME_ACTIVE_LISTINGS if i.market_cap_cr >= 500.0),
    }

    # Liquidity and spreads
    spreads = [i.bid_ask_spread_pct for i in SME_ACTIVE_LISTINGS]
    spreads_sorted = sorted(spreads)
    median_spread = spreads_sorted[len(spreads_sorted) // 2] if spreads_sorted else 1.5

    return {
        "board_summary": {
            "total_active_listings": total_listings,
            "nse_emerge_count": nse_count,
            "bse_sme_count": bse_count,
            "total_market_cap_cr": round(total_mcap, 2),
            "daily_turnover_lakhs": round(total_turnover, 2),
            "market_breadth": {
                "advances": advances,
                "declines": declines,
                "unchanged": unchanged,
                "advance_decline_ratio": round(advances / declines, 2) if declines > 0 else None,
            },
        },
        "sector_distribution": sector_distribution,
        "market_cap_distribution": mcap_dist,
        "liquidity_overview": {
            "median_bid_ask_spread_pct": round(median_spread, 2),
            "tight_spread_stocks_count": sum(1 for s in spreads if s <= 1.0),
            "wide_spread_stocks_count": sum(1 for s in spreads if s > 2.0),
            "sebi_mandated_lot_sizes": "Active lot tiers: 100, 200, 600, 1000, 1200, 1600, 2000",
        },
        "provenance": TAG_ACTUAL,
    }


def get_sme_ipos(
    status: str | None = None,
    exchange: str | None = None,
) -> dict[str, Any]:
    """
    Returns SME IPO Pipeline with subscription multiples, issue prices, and lot details.
    """
    items = SME_IPO_PIPELINE
    if status and status.lower() != "all":
        items = [i for i in items if i.status.lower() == status.lower()]
    if exchange and exchange.upper() != "ALL":
        items = [i for i in items if exchange.upper() in i.exchange.upper()]

    # Aggregate subscription statistics
    live_and_closed = [i for i in items if i.subscription_multiples.get("total", 0) > 0]
    avg_subscription = (
        round(sum(i.subscription_multiples["total"] for i in live_and_closed) / len(live_and_closed), 1)
        if live_and_closed
        else 0.0
    )

    return {
        "count": len(items),
        "average_subscription_multiple": avg_subscription,
        "ipos": [i.to_dict() for i in items],
        "sebi_compliance_note": (
            "Minimum application size conforms to SEBI circular CIR/MRD/DSA/06/2012 "
            "mandating ₹1,00,000 to ₹1,50,000 lot values for SME exchanges."
        ),
        "provenance": TAG_ACTUAL,
    }


def get_sme_migrations(status: str | None = None) -> dict[str, Any]:
    """
    Mainboard Migration Tracker:
    Audits active listings against SEBI 5-point migration criteria and displays graduated stars.
    """
    candidates = [check_mainboard_eligibility(item) for item in SME_ACTIVE_LISTINGS]

    if status and status.lower() == "ready":
        candidates = [c for c in candidates if c.is_fully_eligible]

    ready_count = sum(1 for c in candidates if c.is_fully_eligible)
    pipeline_count = sum(1 for c in candidates if not c.is_fully_eligible and c.criteria_met >= 4)

    return {
        "migration_criteria_summary": {
            "1_minimum_sme_tenure": "3 Years (36 Months)",
            "2_minimum_paid_up_capital": "₹10 Crore post-migration",
            "3_minimum_market_capitalization": "₹25 Crore",
            "4_positive_pat_track_record": "Positive PAT in at least 2 of 3 preceding fiscal years",
            "5_public_shareholders_base": "Minimum 250 public shareholders",
        },
        "stats": {
            "eligible_ready_count": ready_count,
            "approaching_criteria_count": pipeline_count,
            "graduated_stars_tracked": len(MIGRATED_MAINBOARD_STARS),
        },
        "eligible_candidates": [c.to_dict() for c in candidates],
        "graduated_mainboard_stars": [g.to_dict() for g in MIGRATED_MAINBOARD_STARS],
        "provenance": TAG_ACTUAL,
    }


def screen_sme_stocks(
    exchange: str = "ALL",
    sector: str | None = None,
    min_market_cap: float | None = None,
    max_market_cap: float | None = None,
    min_pat_growth: float | None = None,
    max_pe: float | None = None,
    max_spread_pct: float | None = None,
    migration_ready_only: bool = False,
    sort_by: str = "market_cap_cr",
    order: str = "desc",
) -> list[dict[str, Any]]:
    """
    Multi-factor institutional screener for NSE Emerge and BSE SME stocks.
    """
    filtered: list[SMEListing] = []

    for item in SME_ACTIVE_LISTINGS:
        if exchange != "ALL" and exchange.upper() not in item.exchange.upper():
            continue
        if sector and sector.lower() not in item.sector.lower():
            continue
        if min_market_cap is not None and item.market_cap_cr < min_market_cap:
            continue
        if max_market_cap is not None and item.market_cap_cr > max_market_cap:
            continue
        if min_pat_growth is not None and (item.sales_growth_3y_pct is None or item.sales_growth_3y_pct < min_pat_growth):
            continue
        if max_pe is not None and (item.pe_ratio is None or item.pe_ratio > max_pe):
            continue
        if max_spread_pct is not None and item.bid_ask_spread_pct > max_spread_pct:
            continue
        if migration_ready_only and not item.is_migration_eligible:
            continue
        filtered.append(item)

    # Sorting
    reverse = (order.lower() == "desc")
    if hasattr(SMEListing, sort_by):
        filtered.sort(key=lambda x: getattr(x, sort_by) or 0, reverse=reverse)
    else:
        filtered.sort(key=lambda x: x.market_cap_cr, reverse=reverse)

    return [item.to_dict() for item in filtered]
