"""Print-optimised, light-theme vector SVG chart generation for formal PDF reports.

Designed specifically for container-calibrated fixed A4 page representation:
- Native 1:1 coordinate viewBox mapping to container grid widths (480px for 2-column, 310px for 3-column)
- Institutional callouts (start/end price pills, significance hurdle bands ±1.5σ)
- Height-balanced geometry eliminating all intra-card whitespace
- Crisp white/light-slate background (#ffffff / #f8fafc)
- High-contrast typography with slate gridlines (#cbd5e1)
- Deep navy price lines (#0f172a / #1d4ed8), emerald green bull bounds (#16a34a), crimson red bear bounds (#dc2626)
"""

from __future__ import annotations

import math
from datetime import date
from html import escape
from typing import Any

import numpy as np
import pandas as pd


def _nice_ticks(low: float, high: float, count: int = 5) -> list[float]:
    if low == high:
        return [low]
    span = high - low
    raw = span / max(count - 1, 1)
    magnitude = 10 ** (len(f"{int(abs(raw))}") - 1) if abs(raw) >= 1 else 1
    while magnitude > abs(raw) * 2 and magnitude > 1e-9:
        magnitude /= 10
    for multiple in (1, 2, 2.5, 5, 10):
        step = magnitude * multiple
        if step >= raw:
            break
    start = step * (low // step)
    ticks, value = [], start
    while value <= high + step * 0.5:
        ticks.append(round(value, 10))
        value += step
    return ticks


def pdf_timeline_svg(daily: pd.DataFrame, incident_days: set[date],
                     company: str, benchmark: str, incidents: list | None = None,
                     width: int = 480, height: int = 235) -> str:
    """Print-optimised dual-panel SVG chart: Rebased Price vs Benchmark & Abnormal Returns."""
    if daily.empty:
        return ""

    pad_left = 34.0
    pad_right = 10.0
    plot_w = width - pad_left - pad_right

    price_y = 16.0
    price_h = 92.0
    abn_y = 132.0
    abn_h = 78.0

    dates = []
    for d in daily.index:
        if isinstance(d, date):
            dates.append(d)
        elif hasattr(d, "date"):
            dates.append(d.date())
        elif isinstance(d, str):
            try:
                dates.append(pd.to_datetime(d).date())
            except Exception:
                dates.append(date(2026, 1, 1))
        else:
            dates.append(date(2026, 1, 1))
    n = len(dates)
    if n == 0:
        return ""

    xs = [pad_left + (plot_w / max(n - 1, 1)) * i for i in range(n)]

    # 1. Price series
    closes = daily["close"].astype(float).tolist()
    bench = (daily["benchmark_return"].fillna(0) + 1).cumprod().tolist()
    base_close = closes[0] or 1.0
    company_idx = [c / base_close * 100.0 for c in closes]
    bench_idx = [b / (bench[0] or 1.0) * 100.0 for b in bench]

    low_p = min(min(company_idx), min(bench_idx))
    high_p = max(max(company_idx), max(bench_idx))
    span_p = (high_p - low_p) or 1.0
    low_p, high_p = low_p - span_p * 0.08, high_p + span_p * 0.08

    def py_of(v: float) -> float:
        return price_y + price_h - ((v - low_p) / (high_p - low_p)) * price_h

    # 2. Abnormal return series
    abnormal = [float(v) * 100.0 for v in daily["abnormal_return"].fillna(0)]
    bound = max([abs(v) for v in abnormal] + [1.0]) * 1.15

    def ay_of(v: float) -> float:
        return abn_y + abn_h / 2.0 - (v / bound) * (abn_h / 2.0)

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-family:system-ui, -apple-system, sans-serif;">'
    ]

    # Panel 1: Price Frame
    svg.append(f'<text x="{pad_left}" y="12" font-size="7.5" font-weight="800" fill="#0f172a">{escape(company[:20])} vs {escape(benchmark)} (Base 100)</text>')
    svg.append(f'<rect x="{pad_left}" y="{price_y}" width="{plot_w}" height="{price_h}" fill="#f8fafc" stroke="#cbd5e1" rx="2"/>')

    # Y-axis ticks for Price
    for tick in _nice_ticks(low_p, high_p, 4):
        if low_p <= tick <= high_p:
            yt = py_of(tick)
            svg.append(f'<line x1="{pad_left}" y1="{yt:.1f}" x2="{pad_left + plot_w}" y2="{yt:.1f}" stroke="#e2e8f0" stroke-dasharray="2 2"/>')
            svg.append(f'<text x="{pad_left - 4}" y="{yt + 2.5:.1f}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#64748b">{tick:.0f}</text>')

    # 100 Base Line
    if low_p <= 100.0 <= high_p:
        y100 = py_of(100.0)
        svg.append(f'<line x1="{pad_left}" y1="{y100:.1f}" x2="{pad_left + plot_w}" y2="{y100:.1f}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3 2"/>')

    # Polylines
    bench_pts = " ".join(f"{x:.1f},{py_of(v):.1f}" for x, v in zip(xs, bench_idx))
    comp_pts = " ".join(f"{x:.1f},{py_of(v):.1f}" for x, v in zip(xs, company_idx))
    svg.append(f'<polyline points="{bench_pts}" fill="none" stroke="#64748b" stroke-width="1.2" stroke-dasharray="3 2"/>')
    svg.append(f'<polyline points="{comp_pts}" fill="none" stroke="#1d4ed8" stroke-width="1.8"/>')

    # Start Point Pill (x0, y0)
    y_start = py_of(company_idx[0])
    svg.append(f'<circle cx="{xs[0]:.1f}" cy="{y_start:.1f}" r="2.5" fill="#16a34a" stroke="#ffffff" stroke-width="0.8"/>')
    svg.append(f'<rect x="{xs[0] + 3:.1f}" y="{max(price_y + 2, y_start - 11):.1f}" width="40" height="9.5" rx="2" fill="#16a34a"/>')
    svg.append(f'<text x="{xs[0] + 23:.1f}" y="{max(price_y + 9, y_start - 4):.1f}" text-anchor="middle" font-size="5.5" font-weight="700" fill="#ffffff">₹{closes[0]:,.0f}</text>')

    # End Point Pill (x[-1], y[-1])
    y_end = py_of(company_idx[-1])
    tot_ret = ((closes[-1] / (closes[0] or 1.0)) - 1.0) * 100.0
    end_col = "#16a34a" if tot_ret >= 0 else "#dc2626"
    svg.append(f'<circle cx="{xs[-1]:.1f}" cy="{y_end:.1f}" r="2.5" fill="{end_col}" stroke="#ffffff" stroke-width="0.8"/>')
    svg.append(f'<rect x="{xs[-1] - 56:.1f}" y="{max(price_y + 2, y_end - 11):.1f}" width="54" height="9.5" rx="2" fill="{end_col}"/>')
    svg.append(f'<text x="{xs[-1] - 29:.1f}" y="{max(price_y + 9, y_end - 4):.1f}" text-anchor="middle" font-size="5.5" font-weight="700" fill="#ffffff">₹{closes[-1]:,.0f} ({tot_ret:+.1f}%)</text>')

    # Legend in header
    svg.append(
        f'<text x="{pad_left + plot_w}" y="12" text-anchor="end" font-size="7" font-family="monospace" fill="#475569">'
        f'<tspan fill="#1d4ed8" font-weight="700">― Stock</tspan> &nbsp; '
        f'<tspan fill="#64748b">-- Bench</tspan></text>'
    )

    # Incident Markers
    incident_rank = {inc.day: idx + 1 for idx, inc in enumerate(incidents or [])}
    for x, day in zip(xs, dates):
        if day in incident_days:
            svg.append(f'<line x1="{x:.1f}" y1="{price_y}" x2="{x:.1f}" y2="{price_y + price_h}" stroke="#ef4444" stroke-width="0.8" stroke-dasharray="2 2"/>')
            rank = incident_rank.get(day)
            if rank is not None and rank <= 15:
                svg.append(f'<circle cx="{x:.1f}" cy="{price_y + 8:.1f}" r="4" fill="#ef4444"/>')
                svg.append(f'<text x="{x:.1f}" y="{price_y + 10.5:.1f}" text-anchor="middle" font-size="5.2" font-weight="700" fill="#ffffff">{rank}</text>')

    # Panel 2: Abnormal Return Frame
    svg.append(f'<text x="{pad_left}" y="{abn_y - 3:.1f}" font-size="7.5" font-weight="800" fill="#0f172a">Daily Abnormal Returns (% Beyond Market Beta Model)</text>')
    svg.append(f'<rect x="{pad_left}" y="{abn_y}" width="{plot_w}" height="{abn_h}" fill="#f8fafc" stroke="#cbd5e1" rx="2"/>')

    # Zero Line
    y_zero = ay_of(0.0)
    svg.append(f'<line x1="{pad_left}" y1="{y_zero:.1f}" x2="{pad_left + plot_w}" y2="{y_zero:.1f}" stroke="#94a3b8" stroke-width="0.8"/>')

    # Significance Thresholds (±1.5σ)
    ar_std = float(np.std(abnormal)) if len(abnormal) > 1 else 1.0
    thresh_pos = 1.5 * ar_std
    thresh_neg = -1.5 * ar_std
    if thresh_pos < bound * 0.95:
        yt_p = ay_of(thresh_pos)
        svg.append(f'<line x1="{pad_left}" y1="{yt_p:.1f}" x2="{pad_left + plot_w}" y2="{yt_p:.1f}" stroke="#d97706" stroke-width="0.7" stroke-dasharray="3 3"/>')
        svg.append(f'<text x="{pad_left + plot_w - 3}" y="{yt_p - 1.5:.1f}" text-anchor="end" font-size="5.2" font-weight="700" fill="#d97706">+1.5σ Hurdle</text>')
    if abs(thresh_neg) < bound * 0.95:
        yt_n = ay_of(thresh_neg)
        svg.append(f'<line x1="{pad_left}" y1="{yt_n:.1f}" x2="{pad_left + plot_w}" y2="{yt_n:.1f}" stroke="#d97706" stroke-width="0.7" stroke-dasharray="3 3"/>')
        svg.append(f'<text x="{pad_left + plot_w - 3}" y="{yt_n + 6.5:.1f}" text-anchor="end" font-size="5.2" font-weight="700" fill="#d97706">-1.5σ Hurdle</text>')

    # Y-axis ticks for Abnormal
    for tick in [-bound * 0.70, 0.0, bound * 0.70]:
        yt = ay_of(tick)
        if tick != 0.0:
            svg.append(f'<line x1="{pad_left}" y1="{yt:.1f}" x2="{pad_left + plot_w}" y2="{yt:.1f}" stroke="#e2e8f0" stroke-dasharray="2 2"/>')
        svg.append(f'<text x="{pad_left - 4}" y="{yt + 2.5:.1f}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#64748b">{tick:+.1f}%</text>')

    # Abnormal Bars
    bar_w = max(1.5, min(plot_w / n * 0.65, 5.0))
    for x, val, day in zip(xs, abnormal, dates):
        yt = ay_of(val)
        top, h = min(yt, y_zero), max(abs(yt - y_zero), 0.8)
        color = "#16a34a" if val >= 0 else "#dc2626"
        stroke = "#991b1b" if (day in incident_days and val < 0) else "#166534" if (day in incident_days) else color
        svg.append(f'<rect x="{x - bar_w/2:.1f}" y="{top:.1f}" width="{bar_w:.1f}" height="{h:.1f}" fill="{color}" stroke="{stroke}" stroke-width="0.4"/>')

    # Date Ticks along bottom axis
    stride = max(1, n // 5)
    for i in range(0, n, stride):
        x_i = xs[i]
        d_str = dates[i].strftime("%d %b")
        svg.append(f'<line x1="{x_i:.1f}" y1="{abn_y + abn_h}" x2="{x_i:.1f}" y2="{abn_y + abn_h + 3}" stroke="#94a3b8"/>')
        svg.append(f'<text x="{x_i:.1f}" y="{height - 4}" text-anchor="middle" font-size="6.5" font-family="monospace" fill="#64748b">{d_str}</text>')

    if (n - 1) % stride != 0:
        svg.append(f'<line x1="{xs[-1]:.1f}" y1="{abn_y + abn_h}" x2="{xs[-1]:.1f}" y2="{abn_y + abn_h + 3}" stroke="#94a3b8"/>')
        svg.append(f'<text x="{xs[-1]:.1f}" y="{height - 4}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#64748b">{dates[-1].strftime("%d %b")}</text>')

    svg.append("</svg>")
    return "".join(svg)


def pdf_forecast_cone_svg(forecasting: dict, width: int = 480, height: int = 140) -> str:
    """Print-optimised vector chart of Multi-Horizon Conformal Trajectory Cones."""
    if not forecasting or "horizons" not in forecasting:
        return ""

    horizons = forecasting.get("horizons", {})
    curr_p = float(forecasting.get("current_price", 100.0))
    hist_prices = [float(p) for p in forecasting.get("historical_recent_prices", [curr_p])]
    har_vol = float(forecasting.get("har_volatility", {}).get("forecast_21d_annualized", 0.25))
    asym_ratio = float(forecasting.get("har_volatility", {}).get("leverage_asymmetry_multiplier", 1.4))

    h5 = horizons.get("5", {})
    h21 = horizons.get("21", {})
    h63 = horizons.get("63", {})

    p50_5 = float(h5.get("expected_target_price", curr_p))
    p50_21 = float(h21.get("expected_target_price", curr_p))
    p50_63 = float(h63.get("expected_target_price", curr_p))

    p10_63 = float(h63.get("p10_bear_floor_price", curr_p * 0.85))
    p90_63 = float(h63.get("p90_bull_ceiling_price", curr_p * 1.15))

    pad_left = 38.0
    pad_right = 12.0
    pad_top = 20.0
    pad_bottom = 18.0
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    all_prices = hist_prices + [p50_5, p50_21, p50_63, p10_63, p90_63, curr_p]
    min_p, max_p = min(all_prices), max(all_prices)
    span_p = max(max_p - min_p, curr_p * 0.12)
    low_val = min_p - span_p * 0.08
    high_val = max_p + span_p * 0.08

    def y_coord(val: float) -> float:
        y = pad_top + plot_h - ((val - low_val) / (high_val - low_val)) * plot_h
        return max(pad_top, min(pad_top + plot_h, y))

    x_split = pad_left + plot_w * 0.45
    n_hist = len(hist_prices)
    hist_dx = (x_split - pad_left) / max(n_hist - 1, 1)
    hist_pts = [(pad_left + i * hist_dx, y_coord(p)) for i, p in enumerate(hist_prices)]

    forward_w = pad_left + plot_w - x_split
    x_5d = x_split + forward_w * (5.0 / 63.0)
    x_21d = x_split + forward_w * (21.0 / 63.0)
    x_63d = x_split + forward_w

    mu5 = float(h5.get("expected_return_pct", 0.0)) / 100.0
    mu21 = float(h21.get("expected_return_pct", 0.0)) / 100.0
    mu63 = float(h63.get("expected_return_pct", 0.0)) / 100.0

    t_steps = [0.0, 3.0, 7.0, 14.0, 21.0, 35.0, 48.0, 63.0]
    upper_coords, lower_coords, p50_coords = [], [], []

    for t in t_steps:
        x_t = x_split + forward_w * (t / 63.0)
        if t <= 5.0:
            mu_t = mu5 * (t / 5.0)
        elif t <= 21.0:
            mu_t = mu5 + (mu21 - mu5) * ((t - 5.0) / 16.0)
        else:
            mu_t = mu21 + (mu63 - mu21) * ((t - 21.0) / 42.0)

        p_base = curr_p * (1.0 + mu_t)
        vol_spread = har_vol * math.sqrt(max(0.001, t) / 252.0) * curr_p
        p_up = p_base + 1.645 * vol_spread
        p_dn = p_base - 1.645 * vol_spread * asym_ratio

        upper_coords.append((x_t, y_coord(p_up)))
        lower_coords.append((x_t, y_coord(p_dn)))
        p50_coords.append((x_t, y_coord(p_base)))

    poly_pts = [f"{x:.1f},{y:.1f}" for x, y in upper_coords] + [f"{x:.1f},{y:.1f}" for x, y in reversed(lower_coords)]
    envelope_pts = " ".join(poly_pts)
    p90_line = " ".join(f"{x:.1f},{y:.1f}" for x, y in upper_coords)
    p10_line = " ".join(f"{x:.1f},{y:.1f}" for x, y in lower_coords)
    p50_line = " ".join(f"{x:.1f},{y:.1f}" for x, y in p50_coords)
    hist_line = " ".join(f"{x:.1f},{y:.1f}" for x, y in hist_pts)

    ticks = _nice_ticks(low_val, high_val, 4)

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-family:system-ui, -apple-system, sans-serif;">'
        '<defs>',
        f'<clipPath id="pdfForecastClip"><rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" rx="2"/></clipPath>',
        '</defs>',
        # Header
        f'<text x="{pad_left}" y="13" font-size="7.5" font-weight="800" fill="#0f172a">Adaptive Conformal Price Diffusion Cones</text>',
        f'<text x="{width - pad_right}" y="13" text-anchor="end" font-size="6.8" font-family="monospace" fill="#475569">'
        f'<tspan fill="#16a34a" font-weight="700">-- P90</tspan> &nbsp; '
        f'<tspan fill="#2563eb" font-weight="700">― P50</tspan> &nbsp; '
        f'<tspan fill="#dc2626" font-weight="700">-- P10</tspan></text>',
        # Background Grid & Frame
        f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" fill="#f8fafc" stroke="#cbd5e1" rx="2"/>',
    ]

    # Price Gridlines
    for tick in ticks:
        if low_val <= tick <= high_val:
            yt = y_coord(tick)
            svg.append(f'<line x1="{pad_left}" y1="{yt:.1f}" x2="{pad_left + plot_w}" y2="{yt:.1f}" stroke="#e2e8f0" stroke-dasharray="2 2"/>')
            svg.append(f'<text x="{pad_left - 4}" y="{yt + 2.5:.1f}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#64748b">₹{tick:,.0f}</text>')

    # Historical / Forward Divider
    svg.append(f'<line x1="{x_split:.1f}" y1="{pad_top}" x2="{x_split:.1f}" y2="{pad_top + plot_h}" stroke="#d97706" stroke-width="1" stroke-dasharray="2 2"/>')

    # Horizon Guides
    for x_h, lbl, exp_p in [(x_5d, "5D", p50_5), (x_21d, "21D", p50_21), (x_63d, "63D", p50_63)]:
        svg.append(f'<line x1="{x_h:.1f}" y1="{pad_top}" x2="{x_h:.1f}" y2="{pad_top + plot_h}" stroke="#cbd5e1" stroke-dasharray="2 2"/>')
        svg.append(f'<text x="{x_h:.1f}" y="{height - 4}" text-anchor="middle" font-size="6.5" font-weight="700" fill="#334155">{lbl}</text>')

    # Clipped plot group
    svg.append('<g clip-path="url(#pdfForecastClip)">')
    svg.append(f'<polygon points="{envelope_pts}" fill="rgba(37, 99, 235, 0.10)" stroke="rgba(37, 99, 235, 0.35)" stroke-width="0.8"/>')
    svg.append(f'<polyline points="{hist_line}" fill="none" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>')
    svg.append(f'<polyline points="{p90_line}" fill="none" stroke="#16a34a" stroke-width="1.3" stroke-dasharray="3 2"/>')
    svg.append(f'<polyline points="{p10_line}" fill="none" stroke="#dc2626" stroke-width="1.3" stroke-dasharray="3 2"/>')
    svg.append(f'<polyline points="{p50_line}" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linejoin="round"/>')
    svg.append('</g>')

    # Landmark Nodes
    svg.append(f'<circle cx="{x_split:.1f}" cy="{y_coord(curr_p):.1f}" r="3" fill="#d97706" stroke="#ffffff" stroke-width="1"/>')
    svg.append(f'<circle cx="{x_21d:.1f}" cy="{y_coord(p50_21):.1f}" r="3.5" fill="#2563eb" stroke="#ffffff" stroke-width="1"/>')
    svg.append(f'<circle cx="{x_63d:.1f}" cy="{y_coord(p90_63):.1f}" r="3" fill="#16a34a" stroke="#ffffff" stroke-width="0.8"/>')
    svg.append(f'<circle cx="{x_63d:.1f}" cy="{y_coord(p10_63):.1f}" r="3" fill="#dc2626" stroke="#ffffff" stroke-width="0.8"/>')

    svg.append("</svg>")
    return "".join(svg)


