"""Sections of the original CEIA report that are derived from analysis.json rather than
stored in it: the corporate-valuation suite, factor model, execution simulator and the
price timeline. Mirrors what ceia/report.py computes at render time, so the on-site
dossier shows the same analysis the HTML report does.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, is_dataclass
from typing import Any

import numpy as np
import pandas as pd

from .analyzer_detail import _num, slim

log = logging.getLogger("arthdex.analyzer")


def _d(x: Any) -> Any:
    if is_dataclass(x) and not isinstance(x, type):
        return slim(asdict(x))
    if hasattr(x, "to_dict"):
        return slim(x.to_dict())
    return slim(x)


def _latest(block: Any) -> float | None:
    if isinstance(block, dict):
        return _num(block.get("latest"))
    return _num(block)


def timeline(a: dict[str, Any]) -> dict[str, Any] | None:
    """Rebased price vs benchmark and the benchmark-adjusted (abnormal) return per day."""
    daily = a.get("daily") or []
    if len(daily) < 10:
        return None
    df = pd.DataFrame(daily)
    if not {"date", "close", "benchmark_return", "abnormal_return"} <= set(df.columns):
        return None
    df = df.dropna(subset=["close"])
    if df.empty:
        return None
    price = df["close"].astype(float)
    bench = (1.0 + df["benchmark_return"].fillna(0.0).astype(float)).cumprod()
    ab = df["abnormal_return"].astype(float)
    sd = float(ab.std(ddof=0)) if ab.notna().any() else 0.0
    return {
        "benchmark": a.get("benchmark"),
        "dates": df["date"].tolist(),
        "price": [_num(v) for v in price],
        "priceRebased": [_num(v) for v in (price / price.iloc[0] * 100.0)],
        "benchRebased": [_num(v) for v in (bench * 100.0)],
        "abnormal": [_num(v) for v in ab],
        "volume": [_num(v) for v in df["volume"].astype(float)] if "volume" in df else [],
        "hurdle": _num(1.5 * sd),
    }


def valuation_suite(a: dict[str, Any]) -> dict[str, Any] | None:
    """2-stage DCF (or residual income for banks), scenarios, Monte Carlo, Dupont, solvency."""
    from ceia import valuation_model as vm
    from ceia.solvency_ensemble import compute_distress_ensemble

    fin = a.get("financials") or {}
    stored = a.get("valuation_suite")
    if stored:
        # Computed once at analysis time, so the verdict and this view agree exactly
        out = slim(dict(stored))
        try:
            out["distress"] = _d(compute_distress_ensemble(financials=fin, distance_to_default=a.get("distance_to_default") or {}))
        except Exception as exc:
            log.warning("distress ensemble failed: %s", exc)
        return out
    verdict = a.get("investment_verdict") or {}
    price = _num(verdict.get("current_price"))
    shares = _num(fin.get("shares_outstanding"))
    if not fin or not price or not shares or shares <= 0:
        return None

    bs = fin.get("balance_sheet") or {}
    market_cap = shares * price
    debt = float(_num(bs.get("total_debt")) or _num(bs.get("borrowings")) or 0.0)
    cash_raw = _num(bs.get("cash_and_equivalents"))
    cash = float(cash_raw if cash_raw is not None else (_num(bs.get("investments")) or 0.0))
    op_latest = _latest(fin.get("operating_income"))
    if op_latest is None:
        return None
    # Latest quarter, taxed at 25% and annualised: the same shortcut the HTML report takes
    base_nopat = op_latest * 0.75 * 4
    book_equity = float((_num(bs.get("equity_capital")) or 0.0) + (_num(bs.get("reserves")) or 0.0))
    if book_equity <= 0:
        book_equity = max(100.0, market_cap * 0.4)
    net_income = _latest(fin.get("net_profit"))
    if net_income is None:
        net_income = market_cap * 0.06
    beta = _num((a.get("prices") or {}).get("beta")) or 1.0
    is_bank = vm.is_financial_institution(fin, a.get("ticker") or "")

    np.random.seed(42)  # the Monte Carlo is reproducible between page views
    wacc = vm.compute_wacc(market_cap=market_cap, total_debt=debt, beta=beta, risk_free_rate=0.068)
    if is_bank:
        core = vm.compute_residual_income_valuation(
            current_price=price, shares_outstanding=shares, book_value_equity=book_equity,
            latest_net_income=net_income, beta=beta, risk_free_rate=0.068,
        )
    else:
        core = vm.compute_dcf_valuation(
            current_price=price, shares_outstanding=shares, nopat=base_nopat,
            total_debt=debt, cash=cash, wacc=wacc.wacc,
        )
    scen = vm.compute_scenario_dcf(
        current_price=price, shares_outstanding=shares, nopat=base_nopat, total_debt=debt, cash=cash,
        base_wacc=wacc.wacc, is_bank=is_bank, book_value_equity=book_equity, net_income=net_income,
    )
    bayes = vm.compute_bayesian_probabilistic_dcf(
        current_price=price, shares_outstanding=shares, nopat=base_nopat, total_debt=debt, cash=cash,
        base_wacc=wacc.wacc, num_simulations=1000, is_bank=is_bank,
        book_value_equity=book_equity, net_income=net_income,
    )
    out: dict[str, Any] = {
        "isBank": is_bank,
        "methodology": getattr(core, "methodology", None),
        "baseNopat": _num(base_nopat),
        "marketCap": _num(market_cap),
        "unit": fin.get("currency_unit"),
        "wacc": _d(wacc),
        "core": _d(core),
        "scenario": _d(scen),
        "bayesian": _d(bayes),
        "dupont": _d(vm.compute_dupont_5_factor_roe(financials=fin)),
    }
    try:
        out["distress"] = _d(compute_distress_ensemble(financials=fin, distance_to_default=a.get("distance_to_default") or {}))
    except Exception as exc:  # optional
        log.warning("distress ensemble failed: %s", exc)
    return out


def factor_and_execution(a: dict[str, Any]) -> dict[str, Any]:
    daily = a.get("daily") or []
    out: dict[str, Any] = {}
    if len(daily) < 30:
        return out
    df = pd.DataFrame(daily).set_index("date")
    try:
        from ceia.factor_model import fit_multi_factor_model

        out["factor"] = _d(fit_multi_factor_model(df["return"].dropna(), df["benchmark_return"].dropna()))
    except Exception as exc:
        log.warning("factor model failed: %s", exc)
    try:
        from ceia.execution_simulator import simulate_almgren_chriss_execution

        price = _num((a.get("investment_verdict") or {}).get("current_price")) or float(df["close"].iloc[-1])
        adv = float(df["volume"].median()) if "volume" in df and df["volume"].notna().any() else 1_000_000.0
        out["execution"] = _d(
            simulate_almgren_chriss_execution(
                order_value_inr=10_000_000, stock_price=price, average_daily_volume=adv, daily_volatility=0.02
            )
        )
    except Exception as exc:
        log.warning("execution simulator failed: %s", exc)
    return out


def extras(a: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"timeline": None, "valuation": None}
    for key, fn in (("timeline", timeline), ("valuation", valuation_suite)):
        try:
            out[key] = fn(a)
        except Exception as exc:
            log.warning("%s section failed: %s", key, exc)
    out.update(factor_and_execution(a))

    fc = a.get("forecasting") or {}
    pf = a.get("portfolio") or {}
    sp = a.get("spillover") or {}
    bt = a.get("backtesting") or {}
    out["forecast"] = {
        "horizons": slim(fc.get("horizons")),
        "har": slim(fc.get("har_volatility")),
        "sixSigma": slim(fc.get("six_sigma_schedule")),
        "macroRidge": slim(fc.get("macro_ridge")),
    }
    out["var_six_sigma"] = slim((a.get("var") or {}).get("six_sigma_risk"))
    out["portfolio"] = slim(
        {k: pf.get(k) for k in ("hrp", "black_litterman", "fractional_kelly", "diversification_ratio")}
    ) if pf else None
    out["spillover"] = slim({k: v for k, v in sp.items() if k != "spillover_matrix"}) if sp else None
    out["backtests"] = {
        "conformal": slim(bt.get("conformal_backtest")),
        "volatility": slim(bt.get("volatility_backtest")),
        "technical": slim(bt.get("technical_backtest")),
        "trades": slim(((bt.get("technical_backtest") or {}).get("trades_table") or [])[:20]),
        "score": _num(bt.get("composite_validation_score")),
        "status": bt.get("validation_status"),
        "summary": bt.get("summary_report"),
    }
    out["vol_table"] = None
    return out
