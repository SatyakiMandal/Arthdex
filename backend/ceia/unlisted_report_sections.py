"""HTML sections for the unlisted report: valuation, trend, risk, market model and forecast.

Kept out of ``report.py`` (already about five thousand lines). The investment-call section is
shared with the listed report; everything here renders the ``research`` block that
``ceia.unlisted_research`` produces, using the same module chrome and table classes.
"""

from __future__ import annotations

from html import escape
from typing import Any


def _f(value: Any, digits: int = 2, prefix: str = "", suffix: str = "") -> str:
    if value is None:
        return "—"
    try:
        return f"{prefix}{float(value):,.{digits}f}{suffix}"
    except (TypeError, ValueError):
        return escape(str(value))


def _cls(value: Any) -> str:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return ""
    return "pos" if v > 0 else "neg" if v < 0 else ""


def _stat(key: str, value: str) -> str:
    return f'<div class="stat"><div class="k">{escape(key)}</div><div class="v">{value}</div></div>'


def _module(sec_id: str, title: str, tag: str, body: str) -> str:
    return f"""
<div id="{sec_id}" class="bbg-module">
  <div class="bbg-module-header"><h2>{escape(title)}</h2><span class="tag">{escape(tag)}</span></div>
  <div class="bbg-module-body">{body}</div>
</div>
"""


def _note(text: str) -> str:
    return f'<p class="note">{escape(text)}</p>'


def _table(head: list[str], rows: list[list[str]], left_cols: int = 1) -> str:
    th = "".join(f"<th{' class=\"txt\"' if i < left_cols else ''}>{escape(h)}</th>" for i, h in enumerate(head))
    body = "".join(
        "<tr>" + "".join(f"<td{' class=\"txt\"' if i < left_cols else ''}>{c}</td>" for i, c in enumerate(r)) + "</tr>" for r in rows
    )
    return f'<div class="scroll"><table><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table></div>'


def valuation_section(research: dict[str, Any]) -> str:
    v = research.get("valuation")
    if not v:
        return ""
    if not v.get("available"):
        return _module("sec-valuation", "Valuation models", "FAIR VALUE", _note(v.get("note", "No valuation model could be built.")))

    tier = v["valuation_tier"]
    tier_cls = "pos" if tier in ("Deep Discount", "Discount") else "neg" if tier in ("Premium", "Rich") else ""
    stats = "".join(
        [
            _stat("Quote", _f(v["price"], 2, "₹ ")),
            _stat("Blended fair value", _f(v["blended_fair_value"], 2, "₹ ")),
            _stat("Fair value range", f"₹ {v['fair_value_low']:,.2f} to ₹ {v['fair_value_high']:,.2f}"),
            _stat("Upside to fair value", f'<span class="{_cls(v["upside_pct"])}">{_f(v["upside_pct"], 1, suffix="%")}</span>'),
            _stat("Valuation tier", f'<span class="{tier_cls}">{escape(tier)}</span>'),
            _stat("Illiquidity discount", _f(v["assumptions"]["dlom_pct"], 0, suffix="%")),
        ]
    )

    rows = []
    for m in v["models"]:
        inputs = ", ".join(f"{escape(k.replace('_', ' '))}: {escape(str(val))}" for k, val in m["inputs"].items())
        rows.append(
            [
                f"<strong>{escape(m['name'])}</strong><div class='note'>{escape(m['basis'])}</div>",
                _f(m["fair_value"], 2, "₹ "),
                f'<span class="{_cls(m["upside_pct"])}">{_f(m["upside_pct"], 1, suffix="%")}</span>',
                _f(m.get("weight_used", 0) * 100, 0, suffix="%"),
                f"<span class='note'>{inputs}</span>" + (f"<div class='note'>{escape(m['caveat'])}</div>" if m.get("caveat") else ""),
            ]
        )
    models = _table(["Model", "Fair value", "vs quote", "Weight", "Inputs and caveat"], rows)

    co = v["company_multiples"]
    bm = v["benchmark"]
    mult = _table(
        ["Multiple", "Company", f"Benchmark ({escape(str(bm.get('name') or 'n/a'))})"],
        [
            ["Price / Book", _f(co["pb"]), _f(bm["pb"])],
            ["Price / Earnings", _f(co["pe"]), _f(bm["pe"])],
            ["Book value per share", _f(co["book_value"], 2, "₹ "), "—"],
            ["Return on equity (P/B ÷ P/E)", _f(co["roe_pct"], 1, suffix="%"), "—"],
            ["Debt / Equity", _f(co["debt_equity"]), "—"],
        ],
    )

    sens = v["sensitivity"]
    s_rows = [[escape(str(r["DLOM"]))] + [_f(r[c], 2, "₹ ") for c in sens["scale_columns"]] for r in sens["rows"]]
    sens_html = _table(["Illiquidity discount"] + [f"Benchmark {c[1:]}x" for c in sens["scale_columns"]], s_rows)

    a = v["assumptions"]
    assumptions = (
        f"Cost of equity {_f(a['cost_of_equity_pct'], 2, suffix='%')} = risk-free {_f(a['risk_free_pct'], 2, suffix='%')}"
        f"{' (assumed, the live yield could not be retrieved)' if a['risk_free_assumed'] else ' (10-year G-Sec)'} + beta x {_f(a['equity_risk_premium_pct'], 1, suffix='%')} equity risk premium; "
        f"terminal growth {_f(a['terminal_growth_pct'], 1, suffix='%')}. {a['note']}"
    )

    body = (
        _note("Fair value of an unlisted share from book value, earnings and listed benchmark multiples, after a discount for the fact that it cannot be sold freely. Not a price target by itself.")
        + f'<div class="grid">{stats}</div>'
        + "<h3>Models</h3>" + models
        + "<h3>Multiples against the benchmark</h3>" + mult
        + "<h3>Sensitivity: what the blended fair value becomes if the assumptions move</h3>" + _note(sens["meaning"]) + sens_html
        + _note(assumptions)
    )
    return _module("sec-valuation", "Valuation models", "FAIR VALUE AFTER ILLIQUIDITY DISCOUNT", body)