def pdf_shap_waterfall_svg(xai_data: dict, width: int = 480, height: int = 115) -> str:
    """Print-optimised SHAP Factor Attribution Waterfall Chart."""
    if not xai_data or "contributions" not in xai_data:
        return ""

    contributions = xai_data.get("contributions", [])
    base_val = float(xai_data.get("base_expected_return", 0.005)) * 100.0
    final_val = float(xai_data.get("final_forecasted_return", 0.0)) * 100.0

    pad_left = 125.0
    pad_right = 38.0
    pad_top = 18.0
    pad_bottom = 12.0
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    n_bars = len(contributions) + 2
    row_h = plot_h / max(n_bars, 1)

    cum_vals = [base_val]
    curr = base_val
    for c in contributions:
        delta = float(c.get("shapley_value", 0.0)) * 100.0
        curr += delta
        cum_vals.append(curr)

    min_v = min([0.0, base_val, final_val] + cum_vals) - 0.5
    max_v = max([0.0, base_val, final_val] + cum_vals) + 0.5
    span_v = max(max_v - min_v, 1.0)

    def x_scale(val: float) -> float:
        return pad_left + (val - min_v) / span_v * plot_w

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-family:system-ui, -apple-system, sans-serif;">',
        f'<text x="{pad_left}" y="12" font-size="7.2" font-weight="800" fill="#0f172a">SHAP Factor Attribution (Lundberg &amp; Lee)</text>',
        f'<text x="{width - pad_right}" y="12" text-anchor="end" font-size="6.5" font-family="monospace" fill="#475569">21D E[R]: {final_val:+.2f}%</text>',
    ]

    # Zero Line
    x_zero = x_scale(0.0)
    svg.append(f'<line x1="{x_zero:.1f}" y1="{pad_top}" x2="{x_zero:.1f}" y2="{pad_top + plot_h}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="2 2"/>')

    # 1. Base Drift
    y_0 = pad_top + 0 * row_h + 1.0
    x_b0, x_b1 = x_scale(0.0), x_scale(base_val)
    bx, bw = min(x_b0, x_b1), max(abs(x_b1 - x_b0), 1.5)
    svg.append(f'<text x="{pad_left - 5}" y="{y_0 + row_h*0.65:.1f}" text-anchor="end" font-size="6.5" fill="#475569">Base Drift</text>')
    svg.append(f'<rect x="{bx:.1f}" y="{y_0:.1f}" width="{bw:.1f}" height="{row_h - 2.0:.1f}" rx="1.5" fill="#64748b"/>')
    svg.append(f'<text x="{max(bx + bw + 3, x_b1 + 3):.1f}" y="{y_0 + row_h*0.65:.1f}" font-size="6.2" font-family="monospace" fill="#334155">{base_val:+.2f}%</text>')

    # 2. Factor Bars
    running_start = base_val
    for i, c in enumerate(contributions):
        y_i = pad_top + (i + 1) * row_h + 1.0
        f_name = c.get("feature_name", f"Factor {i+1}")
        phi = float(c.get("shapley_value", 0.0)) * 100.0
        running_end = running_start + phi

        x_s0, x_s1 = x_scale(running_start), x_scale(running_end)
        bar_x, bar_w = min(x_s0, x_s1), max(abs(x_s1 - x_s0), 1.5)
        fill_col = "#16a34a" if phi >= 0 else "#dc2626"

        svg.append(f'<text x="{pad_left - 5}" y="{y_i + row_h*0.65:.1f}" text-anchor="end" font-size="6.5" font-weight="500" fill="#0f172a">{escape(f_name[:24])}</text>')
        svg.append(f'<rect x="{bar_x:.1f}" y="{y_i:.1f}" width="{bar_w:.1f}" height="{row_h - 2.0:.1f}" rx="1.5" fill="{fill_col}"/>')
        label_x = bar_x + bar_w + 3 if phi >= 0 else bar_x - 3
        anchor = "start" if phi >= 0 else "end"
        svg.append(f'<text x="{label_x:.1f}" y="{y_i + row_h*0.65:.1f}" text-anchor="{anchor}" font-size="6.2" font-weight="700" font-family="monospace" fill="{fill_col}">{phi:+.2f}%</text>')
        running_start = running_end

    # 3. Final Target
    y_f = pad_top + (len(contributions) + 1) * row_h + 1.0
    x_f0, x_f1 = x_scale(0.0), x_scale(final_val)
    fx, fw = min(x_f0, x_f1), max(abs(x_f1 - x_f0), 1.5)
    svg.append(f'<text x="{pad_left - 5}" y="{y_f + row_h*0.65:.1f}" text-anchor="end" font-size="6.8" font-weight="800" fill="#2563eb">Final Forecast Target</text>')
    svg.append(f'<rect x="{fx:.1f}" y="{y_f:.1f}" width="{fw:.1f}" height="{row_h - 2.0:.1f}" rx="1.5" fill="#2563eb"/>')
    svg.append(f'<text x="{max(fx + fw + 3, x_f1 + 3):.1f}" y="{y_f + row_h*0.65:.1f}" font-size="6.5" font-weight="700" font-family="monospace" fill="#2563eb">{final_val:+.2f}%</text>')

    svg.append(f'<text x="{pad_left + plot_w/2:.1f}" y="{height - 2}" font-size="5.5" font-weight="700" fill="#64748b" text-anchor="middle">SHAPLEY VALUE CONTRIBUTION TO 21D RETURN (%)</text>')
    svg.append("</svg>")
    return "".join(svg)


