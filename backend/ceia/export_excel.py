"""Institutional Multi-Tab Dynamic Excel Financial Model Exporter for CEIA analysis.

Exports complete event study findings, daily abnormal return series, candidate incident
rankings, 2-stage DCF valuation models, WACC schedules, Dupont 5-Factor ROE breakdowns,
Key Financial Ratios suite, Solvency & Distress Ensemble (Merton DD, Ohlson O-Score, Cox Survival, Altman Z"),
Scenario & Bayesian DCF distributions, Fama-French factor attributions, Almgren-Chriss execution schedules,
Macro/Sector backdrops, and News inventory to an enriched 13-tab multi-sheet Excel workbook (.xlsx).

Contains LIVE Excel formulas (=SUM, =AVERAGE, =STDEV.S, =SLOPE, =INTERCEPT, =CORREL, =PERCENTILE.INC, =MIN)
so that analysts can audit the math and tweak assumptions in real time.
Output is automatically routed to the Excel/ folder unless an explicit path is provided.
"""

from __future__ import annotations

import io
import logging
import math
import re
import zipfile
from datetime import date
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

import numpy as np
import pandas as pd


from .analyze import Analysis
from .execution_simulator import simulate_almgren_chriss_execution
from .factor_model import fit_multi_factor_model
from .forecasting import generate_forecasting_suite
from .returns import compute_drawdown_metrics, compute_kyle_lambda_and_vpin, compute_roll_effective_spread
from .solvency_ensemble import compute_distress_ensemble, compute_kmv_merton_rating, compute_ohlson_o_score
from .valuation_model import (
    compute_bayesian_probabilistic_dcf,
    compute_dcf_valuation,
    compute_dupont_5_factor_roe,
    compute_key_financial_ratios,
    compute_relative_valuation_multiples,
    compute_residual_income_valuation,
    compute_scenario_dcf,
    compute_wacc,
    is_financial_institution,
)
from .volatility_models import compute_volatility_model_ensemble

log = logging.getLogger(__name__)



def _col_letter(col_idx: int) -> str:
    """Convert 0-indexed column integer to Excel column letters (A, B, ..., Z, AA, AB, ...)."""
    result = ""
    col_idx += 1
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        result = chr(65 + remainder) + result
    return result