def profile_section(research: dict[str, Any]) -> str:
    p = research.get("price_profile")
    if not p:
        return ""
    rev = p["revisions"]
    dd = p.get("drawdown") or {}
    rng = p.get("range_52w") or {}
    stats = "".join(
        [
            _stat("Window return", f'<span class="{_cls(p["window_return_pct"])}">{_f(p["window_return_pct"], 1, suffix="%")}</span>'),
            _stat("CAGR", _f(p.get("cagr_pct"), 1, suffix="%")),
            _stat("1M / 3M", f"{_f(p.get('change_1m_pct'), 1, suffix='%')} / {_f(p.get('change_3m_pct'), 1, suffix='%')}"),
            _stat("6M / 12M", f"{_f(p.get('change_6m_pct'), 1, suffix='%')} / {_f(p.get('change_12m_pct'), 1, suffix='%')}"),
            _stat("52-week position", _f(rng.get("position_pct"), 0, suffix="% of range")),
            _stat("Max drawdown", f'<span class="neg">{_f(dd.get("max_drawdown_pct"), 1, suffix="%")}</span>'),
            _stat("Price revisions", str(rev["count"])),
            _stat("Median gap between revisions", _f(rev.get("median_gap_days"), 0, suffix=" days")),
            _stat("Average revision size", _f(rev.get("mean_abs_move_pct"), 1, suffix="%")),
            _stat("Revisions upward", _f(rev.get("up_share_pct"), 0, suffix="%")),
            _stat("Days since last revision", str(rev["days_since_last"])),
        ]
    )
    body = (
        _note("The price is revised by hand, so how often and how far it moves is itself information: a long gap means the quote is stale, not that nothing happened.")
        + f'<div class="grid">{stats}</div>'
    )
    return _module("sec-profile", "Price profile & revision record", "UNLISTEDZONE DATA", body)


def technical_section(research: dict[str, Any]) -> str:
    t = research.get("technical")
    if not t:
        return ""
    if t.get("composite_score") is None:
        return _module("sec-technical", "Trend & momentum (weekly)", "WEEKLY BARS", _note(t.get("note", "Too little history.")))
    rows = [
        [escape(r["indicator"]), escape(r["value"]), f'<span class="{"pos" if "Bull" in r["signal"] or r["signal"] == "Oversold" else "neg" if "Bear" in r["signal"] or r["signal"] == "Overbought" else ""}">{escape(r["signal"])}</span>', f"<span class='note'>{escape(r['note'])}</span>"]
        for r in t["indicators_table"]
    ]
    stats = "".join(
        [
            _stat("Composite score", f'<span class="{_cls(t["composite_score"])}">{t["composite_score"]:+.0f}</span>'),
            _stat("Rating", escape(t["composite_rating"])),
            _stat("Weekly bars", str(t["weeks"])),
            _stat("RSI (14w)", _f(t.get("rsi"), 1)),
        ]
    )
    body = _note(t["basis"]) + f'<div class="grid">{stats}</div>' + _table(["Indicator", "Value", "Signal", "Reading"], rows)
    return _module("sec-technical", "Trend & momentum (weekly)", "WEEKLY BARS", body)


