from __future__ import annotations

import numpy as np
"""Inline SVG chart generation.

Charts are hand-built SVG rather than matplotlib PNGs for three reasons: the
report stays a single self-contained file with no image assets, the output is
vector (so it stays crisp when a reader zooms or prints to PDF), and it adds no
dependency beyond what ingestion already needs.

Colours are supplied via CSS custom properties and `currentColor` where possible
so the same markup works in the report's light and dark themes.
"""


from datetime import date
from html import escape

import pandas as pd

# Panel geometry. The viewBox makes everything scale to the container width.
WIDTH = 960
PAD_LEFT = 62
PAD_RIGHT = 18
PAD_TOP = 26
LABEL_BAND = 34


def _x_positions(n: int, width: int) -> list[float]:
    """Evenly spaced band centres across the plot area."""
    if n <= 0:
        return []
    inner = width - PAD_LEFT - PAD_RIGHT
    if n == 1:
        return [PAD_LEFT + inner / 2]
    step = inner / n
    return [PAD_LEFT + step * (i + 0.5) for i in range(n)]


def _nice_ticks(low: float, high: float, count: int = 5) -> list[float]:
    """Round-ish tick values spanning [low, high]."""
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


def _date_labels(dates: list[date], xs: list[float], max_labels: int = 9) -> str:
    if not dates:
        return ""
    stride = max(1, len(dates) // max_labels)
    parts = []
    for i, (day, x) in enumerate(zip(dates, xs)):
        if i % stride and i != len(dates) - 1:
            continue
        parts.append(
            f'<text x="{x:.1f}" y="0" class="tick" text-anchor="middle" '
            f'transform="rotate(-38 {x:.1f} 0)">{day:%d %b}</text>'
        )
    return "".join(parts)


def _macro_markers(events: list, dates: list[date], xs: list[float],
                   y_bottom: float) -> str:
    """Small diamond markers along a panel's bottom edge for macro-economic
    events (repo rate changes) that land on a date the panel already plots.

    Deliberately a different shape and colour from the incident/price-move
    badges (numbered circles): those rank *candidates this analysis found*,
    these are *known, dated economic context* - conflating the two
    vocabularies would make a reader search the ranked list below for a
    "candidate" that was never one. A date not present in ``dates`` (a
    non-trading day for a listed stock, say) is skipped rather than placed
    at the nearest neighbour, which would misdate it.
    """
    if not events:
        return ""
    date_x = dict(zip(dates, xs))
    parts = []
    for event in events:
        x = date_x.get(event.day)
        if x is None:
            continue
        label = escape(event.label)
        parts.append(
            f'<g class="macro-marker" transform="translate({x:.1f},{y_bottom:.1f})">'
            f'<path d="M0,-5 L5,0 L0,5 L-5,0 Z"/>'
            f'<title>{event.day:%d %b %Y}: {label}</title></g>'
        )
    return "".join(parts)


def _panel_frame(y0: float, height: float, title: str) -> str:
    return (
        f'<text x="{PAD_LEFT}" y="{y0 - 8:.1f}" class="panel-title">{escape(title)}</text>'
        f'<rect x="{PAD_LEFT}" y="{y0:.1f}" width="{WIDTH - PAD_LEFT - PAD_RIGHT}" '
        f'height="{height:.1f}" class="plot-bg"/>'
    )


def _y_axis(y0: float, height: float, low: float, high: float,
            fmt: str = "{:.0f}") -> str:
    parts = []
    for tick in _nice_ticks(low, high):
        if high == low:
            continue
        y = y0 + height - (tick - low) / (high - low) * height
        if y < y0 - 1 or y > y0 + height + 1:
            continue
        parts.append(
            f'<line x1="{PAD_LEFT}" y1="{y:.1f}" x2="{WIDTH - PAD_RIGHT}" y2="{y:.1f}" '
            f'class="gridline"/>'
            f'<text x="{PAD_LEFT - 8}" y="{y + 3.5:.1f}" class="tick" '
            f'text-anchor="end">{fmt.format(tick)}</text>'
        )
    return "".join(parts)


def timeline_svg(daily: pd.DataFrame, incident_days: set[date],
                 company: str, benchmark: str, incidents: list | None = None,
                 macro_events: list | None = None) -> str:
    """Three stacked panels: rebased prices, abnormal returns, coverage.

    Prices are rebased to 100 at the window's first session so a stock priced in
    thousands and an index priced in tens can share an axis and be compared on
    percentage terms, which is what the eye should be reading here.

    ``incidents`` (optional) is the ranked candidate list from
    ``eventstudy.rank_incidents`` — when supplied, each flagged day gets a
    numbered badge in the top panel matching its rank in the incident table
    below, and richer hover text on its abnormal-return bar, so a reader can
    tell *which* flagged day is which without leaving the chart. Without it
    (or for a day in ``incident_days`` that isn't in ``incidents``), the day
    still gets its dashed marker line and outlined bar, just no number.
    """
    if daily.empty:
        return '<p class="empty">No trading days in the analysis window.</p>'

    incident_rank: dict[date, int] = {}
    incident_tooltip: dict[date, str] = {}
    for rank, incident in enumerate(incidents or [], 1):
        incident_rank[incident.day] = rank
        incident_tooltip[incident.day] = (
            f"#{rank} {incident.day:%d %b %Y}: abnormal return "
            f"{incident.abnormal_return * 100:+.2f}%, {incident.item_count} "
            "news item(s) — see the ranked list below"
        )

    # pandas Timestamp subclasses datetime.date, so an isinstance check would
    # leave Timestamps untouched and they never compare equal to the plain
    # dates in ``incident_days`` — silently dropping every incident marker.
    # Normalise unconditionally instead.
    dates = [pd.Timestamp(d).date() for d in daily.index]
    n = len(dates)
    xs = _x_positions(n, WIDTH)

    # Reserved only when there is something to caption. The caption exists
    # because a numbered badge with no on-chart explanation is only
    # meaningful to a reader who also has the paragraph above the chart in
    # front of them - true in a browser, not true once the SVG is printed,
    # screenshotted, or embedded in a PDF on its own (see ceia/pdf.py).
    has_badges = bool(incidents)
    top_caption_h = 18.0 if has_badges else 0.0

    price_h, abn_h, cov_h = 190.0, 130.0, 110.0
    gap = 46.0
    price_y = PAD_TOP + top_caption_h
    abn_y = price_y + price_h + gap
    cov_y = abn_y + abn_h + gap
    total_h = cov_y + cov_h + LABEL_BAND + 14

    parts = [
        f'<svg viewBox="0 0 {WIDTH} {total_h:.0f}" class="timeline" '
        f'preserveAspectRatio="xMidYMid meet" role="img" '
        f'aria-label="Price, abnormal return and coverage timeline">'
        # Negative-tone coverage bars (panel 3) are otherwise distinguished
        # from positive ones by colour alone - this hatch overlay gives a
        # second, colour-independent cue for readers who can't rely on the
        # red/green difference.
        '<defs><pattern id="neg-hatch" width="6" height="6" '
        'patternTransform="rotate(45)" patternUnits="userSpaceOnUse">'
        '<line x1="0" y1="0" x2="0" y2="6" class="hatch-line"/></pattern></defs>'
    ]
    if has_badges:
        parts.append(
            f'<text x="{PAD_LEFT}" y="{PAD_TOP - 4:.1f}" class="chart-caption">'
            "Numbered circles mark the ranked candidate incident days below, "
            "each dated underneath — hover any bar for its exact date and "
            "value.</text>"
        )

    # ---- Panel 1: rebased price vs benchmark -----------------------------
    closes = daily["close"].astype(float).tolist()
    bench = (daily["benchmark_return"].fillna(0) + 1).cumprod().tolist()
    base_close = closes[0] or 1.0
    company_idx = [c / base_close * 100 for c in closes]
    bench_idx = [b / (bench[0] or 1.0) * 100 for b in bench]

    low = min(min(company_idx), min(bench_idx))
    high = max(max(company_idx), max(bench_idx))
    span = (high - low) or 1.0
    low, high = low - span * 0.08, high + span * 0.08

    def price_y_of(v: float) -> float:
        return price_y + price_h - (v - low) / (high - low) * price_h

    parts.append(_panel_frame(price_y, price_h,
                              f"{company} vs {benchmark} — rebased to 100"))
    parts.append(_y_axis(price_y, price_h, low, high))

    # A reference line at the rebased starting level (100 = "unchanged since
    # day one"). Without it, "is the stock up or down since the window
    # started" requires reading the y-axis scale; with it, it is a glance.
    if low <= 100 <= high:
        base_y = price_y_of(100.0)
        parts.append(
            f'<line x1="{PAD_LEFT}" y1="{base_y:.1f}" x2="{WIDTH - PAD_RIGHT}" '
            f'y2="{base_y:.1f}" class="baseline"/>'
            f'<text x="{PAD_LEFT + 4}" y="{base_y - 3:.1f}" class="tick">'
            "start of window</text>"
        )

    for values, css in ((bench_idx, "line-benchmark"), (company_idx, "line-company")):
        points = " ".join(f"{x:.1f},{price_y_of(v):.1f}" for x, v in zip(xs, values))
        parts.append(f'<polyline points="{points}" class="{css}"/>')

    # Start and End Price Points
    y_start = price_y_of(company_idx[0])
    parts.append(f'<circle cx="{xs[0]:.1f}" cy="{y_start:.1f}" r="3.5" fill="#16a34a" stroke="#ffffff" stroke-width="1.2"/>')
    parts.append(f'<rect x="{xs[0] + 4:.1f}" y="{max(price_y + 2, y_start - 13):.1f}" width="48" height="13" rx="2" fill="#16a34a"/>')
    parts.append(f'<text x="{xs[0] + 28:.1f}" y="{max(price_y + 11, y_start - 4):.1f}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#ffffff">₹{closes[0]:,.0f}</text>')

    y_end = price_y_of(company_idx[-1])
    tot_ret = ((closes[-1] / (closes[0] or 1.0)) - 1.0) * 100.0
    end_col = "#16a34a" if tot_ret >= 0 else "#dc2626"
    parts.append(f'<circle cx="{xs[-1]:.1f}" cy="{y_end:.1f}" r="3.5" fill="{end_col}" stroke="#ffffff" stroke-width="1.2"/>')
    parts.append(f'<rect x="{xs[-1] - 68:.1f}" y="{max(price_y + 2, y_end - 13):.1f}" width="64" height="13" rx="2" fill="{end_col}"/>')
    parts.append(f'<text x="{xs[-1] - 36:.1f}" y="{max(price_y + 11, y_end - 4):.1f}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#ffffff">₹{closes[-1]:,.0f} ({tot_ret:+.1f}%)</text>')

    badge_r = 9.0
    badge_cy = price_y + 15.0
    for x, day in zip(xs, dates):
        if day not in incident_days:
            continue
        parts.append(
            f'<line x1="{x:.1f}" y1="{price_y:.1f}" x2="{x:.1f}" '
            f'y2="{price_y + price_h:.1f}" class="incident-rule"/>'
        )
        rank = incident_rank.get(day)
        if rank is None:
            continue
        tooltip = escape(incident_tooltip.get(day, f"{day:%d %b %Y}: flagged incident"))
        parts.append(
            f'<g class="incident-badge">'
            f'<circle cx="{x:.1f}" cy="{badge_cy:.1f}" r="{badge_r}"/>'
            f'<text x="{x:.1f}" y="{badge_cy + 3.5:.1f}" text-anchor="middle">{rank}</text>'
            f"<title>{tooltip}</title></g>"
        )
        # The date each badge refers to, always visible - not only in the
        # <title> tooltip, which needs a mouse hover and so renders as
        # nothing at all once this SVG is screenshotted or exported to PDF
        # (see ceia/pdf.py). A small background rect keeps it legible where
        # it crosses the price lines behind it.
        date_label = f"{day:%d %b}"
        label_y = badge_cy + badge_r + 11.0
        label_w = len(date_label) * 5.4 + 6.0
        parts.append(
            f'<rect x="{x - label_w / 2:.1f}" y="{label_y - 9.0:.1f}" '
            f'width="{label_w:.1f}" height="12" rx="2" class="badge-date-bg"/>'
            f'<text x="{x:.1f}" y="{label_y:.1f}" text-anchor="middle" '
            f'class="badge-date">{date_label}</text>'
        )

    # The legend sits in the title row rather than inside the plot: a flat
    # benchmark line runs along the top of the panel and an in-plot legend
    # lands straight on top of it.
    label = escape(company if len(company) <= 22 else company[:21] + "…")
    offset = 150 + len(label) * 6.2
    parts.append(
        f'<g class="legend" transform="translate({WIDTH - PAD_RIGHT - offset:.0f},'
        f'{price_y - 12})">'
        f'<line x1="0" y1="0" x2="22" y2="0" class="line-company"/>'
        f'<text x="28" y="4" class="tick">{label}</text>'
        f'<line x1="{40 + len(label) * 6.2:.0f}" y1="0" '
        f'x2="{62 + len(label) * 6.2:.0f}" y2="0" class="line-benchmark"/>'
        f'<text x="{68 + len(label) * 6.2:.0f}" y="4" class="tick">'
        f'{escape(benchmark)}</text></g>'
    )

    parts.append(_macro_markers(macro_events or [], dates, xs, price_y + price_h))

    # ---- Panel 2: abnormal returns ---------------------------------------
    abnormal = [float(v) * 100 for v in daily["abnormal_return"].fillna(0)]
    bound = max((abs(v) for v in abnormal), default=1.0) * 1.2 or 1.0

    def abn_y_of(v: float) -> float:
        return abn_y + abn_h / 2 - (v / bound) * (abn_h / 2)

    parts.append(_panel_frame(abn_y, abn_h,
                              "Abnormal return — company move with the market's move removed (%)"))
    parts.append(_y_axis(abn_y, abn_h, -bound, bound, "{:+.1f}%"))

    # Significance Threshold Bands (±1.5σ)
    ar_std = float(np.std(abnormal)) if len(abnormal) > 1 else 1.0
    thresh_pos = 1.5 * ar_std
    thresh_neg = -1.5 * ar_std
    if thresh_pos < bound * 0.95:
        yt_p = abn_y_of(thresh_pos)
        parts.append(f'<line x1="{PAD_LEFT}" y1="{yt_p:.1f}" x2="{WIDTH - PAD_RIGHT}" y2="{yt_p:.1f}" stroke="#d97706" stroke-width="1" stroke-dasharray="3 3"/>')
        parts.append(f'<text x="{WIDTH - PAD_RIGHT - 4}" y="{yt_p - 3:.1f}" text-anchor="end" font-size="7" font-weight="700" fill="#d97706">+1.5σ Hurdle</text>')
    if abs(thresh_neg) < bound * 0.95:
        yt_n = abn_y_of(thresh_neg)
        parts.append(f'<line x1="{PAD_LEFT}" y1="{yt_n:.1f}" x2="{WIDTH - PAD_RIGHT}" y2="{yt_n:.1f}" stroke="#d97706" stroke-width="1" stroke-dasharray="3 3"/>')
        parts.append(f'<text x="{WIDTH - PAD_RIGHT - 4}" y="{yt_n + 9:.1f}" text-anchor="end" font-size="7" font-weight="700" fill="#d97706">-1.5σ Hurdle</text>')

    band = (WIDTH - PAD_LEFT - PAD_RIGHT) / n
    bar_w = max(2.0, min(band * 0.62, 26.0))
    zero = abn_y_of(0)
    for x, value, day in zip(xs, abnormal, dates):
        y = abn_y_of(value)
        top, height = min(y, zero), abs(y - zero)
        css = "bar-neg" if value < 0 else "bar-pos"
        flag = " bar-incident" if day in incident_days else ""
        tooltip = (incident_tooltip.get(day) or f"{day:%d %b %Y}: {value:+.2f}%")
        parts.append(
            f'<rect x="{x - bar_w / 2:.1f}" y="{top:.1f}" width="{bar_w:.1f}" '
            f'height="{max(height, 0.8):.1f}" class="{css}{flag}">'
            f"<title>{escape(tooltip)}</title></rect>"
        )
    parts.append(
        f'<line x1="{PAD_LEFT}" y1="{zero:.1f}" x2="{WIDTH - PAD_RIGHT}" '
        f'y2="{zero:.1f}" class="axis-zero"/>'
    )

    # ---- Panel 3: coverage volume, coloured by tone ----------------------
    counts = [int(v) for v in daily["unique_count"].fillna(0)]
    tones = [float(v) for v in daily["weighted_sentiment"].fillna(0)]
    max_count = max(counts) or 1

    parts.append(_panel_frame(cov_y, cov_h,
                             "News volume (bar height) and tone (colour)"))
    parts.append(_y_axis(cov_y, cov_h, 0, max_count))

    for x, count, tone, day in zip(xs, counts, tones, dates):
        if count <= 0:
            continue
        height = count / max_count * cov_h
        css = ("tone-neg" if tone <= -0.15 else
               "tone-pos" if tone >= 0.15 else "tone-neutral")
        bar_y = cov_y + cov_h - height
        parts.append(
            f'<rect x="{x - bar_w / 2:.1f}" y="{bar_y:.1f}" '
            f'width="{bar_w:.1f}" height="{height:.1f}" class="{css}">'
            f'<title>{day:%d %b %Y}: {count} item(s), tone {tone:+.2f}</title></rect>'
        )
        if css == "tone-neg":
            parts.append(
                f'<rect x="{x - bar_w / 2:.1f}" y="{bar_y:.1f}" width="{bar_w:.1f}" '
                f'height="{height:.1f}" fill="url(#neg-hatch)" pointer-events="none"/>'
            )

    parts.append(
        f'<g transform="translate(0,{cov_y + cov_h + 16:.1f})">'
        f'{_date_labels(dates, xs)}</g>'
    )
    parts.append("</svg>")
    return "".join(parts)


def price_level_svg(series: pd.DataFrame, real_dates: set[date],
                    company: str, moves: list | None = None,
                    macro_events: list | None = None) -> str:
    """A single panel: an unlisted share's indicative price level over time.

    ``series`` is the as-displayed daily frame (forward-fill included) -
    the same convention UnlistedZone's own chart uses, so the line matches
    what a reader would see there. ``real_dates`` marks which of those days
    were genuine revisions with a small dot; everywhere else the line is
    held flat, not observed. ``moves`` (optional, ranked) gets the same
    numbered-badge-with-dated-label treatment ``timeline_svg`` uses for
    incidents, so a reader can tell which ranked price-move gap is which.
    """
    if series.empty:
        return '<p class="empty">No price data in the analysis window.</p>'

    dates = [pd.Timestamp(d).date() for d in series.index]
    n = len(dates)
    xs = _x_positions(n, WIDTH)
    closes = series["close"].astype(float).tolist()

    move_rank: dict[date, int] = {}
    move_tooltip: dict[date, str] = {}
    for rank, move in enumerate(moves or [], 1):
        move_rank[move.end_date] = rank
        move_tooltip[move.end_date] = (
            f"#{rank} {move.start_date:%d %b %Y} to {move.end_date:%d %b %Y}: "
            f"{move.change * 100:+.2f}% — see the ranked list below"
        )

    has_badges = bool(moves)
    top_caption_h = 18.0 if has_badges else 0.0
    price_h = 260.0
    price_y = PAD_TOP + top_caption_h
    total_h = price_y + price_h + LABEL_BAND + 14

    parts = [
        f'<svg viewBox="0 0 {WIDTH} {total_h:.0f}" class="timeline" '
        f'preserveAspectRatio="xMidYMid meet" role="img" '
        f'aria-label="Indicative price timeline">'
    ]
    if has_badges:
        parts.append(
            f'<text x="{PAD_LEFT}" y="{PAD_TOP - 4:.1f}" class="chart-caption">'
            "Numbered circles mark the ranked price moves below, each dated "
            "underneath. Dots are real revisions — elsewhere the line is flat, "
            "not observed.</text>"
        )

    low, high = min(closes), max(closes)
    span = (high - low) or 1.0
    low, high = low - span * 0.08, high + span * 0.08

    def price_y_of(v: float) -> float:
        return price_y + price_h - (v - low) / (high - low) * price_h

    parts.append(_panel_frame(price_y, price_h, f"{company} — indicative price (₹)"))
    parts.append(_y_axis(price_y, price_h, low, high, "{:,.0f}"))

    points = " ".join(f"{x:.1f},{price_y_of(v):.1f}" for x, v in zip(xs, closes))
    parts.append(f'<polyline points="{points}" class="line-company"/>')

    badge_r = 9.0
    badge_cy = price_y + 15.0
    for x, day, value in zip(xs, dates, closes):
        if day in real_dates:
            parts.append(
                f'<circle cx="{x:.1f}" cy="{price_y_of(value):.1f}" r="2.5" '
                f'class="real-point"><title>{day:%d %b %Y}: ₹{value:,.2f} '
                "(revised)</title></circle>"
            )
        rank = move_rank.get(day)
        if rank is None:
            continue
        parts.append(
            f'<line x1="{x:.1f}" y1="{price_y:.1f}" x2="{x:.1f}" '
            f'y2="{price_y + price_h:.1f}" class="incident-rule"/>'
        )
        tooltip = escape(move_tooltip.get(day, f"{day:%d %b %Y}: price move"))
        parts.append(
            f'<g class="incident-badge">'
            f'<circle cx="{x:.1f}" cy="{badge_cy:.1f}" r="{badge_r}"/>'
            f'<text x="{x:.1f}" y="{badge_cy + 3.5:.1f}" text-anchor="middle">{rank}</text>'
            f"<title>{tooltip}</title></g>"
        )
        date_label = f"{day:%d %b}"
        label_y = badge_cy + badge_r + 11.0
        label_w = len(date_label) * 5.4 + 6.0
        parts.append(
            f'<rect x="{x - label_w / 2:.1f}" y="{label_y - 9.0:.1f}" '
            f'width="{label_w:.1f}" height="12" rx="2" class="badge-date-bg"/>'
            f'<text x="{x:.1f}" y="{label_y:.1f}" text-anchor="middle" '
            f'class="badge-date">{date_label}</text>'
        )

    parts.append(_macro_markers(macro_events or [], dates, xs, price_y + price_h))

    parts.append(
        f'<g transform="translate(0,{price_y + price_h + 16:.1f})">'
        f'{_date_labels(dates, xs)}</g>'
    )
    parts.append("</svg>")
    return "".join(parts)


def news_coverage_svg(series: pd.DataFrame, items: list, company: str) -> str:
    """A single panel: collected news volume (bar height) and tone (colour),
    one bar per calendar day, over the same day axis ``price_level_svg``
    plots for the same window - so the two panels line up and a reader can
    see what was published against the price line directly above it.

    Deliberately not part of ``price_level_svg`` itself and not gated on any
    price statistic: unlike an abnormal-return panel, a day's news count and
    tone need nothing from the price series to be honestly described, so
    this exists for unlisted reports even though a market-model abnormal
    return does not (see ``ceia/unlisted.py``'s module docstring).
    """
    if series.empty:
        return '<p class="empty">No price data in the analysis window.</p>'

    dates = [pd.Timestamp(d).date() for d in series.index]
    n = len(dates)
    xs = _x_positions(n, WIDTH)

    counts = {d: 0 for d in dates}
    tone_sum = {d: 0.0 for d in dates}
    for item in items:
        if item.published_at is None:
            continue
        day = item.published_at.date()
        if day not in counts:
            continue
        counts[day] += 1
        tone_sum[day] += item.sentiment_score

    cov_h = 130.0
    cov_y = PAD_TOP
    total_h = cov_y + cov_h + LABEL_BAND + 14
    max_count = max(counts.values(), default=0) or 1

    parts = [
        f'<svg viewBox="0 0 {WIDTH} {total_h:.0f}" class="timeline" '
        f'preserveAspectRatio="xMidYMid meet" role="img" '
        f'aria-label="News coverage timeline">'
        '<defs><pattern id="neg-hatch-news" width="6" height="6" '
        'patternTransform="rotate(45)" patternUnits="userSpaceOnUse">'
        '<line x1="0" y1="0" x2="0" y2="6" class="hatch-line"/></pattern></defs>'
    ]
    parts.append(_panel_frame(
        cov_y, cov_h, f"{company} — news volume (bar height) and tone (colour)"))
    parts.append(_y_axis(cov_y, cov_h, 0, max_count))

    band = (WIDTH - PAD_LEFT - PAD_RIGHT) / n
    bar_w = max(2.0, min(band * 0.62, 26.0))
    for x, day in zip(xs, dates):
        count = counts[day]
        if count <= 0:
            continue
        tone = tone_sum[day] / count
        height = count / max_count * cov_h
        css = ("tone-neg" if tone <= -0.15 else
               "tone-pos" if tone >= 0.15 else "tone-neutral")
        bar_y = cov_y + cov_h - height
        parts.append(
            f'<rect x="{x - bar_w / 2:.1f}" y="{bar_y:.1f}" '
            f'width="{bar_w:.1f}" height="{height:.1f}" class="{css}">'
            f'<title>{day:%d %b %Y}: {count} item(s), tone {tone:+.2f}</title></rect>'
        )
        if css == "tone-neg":
            parts.append(
                f'<rect x="{x - bar_w / 2:.1f}" y="{bar_y:.1f}" width="{bar_w:.1f}" '
                f'height="{height:.1f}" fill="url(#neg-hatch-news)" pointer-events="none"/>'
            )

    parts.append(
        f'<g transform="translate(0,{cov_y + cov_h + 16:.1f})">'
        f'{_date_labels(dates, xs)}</g>'
    )
    parts.append("</svg>")
    return "".join(parts)


def index_sparkline_svg(daily: pd.DataFrame) -> str:
    """A tiny trend line for one Nifty index's rebased price path over the
    analysis window - deliberately not a full chart with axes or hover: the
    Nifty section in the report is a table of six indices (see
    ``ceia.report._nifty_section``), and a full multi-panel timeline per
    index would compete with, rather than support, the company's own chart.
    Coloured green/red by whether the index ended the window up or down.
    """
    if daily.empty or len(daily) < 2:
        return '<span class="note">—</span>'
    values = daily["level"].astype(float).tolist()
    low, high = min(values), max(values)
    span = (high - low) or 1.0
    w, h, pad = 110.0, 26.0, 2.0
    n = len(values)
    xs = [pad + i * (w - 2 * pad) / (n - 1) for i in range(n)]

    def y_of(v: float) -> float:
        return h - pad - (v - low) / span * (h - 2 * pad)

    points = " ".join(f"{x:.1f},{y_of(v):.1f}" for x, v in zip(xs, values))
    css = "spark-pos" if values[-1] >= values[0] else "spark-neg"
    return (f'<svg viewBox="0 0 {w:.0f} {h:.0f}" class="spark" role="img" '
            f'aria-hidden="true"><polyline points="{points}" class="{css}"/></svg>')


def forecast_cone_svg(forecasting: dict, close_series: pd.Series | None = None) -> str:
    """Institutional Vector SVG Forecast Cone chart with smooth multi-vertex diffusion polygon.

    Displays historical price trajectory seamlessly connecting to forward
    P10 (Bear Floor), P50 (Base/Median), and P90 (Bull Ceiling) projections
    with a shaded conformal uncertainty envelope, 5D/21D/63D horizon targets,
    and interactive hover nodes.
    """
    if not forecasting or not forecasting.get("available"):
        return '<div class="empty">Forecasting trajectory data unavailable.</div>'

    horizons = forecasting.get("horizons") or {}
    h5 = horizons.get("5") or horizons.get(5) or {}
    h21 = horizons.get("21") or horizons.get(21) or {}
    h63 = horizons.get("63") or horizons.get(63) or {}

    curr_p = float(forecasting.get("current_price", 100.0))
    if not h5 or not h21 or not h63:
        return '<div class="empty">Multi-horizon forecast models incomplete.</div>'

    har_obj = forecasting.get("har_volatility") or {}
    har_vol = float(har_obj.get("forecast_21d_annualized", har_obj.get("forecast_volatility_21d", 0.22)))
    asym_ratio = float(har_obj.get("leverage_asymmetry_ratio", 1.25))

    # Extract historical tail
    hist_prices = []
    if close_series is not None and not close_series.empty:
        hist_prices = close_series.dropna().tail(35).astype(float).tolist()
    if not hist_prices:
        hist_prices = [curr_p * (1.0 - 0.02 * (30 - i) / 30) for i in range(30)]

    p50_5 = float(h5.get("p50_base_price", curr_p))
    p90_5 = float(h5.get("p90_bull_price", curr_p * 1.05))
    p10_5 = float(h5.get("p10_bear_price", curr_p * 0.95))

    p50_21 = float(h21.get("p50_base_price", curr_p * 1.02))
    p90_21 = float(h21.get("p90_bull_price", curr_p * 1.10))
    p10_21 = float(h21.get("p10_bear_price", curr_p * 0.90))

    p50_63 = float(h63.get("p50_base_price", curr_p * 1.05))
    p90_63 = float(h63.get("p90_bull_price", curr_p * 1.18))
    p10_63 = float(h63.get("p10_bear_price", curr_p * 0.82))

    mu5 = (p50_5 - curr_p) / curr_p if curr_p > 0 else 0.0
    mu21 = (p50_21 - curr_p) / curr_p if curr_p > 0 else 0.0
    mu63 = (p50_63 - curr_p) / curr_p if curr_p > 0 else 0.0

    all_vals = hist_prices + [p10_5, p90_5, p10_21, p90_21, p10_63, p90_63]
    low_val = min(all_vals) * 0.95
    high_val = max(all_vals) * 1.05
    span = high_val - low_val or 1.0

    width = 1000.0
    height = 320.0
    pad_left = 70.0
    pad_right = 80.0
    pad_top = 52.0
    pad_bottom = 54.0

    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    def y_coord(val: float) -> float:
        y = pad_top + plot_h - ((val - low_val) / span) * plot_h
        return max(pad_top, min(pad_top + plot_h, y))

    # Split plot horizontally: 52% historical, 48% forward forecast cone
    x_split = pad_left + plot_w * 0.52
    n_hist = len(hist_prices)
    hist_step = (x_split - pad_left) / max(n_hist - 1, 1)
    hist_pts = [(pad_left + i * hist_step, y_coord(p)) for i, p in enumerate(hist_prices)]

    # Forward horizon x-coords
    x_now = x_split
    forward_w = pad_left + plot_w - x_now
    x_5d = x_now + forward_w * (5.0 / 63.0)
    x_21d = x_now + forward_w * (21.0 / 63.0)
    x_63d = x_now + forward_w

    y_now = y_coord(curr_p)
    y_p50_5 = y_coord(p50_5)
    y_p90_5 = y_coord(p90_5)
    y_p10_5 = y_coord(p10_5)

    y_p50_21 = y_coord(p50_21)
    y_p90_21 = y_coord(p90_21)
    y_p10_21 = y_coord(p10_21)

    y_p50_63 = y_coord(p50_63)
    y_p90_63 = y_coord(p90_63)
    y_p10_63 = y_coord(p10_63)

    hist_line = " ".join(f"{x:.1f},{y:.1f}" for x, y in hist_pts)

    # Multi-Vertex Smooth Conformal Diffusion Polygon (14 sample points along diffusion path)
    t_steps = [0.0, 1.0, 2.0, 3.5, 5.0, 8.0, 12.0, 16.0, 21.0, 28.0, 35.0, 44.0, 53.0, 63.0]
    upper_coords = []
    lower_coords = []
    p50_coords = []

    for t in t_steps:
        x_t = x_now + forward_w * (t / 63.0)
        if t <= 5.0:
            mu_t = mu5 * (t / 5.0)
        elif t <= 21.0:
            mu_t = mu5 + (mu21 - mu5) * ((t - 5.0) / 16.0)
        else:
            mu_t = mu21 + (mu63 - mu21) * ((t - 21.0) / 42.0)

        p_base = curr_p * (1.0 + mu_t)
        vol_spread = har_vol * np.sqrt(max(0.001, t) / 252.0) * curr_p
        
        p_up = p_base + 1.645 * vol_spread
        p_dn = p_base - 1.645 * vol_spread * asym_ratio

        upper_coords.append((x_t, y_coord(p_up)))
        lower_coords.append((x_t, y_coord(p_dn)))
        p50_coords.append((x_t, y_coord(p_base)))

    # Closed polygon: forward along upper boundary, backward along lower boundary
    poly_pts = [f"{x:.1f},{y:.1f}" for x, y in upper_coords] + [f"{x:.1f},{y:.1f}" for x, y in reversed(lower_coords)]
    envelope_pts = " ".join(poly_pts)

    p90_line = " ".join(f"{x:.1f},{y:.1f}" for x, y in upper_coords)
    p10_line = " ".join(f"{x:.1f},{y:.1f}" for x, y in lower_coords)
    p50_line = " ".join(f"{x:.1f},{y:.1f}" for x, y in p50_coords)

    ticks = _nice_ticks(low_val, high_val, 5)

    svg = [
        f'<svg id="forecastConeSvg" viewBox="0 0 {width:.0f} {height:.0f}" class="timeline" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Forecast Trajectory Cones" style="overflow:hidden;" '
        f'data-p0="{curr_p:.2f}" data-har-vol="{har_vol:.4f}" data-asym="{asym_ratio:.3f}" data-xnow="{x_now:.1f}" data-ynow="{y_now:.1f}" '
        f'data-fw="{forward_w:.1f}" data-low="{low_val:.2f}" data-high="{high_val:.2f}" data-ploth="{plot_h:.1f}" data-padtop="{pad_top:.1f}" '
        f'data-mu5="{mu5:.4f}" data-mu21="{mu21:.4f}" data-mu63="{mu63:.4f}">',
        '<defs>',
        '<linearGradient id="coneGradient" x1="0" y1="0" x2="1" y2="0">',
        '  <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.32"/>',
        '  <stop offset="50%" stop-color="#0099ff" stop-opacity="0.22"/>',
        '  <stop offset="100%" stop-color="#00d4ff" stop-opacity="0.08"/>',
        '</linearGradient>',
        '<filter id="glow" x="-20%" y="-20%" width="140%" height="140%">',
        '  <feGaussianBlur stdDeviation="3" result="blur" />',
        '  <feComposite in="SourceGraphic" in2="blur" operator="over" />',
        '</filter>',
        f'<clipPath id="forecastPlotClip"><rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" rx="4"/></clipPath>',
        '</defs>',
        # Background Grid & Frame
        f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" fill="var(--bg-subtle, #14171d)" stroke="var(--line, #252a34)" rx="4"/>',
    ]

    # Horizontal Price Gridlines
    for tick in ticks:
        if low_val <= tick <= high_val:
            yt = y_coord(tick)
            svg.append(f'<line x1="{pad_left}" y1="{yt:.1f}" x2="{pad_left + plot_w}" y2="{yt:.1f}" stroke="var(--line, #252a34)" stroke-dasharray="3 3"/>')
            svg.append(f'<text x="{pad_left - 10}" y="{yt + 4:.1f}" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" fill="var(--muted, #8b949e)">₹{tick:,.0f}</text>')

    # Historical / Forward Divider
    svg.append(f'<line x1="{x_now:.1f}" y1="{pad_top}" x2="{x_now:.1f}" y2="{pad_top + plot_h}" stroke="var(--bbg-amber, #ff9900)" stroke-width="1.5" stroke-dasharray="4 4"/>')
    svg.append(f'<text x="{x_now - 10:.1f}" y="{pad_top - 8}" text-anchor="end" font-size="10" font-weight="700" font-family="var(--font-mono, monospace)" fill="var(--bbg-amber, #ff9900)">Historical Close</text>')
    svg.append(f'<text x="{x_now + 10:.1f}" y="{pad_top - 8}" text-anchor="start" font-size="10" font-weight="700" font-family="var(--font-mono, monospace)" fill="var(--bbg-cyan, #00d4ff)">Forecast Cones →</text>')

    # Forward Horizon Guides & Labels
    for x_h, lbl, exp_p, h_key in [(x_5d, "5D Tactical", p50_5, "5"), (x_21d, "21D Swing", p50_21, "21"), (x_63d, "63D Fundamental", p50_63, "63")]:
        svg.append(f'<line id="fc-guide-{h_key}" x1="{x_h:.1f}" y1="{pad_top}" x2="{x_h:.1f}" y2="{pad_top + plot_h}" stroke="var(--line-highlight, #3a4252)" stroke-dasharray="2 4" style="transition:all 0.2s;"/>')
        svg.append(f'<text id="fc-lbl-{h_key}" x="{x_h:.1f}" y="{height - pad_bottom + 18}" text-anchor="middle" font-size="10" font-weight="700" font-family="var(--font-mono, monospace)" fill="var(--sub, #b1bac4)">{lbl}</text>')
        svg.append(f'<text x="{x_h:.1f}" y="{height - pad_bottom + 32}" text-anchor="middle" font-size="9.5" font-family="var(--font-mono, monospace)" fill="var(--muted, #8b949e)">₹{exp_p:,.1f}</text>')

    # Group with Clip-Path for Plot Area
    svg.append('<g clip-path="url(#forecastPlotClip)">')
    # Shaded Conformal Envelope Polygon
    svg.append(f'<polygon id="forecastEnvelope" points="{envelope_pts}" fill="url(#coneGradient)" stroke="rgba(0, 212, 255, 0.4)" stroke-width="0.8" style="transition:all 0.15s ease-out;"/>')

    # Historical Price Path
    svg.append(f'<polyline points="{hist_line}" fill="none" stroke="var(--fg, #e2e8f0)" stroke-width="2" stroke-linejoin="round"/>')

    # Forecast Paths
    svg.append(f'<polyline id="forecastP90Line" points="{p90_line}" fill="none" stroke="var(--pos, #00e676)" stroke-width="1.8" stroke-dasharray="4 2" style="transition:all 0.15s ease-out;"/>')
    svg.append(f'<polyline id="forecastP10Line" points="{p10_line}" fill="none" stroke="var(--neg, #ff3333)" stroke-width="1.8" stroke-dasharray="4 2" style="transition:all 0.15s ease-out;"/>')
    svg.append(f'<polyline id="forecastP50Line" points="{p50_line}" fill="none" stroke="var(--bbg-cyan, #00d4ff)" stroke-width="2.5" stroke-linejoin="round" style="transition:all 0.15s ease-out;"/>')
    svg.append('</g>')

    # Active Focus Guideline & Halo Ring Group
    svg.append(
        f'<g id="forecastHorizonMarker" style="display:none;pointer-events:none;">'
        f'<line id="horizonFocusLine" x1="{x_21d:.1f}" y1="{pad_top}" x2="{x_21d:.1f}" y2="{pad_top + plot_h}" stroke="var(--bbg-cyan, #00d4ff)" stroke-width="2" stroke-dasharray="4 3"/>'
        f'<circle id="targetHalo" cx="{x_21d:.1f}" cy="{y_p50_21:.1f}" r="11" fill="none" stroke="var(--bbg-cyan, #00d4ff)" stroke-width="2" opacity="0.9" style="filter:url(#glow);"/>'
        f'</g>'
    )

    # Interactive Target Nodes
    ret_5 = f"{h5.get('expected_return_pct', 0):+.2f}%"
    ret_21 = f"{h21.get('expected_return_pct', 0):+.2f}%"
    ret_63 = f"{h63.get('expected_return_pct', 0):+.2f}%"
    ret_63_bull = f"{h63.get('p90_bull_return_pct', 0):+.2f}%"
    ret_63_bear = f"{h63.get('p10_bear_return_pct', 0):+.2f}%"

    svg.append(
        f'<circle id="fc-dot-now" class="fc-interactive-dot" cx="{x_now:.1f}" cy="{y_now:.1f}" r="5.5" fill="var(--bbg-amber, #ff9900)" stroke="#fff" stroke-width="1.5" '
        f'style="cursor:pointer;transition:r 0.2s;" onmouseover="showForecastTip(event, &apos;As of Last Close&apos;, &apos;₹{curr_p:,.2f}&apos;, &apos;Base Reference&apos;, &apos;₹{curr_p:,.2f}&apos;, &apos;₹{curr_p:,.2f}&apos;)" onmouseout="hideForecastTip()"/>'
    )
    svg.append(
        f'<circle id="fc-dot-5" class="fc-interactive-dot" cx="{x_5d:.1f}" cy="{y_p50_5:.1f}" r="5.5" fill="var(--bbg-cyan, #00d4ff)" stroke="#fff" stroke-width="1.5" '
        f'style="cursor:pointer;transition:r 0.2s;" onmouseover="showForecastTip(event, &apos;5-Day Tactical&apos;, &apos;₹{p50_5:,.2f}&apos;, &apos;{ret_5}&apos;, &apos;₹{p10_5:,.2f}&apos;, &apos;₹{p90_5:,.2f}&apos;)" onmouseout="hideForecastTip()"/>'
    )
    svg.append(
        f'<circle id="fc-dot-21" class="fc-interactive-dot" cx="{x_21d:.1f}" cy="{y_p50_21:.1f}" r="6.0" fill="var(--bbg-cyan, #00d4ff)" stroke="#fff" stroke-width="1.5" '
        f'style="cursor:pointer;transition:r 0.2s;" onmouseover="showForecastTip(event, &apos;21-Day Monthly Swing&apos;, &apos;₹{p50_21:,.2f}&apos;, &apos;{ret_21}&apos;, &apos;₹{p10_21:,.2f}&apos;, &apos;₹{p90_21:,.2f}&apos;)" onmouseout="hideForecastTip()"/>'
    )
    svg.append(
        f'<circle id="fc-dot-63" class="fc-interactive-dot" cx="{x_63d:.1f}" cy="{y_p50_63:.1f}" r="5.5" fill="var(--bbg-cyan, #00d4ff)" stroke="#fff" stroke-width="1.5" '
        f'style="cursor:pointer;transition:r 0.2s;" onmouseover="showForecastTip(event, &apos;63-Day Fundamental&apos;, &apos;₹{p50_63:,.2f}&apos;, &apos;{ret_63}&apos;, &apos;₹{p10_63:,.2f}&apos;, &apos;₹{p90_63:,.2f}&apos;)" onmouseout="hideForecastTip()"/>'
    )
    svg.append(
        f'<circle id="fc-dot-63-bull" class="fc-interactive-dot" cx="{x_63d:.1f}" cy="{y_p90_63:.1f}" r="4.5" fill="var(--pos, #00e676)" '
        f'style="cursor:pointer;" onmouseover="showForecastTip(event, &apos;63D Bull Ceiling (P90)&apos;, &apos;₹{p90_63:,.2f}&apos;, &apos;{ret_63_bull}&apos;, &apos;—&apos;, &apos;—&apos;)" onmouseout="hideForecastTip()"/>'
    )
    svg.append(
        f'<circle id="fc-dot-63-bear" class="fc-interactive-dot" cx="{x_63d:.1f}" cy="{y_p10_63:.1f}" r="4.5" fill="var(--neg, #ff3333)" '
        f'style="cursor:pointer;" onmouseover="showForecastTip(event, &apos;63D Bear Floor (P10)&apos;, &apos;₹{p10_63:,.2f}&apos;, &apos;{ret_63_bear}&apos;, &apos;—&apos;, &apos;—&apos;)" onmouseout="hideForecastTip()"/>'
    )

    # Axis Titles
    y_mid_fc = pad_top + plot_h / 2.0
    svg.append(f'<text x="18" y="{y_mid_fc:.1f}" font-size="9" font-weight="700" font-family="var(--font-mono, monospace)" fill="var(--muted, #8b949e)" transform="rotate(-90 18 {y_mid_fc:.1f})" text-anchor="middle">SHARE PRICE (₹)</text>')
    svg.append(f'<text x="{pad_left + plot_w/2.0:.1f}" y="{height - 6}" font-size="9" font-weight="700" font-family="var(--font-mono, monospace)" fill="var(--muted, #8b949e)" text-anchor="middle">TRADING HORIZON (HISTORICAL CLOSE &rarr; 5D / 21D / 63D FORECAST CONES)</text>')

    # Top Header & Legend Strip
    svg.append(f'<text x="{pad_left}" y="22" font-size="12" font-weight="700" font-family="var(--font-mono, monospace)" fill="var(--fg, #e2e8f0)">Probabilistic Price Trajectory &amp; Multi-Horizon Conformal Cones</text>')
    svg.append(f'<text x="{width - pad_right}" y="22" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" fill="var(--muted, #8b949e)">'
               f'<tspan fill="var(--pos, #00e676)">● P90 Bull Ceiling (Green)</tspan> &nbsp;·&nbsp; '
               f'<tspan fill="var(--bbg-cyan, #00d4ff)">● P50 Base (Cyan)</tspan> &nbsp;·&nbsp; '
               f'<tspan fill="var(--neg, #ff3333)">● P10 Bear Floor (Red)</tspan></text>')

    svg.append("</svg>")
    return "".join(svg)


def shap_waterfall_svg(xai_data: dict, width: int = 850, height: int = 280) -> str:
    """Generate interactive SVG horizontal waterfall chart for SHAP feature attribution."""
    if not xai_data or "contributions" not in xai_data:
        return ""

    contributions = xai_data.get("contributions", [])
    base_val = float(xai_data.get("base_expected_return", 0.005)) * 100.0
    final_val = float(xai_data.get("final_forecasted_return", 0.0)) * 100.0

    pad_left = 220
    pad_right = 90
    pad_top = 45
    pad_bottom = 35
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    n_bars = len(contributions) + 2  # Base + Features + Final
    row_h = plot_h / max(n_bars, 1)

    # Compute cumulative values for waterfall
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
        f'style="background:var(--card-bg, #0d1117);border:1px solid var(--border, #30363d);border-radius:6px;font-family:var(--font-mono, monospace);">'
    ]

    # Header
    svg.append(f'<text x="{pad_left}" y="22" font-size="12" font-weight="700" fill="var(--fg, #e2e8f0)">SHAP (SHapley Additive exPlanations) Factor Attribution</text>')
    svg.append(f'<text x="{width - pad_right}" y="22" text-anchor="end" font-size="10" fill="var(--muted, #8b949e)">Base: {base_val:+.2f}% &rarr; Forecast: {final_val:+.2f}%</text>')

    # Zero line
    x_zero = x_scale(0.0)
    svg.append(f'<line x1="{x_zero}" y1="{pad_top}" x2="{x_zero}" y2="{height - pad_bottom}" stroke="#484f58" stroke-dasharray="3 3"/>')

    # 1. Base value bar
    y_0 = pad_top + 0 * row_h + 4
    x_b0 = x_scale(0.0)
    x_b1 = x_scale(base_val)
    bx = min(x_b0, x_b1)
    bw = max(abs(x_b1 - x_b0), 2.0)
    svg.append(f'<text x="{pad_left - 10}" y="{y_0 + row_h*0.6}" text-anchor="end" font-size="10" fill="var(--muted, #8b949e)">Historical Base Drift</text>')
    svg.append(f'<rect x="{bx}" y="{y_0}" width="{bw}" height="{row_h - 6}" rx="3" fill="#6e7681"/>')
    svg.append(f'<text x="{max(bx + bw + 6, x_b1 + 6)}" y="{y_0 + row_h*0.6}" font-size="10" fill="#c9d1d9">{base_val:+.2f}%</text>')

    # 2. Factor contributions
    running_start = base_val
    for i, c in enumerate(contributions):
        y_i = pad_top + (i + 1) * row_h + 4
        f_name = c.get("feature_name", f"Factor {i+1}")
        phi = float(c.get("shapley_value", 0.0)) * 100.0
        running_end = running_start + phi

        x_s0 = x_scale(running_start)
        x_s1 = x_scale(running_end)
        bar_x = min(x_s0, x_s1)
        bar_w = max(abs(x_s1 - x_s0), 2.0)
        fill_col = "var(--pos, #00e676)" if phi >= 0 else "var(--neg, #ff3333)"

        svg.append(f'<text x="{pad_left - 10}" y="{y_i + row_h*0.6}" text-anchor="end" font-size="10" fill="var(--fg, #e2e8f0)">{f_name[:28]}</text>')
        svg.append(f'<rect x="{bar_x}" y="{y_i}" width="{bar_w}" height="{row_h - 6}" rx="3" fill="{fill_col}"/>')
        label_x = bar_x + bar_w + 6 if phi >= 0 else bar_x - 6
        anchor = "start" if phi >= 0 else "end"
        svg.append(f'<text x="{label_x}" y="{y_i + row_h*0.6}" text-anchor="{anchor}" font-size="10" font-weight="600" fill="{fill_col}">{phi:+.2f}%</text>')

        running_start = running_end

    # 3. Final Forecast bar
    y_f = pad_top + (len(contributions) + 1) * row_h + 4
    x_f0 = x_scale(0.0)
    x_f1 = x_scale(final_val)
    fx = min(x_f0, x_f1)
    fw = max(abs(x_f1 - x_f0), 2.0)
    final_col = "var(--bbg-cyan, #00d4ff)"
    svg.append(f'<text x="{pad_left - 10}" y="{y_f + row_h*0.6}" text-anchor="end" font-size="10" font-weight="700" fill="var(--bbg-cyan, #00d4ff)">Final Forecast Target</text>')
    svg.append(f'<rect x="{fx}" y="{y_f}" width="{fw}" height="{row_h - 6}" rx="3" fill="{final_col}"/>')
    svg.append(f'<text x="{max(fx + fw + 6, x_f1 + 6)}" y="{y_f + row_h*0.6}" font-size="10" font-weight="700" fill="var(--bbg-cyan, #00d4ff)">{final_val:+.2f}%</text>')

    # Bottom X-axis Title
    svg.append(f'<text x="{pad_left + plot_w/2.0:.1f}" y="{height - 6}" font-size="8.5" font-weight="700" fill="var(--muted, #8b949e)" text-anchor="middle">SHAPLEY VALUE CONTRIBUTION TO 21D EXPECTED RETURN (%)</text>')

    svg.append("</svg>")
    return "".join(svg)


def hrp_allocation_svg(portfolio_data: dict, width: int = 850, height: int = 240) -> str:
    """Generate SVG bar chart visualizing Hierarchical Risk Parity (HRP) asset weights."""
    if not portfolio_data or "weights" not in portfolio_data:
        return ""

    weights = portfolio_data.get("weights", {})
    sorted_items = sorted(weights.items(), key=lambda x: x[1], reverse=True)[:12]
    if not sorted_items:
        return ""

    pad_left = 180
    pad_right = 60
    pad_top = 45
    pad_bottom = 25
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    max_w = max(w for _, w in sorted_items) * 1.2
    row_h = plot_h / max(len(sorted_items), 1)

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:var(--card-bg, #0d1117);border:1px solid var(--border, #30363d);border-radius:6px;font-family:var(--font-mono, monospace);">'
    ]
    svg.append(f'<text x="{pad_left}" y="22" font-size="12" font-weight="700" fill="var(--fg, #e2e8f0)">Hierarchical Risk Parity (HRP) Optimal Risk Allocation</text>')
    svg.append(f'<text x="{width - pad_right}" y="22" text-anchor="end" font-size="10" fill="var(--muted, #8b949e)">Div Ratio: {portfolio_data.get("diversification_ratio", 1.0):.2f}</text>')

    for i, (asset, w) in enumerate(sorted_items):
        y_i = pad_top + i * row_h + 3
        bar_len = (w / max_w) * plot_w
        pct_str = f"{w*100:.1f}%"

        svg.append(f'<text x="{pad_left - 10}" y="{y_i + row_h*0.6}" text-anchor="end" font-size="10" fill="var(--fg, #e2e8f0)">{asset[:22]}</text>')
        svg.append(f'<rect x="{pad_left}" y="{y_i}" width="{bar_len}" height="{row_h - 6}" rx="3" fill="var(--bbg-cyan, #00d4ff)"/>')
        svg.append(f'<text x="{pad_left + bar_len + 6}" y="{y_i + row_h*0.6}" font-size="10" fill="#c9d1d9">{pct_str}</text>')

    # Bottom X-axis Title
    svg.append(f'<text x="{pad_left + plot_w/2.0:.1f}" y="{height - 5}" font-size="8.5" font-weight="700" fill="var(--muted, #8b949e)" text-anchor="middle">HRP RISK-PARITY ALLOCATION WEIGHT (%)</text>')

    svg.append("</svg>")
    return "".join(svg)


def spillover_heatmap_svg(spillover_data: dict, width: int = 850, height: int = 250) -> str:
    """Generate SVG visualization of Diebold-Yilmaz Volatility Connectedness & Spillovers."""
    if not spillover_data or "net_spillover" not in spillover_data:
        return ""

    net_spills = spillover_data.get("net_spillover", {})
    tci = spillover_data.get("total_connectedness_index", 0.0)
    sorted_spills = sorted(net_spills.items(), key=lambda x: x[1], reverse=True)[:10]

    pad_left = 180
    pad_right = 70
    pad_top = 45
    pad_bottom = 25
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    max_abs = max([abs(v) for _, v in sorted_spills] + [1.0])
    row_h = plot_h / max(len(sorted_spills), 1)

    svg = [
        f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
        f'style="background:var(--card-bg, #0d1117);border:1px solid var(--border, #30363d);border-radius:6px;font-family:var(--font-mono, monospace);">'
    ]
    svg.append(f'<text x="{pad_left}" y="22" font-size="12" font-weight="700" fill="var(--fg, #e2e8f0)">Diebold-Yilmaz Volatility Spillover (Total Connectedness: {tci:.1f}%)</text>')
    svg.append(f'<text x="{width - pad_right}" y="22" text-anchor="end" font-size="10" fill="var(--muted, #8b949e)">Net Volatility Transmission (%)</text>')

    x_mid = pad_left + plot_w / 2.0
    svg.append(f'<line x1="{x_mid}" y1="{pad_top}" x2="{x_mid}" y2="{height - pad_bottom}" stroke="#484f58" stroke-dasharray="3 3"/>')

    for i, (asset, net_val) in enumerate(sorted_spills):
        y_i = pad_top + i * row_h + 3
        bar_len = (abs(net_val) / max_abs) * (plot_w / 2.0)

        if net_val >= 0:
            bar_x = x_mid
            fill_c = "var(--neg, #ff3333)"  # Transmitter (risk spreader)
            label_x = bar_x + bar_len + 6
            anchor = "start"
            tag = f"+{net_val:.1f}% (Transmitter)"
        else:
            bar_x = x_mid - bar_len
            fill_c = "var(--pos, #00e676)"  # Receiver (absorber)
            label_x = bar_x - 6
            anchor = "end"
            tag = f"{net_val:.1f}% (Receiver)"

        svg.append(f'<text x="{pad_left - 10}" y="{y_i + row_h*0.6}" text-anchor="end" font-size="10" fill="var(--fg, #e2e8f0)">{asset[:22]}</text>')
        svg.append(f'<rect x="{bar_x}" y="{y_i}" width="{bar_len}" height="{row_h - 6}" rx="3" fill="{fill_c}"/>')
        svg.append(f'<text x="{label_x}" y="{y_i + row_h*0.6}" text-anchor="{anchor}" font-size="10" fill="{fill_c}">{tag}</text>')

    # Bottom X-axis Title
    svg.append(f'<text x="{pad_left + plot_w/2.0:.1f}" y="{height - 5}" font-size="8.5" font-weight="700" fill="var(--muted, #8b949e)" text-anchor="middle">NET VOLATILITY SPILLOVER (% TRANSMITTED VS RECEIVED)</text>')

    svg.append("</svg>")
    return "".join(svg)


def regime_timeline_svg(regime_data: dict, width: int = 850, height: int = 240) -> str:
    """Generate SVG timeline of Hamilton Markov-Switching Crisis Regime Probabilities."""
    if not regime_data or "regime_timeline" not in regime_data:
        return ""

    timeline = regime_data.get("regime_timeline", [])
    if not timeline:
        return ""

    pad_left = 68
    pad_right = 35
    pad_top = 45
    pad_bottom = 35
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    n_pts = len(timeline)
    dx = plot_w / max(n_pts - 1, 1)

    pts_crisis = []
    pts_tranquil = []
    max_crisis = 0.0
    max_c_idx = 0
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
        f'style="background:var(--card-bg, #0d1117);border:1px solid var(--border, #30363d);border-radius:6px;font-family:var(--font-mono, monospace);">'
    ]
    curr_reg = regime_data.get("current_regime", "Normal")
    svg.append(f'<text x="{pad_left}" y="22" font-size="12" font-weight="700" fill="var(--fg, #e2e8f0)">Hamilton Markov-Switching Market Regime Tracker: <tspan fill="var(--bbg-amber, #ff9900)">{curr_reg}</tspan></text>')
    svg.append(f'<text x="{width - pad_right}" y="22" text-anchor="end" font-size="10" fill="var(--muted, #8b949e)">'
               f'<tspan fill="var(--neg, #ff3333)">● P(Crisis)</tspan> &nbsp;·&nbsp; '
               f'<tspan fill="var(--pos, #00e676)">● P(Tranquil)</tspan></text>')

    # Background frame
    svg.append(f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" fill="var(--bg-subtle, #14171d)" stroke="var(--line, #252a34)" rx="3"/>')

    # Y-axis Title Label (Rotated)
    y_mid_plot = pad_top + plot_h / 2.0
    svg.append(f'<text x="16" y="{y_mid_plot:.1f}" font-size="8.5" font-weight="700" fill="var(--muted, #8b949e)" transform="rotate(-90 16 {y_mid_plot:.1f})" text-anchor="middle">REGIME PROBABILITY (%)</text>')

    # Shaded High-Turbulence Crisis Zone (>50%)
    y_50 = pad_top + plot_h * 0.5
    svg.append(f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h * 0.5}" fill="rgba(255, 51, 51, 0.06)"/>')
    svg.append(f'<text x="{pad_left + 10}" y="{pad_top + 14}" font-size="8.5" font-weight="700" fill="rgba(255, 51, 51, 0.75)">HIGH-TURBULENCE CRISIS REGIME (&gt;50%)</text>')

    # Y-axis Gridlines and Percentage Labels (0%, 25%, 50%, 75%, 100%)
    for p_val in [0.0, 0.25, 0.50, 0.75, 1.0]:
        y_p = pad_top + (1.0 - p_val) * plot_h
        dash = "none" if p_val in (0.0, 1.0) else "3 3"
        stroke_c = "#484f58" if p_val == 0.50 else "var(--line, #252a34)"
        if p_val not in (0.0, 1.0):
            svg.append(f'<line x1="{pad_left}" y1="{y_p:.1f}" x2="{pad_left + plot_w}" y2="{y_p:.1f}" stroke="{stroke_c}" stroke-dasharray="{dash}"/>')
        svg.append(f'<text x="{pad_left - 8}" y="{y_p + 3:.1f}" text-anchor="end" font-size="9" fill="var(--muted, #8b949e)">{int(p_val*100)}%</text>')

    # Polylines
    svg.append(f'<polyline points="{" ".join(pts_tranquil)}" fill="none" stroke="var(--pos, #00e676)" stroke-width="2.0" stroke-linejoin="round"/>')
    svg.append(f'<polyline points="{" ".join(pts_crisis)}" fill="none" stroke="var(--neg, #ff3333)" stroke-width="2.0" stroke-linejoin="round"/>')

    # Peak Crisis Callout Badge
    if max_crisis > 0.40 and n_pts > 0:
        pk_x = pad_left + max_c_idx * dx
        pk_y = pad_top + (1.0 - max_crisis) * plot_h
        pk_date = timeline[max_c_idx].get("date", "")
        svg.append(f'<circle cx="{pk_x:.1f}" cy="{pk_y:.1f}" r="4.5" fill="var(--neg, #ff3333)" stroke="#fff" stroke-width="1.5"/>')
        callout_x = min(pk_x + 10, width - 140)
        callout_y = max(pk_y - 8, pad_top + 18)
        svg.append(f'<text x="{callout_x:.1f}" y="{callout_y:.1f}" font-size="8.5" font-weight="700" fill="var(--neg, #ff3333)">Max Crisis: {max_crisis*100:.1f}% ({pk_date})</text>')

    # Multi-Point X-Axis Calendar Date Labels (5-6 evenly spaced ticks)
    n_ticks = min(6, n_pts)
    if n_ticks > 1:
        for k in range(n_ticks):
            idx_k = int(k * (n_pts - 1) / (n_ticks - 1))
            x_k = pad_left + idx_k * dx
            d_str = timeline[idx_k].get("date", "")
            svg.append(f'<line x1="{x_k:.1f}" y1="{pad_top + plot_h}" x2="{x_k:.1f}" y2="{pad_top + plot_h + 4}" stroke="#6e7681"/>')
            anchor = "start" if k == 0 else "end" if k == n_ticks - 1 else "middle"
            svg.append(f'<text x="{x_k:.1f}" y="{height - 12}" text-anchor="{anchor}" font-size="9" fill="var(--muted, #8b949e)">{d_str}</text>')

    # X-axis Title Label
    svg.append(f'<text x="{pad_left + plot_w/2.0:.1f}" y="{height - 2}" font-size="8.5" font-weight="700" fill="var(--muted, #8b949e)" text-anchor="middle">TRADING DAYS TIMELINE (HAMILTON MARKOV STATE DYNAMICS)</text>')

    svg.append("</svg>")
    return "".join(svg)


def microstructure_vpin_svg(micro_data: dict, width: int = 850, height: int = 240) -> str:
    """Generate SVG timeline of Volume-Synchronized Probability of Toxicity (VPIN)."""
    if not micro_data or "toxicity_series" not in micro_data:
        return ""

    series = micro_data.get("toxicity_series", [])
    if not series:
        return ""

    pad_left = 68
    pad_right = 35
    pad_top = 45
    pad_bottom = 35
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    n_pts = len(series)
    dx = plot_w / max(n_pts - 1, 1)

    pts_vpin = []
    max_vpin = 0.0
    max_idx = 0
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
        f'style="background:var(--card-bg, #0d1117);border:1px solid var(--border, #30363d);border-radius:6px;font-family:var(--font-mono, monospace);">'
    ]
    curr_vpin = micro_data.get("vpin_score", 0.2)
    regime_name = micro_data.get("vpin_regime", "Normal")
    svg.append(f'<text x="{pad_left}" y="22" font-size="12" font-weight="700" fill="var(--fg, #e2e8f0)">VPIN Order Flow Toxicity: <tspan fill="var(--bbg-cyan, #00d4ff)">{curr_vpin:.3f} ({regime_name})</tspan></text>')
    svg.append(f'<text x="{width - pad_right}" y="22" text-anchor="end" font-size="10" fill="var(--muted, #8b949e)">Kyle Lambda: {micro_data.get("kyle_lambda_bps_per_10m", 1.0):.1f} bps/10M</text>')

    # Background frame
    svg.append(f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" fill="var(--bg-subtle, #14171d)" stroke="var(--line, #252a34)" rx="3"/>')

    # Y-axis Title Label (Rotated)
    y_mid_plot = pad_top + plot_h / 2.0
    svg.append(f'<text x="16" y="{y_mid_plot:.1f}" font-size="8.5" font-weight="700" fill="var(--muted, #8b949e)" transform="rotate(-90 16 {y_mid_plot:.1f})" text-anchor="middle">VPIN METRIC (0 to 1)</text>')

    # Toxicity Danger Threshold (0.35) and Shaded Hazard Zone
    y_warn = pad_top + (1.0 - 0.35) * plot_h
    warn_h = plot_h * (1.0 - 0.35)
    svg.append(f'<rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{warn_h}" fill="rgba(255, 51, 51, 0.07)"/>')
    svg.append(f'<text x="{pad_left + 10}" y="{pad_top + 14}" font-size="8.5" font-weight="700" fill="rgba(255, 51, 51, 0.85)">TOXIC ADVERSE SELECTION ZONE (&gt;0.35)</text>')

    # Y-axis Gridlines and Tick Values (0.00, 0.20, 0.40, 0.60, 0.80, 1.00)
    for v_val in [0.0, 0.20, 0.40, 0.60, 0.80, 1.00]:
        y_v = pad_top + (1.0 - v_val) * plot_h
        if v_val not in (0.0, 1.0):
            svg.append(f'<line x1="{pad_left}" y1="{y_v:.1f}" x2="{pad_left + plot_w}" y2="{y_v:.1f}" stroke="var(--line, #252a34)" stroke-dasharray="3 3"/>')
        svg.append(f'<text x="{pad_left - 8}" y="{y_v + 3:.1f}" text-anchor="end" font-size="9" fill="var(--muted, #8b949e)">{v_val:.2f}</text>')

    # 0.35 Warning Threshold Line
    svg.append(f'<line x1="{pad_left}" y1="{y_warn:.1f}" x2="{pad_left + plot_w}" y2="{y_warn:.1f}" stroke="var(--neg, #ff3333)" stroke-width="1.5" stroke-dasharray="4 2"/>')
    svg.append(f'<text x="{pad_left - 8}" y="{y_warn + 3:.1f}" text-anchor="end" font-size="9" font-weight="700" fill="var(--neg, #ff3333)">0.35 Warn</text>')

    # VPIN Trajectory Polyline
    svg.append(f'<polyline points="{" ".join(pts_vpin)}" fill="none" stroke="var(--bbg-cyan, #00d4ff)" stroke-width="2.2" stroke-linejoin="round"/>')

    # Peak Spike Callout Badge
    if max_vpin > 0.35 and n_pts > 0:
        pk_x = pad_left + max_idx * dx
        pk_y = pad_top + (1.0 - min(max_vpin, 1.0)) * plot_h
        pk_date = series[max_idx].get("date", "")
        svg.append(f'<circle cx="{pk_x:.1f}" cy="{pk_y:.1f}" r="4.5" fill="var(--neg, #ff3333)" stroke="#fff" stroke-width="1.5"/>')
        callout_x = min(pk_x + 10, width - 130)
        callout_y = max(pk_y - 8, pad_top + 18)
        svg.append(f'<text x="{callout_x:.1f}" y="{callout_y:.1f}" font-size="8.5" font-weight="700" fill="var(--neg, #ff3333)">Peak: {max_vpin:.3f} ({pk_date})</text>')

    # Multi-Point X-Axis Calendar Date Labels (5-6 evenly spaced ticks)
    n_ticks = min(6, n_pts)
    if n_ticks > 1:
        for k in range(n_ticks):
            idx_k = int(k * (n_pts - 1) / (n_ticks - 1))
            x_k = pad_left + idx_k * dx
            d_str = series[idx_k].get("date", "")
            svg.append(f'<line x1="{x_k:.1f}" y1="{pad_top + plot_h}" x2="{x_k:.1f}" y2="{pad_top + plot_h + 4}" stroke="#6e7681"/>')
            anchor = "start" if k == 0 else "end" if k == n_ticks - 1 else "middle"
            svg.append(f'<text x="{x_k:.1f}" y="{height - 12}" text-anchor="{anchor}" font-size="9" fill="var(--muted, #8b949e)">{d_str}</text>')

    # X-axis Title Label
    svg.append(f'<text x="{pad_left + plot_w/2.0:.1f}" y="{height - 2}" font-size="8.5" font-weight="700" fill="var(--muted, #8b949e)" text-anchor="middle">TRADING DAYS TIMELINE (DAILY ORDER FLOW BUCKETS)</text>')

    svg.append("</svg>")
    return "".join(svg)