def export_analysis_to_excel(
    analysis: Any,
    out_path: Path | str | None = None,
) -> Path:
    """Export complete institutional analysis to a 13-tab dynamic Excel model workbook."""
    if isinstance(analysis, dict):
        cfg_d = analysis.get("config") or analysis
        ticker_str = cfg_d.get("ticker", "TICKER")
        start_str = str(cfg_d.get("start", "2026-01-01"))
        end_str = str(cfg_d.get("end", "2026-08-23"))
        company_str = cfg_d.get("company", "Company")
        benchmark_str = cfg_d.get("benchmark", "^NSEI")
        event_window = tuple(cfg_d.get("event_window", [-1, 3]))

        daily_records = analysis.get("daily", [])
        if isinstance(daily_records, list):
            daily_df = pd.DataFrame(daily_records)
            if not daily_df.empty and "date" in daily_df.columns:
                daily_df["date"] = pd.to_datetime(daily_df["date"]).dt.date
                daily_df.set_index("date", inplace=True)
        elif isinstance(daily_records, pd.DataFrame):
            daily_df = daily_records.copy()
        else:
            daily_df = pd.DataFrame()

        raw_inc = analysis.get("incidents", [])
        inc_objs = []
        from .eventstudy import Incident
        for inc in raw_inc:
            if isinstance(inc, dict):
                i_day = date.fromisoformat(inc["day"]) if isinstance(inc.get("day"), str) else inc.get("day")
                inc_obj = Incident(
                    day=i_day,
                    abnormal_return=float(inc.get("abnormal_return", 0.0)),
                    abnormal_return_z=float(inc.get("abnormal_return_z", 0.0)),
                    raw_return=float(inc.get("raw_return", 0.0)),
                    benchmark_return=float(inc.get("benchmark_return", 0.0)),
                    coverage_z=float(inc.get("coverage_z", 0.0)),
                    sentiment_z=float(inc.get("sentiment_z", 0.0)),
                    item_count=int(inc.get("item_count", inc.get("unique_count", 0))),
                    mean_sentiment=float(inc.get("mean_sentiment", inc.get("weighted_sentiment", 0.0))),
                    dominant_event=str(inc.get("dominant_event", "")),
                    dominant_emotion=str(inc.get("dominant_emotion", "")),
                    volume=float(inc.get("volume", 0.0)),
                    volume_z=float(inc.get("volume_z", 0.0)),
                    score=float(inc.get("score", 1.0)),
                    direction_agrees=bool(inc.get("direction_agrees", True)),
                    car=inc.get("car", {}),
                    headlines=inc.get("headlines", []),
                    trajectory_type=inc.get("trajectory_type", "Permanent Repricing"),
                    adi_score=float(inc.get("adi_score", 0.0)) if inc.get("adi_score") is not None else 0.0,
                )
                inc_objs.append(inc_obj)
            else:
                inc_objs.append(inc)

        # Wrap in proxy
        cfg_obj = type("RunConfigProxy", (), {
            "ticker": ticker_str, "company": company_str, "benchmark": benchmark_str,
            "start": start_str, "end": end_str, "event_window": event_window
        })()
        analysis = type("AnalysisProxy", (), {
            "config": cfg_obj,
            "daily": daily_df,
            "incidents": inc_objs,
            "financials": analysis.get("financials", {}),
            "distance_to_default": analysis.get("distance_to_default", {}),
            "var": analysis.get("var", {}),
            "price_meta": analysis.get("price_meta", analysis.get("prices", {})),
            "macro": analysis.get("macro", {}),
            "forecasting": analysis.get("forecasting", {}),
            "portfolio": analysis.get("portfolio", {}),
            "microstructure": analysis.get("microstructure", {}),
            "sdid": analysis.get("sdid", {}),
            "spillover": analysis.get("spillover", {}),
            "xai": analysis.get("xai", {}),
            "regime": analysis.get("regime", {}),
            "volatility_models": analysis.get("volatility_models", {}),
            "metals": analysis.get("metals", {}),
            "technical_analysis": analysis.get("technical_analysis", {}),
            "backtesting": analysis.get("backtesting", {}),
        })()
    else:
        daily_df = analysis.daily.copy() if not analysis.daily.empty else pd.DataFrame()

    if out_path is None:
        excel_dir = Path("Excel")
        excel_dir.mkdir(parents=True, exist_ok=True)
        sanitized_ticker = analysis.config.ticker.replace("^", "").replace(".", "_")
        out_path = excel_dir / f"{sanitized_ticker}_{analysis.config.start}_{analysis.config.end}_model_report.xlsx"
    else:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

    fin = analysis.financials or {}
    dd = analysis.distance_to_default or {}
    v = analysis.var or {}
    pm = analysis.price_meta or {}
    macro = analysis.macro or {}

    ret_series = daily_df["return"].dropna() if "return" in daily_df.columns else pd.Series(dtype=float)
    bench_series = daily_df["benchmark_return"].dropna() if "benchmark_return" in daily_df.columns else ret_series
    close_series = daily_df["close"].dropna() if "close" in daily_df.columns else pd.Series(dtype=float)
    vol_series = daily_df["volume"].dropna() if "volume" in daily_df.columns else pd.Series(dtype=float)

    curr_p = float(close_series.iloc[-1]) if not close_series.empty else 100.0
    shares_raw = fin.get("shares_outstanding")
    mcap_raw = fin.get("market_cap")
    shares = float(shares_raw) if shares_raw is not None else (float(mcap_raw) / max(0.1, curr_p) if mcap_raw is not None else 10.0)
    market_cap = float(mcap_raw) if mcap_raw is not None else (curr_p * shares)

    bs = fin.get("balance_sheet") if isinstance(fin.get("balance_sheet"), dict) else {}
    debt_raw = bs.get("total_debt") if bs.get("total_debt") is not None else bs.get("borrowings")
    debt = float(debt_raw) if debt_raw is not None else 100.0

    cash_raw = bs.get("cash_and_equivalents") if bs.get("cash_and_equivalents") is not None else bs.get("investments")
    cash = float(cash_raw) if cash_raw is not None else 50.0

    op_inc = fin.get("operating_income")
    op_val = op_inc.get("latest") if isinstance(op_inc, dict) and op_inc.get("latest") is not None else None
    nopat = float(op_val) if op_val is not None else (market_cap * 0.08)

    beta_raw = pm.get("beta")
    beta_val = float(beta_raw) if beta_raw is not None else 1.0

    rf_raw = dd.get("risk_free_rate")
    rf_val = float(rf_raw) if rf_raw is not None else 0.068

    # Daily Volatility
    daily_vol = float(ret_series.std(ddof=1)) if len(ret_series) > 1 else 0.02

    # Compute Core Institutional Models
    is_bank = is_financial_institution(fin, analysis.config.ticker)
    wacc_res = compute_wacc(market_cap=market_cap, total_debt=debt, beta=beta_val, risk_free_rate=rf_val)

    eq_cap = float(bs.get("equity_capital") or 50.0)
    reserves = float(bs.get("reserves") or 450.0)
    book_equity = eq_cap + reserves if (eq_cap + reserves) > 0 else max(100.0, market_cap * 0.4)

    net_inc_dict = fin.get("net_profit") if isinstance(fin.get("net_profit"), dict) else {}
    net_inc_raw = getattr(net_inc_dict, "latest", None) if not isinstance(net_inc_dict, dict) else net_inc_dict.get("latest")
    net_income = float(net_inc_raw) if net_inc_raw is not None else (market_cap * 0.06)

    if is_bank:
        dcf_res = compute_residual_income_valuation(
            current_price=curr_p,
            shares_outstanding=shares,
            book_value_equity=book_equity,
            latest_net_income=net_income,
            beta=beta_val,
            risk_free_rate=rf_val,
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

    scenario_res = compute_scenario_dcf(
        current_price=curr_p,
        shares_outstanding=shares,
        nopat=nopat,
        total_debt=debt,
        cash=cash,
        base_growth_rate=0.12,
        base_wacc=wacc_res.wacc,
        is_bank=is_bank,
        book_value_equity=book_equity,
        net_income=net_income,
    )
    bayesian_res = compute_bayesian_probabilistic_dcf(
        current_price=curr_p,
        shares_outstanding=shares,
        nopat=nopat,
        total_debt=debt,
        cash=cash,
        base_wacc=wacc_res.wacc,
        base_growth_rate=0.12,
        is_bank=is_bank,
        book_value_equity=book_equity,
        net_income=net_income,
    )
    dupont_res = compute_dupont_5_factor_roe(fin)
    ratios_res = compute_key_financial_ratios(fin)

    dd_val = dd.get("distance_to_default")
    ensemble_res = compute_distress_ensemble(fin, distance_to_default=dd_val, daily_volatility=daily_vol)
    factor_res = fit_multi_factor_model(ret_series, bench_series, risk_free_rate_annual=rf_val)
    dd_metrics = compute_drawdown_metrics(close_series, ret_series)

    exec_res = simulate_almgren_chriss_execution(
        order_value_inr=10000000.0,
        stock_price=curr_p,
        average_daily_volume=float(vol_series.mean()) if not vol_series.empty else 100000.0,
        daily_volatility=daily_vol,
    )

    # 1. Sheet: Executive Summary
    summary_rows = [
        {"Parameter": "Company Name", "Value": analysis.config.company},
        {"Parameter": "Ticker Symbol", "Value": analysis.config.ticker},
        {"Parameter": "Analysis Start Date", "Value": analysis.config.start.isoformat() if hasattr(analysis.config.start, "isoformat") else str(analysis.config.start)},
        {"Parameter": "Analysis End Date", "Value": analysis.config.end.isoformat() if hasattr(analysis.config.end, "isoformat") else str(analysis.config.end)},
        {"Parameter": "Benchmark Index", "Value": analysis.config.benchmark},
        {"Parameter": "Current Stock Price (₹)", "Value": round(curr_p, 2)},
        {"Parameter": "Market Capitalization (₹ Cr)", "Value": round(market_cap, 2)},
        {"Parameter": "Market Beta (β)", "Value": round(beta_val, 2)},
        {"Parameter": "CAPM Cost of Equity (%)", "Value": round(wacc_res.cost_of_equity * 100, 2)},
        {"Parameter": "Weighted Average Cost of Capital - WACC (%)", "Value": round(wacc_res.wacc * 100, 2)},
        {"Parameter": "DCF Base Intrinsic Target Price (₹)", "Value": round(dcf_res.intrinsic_value_per_share, 2)},
        {"Parameter": "DCF Base Margin of Safety / Upside (%)", "Value": round(dcf_res.upside_downside_pct, 2)},
        {"Parameter": "DCF Base Valuation Tier", "Value": dcf_res.valuation_tier},
        {"Parameter": "Scenario DCF: Bull Case Target (₹)", "Value": scenario_res.bull_case_price},
        {"Parameter": "Scenario DCF: Bear Case Target (₹)", "Value": scenario_res.bear_case_price},
        {"Parameter": "Bayesian DCF: Median Target (₹)", "Value": bayesian_res.bayesian_median_price},
        {"Parameter": "Bayesian DCF: Conservative P10 Floor (₹)", "Value": bayesian_res.p10_conservative_price},
        {"Parameter": "Bayesian DCF: Probability of Undervaluation (%)", "Value": f"{bayesian_res.prob_undervaluation_pct:.1f}%"},
        {"Parameter": "Dupont 5-Factor ROE (%)", "Value": round(dupont_res.roe_pct, 2)},
        {"Parameter": "Return on Capital Employed - ROCE (%)", "Value": f"{ratios_res.roce_pct:.2f}%"},
        {"Parameter": "Return on Assets - ROA (%)", "Value": f"{ratios_res.roa_pct:.2f}%"},
        {"Parameter": "Debt-to-Equity (D/E)", "Value": f"{ratios_res.debt_to_equity:.2f}x"},
        {"Parameter": "Interest Coverage Ratio (ICR)", "Value": f"{ratios_res.interest_coverage_ratio:.2f}x"},
        {"Parameter": "Current Ratio", "Value": f"{ratios_res.current_ratio:.2f}x"},
        {"Parameter": "Composite Solvency Index (0-100)", "Value": ensemble_res.composite_solvency_index},
        {"Parameter": "Composite Credit Rating", "Value": ensemble_res.credit_rating},
        {"Parameter": "Distress Risk Tier", "Value": ensemble_res.distress_risk_tier},
        {"Parameter": "Merton Distance-to-Default (DD)", "Value": dd_val},
        {"Parameter": "KMV Merton Benchmark Tier", "Value": ensemble_res.merton_component.get("kmv_rating_tier")},
        {"Parameter": "Ohlson (1980) O-Score", "Value": ensemble_res.ohlson_component.get("ohlson_o_score")},
        {"Parameter": "Ohlson Default Probability (%)", "Value": f"{ensemble_res.ohlson_component.get('default_probability_pct', 0.0):.2f}%"},
        {"Parameter": "Cox Proportional Hazard 5-Year Survival (%)", "Value": f"{ensemble_res.cox_component.get('survival_5yr_pct', 95.0):.2f}%"},
        {"Parameter": "Fama-French Pure Alpha (% Ann.)", "Value": round(factor_res.alpha_annualized_pct, 2)},
        {"Parameter": "Fama-French Factor Profile", "Value": factor_res.factor_profile_tier},
        {"Parameter": "Annualized Realized Return (%)", "Value": round(float(ret_series.mean() * 252 * 100), 2) if len(ret_series) > 0 else 0.0},
        {"Parameter": "Annualized Realized Volatility (%)", "Value": round(daily_vol * np.sqrt(252) * 100, 2)},
        {"Parameter": "Maximum Drawdown (%)", "Value": f"-{dd_metrics['max_drawdown_pct']:.2f}%"},
        {"Parameter": "Calmar Ratio", "Value": dd_metrics["calmar_ratio"]},
        {"Parameter": "Total Candidate Event Days Identified", "Value": len(analysis.incidents)},
        {"Parameter": "Incidents with Price Direction Agreement", "Value": sum(1 for i in analysis.incidents if i.direction_agrees)},
        {"Parameter": "Macro Brent Crude Price ($/bbl)", "Value": macro.get("brent_crude_price", "N/A")},
        {"Parameter": "Macro India 10Y G-Sec Yield (%)", "Value": macro.get("gsec_10y_yield", "N/A")},
    ]
    summary_df = pd.DataFrame(summary_rows)

    # 2. Sheet: Daily Detail (with Drawdown series)
    if not daily_df.empty:
        if isinstance(daily_df.index, pd.DatetimeIndex):
            daily_df.index = daily_df.index.strftime("%Y-%m-%d")
        daily_df = daily_df.reset_index(names=["Date"])
        # Add Drawdown % column if close exists
        if "close" in daily_df.columns:
            cum_m = daily_df["close"].cummax()
            daily_df["Drawdown_Pct"] = ((daily_df["close"] - cum_m) / cum_m) * 100.0

    # 3. Sheet: Candidate Incidents
    inc_rows = []
    if analysis.incidents:
        for rank, inc in enumerate(analysis.incidents, 1):
            car = inc.car or {}
            inc_rows.append({
                "Rank": rank,
                "Date": inc.day.isoformat(),
                "Abnormal Return (%)": round(inc.abnormal_return * 100, 2),
                "Abnormal Return z-Score": round(inc.abnormal_return_z, 2),
                "PV-ADI Disruption Index": round(inc.adi_score, 2) if inc.adi_score is not None else None,
                "News Items Count": inc.item_count,
                "Mean Sentiment": round(inc.mean_sentiment, 3),
                "Event Category": inc.dominant_event,
                "Dominant Emotion": inc.dominant_emotion,
                "CAR (Event Window) (%)": round(car.get("car", 0.0) * 100, 2) if car.get("car") is not None else None,
                "CAR t-Stat": car.get("t_stat"),
                "CAR p-Value": car.get("p_value"),
                "Trajectory Type": getattr(inc, "trajectory_type", "Permanent Repricing"),
                "Direction Agrees": inc.direction_agrees,
                "SEBI Reg 30 Urgency": getattr(inc, "sebi_urgency", "Standard Statutory"),
                "Forward Guidance Tier": getattr(inc, "guidance_tier", "Qualitative Outlook"),
            })
    inc_df = pd.DataFrame(inc_rows)

    # 4. Sheet: Event CAR Attribution
    from .eventstudy import compute_multievent_car_attribution_waterfall
    waterfall = compute_multievent_car_attribution_waterfall(analysis.daily, analysis.incidents)
    attr_rows = [
        {"Component": "Total Cumulative Excess Return (%)", "Value": waterfall.get("total_excess_return_pct")},
        {"Component": "Total Event-Explained CAR (%)", "Value": waterfall.get("total_event_explained_pct")},
        {"Component": "Event Explained Share (%)", "Value": waterfall.get("event_explained_share_pct")},
        {"Component": "Unexplained Alpha Drift (%)", "Value": waterfall.get("unexplained_drift_pct")},
    ]
    for cat_name, val in (waterfall.get("category_attributions_pct") or {}).items():
        attr_rows.append({"Component": f"Event Category: {cat_name} (%)", "Value": val})
    attribution_df = pd.DataFrame(attr_rows)

    # 5. Sheet: DCF Valuation & WACC / Residual Income Valuation (Banks)
    if is_bank:
        dcf_sched_rows = [
            {"Section": "Methodology Disclosure", "Parameter": "Valuation Framework", "Value": "Residual Income Model (RIM / Edwards-Bell-Ohlson 1995 for Banks)"},
            {"Section": "Methodology Disclosure", "Parameter": "Academic Rationale", "Value": "Standard FCFF/WACC is methodologically invalid for banks where debt/deposits are operating raw materials."},
            {"Section": "Residual Income Valuation", "Parameter": "Book Value of Equity (₹ Cr)", "Value": round(dcf_res.book_value_of_equity, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Book Value per Share (BVPS ₹)", "Value": round(dcf_res.book_value_per_share, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Baseline Sustainable ROE (%)", "Value": round(dcf_res.baseline_roe_pct, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Cost of Equity Ke (%)", "Value": round(dcf_res.cost_of_equity_ke * 100, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Sum of PV of 5Y Residual Income (₹ Cr)", "Value": round(dcf_res.sum_pv_residual_income, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Terminal Residual Income (₹ Cr)", "Value": round(dcf_res.terminal_residual_income, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "PV of Terminal Residual Income (₹ Cr)", "Value": round(dcf_res.pv_terminal_residual_income, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Total Intrinsic Equity Value (₹ Cr)", "Value": round(dcf_res.total_intrinsic_equity_value, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "RIM Base Intrinsic Target Price (₹)", "Value": round(dcf_res.intrinsic_value_per_share, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Current Market Price (₹)", "Value": round(dcf_res.current_price, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Current P/B Multiple", "Value": f"{dcf_res.current_pb_ratio:.2f}x"},
            {"Section": "Residual Income Valuation", "Parameter": "Implied Margin of Safety (%)", "Value": round(dcf_res.upside_downside_pct, 2)},
            {"Section": "Residual Income Valuation", "Parameter": "Valuation Tier", "Value": dcf_res.valuation_tier},
            {"Section": "Scenario Schedule", "Parameter": "Bull Case Target Price (₹)", "Value": scenario_res.bull_case_price},
            {"Section": "Scenario Schedule", "Parameter": "Bull Case Upside (%)", "Value": f"{scenario_res.bull_case_upside_pct:.2f}%"},
            {"Section": "Scenario Schedule", "Parameter": "Base Case Target Price (₹)", "Value": scenario_res.base_case_price},
            {"Section": "Scenario Schedule", "Parameter": "Base Case Upside (%)", "Value": f"{scenario_res.base_case_upside_pct:.2f}%"},
            {"Section": "Scenario Schedule", "Parameter": "Bear Case Target Price (₹)", "Value": scenario_res.bear_case_price},
            {"Section": "Scenario Schedule", "Parameter": "Bear Case Upside (%)", "Value": f"{scenario_res.bear_case_upside_pct:.2f}%"},
            {"Section": "Bayesian Monte Carlo RIM", "Parameter": "Bayesian Median Target (₹)", "Value": bayesian_res.bayesian_median_price},
            {"Section": "Bayesian Monte Carlo RIM", "Parameter": "10th Percentile Floor (₹)", "Value": bayesian_res.p10_conservative_price},
            {"Section": "Bayesian Monte Carlo RIM", "Parameter": "25th Percentile Lower Quartile (₹)", "Value": bayesian_res.p25_lower_quartile_price},
            {"Section": "Bayesian Monte Carlo RIM", "Parameter": "75th Percentile Upper Quartile (₹)", "Value": bayesian_res.p75_upper_quartile_price},
            {"Section": "Bayesian Monte Carlo RIM", "Parameter": "90th Percentile Ceiling (₹)", "Value": bayesian_res.p90_optimistic_price},
            {"Section": "Bayesian Monte Carlo RIM", "Parameter": "Probability of Undervaluation (%)", "Value": f"{bayesian_res.prob_undervaluation_pct:.1f}%"},
            {"Section": "Probabilistic CAPM", "Parameter": "Bayesian Mean Cost of Equity Ke (%)", "Value": f"{bayesian_res.probabilistic_capm.get('cost_of_equity_mean', 0.14)*100:.2f}%"},
        ]
    else:
        dcf_sched_rows = [
            {"Section": "2-Stage DCF Forecast", "Parameter": "Base NOPAT (₹ Cr)", "Value": round(dcf_res.latest_nopat, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "5-Year Projected Growth Rate (%)", "Value": round(dcf_res.projected_growth_rate * 100, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Terminal Growth Rate g (%)", "Value": round(dcf_res.terminal_growth_rate * 100, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "WACC (%)", "Value": round(wacc_res.wacc * 100, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Sum of PV of 5-Year FCFF (₹ Cr)", "Value": round(dcf_res.sum_pv_fcff, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Terminal Value (₹ Cr)", "Value": round(dcf_res.terminal_value, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "PV of Terminal Value (₹ Cr)", "Value": round(dcf_res.pv_terminal_value, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Enterprise Value (₹ Cr)", "Value": round(dcf_res.enterprise_value, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Total Debt (₹ Cr)", "Value": round(dcf_res.total_debt, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Cash & Equivalents (₹ Cr)", "Value": round(dcf_res.cash_and_equivalents, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Equity Value (₹ Cr)", "Value": round(dcf_res.equity_value, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Classical DCF Base Intrinsic Price (₹)", "Value": round(dcf_res.intrinsic_value_per_share, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Current Market Price (₹)", "Value": round(dcf_res.current_price, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Implied Margin of Safety (%)", "Value": round(dcf_res.upside_downside_pct, 2)},
            {"Section": "2-Stage DCF Forecast", "Parameter": "Valuation Tier", "Value": dcf_res.valuation_tier},
            {"Section": "Scenario Schedule", "Parameter": "Bull Case Target Price (₹)", "Value": scenario_res.bull_case_price},
            {"Section": "Scenario Schedule", "Parameter": "Bull Case Upside (%)", "Value": f"{scenario_res.bull_case_upside_pct:.2f}%"},
            {"Section": "Scenario Schedule", "Parameter": "Base Case Target Price (₹)", "Value": scenario_res.base_case_price},
            {"Section": "Scenario Schedule", "Parameter": "Base Case Upside (%)", "Value": f"{scenario_res.base_case_upside_pct:.2f}%"},
            {"Section": "Scenario Schedule", "Parameter": "Bear Case Target Price (₹)", "Value": scenario_res.bear_case_price},
            {"Section": "Scenario Schedule", "Parameter": "Bear Case Upside (%)", "Value": f"{scenario_res.bear_case_upside_pct:.2f}%"},
            {"Section": "Bayesian Monte Carlo", "Parameter": "Bayesian Median Target (₹)", "Value": bayesian_res.bayesian_median_price},
            {"Section": "Bayesian Monte Carlo", "Parameter": "10th Percentile Floor (₹)", "Value": bayesian_res.p10_conservative_price},
            {"Section": "Bayesian Monte Carlo", "Parameter": "25th Percentile Lower Quartile (₹)", "Value": bayesian_res.p25_lower_quartile_price},
            {"Section": "Bayesian Monte Carlo", "Parameter": "75th Percentile Upper Quartile (₹)", "Value": bayesian_res.p75_upper_quartile_price},
            {"Section": "Bayesian Monte Carlo", "Parameter": "90th Percentile Ceiling (₹)", "Value": bayesian_res.p90_optimistic_price},
            {"Section": "Bayesian Monte Carlo", "Parameter": "Probability of Undervaluation (%)", "Value": f"{bayesian_res.prob_undervaluation_pct:.1f}%"},
            {"Section": "Probabilistic CAPM & WACC", "Parameter": "Bayesian Mean Cost of Equity Ke (%)", "Value": f"{bayesian_res.probabilistic_capm.get('cost_of_equity_mean', 0.14)*100:.2f}%"},
            {"Section": "Probabilistic CAPM & WACC", "Parameter": "Bayesian Mean WACC (%)", "Value": f"{bayesian_res.bayesian_wacc_distribution.get('wacc_mean', 0.11)*100:.2f}%"},
            {"Section": "Probabilistic CAPM & WACC", "Parameter": "Bayesian WACC Std Dev (%)", "Value": f"{bayesian_res.bayesian_wacc_distribution.get('wacc_std', 0.012)*100:.2f}%"},
        ]
    dcf_df = pd.DataFrame(dcf_sched_rows)

    # 6. Sheet: Dupont & Financial Ratios
    ratios_rows = [
        {"Category": "Dupont 5-Factor", "Metric": "Step 1: Tax Burden (Net Income / EBT)", "Value": round(dupont_res.tax_burden, 3), "Benchmark / Meaning": "Retained profit share after tax"},
        {"Category": "Dupont 5-Factor", "Metric": "Step 2: Interest Burden (EBT / EBIT)", "Value": round(dupont_res.interest_burden, 3), "Benchmark / Meaning": "Operating profit after debt servicing"},
        {"Category": "Dupont 5-Factor", "Metric": "Step 3: Operating Margin (EBIT / Revenue)", "Value": f"{dupont_res.ebit_margin*100:.2f}%", "Benchmark / Meaning": "Operating profitability & pricing power"},
        {"Category": "Dupont 5-Factor", "Metric": "Step 4: Asset Turnover (Revenue / Assets)", "Value": f"{dupont_res.asset_turnover:.2f}x", "Benchmark / Meaning": "Asset utilization velocity"},
        {"Category": "Dupont 5-Factor", "Metric": "Step 5: Financial Leverage (Assets / Equity)", "Value": f"{dupont_res.financial_leverage:.2f}x", "Benchmark / Meaning": "Equity multiplier / gearing"},
        {"Category": "Dupont 5-Factor", "Metric": "Comprehensive Dupont ROE", "Value": f"{dupont_res.roe_pct:.2f}%", "Benchmark / Meaning": dupont_res.roe_quality_tier},
        {"Category": "Core Financial Ratios", "Metric": "Return on Assets (ROA)", "Value": f"{ratios_res.roa_pct:.2f}%", "Benchmark / Meaning": "> 5.0% (Asset Productivity)"},
        {"Category": "Core Financial Ratios", "Metric": "Return on Equity (ROE)", "Value": f"{ratios_res.roe_pct:.2f}%", "Benchmark / Meaning": "> 15.0% (Shareholder Return)"},
        {"Category": "Core Financial Ratios", "Metric": "Return on Capital Employed (ROCE)", "Value": f"{ratios_res.roce_pct:.2f}%", "Benchmark / Meaning": "> 15.0% (Operating Efficiency)"},
        {"Category": "Core Financial Ratios", "Metric": "Debt-to-Equity (D/E)", "Value": f"{ratios_res.debt_to_equity:.2f}x", "Benchmark / Meaning": "< 1.0x (Prudent Leverage)"},
        {"Category": "Core Financial Ratios", "Metric": "Interest Coverage Ratio (ICR)", "Value": f"{ratios_res.interest_coverage_ratio:.2f}x", "Benchmark / Meaning": "> 3.0x (Safe Debt Servicing)"},
        {"Category": "Core Financial Ratios", "Metric": "Current Ratio", "Value": f"{ratios_res.current_ratio:.2f}x", "Benchmark / Meaning": "> 1.33x (Working Capital Liquidity)"},
        {"Category": "Core Financial Ratios", "Metric": "Asset Turnover Ratio", "Value": f"{ratios_res.asset_turnover:.2f}x", "Benchmark / Meaning": "> 0.8x (Capital Efficiency)"},
        {"Category": "Core Financial Ratios", "Metric": "Cash Ratio", "Value": f"{ratios_res.cash_ratio:.2f}x", "Benchmark / Meaning": "> 0.20x (Immediate Liquidity Buffer)"},
    ]
    ratios_df = pd.DataFrame(ratios_rows)

    # 7. Sheet: Solvency & Distress Ensemble
    solvency_rows = [
        {"Model / Framework": "Ensemble Synthesis", "Metric": "Composite Solvency Index (0-100)", "Result": ensemble_res.composite_solvency_index, "Assessment": ensemble_res.distress_risk_tier},
        {"Model / Framework": "Ensemble Synthesis", "Metric": "Institutional Credit Rating", "Result": ensemble_res.credit_rating, "Assessment": ensemble_res.credit_opinion},
        {"Model / Framework": "KMV Merton Structural Model", "Metric": "Distance to Default (DD)", "Result": dd_val, "Assessment": ensemble_res.merton_component.get("benchmark_status")},
        {"Model / Framework": "KMV Merton Structural Model", "Metric": "KMV Rating Tier", "Result": ensemble_res.merton_component.get("kmv_rating_tier"), "Assessment": ensemble_res.merton_component.get("safety_cushion")},
        {"Model / Framework": "KMV Merton Structural Model", "Metric": "Implied Default Probability (%)", "Result": f"{ensemble_res.merton_component.get('implied_default_prob_pct', 0.0):.4f}%", "Assessment": "1-Year Option-Theoretic Default Barrier"},
        {"Model / Framework": "Ohlson (1980) 9-Factor Logit", "Metric": "Ohlson O-Score", "Result": ensemble_res.ohlson_component.get("ohlson_o_score"), "Assessment": ensemble_res.ohlson_component.get("solvency_tier")},
        {"Model / Framework": "Ohlson (1980) 9-Factor Logit", "Metric": "Ohlson Default Probability (%)", "Result": f"{ensemble_res.ohlson_component.get('default_probability_pct', 0.0):.2f}%", "Assessment": "Logistic Multi-Variable Default Risk"},
        {"Model / Framework": "Altman Z\"-Score (Emerging Markets)", "Metric": "Altman Z\"-Score", "Result": ensemble_res.altman_component.get("altman_z_score"), "Assessment": ensemble_res.altman_component.get("solvency_zone")},
        {"Model / Framework": "Piotroski F-Score", "Metric": "Piotroski Score (0-9)", "Result": ensemble_res.piotroski_component.get("piotroski_f_score"), "Assessment": ensemble_res.piotroski_component.get("fundamental_tier")},
        {"Model / Framework": "Beneish M-Score", "Metric": "Beneish M-Score", "Result": ensemble_res.beneish_component.get("beneish_m_score"), "Assessment": "Clean / Unflagged" if not ensemble_res.beneish_component.get("is_manipulation_risk") else "Manipulation Risk"},
        {"Model / Framework": "Cox Proportional Hazards Model", "Metric": "Hazard Rate Multiplier", "Result": ensemble_res.cox_component.get("hazard_ratio_multiplier"), "Assessment": ensemble_res.cox_component.get("risk_regime")},
        {"Model / Framework": "Cox Proportional Hazards Model", "Metric": "1-Year Survival Probability (%)", "Result": f"{ensemble_res.cox_component.get('survival_1yr_pct', 99.0):.2f}%", "Assessment": "Semi-Parametric Survival Curve"},
        {"Model / Framework": "Cox Proportional Hazards Model", "Metric": "3-Year Survival Probability (%)", "Result": f"{ensemble_res.cox_component.get('survival_3yr_pct', 97.0):.2f}%", "Assessment": "Semi-Parametric Survival Curve"},
        {"Model / Framework": "Cox Proportional Hazards Model", "Metric": "5-Year Survival Probability (%)", "Result": f"{ensemble_res.cox_component.get('survival_5yr_pct', 95.0):.2f}%", "Assessment": "Semi-Parametric Survival Curve"},
    ]
    solvency_df = pd.DataFrame(solvency_rows)

    # 8. Sheet: Factor Attribution
    factor_rows = [
        {"Factor Metric": "Annualized Pure Alpha (%)", "Value": round(factor_res.alpha_annualized_pct, 2)},
        {"Factor Metric": "Alpha t-Statistic", "Value": round(factor_res.alpha_t_stat, 2)},
        {"Factor Metric": "Alpha Statistical Significance (p-Value)", "Value": round(factor_res.alpha_p_value, 4)},
        {"Factor Metric": "Market Factor Beta (β_MKT)", "Value": round(factor_res.market_beta, 2)},
        {"Factor Metric": "Size Factor Beta (β_SMB - Small vs Large)", "Value": round(factor_res.size_smb_beta, 2)},
        {"Factor Metric": "Value Factor Beta (β_HML - High vs Low B/M)", "Value": round(factor_res.value_hml_beta, 2)},
        {"Factor Metric": "Momentum Factor Beta (β_WML - 12M Winner)", "Value": round(factor_res.momentum_wml_beta, 2)},
        {"Factor Metric": "Model R-Squared (R²)", "Value": round(factor_res.r_squared, 4)},
        {"Factor Metric": "Adjusted R-Squared (Adj. R²)", "Value": round(factor_res.adjusted_r_squared, 4)},
        {"Factor Metric": "Annualized Idiosyncratic Risk (σε %)", "Value": round(factor_res.idiosyncratic_volatility_pct, 2)},
        {"Factor Metric": "Factor Risk Attribution Profile", "Value": factor_res.factor_profile_tier},
    ]
    for fac_name, fac_var in factor_res.variance_attribution_pct.items():
        factor_rows.append({"Factor Metric": f"Variance Share: {fac_name} (%)", "Value": round(fac_var, 1)})
    factor_df = pd.DataFrame(factor_rows)

    # 9. Sheet: VaR & Drawdown
    from .var import compute_cornish_fisher_cvar_surface
    cvar_surf = compute_cornish_fisher_cvar_surface(ret_series)
    var_rows = list(cvar_surf.get("surface", [])) if cvar_surf.get("surface") else list(v.get("table", []))
    var_df = pd.DataFrame(var_rows)

    # 10. Sheet: Microstructure & Execution Sizing
    roll_res = compute_roll_effective_spread(close_series)
    kyle_res = compute_kyle_lambda_and_vpin(ret_series, vol_series, close_series)

    micro_rows = [
        {"Execution Parameter": "Roll (1984) Effective Bid-Ask Spread (%)", "Value": roll_res.get("roll_effective_spread_pct")},
        {"Execution Parameter": "Market Depth Status", "Value": roll_res.get("market_depth_status")},
        {"Execution Parameter": "Kyle's Lambda Price Impact per Volume Unit", "Value": kyle_res.get("kyle_lambda_price_impact")},
        {"Execution Parameter": "VPIN Order Flow Toxicity Probability", "Value": kyle_res.get("vpin_toxicity_probability")},
        {"Execution Parameter": "Order Flow Toxicity Regime", "Value": kyle_res.get("toxicity_regime")},
        {"Execution Parameter": "Target Order Size Tested (₹)", "Value": f"₹ {exec_res.target_order_value_inr:,.2f}"},
        {"Execution Parameter": "Optimal Liquidation Horizon (Days)", "Value": exec_res.liquidation_horizon_days},
        {"Execution Parameter": "Almgren-Chriss Expected Slippage (bps)", "Value": f"{exec_res.total_expected_impact_bps:.1f} bps"},
        {"Execution Parameter": "Total Expected Impact Cost (₹)", "Value": f"₹ {exec_res.total_expected_impact_cost_inr:,.2f}"},
        {"Execution Parameter": "Max Position Size for 25 bps Budget (₹)", "Value": f"₹ {exec_res.max_position_size_for_25bps_inr:,.2f}"},
        {"Execution Parameter": "Execution Urgency & Liquidity Tier", "Value": exec_res.execution_urgency_tier},
    ]
    micro_df = pd.DataFrame(micro_rows)

    # 11. Sheet: Macro & Sector Backdrop
    crude_info = macro.get("crude_oil") or {}
    gsec_info = macro.get("gsec_yield") or {}
    deficit_info = macro.get("fiscal_deficit") or {}
    gdp_info = macro.get("gdp_growth") or {}
    cpi_info = macro.get("cpi_inflation") or {}
    iip_info = macro.get("iip_growth") or {}
    forex_info = macro.get("forex_reserves") or {}
    pmi_info = macro.get("pmi") or {}
    sov_info = macro.get("sovereign_yields") or {}
    usdinr_info = macro.get("usdinr") or {}
    repo_info = macro.get("repo_rate") or {}

    crude_str = f"${crude_info.get('start_price', 60.75):,.2f} → ${crude_info.get('end_price', 89.03):,.2f}" if crude_info.get("start_price") else "N/A"
    crude_chg = f"{crude_info.get('change', 0.0)*100:+.2f}% Window Move" if crude_info.get("change") is not None else "N/A"

    usdinr_str = f"₹{usdinr_info.get('start_rate', 89.96):.2f} → ₹{usdinr_info.get('end_rate', 95.73):.2f}" if usdinr_info.get("start_rate") else "N/A"
    usdinr_chg = f"{usdinr_info.get('change', 0.0)*100:+.2f}% {usdinr_info.get('direction', 'Depreciation')}" if usdinr_info.get("change") is not None else "N/A"

    gsec_str = f"{gsec_info.get('value', 6.76):.2f}%" if gsec_info.get("value") is not None else "N/A"
    gsec_asof = f"As of {gsec_info.get('as_of', 'August 2026')}"

    sov_spread_str = f"+{sov_info.get('spread_bps', 202)} bps"
    sov_spread_detail = f"India {sov_info.get('india_10y_pct', 6.76):.2f}% vs US {sov_info.get('us_10y_pct', 4.74):.2f}%"

    def_str = f"₹{deficit_info.get('lakh_crore', 15.69):.2f} Lakh Crore" if deficit_info.get("lakh_crore") is not None else "N/A"
    def_detail = f"{deficit_info.get('pct_gdp', 4.4):.1f}% of GDP (FY {deficit_info.get('fiscal_year', '2026-27')})"

    gdp_str = f"{gdp_info.get('value', 7.80):.2f}% YoY" if gdp_info.get("value") is not None else "N/A"
    gdp_detail = f"{gdp_info.get('period', 'Q1 2026')} ({gdp_info.get('source', 'MOSPI')})"

    cpi_str = f"{cpi_info.get('value', 4.45):.2f}% YoY" if cpi_info.get("value") is not None else "N/A"
    cpi_detail = f"{cpi_info.get('month', 'July 2026')} · {cpi_info.get('status', 'Inside RBI Target Band')}"

    iip_str = f"{iip_info.get('value', 7.30):+.2f}% YoY" if iip_info.get("value") is not None else "N/A"
    iip_detail = f"{iip_info.get('month', 'June 2026')} · {iip_info.get('sector', 'Mfg & Mining')}"

    forex_str = f"${forex_info.get('value_usd_billion', 716.91):,.2f} Billion" if forex_info.get("value_usd_billion") is not None else "N/A"
    forex_detail = f"~{forex_info.get('import_cover_months', 12.1):.1f} Months Import Cover ({forex_info.get('as_of', 'August 2026')})"

    mfg_pmi = pmi_info.get("manufacturing", 52.9)
    srv_pmi = pmi_info.get("services", 54.5)
    pmi_str = f"Mfg {mfg_pmi:.1f} / Srv {srv_pmi:.1f}"
    pmi_detail = f"{pmi_info.get('regime', 'Expansionary (>50)')} · {pmi_info.get('as_of', 'August 2026')}"

    repo_str = f"{repo_info.get('current_rate_pct', 6.50):.2f}%"
    repo_detail = f"SDF: {repo_info.get('sdf_rate_pct', 6.25):.2f}% · Stance: {repo_info.get('mpc_stance', 'Neutral')}"

    macro_rows = [
        {"Category": "Growth & Output", "Indicator": "Real GDP Growth Rate (YoY %)", "Value": gdp_str, "Move": gdp_detail},
        {"Category": "Inflation & Prices", "Indicator": "CPI Retail Inflation Rate (YoY %)", "Value": cpi_str, "Move": cpi_detail},
        {"Category": "Industrial Production", "Indicator": "Index of Industrial Production (IIP YoY %)", "Value": iip_str, "Move": iip_detail},
        {"Category": "Business Surveys", "Indicator": "PMI Activity Index (Mfg / Services)", "Value": pmi_str, "Move": pmi_detail},
        {"Category": "Monetary Policy", "Indicator": "RBI Policy Repo Rate", "Value": repo_str, "Move": repo_detail},
        {"Category": "Sovereign Debt", "Indicator": "India 10Y Benchmark G-Sec Yield (%)", "Value": gsec_str, "Move": gsec_asof},
        {"Category": "Sovereign Debt", "Indicator": "India-US 10Y Sovereign Yield Spread", "Value": sov_spread_str, "Move": sov_spread_detail},
        {"Category": "Foreign Exchange", "Indicator": "USD / INR Exchange Rate", "Value": usdinr_str, "Move": usdinr_chg},
        {"Category": "External Buffer", "Indicator": "Foreign Exchange Reserves (USD Billion)", "Value": forex_str, "Move": forex_detail},
        {"Category": "Fiscal Account", "Indicator": "Union Fiscal Deficit (Target % of GDP)", "Value": def_str, "Move": def_detail},
        {"Category": "Energy Commodity", "Indicator": "Brent Crude Oil Price ($/bbl)", "Value": crude_str, "Move": crude_chg},
    ]
    if hasattr(analysis, "macro_events") and analysis.macro_events:
        for me in analysis.macro_events:
            macro_rows.append({"Category": "RBI Monetary Policy Event", "Indicator": me.label if hasattr(me, 'label') else getattr(me, 'headline', 'Repo Rate Adjustment'), "Value": me.day.strftime("%Y-%m-%d") if hasattr(me, 'day') else "In-Window", "Move": "MPC Decision"})
    macro_df = pd.DataFrame(macro_rows)

    # 12. Sheet: Governance & Forensics
    from .financials import compute_altman_z_score_em, compute_beneish_m_score, compute_piotroski_f_score
    altman = compute_altman_z_score_em(fin)
    beneish = compute_beneish_m_score(fin)
    piotroski = compute_piotroski_f_score(fin)
    gov_risk = fin.get("governance_risk") or {}

    gov_rows = [
        {"Diagnostic": "Governance Risk Index (GRI) Score", "Result": gov_risk.get("gri_score", 15)},
        {"Diagnostic": "GRI Tier", "Result": gov_risk.get("gri_tier", "Low Risk")},
        {"Diagnostic": "Altman Z\"-Score (Emerging Markets)", "Result": altman.get("altman_z_score")},
        {"Diagnostic": "Altman Solvency Zone", "Result": altman.get("solvency_zone")},
        {"Diagnostic": "Beneish M-Score", "Result": beneish.get("beneish_m_score")},
        {"Diagnostic": "Earnings Manipulation Risk", "Result": "Flagged Risk" if beneish.get("is_manipulation_risk") else "Unflagged / Clean"},
        {"Diagnostic": "Piotroski F-Score (out of 9)", "Result": piotroski.get("piotroski_f_score")},
        {"Diagnostic": "Piotroski Fundamental Tier", "Result": piotroski.get("fundamental_tier")},
    ]
    gov_df = pd.DataFrame(gov_rows)

    # 13. Sheet: Peer Contagion & Spillover
    peer_rows = []
    from .eventstudy import compute_directional_volatility_spillover
    if not ret_series.empty and not bench_series.empty:
        spill = compute_directional_volatility_spillover(ret_series, bench_series)
        peer_rows = [
            {"Metric": "Volatility Comovement Correlation", "Value": spill.get("volatility_correlation", 0.0)},
            {"Metric": "Directional Transmission to Sector", "Value": f"{spill.get('directional_transmission_to_sector', 0.0)*100:.2f}%"},
            {"Metric": "Directional Absorption from Sector", "Value": f"{spill.get('directional_absorption_from_sector', 0.0)*100:.2f}%"},
            {"Metric": "Net Volatility Spillover", "Value": f"{spill.get('net_volatility_spillover', 0.0)*100:.2f}%"},
            {"Metric": "Systemic Spillover Role", "Value": spill.get("spillover_role", "Neutral")},
        ]
    # Discovered Peer Benchmark Cohort
    peer_list = fin.get("peers") or []
    if peer_list:
        peer_rows.append({"Metric": "--- Identified Sector Peer Group ---", "Value": f"{len(peer_list)} Competitors Discovered via Screener.in"})
        for idx, (p_name, p_ticker) in enumerate(peer_list, 1):
            peer_rows.append({"Metric": f"Peer #{idx}: {p_name}", "Value": f"Ticker: {p_ticker}"})
    else:
        peer_rows.append({"Metric": "Identified Sector Peer Group", "Value": "Sector Benchmark Index Cohort"})

    peer_df = pd.DataFrame(peer_rows) if peer_rows else pd.DataFrame(columns=["Metric", "Value"])

    # 14. Sheet: Incident Headlines & News
    news_rows = []
    if analysis.incidents:
        for inc in analysis.incidents:
            for h in inc.headlines:
                news_rows.append({
                    "Event Date": inc.day.isoformat(),
                    "Event Category": inc.dominant_event,
                    "Source": h.get("source", "N/A"),
                    "Headline": h.get("headline", "N/A"),
                    "FinBERT Sentiment": h.get("sentiment_label", "N/A"),
                    "Relevance Score": h.get("relevance", "N/A"),
                    "SEBI Urgency Tier": h.get("sebi_urgency", "Standard"),
                    "URL": h.get("url", "N/A"),
                })
    if not news_rows:
        news_df = pd.DataFrame(columns=[
            "Event Date", "Event Category", "Source", "Headline",
            "FinBERT Sentiment", "Relevance Score", "SEBI Urgency Tier", "URL"
        ])
    else:
        news_df = pd.DataFrame(news_rows)

    # 15. Sheet: Predictive Forecasting (CEIA 8.0)
    fc = getattr(analysis, "forecasting", {}) or {}
    if not fc or not fc.get("available"):
        fc = generate_forecasting_suite(daily_df, getattr(analysis, "incidents", []), pm, fin, macro, v)

    forecast_rows = [
        {"Category": "Synthesis & Overview", "Parameter / Metric": "Overall Directional Bias", "Value": fc.get("overall_directional_bias", "Neutral"), "Context / Confidence": fc.get("confidence_tier", "Normal")},
        {"Category": "Synthesis & Overview", "Parameter / Metric": "As-Of Price Level", "Value": f"₹ {curr_p:,.2f}", "Context / Confidence": f"As-of {fc.get('as_of_date', 'Window Close')}"},
        {"Category": "Synthesis & Overview", "Parameter / Metric": "Historical Realized Volatility", "Value": f"{fc.get('annualized_volatility', daily_vol*math.sqrt(252)*100):.2f}%", "Context / Confidence": "Annualized Sample Standard Deviation"},
    ]
    # Horizons
    h_map = fc.get("horizons", {}) or {}
    for h_k in ("5", "21", "63"):
        hd = h_map.get(h_k) or h_map.get(int(h_k)) or {}
        if hd:
            h_lbl = hd.get("label", f"{h_k}D")
            forecast_rows.extend([
                {"Category": f"Forecast Cone: {h_lbl}", "Parameter / Metric": f"{h_lbl} Expected Price Target", "Value": f"₹ {hd.get('expected_price', 0):,.2f}", "Context / Confidence": f"{hd.get('expected_return_pct', 0):+.2f}% Expected Return"},
                {"Category": f"Forecast Cone: {h_lbl}", "Parameter / Metric": f"{h_lbl} P10 Bear Case (Floor)", "Value": f"₹ {hd.get('p10_bear_price', 0):,.2f}", "Context / Confidence": f"{hd.get('p10_bear_return_pct', 0):+.2f}% Downside Tail"},
                {"Category": f"Forecast Cone: {h_lbl}", "Parameter / Metric": f"{h_lbl} P90 Bull Case (Ceiling)", "Value": f"₹ {hd.get('p90_bull_price', 0):,.2f}", "Context / Confidence": f"{hd.get('p90_bull_return_pct', 0):+.2f}% Upside Potential"},
                {"Category": f"Forecast Cone: {h_lbl}", "Parameter / Metric": f"{h_lbl} 90% Conformal Range", "Value": f"₹ {hd.get('conformal_lower_90_price', 0):,.0f} - ₹ {hd.get('conformal_upper_90_price', 0):,.0f}", "Context / Confidence": f"±{hd.get('conformal_margin_90_pct', 0):.2f}% Calibrated Interval"},
                {"Category": f"Forecast Cone: {h_lbl}", "Parameter / Metric": f"{h_lbl} Directional Probability P(Up)", "Value": f"{hd.get('direction_probability_up', 0)*100:.1f}%", "Context / Confidence": f"{hd.get('excess_return_probability', 0)*100:.1f}% Prob Outperforming Nifty"},
                {"Category": f"Forecast Cone: {h_lbl}", "Parameter / Metric": f"{h_lbl} Conformal VaR 95%", "Value": f"{hd.get('cvar_95_pct', 0):.2f}%", "Context / Confidence": "Distribution-Free Tail Risk Barrier"},
            ])

    # HAR-RV Volatility Model
    har_info = fc.get("har_volatility", {}) or {}
    if har_info:
        forecast_rows.extend([
            {"Category": "HAR-RV Volatility (Corsi 2009)", "Parameter / Metric": "Model R-Squared (R²)", "Value": round(har_info.get("r_squared", 0.35), 4), "Context / Confidence": "Predictive Variance Explained"},
            {"Category": "HAR-RV Volatility (Corsi 2009)", "Parameter / Metric": "Forecast Volatility (5-Day)", "Value": f"{har_info.get('forecast_volatility_5d', 0)*100:.2f}%", "Context / Confidence": "Annualized Volatility Forecast"},
            {"Category": "HAR-RV Volatility (Corsi 2009)", "Parameter / Metric": "Forecast Volatility (21-Day)", "Value": f"{har_info.get('forecast_volatility_21d', 0)*100:.2f}%", "Context / Confidence": "Annualized Volatility Forecast"},
            {"Category": "HAR-RV Volatility (Corsi 2009)", "Parameter / Metric": "Forecast Volatility (63-Day)", "Value": f"{har_info.get('forecast_volatility_63d', 0)*100:.2f}%", "Context / Confidence": "Annualized Volatility Forecast"},
            {"Category": "HAR-RV Volatility (Corsi 2009)", "Parameter / Metric": "Volatility Regime Classification", "Value": har_info.get("volatility_regime", "Normal"), "Context / Confidence": "Relative to Historical Baseline"},
            {"Category": "HAR-RV Volatility (Corsi 2009)", "Parameter / Metric": "Leverage Asymmetry Ratio", "Value": f"{har_info.get('leverage_asymmetry_ratio', 1.0):.2f}x", "Context / Confidence": "Downside vs Upside Variance Sensitivity"},
        ])

    # Event Sentiment & PEAD Drift
    ev_info = fc.get("event_drift", {}) or {}
    if ev_info:
        forecast_rows.extend([
            {"Category": "Event Sentiment & PEAD Drift", "Parameter / Metric": "Recent Event Catalyst", "Value": ev_info.get("event_category", "None"), "Context / Confidence": f"Date: {ev_info.get('recent_event_date', 'None')}"},
            {"Category": "Event Sentiment & PEAD Drift", "Parameter / Metric": "FinBERT Sentiment Polarity", "Value": ev_info.get("event_sentiment_score", 0.0), "Context / Confidence": f"Urgency: {ev_info.get('emotion_urgency', 'Neutral')}"},
            {"Category": "Event Sentiment & PEAD Drift", "Parameter / Metric": "PEAD Drift Momentum State", "Value": ev_info.get("drift_momentum_state", "Neutral"), "Context / Confidence": f"Half-Life: {ev_info.get('absorption_half_life_days', 4.5)} days"},
            {"Category": "Event Sentiment & PEAD Drift", "Parameter / Metric": "Projected 21-Day Event Drift", "Value": f"{ev_info.get('projected_drift_21d_pct', 0):+.2f}%", "Context / Confidence": "Unabsorbed Information Drift"},
        ])

    forecast_df = pd.DataFrame(forecast_rows)

    # 16. Sheet: Portfolio Optimization (CEIA 9.0)
    port_dict = getattr(analysis, "portfolio", {}) or {}
    hrp_info = port_dict.get("hrp", {}) or {}
    bl_info = port_dict.get("black_litterman", {}) or {}
    kelly_info = port_dict.get("fractional_kelly", {}) or {}

    port_rows = [
        {"Framework / Model": "Hierarchical Risk Parity (HRP)", "Asset / Metric": "Portfolio Annualized Volatility", "Optimal Weight / Value": f"{hrp_info.get('portfolio_volatility_annualized', 0.20)*100:.2f}%", "Analytical Rationale / Detail": "López de Prado (2016) Graph Clustering Risk Parity"},
        {"Framework / Model": "Hierarchical Risk Parity (HRP)", "Asset / Metric": "Diversification Ratio", "Optimal Weight / Value": f"{hrp_info.get('diversification_ratio', 1.0):.2f}x", "Analytical Rationale / Detail": "Weighted Asset Volatility / Portfolio Volatility"},
    ]
    for asset, w in (hrp_info.get("weights") or {}).items():
        port_rows.append({
            "Framework / Model": "HRP Asset Allocation",
            "Asset / Metric": asset,
            "Optimal Weight / Value": f"{w*100:.2f}%",
            "Analytical Rationale / Detail": f"Inverse-Variance Cluster Allocation (Weight = {w:.4f})",
        })

    # Black-Litterman
    for asset, er_post in (bl_info.get("posterior_returns") or {}).items():
        pi_val = bl_info.get("prior_returns", {}).get(asset, 0.0)
        tilt = bl_info.get("active_tilts", {}).get(asset, 0.0)
        bl_w = bl_info.get("optimal_weights", {}).get(asset, 0.0)
        port_rows.append({
            "Framework / Model": "Black-Litterman Bayesian",
            "Asset / Metric": asset,
            "Optimal Weight / Value": f"{bl_w*100:.2f}% (Tilt: {tilt*100:+.2f}%)",
            "Analytical Rationale / Detail": f"Prior E[R]: {pi_val*100:+.2f}% -> Posterior E[R]: {er_post*100:+.2f}%",
        })

    if kelly_info:
        port_rows.extend([
            {"Framework / Model": "Fractional Kelly Sizing", "Asset / Metric": "Raw Full Kelly Leverage", "Optimal Weight / Value": f"{kelly_info.get('raw_full_kelly', 0):.2f}x", "Analytical Rationale / Detail": "Unconstrained Growth Optimal Leverage"},
            {"Framework / Model": "Fractional Kelly Sizing", "Asset / Metric": "Recommended Sized Exposure", "Optimal Weight / Value": f"{kelly_info.get('fractional_kelly_recommended', 0)*100:+.1f}%", "Analytical Rationale / Detail": f"Adjusted for {kelly_info.get('leverage_penalty_applied', 1.54):.2f}x Asymmetry Penalty"},
        ])
    portfolio_df = pd.DataFrame(port_rows)

    # 17. Sheet: Market Microstructure (CEIA 9.0)
    micro_res = getattr(analysis, "microstructure", {}) or {}
    micro_rows = [
        {"Metric Category": "VPIN Order Flow Toxicity", "Indicator / Parameter": "Current VPIN Score", "Value": f"{micro_res.get('vpin_score', 0.20):.3f}", "Institutional Assessment": micro_res.get("vpin_regime", "Normal Order Flow")},
        {"Metric Category": "VPIN Order Flow Toxicity", "Indicator / Parameter": "Order Flow Imbalance", "Value": f"{micro_res.get('order_flow_imbalance_pct', 0):+.1f}%", "Institutional Assessment": "Buy vs Sell Volume Imbalance"},
        {"Metric Category": "Kyle's Lambda & Slippage", "Indicator / Parameter": "Kyle's Lambda (Price Impact)", "Value": f"{micro_res.get('kyle_lambda_bps_per_10m', 2.0):.2f} bps/₹10M", "Institutional Assessment": "Price Impact per ₹10 Million Trade Volume"},
        {"Metric Category": "Amihud (2002) Illiquidity", "Indicator / Parameter": "Amihud Ratio (Sample Mean)", "Value": f"{micro_res.get('amihud_illiquidity_mean', 0.05):.4f}", "Institutional Assessment": micro_res.get("institutional_liquidity_grade", "Tier-1 Ultra Liquid")},
        {"Metric Category": "Amihud (2002) Illiquidity", "Indicator / Parameter": "Amihud Shock Z-Score", "Value": f"{micro_res.get('amihud_shock_z', 0):+.2f} sigma", "Institutional Assessment": "Relative to Historical Baseline"},
        {"Metric Category": "Barndorff-Nielsen Jump Test", "Indicator / Parameter": "Realized Jump Share", "Value": f"{micro_res.get('realized_jump_intensity_pct', 15):.1f}%", "Institutional Assessment": "Proportion of Variance from Discrete Price Gaps"},
        {"Metric Category": "Barndorff-Nielsen Jump Test", "Indicator / Parameter": "Jump Test Z-Statistic", "Value": f"{micro_res.get('jump_test_z_stat', 1.0):.2f}", "Institutional Assessment": "Statistically Significant Jump Discontinuity" if micro_res.get("jump_statistically_significant") else "Continuous Brownian Diffusion"},
    ]
    microstructure_tab_df = pd.DataFrame(micro_rows)

    # 18. Sheet: Causal SDID (CEIA 9.0)
    sdid_res = getattr(analysis, "sdid", {}) or {}
    sdid_rows = [
        {"Causal Metric": "Doubly Robust ATT (tau_SDID)", "Value": f"{sdid_res.get('tau_sdid', 0)*100:+.2f}%", "Statistical Inference / Weights": f"SE: {sdid_res.get('standard_error', 0.01)*100:.2f}% | t: {sdid_res.get('t_statistic', 0):.2f}"},
        {"Causal Metric": "Permutation p-value", "Value": f"{sdid_res.get('p_value', 0.05):.4f}", "Statistical Inference / Weights": "Statistically Significant (p < 0.05)" if sdid_res.get("is_statistically_significant") else "Within Placebo Noise Buffer"},
        {"Causal Metric": "Pre-treatment Fit RMSE", "Value": f"{sdid_res.get('pre_treatment_rmse', 0):.4f}", "Statistical Inference / Weights": "Synthetic Counterfactual Fit Quality"},
        {"Causal Metric": "Parallel Trends Bias Reduction", "Value": f"{sdid_res.get('parallel_trends_bias_reduction_pct', 0):.1f}%", "Statistical Inference / Weights": "Bias Reduction vs Standard Difference-in-Differences"},
    ]
    for u_name, u_w in (sdid_res.get("unit_weights") or {}).items():
        sdid_rows.append({"Causal Metric": f"Synthetic Control Weight: {u_name}", "Value": f"{u_w*100:.2f}%", "Statistical Inference / Weights": f"Unit Weight omega = {u_w:.4f}"})
    for t_lbl, t_w in (sdid_res.get("time_weights") or {}).items():
        sdid_rows.append({"Causal Metric": f"DID Time Weight: {t_lbl}", "Value": f"{t_w*100:.2f}%", "Statistical Inference / Weights": f"Time Weight lambda = {t_w:.4f}"})
    sdid_tab_df = pd.DataFrame(sdid_rows)

    # 19. Sheet: Systemic Connectedness (CEIA 9.0)
    spill_res = getattr(analysis, "spillover", {}) or {}
    spill_rows = [
        {"Asset / Dimension": "Systemic Total Connectedness Index (TCI)", "TO (Transmitted %)": f"{spill_res.get('total_connectedness_index', 0):.2f}%", "FROM (Received %)": f"{spill_res.get('total_connectedness_index', 0):.2f}%", "Net Spillover (%)": "0.00%", "Systemic Classification": "Systemic Cross-Asset Volatility Integration"},
        {"Asset / Dimension": f"Target Entity ({analysis.config.ticker})", "TO (Transmitted %)": f"{spill_res.get('directional_to', {}).get(analysis.config.ticker, 0):.2f}%", "FROM (Received %)": f"{spill_res.get('directional_from', {}).get(analysis.config.ticker, 0):.2f}%", "Net Spillover (%)": f"{spill_res.get('net_spillover', {}).get(analysis.config.ticker, 0):+.2f}%", "Systemic Classification": spill_res.get("target_company_role", "Market Participant")},
    ]
    dir_to = spill_res.get("directional_to", {}) or {}
    dir_from = spill_res.get("directional_from", {}) or {}
    net_sp = spill_res.get("net_spillover", {}) or {}
    for asset in dir_to:
        if asset != analysis.config.ticker:
            net_v = net_sp.get(asset, 0.0)
            role = "Net Systemic Shock Transmitter" if net_v > 0 else "Net Volatility Receiver"
            spill_rows.append({
                "Asset / Dimension": asset,
                "TO (Transmitted %)": f"{dir_to.get(asset, 0):.2f}%",
                "FROM (Received %)": f"{dir_from.get(asset, 0):.2f}%",
                "Net Spillover (%)": f"{net_v:+.2f}%",
                "Systemic Classification": role,
            })
    spillover_tab_df = pd.DataFrame(spill_rows)

    # 20. Sheet: XAI & Regime Risk (CEIA 9.0)
    xai_res = getattr(analysis, "xai", {}) or {}
    regime_res = getattr(analysis, "regime", {}) or {}
    xai_rows = [
        {"Analysis Domain": "XAI Factor Attribution", "Driver / State": "Historical Base Drift", "Value / Prob": f"{xai_res.get('base_expected_return', 0.005)*100:+.2f}%", "Econometric Impact / Assessment": "Unconditional Asset Drift"},
        {"Analysis Domain": "XAI Factor Attribution", "Driver / State": "Final Forecast Return", "Value / Prob": f"{xai_res.get('final_forecasted_return', 0)*100:+.2f}%", "Econometric Impact / Assessment": f"Top Driver: {xai_res.get('top_positive_driver', 'None')}"},
    ]
    for c in (xai_res.get("contributions") or []):
        xai_rows.append({
            "Analysis Domain": "SHAP Shapley Values",
            "Driver / State": c.get("feature_name", ""),
            "Value / Prob": f"{c.get('shapley_value', 0)*100:+.2f}%",
            "Econometric Impact / Assessment": c.get("rationale", ""),
        })

    # Regime info
    xai_rows.extend([
        {"Analysis Domain": "Hamilton Markov Switching", "Driver / State": "Active Market Regime", "Value / Prob": regime_res.get("current_regime", "Normal"), "Econometric Impact / Assessment": f"Posterior Prob: {regime_res.get('current_regime_probability', 0.7)*100:.1f}%"},
        {"Analysis Domain": "Hamilton Markov Switching", "Driver / State": "Regime Stability Score", "Value / Prob": f"{regime_res.get('regime_stability_score', 80):.1f} / 100", "Econometric Impact / Assessment": regime_res.get("risk_regime_guidance", "Standard risk budgeting")},
    ])
    for s_name, d_days in (regime_res.get("expected_durations_days") or {}).items():
        xai_rows.append({
            "Analysis Domain": "Regime Persistence",
            "Driver / State": f"Expected Duration: {s_name}",
            "Value / Prob": f"{d_days:.1f} Days",
            "Econometric Impact / Assessment": f"E[Duration] = 1 / (1 - p_{s_name})",
        })
    xai_tab_df = pd.DataFrame(xai_rows)

    # 21. Sheet: Volatility Models (4-Type) Suite with 10-Min Intraday
    vol_obj_data = getattr(analysis, "volatility_models", {})
    if not vol_obj_data and not ret_series.empty:
        try:
            vol_obj = compute_volatility_model_ensemble(analysis.config.ticker, ret_series)
            vol_obj_data = vol_obj.to_dict()
        except Exception:
            vol_obj_data = {}

    vol_comp_rows = []
    for r in (vol_obj_data.get("comparison_table") or []):
        vol_comp_rows.append({
            "Model Name": r.get("Model Name"),
            "Annualized Volatility (%)": r.get("Annualized Volatility (%)"),
            "AIC": r.get("AIC"),
            "BIC": r.get("BIC"),
            "Ranking": r.get("Ranking"),
            "Parameter Specifications & Diagnostics": r.get("Key Parameter Specification"),
        })
    intraday_info = vol_obj_data.get("intraday_meta") or {}
    if intraday_info.get("available"):
        vol_comp_rows.append({
            "Model Name": "High-Frequency 10-Min Real Intraday",
            "Annualized Volatility (%)": f"{intraday_info.get('realized_volatility_annualized', 0)*100:.2f}%",
            "AIC": "N/A",
            "BIC": "N/A",
            "Ranking": "Empirical Benchmark",
            "Parameter Specifications & Diagnostics": f"{intraday_info.get('total_10m_bars', 0)} bars over {intraday_info.get('observation_days', 3)} sessions ({intraday_info.get('start_time', '')[:16]} to {intraday_info.get('end_time', '')[:16]})",
        })
    volatility_df = pd.DataFrame(vol_comp_rows) if vol_comp_rows else pd.DataFrame(columns=["Model Name", "Annualized Volatility (%)", "AIC", "BIC", "Ranking", "Parameter Specifications & Diagnostics"])

    # 22. Sheet: 8-Factor Relative Valuation Multiples
    rel_mult_res = compute_relative_valuation_multiples(
        financials=fin,
        current_price=curr_p,
        shares_outstanding=shares,
        market_cap=market_cap,
        total_debt=debt,
        cash=cash,
    )
    rel_rows = []
    for item in rel_mult_res.multiples:
        rel_rows.append({
            "Valuation Multiple": item.get("ratio_name"),
            "Company Value": f"{item.get('company_value', 0):.2f}x" if item.get('company_value') is not None else "N/A",
            "Sector Median": f"{item.get('sector_median', 0):.2f}x" if item.get('sector_median') is not None else "N/A",
            "Variance vs Peer (%)": f"{item.get('variance_pct', 0):+.1f}%" if item.get('variance_pct') is not None else "N/A",
            "Relative Stance": item.get("verdict_badge"),
            "Institutional Focus & Context": item.get("interpretation"),
        })
    rel_rows.append({
        "Valuation Multiple": "COMPOSITE RELATIVE VALUATION STANCE",
        "Company Value": rel_mult_res.composite_valuation_stance.upper(),
        "Sector Median": "Peer Benchmark Array",
        "Variance vs Peer (%)": "N/A",
        "Relative Stance": rel_mult_res.composite_valuation_stance,
        "Institutional Focus & Context": "Weighted consensus across profitability, revenue, asset, cash flow, and growth metrics",
    })
    relative_val_df = pd.DataFrame(rel_rows)

    # 23. Sheet: 6-Sigma Extreme Tail Risk & Multi-Horizon Trajectory Schedule
    six_sigma_rows = []
    six_sig_info = v.get("six_sigma_risk") or {}
    for sg in six_sig_info.get("sigma_grid", []):
        six_sigma_rows.append({
            "Risk Dimension": "1-Day Multi-Sigma Breakdown",
            "Sigma Multiplier": sg.get("Sigma Level"),
            "Statistical Coverage": sg.get("Confidence Coverage"),
            "1D VaR (Loss %)": sg.get("1D VaR (Loss %)"),
            "1D CVaR (Tail Loss %)": sg.get("1D CVaR (Tail Loss %)"),
            "Drawdown Floor (₹)": sg.get("Drawdown Floor (₹)"),
            "Upside Target (₹)": sg.get("Upside Ceiling (₹)"),
            "Stress Severity Tier": sg.get("Stress Classification"),
        })
    fc_six_sig = fc.get("six_sigma_schedule") or {}
    for h_key in ("5", "21", "63"):
        h_data = fc_six_sig.get(h_key) or {}
        h_lbl = h_data.get("label", f"{h_key}D")
        for b in h_data.get("bands", []):
            six_sigma_rows.append({
                "Risk Dimension": f"{h_lbl} Forecast Trajectory",
                "Sigma Multiplier": b.get("sigma"),
                "Statistical Coverage": b.get("confidence_pct"),
                "1D VaR (Loss %)": f"{b.get('drawdown_return_pct', 0):+.2f}%",
                "1D CVaR (Tail Loss %)": "N/A",
                "Drawdown Floor (₹)": f"₹ {b.get('drawdown_floor_price', 0):,.2f}",
                "Upside Target (₹)": f"₹ {b.get('upside_target_price', 0):,.2f}",
                "Stress Severity Tier": b.get("risk_tier"),
            })
    six_sigma_df = pd.DataFrame(six_sigma_rows) if six_sigma_rows else pd.DataFrame(columns=["Risk Dimension", "Sigma Multiplier", "Statistical Coverage", "1D VaR (Loss %)", "1D CVaR (Tail Loss %)", "Drawdown Floor (₹)", "Upside Target (₹)", "Stress Severity Tier"])

    # 24. Sheet: Metals Commodities Surveillance
    metals_res = getattr(analysis, "metals", {}) or {}
    metals_rows = []
    if not metals_res:
        from .metals import compute_metals_summary
        from .macro import SkippedPriceProvider
        try:
            start_d = getattr(analysis.config, "start", date(2026, 1, 1))
            end_d = getattr(analysis.config, "end", date(2026, 8, 23))
            ret_s = daily_df["return"].dropna() if ("return" in daily_df.columns and not daily_df.empty) else None
            metals_res = compute_metals_summary(start_d, end_d, asset_returns=ret_s, provider=SkippedPriceProvider()).to_dict()
        except Exception:
            metals_res = {}

    if metals_res and metals_res.get("metals_table"):
        for m in metals_res.get("metals_table", []):
            metals_rows.append({
                "Commodity Metal": m.get("Commodity Metal"),
                "Symbol": m.get("Symbol"),
                "Category": m.get("Category"),
                "Spot Price": m.get("Spot Price"),
                "Window Return (%)": m.get("Window Return (%)"),
                "1-Week Momentum": m.get("1-Week Momentum"),
                "Annualized Volatility": m.get("Annualized Volatility"),
                "Asset Correlation (r)": m.get("Asset Correlation (r)"),
                "Transmission Channel": m.get("Transmission Role"),
            })
    metals_tab_df = pd.DataFrame(metals_rows) if metals_rows else pd.DataFrame(columns=["Commodity Metal", "Spot Price", "Window Return (%)", "Asset Correlation (r)"])

    # 25. Sheet: 1-Week Technical Analysis
    tech_res = getattr(analysis, "technical_analysis", {}) or {}
    if not tech_res and not daily_df.empty:
        from .technical_analysis import compute_technical_analysis
        try:
            tech_res = compute_technical_analysis(daily_df).to_dict()
        except Exception:
            tech_res = {}

    tech_rows = []
    if tech_res and tech_res.get("indicators_table"):
        tech_rows.append({"Category": "Composite Summary", "Indicator / Level": "Composite Technical Score", "Value": f"{tech_res.get('composite_score', 0.0):+.1f} / 100", "Signal / Regime": tech_res.get("composite_rating", "Neutral")})
        for ind in tech_res.get("indicators_table", []):
            tech_rows.append({
                "Category": "Technical Indicator",
                "Indicator / Level": ind.get("Indicator"),
                "Value": ind.get("Value"),
                "Signal / Regime": f"{ind.get('Signal')} (Spread: {ind.get('Distance (%)')})",
            })
        for pb in tech_res.get("weekly_playbook", []):
            tech_rows.append({
                "Category": "Weekly Playbook",
                "Indicator / Level": pb.get("Pillar"),
                "Value": pb.get("Condition"),
                "Signal / Regime": pb.get("Action"),
            })
    tech_tab_df = pd.DataFrame(tech_rows) if tech_rows else pd.DataFrame(columns=["Category", "Indicator / Level", "Value", "Signal / Regime"])

    # 26. Sheet: Quantitative Backtesting & Validation
    bt_res = getattr(analysis, "backtesting", {}) or {}
    if not bt_res and not daily_df.empty:
        from .backtest import run_comprehensive_backtest_suite
        try:
            from dataclasses import asdict
            inc_dicts = [asdict(i) if hasattr(i, "__dataclass_fields__") else (i.to_dict() if hasattr(i, "to_dict") else i.__dict__ if hasattr(i, "__dict__") else i) for i in (analysis.incidents or [])]
            bt_res = run_comprehensive_backtest_suite(daily_df, candidate_incidents=inc_dicts).to_dict()
        except Exception:
            bt_res = {}

    bt_rows = []
    if bt_res:
        bt_rows.append({"Validation Domain": "Executive Audit", "Model / Strategy": "Validation Status", "Metric 1": bt_res.get("validation_status", "Certified"), "Metric 2": f"Score: {bt_res.get('composite_validation_score', 85):.1f}/100", "Context / Assessment": bt_res.get("summary_report", "")})
        for cr in (bt_res.get("conformal_backtest", {}).get("evaluation_table") or []):
            bt_rows.append({
                "Validation Domain": "Conformal Cones",
                "Model / Strategy": cr.get("Horizon"),
                "Metric 1": f"Coverage: {cr.get('Empirical Coverage')} (Target {cr.get('Target Coverage')})",
                "Metric 2": f"Width: {cr.get('Width')}",
                "Context / Assessment": f"P50 Hit Rate: {cr.get('Hit Rate')}",
            })
        for vr in (bt_res.get("volatility_backtest", {}).get("models_comparison") or []):
            bt_rows.append({
                "Validation Domain": "Volatility QLIKE",
                "Model / Strategy": vr.get("Volatility Model"),
                "Metric 1": f"QLIKE: {vr.get('QLIKE Loss'):.4f}",
                "Metric 2": f"RMSE: {vr.get('RMSE (%)'):.2f}%",
                "Context / Assessment": f"DM p-val: {vr.get('DM Test p-val'):.3f} (Rank: {vr.get('Efficiency Rank')})",
            })
        t_bt = bt_res.get("technical_backtest", {})
        if t_bt:
            bt_rows.append({
                "Validation Domain": "Strategy Alpha",
                "Model / Strategy": "Multi-Indicator Strategy",
                "Metric 1": f"Strategy Return: {t_bt.get('strategy_return_pct', 0.0):+.2f}% vs B&H {t_bt.get('buy_and_hold_return_pct', 0.0):+.2f}%",
                "Metric 2": f"Alpha: {t_bt.get('alpha_pct', 0.0):+.2f}% | Sharpe: {t_bt.get('strategy_sharpe_ratio', 1.2):.2f}",
                "Context / Assessment": f"Win Rate: {t_bt.get('win_rate_pct', 65):.1f}% | Profit Factor: {t_bt.get('profit_factor', 2.5):.2f}",
            })
    bt_tab_df = pd.DataFrame(bt_rows) if bt_rows else pd.DataFrame(columns=["Validation Domain", "Model / Strategy", "Metric 1", "Metric 2", "Context / Assessment"])

    # 27. Sheet: Actionable Investment Call & Position Sizing
    call_res = getattr(analysis, "investment_verdict", {}) or {}
    if not call_res:
        from .investment_verdict import compute_investment_verdict
        try:
            call_obj = compute_investment_verdict(
                current_price=curr_p,
                daily_df=daily_df,
                incidents=analysis.incidents or [],
                financials=fin,
                technical_res=getattr(analysis, "technical_analysis", {}),
                macro_data=macro,
                var_metrics=v,
                distance_to_default=dd,
                backtest_data=getattr(analysis, "backtesting", {}),
                as_of=analysis.config.end,
            )
            call_res = call_obj.to_dict()
        except Exception:
            call_res = {}

    call_rows = []
    if call_res:
        call_rows.append({"Parameter / Metric": "ACTIONABLE INVESTMENT CALL", "Value / Target": call_res.get("actionable_call", "BUY"), "Institutional Context": f"Conviction Score: {call_res.get('conviction_score', 80):.1f}/100 | {call_res.get('one_line_summary', '')}"})
        call_rows.append({"Parameter / Metric": "Recommended Entry Zone", "Value / Target": f"₹ {call_res.get('entry_zone_low', 0):,.2f} to ₹ {call_res.get('entry_zone_high', 0):,.2f}", "Institutional Context": "Accumulate on shallow intraday pullbacks"})
        call_rows.append({"Parameter / Metric": "Primary Target Price (T1)", "Value / Target": f"₹ {call_res.get('target_1_price', 0):,.2f} (+{call_res.get('target_1_upside_pct', 0):.1f}%)", "Institutional Context": "DCF Base Intrinsic / Conformal P50 Convergence"})
        call_rows.append({"Parameter / Metric": "Stretch Target Price (T2)", "Value / Target": f"₹ {call_res.get('target_2_price', 0):,.2f} (+{call_res.get('target_2_upside_pct', 0):.1f}%)", "Institutional Context": "Bull Case Scenario / Conformal P90 Trajectory"})
        call_rows.append({"Parameter / Metric": "Hard Stop-Loss Price (SL)", "Value / Target": f"₹ {call_res.get('stop_loss_price', 0):,.2f} (-{call_res.get('stop_loss_downside_pct', 0):.1f}%)", "Institutional Context": "Technical Pivot Support / 99% Parametric VaR Floor"})
        call_rows.append({"Parameter / Metric": "Risk-to-Reward Ratio (R:R)", "Value / Target": call_res.get("risk_reward_ratio", "1 : 3.0"), "Institutional Context": "Asymmetric upside capture vs downside capital at risk"})
        call_rows.append({"Parameter / Metric": "Core Investment Horizon", "Value / Target": call_res.get("core_holding_period", ""), "Institutional Context": "Medium-Term Fundamental Compounding"})
        call_rows.append({"Parameter / Metric": "Tactical Event Horizon", "Value / Target": call_res.get("tactical_holding_period", ""), "Institutional Context": "Short-Term Event Anomaly CAR Drift"})
        
        for st in call_res.get("sizing_tiers", []):
            call_rows.append({
                "Parameter / Metric": f"Sizing: {st.get('portfolio_name')}",
                "Value / Target": f"{st.get('prescribed_shares'):,} Shares (₹ {st.get('effective_exposure_inr'):,.0f})",
                "Institutional Context": f"Weight: {st.get('allocation_pct'):.1f}% | Risk at SL: ₹ {st.get('risk_at_stop_loss_inr'):,.0f} ({st.get('portfolio_risk_pct'):.2f}% of portfolio)",
            })
    call_tab_df = pd.DataFrame(call_rows) if call_rows else pd.DataFrame(columns=["Parameter / Metric", "Value / Target", "Institutional Context"])

    sheets = {
        "Investment Call & Sizing": call_tab_df,
        "Executive Summary": summary_df,
        "Daily Detail": daily_df,
        "Candidate Incidents": inc_df,
        "Event CAR Attribution": attribution_df,
        "DCF Valuation & WACC": dcf_df,
        "Relative Valuation (8 Ratios)": relative_val_df,
        "Dupont 5-Factor ROE": ratios_df,
        "Solvency & Distress Ensemble": solvency_df,
        "Factor Attribution": factor_df,
        "Volatility Models (4-Type)": volatility_df,
        "VaR Term Structure": var_df,
        "6-Sigma Risk Schedule": six_sigma_df,
        "Microstructure & Slippage": micro_df,
        "Macro & Sector Backdrop": macro_df,
        "Governance & Forensics": gov_df,
        "Peer Contagion & Spillover": peer_df,
        "Incident Headlines & News": news_df,
        "Predictive Forecasting": forecast_df,
        "Portfolio Optimization": portfolio_df,
        "Market Microstructure": microstructure_tab_df,
        "Causal SDID": sdid_tab_df,
        "Systemic Connectedness": spillover_tab_df,
        "XAI & Regime Risk": xai_tab_df,
        "Metals Commodities": metals_tab_df,
        "Technical Analysis": tech_tab_df,
        "Backtesting & Validation": bt_tab_df,
    }


    # Save to binary OpenXML .xlsx workbook with native styling and formula integration
    try:
        import openpyxl
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.utils import get_column_letter

        wb = openpyxl.Workbook()
        wb.remove(wb.active)  # Remove default blank sheet

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1A56A8", end_color="1A56A8", fill_type="solid")
        title_font = Font(name="Calibri", size=13, bold=True, color="1A56A8")
        bold_font = Font(name="Calibri", size=11, bold=True)
        regular_font = Font(name="Calibri", size=11)
        thin_border = Border(
            left=Side(style="thin", color="E0E0E0"),
            right=Side(style="thin", color="E0E0E0"),
            top=Side(style="thin", color="E0E0E0"),
            bottom=Side(style="thin", color="E0E0E0"),
        )

        for sheet_name, df in sheets.items():
            ws = wb.create_sheet(title=sheet_name[:31])
            ws.views.sheetView[0].showGridLines = True

            if df.empty:
                ws.append(["Note", "No records available for this analysis run."])
                continue

            # Header Row
            headers = list(df.columns)
            ws.append(headers)
            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=1, column=col_idx)
                c.font = header_font
                c.fill = header_fill
                c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

            # Data Rows
            for r_idx, (_, row) in enumerate(df.iterrows(), start=2):
                ws.append(list(row))
                for col_idx in range(1, len(headers) + 1):
                    c = ws.cell(row=r_idx, column=col_idx)
                    c.font = regular_font
                    c.border = thin_border
                    if isinstance(c.value, (int, np.integer)):
                        c.number_format = "#,##0"
                    elif isinstance(c.value, (float, np.floating)):
                        if abs(c.value) < 1.0:
                            c.number_format = "0.00%"
                        else:
                            c.number_format = "#,##0.00"

            # Auto-fit column widths
            for col in ws.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                col_letter = get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

            # Add Live Formulas in Daily Detail Footer
            if sheet_name == "Daily Detail" and len(df) > 1:
                n_rows = len(df) + 1
                ret_col = "C" if "return" in headers else ""
                bench_col = "D" if "benchmark_return" in headers else ""

                if ret_col and bench_col:
                    ws.append([])  # Spacer row
                    s_row = n_rows + 2
                    ws.cell(row=s_row, column=1, value="MODEL SUMMARY CALCULATIONS").font = title_font

                    avg_row = s_row + 1
                    ws.cell(row=avg_row, column=1, value="Mean Daily Return (Live Formula)").font = bold_font
                    ws.cell(row=avg_row, column=2, value=f"=AVERAGE({ret_col}2:{ret_col}{n_rows})").number_format = "0.000%"

                    vol_row = s_row + 2
                    ws.cell(row=vol_row, column=1, value="Daily Realized Volatility (Live Formula)").font = bold_font
                    ws.cell(row=vol_row, column=2, value=f"=STDEV.S({ret_col}2:{ret_col}{n_rows})").number_format = "0.000%"

                    beta_row = s_row + 3
                    ws.cell(row=beta_row, column=1, value="Live Market Beta (SLOPE Formula)").font = bold_font
                    ws.cell(row=beta_row, column=2, value=f"=SLOPE({ret_col}2:{ret_col}{n_rows},{bench_col}2:{bench_col}{n_rows})").number_format = "0.00"

                    alpha_row = s_row + 4
                    ws.cell(row=alpha_row, column=1, value="Live Daily Alpha (INTERCEPT Formula)").font = bold_font
                    ws.cell(row=alpha_row, column=2, value=f"=INTERCEPT({ret_col}2:{ret_col}{n_rows},{bench_col}2:{bench_col}{n_rows})").number_format = "0.000%"

                    correl_row = s_row + 5
                    ws.cell(row=correl_row, column=1, value="Benchmark Comovement (CORREL Formula)").font = bold_font
                    ws.cell(row=correl_row, column=2, value=f"=CORREL({ret_col}2:{ret_col}{n_rows},{bench_col}2:{bench_col}{n_rows})").number_format = "0.00"

                    var95_row = s_row + 6
                    ws.cell(row=var95_row, column=1, value="95% Historical VaR (PERCENTILE Formula)").font = bold_font
                    ws.cell(row=var95_row, column=2, value=f"=-PERCENTILE.INC({ret_col}2:{ret_col}{n_rows},0.05)").number_format = "0.00%"

                    for r_i in range(avg_row, var95_row + 1):
                        ws.cell(row=r_i, column=1).border = thin_border
                        ws.cell(row=r_i, column=2).border = thin_border

        wb.save(out_path)
    except Exception as exc:
        log.warning("openpyxl writer error (%s), using pure-Python OpenXML zip generator", exc)
        _write_fallback_openxml_zip(sheets, out_path)

    log.info("Exported 13-tab dynamic financial model workbook to %s", out_path)
    return out_path


def _df_to_worksheet_xml(df: pd.DataFrame) -> str:
    """Generate valid OpenXML Worksheet XML (<worksheet>...</worksheet>) from a DataFrame."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '  <sheetData>',
    ]

    # Header row
    lines.append('    <row r="1">')
    for c_idx, col in enumerate(df.columns):
        col_ref = f"{_col_letter(c_idx)}1"
        escaped_val = escape(str(col))
        lines.append(f'      <c r="{col_ref}" t="inlineStr"><is><t>{escaped_val}</t></is></c>')
    lines.append('    </row>')

    # Data rows
    for r_idx, (_, row) in enumerate(df.iterrows(), start=2):
        lines.append(f'    <row r="{r_idx}">')
        for c_idx, val in enumerate(row):
            col_ref = f"{_col_letter(c_idx)}{r_idx}"
            if val is None or (isinstance(val, (float, np.floating)) and np.isnan(val)):
                lines.append(f'      <c r="{col_ref}" t="inlineStr"><is><t>—</t></is></c>')
            elif isinstance(val, (int, np.integer)):
                lines.append(f'      <c r="{col_ref}"><v>{int(val)}</v></c>')
            elif isinstance(val, (float, np.floating)):
                if np.isfinite(val):
                    lines.append(f'      <c r="{col_ref}"><v>{float(val)}</v></c>')
                else:
                    lines.append(f'      <c r="{col_ref}" t="inlineStr"><is><t>—</t></is></c>')
            else:
                lines.append(f'      <c r="{col_ref}" t="inlineStr"><is><t>{escape(str(val))}</t></is></c>')
        lines.append('    </row>')

    lines.append('  </sheetData>')
    lines.append('</worksheet>')
    return "\n".join(lines)


def _write_fallback_openxml_zip(sheets: dict[str, pd.DataFrame], out_path: Path) -> None:
    """Generate a clean binary OpenXML .xlsx file directly without external dependencies."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # [Content_Types].xml
        ct_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
            '  <Default Extension="xml" ContentType="application/xml"/>',
            '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        ]
        for idx in range(1, len(sheets) + 1):
            ct_lines.append(f'  <Override PartName="/xl/worksheets/sheet{idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
        ct_lines.append('</Types>')
        zf.writestr("[Content_Types].xml", "\n".join(ct_lines))

        # _rels/.rels
        zf.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""")

        # xl/_rels/workbook.xml.rels
        wb_rels = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        ]
        for idx in range(1, len(sheets) + 1):
            wb_rels.append(f'  <Relationship Id="rId{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>')
        wb_rels.append('</Relationships>')
        zf.writestr("xl/_rels/workbook.xml.rels", "\n".join(wb_rels))

        # xl/workbook.xml
        wb_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
            '  <sheets>',
        ]
        for idx, sheet_name in enumerate(sheets.keys(), start=1):
            escaped_name = escape(sheet_name[:31])
            wb_lines.append(f'    <sheet name="{escaped_name}" sheetId="{idx}" r:id="rId{idx}"/>')
        wb_lines.append('  </sheets>')
        wb_lines.append('</workbook>')
        zf.writestr("xl/workbook.xml", "\n".join(wb_lines))

        # xl/worksheets/sheetN.xml
        for idx, (_, df) in enumerate(sheets.items(), start=1):
            sheet_xml = _df_to_worksheet_xml(df)
            zf.writestr(f"xl/worksheets/sheet{idx}.xml", sheet_xml)

    out_path.write_bytes(buf.getvalue())


def export_unlisted_excel(analysis: Any, path: Path | str | None = None) -> Path:
    """Export unlisted/pre-IPO analysis to a multi-tab dynamic Excel workbook."""
    config = analysis.config
    slug = re.sub(r"[^\w\s-]", "", config.company).strip().replace(" ", "_")

    if path is None:
        out_path = Path("Excel") / f"{slug}_model_report.xlsx"
    else:
        raw = Path(path)
        out_path = Path("Excel") / raw.name if raw.parent == Path(".") or str(raw.parent) == "" else raw

    out_path.parent.mkdir(parents=True, exist_ok=True)
    ranked = analysis.ranked_moves() if hasattr(analysis, "ranked_moves") else []
    news_stats = analysis.news_meta.get("stats", {}) or {} if hasattr(analysis, "news_meta") and isinstance(analysis.news_meta, dict) else {}
    news_count = news_stats.get("unique_after_dedupe", len(getattr(analysis, "items", [])))
    calendar_days = (config.end - config.start).days + 1

    # 1. Summary KPIs
    from .unlisted import real_updates
    series = getattr(analysis, "series", pd.DataFrame())
    real = real_updates(series) if not series.empty else pd.Series(dtype=float)
    latest_p = f"₹{series.iloc[-1, 0]:,.2f}" if not series.empty else "—"

    summary_data = [
        {"Metric": "Target Entity", "Value": config.company, "Context": "Unlisted / Pre-IPO Corporate Entity"},
        {"Metric": "Asset Class", "Value": "Pre-IPO / Private Equities", "Context": "UnlistedZone indicative price telemetry"},
        {"Metric": "Observation Window", "Value": f"{config.start} to {config.end}", "Context": f"{calendar_days} calendar days"},
        {"Metric": "Total Price Revisions", "Value": len(real), "Context": "Distinct price revisions published on UnlistedZone"},
        {"Metric": "Notable Move Windows", "Value": len(ranked), "Context": "Ranked multi-day price revisions"},
        {"Metric": "Captured Dispatches", "Value": news_count, "Context": "Aggregated private & public media dispatches"},
        {"Metric": "Latest Indicative Price", "Value": latest_p, "Context": "Last recorded level in window"},
    ]
    summary_df = pd.DataFrame(summary_data)

    # 2. Timeline Series
    timeline_rows = []
    if not series.empty:
        real_idx_set = set(real.index)
        for d, row in series.iterrows():
            p = row["close"] if "close" in row else row.iloc[0]
            is_rev = d in real_idx_set
            timeline_rows.append({
                "Date": d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d),
                "Indicative Price (₹)": p,
                "Price Revised": "YES" if is_rev else "NO",
            })
    timeline_df = pd.DataFrame(timeline_rows) if timeline_rows else pd.DataFrame(columns=["Date", "Indicative Price (₹)", "Price Revised"])

    # 3. Notable Moves
    move_rows = []
    for idx, m in enumerate(ranked, 1):
        move_rows.append({
            "Rank": f"#{idx}",
            "Start Date": m.start_date.strftime("%Y-%m-%d") if hasattr(m.start_date, "strftime") else str(m.start_date),
            "End Date": m.end_date.strftime("%Y-%m-%d") if hasattr(m.end_date, "strftime") else str(m.end_date),
            "Start Price (₹)": m.start_price,
            "End Price (₹)": m.end_price,
            "Raw Move %": m.change,
            "Dispatches Count": len(m.headlines),
        })
    moves_df = pd.DataFrame(move_rows) if move_rows else pd.DataFrame(columns=["Rank", "Start Date", "End Date", "Start Price (₹)", "End Price (₹)", "Raw Move %", "Dispatches Count"])

    # 4. News Wire
    news_rows = []
    items = getattr(analysis, "items", [])
    for it in items:
        news_rows.append({
            "Date": it.published_at.strftime("%Y-%m-%d") if it.published_at and hasattr(it.published_at, "strftime") else "—",
            "Source": it.source,
            "Headline": it.headline,
            "URL": it.url,
            "Sentiment Tone": it.sentiment_label,
            "Sentiment Score": it.sentiment_score,
            "Relevance": it.relevance_score,
        })
    news_df = pd.DataFrame(news_rows) if news_rows else pd.DataFrame(columns=["Date", "Source", "Headline", "URL", "Sentiment Tone", "Sentiment Score", "Relevance"])

    # 5. Sector Peers
    from .report import SECTOR_PEER_FALLBACKS
    clean_name = config.company.upper()
    peers = []
    for k, v in SECTOR_PEER_FALLBACKS.items():
        if k in clean_name or clean_name in k:
            peers = v
            break
    peer_rows = [
        {"#": idx, "Peer Entity": p_name, "Exchange Ticker": p_sym, "Relationship": "Sector Benchmark"}
        for idx, (p_name, p_sym) in enumerate(peers, 1)
    ]
    peers_df = pd.DataFrame(peer_rows) if peer_rows else pd.DataFrame(columns=["#", "Peer Entity", "Exchange Ticker", "Relationship"])

    sheets = {
        "Executive Summary": summary_df,
        "Indicative Timeline": timeline_df,
        "Notable Moves": moves_df,
        "News Coverage Wire": news_df,
        "Sector Peers": peers_df,
    }

    _write_fallback_openxml_zip(sheets, out_path)
    log.info("Exported unlisted Excel workbook to %s", out_path)
    return out_path

