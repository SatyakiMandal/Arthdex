"""
Valuation Lab Service: Interactive 2-Stage & 3-Stage DCF, Dynamic Indian CAPM WACC,
Reverse DCF Implied Growth Solver, and 5x5 Sensitivity Matrix.

Adheres strictly to SEBI compliance standards and zero-dependency math.
Provenance tags:
  '[ACTUAL FILING]'         - Reported financial statements, market quotes, shares.
  '[MODELLED / ALGORITHMIC]' - CAPM WACC, Gordon Growth TV, DCF Fair Value, Implied CAGR.
  '[CONSENSUS ESTIMATE]'    - Forward analyst growth projections, consensus targets.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

# --- Indian Market Benchmark Defaults ---
# Model assumptions, each editable by the reader and labelled as an assumption wherever shown.
# The risk-free rate is not one of them: it is read from the RBI's benchmark 10-year G-sec.
DEFAULT_RISK_FREE_RATE = 0.0  # placeholder for signatures only; callers pass the RBI rate
DEFAULT_EQUITY_RISK_PREMIUM = 0.0600  # assumption: Indian equity risk premium
DEFAULT_CORPORATE_TAX_RATE = 0.2517  # statutory: 25.17% under Section 115BAA
DEFAULT_PRETAX_COST_OF_DEBT = 0.0850  # assumption: pre-tax corporate borrowing cost
DEFAULT_TERMINAL_GROWTH_RATE = 0.0500  # assumption: long-run nominal growth

# --- Data Provenance Constants ---
TAG_ACTUAL = "[FROM SOURCE]"
TAG_MODELLED = "[MODEL OUTPUT]"
TAG_CONSENSUS = "[ASSUMPTION, EDITABLE]"


def unlever_beta(levered_beta: float, debt_to_equity: float, tax_rate: float = DEFAULT_CORPORATE_TAX_RATE) -> float:
    """
    Unlever beta using Hamada's equation:
    Beta_unlevered = Beta_levered / [1 + (1 - Tax_Rate) * (Debt / Equity)]
    """
    if debt_to_equity < 0:
        debt_to_equity = 0.0
    divisor = 1.0 + (1.0 - tax_rate) * debt_to_equity
    return round(levered_beta / divisor, 4)


def lever_beta(unlevered_beta: float, debt_to_equity: float, tax_rate: float = DEFAULT_CORPORATE_TAX_RATE) -> float:
    """
    Relever beta using Hamada's equation:
    Beta_levered = Beta_unlevered * [1 + (1 - Tax_Rate) * (Debt / Equity)]
    """
    if debt_to_equity < 0:
        debt_to_equity = 0.0
    multiplier = 1.0 + (1.0 - tax_rate) * debt_to_equity
    return round(unlevered_beta * multiplier, 4)


@dataclass
class CAPMInputs:
    risk_free_rate: float = DEFAULT_RISK_FREE_RATE
    equity_risk_premium: float = DEFAULT_EQUITY_RISK_PREMIUM
    beta: float = 1.0
    is_beta_unlevered: bool = False
    debt_to_equity: float = 0.20
    pretax_cost_of_debt: float = DEFAULT_PRETAX_COST_OF_DEBT
    tax_rate: float = DEFAULT_CORPORATE_TAX_RATE
    equity_weight: float | None = None
    debt_weight: float | None = None


@dataclass
class WACCBreakdown:
    risk_free_rate: float
    equity_risk_premium: float
    levered_beta: float
    unlevered_beta: float
    cost_of_equity: float
    pretax_cost_of_debt: float
    tax_rate: float
    post_tax_cost_of_debt: float
    equity_weight: float
    debt_weight: float
    wacc: float
    provenance: dict[str, str] = field(default_factory=lambda: {
        "risk_free_rate": TAG_ACTUAL,
        "tax_rate": TAG_ACTUAL,
        "levered_beta": TAG_MODELLED,
        "cost_of_equity": TAG_MODELLED,
        "post_tax_cost_of_debt": TAG_MODELLED,
        "wacc": TAG_MODELLED,
    })

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def calculate_wacc(
    risk_free_rate: float = DEFAULT_RISK_FREE_RATE,
    equity_risk_premium: float = DEFAULT_EQUITY_RISK_PREMIUM,
    beta: float = 1.0,
    is_beta_unlevered: bool = False,
    debt_to_equity: float = 0.20,
    pretax_cost_of_debt: float = DEFAULT_PRETAX_COST_OF_DEBT,
    tax_rate: float = DEFAULT_CORPORATE_TAX_RATE,
    equity_weight: float | None = None,
    debt_weight: float | None = None,
    market_cap_cr: float | None = None,
    total_debt_cr: float | None = None,
) -> WACCBreakdown:
    """
    Computes dynamic CAPM WACC tailored to the Indian Capital Markets:
    Ke = Rf + Beta * ERP
    Kd_post_tax = Kd_pre_tax * (1 - t)
    WACC = (E / (E + D)) * Ke + (D / (E + D)) * Kd_post_tax
    """
    if is_beta_unlevered:
        lev_beta = lever_beta(beta, debt_to_equity, tax_rate)
        unlev_beta = beta
    else:
        lev_beta = beta
        unlev_beta = unlever_beta(beta, debt_to_equity, tax_rate)

    cost_of_equity = risk_free_rate + lev_beta * equity_risk_premium
    post_tax_cost_of_debt = pretax_cost_of_debt * (1.0 - tax_rate)

    # Determine capital structure weights
    if equity_weight is not None and debt_weight is not None:
        total_w = equity_weight + debt_weight
        we = equity_weight / total_w if total_w > 0 else 1.0
        wd = debt_weight / total_w if total_w > 0 else 0.0
    elif market_cap_cr is not None and total_debt_cr is not None:
        total_val = market_cap_cr + total_debt_cr
        we = market_cap_cr / total_val if total_val > 0 else 1.0
        wd = total_debt_cr / total_val if total_val > 0 else 0.0
    elif debt_to_equity is not None and debt_to_equity >= 0:
        # D/E = de -> E = 1, D = de -> E / (E + D) = 1 / (1 + de)
        we = 1.0 / (1.0 + debt_to_equity)
        wd = debt_to_equity / (1.0 + debt_to_equity)
    else:
        we = 0.80
        wd = 0.20

    wacc = we * cost_of_equity + wd * post_tax_cost_of_debt

    return WACCBreakdown(
        risk_free_rate=round(risk_free_rate, 4),
        equity_risk_premium=round(equity_risk_premium, 4),
        levered_beta=round(lev_beta, 3),
        unlevered_beta=round(unlev_beta, 3),
        cost_of_equity=round(cost_of_equity, 4),
        pretax_cost_of_debt=round(pretax_cost_of_debt, 4),
        tax_rate=round(tax_rate, 4),
        post_tax_cost_of_debt=round(post_tax_cost_of_debt, 4),
        equity_weight=round(we, 4),
        debt_weight=round(wd, 4),
        wacc=round(wacc, 4),
    )


@dataclass
class FCFProjection:
    year: int
    growth_rate: float
    fcff_cr: float
    discount_factor: float
    present_value_cr: float
    stage: str
    provenance: str = TAG_MODELLED

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DCFResult:
    symbol: str
    model_type: Literal["2-stage", "3-stage"]
    current_price: float
    fair_value_per_share: float
    upside_downside_pct: float
    enterprise_value_cr: float
    equity_value_cr: float
    pv_explicit_cash_flows_cr: float
    terminal_value_cr: float
    pv_terminal_value_cr: float
    shares_outstanding_cr: float
    cash_and_equivalents_cr: float
    total_debt_cr: float
    base_fcff_cr: float
    stage1_growth_rate: float
    stage1_years: int
    stage2_years: int
    terminal_growth_rate: float
    wacc: float
    wacc_breakdown: dict[str, Any]
    projections: list[dict[str, Any]]
    provenance: dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def calculate_dcf(
    symbol: str,
    current_price: float,
    shares_outstanding_cr: float,
    cash_and_equivalents_cr: float,
    total_debt_cr: float,
    base_fcff_cr: float,
    stage1_growth_rate: float = 0.12,
    stage1_years: int = 5,
    terminal_growth_rate: float = DEFAULT_TERMINAL_GROWTH_RATE,
    wacc: float | None = None,
    wacc_inputs: CAPMInputs | None = None,
    model_type: Literal["2-stage", "3-stage"] = "2-stage",
    stage2_years: int = 5,
) -> DCFResult:
    """
    Computes 2-Stage or 3-Stage FCFF discounted cash flow valuation model.
    In 3-stage:
      - Stage 1: Explicit high-growth period (e.g. Years 1-5 @ stage1_growth_rate)
      - Stage 2: Linear fade transition period (e.g. Years 6-10 fading from stage1_growth_rate to terminal_growth_rate)
      - Stage 3: Stable terminal growth from year 11+
    """
    if shares_outstanding_cr <= 0:
        raise ValueError("Shares outstanding must be greater than zero")

    # WACC resolution
    if wacc_inputs is not None:
        wacc_breakdown = calculate_wacc(
            risk_free_rate=wacc_inputs.risk_free_rate,
            equity_risk_premium=wacc_inputs.equity_risk_premium,
            beta=wacc_inputs.beta,
            is_beta_unlevered=wacc_inputs.is_beta_unlevered,
            debt_to_equity=wacc_inputs.debt_to_equity,
            pretax_cost_of_debt=wacc_inputs.pretax_cost_of_debt,
            tax_rate=wacc_inputs.tax_rate,
            equity_weight=wacc_inputs.equity_weight,
            debt_weight=wacc_inputs.debt_weight,
        )
        resolved_wacc = wacc_breakdown.wacc
    elif wacc is not None:
        resolved_wacc = wacc
        wacc_breakdown = calculate_wacc()
        wacc_breakdown.wacc = wacc
    else:
        wacc_breakdown = calculate_wacc()
        resolved_wacc = wacc_breakdown.wacc

    if resolved_wacc <= terminal_growth_rate:
        raise ValueError(
            f"WACC ({resolved_wacc * 100:.2f}%) must be strictly greater than terminal growth rate ({terminal_growth_rate * 100:.2f}%) "
            f"under the Gordon Growth Model."
        )

    projections: list[FCFProjection] = []
    pv_explicit = 0.0
    current_fcf = base_fcff_cr

    # Stage 1: Explicit projection
    for year in range(1, stage1_years + 1):
        current_fcf = current_fcf * (1.0 + stage1_growth_rate)
        df = 1.0 / ((1.0 + resolved_wacc) ** year)
        pv = current_fcf * df
        pv_explicit += pv
        projections.append(
            FCFProjection(
                year=year,
                growth_rate=round(stage1_growth_rate, 4),
                fcff_cr=round(current_fcf, 2),
                discount_factor=round(df, 4),
                present_value_cr=round(pv, 2),
                stage="Stage 1 (Explicit High Growth)",
            )
        )

    total_explicit_years = stage1_years

    # Stage 2 (for 3-stage model): Fade transition period
    if model_type == "3-stage" and stage2_years > 0:
        fade_step = (stage1_growth_rate - terminal_growth_rate) / (stage2_years + 1)
        for i in range(1, stage2_years + 1):
            year = stage1_years + i
            g_fade = stage1_growth_rate - (fade_step * i)
            current_fcf = current_fcf * (1.0 + g_fade)
            df = 1.0 / ((1.0 + resolved_wacc) ** year)
            pv = current_fcf * df
            pv_explicit += pv
            projections.append(
                FCFProjection(
                    year=year,
                    growth_rate=round(g_fade, 4),
                    fcff_cr=round(current_fcf, 2),
                    discount_factor=round(df, 4),
                    present_value_cr=round(pv, 2),
                    stage="Stage 2 (Transition Fade)",
                )
            )
        total_explicit_years += stage2_years

    # Terminal Value using Gordon Growth formula on last year's FCFF
    terminal_fcf = current_fcf * (1.0 + terminal_growth_rate)
    terminal_value = terminal_fcf / (resolved_wacc - terminal_growth_rate)
    pv_terminal_value = terminal_value / ((1.0 + resolved_wacc) ** total_explicit_years)

    enterprise_value = pv_explicit + pv_terminal_value
    equity_value = enterprise_value + cash_and_equivalents_cr - total_debt_cr
    fair_value = equity_value / shares_outstanding_cr

    upside_pct = ((fair_value - current_price) / current_price * 100.0) if current_price > 0 else 0.0

    provenance_map = {
        "current_price": TAG_ACTUAL,
        "shares_outstanding_cr": TAG_ACTUAL,
        "cash_and_equivalents_cr": TAG_ACTUAL,
        "total_debt_cr": TAG_ACTUAL,
        "base_fcff_cr": TAG_ACTUAL,
        "stage1_growth_rate": TAG_CONSENSUS,
        "terminal_growth_rate": TAG_MODELLED,
        "wacc": TAG_MODELLED,
        "enterprise_value_cr": TAG_MODELLED,
        "equity_value_cr": TAG_MODELLED,
        "fair_value_per_share": TAG_MODELLED,
    }

    return DCFResult(
        symbol=symbol.upper(),
        model_type=model_type,
        current_price=round(current_price, 2),
        fair_value_per_share=round(fair_value, 2),
        upside_downside_pct=round(upside_pct, 2),
        enterprise_value_cr=round(enterprise_value, 2),
        equity_value_cr=round(equity_value, 2),
        pv_explicit_cash_flows_cr=round(pv_explicit, 2),
        terminal_value_cr=round(terminal_value, 2),
        pv_terminal_value_cr=round(pv_terminal_value, 2),
        shares_outstanding_cr=round(shares_outstanding_cr, 3),
        cash_and_equivalents_cr=round(cash_and_equivalents_cr, 2),
        total_debt_cr=round(total_debt_cr, 2),
        base_fcff_cr=round(base_fcff_cr, 2),
        stage1_growth_rate=round(stage1_growth_rate, 4),
        stage1_years=stage1_years,
        stage2_years=stage2_years if model_type == "3-stage" else 0,
        terminal_growth_rate=round(terminal_growth_rate, 4),
        wacc=round(resolved_wacc, 4),
        wacc_breakdown=wacc_breakdown.to_dict(),
        projections=[p.to_dict() for p in projections],
        provenance=provenance_map,
    )


@dataclass
class ReverseDCFResult:
    symbol: str
    current_price: float
    target_enterprise_value_cr: float
    target_equity_value_cr: float
    implied_5y_fcf_cagr_pct: float
    base_fcff_cr: float
    wacc_pct: float
    terminal_growth_rate_pct: float
    valuation_classification: str
    assessment: str
    projected_fcf_at_implied_rate: list[dict[str, Any]]
    provenance: dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _dcf_ev_given_growth(
    base_fcff: float,
    g: float,
    wacc: float,
    terminal_g: float,
    n_years: int = 5,
) -> float:
    """Internal helper to calculate Enterprise Value given a single growth rate g."""
    current_fcf = base_fcff
    pv_explicit = 0.0
    for t in range(1, n_years + 1):
        current_fcf *= (1.0 + g)
        pv_explicit += current_fcf / ((1.0 + wacc) ** t)
    term_fcf = current_fcf * (1.0 + terminal_g)
    tv = term_fcf / (wacc - terminal_g)
    pv_tv = tv / ((1.0 + wacc) ** n_years)
    return pv_explicit + pv_tv


def solve_reverse_dcf(
    symbol: str,
    current_price: float,
    shares_outstanding_cr: float,
    cash_and_equivalents_cr: float,
    total_debt_cr: float,
    base_fcff_cr: float,
    wacc: float = 0.115,
    terminal_growth_rate: float = DEFAULT_TERMINAL_GROWTH_RATE,
    projection_years: int = 5,
) -> ReverseDCFResult:
    """
    Reverse DCF Model:
    Solves for the exact 5-year Free Cash Flow CAGR implied by the current market price.
    Uses monotonic bisection search with high precision.
    """
    if shares_outstanding_cr <= 0:
        raise ValueError("Shares outstanding must be positive")
    if base_fcff_cr <= 0:
        raise ValueError("Base FCFF must be positive to perform Reverse DCF calculation")
    if wacc <= terminal_growth_rate:
        raise ValueError("WACC must be strictly greater than terminal growth rate")

    target_equity_value = current_price * shares_outstanding_cr
    target_ev = target_equity_value + total_debt_cr - cash_and_equivalents_cr

    if target_ev <= 0:
        target_ev = 1.0  # Prevent negative enterprise value crash

    # Bisection search bounds
    low_g = -0.50  # -50% CAGR
    high_g = 2.00  # +200% CAGR

    # Expand high_g if current EV is astronomical
    while _dcf_ev_given_growth(base_fcff_cr, high_g, wacc, terminal_growth_rate, projection_years) < target_ev and high_g < 10.0:
        high_g *= 2.0

    # Expand low_g if EV is heavily depressed
    while _dcf_ev_given_growth(base_fcff_cr, low_g, wacc, terminal_growth_rate, projection_years) > target_ev and low_g > -0.95:
        low_g = -0.5 - (1.0 + low_g) / 2.0

    # Bisection search
    for _ in range(80):
        mid_g = (low_g + high_g) / 2.0
        ev_mid = _dcf_ev_given_growth(base_fcff_cr, mid_g, wacc, terminal_growth_rate, projection_years)
        diff = ev_mid - target_ev

        if abs(diff) < 0.01 or (high_g - low_g) < 1e-6:
            break
        if diff < 0:
            low_g = mid_g
        else:
            high_g = mid_g

    implied_cagr = mid_g
    implied_pct = round(implied_cagr * 100.0, 2)

    # Classify the implied growth rate against Indian corporate growth norms
    if implied_pct >= 25.0:
        classification = "Priced for Perfection (Extreme Growth Expectations)"
        assessment = (
            f"Market is pricing in aggressive {implied_pct}% FCF CAGR for 5 years. "
            "Minimal margin of safety; highly vulnerable to earnings disappointments or CapEx spikes."
        )
    elif implied_pct >= 16.0:
        classification = "High Growth Priced In (Premium Multiple)"
        assessment = (
            f"Market expects strong execution ({implied_pct}% CAGR), reflecting high return on capital (ROCE) "
            "and market share gains in the Indian economic expansion."
        )
    elif implied_pct >= 8.0:
        classification = "Fair / Sustainable Expectations (Moderate Growth)"
        assessment = (
            f"Market expects modest {implied_pct}% FCF CAGR, roughly in line with nominal Indian GDP growth (10-12%). "
            "Reasonable margin of safety for patient capital."
        )
    elif implied_pct >= 0.0:
        classification = "Low Growth / Undervalued Territory"
        assessment = (
            f"Market expects sluggish {implied_pct}% FCF CAGR. If company delivers above this low hurdle, "
            "strong upside re-rating potential exists."
        )
    else:
        classification = "Distressed / Negative Growth Priced In"
        assessment = (
            f"Market is pricing in cash flow contraction ({implied_pct}% CAGR). "
            "Typical of cyclical troughs, governance overhang, or deep capital expenditure cycles."
        )

    # Build 5-year implied trajectory
    cf = base_fcff_cr
    projections = []
    for y in range(1, projection_years + 1):
        cf *= (1.0 + implied_cagr)
        projections.append({
            "year": y,
            "projected_fcff_cr": round(cf, 2),
            "implied_growth_rate_pct": implied_pct,
        })

    return ReverseDCFResult(
        symbol=symbol.upper(),
        current_price=round(current_price, 2),
        target_enterprise_value_cr=round(target_ev, 2),
        target_equity_value_cr=round(target_equity_value, 2),
        implied_5y_fcf_cagr_pct=implied_pct,
        base_fcff_cr=round(base_fcff_cr, 2),
        wacc_pct=round(wacc * 100.0, 2),
        terminal_growth_rate_pct=round(terminal_growth_rate * 100.0, 2),
        valuation_classification=classification,
        assessment=assessment,
        projected_fcf_at_implied_rate=projections,
        provenance={
            "current_price": TAG_ACTUAL,
            "shares_outstanding_cr": TAG_ACTUAL,
            "base_fcff_cr": TAG_ACTUAL,
            "target_enterprise_value_cr": TAG_MODELLED,
            "implied_5y_fcf_cagr_pct": TAG_MODELLED,
            "valuation_classification": TAG_MODELLED,
        },
    )


def compute_sensitivity_matrix(
    symbol: str,
    current_price: float,
    shares_outstanding_cr: float,
    cash_and_equivalents_cr: float,
    total_debt_cr: float,
    base_fcff_cr: float,
    stage1_growth_rate: float = 0.12,
    base_wacc: float = 0.115,
    base_terminal_growth: float = DEFAULT_TERMINAL_GROWTH_RATE,
    stage1_years: int = 5,
    wacc_steps: list[float] | None = None,
    growth_steps: list[float] | None = None,
) -> dict[str, Any]:
    """
    Generates a 5x5 Sensitivity Matrix of Fair Value per share and Upside/Downside %
    under varying WACC and Terminal Growth Rates (g).
    """
    if wacc_steps is None:
        # 5 steps centered at base_wacc: -1.0%, -0.5%, base, +0.5%, +1.0%
        wacc_steps = [
            round(base_wacc - 0.010, 4),
            round(base_wacc - 0.005, 4),
            round(base_wacc, 4),
            round(base_wacc + 0.005, 4),
            round(base_wacc + 0.010, 4),
        ]
    if growth_steps is None:
        # 5 steps centered at base_terminal_growth: -1.0%, -0.5%, base, +0.5%, +1.0%
        growth_steps = [
            round(base_terminal_growth - 0.010, 4),
            round(base_terminal_growth - 0.005, 4),
            round(base_terminal_growth, 4),
            round(base_terminal_growth + 0.005, 4),
            round(base_terminal_growth + 0.010, 4),
        ]

    matrix_rows: list[dict[str, Any]] = []

    for w in wacc_steps:
        row_cells = []
        for g in growth_steps:
            if w <= g:
                row_cells.append({
                    "wacc_pct": round(w * 100.0, 2),
                    "terminal_growth_pct": round(g * 100.0, 2),
                    "fair_value": None,
                    "upside_downside_pct": None,
                    "is_valid": False,
                    "note": "WACC <= g invalid for Gordon Growth",
                })
                continue

            try:
                dcf = calculate_dcf(
                    symbol=symbol,
                    current_price=current_price,
                    shares_outstanding_cr=shares_outstanding_cr,
                    cash_and_equivalents_cr=cash_and_equivalents_cr,
                    total_debt_cr=total_debt_cr,
                    base_fcff_cr=base_fcff_cr,
                    stage1_growth_rate=stage1_growth_rate,
                    stage1_years=stage1_years,
                    terminal_growth_rate=g,
                    wacc=w,
                    model_type="2-stage",
                )
                row_cells.append({
                    "wacc_pct": round(w * 100.0, 2),
                    "terminal_growth_pct": round(g * 100.0, 2),
                    "fair_value": round(dcf.fair_value_per_share, 2),
                    "upside_downside_pct": round(dcf.upside_downside_pct, 2),
                    "is_valid": True,
                    "is_base_case": (round(w, 4) == round(base_wacc, 4) and round(g, 4) == round(base_terminal_growth, 4)),
                })
            except Exception:
                row_cells.append({
                    "wacc_pct": round(w * 100.0, 2),
                    "terminal_growth_pct": round(g * 100.0, 2),
                    "fair_value": None,
                    "upside_downside_pct": None,
                    "is_valid": False,
                })

        matrix_rows.append({
            "wacc_pct": round(w * 100.0, 2),
            "columns": row_cells,
        })

    return {
        "symbol": symbol.upper(),
        "current_price": round(current_price, 2),
        "base_wacc_pct": round(base_wacc * 100.0, 2),
        "base_terminal_growth_pct": round(base_terminal_growth * 100.0, 2),
        "stage1_growth_rate_pct": round(stage1_growth_rate * 100.0, 2),
        "wacc_headers_pct": [round(w * 100.0, 2) for w in wacc_steps],
        "growth_headers_pct": [round(g * 100.0, 2) for g in growth_steps],
        "rows": matrix_rows,
        "provenance": TAG_MODELLED,
    }


# --- Curated Indian Benchmark Defaults for Marquee Symbols ---
def get_company_dcf_defaults(symbol: str) -> dict[str, Any]:
    """
    DCF inputs for a company from Arthdex's real data, with the assumptions marked.

    From source: price and shares (exchange quote, Yahoo share count), cash, debt, free
    cash flow and beta (Yahoo Finance statistics), the risk-free rate (the RBI's benchmark
    G-sec nearest ten years). Stage-one growth defaults to the company's own revenue
    growth over its last three reported years. The equity premium, cost of debt and
    terminal growth are assumptions. A company without positive free cash flow, or with
    no share count, has no DCF: that is an error, not a default.
    """
    from ..routers import company
    from . import fixed_income

    sym = symbol.upper()
    quote = company.get_quote(sym, "NSE")["data"]
    stats = company.get_statistics(sym)["data"]
    hi, tr = stats.get("highlights") or {}, stats.get("trading") or {}
    price = quote.get("cmp")
    shares = tr.get("sharesOutstanding")
    shares_cr = shares / 1e7 if shares else (quote["marketCapCr"] / price if quote.get("marketCapCr") and price else None)
    fcf = hi.get("freeCashflow")
    if not price or not shares_cr:
        raise ValueError(f"No price or share count for {sym}, so no DCF can be built")
    if fcf is None or fcf <= 0:
        raise ValueError(f"{sym} has no positive free cash flow on record, so a cash-flow valuation does not apply")

    # Yahoo's beta for Indian listings is measured against a US index (Reliance 0.18), so
    # the beta here is the company's own, regressed on the Nifty 50 over three years
    from ..routers import quant

    nifty = next((r for r in quant.get_sensitivity(sym, "NSE")["data"].get("rows") or [] if r.get("benchmarkId") == "nifty-50"), None)
    beta = (nifty or {}).get("beta")
    if beta is None:
        raise ValueError(f"No three-year beta against the Nifty 50 could be computed for {sym}")

    curve = fixed_income.get_sovereign_yield_curve()
    rf = (curve.get("benchmark") or {}).get("yieldPct")
    if rf is None:
        raise ValueError("The RBI benchmark yield is unavailable, so no risk-free rate can be set")

    growth = None
    try:
        annual = [r for r in company.get_financials(sym, "NSE")["data"].get("annual") or [] if r.get("revenue")]
        if len(annual) >= 4 and annual[-4]["revenue"] > 0:
            growth = round((annual[-1]["revenue"] / annual[-4]["revenue"]) ** (1 / 3) - 1, 4)
    except Exception:
        growth = None
    if growth is None:
        raise ValueError(f"{sym} has fewer than four years of reported revenue, so no growth default can be set; enter one")

    debt, cash = hi.get("debt"), hi.get("cash")
    equity_value = price * shares_cr
    return {
        "symbol": sym,
        "name": (stats.get("about") or {}).get("name") or quote.get("name") or sym,
        "current_price": price,
        "shares_outstanding_cr": round(shares_cr, 4),
        "cash_and_equivalents_cr": cash or 0.0,
        "total_debt_cr": debt or 0.0,
        "base_fcff_cr": fcf,
        "beta": beta,
        "debt_to_equity": round((debt or 0.0) / equity_value, 4) if equity_value else 0.0,
        "risk_free_rate": round(rf / 100, 6),
        "risk_free_paper": curve["benchmark"]["paper"],
        "stage1_growth_rate": growth,
        "terminal_growth_rate": DEFAULT_TERMINAL_GROWTH_RATE,
        "pretax_cost_of_debt": DEFAULT_PRETAX_COST_OF_DEBT,
        "equity_risk_premium": DEFAULT_EQUITY_RISK_PREMIUM,
        "sources": {
            "current_price": f"{quote.get('exchange')} quote",
            "shares_outstanding_cr": "Yahoo Finance share count",
            "cash_and_equivalents_cr": "Yahoo Finance statistics" if cash is not None else "not reported; taken as zero",
            "total_debt_cr": "Yahoo Finance statistics" if debt is not None else "not reported; taken as zero",
            "base_fcff_cr": "Yahoo Finance free cash flow, trailing twelve months",
            "beta": f"regression on the Nifty 50 over {(nifty or {}).get('observationWindowDays')} trading days (R² {(nifty or {}).get('rSquared')})",
            "risk_free_rate": f"RBI, {curve['benchmark']['paper']} as on {curve['asOf']}",
            "stage1_growth_rate": "the company's revenue growth over its last three reported years (editable)",
            "terminal_growth_rate": "assumption (editable)",
            "pretax_cost_of_debt": "assumption (editable)",
            "equity_risk_premium": "assumption (editable)",
        },
    }
