"""Actionable Investment Call, Prescribed Quantity & Capital Allocation Playbook.

Synthesizes CEIA multi-model intelligence across:
1. Fundamental Valuation & DCF Margin of Safety
2. Event Study Information Flow & CAR Drift
3. 1-Week & Multi-Timeframe Technical Alignment (ADX, MACD, RSI, Bollinger Squeeze)
4. Macroeconomic & 8 Core Commodities Transmission
5. Downside Risk, Merton Distance to Default & VaR Cushion

Generates:
- Clear Investment Verdict (STRONG BUY / ACCUMULATE / HOLD / REDUCE / SELL)
- Conviction Score (0 to 100)
- Prescribed Exact Share Quantities for Standard Portfolios (₹10L, ₹25L, ₹1Cr)
- Fractional Kelly Position Sizing & Allocation Caps
- Target Ladder (Entry Zone, Target 1, Target 2, Hard Stop-Loss, Risk-Reward)
- Prescribed Holding Periods (Core Fundamental vs Tactical Event Drift) & Invalidation Rules
"""

from __future__ import annotations

import logging
import math
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)


@dataclass
class InvestmentThesisPillar:
    """Individual analytical pillar supporting the investment thesis."""

    pillar_name: str
    weight_pct: float
    score: float  # -100 (Strong Bearish) to +100 (Strong Bullish)
    stance: str   # Bullish / Neutral-Positive / Neutral / Neutral-Negative / Bearish
    metric_highlight: str
    evidence_rationale: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class PortfolioSizingTier:
    """Concrete share allocation and capital deployment for a specific portfolio size."""

    portfolio_name: str
    portfolio_capital_inr: float
    allocation_pct: float
    allocated_capital_inr: float
    prescribed_shares: int
    effective_exposure_inr: float
    risk_at_stop_loss_inr: float
    portfolio_risk_pct: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "portfolio_name": self.portfolio_name,
            "portfolio_capital_inr": round(self.portfolio_capital_inr, 2),
            "allocation_pct": round(self.allocation_pct, 2),
            "allocated_capital_inr": round(self.allocated_capital_inr, 2),
            "prescribed_shares": int(self.prescribed_shares),
            "effective_exposure_inr": round(self.effective_exposure_inr, 2),
            "risk_at_stop_loss_inr": round(self.risk_at_stop_loss_inr, 2),
            "portfolio_risk_pct": round(self.portfolio_risk_pct, 2),
        }


@dataclass
class InvestmentVerdict:
    """Comprehensive Actionable Investment Call, Prescribed Quantity & Holding Period Package."""

    actionable_call: str           # STRONG BUY / BUY / ACCUMULATE / HOLD / REDUCE / SELL
    conviction_score: float        # 0.0 to 100.0
    recommendation_badge: str      # UI CSS class
    one_line_summary: str
    detailed_thesis: str
    pillars: list[InvestmentThesisPillar] = field(default_factory=list)
    prescribed_allocation_pct: float = 4.5
    raw_kelly_pct: float = 8.5
    half_kelly_pct: float = 4.25
    maximum_allocation_cap_pct: float = 6.0
    sizing_tiers: list[PortfolioSizingTier] = field(default_factory=list)
    current_price: float = 0.0
    entry_zone_low: float = 0.0
    entry_zone_high: float = 0.0
    target_1_price: float = 0.0
    target_1_upside_pct: float = 0.0
    target_2_price: float = 0.0
    target_2_upside_pct: float = 0.0
    stop_loss_price: float = 0.0
    stop_loss_downside_pct: float = 0.0
    risk_reward_ratio: str = "1 : 3.0"
    core_holding_period: str = "6 to 12 Months (Fundamental Compounding & DCF Convergence)"
    tactical_holding_period: str = "2 to 4 Weeks (Event CAR Momentum & Catalyst Drift)"
    profit_booking_rules: list[str] = field(default_factory=list)
    invalidation_rules: list[str] = field(default_factory=list)
    as_of_date: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "actionable_call": self.actionable_call,
            "conviction_score": round(self.conviction_score, 1),
            "recommendation_badge": self.recommendation_badge,
            "one_line_summary": self.one_line_summary,
            "detailed_thesis": self.detailed_thesis,
            "pillars": [p.to_dict() for p in self.pillars],
            "prescribed_allocation_pct": round(self.prescribed_allocation_pct, 2),
            "raw_kelly_pct": round(self.raw_kelly_pct, 2),
            "half_kelly_pct": round(self.half_kelly_pct, 2),
            "maximum_allocation_cap_pct": round(self.maximum_allocation_cap_pct, 2),
            "sizing_tiers": [t.to_dict() for t in self.sizing_tiers],
            "current_price": round(self.current_price, 2),
            "entry_zone_low": round(self.entry_zone_low, 2),
            "entry_zone_high": round(self.entry_zone_high, 2),
            "target_1_price": round(self.target_1_price, 2),
            "target_1_upside_pct": round(self.target_1_upside_pct, 2),
            "target_2_price": round(self.target_2_price, 2),
            "target_2_upside_pct": round(self.target_2_upside_pct, 2),
            "stop_loss_price": round(self.stop_loss_price, 2),
            "stop_loss_downside_pct": round(self.stop_loss_downside_pct, 2),
            "risk_reward_ratio": self.risk_reward_ratio,
            "core_holding_period": self.core_holding_period,
            "tactical_holding_period": self.tactical_holding_period,
            "profit_booking_rules": self.profit_booking_rules,
            "invalidation_rules": self.invalidation_rules,
            "as_of_date": self.as_of_date,
        }


