"""Tab-level detail for a finished listed-company analysis.

`summarise()` in analyzer.py returns a compact headline summary. This module
adds the sections the research dossier renders in its eight tabs. Blocks are
passed through under the engine's own snake_case field names, minus the long
daily series (those live in the full report), so the front end can show what
the engine actually produced rather than a re-derivation of it.
"""

from __future__ import annotations

from typing import Any

_BULKY_KEYS = {
    "daily",
    "rolling_trajectory",
    "aligned",
    "toxicity_series",
    "regime_timeline",
    "counterfactual_trajectory",
    "spillover_matrix",
    "trades_table",
}


def _num(v: Any) -> float | None:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    if v != v or v in (float("inf"), float("-inf")):
        return None
    return float(v)


def slim(obj: Any) -> Any:
    """Copy a block without its long time series; NaN/inf become null."""
    if isinstance(obj, dict):
        return {k: slim(v) for k, v in obj.items() if k not in _BULKY_KEYS}
    if isinstance(obj, list):
        return [slim(v) for v in obj[:40]]
    if isinstance(obj, float) and _num(obj) is None:
        return None
    return obj


def _incident(i: dict[str, Any]) -> dict[str, Any]:
    car = i.get("car") or {}
    return {
        "day": i.get("day"),
        "abnormal_return": _num(i.get("abnormal_return")),
        "abnormal_return_z": _num(i.get("abnormal_return_z")),
        "coverage_z": _num(i.get("coverage_z")),
        "volume_z": _num(i.get("volume_z")),
        "item_count": i.get("item_count"),
        "mean_sentiment": _num(i.get("mean_sentiment")),
        "dominant_event": i.get("dominant_event"),
        "dominant_emotion": i.get("dominant_emotion"),
        "direction_agrees": i.get("direction_agrees"),
        "trajectory_type": i.get("trajectory_type"),
        "car": _num(car.get("car")),
        "car_days": car.get("days"),
        "t_stat": _num(car.get("t_stat")),
        "p_value": _num(car.get("p_value")),
        "headlines": [
            {
                "source": h.get("source"),
                "headline": h.get("headline"),
                "url": h.get("url"),
                "sentiment_label": h.get("sentiment_label"),
                "summary": h.get("summary"),
                "published": h.get("published") or h.get("timestamp"),
            }
            for h in (i.get("headlines") or [])[:10]
            if isinstance(h, dict)
        ],
    }