def risk_section(research: dict[str, Any]) -> str:
    r = research.get("risk")
    if not r:
        return ""
    liq = r.get("liquidity") or {}
    stats = [
        _stat("Monthly returns used", str(r.get("months", 0))),
        _stat("Annualised volatility", _f(r.get("annualised_vol_pct"), 1, suffix="%")),
        _stat("Worst / best month", f"{_f(r.get('worst_month_pct'), 1, suffix='%')} / {_f(r.get('best_month_pct'), 1, suffix='%')}"),
        _stat("Positive months", _f(r.get("positive_months_pct"), 0, suffix="%")),
        _stat("Skew / excess kurtosis", f"{_f(r.get('skew'))} / {_f(r.get('excess_kurtosis'))}"),
        _stat("Price unchanged on", _f(liq.get("stale_day_share_pct"), 0, suffix="% of days")),
        _stat("Lot size", _f(liq.get("lot_size"), 0, suffix=" shares")),
        _stat("Minimum ticket", _f(liq.get("min_ticket_inr"), 0, "₹ ")),
        _stat("Debt / Equity", _f((r.get("leverage") or {}).get("debt_to_equity"), 2)),
    ]
    reg = r.get("regime")
    if reg:
        stats.append(_stat("Volatility regime", f"{escape(reg['state'])} ({_f(reg['recent_6m_vol_vs_full'], 2)}x full-sample)"))

    body = _note(r.get("note") or "Risk is measured on monthly returns because the dealer price is revised too rarely for daily statistics.") + f'<div class="grid">{"".join(stats)}</div>'
    v = r.get("var_1m")
    if v:
        body += "<h3>One-month value at risk</h3>" + _table(
            ["Method", "95%", "99%"],
            [
                ["Historical", _f(v.get("historical_95_pct"), 1, suffix="%"), _f(v.get("historical_99_pct"), 1, suffix="%")],
                ["Parametric (normal)", _f(v.get("parametric_95_pct"), 1, suffix="%"), _f(v.get("parametric_99_pct"), 1, suffix="%")],
                ["Cornish-Fisher", _f(v.get("cornish_fisher_95_pct"), 1, suffix="%"), "—"],
                ["Expected shortfall", _f(v.get("expected_shortfall_95_pct"), 1, suffix="%"), "—"],
            ],
        ) + _note(v["note"])
    body += _note(liq.get("note", ""))
    return _module("sec-risk", "Risk, leverage & liquidity", "MONTHLY RETURNS", body)


def market_model_section(research: dict[str, Any]) -> str:
    m = research.get("market_model")
    if not m:
        return ""
    rows = []
    for name, block in m.items():
        if not isinstance(block, dict) or "beta" not in block:
            continue
        rows.append(
            [
                escape(name), _f(block.get("beta")), _f(block.get("beta_t")), _f(block.get("r_squared")),
                _f(block.get("correlation")), _f((block.get("alpha_monthly") or 0) * 100, 2, suffix="%"), str(block.get("months")),
            ]
        )
    if not rows:
        return _module("sec-market", "Market sensitivity (monthly)", "NIFTY / SECTOR", _note(m.get("note", "Not enough overlapping history.")))
    body = (
        _table(["Benchmark", "Beta", "Beta t-stat", "R squared", "Correlation", "Alpha / month", "Months"], rows)
        + _note(m.get("interpretation", ""))
    )
    return _module("sec-market", "Market sensitivity (monthly)", "NIFTY / SECTOR", body)


def forecast_section(research: dict[str, Any]) -> str:
    f = research.get("forecast")
    if not f:
        return ""
    if not f.get("horizons"):
        return _module("sec-forecast", "Outcome ranges", "BOOTSTRAP", _note(f.get("note", "")))
    rows = [
        [
            f"{h['months']} month{'s' if h['months'] > 1 else ''}",
            f'<span class="neg">{_f(h["p10_price"], 2, "₹ ")} ({_f(h["p10_return_pct"], 1, suffix="%")})</span>',
            f"{_f(h['p50_price'], 2, '₹ ')} ({_f(h['p50_return_pct'], 1, suffix='%')})",
            f'<span class="pos">{_f(h["p90_price"], 2, "₹ ")} ({_f(h["p90_return_pct"], 1, suffix="%")})</span>',
            _f(h["prob_loss_pct"], 0, suffix="%"),
        ]
        for h in f["horizons"]
    ]
    body = (
        _note(f"{f['method']}. Confidence: {f['confidence']} ({f['months_of_history']} months of history). Bias: {f['bias']}.")
        + _table(["Horizon", "Weak case (10th pct)", "Middle (median)", "Strong case (90th pct)", "Chance of a loss"], rows)
        + _note(f["note"])
    )
    return _module("sec-forecast", "Outcome ranges", "BOOTSTRAP", body)


def research_sections(research: dict[str, Any] | None) -> str:
    """All research modules in reading order; empty when the research layer produced nothing."""
    if not research or not research.get("available"):
        return ""
    return "".join(
        fn(research)
        for fn in (valuation_section, profile_section, technical_section, risk_section, market_model_section, forecast_section)
    )