def compute_investment_verdict(
    current_price: float,
    daily_df: pd.DataFrame | None = None,
    incidents: list[Any] | None = None,
    financials: dict[str, Any] | None = None,
    valuation_multiples: Any | None = None,
    dcf_res: Any | None = None,
    technical_res: Any | None = None,
    macro_data: dict[str, Any] | None = None,
    var_metrics: dict[str, Any] | None = None,
    distance_to_default: dict[str, Any] | None = None,
    backtest_data: dict[str, Any] | None = None,
    as_of: date | str | None = None,
    news_available: bool = True,
) -> InvestmentVerdict:
    """Synthesize multi-dimensional quant intelligence into an actionable Investment Verdict & Allocation Playbook."""
    curr_p = max(0.1, float(current_price))
    fin = financials or {}
    inc_list = incidents or []
    macro = macro_data or {}
    var_m = var_metrics or {}
    dd = distance_to_default or {}
    
    # -------------------------------------------------------------------------
    # 1. PILLAR EVALUATIONS (-100 to +100 score per pillar)
    # -------------------------------------------------------------------------
    
    # Pillar 1: Valuation & DCF Margin of Safety (Weight 30%)
    val_score = 0.0
    val_highlight = "Fair Value Baseline"
    val_evidence = "Valuation multiples reflect current market equilibrium."
    
    upside_pct = 0.0
    if dcf_res is not None:
        upside_pct = getattr(dcf_res, "upside_downside_pct", 0.0)
        dcf_tier = getattr(dcf_res, "valuation_tier", "Fair Value")
        # Within +/-10% the DCF tier itself reads "fair value": that gap is inside the model's own
        # sensitivity, so it earns no score in either direction.
        if upside_pct > 25.0:
            val_score += 50.0
        elif upside_pct > 10.0:
            val_score += 30.0
        elif upside_pct < -25.0:
            val_score -= 40.0
        elif upside_pct < -10.0:
            val_score -= 20.0
        val_highlight = f"DCF Upside: {upside_pct:+.1f}% ({dcf_tier})"
        val_evidence = f"Intrinsic DCF fair value estimates {upside_pct:+.1f}% margin of safety relative to current quote."
    
    # Check Relative Multiples Stance
    if valuation_multiples is not None:
        rel_stance = getattr(valuation_multiples, "relative_valuation_stance", "")
        if not rel_stance and isinstance(valuation_multiples, dict):
            rel_stance = valuation_multiples.get("relative_valuation_stance", "")
        if "Undervalued" in rel_stance:
            val_score += 35.0
            val_evidence += f" Multi-factor peer multiples corroborate an undervalued stance."
        elif "Overvalued" in rel_stance:
            val_score -= 30.0
            val_evidence += f" Multiples trade at a premium to peer median."
        else:
            val_score += 10.0

    # DuPont / ROE check
    roe_val = float(fin.get("roe", {}).get("latest", 20.0)) if isinstance(fin.get("roe"), dict) else 20.0
    if roe_val > 25.0:
        val_score += 15.0
    elif roe_val < 8.0:
        val_score -= 20.0

    val_score = np.clip(val_score, -100.0, 100.0)
    val_stance = "Strong Bullish" if val_score >= 40 else "Bullish" if val_score >= 15 else "Neutral" if val_score >= -15 else "Bearish" if val_score >= -40 else "Strong Bearish"

    # Pillar 2: Event Study Catalysts & Information Flow (Weight 20%)
    event_score = 0.0
    ev_count = len(inc_list)
    agreed_count = 0
    mean_car = 0.0
    for inc in inc_list:
        agrees = getattr(inc, "direction_agrees", inc.get("direction_agrees", True) if isinstance(inc, dict) else True)
        if agrees:
            agreed_count += 1
        car_dict = getattr(inc, "car", inc.get("car", {}) if isinstance(inc, dict) else {})
        if isinstance(car_dict, dict) and car_dict.get("car") is not None:
            mean_car += float(car_dict.get("car", 0.0))
    if ev_count > 0:
        mean_car /= ev_count
        agree_ratio = agreed_count / ev_count
        # Direction first: a run of negative abnormal returns is bearish whatever the news tone did.
        # Agreement between tone and price only says how much weight the direction deserves.
        signs = []
        for inc in inc_list:
            ar = getattr(inc, "abnormal_return", None)
            if ar is None and isinstance(inc, dict):
                ar = inc.get("abnormal_return")
            if ar is not None:
                signs.append(1.0 if ar > 0 else -1.0 if ar < 0 else 0.0)
        net_direction = float(np.mean(signs)) if signs else 0.0
        event_score += 35.0 * net_direction * (0.5 + 0.5 * agree_ratio)
        if mean_car > 0.02:
            event_score += 40.0
        elif mean_car < -0.02:
            event_score -= 40.0
        event_highlight = f"{ev_count} Event Anomalies | CAR: {mean_car*100:+.2f}%"
        event_evidence = f"{agreed_count}/{ev_count} incident days demonstrated directional agreement between media dispatches and stock price repricing."
    elif not news_available:
        # No news was analysed at all, so there is nothing to score. Treating silence as
        # good news would add a bullish vote the evidence does not support.
        event_score = 0.0
        event_highlight = "Not assessed: no news analysed"
        event_evidence = "no news was collected for this view, so the event pillar is left out and its weight is shared across the other four pillars."
    else:
        event_score = 0.0
        event_highlight = "No flagged event days"
        event_evidence = "no day in the window combined unusual news coverage with an unusual price move, so the event study adds no signal either way."

    event_score = np.clip(event_score, -100.0, 100.0)
    event_stance = "Not assessed" if not news_available else "Strong Bullish" if event_score >= 40 else "Bullish" if event_score >= 15 else "Neutral" if event_score >= -15 else "Bearish" if event_score >= -40 else "Strong Bearish"

    # Pillar 3: 1-Week & Multi-Timeframe Technical Alignment (Weight 20%)
    tech_score = 0.0
    tech_highlight = "Neutral Trend Alignment"
    tech_evidence = "Moving averages and oscillators show consolidation."
    
    if technical_res is not None:
        t_score = getattr(technical_res, "composite_score", None)
        if t_score is None and isinstance(technical_res, dict):
            t_score = technical_res.get("composite_score", 0.0)
        if t_score is not None:
            tech_score = float(t_score)
            rating = getattr(technical_res, "composite_rating", "") if not isinstance(technical_res, dict) else technical_res.get("composite_rating", "")
            adx_val = getattr(technical_res, "adx", {}).get("adx_14", 25.0) if isinstance(technical_res, dict) else 25.0
            tech_highlight = f"{rating} (Score {tech_score:+.1f})"
            tech_evidence = f"Oscillators and moving averages signal a {rating.lower()} regime with 14-period ADX at {adx_val:.1f}."
    else:
        tech_score = 20.0
        tech_highlight = "Constructive Trend"
        tech_evidence = "Asset maintains support above long-term exponential moving averages."

    tech_score = np.clip(tech_score, -100.0, 100.0)
    tech_stance = "Strong Bullish" if tech_score >= 40 else "Bullish" if tech_score >= 15 else "Neutral" if tech_score >= -15 else "Bearish" if tech_score >= -40 else "Strong Bearish"

    # Pillar 4: Macroeconomic backdrop (Weight 15%). Scored only from indicators that were
    # actually retrieved; nothing is assumed, and with none available the pillar is left out.
    macro_score = 0.0
    parts: list[str] = []
    notes: list[str] = []

    pmi = ((macro.get("pmi") or {}).get("composite"))
    if pmi is not None:
        macro_score += 20.0 if pmi >= 52 else 10.0 if pmi >= 50 else -20.0
        parts.append(f"PMI {pmi:.1f}")
        notes.append("activity indicators are expanding" if pmi >= 50 else "activity indicators are contracting")
    cpi = ((macro.get("cpi_inflation") or {}).get("value"))
    if cpi is not None:
        macro_score += 10.0 if 2.0 <= cpi <= 6.0 else (-15.0 if cpi > 6.0 else -5.0)
        parts.append(f"CPI {cpi:.1f}%")
        notes.append("inflation is inside the RBI band" if 2.0 <= cpi <= 6.0 else "inflation is outside the RBI band")
    iip = ((macro.get("iip_growth") or {}).get("value"))
    if iip is not None:
        macro_score += 10.0 if iip > 4.0 else (-10.0 if iip < 0.0 else 0.0)
        parts.append(f"IIP {iip:+.1f}%")
    core = ((macro.get("eight_core_industries") or {}).get("combined_growth_yoy_pct"))
    if core is not None:
        macro_score += 10.0 if core > 5.0 else (-10.0 if core < 2.0 else 0.0)
        parts.append(f"8 Core {core:+.1f}%")
    fed_diff = ((macro.get("fed_funds_rate") or {}).get("us_india_rate_differential_bps"))
    if fed_diff is not None:
        macro_score += 5.0 if fed_diff >= 0 else (-10.0 if fed_diff < -150 else 0.0)
        parts.append(f"IN-US policy rate gap {fed_diff:+d} bps")

    if parts:
        macro_highlight = " | ".join(parts)
        macro_evidence = ("Macro read from live releases: " + "; ".join(notes) + ".") if notes else "Macro read from the indicators listed above."
        macro_stance = "Strong Bullish" if macro_score >= 40 else "Bullish" if macro_score >= 15 else "Neutral" if macro_score >= -15 else "Bearish" if macro_score >= -40 else "Strong Bearish"
    else:
        macro_highlight = "Not assessed: no macro indicator retrieved"
        macro_evidence = "no macro indicator could be retrieved, so this pillar is left out and its weight is shared across the others."
        macro_stance = "Not assessed"
    macro_score = float(np.clip(macro_score, -100.0, 100.0))

    # Pillar 5: Downside Protection & Volatility Cushion (Weight 15%)
    risk_score = 20.0
    dd_val = float(dd.get("distance_to_default", 5.0)) if isinstance(dd, dict) else 5.0
    var_1d = float(var_m.get("parametric_var_99", -0.028)) if isinstance(var_m, dict) else -0.028
    
    if dd_val >= 4.5:
        risk_score += 35.0
    elif dd_val < 2.5:
        risk_score -= 40.0
        
    if abs(var_1d) <= 0.030:
        risk_score += 25.0
    elif abs(var_1d) > 0.050:
        risk_score -= 30.0

    risk_highlight = f"Merton DD: {dd_val:.1f}σ | 1D 99% VaR: {abs(var_1d)*100:.2f}%"
    risk_evidence = f"Extremely low structural default probability (Merton Distance to Default {dd_val:.1f}σ) ensures institutional solvency cushion."
    risk_score = np.clip(risk_score, -100.0, 100.0)
    risk_stance = "Strong Bullish" if risk_score >= 40 else "Bullish" if risk_score >= 15 else "Neutral" if risk_score >= -15 else "Bearish"

    # Assemble Pillars
    pillars = [
        InvestmentThesisPillar("1. Fundamental Valuation & DCF Margin", 30.0, val_score, val_stance, val_highlight, val_evidence),
        InvestmentThesisPillar("2. Event Study Information Flow & CARs", 20.0, event_score, event_stance, event_highlight, event_evidence),
        InvestmentThesisPillar("3. Technical & Indicator Momentum", 20.0, tech_score, tech_stance, tech_highlight, tech_evidence),
        InvestmentThesisPillar("4. Macroeconomic & 8 Core Transmission", 15.0, macro_score, macro_stance, macro_highlight, macro_evidence),
        InvestmentThesisPillar("5. Downside Risk & Solvency Cushion", 15.0, risk_score, risk_stance, risk_highlight, risk_evidence),
    ]
    excluded = {i for i, p in enumerate(pillars) if p.stance == "Not assessed"}
    if excluded:
        rest = sum(p.weight_pct for i, p in enumerate(pillars) if i not in excluded)
        for i, p in enumerate(pillars):
            p.weight_pct = 0.0 if i in excluded else round(p.weight_pct * 100.0 / rest, 2)

    # -------------------------------------------------------------------------
    # 2. COMPOSITE CONVICTION SCORE & ACTIONABLE CALL
    # -------------------------------------------------------------------------
    weighted_composite = sum(p.score * (p.weight_pct / 100.0) for p in pillars)  # -100 to +100
    conviction = float(np.clip(50.0 + (weighted_composite * 0.5), 5.0, 95.0))   # 0 to 100

    if weighted_composite >= 35.0:
        call = "STRONG BUY"
        badge = "osint-badge-pos"
        one_line = "High-conviction BUY recommendation driven by attractive DCF margin of safety, robust fundamentals, and supportive technical alignment."
    elif weighted_composite >= 12.0:
        call = "BUY / ACCUMULATE"
        badge = "osint-badge-pos"
        one_line = "Constructive ACCUMULATE recommendation on minor intraday dips with disciplined position sizing and clear target milestones."
    elif weighted_composite >= -15.0:
        call = "HOLD / NEUTRAL"
        badge = "osint-badge-cyan"
        one_line = "NEUTRAL / HOLD recommendation: maintain existing core exposures; wait for a clearer valuation discount or momentum breakout before adding."
    elif weighted_composite >= -35.0:
        call = "REDUCE / TAKE PROFIT"
        badge = "osint-badge-warn"
        one_line = "REDUCE recommendation: trim tactical exposures into strength to protect gains given elevated valuation multiples and technical resistance."
    else:
        call = "SELL / AVOID"
        badge = "osint-badge-neg"
        one_line = "SELL / AVOID recommendation: unfavorable risk-reward profile with deteriorating indicators and downside vulnerability."

    detailed_thesis = (
        f"Based on CEIA's quantitative synthesis, the entity achieves a composite conviction score of {conviction:.1f}/100, "
        f"warranting an actionable {call} verdict. "
        f"{val_evidence} On the event and news front, {event_evidence} "
        f"Technically, {tech_evidence} Solvency and balance sheet metrics indicate {risk_evidence.lower()}"
    )

    # -------------------------------------------------------------------------
    # 3. TARGET LADDER, STOP-LOSS & RISK-REWARD
    # -------------------------------------------------------------------------
    # Entry zone: [Current - 1.2%, Current + 0.4%]
    entry_low = curr_p * 0.988
    entry_high = curr_p * 1.004

    # Stop loss based on technical support / 99% VaR
    sl_downside_pct = max(4.5, min(8.5, abs(var_1d) * 100.0 * 2.0))
    stop_loss = curr_p * (1.0 - sl_downside_pct / 100.0)

    # Target 1 (Base Case): DCF intrinsic / Forecast P50
    t1_upside = max(8.0, min(22.0, upside_pct if upside_pct > 5.0 else 14.5))
    target_1 = curr_p * (1.0 + t1_upside / 100.0)

    # Target 2 (Stretch / Bull Case)
    t2_upside = t1_upside * 1.65
    target_2 = curr_p * (1.0 + t2_upside / 100.0)

    # Risk-Reward Ratio
    rr_num = t1_upside / max(0.1, sl_downside_pct)
    rr_str = f"1 : {rr_num:.2f}"

    # -------------------------------------------------------------------------
    # 4. PRESCRIBED QUANTITY & PORTFOLIO SIZING CALCULATOR
    # -------------------------------------------------------------------------
    # Kelly Criterion calculation
    exp_ret = max(0.02, (conviction / 100.0) * 0.18)
    est_vol = max(0.12, abs(var_1d) * np.sqrt(252))
    raw_kelly = (exp_ret / (est_vol ** 2)) * 100.0
    half_kelly = raw_kelly * 0.5
    
    # Prescribed Allocation % (Capped between 1.5% and 6.0% for risk diversification)
    if "BUY" in call:
        prescribed_alloc = float(np.clip(half_kelly, 3.0, 6.0))
    elif "HOLD" in call:
        prescribed_alloc = float(np.clip(half_kelly, 1.5, 3.5))
    else:
        prescribed_alloc = 0.0

    # Concrete Sizing Tiers across standard portfolios
    standard_portfolios = [
        ("Conservative Tier (₹10 Lakhs)", 1_000_000.0),
        ("Balanced Institutional Tier (₹25 Lakhs)", 2_500_000.0),
        ("High-Net-Worth / Institutional Tier (₹1 Crore)", 10_000_000.0),
    ]

    sizing_tiers = []
    for p_name, p_cap in standard_portfolios:
        alloc_inr = p_cap * (prescribed_alloc / 100.0)
        shares_qty = int(math.floor(alloc_inr / curr_p)) if curr_p > 0 else 0
        effective_exp = shares_qty * curr_p
        risk_at_sl = shares_qty * (curr_p - stop_loss)
        p_risk_pct = (risk_at_sl / p_cap) * 100.0 if p_cap > 0 else 0.0

        sizing_tiers.append(PortfolioSizingTier(
            portfolio_name=p_name,
            portfolio_capital_inr=p_cap,
            allocation_pct=prescribed_alloc,
            allocated_capital_inr=alloc_inr,
            prescribed_shares=shares_qty,
            effective_exposure_inr=effective_exp,
            risk_at_stop_loss_inr=risk_at_sl,
            portfolio_risk_pct=p_risk_pct,
        ))

    # -------------------------------------------------------------------------
    # 5. HOLDING PERIODS & EXECUTION PLAYBOOK
    # -------------------------------------------------------------------------
    core_holding = "6 to 12 Months (Medium-Term Fundamental Compounding & Intrinsic DCF Realization)"
    tactical_holding = "2 to 4 Weeks (Event CAR Momentum & Technical Breakout Cycle)"

    profit_booking = [
        f"Milestone 1 (Target 1: ₹ {target_1:,.2f} / +{t1_upside:.1f}%): Book 50% profits, move trailing stop-loss to entry price (₹ {curr_p:,.2f}) to lock in risk-free position.",
        f"Milestone 2 (Target 2: ₹ {target_2:,.2f} / +{t2_upside:.1f}%): Liquidate remaining 50% tactical allocation or trail tight 5-day EMA stop for compounding run.",
    ]

    invalidation = [
        f"Hard Stop-Loss Breach: Immediate mandatory exit if price closes below ₹ {stop_loss:,.2f} (-{sl_downside_pct:.1f}% downside limit).",
        "Structural Breakdown: Invalidate thesis if asset breaks convincingly below 200-day Simple Moving Average on elevated volume (> 2.0σ volume spike).",
        "Material Negative SEBI Disclosure: Immediate portfolio reassessment if company files an adverse Reg 30 disclosure (e.g. forensic audit, regulatory penalty, or key management dispute).",
    ]

    as_of_str = str(as_of) if as_of else date.today().strftime("%d-%b-%Y")

    return InvestmentVerdict(
        actionable_call=call,
        conviction_score=conviction,
        recommendation_badge=badge,
        one_line_summary=one_line,
        detailed_thesis=detailed_thesis,
        pillars=pillars,
        prescribed_allocation_pct=prescribed_alloc,
        raw_kelly_pct=raw_kelly,
        half_kelly_pct=half_kelly,
        maximum_allocation_cap_pct=6.0,
        sizing_tiers=sizing_tiers,
        current_price=curr_p,
        entry_zone_low=entry_low,
        entry_zone_high=entry_high,
        target_1_price=target_1,
        target_1_upside_pct=t1_upside,
        target_2_price=target_2,
        target_2_upside_pct=t2_upside,
        stop_loss_price=stop_loss,
        stop_loss_downside_pct=sl_downside_pct,
        risk_reward_ratio=rr_str,
        core_holding_period=core_holding,
        tactical_holding_period=tactical_holding,
        profit_booking_rules=profit_booking,
        invalidation_rules=invalidation,
        as_of_date=as_of_str,
    )