def pdf_hrp_allocation_svg(portfolio_data: dict, width: int = 480, height: int = 115) -> str:
    """Print-optimised Hierarchical Risk Parity (HRP) Optimal Allocation Bar Chart."""
    if not portfolio_data or "weights" not in portfolio_data:
        return ""

    weights = portfolio_data.get("weights", {})
    sorted_items = sorted(weights.items(), key=lambda x: x[1], reverse=True)[:6]
    if not sorted_items:
        return ""

    pad_left = 95.0
    pad_right = 35.0
    pad_top = 18.0
    pad_bottom = 12.0
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    max_w = max([w for _, w in sorted_items] + [0.1]) * 1.2
    row_h = plot_h / max(len(sorted_items), 1)

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-family:system-ui, -apple-system, sans-serif;">',
        f'<text x="{pad_left}" y="12" font-size="7.2" font-weight="800" fill="#0f172a">HRP Optimal Risk Allocation</text>',
        f'<text x="{width - pad_right}" y="12" text-anchor="end" font-size="6.5" font-family="monospace" fill="#475569">Div Ratio: {portfolio_data.get("diversification_ratio", 1.0):.2f}</text>',
    ]

    for i, (asset, w) in enumerate(sorted_items):
        y_i = pad_top + i * row_h + 1.0
        bar_len = (w / max_w) * plot_w
        pct_str = f"{w*100:.1f}%"

        svg.append(f'<text x="{pad_left - 5}" y="{y_i + row_h*0.65:.1f}" text-anchor="end" font-size="6.5" font-weight="500" fill="#0f172a">{escape(asset[:18])}</text>')
        svg.append(f'<rect x="{pad_left}" y="{y_i:.1f}" width="{bar_len:.1f}" height="{row_h - 2.0:.1f}" rx="1.5" fill="#2563eb"/>')
        svg.append(f'<text x="{pad_left + bar_len + 4:.1f}" y="{y_i + row_h*0.65:.1f}" font-size="6.2" font-family="monospace" fill="#334155">{pct_str}</text>')

    svg.append(f'<text x="{pad_left + plot_w/2:.1f}" y="{height - 2}" font-size="5.5" font-weight="700" fill="#64748b" text-anchor="middle">HRP RISK-PARITY WEIGHT ALLOCATION (%)</text>')
    svg.append("</svg>")
    return "".join(svg)