def detail_listed(a: dict[str, Any]) -> dict[str, Any]:
    v = a.get("investment_verdict") or {}
    ta = a.get("technical_analysis") or {}
    fin = a.get("financials") or {}
    val = a.get("relative_valuation_multiples") or {}
    metals = a.get("metals") or {}
    rob = a.get("threshold_robustness") or {}

    tech_bt = dict((a.get("backtesting") or {}).get("technical_backtest") or {})
    tech_bt["trades_table"] = (tech_bt.get("trades_table") or [])[:12]

    nifty = {
        name: {
            "ticker": b.get("ticker"),
            "window_return": _num(b.get("window_return")),
            "beta": _num(b.get("beta")),
            "r_squared": _num(b.get("r_squared")),
            "note": b.get("event_study_note") or b.get("note") or None,
        }
        for name, b in (a.get("nifty_indices") or {}).items()
        if isinstance(b, dict)
    }
    global_mk = {
        name: {
            "ticker": b.get("ticker"),
            "window_return": _num(b.get("window_return")),
            "note": b.get("note") or None,
        }
        for name, b in (a.get("global_markets") or {}).items()
        if isinstance(b, dict)
    }

    from .analyzer_extra import extras

    return {
        **extras(a),
        "sizing": {
            "tiers": slim(v.get("sizing_tiers") or []),
            "prescribed_pct": _num(v.get("prescribed_allocation_pct")),
            "raw_kelly_pct": _num(v.get("raw_kelly_pct")),
            "half_kelly_pct": _num(v.get("half_kelly_pct")),
            "cap_pct": _num(v.get("maximum_allocation_cap_pct")),
        },
        "holding": {
            "core": v.get("core_holding_period"),
            "tactical": v.get("tactical_holding_period"),
            "profit_booking": v.get("profit_booking_rules") or [],
            "invalidation": v.get("invalidation_rules") or [],
        },
        "pillar_rationales": [
            p.get("evidence_rationale") for p in (v.get("pillars") or []) if isinstance(p, dict)
        ],
        "event_study": {
            "incidents": [_incident(i) for i in (a.get("incidents") or [])[:30] if isinstance(i, dict)],
            "robustness": {
                "note": rob.get("note"),
                "multipliers": rob.get("multipliers"),
                "combos": rob.get("n_combos"),
                "days": [
                    {
                        "day": d,
                        "flagged_in": r.get("flagged_in"),
                        "of": r.get("of"),
                        "fraction": _num(r.get("fraction")),
                    }
                    for d, r in (rob.get("days") or {}).items()
                    if isinstance(r, dict)
                ],
            },
            "diagnostics": slim(a.get("flagging_diagnostics")),
            "unattributed": [
                {k: u.get(k) for k in ("source", "headline", "url", "reason")}
                for u in (a.get("unattributed_items") or [])[:25]
                if isinstance(u, dict)
            ],
            "sentiment_return": slim(a.get("sentiment_return_correlation")),
            "emotion_return": slim(a.get("emotion_return_summary")),
        },
        "technical": {
            **slim(
                {
                    k: ta.get(k)
                    for k in (
                        "moving_averages",
                        "adx",
                        "macd",
                        "rsi",
                        "bollinger",
                        "stochastic",
                        "pivots",
                        "indicators_table",
                        "weekly_playbook",
                    )
                }
            ),
            "backtest": slim(tech_bt),
        },
        "fundamental": {
            "statement_kind": fin.get("statement_kind"),
            "unit": fin.get("currency_unit"),
            "as_of": fin.get("as_of"),
            "screener_url": fin.get("screener_url"),
            "lines": {
                k: slim(fin.get(k)) for k in ("revenue", "expenses", "operating_income", "net_profit")
            },
            "tax_rate_pct": _num(fin.get("tax_rate_pct")),
            "nopat": _num(fin.get("nopat")),
            "nopat_note": fin.get("nopat_note"),
            "order_book": slim(fin.get("order_book")),
            "order_book_note": fin.get("order_book_note"),
            "balance_sheet": slim(fin.get("balance_sheet")),
            "ratios": slim(fin.get("ratios")),
            "surprise": slim(fin.get("surprise_diagnostics")),
            "peers": fin.get("peers") or [],
        },
        "quant": {
            "conformal": slim((a.get("forecasting") or {}).get("conformal_coverage")),
            "volatility": slim(a.get("volatility_models")),
            "distance_to_default": slim(a.get("distance_to_default")),
            "var": slim(a.get("var")),
            "microstructure": slim(a.get("microstructure")),
            "regime": slim(a.get("regime")),
            "xai": slim(a.get("xai")),
        },
        "macro": {
            "backdrop": slim(a.get("macro")),
            "metals": [
                {
                    k: m.get(k)
                    for k in (
                        "name",
                        "symbol",
                        "unit",
                        "current_price",
                        "change_pct",
                        "momentum_1w_pct",
                        "annualized_volatility_pct",
                        "transmission_channel",
                    )
                }
                for m in (metals.get("metals") or [])
                if isinstance(m, dict)
            ],
            "metals_summary": metals.get("summary_narrative"),
            "nifty": nifty,
            "global": global_mk,
        },
        "peers": {
            "sector": val.get("sector_name"),
            "rating": val.get("overall_valuation_rating"),
            "stance": val.get("relative_valuation_stance"),
            "composite_score": _num(val.get("composite_relative_score")),
            "target_price": _num(val.get("peer_harmonized_target_price")),
            "implied_upside_pct": _num(val.get("implied_upside_vs_peers_pct")),
            "table": [
                {
                    "multiple": r.get("ratio_name") or r.get("Multiple"),
                    "value": _num(r.get("company_value")),
                    "sector_median": _num(r.get("sector_median")),
                    "variance_pct": _num(r.get("variance_pct")),
                    "verdict": r.get("verdict_badge") or r.get("Verdict"),
                    "role": r.get("interpretation") or r.get("Analytical Role"),
                }
                for r in (val.get("multiples_summary_table") or [])
                if isinstance(r, dict)
            ],
        },
    }
