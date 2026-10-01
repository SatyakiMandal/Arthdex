"""Corporate Financial Valuation, WACC, Dupont 5-Factor ROE & Bank Residual Income Engine.

Provides:
1. Non-Financial Firms: 2-Stage Discounted Cash Flow (DCF) with Free Cash Flow to Firm (FCFF) & WACC.
2. Banking & Financial Institutions: Residual Income Model (RIM / Edwards-Bell-Ohlson) with Cost of Equity (Ke).
   (Note: Standard FCFF/WACC is methodologically invalid for banks where debt is operating inventory/deposits).
3. Bayesian Probabilistic DCF (Firms) and Bayesian Probabilistic RIM (Banks).
4. Dupont 5-Factor ROE Decomposition (Tax Burden x Interest Burden x EBIT Margin x Asset Turnover x Leverage).
5. 5x5 Valuation Sensitivity Grids.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

DEFAULT_EQUITY_RISK_PREMIUM = 0.055  # 5.5% India Equity Risk Premium
DEFAULT_COST_OF_DEBT = 0.085         # 8.5% Pre-tax borrowing cost
DEFAULT_TAX_RATE = 0.25              # 25% Corporate tax rate
DEFAULT_TERMINAL_GROWTH_RATE = 0.045 # 4.5% Long-term India GDP-aligned terminal growth rate

BANK_TICKERS = {
    "INDUSINDBK.NS", "PFC.NS", "SBIN.NS", "HDFCBANK.NS", "ICICIBANK.NS", 
    "KOTAKBANK.NS", "AXISBANK.NS", "BANKBARODA.NS", "PNB.NS", "CANBK.NS",
    "BAJFINANCE.NS", "BAJAJFINSV.NS", "MUTHOOTFIN.NS", "CHOLAFIN.NS", "RECLTD.NS"
}


def is_financial_institution(financials: dict[str, Any] | None = None, ticker: str = "") -> bool:
    """Determine whether the target company is a bank or financial institution."""
    if ticker and ticker.upper() in BANK_TICKERS:
        return True
    
    if not isinstance(financials, dict):
        return False
        
    if financials.get("is_bank") is True or financials.get("statement_kind") == "bank":
        return True
        
    # Check screener label indicators
    rev_dict = financials.get("revenue")
    if isinstance(rev_dict, dict) and rev_dict.get("label_used") == "Interest Income":
        return True
        
    op_dict = financials.get("operating_income")
    if isinstance(op_dict, dict) and op_dict.get("label_used") == "Financing Profit":
        return True
        
    exp_dict = financials.get("expenses")
    if isinstance(exp_dict, dict) and exp_dict.get("label_used") == "Interest Expended":
        return True
        
    return False


@dataclass
class WACCResult:
    risk_free_rate: float
    beta: float
    equity_risk_premium: float
    cost_of_equity: float
    pre_tax_cost_of_debt: float
    tax_rate: float
    after_tax_cost_of_debt: float
    market_cap: float
    total_debt: float
    total_capital: float
    weight_equity: float
    weight_debt: float
    wacc: float

    def to_dict(self) -> dict[str, Any]:
        return {k: round(v, 4) if isinstance(v, float) else v for k, v in asdict(self).items()}


@dataclass
class DCFResult:
    current_price: float
    shares_outstanding: float
    latest_nopat: float
    projected_growth_rate: float
    terminal_growth_rate: float
    wacc: float
    projected_fcff: list[float]
    pv_projected_fcff: list[float]
    sum_pv_fcff: float
    terminal_value: float
    pv_terminal_value: float
    enterprise_value: float
    total_debt: float
    cash_and_equivalents: float
    equity_value: float
    intrinsic_value_per_share: float
    upside_downside_pct: float
    valuation_tier: str
    is_bank: bool = False
    methodology: str = "2-Stage FCFF / WACC DCF (Non-Financial Firm)"
    sensitivity_grid: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for k in ("sum_pv_fcff", "terminal_value", "pv_terminal_value", "enterprise_value",
                  "equity_value", "intrinsic_value_per_share", "upside_downside_pct"):
            if isinstance(d.get(k), float):
                d[k] = round(d[k], 2)
        return d


@dataclass
class ResidualIncomeResult:
    """Residual Income Model (RIM / Edwards-Bell-Ohlson) Valuation for Banks and Financial Institutions."""
    current_price: float
    shares_outstanding: float
    book_value_of_equity: float
    book_value_per_share: float
    latest_net_income: float
    baseline_roe_pct: float
    cost_of_equity_ke: float
    risk_free_rate: float
    beta: float
    equity_risk_premium: float
    retention_ratio: float
    projected_roe_schedule: list[float]
    projected_book_equity: list[float]
    projected_net_income: list[float]
    equity_charge: list[float]
    residual_income_schedule: list[float]
    pv_residual_income: list[float]
    sum_pv_residual_income: float
    terminal_residual_income: float
    pv_terminal_residual_income: float
    total_intrinsic_equity_value: float
    intrinsic_value_per_share: float
    current_pb_ratio: float
    intrinsic_pb_ratio: float
    upside_downside_pct: float
    valuation_tier: str
    is_bank: bool = True
    methodology: str = "Residual Income Model (RIM / Edwards-Bell-Ohlson 1995 for Banks)"
    academic_disclosure: str = (
        "Academic Methodology Note: FCFF / WACC valuation is methodologically invalid for banks and financial institutions "
        "because debt/deposits constitute operating raw materials rather than financial leverage, and CapEx is negligible compared to "
        "balance-sheet lending expansion. The Residual Income Model (RIM / Ohlson 1995) values equity directly via Book Value plus discounted Economic Value Added (ROE - Ke) * Book Equity."
    )
    sensitivity_grid: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for k in ("book_value_of_equity", "book_value_per_share", "latest_net_income",
                  "sum_pv_residual_income", "terminal_residual_income", "pv_terminal_residual_income",
                  "total_intrinsic_equity_value", "intrinsic_value_per_share", "upside_downside_pct"):
            if isinstance(d.get(k), float):
                d[k] = round(d[k], 2)
        return d


@dataclass
class DupontResult:
    tax_burden: float        # Net Income / EBT
    interest_burden: float   # EBT / EBIT
    ebit_margin: float       # EBIT / Revenue
    asset_turnover: float    # Revenue / Total Assets
    financial_leverage: float# Total Assets / Total Equity
    roe_pct: float           # Product of 5 terms in %
    roe_quality_tier: str
    historical_roe_series: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "tax_burden": round(self.tax_burden, 3),
            "interest_burden": round(self.interest_burden, 3),
            "ebit_margin_pct": round(self.ebit_margin * 100, 2),
            "asset_turnover": round(self.asset_turnover, 2),
            "financial_leverage": round(self.financial_leverage, 2),
            "roe_pct": round(self.roe_pct, 2),
            "roe_quality_tier": self.roe_quality_tier,
            "historical_roe_series": self.historical_roe_series,
        }



@dataclass
class KeyFinancialRatiosResult:
    roa_pct: float
    roe_pct: float
    roce_pct: float
    debt_to_equity: float
    interest_coverage_ratio: float
    current_ratio: float
    asset_turnover: float
    cash_ratio: float
    ratios_summary_table: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RelativeValuationMultiplesResult:
    pe_ratio: float | None
    pb_ratio: float | None
    price_to_revenue_per_share: float | None
    peg_ratio: float | None
    ev_to_ebitda: float | None
    ev_to_ebit: float | None
    price_to_cash_flow: float | None
    ev_to_sales: float | None
    price_to_sales: float | None
    sector_name: str
    overall_valuation_rating: str
    relative_valuation_stance: str = "Fair Value"
    composite_relative_score: float | None = 50.0
    peer_harmonized_target_price: float | None = 0.0
    implied_upside_vs_peers_pct: float | None = 0.0
    multiples_summary_table: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def multiples(self) -> list[dict[str, Any]]:
        return self.multiples_summary_table

    @property
    def composite_valuation_stance(self) -> str:
        return self.relative_valuation_stance or self.overall_valuation_rating

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def compute_wacc(
    market_cap: float,
    total_debt: float,
    beta: float = 1.0,
    risk_free_rate: float = 0.068,
    equity_risk_premium: float = DEFAULT_EQUITY_RISK_PREMIUM,
    pre_tax_cost_of_debt: float = DEFAULT_COST_OF_DEBT,
    tax_rate: float = DEFAULT_TAX_RATE,
) -> WACCResult:
    """Calculate CAPM Cost of Equity and Weighted Average Cost of Capital (WACC)."""
    e_val = max(1.0, float(market_cap))
    d_val = max(0.0, float(total_debt))
    tot_cap = e_val + d_val

    w_e = e_val / tot_cap
    w_d = d_val / tot_cap

    # CAPM: Ke = Rf + Beta * ERP
    k_e = risk_free_rate + (beta * equity_risk_premium)
    k_d_after_tax = pre_tax_cost_of_debt * (1.0 - tax_rate)

    # WACC = We * Ke + Wd * Kd(1-t)
    wacc_val = (w_e * k_e) + (w_d * k_d_after_tax)
    wacc_val = max(0.04, min(0.25, wacc_val))

    return WACCResult(
        risk_free_rate=risk_free_rate,
        beta=beta,
        equity_risk_premium=equity_risk_premium,
        cost_of_equity=k_e,
        pre_tax_cost_of_debt=pre_tax_cost_of_debt,
        tax_rate=tax_rate,
        after_tax_cost_of_debt=k_d_after_tax,
        market_cap=e_val,
        total_debt=d_val,
        total_capital=tot_cap,
        weight_equity=w_e,
        weight_debt=w_d,
        wacc=wacc_val,
    )


def compute_dcf_valuation(
    current_price: float,
    shares_outstanding: float,
    nopat: float,
    total_debt: float = 0.0,
    cash: float = 0.0,
    projected_growth_rate: float = 0.12,
    terminal_growth_rate: float = DEFAULT_TERMINAL_GROWTH_RATE,
    wacc: float = 0.11,
    forecast_years: int = 5,
) -> DCFResult:
    """Compute 2-Stage DCF Intrinsic Value and 5x5 Sensitivity Grid for Non-Financial Firms."""
    curr_p = max(1.0, float(current_price))
    shares = max(0.01, float(shares_outstanding))
    base_nopat = max(10.0, float(nopat))

    # 1. 5-Year Discrete FCFF Projection
    fcff_list: list[float] = []
    pv_fcff_list: list[float] = []
    c_nopat = base_nopat

    for yr in range(1, forecast_years + 1):
        decay_growth = projected_growth_rate * (0.95 ** (yr - 1))
        c_nopat *= (1.0 + decay_growth)
        fcff_list.append(c_nopat)
        pv_fcff_list.append(c_nopat / ((1.0 + wacc) ** yr))

    sum_pv_fcff = float(np.sum(pv_fcff_list))

    # 2. Terminal Value (Gordon Growth)
    last_fcff = fcff_list[-1]
    denom = max(0.015, wacc - terminal_growth_rate)
    tv = (last_fcff * (1.0 + terminal_growth_rate)) / denom
    pv_tv = tv / ((1.0 + wacc) ** forecast_years)

    # 3. Enterprise Value & Equity Value
    ev = sum_pv_fcff + pv_tv
    eq_val = max(1.0, ev - total_debt + cash)
    intrinsic_p = eq_val / shares

    upside_pct = ((intrinsic_p - curr_p) / curr_p) * 100.0

    tier = (
        "Substantial Undervaluation (>25% Upside)" if upside_pct > 25.0
        else "Modest Undervaluation (10-25% Upside)" if upside_pct >= 10.0
        else "Fair Value / Par (-10% to +10%)" if abs(upside_pct) < 10.0
        else "Modest Overvaluation (-10% to -25%)" if upside_pct >= -25.0
        else "Substantial Overvaluation (>25% Premium)"
    )

    # 4. 5x5 Sensitivity Grid
    wacc_steps = [wacc - 0.015, wacc - 0.0075, wacc, wacc + 0.0075, wacc + 0.015]
    g_steps = [terminal_growth_rate - 0.015, terminal_growth_rate - 0.0075, terminal_growth_rate, terminal_growth_rate + 0.0075, terminal_growth_rate + 0.015]

    grid_rows: list[dict[str, Any]] = []
    for w_i in wacc_steps:
        row: dict[str, Any] = {"WACC": f"{w_i * 100:.2f}%"}
        for g_j in g_steps:
            if w_i <= g_j:
                row[f"g={g_j*100:.2f}%"] = "N/A"
                continue
            pv_f = sum(c / ((1.0 + w_i) ** (y + 1)) for y, c in enumerate(fcff_list))
            tv_ij = (last_fcff * (1.0 + g_j)) / (w_i - g_j)
            pv_tv_ij = tv_ij / ((1.0 + w_i) ** forecast_years)
            ev_ij = pv_f + pv_tv_ij
            eq_ij = max(1.0, ev_ij - total_debt + cash)
            p_ij = eq_ij / shares
            row[f"g={g_j*100:.2f}%"] = round(p_ij, 2)
        grid_rows.append(row)

    return DCFResult(
        current_price=curr_p,
        shares_outstanding=shares,
        latest_nopat=base_nopat,
        projected_growth_rate=projected_growth_rate,
        terminal_growth_rate=terminal_growth_rate,
        wacc=wacc,
        projected_fcff=fcff_list,
        pv_projected_fcff=pv_fcff_list,
        sum_pv_fcff=sum_pv_fcff,
        terminal_value=tv,
        pv_terminal_value=pv_tv,
        enterprise_value=ev,
        total_debt=total_debt,
        cash_and_equivalents=cash,
        equity_value=eq_val,
        intrinsic_value_per_share=intrinsic_p,
        upside_downside_pct=upside_pct,
        valuation_tier=tier,
        is_bank=False,
        methodology="2-Stage FCFF / WACC DCF (Non-Financial Firm)",
        sensitivity_grid=grid_rows,
    )


def compute_residual_income_valuation(
    current_price: float,
    shares_outstanding: float,
    book_value_equity: float,
    latest_net_income: float,
    beta: float = 1.10,
    risk_free_rate: float = 0.068,
    equity_risk_premium: float = DEFAULT_EQUITY_RISK_PREMIUM,
    retention_ratio: float = 0.80,
    terminal_growth_rate: float = DEFAULT_TERMINAL_GROWTH_RATE,
    forecast_years: int = 5,
) -> ResidualIncomeResult:
    """Compute Residual Income Model (RIM / Edwards-Bell-Ohlson) for Banks and Financial Institutions.
    
    Formula:
    V_0 = B_0 + Sum_{t=1}^5 [ (ROE_t - Ke) * B_{t-1} / (1 + Ke)^t ] + Terminal_RI / ((Ke - g) * (1 + Ke)^5)
    """
    curr_p = max(1.0, float(current_price))
    shares = max(0.01, float(shares_outstanding))
    b0 = max(100.0, float(book_value_equity))
    bvps = b0 / shares
    
    # Cost of Equity Ke via CAPM
    ke = risk_free_rate + beta * equity_risk_premium
    ke = max(0.08, min(0.20, ke))
    
    # Baseline ROE from net income / book equity
    net_inc = float(latest_net_income)
    base_roe = max(0.05, min(0.30, net_inc / b0 if b0 > 0 else 0.14))
    
    # 5-Year Schedule with Clean Surplus Accounting
    b_t = b0
    roe_sched = []
    book_sched = []
    ni_sched = []
    eq_charge_sched = []
    ri_sched = []
    pv_ri_sched = []
    
    for yr in range(1, forecast_years + 1):
        # Slight mean reversion of ROE toward cost of equity
        roe_t = base_roe * (0.97 ** (yr - 1))
        roe_sched.append(roe_t)
        
        ni_t = b_t * roe_t
        ni_sched.append(ni_t)
        
        charge_t = b_t * ke
        eq_charge_sched.append(charge_t)
        
        ri_t = ni_t - charge_t  # (ROE_t - Ke) * B_{t-1}
        ri_sched.append(ri_t)
        
        pv_ri = ri_t / ((1.0 + ke) ** yr)
        pv_ri_sched.append(pv_ri)
        
        # Clean surplus: B_t = B_{t-1} + NI_t * Retention
        b_t += ni_t * retention_ratio
        book_sched.append(b_t)
        
    sum_pv_ri = float(np.sum(pv_ri_sched))
    
    # Terminal Residual Income (Gordon style or decay)
    last_ri = ri_sched[-1]
    denom = max(0.02, ke - terminal_growth_rate)
    terminal_ri = (last_ri * (1.0 + terminal_growth_rate)) / denom if last_ri > 0 else 0.0
    pv_term_ri = terminal_ri / ((1.0 + ke) ** forecast_years)
    
    # Total Intrinsic Equity Value
    total_eq_val = max(b0 * 0.5, b0 + sum_pv_ri + pv_term_ri)
    intrinsic_p = total_eq_val / shares
    
    current_pb = curr_p / bvps if bvps > 0 else 1.0
    intrinsic_pb = intrinsic_p / bvps if bvps > 0 else 1.0
    upside_pct = ((intrinsic_p - curr_p) / curr_p) * 100.0
    
    tier = (
        "Substantial Undervaluation (>25% Upside)" if upside_pct > 25.0
        else "Modest Undervaluation (10-25% Upside)" if upside_pct >= 10.0
        else "Fair Value / Par (-10% to +10%)" if abs(upside_pct) < 10.0
        else "Modest Overvaluation (-10% to -25%)" if upside_pct >= -25.0
        else "Substantial Overvaluation (>25% Premium)"
    )
    
    # 5x5 Sensitivity Grid: Cost of Equity (Ke) vs Sustainable ROE
    ke_steps = [ke - 0.015, ke - 0.0075, ke, ke + 0.0075, ke + 0.015]
    roe_steps = [base_roe - 0.03, base_roe - 0.015, base_roe, base_roe + 0.015, base_roe + 0.03]
    
    grid_rows: list[dict[str, Any]] = []
    for k_i in ke_steps:
        row: dict[str, Any] = {"Cost of Equity (Ke)": f"{k_i * 100:.2f}%"}
        for r_j in roe_steps:
            b_temp = b0
            pv_sum_temp = 0.0
            last_ri_temp = 0.0
            for y_k in range(1, forecast_years + 1):
                ni_temp = b_temp * r_j
                ri_temp = ni_temp - (b_temp * k_i)
                last_ri_temp = ri_temp
                pv_sum_temp += ri_temp / ((1.0 + k_i) ** y_k)
                b_temp += ni_temp * retention_ratio
            
            denom_temp = max(0.02, k_i - terminal_growth_rate)
            term_temp = (last_ri_temp * (1.0 + terminal_growth_rate)) / denom_temp if last_ri_temp > 0 else 0.0
            pv_term_temp = term_temp / ((1.0 + k_i) ** forecast_years)
            
            val_ij = max(b0 * 0.5, b0 + pv_sum_temp + pv_term_temp)
            p_ij = val_ij / shares
            row[f"ROE={r_j*100:.1f}%"] = round(p_ij, 2)
        grid_rows.append(row)
        
    return ResidualIncomeResult(
        current_price=curr_p,
        shares_outstanding=shares,
        book_value_of_equity=b0,
        book_value_per_share=bvps,
        latest_net_income=net_inc,
        baseline_roe_pct=base_roe * 100.0,
        cost_of_equity_ke=ke,
        risk_free_rate=risk_free_rate,
        beta=beta,
        equity_risk_premium=equity_risk_premium,
        retention_ratio=retention_ratio,
        projected_roe_schedule=roe_sched,
        projected_book_equity=book_sched,
        projected_net_income=ni_sched,
        equity_charge=eq_charge_sched,
        residual_income_schedule=ri_sched,
        pv_residual_income=pv_ri_sched,
        sum_pv_residual_income=sum_pv_ri,
        terminal_residual_income=terminal_ri,
        pv_terminal_residual_income=pv_term_ri,
        total_intrinsic_equity_value=total_eq_val,
        intrinsic_value_per_share=intrinsic_p,
        current_pb_ratio=current_pb,
        intrinsic_pb_ratio=intrinsic_pb,
        upside_downside_pct=upside_pct,
        valuation_tier=tier,
        is_bank=True,
        methodology="Residual Income Model (RIM / Edwards-Bell-Ohlson 1995 for Banks)",
        sensitivity_grid=grid_rows,
    )


def compute_dupont_5_factor_roe(financials: dict[str, Any]) -> DupontResult:
    """Compute Dupont 5-Factor Return on Equity (ROE) decomposition safely handling missing or None values."""
    if not isinstance(financials, dict):
        financials = {}

    bs = financials.get("balance_sheet") if isinstance(financials.get("balance_sheet"), dict) else {}
    top_ratios = financials.get("top_ratios") if isinstance(financials.get("top_ratios"), dict) else {}

    net_inc_dict = financials.get("net_profit") if isinstance(financials.get("net_profit"), dict) else {}
    net_income_raw = net_inc_dict.get("latest") if isinstance(net_inc_dict, dict) else None
    net_income = float(net_income_raw) if net_income_raw is not None else 100.0

    rev_dict = financials.get("revenue") if isinstance(financials.get("revenue"), dict) else {}
    rev_raw = rev_dict.get("latest") if isinstance(rev_dict, dict) else None
    revenue = max(1.0, float(rev_raw) if rev_raw is not None else 1000.0)

    op_dict = financials.get("operating_income") if isinstance(financials.get("operating_income"), dict) else {}
    op_raw = op_dict.get("latest") if isinstance(op_dict, dict) else None
    ebit = float(op_raw) if op_raw is not None else (revenue * 0.15)

    debt_raw = bs.get("total_debt") if bs.get("total_debt") is not None else bs.get("borrowings")
    debt = max(0.0, float(debt_raw) if debt_raw is not None else 100.0)

    eq_cap = bs.get("equity_capital")
    reserves = bs.get("reserves")
    eq_cap_val = float(eq_cap) if eq_cap is not None else 50.0
    res_val = float(reserves) if reserves is not None else 450.0
    equity_book = eq_cap_val + res_val

    mcap_raw = top_ratios.get("Market Cap") if top_ratios.get("Market Cap") is not None else financials.get("market_cap")
    mcap = float(mcap_raw) if mcap_raw is not None else 1000.0
    equity = equity_book if equity_book > 0 else max(10.0, mcap * 0.2)

    tot_assets_raw = bs.get("total_assets")
    assets = float(tot_assets_raw) if tot_assets_raw is not None and float(tot_assets_raw) > 0 else max(10.0, equity + debt)

    ebt = ebit - (debt * 0.08)
    if abs(ebt) < 1.0:
        ebt = 1.0 if ebt >= 0 else -1.0
    tax_burden = min(1.0, max(0.4, net_income / ebt)) if ebt > 0 and net_income > 0 else 0.70

    ebit_safe = ebit if abs(ebit) > 1.0 else (1.0 if ebit >= 0 else -1.0)
    interest_burden = min(1.0, max(0.3, ebt / ebit_safe)) if ebit_safe > 0 and ebt > 0 else 0.80

    ebit_margin = max(-0.50, min(0.60, ebit / revenue))
    asset_turnover = max(0.01, min(4.0, revenue / assets))
    leverage = max(1.0, min(15.0, assets / equity))

    if net_income < 0:
        roe_val = (net_income / equity) * 100.0
    else:
        roe_val = (tax_burden * interest_burden * max(0.01, ebit_margin) * asset_turnover * leverage) * 100.0

    tier = (
        "High Quality Compounding (ROE > 20%, Margin-Driven)" if roe_val >= 20.0 and ebit_margin > 0.15
        else "Robust ROE (15-20%)" if roe_val >= 15.0
        else "Moderate Return (10-15%)" if roe_val >= 10.0
        else "Negative / Distressed ROE (Loss-Making)" if roe_val < 0
        else "Sub-par / Capital-Inefficient (ROE < 10%)"
    )

    return DupontResult(
        tax_burden=tax_burden,
        interest_burden=interest_burden,
        ebit_margin=ebit_margin,
        asset_turnover=asset_turnover,
        financial_leverage=leverage,
        roe_pct=roe_val,
        roe_quality_tier=tier,
    )


@dataclass
class ScenarioDCFResult:
    bull_case_price: float
    bull_case_upside_pct: float
    bull_growth_rate: float
    bull_wacc: float
    base_case_price: float
    base_case_upside_pct: float
    base_growth_rate: float
    base_wacc: float
    bear_case_price: float
    bear_case_upside_pct: float
    bear_growth_rate: float
    bear_wacc: float
    scenario_table: list[dict[str, Any]]
    is_bank: bool = False


@dataclass
class BayesianDCFResult:
    current_price: float
    bayesian_median_price: float
    p10_conservative_price: float
    p25_lower_quartile_price: float
    p75_upper_quartile_price: float
    p90_optimistic_price: float
    prob_undervaluation_pct: float
    mean_projected_fcff: float
    mean_projected_fcfe: float
    probabilistic_wacc_mean: float
    monte_carlo_runs: int
    percentiles_table: list[dict[str, Any]]
    classical_dcf_price: float = 0.0
    bayesian_revenue_forecast: list[dict[str, Any]] = field(default_factory=list)
    bayesian_fcff_forecast: list[dict[str, Any]] = field(default_factory=list)
    bayesian_fcfe_forecast: list[dict[str, Any]] = field(default_factory=list)
    probabilistic_capm: dict[str, Any] = field(default_factory=dict)
    bayesian_wacc_distribution: dict[str, Any] = field(default_factory=dict)
    classical_vs_bayesian_comparison: list[dict[str, Any]] = field(default_factory=list)
    is_bank: bool = False
    valuation_methodology: str = "Bayesian Monte Carlo DCF / FCFF Simulation"


def compute_scenario_dcf(
    current_price: float,
    shares_outstanding: float,
    nopat: float,
    total_debt: float = 0.0,
    cash: float = 0.0,
    base_growth_rate: float = 0.12,
    base_wacc: float = 0.11,
    is_bank: bool = False,
    book_value_equity: float = 1000.0,
    net_income: float = 150.0,
) -> ScenarioDCFResult:
    """Compute 3-Case Scenario schedule (Bull, Base, Bear) handling firms and banks."""
    if is_bank:
        # Bank Scenarios: Bull (+200 bps ROE, -50 bps Ke), Base (Consensus), Bear (-200 bps ROE, +75 bps Ke)
        base_rim = compute_residual_income_valuation(current_price, shares_outstanding, book_value_equity, net_income)
        base_roe = base_rim.baseline_roe_pct / 100.0
        base_ke = base_rim.cost_of_equity_ke
        
        bull_rim = compute_residual_income_valuation(
            current_price, shares_outstanding, book_value_equity, net_income * 1.15,
            beta=max(0.8, base_rim.beta * 0.9)
        )
        bear_rim = compute_residual_income_valuation(
            current_price, shares_outstanding, book_value_equity, net_income * 0.85,
            beta=base_rim.beta * 1.15
        )
        
        table = [
            {
                "Scenario": "Bull Case (High ROE / Margin Expansion)",
                "Growth Rate / ROE (%)": round(bull_rim.baseline_roe_pct, 2),
                "Discount Rate Ke (%)": round(bull_rim.cost_of_equity_ke * 100, 2),
                "Enterprise / Equity Value (₹ Cr)": round(bull_rim.total_intrinsic_equity_value, 2),
                "Intrinsic Price (₹)": round(bull_rim.intrinsic_value_per_share, 2),
                "Upside / Downside (%)": round(bull_rim.upside_downside_pct, 2),
                "Valuation Tier": bull_rim.valuation_tier,
            },
            {
                "Scenario": "Base Case (Consensus ROE)",
                "Growth Rate / ROE (%)": round(base_rim.baseline_roe_pct, 2),
                "Discount Rate Ke (%)": round(base_rim.cost_of_equity_ke * 100, 2),
                "Enterprise / Equity Value (₹ Cr)": round(base_rim.total_intrinsic_equity_value, 2),
                "Intrinsic Price (₹)": round(base_rim.intrinsic_value_per_share, 2),
                "Upside / Downside (%)": round(base_rim.upside_downside_pct, 2),
                "Valuation Tier": base_rim.valuation_tier,
            },
            {
                "Scenario": "Bear Case (Credit Stress / Asset Quality Drag)",
                "Growth Rate / ROE (%)": round(bear_rim.baseline_roe_pct, 2),
                "Discount Rate Ke (%)": round(bear_rim.cost_of_equity_ke * 100, 2),
                "Enterprise / Equity Value (₹ Cr)": round(bear_rim.total_intrinsic_equity_value, 2),
                "Intrinsic Price (₹)": round(bear_rim.intrinsic_value_per_share, 2),
                "Upside / Downside (%)": round(bear_rim.upside_downside_pct, 2),
                "Valuation Tier": bear_rim.valuation_tier,
            },
        ]
        
        return ScenarioDCFResult(
            bull_case_price=round(bull_rim.intrinsic_value_per_share, 2),
            bull_case_upside_pct=round(bull_rim.upside_downside_pct, 2),
            bull_growth_rate=round(bull_rim.baseline_roe_pct / 100.0, 4),
            bull_wacc=round(bull_rim.cost_of_equity_ke, 4),
            base_case_price=round(base_rim.intrinsic_value_per_share, 2),
            base_case_upside_pct=round(base_rim.upside_downside_pct, 2),
            base_growth_rate=round(base_rim.baseline_roe_pct / 100.0, 4),
            base_wacc=round(base_rim.cost_of_equity_ke, 4),
            bear_case_price=round(bear_rim.intrinsic_value_per_share, 2),
            bear_case_upside_pct=round(bear_rim.upside_downside_pct, 2),
            bear_growth_rate=round(bear_rim.baseline_roe_pct / 100.0, 4),
            bear_wacc=round(bear_rim.cost_of_equity_ke, 4),
            scenario_table=table,
            is_bank=True,
        )

    # Standard Firm DCF Scenarios
    bull_g = base_growth_rate * 1.25
    bull_w = max(0.06, base_wacc - 0.0075)
    bull_dcf = compute_dcf_valuation(
        current_price=current_price,
        shares_outstanding=shares_outstanding,
        nopat=nopat * 1.08,
        total_debt=total_debt,
        cash=cash,
        projected_growth_rate=bull_g,
        wacc=bull_w,
    )

    base_dcf = compute_dcf_valuation(
        current_price=current_price,
        shares_outstanding=shares_outstanding,
        nopat=nopat,
        total_debt=total_debt,
        cash=cash,
        projected_growth_rate=base_growth_rate,
        wacc=base_wacc,
    )

    bear_g = max(0.02, base_growth_rate * 0.75)
    bear_w = base_wacc + 0.0075
    bear_dcf = compute_dcf_valuation(
        current_price=current_price,
        shares_outstanding=shares_outstanding,
        nopat=nopat * 0.95,
        total_debt=total_debt,
        cash=cash,
        projected_growth_rate=bear_g,
        wacc=bear_w,
    )

    table = [
        {
            "Scenario": "Bull Case (High Growth)",
            "Growth Rate (%)": round(bull_g * 100, 2),
            "WACC (%)": round(bull_w * 100, 2),
            "Enterprise Value (₹ Cr)": round(bull_dcf.enterprise_value, 2),
            "Intrinsic Price (₹)": round(bull_dcf.intrinsic_value_per_share, 2),
            "Upside / Downside (%)": round(bull_dcf.upside_downside_pct, 2),
            "Valuation Tier": bull_dcf.valuation_tier,
        },
        {
            "Scenario": "Base Case (Consensus)",
            "Growth Rate (%)": round(base_growth_rate * 100, 2),
            "WACC (%)": round(base_wacc * 100, 2),
            "Enterprise Value (₹ Cr)": round(base_dcf.enterprise_value, 2),
            "Intrinsic Price (₹)": round(base_dcf.intrinsic_value_per_share, 2),
            "Upside / Downside (%)": round(base_dcf.upside_downside_pct, 2),
            "Valuation Tier": base_dcf.valuation_tier,
        },
        {
            "Scenario": "Bear Case (Macro Stress)",
            "Growth Rate (%)": round(bear_g * 100, 2),
            "WACC (%)": round(bear_w * 100, 2),
            "Enterprise Value (₹ Cr)": round(bear_dcf.enterprise_value, 2),
            "Intrinsic Price (₹)": round(bear_dcf.intrinsic_value_per_share, 2),
            "Upside / Downside (%)": round(bear_dcf.upside_downside_pct, 2),
            "Valuation Tier": bear_dcf.valuation_tier,
        },
    ]

    return ScenarioDCFResult(
        bull_case_price=round(bull_dcf.intrinsic_value_per_share, 2),
        bull_case_upside_pct=round(bull_dcf.upside_downside_pct, 2),
        bull_growth_rate=round(bull_g, 4),
        bull_wacc=round(bull_w, 4),
        base_case_price=round(base_dcf.intrinsic_value_per_share, 2),
        base_case_upside_pct=round(base_dcf.upside_downside_pct, 2),
        base_growth_rate=round(base_growth_rate, 4),
        base_wacc=round(base_wacc, 4),
        bear_case_price=round(bear_dcf.intrinsic_value_per_share, 2),
        bear_case_upside_pct=round(bear_dcf.upside_downside_pct, 2),
        bear_growth_rate=round(bear_g, 4),
        bear_wacc=round(bear_w, 4),
        scenario_table=table,
        is_bank=False,
    )


def compute_bayesian_probabilistic_dcf(
    current_price: float,
    shares_outstanding: float,
    nopat: float,
    total_debt: float = 0.0,
    cash: float = 0.0,
    base_wacc: float = 0.11,
    base_growth_rate: float = 0.12,
    base_revenue: float | None = None,
    num_simulations: int = 1000,
    random_seed: int = 42,
    is_bank: bool = False,
    book_value_equity: float = 1000.0,
    net_income: float = 150.0,
) -> BayesianDCFResult:
    """Compute Monte Carlo / Bayesian Probabilistic Valuation.
    
    If is_bank=True, executes Bayesian Residual Income Model (RIM).
    If is_bank=False, executes Bayesian FCFF/FCFE DCF.
    """
    np.random.seed(random_seed)
    curr_p = max(1.0, float(current_price))
    shares = max(0.01, float(shares_outstanding))

    if is_bank:
        b0 = max(100.0, float(book_value_equity))
        base_rim = compute_residual_income_valuation(curr_p, shares, b0, net_income)
        base_roe = base_rim.baseline_roe_pct / 100.0

        # Prior distributions for Bank:
        # 1. Sustainable ROE ~ N(base_roe, 0.02^2)
        roe_samples = np.random.normal(loc=base_roe, scale=0.02, size=num_simulations)
        roe_samples = np.clip(roe_samples, 0.04, 0.32)

        # 2. Beta ~ N(1.15, 0.12^2) -> Ke = Rf + Beta * ERP
        beta_samples = np.random.normal(loc=1.15, scale=0.12, size=num_simulations)
        ke_samples = 0.068 + beta_samples * 0.055
        ke_samples = np.clip(ke_samples, 0.08, 0.20)

        # 3. Retention Ratio ~ N(0.80, 0.04^2)
        ret_samples = np.random.normal(loc=0.80, scale=0.04, size=num_simulations)
        ret_samples = np.clip(ret_samples, 0.60, 0.95)

        # 4. Terminal Growth ~ N(4.5%, 0.5%)
        term_g_samples = np.random.normal(loc=DEFAULT_TERMINAL_GROWTH_RATE, scale=0.005, size=num_simulations)

        sim_prices = []
        sim_ni_yr = [[] for _ in range(5)]
        sim_ri_yr = [[] for _ in range(5)]
        sim_bv_yr = [[] for _ in range(5)]

        for i in range(num_simulations):
            r_i = roe_samples[i]
            k_i = ke_samples[i]
            ret_i = ret_samples[i]
            tg_i = min(term_g_samples[i], k_i - 0.015)

            b_curr = b0
            pv_ri_sum = 0.0
            last_ri = 0.0

            for yr in range(1, 6):
                # decay
                r_t = r_i * (0.97 ** (yr - 1))
                ni_t = b_curr * r_t
                ri_t = ni_t - (b_curr * k_i)
                last_ri = ri_t

                sim_ni_yr[yr - 1].append(ni_t)
                sim_ri_yr[yr - 1].append(ri_t)
                sim_bv_yr[yr - 1].append(b_curr)

                pv_ri_sum += ri_t / ((1.0 + k_i) ** yr)
                b_curr += ni_t * ret_i

            denom_i = max(0.02, k_i - tg_i)
            tv_ri = (last_ri * (1.0 + tg_i)) / denom_i if last_ri > 0 else 0.0
            pv_tv_ri = tv_ri / ((1.0 + k_i) ** 5)

            total_val = max(b0 * 0.5, b0 + pv_ri_sum + pv_tv_ri)
            sim_prices.append(total_val / shares)

        sim_prices = np.array(sim_prices)
        p10 = float(np.percentile(sim_prices, 10))
        p25 = float(np.percentile(sim_prices, 25))
        p50 = float(np.percentile(sim_prices, 50))
        p75 = float(np.percentile(sim_prices, 75))
        p90 = float(np.percentile(sim_prices, 90))

        prob_underval = float(np.mean(sim_prices > curr_p) * 100.0)

        # 5-Year Forecast Tables
        ni_forecast_table = []
        ri_forecast_table = []
        bv_forecast_table = []
        for yr in range(1, 6):
            ni_arr = np.array(sim_ni_yr[yr - 1])
            ri_arr = np.array(sim_ri_yr[yr - 1])
            bv_arr = np.array(sim_bv_yr[yr - 1])
            ni_forecast_table.append({
                "Horizon": f"Year {yr}",
                "P10 (Floor ₹ Cr)": round(float(np.percentile(ni_arr, 10)), 1),
                "P50 (Median ₹ Cr)": round(float(np.percentile(ni_arr, 50)), 1),
                "P90 (Ceiling ₹ Cr)": round(float(np.percentile(ni_arr, 90)), 1),
            })
            ri_forecast_table.append({
                "Horizon": f"Year {yr}",
                "P10 (Floor ₹ Cr)": round(float(np.percentile(ri_arr, 10)), 1),
                "P50 (Median ₹ Cr)": round(float(np.percentile(ri_arr, 50)), 1),
                "P90 (Ceiling ₹ Cr)": round(float(np.percentile(ri_arr, 90)), 1),
            })
            bv_forecast_table.append({
                "Horizon": f"Year {yr}",
                "P10 (Floor ₹ Cr)": round(float(np.percentile(bv_arr, 10)), 1),
                "P50 (Median ₹ Cr)": round(float(np.percentile(bv_arr, 50)), 1),
                "P90 (Ceiling ₹ Cr)": round(float(np.percentile(bv_arr, 90)), 1),
            })

        percentiles_table = [
            {"Percentile": "10th Percentile (Conservative / Floor)", "Intrinsic Value (₹)": round(p10, 2), "Margin of Safety (%)": round(((p10 - curr_p) / curr_p) * 100, 2)},
            {"Percentile": "25th Percentile (Lower Quartile)", "Intrinsic Value (₹)": round(p25, 2), "Margin of Safety (%)": round(((p25 - curr_p) / curr_p) * 100, 2)},
            {"Percentile": "50th Percentile (Bayesian Median Target)", "Intrinsic Value (₹)": round(p50, 2), "Margin of Safety (%)": round(((p50 - curr_p) / curr_p) * 100, 2)},
            {"Percentile": "75th Percentile (Upper Quartile)", "Intrinsic Value (₹)": round(p75, 2), "Margin of Safety (%)": round(((p75 - curr_p) / curr_p) * 100, 2)},
            {"Percentile": "90th Percentile (Optimistic / Blue Sky)", "Intrinsic Value (₹)": round(p90, 2), "Margin of Safety (%)": round(((p90 - curr_p) / curr_p) * 100, 2)},
        ]

        comp_table = [
            {"Metric": "Intrinsic Target Price (₹ / share)", "Classical Deterministic DCF": f"₹ {base_rim.intrinsic_value_per_share:,.2f} (RIM)", "Monte Carlo Bayesian DCF (P50 Median)": f"₹ {p50:,.2f} (Bayesian RIM)", "Bayesian P10 Floor": f"₹ {p10:,.2f}", "Bayesian P90 Ceiling": f"₹ {p90:,.2f}"},
            {"Metric": "Margin of Safety / Upside (%)", "Classical Deterministic DCF": f"{base_rim.upside_downside_pct:+.1f}%", "Monte Carlo Bayesian DCF (P50 Median)": f"{((p50 - curr_p) / curr_p) * 100:+.1f}%", "Bayesian P10 Floor": f"{((p10 - curr_p) / curr_p) * 100:+.1f}%", "Bayesian P90 Ceiling": f"{((p90 - curr_p) / curr_p) * 100:+.1f}%"},
            {"Metric": "Discount Rate (Cost of Equity Ke)", "Classical Deterministic DCF": f"{base_rim.cost_of_equity_ke * 100:.2f}%", "Monte Carlo Bayesian DCF (P50 Median)": f"{float(np.median(ke_samples)) * 100:.2f}%", "Bayesian P10 Floor": f"{float(np.percentile(ke_samples, 10)) * 100:.2f}%", "Bayesian P90 Ceiling": f"{float(np.percentile(ke_samples, 90)) * 100:.2f}%"},
            {"Metric": "Sustainable Return on Equity (ROE)", "Classical Deterministic DCF": f"{base_rim.baseline_roe_pct:.1f}%", "Monte Carlo Bayesian DCF (P50 Median)": f"{float(np.median(roe_samples)) * 100:.1f}%", "Bayesian P10 Floor": f"{float(np.percentile(roe_samples, 10)) * 100:.1f}%", "Bayesian P90 Ceiling": f"{float(np.percentile(roe_samples, 90)) * 100:.1f}%"},
            {"Metric": "Valuation Conviction / Undervaluation Prob.", "Classical Deterministic DCF": "Deterministic (Point Estimate)", "Monte Carlo Bayesian DCF (P50 Median)": f"{prob_underval:.1f}% Probability", "Bayesian P10 Floor": "Conservative Bound", "Bayesian P90 Ceiling": "Optimistic Bound"},
        ]

        return BayesianDCFResult(
            current_price=curr_p,
            bayesian_median_price=round(p50, 2),
            p10_conservative_price=round(p10, 2),
            p25_lower_quartile_price=round(p25, 2),
            p75_upper_quartile_price=round(p75, 2),
            p90_optimistic_price=round(p90, 2),
            prob_undervaluation_pct=round(prob_underval, 1),
            mean_projected_fcff=round(float(np.mean([np.mean(x) for x in sim_ri_yr])), 2),
            mean_projected_fcfe=round(float(np.mean([np.mean(x) for x in sim_ni_yr])), 2),
            probabilistic_wacc_mean=round(float(np.mean(ke_samples)), 4),
            monte_carlo_runs=num_simulations,
            percentiles_table=percentiles_table,
            classical_dcf_price=round(base_rim.intrinsic_value_per_share, 2),
            bayesian_revenue_forecast=ni_forecast_table,
            bayesian_fcff_forecast=ri_forecast_table,
            bayesian_fcfe_forecast=bv_forecast_table,
            probabilistic_capm={
                "cost_of_equity_mean": round(float(np.mean(ke_samples)), 4),
                "cost_of_equity_std": round(float(np.std(ke_samples)), 4),
                "beta_prior_mean": round(float(np.mean(beta_samples)), 3),
                "beta_prior_std": round(float(np.std(beta_samples)), 3),
                "equity_risk_premium": 0.055,
            },
            bayesian_wacc_distribution={
                "wacc_mean": round(float(np.mean(ke_samples)), 4),
                "wacc_std": round(float(np.std(ke_samples)), 4),
                "p10_wacc": round(float(np.percentile(ke_samples, 10)), 4),
                "p50_wacc": round(float(np.percentile(ke_samples, 50)), 4),
                "p90_wacc": round(float(np.percentile(ke_samples, 90)), 4),
            },
            classical_vs_bayesian_comparison=comp_table,
            is_bank=True,
            valuation_methodology="Bayesian Residual Income Model (RIM / Edwards-Bell-Ohlson 1995 for Banks)",
        )

    # Standard Non-Financial Firm Bayesian DCF
    base_nopat = max(10.0, float(nopat))
    base_rev = max(base_nopat * 4.0, float(base_revenue) if base_revenue is not None else base_nopat * 6.0)

    classical_dcf = compute_dcf_valuation(
        current_price=curr_p,
        shares_outstanding=shares,
        nopat=base_nopat,
        total_debt=total_debt,
        cash=cash,
        projected_growth_rate=base_growth_rate,
        wacc=base_wacc,
    )

    g_samples = np.random.normal(loc=base_growth_rate, scale=0.03, size=num_simulations)
    g_samples = np.clip(g_samples, 0.02, 0.30)

    beta_samples = np.random.normal(loc=1.15, scale=0.12, size=num_simulations)
    ke_samples = 0.068 + beta_samples * 0.065

    wacc_samples = np.random.normal(loc=base_wacc, scale=0.012, size=num_simulations)
    wacc_samples = np.clip(wacc_samples, 0.06, 0.20)

    term_g_samples = np.random.normal(loc=DEFAULT_TERMINAL_GROWTH_RATE, scale=0.005, size=num_simulations)
    term_g_samples = np.clip(term_g_samples, 0.025, 0.055)

    nopat_mult_samples = np.random.normal(loc=1.0, scale=0.08, size=num_simulations)
    nopat_mult_samples = np.clip(nopat_mult_samples, 0.70, 1.40)

    sim_prices = []
    sim_rev_yr = [[] for _ in range(5)]
    sim_fcff_yr = [[] for _ in range(5)]
    sim_fcfe_yr = [[] for _ in range(5)]
    sim_fcffs = []
    sim_fcfes = []

    for i in range(num_simulations):
        g_i = g_samples[i]
        w_i = wacc_samples[i]
        tg_i = min(term_g_samples[i], w_i - 0.015)
        nopat_i = base_nopat * nopat_mult_samples[i]
        rev_i = base_rev

        pv_fcff = 0.0
        c_fcff = nopat_i
        for yr in range(1, 6):
            decay = (0.95 ** (yr - 1))
            yr_g = g_i * decay
            rev_i *= (1.0 + yr_g)
            c_fcff *= (1.0 + yr_g)
            fcfe_yr_val = max(0.0, c_fcff - (total_debt * 0.08 * 0.75))

            sim_rev_yr[yr - 1].append(rev_i)
            sim_fcff_yr[yr - 1].append(c_fcff)
            sim_fcfe_yr[yr - 1].append(fcfe_yr_val)

            pv_fcff += c_fcff / ((1.0 + w_i) ** yr)

        sim_fcffs.append(c_fcff)

        tv = (c_fcff * (1.0 + tg_i)) / max(0.015, w_i - tg_i)
        pv_tv = tv / ((1.0 + w_i) ** 5)

        ev = pv_fcff + pv_tv
        eq = max(1.0, ev - total_debt + cash)
        sim_prices.append(eq / shares)

        fcfe_i = max(0.0, c_fcff - (total_debt * 0.08 * 0.75))
        sim_fcfes.append(fcfe_i)

    sim_prices = np.array(sim_prices)
    p10 = float(np.percentile(sim_prices, 10))
    p25 = float(np.percentile(sim_prices, 25))
    p50 = float(np.percentile(sim_prices, 50))
    p75 = float(np.percentile(sim_prices, 75))
    p90 = float(np.percentile(sim_prices, 90))

    prob_underval = float(np.mean(sim_prices > curr_p) * 100.0)

    rev_forecast_table = []
    fcff_forecast_table = []
    fcfe_forecast_table = []
    for yr in range(1, 6):
        rev_arr = np.array(sim_rev_yr[yr - 1])
        fcff_arr = np.array(sim_fcff_yr[yr - 1])
        fcfe_arr = np.array(sim_fcfe_yr[yr - 1])
        rev_forecast_table.append({
            "Horizon": f"Year {yr}",
            "P10 (Floor ₹ Cr)": round(float(np.percentile(rev_arr, 10)), 1),
            "P50 (Median ₹ Cr)": round(float(np.percentile(rev_arr, 50)), 1),
            "P90 (Ceiling ₹ Cr)": round(float(np.percentile(rev_arr, 90)), 1),
        })
        fcff_forecast_table.append({
            "Horizon": f"Year {yr}",
            "P10 (Floor ₹ Cr)": round(float(np.percentile(fcff_arr, 10)), 1),
            "P50 (Median ₹ Cr)": round(float(np.percentile(fcff_arr, 50)), 1),
            "P90 (Ceiling ₹ Cr)": round(float(np.percentile(fcff_arr, 90)), 1),
        })
        fcfe_forecast_table.append({
            "Horizon": f"Year {yr}",
            "P10 (Floor ₹ Cr)": round(float(np.percentile(fcfe_arr, 10)), 1),
            "P50 (Median ₹ Cr)": round(float(np.percentile(fcfe_arr, 50)), 1),
            "P90 (Ceiling ₹ Cr)": round(float(np.percentile(fcfe_arr, 90)), 1),
        })

    percentiles_table = [
        {"Percentile": "10th Percentile (Conservative / Floor)", "Intrinsic Value (₹)": round(p10, 2), "Margin of Safety (%)": round(((p10 - curr_p) / curr_p) * 100, 2)},
        {"Percentile": "25th Percentile (Lower Quartile)", "Intrinsic Value (₹)": round(p25, 2), "Margin of Safety (%)": round(((p25 - curr_p) / curr_p) * 100, 2)},
        {"Percentile": "50th Percentile (Bayesian Median Target)", "Intrinsic Value (₹)": round(p50, 2), "Margin of Safety (%)": round(((p50 - curr_p) / curr_p) * 100, 2)},
        {"Percentile": "75th Percentile (Upper Quartile)", "Intrinsic Value (₹)": round(p75, 2), "Margin of Safety (%)": round(((p75 - curr_p) / curr_p) * 100, 2)},
        {"Percentile": "90th Percentile (Optimistic / Blue Sky)", "Intrinsic Value (₹)": round(p90, 2), "Margin of Safety (%)": round(((p90 - curr_p) / curr_p) * 100, 2)},
    ]

    comp_table = [
        {"Metric": "Intrinsic Target Price (₹ / share)", "Classical Deterministic DCF": f"₹ {classical_dcf.intrinsic_value_per_share:,.2f}", "Monte Carlo Bayesian DCF (P50 Median)": f"₹ {p50:,.2f}", "Bayesian P10 Floor": f"₹ {p10:,.2f}", "Bayesian P90 Ceiling": f"₹ {p90:,.2f}"},
        {"Metric": "Margin of Safety / Upside (%)", "Classical Deterministic DCF": f"{classical_dcf.upside_downside_pct:+.1f}%", "Monte Carlo Bayesian DCF (P50 Median)": f"{((p50 - curr_p) / curr_p) * 100:+.1f}%", "Bayesian P10 Floor": f"{((p10 - curr_p) / curr_p) * 100:+.1f}%", "Bayesian P90 Ceiling": f"{((p90 - curr_p) / curr_p) * 100:+.1f}%"},
        {"Metric": "Discount Rate (WACC %)", "Classical Deterministic DCF": f"{base_wacc * 100:.2f}%", "Monte Carlo Bayesian DCF (P50 Median)": f"{float(np.median(wacc_samples)) * 100:.2f}%", "Bayesian P10 Floor": f"{float(np.percentile(wacc_samples, 10)) * 100:.2f}%", "Bayesian P90 Ceiling": f"{float(np.percentile(wacc_samples, 90)) * 100:.2f}%"},
        {"Metric": "Terminal 5Y FCFF (₹ Cr)", "Classical Deterministic DCF": f"₹ {base_nopat * ((1.0 + base_growth_rate) ** 5):,.1f}", "Monte Carlo Bayesian DCF (P50 Median)": f"₹ {float(np.median(sim_fcffs)):,.1f}", "Bayesian P10 Floor": f"₹ {float(np.percentile(sim_fcffs, 10)):,.1f}", "Bayesian P90 Ceiling": f"₹ {float(np.percentile(sim_fcffs, 90)):,.1f}"},
        {"Metric": "Valuation Conviction / Undervaluation Prob.", "Classical Deterministic DCF": "Deterministic (100% Binary)", "Monte Carlo Bayesian DCF (P50 Median)": f"{prob_underval:.1f}% Probability", "Bayesian P10 Floor": "Conservative Bound", "Bayesian P90 Ceiling": "Optimistic Bound"},
    ]

    return BayesianDCFResult(
        current_price=curr_p,
        bayesian_median_price=round(p50, 2),
        p10_conservative_price=round(p10, 2),
        p25_lower_quartile_price=round(p25, 2),
        p75_upper_quartile_price=round(p75, 2),
        p90_optimistic_price=round(p90, 2),
        prob_undervaluation_pct=round(prob_underval, 1),
        mean_projected_fcff=round(float(np.mean(sim_fcffs)), 2),
        mean_projected_fcfe=round(float(np.mean(sim_fcfes)), 2),
        probabilistic_wacc_mean=round(float(np.mean(wacc_samples)), 4),
        monte_carlo_runs=num_simulations,
        percentiles_table=percentiles_table,
        classical_dcf_price=round(classical_dcf.intrinsic_value_per_share, 2),
        bayesian_revenue_forecast=rev_forecast_table,
        bayesian_fcff_forecast=fcff_forecast_table,
        bayesian_fcfe_forecast=fcfe_forecast_table,
        probabilistic_capm={
            "cost_of_equity_mean": round(float(np.mean(ke_samples)), 4),
            "cost_of_equity_std": round(float(np.std(ke_samples)), 4),
            "beta_prior_mean": round(float(np.mean(beta_samples)), 3),
            "beta_prior_std": round(float(np.std(beta_samples)), 3),
            "equity_risk_premium": 0.065,
        },
        bayesian_wacc_distribution={
            "wacc_mean": round(float(np.mean(wacc_samples)), 4),
            "wacc_std": round(float(np.std(wacc_samples)), 4),
            "p10_wacc": round(float(np.percentile(wacc_samples, 10)), 4),
            "p50_wacc": round(float(np.percentile(wacc_samples, 50)), 4),
            "p90_wacc": round(float(np.percentile(wacc_samples, 90)), 4),
        },
        classical_vs_bayesian_comparison=comp_table,
        is_bank=False,
        valuation_methodology="Bayesian Monte Carlo DCF / FCFF Simulation",
    )


def compute_key_financial_ratios(financials: dict[str, Any]) -> KeyFinancialRatiosResult:
    """Compute Core Financial Ratios Suite (ROA, ROE, ROCE, D/E, Interest Coverage, Current Ratio, Asset Turnover, Cash Ratio)."""
    if not isinstance(financials, dict):
        financials = {}

    bs = financials.get("balance_sheet") if isinstance(financials.get("balance_sheet"), dict) else {}
    net_inc_dict = financials.get("net_profit") if isinstance(financials.get("net_profit"), dict) else {}
    rev_dict = financials.get("revenue") if isinstance(financials.get("revenue"), dict) else {}
    op_dict = financials.get("operating_income") if isinstance(financials.get("operating_income"), dict) else {}
    top_ratios = financials.get("top_ratios") if isinstance(financials.get("top_ratios"), dict) else {}

    net_inc = float(net_inc_dict.get("latest") if isinstance(net_inc_dict, dict) and net_inc_dict.get("latest") is not None else 100.0)
    rev = max(1.0, float(rev_dict.get("latest") if isinstance(rev_dict, dict) and rev_dict.get("latest") is not None else 1000.0))
    ebit = float(op_dict.get("latest") if isinstance(op_dict, dict) and op_dict.get("latest") is not None else (rev * 0.15))

    debt_raw = bs.get("total_debt") if bs.get("total_debt") is not None else bs.get("borrowings")
    debt = max(0.0, float(debt_raw if debt_raw is not None else 100.0))
    cash_raw = bs.get("cash_and_equivalents") if bs.get("cash_and_equivalents") is not None else bs.get("investments")
    cash = max(0.0, float(cash_raw if cash_raw is not None else 50.0))

    eq_cap = float(bs.get("equity_capital") or 50.0)
    reserves = float(bs.get("reserves") or 450.0)
    equity_book = eq_cap + reserves
    equity = equity_book if equity_book > 0 else max(10.0, float(top_ratios.get("Market Cap") or 1000.0) * 0.2)

    tot_assets_raw = bs.get("total_assets")
    assets = float(tot_assets_raw) if tot_assets_raw is not None and float(tot_assets_raw) > 0 else max(10.0, equity + debt)

    cur_assets = max(cash, assets * 0.45)
    cur_liab = max(1.0, (debt * 0.4) + (assets * 0.15))

    roa_pct = (net_inc / assets) * 100.0
    roe_pct = (net_inc / equity) * 100.0
    cap_employed = max(1.0, assets - cur_liab)
    roce_pct = (ebit / cap_employed) * 100.0
    debt_to_equity = debt / equity
    interest_expense = max(1.0, debt * 0.08)
    icr = ebit / interest_expense if ebit > 0 else 0.0
    current_ratio = cur_assets / cur_liab
    asset_turnover = rev / assets
    cash_ratio = cash / cur_liab

    table = [
        {"Ratio": "Return on Assets (ROA)", "Value": f"{roa_pct:.2f}%", "Benchmark": "> 5.0% (Asset Productivity)"},
        {"Ratio": "Return on Equity (ROE)", "Value": f"{roe_pct:.2f}%", "Benchmark": "> 15.0% (Shareholder Return)"},
        {"Ratio": "Return on Capital Employed (ROCE)", "Value": f"{roce_pct:.2f}%", "Benchmark": "> 15.0% (Operating Efficiency)"},
        {"Ratio": "Debt-to-Equity (D/E)", "Value": f"{debt_to_equity:.2f}x", "Benchmark": "< 1.0x (Prudent Leverage)"},
        {"Ratio": "Interest Coverage Ratio (ICR)", "Value": f"{icr:.2f}x", "Benchmark": "> 3.0x (Safe Debt Servicing)"},
        {"Ratio": "Current Ratio", "Value": f"{current_ratio:.2f}x", "Benchmark": "> 1.33x (Working Capital Liquidity)"},
        {"Ratio": "Asset Turnover Ratio", "Value": f"{asset_turnover:.2f}x", "Benchmark": "> 0.8x (Capital Efficiency)"},
        {"Ratio": "Cash Ratio", "Value": f"{cash_ratio:.2f}x", "Benchmark": "> 0.20x (Immediate Liquidity Buffer)"},
    ]

    return KeyFinancialRatiosResult(
        roa_pct=round(roa_pct, 2),
        roe_pct=round(roe_pct, 2),
        roce_pct=round(roce_pct, 2),
        debt_to_equity=round(debt_to_equity, 2),
        interest_coverage_ratio=round(icr, 2),
        current_ratio=round(current_ratio, 2),
        asset_turnover=round(asset_turnover, 2),
        cash_ratio=round(cash_ratio, 2),
        ratios_summary_table=table,
    )


_PEER_CACHE: dict[str, dict[str, float | None]] = {}


def _yahoo_info(symbol: str) -> dict[str, Any]:
    import yfinance as yf

    try:
        return yf.Ticker(symbol).info or {}
    except Exception:
        return {}


def _positive(v: Any) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x and x > 0 and x != float("inf") else None


def peer_benchmarks(peers: list[Any], exclude: str = "") -> tuple[dict[str, float | None], int]:
    """Median trailing multiples of the company's screener.in peer group, read from Yahoo Finance.

    A median is only reported when at least three peers supply that multiple; below that it
    is not a benchmark, so the metric is left without one rather than filled with a guess.
    """
    from concurrent.futures import ThreadPoolExecutor

    symbols = []
    for p in peers or []:
        sym = p[1] if isinstance(p, (list, tuple)) and len(p) > 1 else None
        if sym and sym.upper() != exclude.upper() and sym not in symbols:
            symbols.append(sym)
    symbols = symbols[:8]

    def one(sym: str) -> dict[str, float | None]:
        if sym in _PEER_CACHE:
            return _PEER_CACHE[sym]
        info = _yahoo_info(sym)
        row = {
            "pe": _positive(info.get("trailingPE")),
            "pb": _positive(info.get("priceToBook")),
            "ev_ebitda": _positive(info.get("enterpriseToEbitda")),
            "ps": _positive(info.get("priceToSalesTrailing12Months")),
            "ev_sales": _positive(info.get("enterpriseToRevenue")),
        }
        if any(v is not None for v in row.values()):
            _PEER_CACHE[sym] = row
        return row

    if not symbols:
        return {}, 0
    with ThreadPoolExecutor(max_workers=min(8, len(symbols))) as pool:
        rows = list(pool.map(one, symbols))
    out: dict[str, float | None] = {}
    for key in ("pe", "pb", "ev_ebitda", "ps", "ev_sales"):
        vals = [r[key] for r in rows if r.get(key) is not None]
        out[key] = float(np.median(vals)) if len(vals) >= 3 else None
    return out, sum(1 for r in rows if any(v is not None for v in r.values()))


def _ttm_or_annualised(fin: dict[str, Any], key: str, latest_row: Any) -> tuple[float | None, str]:
    """Trailing-twelve-month figure; the latest quarter x4 only if four quarters are unavailable."""
    ttm = (fin.get("ttm") or {}).get(key)
    if ttm is not None:
        return float(ttm), "TTM"
    latest = latest_row.get("latest") if isinstance(latest_row, dict) else None
    if latest is not None:
        return float(latest) * 4.0, "latest quarter x4"
    return None, ""


def _fmt(v: float | None, suffix: str = "x") -> str:
    return f"{v:.2f}{suffix}" if v is not None else "n/a"


def compute_relative_valuation_multiples(
    financials: dict[str, Any],
    market_cap: float | None = None,
    current_price: float | None = None,
    shares_outstanding: float | None = None,
    total_debt: float | None = None,
    cash: float | None = None,
    ticker: str = "",
    benchmarks: dict[str, float | None] | None = None,
    n_peers: int | None = None,
    **kwargs: Any,
) -> RelativeValuationMultiplesResult:
    """Trailing multiples from reported filings, compared with the company's own peer group.

    Every input is a reported figure: earnings, sales and operating profit are the sum of the
    last four quarters, cash flow is the latest financial year, growth is the 3-year
    compounded rate. Nothing is defaulted. A multiple whose input is missing is omitted, and
    a benchmark is used only when at least three peers supply it.
    """
    fin = financials if isinstance(financials, dict) else {}
    top = fin.get("top_ratios") if isinstance(fin.get("top_ratios"), dict) else {}
    bs = fin.get("balance_sheet") if isinstance(fin.get("balance_sheet"), dict) else {}

    price = _positive(current_price) or _positive(fin.get("current_price")) or _positive(top.get("Current Price"))
    shares = _positive(shares_outstanding) or _positive(fin.get("shares_outstanding"))  # crore shares
    notes: list[str] = []
    if not price or not shares:
        return RelativeValuationMultiplesResult(
            pe_ratio=None, pb_ratio=None, price_to_revenue_per_share=None, peg_ratio=None, ev_to_ebitda=None,
            ev_to_ebit=None, price_to_cash_flow=None, ev_to_sales=None, price_to_sales=None,
            sector_name="Not assessed", overall_valuation_rating="Not assessed: price or share count unavailable",
            relative_valuation_stance="Not assessed: price or share count unavailable", composite_relative_score=None,
            peer_harmonized_target_price=None, implied_upside_vs_peers_pct=None,
        )
    mcap = price * shares  # crore rupees

    is_bank = is_financial_institution(fin, ticker)
    np_ttm, np_basis = _ttm_or_annualised(fin, "net_profit", fin.get("net_profit"))
    rev_ttm, _ = _ttm_or_annualised(fin, "revenue", fin.get("revenue"))
    op_ttm, _ = _ttm_or_annualised(fin, "operating_income", fin.get("operating_income"))
    dep_ttm, _ = _ttm_or_annualised(fin, "depreciation", fin.get("depreciation"))
    if np_basis == "latest quarter x4":
        notes.append("Earnings annualised from the latest quarter (fewer than four quarters available).")

    equity = _positive(bs.get("total_equity")) or (
        (_positive(bs.get("equity_capital")) or 0.0) + (_positive(bs.get("reserves")) or 0.0) or None
    )
    debt = total_debt if total_debt is not None else (bs.get("total_debt") if bs.get("total_debt") is not None else bs.get("borrowings"))
    debt = float(debt) if debt is not None else None

    cash_cr = cash
    if cash_cr is None and ticker:
        info = _yahoo_info(ticker)
        raw = _positive(info.get("totalCash"))
        cash_cr = raw / 1e7 if raw else None  # Yahoo reports rupees; filings are in crore
    ev = None
    if not is_bank and debt is not None:
        ev = mcap + debt - (cash_cr or 0.0)
        if cash_cr is None:
            notes.append("Cash was not available, so enterprise value is not reduced by cash.")

    eps = (np_ttm / shares) if (np_ttm and np_ttm > 0) else None
    pe = price / eps if eps else None
    pb = mcap / equity if equity else None
    p_sales = mcap / rev_ttm if (rev_ttm and rev_ttm > 0) else None
    cagr = fin.get("profit_cagr_3y_pct")
    peg = pe / cagr if (pe and cagr and cagr > 0) else None
    ev_ebitda = ev / op_ttm if (ev and op_ttm and op_ttm > 0) else None
    ebit = (op_ttm - dep_ttm) if (op_ttm is not None and dep_ttm is not None) else None
    ev_ebit = ev / ebit if (ev and ebit and ebit > 0) else None
    cfo = _positive(fin.get("cfo_annual"))
    p_cf = mcap / cfo if cfo else None
    ev_sales = ev / rev_ttm if (ev and rev_ttm and rev_ttm > 0) else None

    if benchmarks is None:
        benchmarks, n_peers = peer_benchmarks(fin.get("peers") or [], exclude=ticker)
    bm = benchmarks or {}
    sector = f"Median of {n_peers} screener.in peers" if n_peers else "No peer benchmark available"

    def var(val: float | None, key: str) -> float | None:
        b = bm.get(key)
        return ((val - b) / b) * 100.0 if (val is not None and b) else None

    def verdict(v: float | None) -> str:
        if v is None:
            return "No benchmark"
        return "Premium (+)" if v > 15.0 else ("Discount (-)" if v < -15.0 else "In-Line")

    rows_spec = [
        ("1. Price to Earnings (P/E)", pe, "pe", "Earnings capitalisation (TTM)", "x"),
        ("2. Price to Book (P/B)", pb, "pb", "Net asset backing", "x"),
        ("3. Price to Sales (P/S)", p_sales, "ps", "Market value on TTM revenue", "x"),
        ("4. PEG Ratio (P/E to 3-year profit growth)", peg, None, "Growth-adjusted earnings multiple", "x"),
        ("5. EV / EBITDA", ev_ebitda, "ev_ebitda", "Debt-neutral operating earnings (operating profit as EBITDA)", "x"),
        ("6. EV / EBIT", ev_ebit, None, "Debt-neutral profit after depreciation", "x"),
        ("7. Price to Cash Flow (P/CF)", p_cf, None, "Market value on latest-year operating cash flow", "x"),
        ("8. EV to Sales", ev_sales, "ev_sales", "Enterprise value on TTM revenue", "x"),
    ]
    table: list[dict[str, Any]] = []
    for name, val, key, role, _ in rows_spec:
        if val is None:
            continue
        b = bm.get(key) if key else None
        v = var(val, key) if key else None
        vd = verdict(v)
        table.append(
            {
                "Multiple": name,
                "ratio_name": name,
                "Value": _fmt(val),
                "company_value": val,
                "Sector Benchmark": _fmt(b) if b else "n/a",
                "sector_median": b,
                "Variance vs Sector": f"{v:+.1f}%" if v is not None else "n/a",
                "variance_pct": v,
                "Analytical Role": role,
                "interpretation": role,
                "Verdict": vd,
                "verdict_badge": vd,
            }
        )

    variances = [x for x in (var(pe, "pe"), var(pb, "pb"), var(ev_ebitda, "ev_ebitda"), var(p_sales, "ps")) if x is not None]
    if variances:
        mean_var = float(np.mean(variances))
        comp_score = float(np.clip(50.0 + mean_var * 0.4, 0.0, 100.0))
        if mean_var < -25.0:
            rel_stance, overall = "Substantially Undervalued vs Peer Group (>25% Multiple Discount)", "Substantially Undervalued (High Margin of Safety)"
        elif mean_var < -8.0:
            rel_stance, overall = "Modestly Undervalued vs Peer Group (Discounted Multiples)", "Modestly Undervalued (Attractive Entry Point)"
        elif mean_var <= 8.0:
            rel_stance, overall = "Fairly Valued (In-Line with Peer Cohort Median)", "Fair Value (In-Line with Peer Multiples)"
        elif mean_var <= 25.0:
            rel_stance, overall = "Modestly Overvalued vs Peer Group (Trading at Peer Premium)", "Modestly Overvalued (Growth Premium Priced In)"
        else:
            rel_stance, overall = "Substantially Overvalued vs Peer Group (>25% Multiple Premium)", "Substantially Overvalued (Elevated Valuation Risk)"
        notes.append(f"Average variance vs peer median across {len(variances)} multiples: {mean_var:+.1f}%.")
    else:
        comp_score = None
        rel_stance = "Not assessed: no peer benchmark available"
        overall = "Not assessed: no peer benchmark available"

    # Price implied by applying peer-median multiples to this company's own earnings
    implied: list[float] = []
    if eps and bm.get("pe"):
        implied.append(eps * bm["pe"])
    if op_ttm and op_ttm > 0 and bm.get("ev_ebitda") and debt is not None and not is_bank:
        implied.append((op_ttm * bm["ev_ebitda"] - debt + (cash_cr or 0.0)) / shares)
    peer_target = round(float(np.mean(implied)), 2) if implied else None
    upside = round((peer_target / price - 1) * 100.0, 2) if peer_target else None

    def r(v: float | None) -> float | None:
        return round(v, 2) if v is not None else None

    result = RelativeValuationMultiplesResult(
        pe_ratio=r(pe),
        pb_ratio=r(pb),
        price_to_revenue_per_share=r(p_sales),
        peg_ratio=r(peg),
        ev_to_ebitda=r(ev_ebitda),
        ev_to_ebit=r(ev_ebit),
        price_to_cash_flow=r(p_cf),
        ev_to_sales=r(ev_sales),
        price_to_sales=r(p_sales),
        sector_name=sector,
        overall_valuation_rating=overall,
        relative_valuation_stance=rel_stance,
        composite_relative_score=r(comp_score),
        peer_harmonized_target_price=peer_target,
        implied_upside_vs_peers_pct=upside,
        multiples_summary_table=table,
    )
    result.notes = notes
    return result


def reported_cash(fin: dict[str, Any], ticker: str = "") -> float:
    """Cash and equivalents in crore rupees from Yahoo Finance; 0 when it cannot be read.

    The screener.in balance sheet has no cash line (its "Investments" is not cash), so the
    reports no longer stand that in or invent a default.
    """
    sym = ticker or (fin.get("ticker") if isinstance(fin, dict) else "") or ""
    raw = _positive(_yahoo_info(sym).get("totalCash")) if sym else None
    return raw / 1e7 if raw else 0.0


def reported_nopat(fin: dict[str, Any]) -> float:
    """Trailing-twelve-month operating profit after tax (latest quarter x4 only as a fallback)."""
    op, _ = _ttm_or_annualised(fin, "operating_income", fin.get("operating_income"))
    if op is None:
        return 0.0
    tax = fin.get("tax_rate_pct")
    return op * (1.0 - (float(tax) / 100.0 if tax is not None else 0.25))


def reported_net_income(fin: dict[str, Any]) -> float:
    np_, _ = _ttm_or_annualised(fin, "net_profit", fin.get("net_profit"))
    return np_ if np_ is not None else 0.0


def run_valuation_suite(fin: dict[str, Any], price: float, beta: float, ticker: str = "") -> dict[str, Any] | None:
    """The one valuation every part of the report shares: WACC, DCF (or residual income for
    banks), scenarios, Monte Carlo, DuPont and peer-relative multiples.

    Operating profit is the trailing-twelve-month figure, taxed at the reported rate, so the
    DCF and the multiples rest on the same earnings base.
    """
    shares = _positive(fin.get("shares_outstanding"))
    if not fin or not price or not shares:
        return None
    bs = fin.get("balance_sheet") or {}
    mcap = shares * price
    debt = float(bs.get("total_debt") if bs.get("total_debt") is not None else (bs.get("borrowings") or 0.0))
    info = _yahoo_info(ticker) if ticker else {}
    raw_cash = _positive(info.get("totalCash"))
    cash = raw_cash / 1e7 if raw_cash else 0.0

    op_ttm, basis = _ttm_or_annualised(fin, "operating_income", fin.get("operating_income"))
    if op_ttm is None:
        return None
    tax = fin.get("tax_rate_pct")
    tax = float(tax) / 100.0 if tax is not None else 0.25
    base_nopat = op_ttm * (1.0 - tax)
    equity = float((bs.get("equity_capital") or 0.0) + (bs.get("reserves") or 0.0))
    if equity <= 0:
        equity = _positive(bs.get("total_equity")) or max(100.0, mcap * 0.4)
    np_ttm, _ = _ttm_or_annualised(fin, "net_profit", fin.get("net_profit"))
    net_income = np_ttm if np_ttm is not None else mcap * 0.06
    is_bank = is_financial_institution(fin, ticker)

    np.random.seed(42)  # reproducible Monte Carlo
    wacc = compute_wacc(market_cap=mcap, total_debt=debt, beta=beta, risk_free_rate=0.068)
    if is_bank:
        core = compute_residual_income_valuation(
            current_price=price, shares_outstanding=shares, book_value_equity=equity,
            latest_net_income=net_income, beta=beta, risk_free_rate=0.068,
        )
    else:
        core = compute_dcf_valuation(
            current_price=price, shares_outstanding=shares, nopat=base_nopat,
            total_debt=debt, cash=cash, wacc=wacc.wacc,
        )
    scen = compute_scenario_dcf(
        current_price=price, shares_outstanding=shares, nopat=base_nopat, total_debt=debt, cash=cash,
        base_wacc=wacc.wacc, is_bank=is_bank, book_value_equity=equity, net_income=net_income,
    )
    bayes = compute_bayesian_probabilistic_dcf(
        current_price=price, shares_outstanding=shares, nopat=base_nopat, total_debt=debt, cash=cash,
        base_wacc=wacc.wacc, num_simulations=1000, is_bank=is_bank,
        book_value_equity=equity, net_income=net_income,
    )
    multiples = compute_relative_valuation_multiples(
        financials=fin, current_price=price, shares_outstanding=shares, total_debt=debt, cash=cash or None, ticker=ticker,
    )
    return {
        "is_bank": is_bank, "base_nopat": base_nopat, "basis": basis, "market_cap": mcap,
        "wacc": wacc, "core": core, "scenario": scen, "bayesian": bayes,
        "dupont": compute_dupont_5_factor_roe(financials=fin), "multiples": multiples,
    }


def generate_valuation_suite(
    financials: dict[str, Any],
    market_cap: float | None = None,
    current_price: float | None = None,
    shares_outstanding: float | None = None,
    beta: float = 1.0,
    risk_free_rate: float = 0.068,
    ticker: str = "",
) -> dict[str, Any]:
    """Generate comprehensive Financial Valuation, WACC / Ke, Dupont ROE, Scenario/Bayesian valuation models,
    and 8-factor Relative Valuation Multiples suite.
    """
    if not isinstance(financials, dict):
        financials = {}

    top_ratios = financials.get("top_ratios") if isinstance(financials.get("top_ratios"), dict) else {}
    bs = financials.get("balance_sheet") if isinstance(financials.get("balance_sheet"), dict) else {}
    net_inc_dict = financials.get("net_profit") if isinstance(financials.get("net_profit"), dict) else {}

    # Extract or infer basic parameters
    mcap = max(100.0, float(market_cap or top_ratios.get("Market Cap") or financials.get("market_cap") or 1000.0))
    curr_p = max(1.0, float(current_price or top_ratios.get("Current Price") or financials.get("current_price") or 100.0))
    
    shares_raw = shares_outstanding or financials.get("shares_outstanding")
    shares = float(shares_raw) if shares_raw and float(shares_raw) > 0 else (mcap / curr_p if curr_p > 0 else 10.0)

    debt_raw = bs.get("total_debt") if bs.get("total_debt") is not None else bs.get("borrowings")
    debt = max(0.0, float(debt_raw) if debt_raw is not None else 100.0)

    cash_raw = bs.get("cash_and_equivalents") if bs.get("cash_and_equivalents") is not None else bs.get("investments")
    cash = max(0.0, float(cash_raw) if cash_raw is not None else 50.0)

    eq_cap = float(bs.get("equity_capital") or 50.0)
    reserves = float(bs.get("reserves") or 450.0)
    book_equity = eq_cap + reserves
    if book_equity <= 0:
        book_equity = max(100.0, mcap * 0.4)

    nopat_raw = financials.get("nopat")
    nopat = float(nopat_raw) if nopat_raw is not None and float(nopat_raw) > 0 else max(10.0, mcap * 0.05)

    net_inc_raw = net_inc_dict.get("latest") if isinstance(net_inc_dict, dict) else None
    net_inc = float(net_inc_raw) if net_inc_raw is not None else (nopat * 0.9)

    rev_dict = financials.get("revenue") if isinstance(financials.get("revenue"), dict) else {}
    rev_raw = rev_dict.get("latest") if isinstance(rev_dict, dict) else None
    revenue = max(1.0, float(rev_raw) if rev_raw is not None else (nopat * 6.0))

    # Bank vs Firm Detection
    is_bank = is_financial_institution(financials, ticker)

    # 1. Cost of Capital (WACC for Firms, Ke for Banks)
    wacc_res = compute_wacc(
        market_cap=mcap,
        total_debt=debt,
        beta=beta,
        risk_free_rate=risk_free_rate,
    )

    # 2. Intrinsic Valuation Model (FCFF for Firms, RIM for Banks)
    if is_bank:
        dcf_res = compute_residual_income_valuation(
            current_price=curr_p,
            shares_outstanding=shares,
            book_value_equity=book_equity,
            latest_net_income=net_inc,
            beta=beta,
            risk_free_rate=risk_free_rate,
        )
    else:
        dcf_res = compute_dcf_valuation(
            current_price=curr_p,
            shares_outstanding=shares,
            nopat=nopat,
            total_debt=debt,
            cash=cash,
            wacc=wacc_res.wacc,
        )

    # 3. Dupont 5-Factor ROE
    dupont_res = compute_dupont_5_factor_roe(financials)

    # 4. 3-Case Scenario schedule
    scenario_res = compute_scenario_dcf(
        current_price=curr_p,
        shares_outstanding=shares,
        nopat=nopat,
        total_debt=debt,
        cash=cash,
        base_wacc=wacc_res.wacc,
        is_bank=is_bank,
        book_value_equity=book_equity,
        net_income=net_inc,
    )

    # 5. Bayesian Probabilistic Simulation
    bayesian_res = compute_bayesian_probabilistic_dcf(
        current_price=curr_p,
        shares_outstanding=shares,
        nopat=nopat,
        total_debt=debt,
        cash=cash,
        base_wacc=wacc_res.wacc,
        base_revenue=revenue,
        is_bank=is_bank,
        book_value_equity=book_equity,
        net_income=net_inc,
    )

    # 6. Key Financial Ratios
    ratios_res = compute_key_financial_ratios(financials)

    # 7. 8-Factor Relative Valuation Multiples
    rel_multiples = compute_relative_valuation_multiples(
        financials=financials,
        market_cap=mcap,
        current_price=curr_p,
        shares_outstanding=shares,
        ticker=ticker,
    )

    return {
        "is_bank": is_bank,
        "methodology": dcf_res.methodology,
        "academic_disclosure": getattr(dcf_res, "academic_disclosure", ""),
        "wacc": wacc_res.to_dict(),
        "dcf": dcf_res.to_dict(),
        "dupont": dupont_res.to_dict(),
        "scenario_dcf": asdict(scenario_res),
        "bayesian_dcf": asdict(bayesian_res),
        "key_ratios": asdict(ratios_res),
        "relative_multiples": rel_multiples.to_dict(),
    }