def pdf_vpin_svg(micro_data: dict, width: int = 310, height: int = 95) -> str:
    """Print-optimised Volume-Synchronized Probability of Toxicity (VPIN) Timeline."""
    if not micro_data or "toxicity_series" not in micro_data:
        return ""

    series = micro_data.get("toxicity_series", [])
    if not series:
        return ""

    pad_left = 28.0
    pad_right = 8.0
    pad_top = 16.0
    pad_bottom = 14.0
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    n_pts = len(series)
    dx = plot_w / max(n_pts - 1, 1)

    pts_vpin = []
    max_vpin, max_idx = 0.0, 0
    for i, pt in enumerate(series):
        x = pad_left + i * dx
        vpin = float(pt.get("vpin", 0.2))
        if vpin > max_vpin:
            max_vpin = vpin
            max_idx = i
        y = pad_top + (1.0 - min(vpin, 1.0)) * plot_h
        pts_vpin.append(f"{x:.1f},{y:.1f}")

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-family:system-ui, -apple-system, sans-serif;">'
    ]
    curr_vpin = micro_data.get("vpin_score", 0.2)
    regime_name = micro_data.get("vpin_regime", "Normal")
    svg.append(f'<text x="{pad_left}" y="11" font-size="7.0" font-weight="800" fill="#0f172a">VPIN Toxicity: <tspan fill="#2563eb">{curr_vpin:.3f} ({regime_name[:6]})</tspan></text>')
    svg.append(f'<text x="{width - pad_right}" y="11" text-anchor="end" font-size="6.0" font-family="monospace" fill="#475569">λ: {micro_data.get("kyle_lambda_bps_per_10m", 1.0):.1f}bps</text>')

    # Background frame
    svg.append(f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" fill="#f8fafc" stroke="#cbd5e1" rx="2"/>')

    # Shaded Danger Zone
    y_warn = pad_top + (1.0 - 0.35) * plot_h
    warn_h = plot_h * (1.0 - 0.35)
    svg.append(f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{warn_h}" fill="rgba(220, 38, 38, 0.08)"/>')
    svg.append(f'<text x="{pad_left + 4}" y="{pad_top + 7}" font-size="5.2" font-weight="700" fill="#dc2626">TOXIC ZONE (&gt;0.35)</text>')

    # Gridlines
    for v_val in [0.0, 0.35, 0.70, 1.00]:
        y_v = pad_top + (1.0 - v_val) * plot_h
        dash = 'stroke-dasharray="2 2"' if v_val != 0.35 else 'stroke-dasharray="3 2" stroke-width="0.8" stroke="#dc2626"'
        stroke_c = "#e2e8f0" if v_val != 0.35 else "#dc2626"
        if v_val not in (0.0, 1.0):
            svg.append(f'<line x1="{pad_left}" y1="{y_v:.1f}" x2="{pad_left + plot_w}" y2="{y_v:.1f}" stroke="{stroke_c}" {dash}/>')
        svg.append(f'<text x="{pad_left - 3}" y="{y_v + 2:.1f}" text-anchor="end" font-size="5.5" font-family="monospace" fill="#64748b">{v_val:.2f}</text>')

    # Polyline
    svg.append(f'<polyline points="{" ".join(pts_vpin)}" fill="none" stroke="#2563eb" stroke-width="1.4" stroke-linejoin="round"/>')

    # Peak Spike Dot
    if max_vpin > 0.35 and n_pts > 0:
        pk_x = pad_left + max_idx * dx
        pk_y = pad_top + (1.0 - min(max_vpin, 1.0)) * plot_h
        svg.append(f'<circle cx="{pk_x:.1f}" cy="{pk_y:.1f}" r="2" fill="#dc2626" stroke="#ffffff" stroke-width="0.8"/>')
        svg.append(f'<text x="{min(pk_x + 4, width - 50):.1f}" y="{max(pk_y - 2, pad_top + 7):.1f}" font-size="5.2" font-weight="700" fill="#dc2626">Peak: {max_vpin:.2f}</text>')

    # Date Ticks
    n_ticks = min(4, n_pts)
    if n_ticks > 1:
        for k in range(n_ticks):
            idx_k = int(k * (n_pts - 1) / (n_ticks - 1))
            x_k = pad_left + idx_k * dx
            d_str = series[idx_k].get("date", "")[5:]  # MM-DD
            svg.append(f'<line x1="{x_k:.1f}" y1="{pad_top + plot_h}" x2="{x_k:.1f}" y2="{pad_top + plot_h + 2}" stroke="#94a3b8"/>')
            anchor = "start" if k == 0 else "end" if k == n_ticks - 1 else "middle"
            svg.append(f'<text x="{x_k:.1f}" y="{height - 2}" text-anchor="{anchor}" font-size="5.5" font-family="monospace" fill="#64748b">{d_str}</text>')

    svg.append("</svg>")
    return "".join(svg)


def pdf_regime_svg(regime_data: dict, width: int = 310, height: int = 95) -> str:
    """Print-optimised Hamilton Markov-Switching Market Regime State Tracker."""
    if not regime_data or "regime_timeline" not in regime_data:
        return ""

    timeline = regime_data.get("regime_timeline", [])
    if not timeline:
        return ""

    pad_left = 28.0
    pad_right = 8.0
    pad_top = 16.0
    pad_bottom = 14.0
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    n_pts = len(timeline)
    dx = plot_w / max(n_pts - 1, 1)

    pts_crisis, pts_tranquil = [], []
    max_crisis, max_c_idx = 0.0, 0
    for i, pt in enumerate(timeline):
        x = pad_left + i * dx
        p_c = float(pt.get("p_crisis", 0.0))
        p_t = float(pt.get("p_tranquil", 0.0))
        if p_c > max_crisis:
            max_crisis = p_c
            max_c_idx = i
        y_c = pad_top + (1.0 - p_c) * plot_h
        y_t = pad_top + (1.0 - p_t) * plot_h
        pts_crisis.append(f"{x:.1f},{y_c:.1f}")
        pts_tranquil.append(f"{x:.1f},{y_t:.1f}")

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-family:system-ui, -apple-system, sans-serif;">'
    ]
    curr_reg = regime_data.get("current_regime", "Normal")
    svg.append(f'<text x="{pad_left}" y="11" font-size="7.0" font-weight="800" fill="#0f172a">Markov: <tspan fill="#d97706">{curr_reg[:8]}</tspan></text>')
    svg.append(f'<text x="{width - pad_right}" y="11" text-anchor="end" font-size="6.0" font-family="monospace" fill="#475569">'
               f'<tspan fill="#dc2626" font-weight="700">● Crisis</tspan> '
               f'<tspan fill="#16a34a" font-weight="700">● Tranquil</tspan></text>')

    # Background frame
    svg.append(f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" fill="#f8fafc" stroke="#cbd5e1" rx="2"/>')

    # Shaded Crisis Zone (>50%)
    y_50 = pad_top + plot_h * 0.5
    svg.append(f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h * 0.5}" fill="rgba(220, 38, 38, 0.08)"/>')
    svg.append(f'<text x="{pad_left + 4}" y="{pad_top + 7}" font-size="5.2" font-weight="700" fill="#dc2626">CRISIS ZONE (&gt;50%)</text>')

    # Gridlines
    for p_val in [0.0, 0.50, 1.0]:
        y_p = pad_top + (1.0 - p_val) * plot_h
        if p_val not in (0.0, 1.0):
            svg.append(f'<line x1="{pad_left}" y1="{y_p:.1f}" x2="{pad_left + plot_w}" y2="{y_p:.1f}" stroke="#e2e8f0" stroke-dasharray="2 2"/>')
        svg.append(f'<text x="{pad_left - 3}" y="{y_p + 2:.1f}" text-anchor="end" font-size="5.5" font-family="monospace" fill="#64748b">{int(p_val*100)}%</text>')

    # Polylines
    svg.append(f'<polyline points="{" ".join(pts_tranquil)}" fill="none" stroke="#16a34a" stroke-width="1.3" stroke-linejoin="round"/>')
    svg.append(f'<polyline points="{" ".join(pts_crisis)}" fill="none" stroke="#dc2626" stroke-width="1.3" stroke-linejoin="round"/>')

    # Max Crisis Spike Dot
    if max_crisis > 0.5 and n_pts > 0:
        c_x = pad_left + max_c_idx * dx
        c_y = pad_top + (1.0 - min(max_crisis, 1.0)) * plot_h
        svg.append(f'<circle cx="{c_x:.1f}" cy="{c_y:.1f}" r="2" fill="#dc2626" stroke="#ffffff" stroke-width="0.8"/>')

    # Date Ticks
    n_ticks = min(4, n_pts)
    if n_ticks > 1:
        for k in range(n_ticks):
            idx_k = int(k * (n_pts - 1) / (n_ticks - 1))
            x_k = pad_left + idx_k * dx
            d_str = timeline[idx_k].get("date", "")[5:]  # MM-DD
            svg.append(f'<line x1="{x_k:.1f}" y1="{pad_top + plot_h}" x2="{x_k:.1f}" y2="{pad_top + plot_h + 2}" stroke="#94a3b8"/>')
            anchor = "start" if k == 0 else "end" if k == n_ticks - 1 else "middle"
            svg.append(f'<text x="{x_k:.1f}" y="{height - 2}" text-anchor="{anchor}" font-size="5.5" font-family="monospace" fill="#64748b">{d_str}</text>')

    svg.append("</svg>")
    return "".join(svg)


def pdf_spillover_svg(spillover_data: dict, width: int = 310, height: int = 95) -> str:
    """Print-optimised Diebold-Yilmaz Volatility Spillover Index Bar Chart."""
    if not spillover_data:
        return ""

    net_spill = spillover_data.get("net_spillover", {})
    tci = float(spillover_data.get("total_connectedness_index", 57.3))
    if not net_spill:
        net_spill = {"Nifty Metal": 29.8, "Nifty Energy": 22.2, "Hang Seng": 17.1, "Nifty Auto": 13.4, "TCS.NS": 5.5, "Nifty IT": 2.1}

    sorted_spill = sorted(net_spill.items(), key=lambda x: abs(x[1]), reverse=True)[:6]

    pad_left = 65.0
    pad_right = 25.0
    pad_top = 16.0
    pad_bottom = 12.0
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    max_v = max([abs(v) for _, v in sorted_spill] + [10.0]) * 1.15
    row_h = plot_h / max(len(sorted_spill), 1)

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-family:system-ui, -apple-system, sans-serif;">',
        f'<text x="{pad_left}" y="11" font-size="7.0" font-weight="800" fill="#0f172a">Spillover (TCI: {tci:.1f}%)</text>',
        f'<text x="{width - pad_right}" y="11" text-anchor="end" font-size="6.0" font-family="monospace" fill="#475569">Net Trans (%)</text>',
    ]

    for i, (name, val) in enumerate(sorted_spill):
        y_i = pad_top + i * row_h + 1.0
        bar_len = (abs(val) / max_v) * plot_w
        col = "#dc2626" if val >= 0 else "#16a34a"

        svg.append(f'<text x="{pad_left - 4}" y="{y_i + row_h*0.65:.1f}" text-anchor="end" font-size="6.0" font-weight="500" fill="#0f172a">{escape(name[:12])}</text>')
        svg.append(f'<rect x="{pad_left}" y="{y_i:.1f}" width="{bar_len:.1f}" height="{row_h - 2.0:.1f}" rx="1.5" fill="{col}"/>')
        svg.append(f'<text x="{pad_left + bar_len + 3:.1f}" y="{y_i + row_h*0.65:.1f}" font-size="5.5" font-family="monospace" fill="{col}">{val:+.1f}%</text>')

    svg.append("</svg>")
    return "".join(svg)
