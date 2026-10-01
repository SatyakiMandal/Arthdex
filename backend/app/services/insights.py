"""Desk analysis: statistics and plain-English findings computed from the data on a page.

Every page that shows a large table gets the same payload, so one front-end panel renders
them all:

    {
      "headline": "one-sentence read",
      "metrics":  [{"label", "value", "sub", "tone"}],
      "findings": [{"tone", "title", "text"}],
      "tables":   [{"title", "columns": [...], "rows": [[...]]}],
      "method":   "how it was computed, and its limits"
    }

Nothing here is generated freehand: each finding is a rule over a number that is shown
alongside it, so a reader can check the claim against the data.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

Tone = str  # "up" | "down" | "flat" | "info"


def tile(label: str, value: Any, sub: str | None = None, tone: Tone = "info") -> dict[str, Any]:
    return {"label": label, "value": value, "sub": sub, "tone": tone}


def finding(tone: Tone, title: str, text: str) -> dict[str, str]:
    return {"tone": tone, "title": title, "text": text}


def table(title: str, columns: list[str], rows: list[list[Any]]) -> dict[str, Any]:
    return {"title": title, "columns": columns, "rows": rows}


def _f(v: Any, nd: int = 2) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(x) or math.isinf(x) else round(x, nd)


def _sign(v: float | None) -> str:
    return "info" if v is None else "up" if v > 0 else "down" if v < 0 else "flat"


def _ord(n: float) -> str:
    n = int(round(n))
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _pct_rank(series: pd.Series) -> float | None:
    s = series.dropna()
    return float((s <= s.iloc[-1]).mean() * 100) if len(s) >= 30 else None


# ---------------------------------------------------------------- commodities
def commodity_insights(
    closes: dict[str, pd.Series],
    rows: list[dict[str, Any]],
    fx: pd.Series,
) -> dict[str, Any]:
    by_id = {r["id"]: r for r in rows}
    sym = {r["id"]: r["symbol"] for r in rows}
    findings: list[dict[str, str]] = []
    metrics: list[dict[str, Any]] = []

    # --- group momentum
    groups: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        groups.setdefault(r["group"], []).append(r)

    def avg(rs: list[dict[str, Any]], k: str) -> float | None:
        v = [x["change"][k] for x in rs if x["change"].get(k) is not None]
        return float(np.mean(v)) if v else None

    g_rows = []
    for name, rs in groups.items():
        g_rows.append([name, len(rs), _f(avg(rs, "1M"), 1), _f(avg(rs, "3M"), 1), _f(avg(rs, "1Y"), 1)])
    g_rows.sort(key=lambda x: (x[2] is None, -(x[2] or 0)))
    lead, lag = g_rows[0], g_rows[-1]
    metrics.append(tile("Strongest group (1M)", lead[0], f"{lead[2]:+.1f}% average", _sign(lead[2])))
    metrics.append(tile("Weakest group (1M)", lag[0], f"{lag[2]:+.1f}% average", _sign(lag[2])))

    pos1m = [r for r in rows if (r["change"].get("1M") or 0) > 0]
    pos3m = [r for r in rows if (r["change"].get("3M") or 0) > 0]
    metrics.append(tile("Rising over 1M", f"{len(pos1m)} of {len(rows)}", f"{len(pos3m)} of {len(rows)} over 3M", "up" if len(pos1m) > len(rows) / 2 else "down"))

    # --- leaders / laggards
    ranked = sorted((r for r in rows if r["change"].get("1M") is not None), key=lambda r: r["change"]["1M"], reverse=True)
    if len(ranked) >= 6:
        top, bot = ranked[:3], ranked[-3:]
        findings.append(
            finding(
                "info",
                "Month's movers",
                "Best: " + ", ".join(f"{r['name']} {r['change']['1M']:+.1f}%" for r in top)
                + ". Worst: " + ", ".join(f"{r['name']} {r['change']['1M']:+.1f}%" for r in reversed(bot)) + ".",
            )
        )

    # --- cross-asset ratios, ranked against their own one-year history
    def ratio_series(a: str, b: str, scale: float = 1.0) -> pd.Series | None:
        sa, sb = closes.get(sym.get(a, "")), closes.get(sym.get(b, ""))
        if sa is None or sb is None or sa.empty or sb.empty:
            return None
        return (sa / sb * scale).dropna()

    gs = ratio_series("gold", "silver")
    if gs is not None and len(gs) > 30:
        now, pr = float(gs.iloc[-1]), _pct_rank(gs)
        metrics.append(tile("Gold / silver ratio", f"{now:.1f}", f"{_ord(pr)} percentile of the year" if pr is not None else None, "info"))
        if pr is not None and pr >= 80:
            findings.append(finding("flat", "Gold is expensive against silver", f"The ratio is {now:.1f}, higher than {pr:.0f}% of the past year. A high ratio usually shows up in risk-averse markets, when gold is favoured over the more industrial silver."))
        elif pr is not None and pr <= 20:
            findings.append(finding("up", "Silver is outrunning gold", f"The ratio is {now:.1f}, lower than {100 - pr:.0f}% of the past year. Silver leading gold tends to go with improving industrial demand and appetite for risk."))
    cg = ratio_series("copper", "gold", 1000.0)
    if cg is not None and len(cg) > 30:
        now, pr = float(cg.iloc[-1]), _pct_rank(cg)
        if pr is not None and pr <= 20:
            findings.append(finding("down", "Copper is weak relative to gold", f"Copper per ounce of gold sits at the {_ord(pr)} percentile of the year. Copper trailing gold is a classic sign that markets are leaning toward growth worries."))
        elif pr is not None and pr >= 80:
            findings.append(finding("up", "Copper is strong relative to gold", f"Copper per ounce of gold sits at the {_ord(pr)} percentile of the year, the pattern seen when markets price in stronger industrial growth."))
    bw = ratio_series("brent", "wti")
    if bw is not None and len(bw) > 30:
        spread = float((closes[sym["brent"]] - closes[sym["wti"]]).dropna().iloc[-1])
        findings.append(finding("info", "Brent premium over WTI", f"Brent trades ${abs(spread):.2f} {'above' if spread >= 0 else 'below'} WTI. India prices its crude imports off Brent, so this is the spread that matters for the import bill."))

    # --- correlations: are the usual pairs still moving together?
    pairs = [("gold", "silver", "Gold and silver"), ("copper", "aluminium", "Copper and aluminium"), ("brent", "natgas", "Crude and natural gas"), ("gold", "copper", "Gold and copper")]
    corr_rows = []
    for a, b, label in pairs:
        if sym.get(a) in closes and sym.get(b) in closes:
            ra = closes[sym[a]].pct_change().dropna()
            rb = closes[sym[b]].pct_change().dropna()
            j = pd.concat([ra, rb], axis=1, join="inner").dropna()
            if len(j) >= 80:
                c60 = float(j.iloc[-60:].corr().iloc[0, 1])
                c1y = float(j.corr().iloc[0, 1])
                corr_rows.append([label, _f(c60, 2), _f(c1y, 2), _f(c60 - c1y, 2)])
    if corr_rows:
        breaks = [r for r in corr_rows if r[3] is not None and abs(r[3]) >= 0.3]
        if breaks:
            r = max(breaks, key=lambda x: abs(x[3]))
            findings.append(finding("flat", "A usual pairing has shifted", f"{r[0]} have a 60-day correlation of {r[1]:+.2f} against {r[2]:+.2f} over the year. A move that large means something specific is driving one of them, not the shared macro backdrop."))

    # --- volatility regime
    vol_rows = []
    for r in rows:
        s = closes.get(r["symbol"])
        if s is None or len(s) < 120:
            continue
        rets = s.pct_change().dropna()
        v20 = float(rets.iloc[-20:].std() * np.sqrt(252) * 100)
        roll = rets.rolling(20).std().dropna() * np.sqrt(252) * 100
        pr = _pct_rank(roll)
        vol_rows.append([r["name"], _f(v20, 1), _f(pr, 0)])
    hot = [v for v in vol_rows if v[2] is not None and v[2] >= 85]
    if hot:
        hot.sort(key=lambda x: -x[2])
        findings.append(finding("flat", "Volatility is elevated", "Unusually large daily swings recently in " + ", ".join(f"{h[0]} ({h[1]:.0f}% annualised, {_ord(h[2])} percentile)" for h in hot[:3]) + "."))

    # --- 52-week extremes
    near_hi = [r["name"] for r in rows if r.get("rangePosition") is not None and r["rangePosition"] >= 0.95]
    near_lo = [r["name"] for r in rows if r.get("rangePosition") is not None and r["rangePosition"] <= 0.05]
    if near_hi:
        findings.append(finding("up", "At or near a 52-week high", ", ".join(near_hi) + "."))
    if near_lo:
        findings.append(finding("down", "At or near a 52-week low", ", ".join(near_lo) + "."))

    # --- the rupee lens
    if fx is not None and len(fx) > 70:
        fx = fx.dropna()
        d1m = float(fx.iloc[-1] / fx.iloc[-22] - 1) * 100
        d3m = float(fx.iloc[-1] / fx.iloc[-64] - 1) * 100
        metrics.append(tile("USD / INR", f"{float(fx.iloc[-1]):.2f}", f"{d1m:+.1f}% over 1M, {d3m:+.1f}% over 3M", "down" if d1m > 0 else "up"))
        if "gold" in by_id and by_id["gold"]["change"].get("3M") is not None:
            g3 = by_id["gold"]["change"]["3M"]
            inr3 = ((1 + g3 / 100) * (1 + d3m / 100) - 1) * 100
            findings.append(finding(_sign(d3m) if d3m > 0 else "info", "Gold in rupees", f"Gold is {g3:+.1f}% in dollars over three months but {inr3:+.1f}% in rupees, because the rupee {'weakened' if d3m > 0 else 'strengthened'} {abs(d3m):.1f}% against the dollar. Indian buyers feel both."))
        if "brent" in by_id and by_id["brent"]["change"].get("3M") is not None:
            b3 = by_id["brent"]["change"]["3M"]
            binr = ((1 + b3 / 100) * (1 + d3m / 100) - 1) * 100
            tone = "down" if binr > 8 else "up" if binr < -8 else "flat"
            findings.append(finding(tone, "Crude import bill", f"Brent is {b3:+.1f}% in dollars and {binr:+.1f}% in rupees over three months. Rupee crude moves feed through to inflation, the current account and oil marketing company margins."))

    headline = f"{lead[0]} lead over the past month ({lead[2]:+.1f}% on average) while {lag[0].lower()} lag ({lag[2]:+.1f}%); {len(pos1m)} of {len(rows)} commodities are higher."
    return {
        "headline": headline,
        "metrics": metrics,
        "findings": findings,
        "tables": [
            table("Group performance", ["Group", "Count", "1M avg %", "3M avg %", "1Y avg %"], g_rows),
            *([table("Correlation check", ["Pair", "60-day", "1-year", "Change"], corr_rows)] if corr_rows else []),
        ],
        "method": "Ratios and volatility are ranked against each series' own trailing year of daily closes. Correlations use daily returns. These are descriptive statistics on front-month futures, not forecasts.",
    }


# ---------------------------------------------------------------- IPO
def ipo_insights(issues: list[dict[str, Any]]) -> dict[str, Any]:
    listed = [i for i in issues if i.get("status") == "listed" and i.get("listingGainPct") is not None]
    open_now = [i for i in issues if i.get("status") == "ongoing"]
    upcoming = [i for i in issues if i.get("status") == "upcoming"]
    findings: list[dict[str, str]] = []
    metrics: list[dict[str, Any]] = []

    def stats(rows: list[dict[str, Any]]) -> dict[str, Any]:
        g = [r["listingGainPct"] for r in rows]
        s = [r["sinceListingPct"] for r in rows if r.get("sinceListingPct") is not None]
        c = [r["cmpVsIssuePct"] for r in rows if r.get("cmpVsIssuePct") is not None]
        return {
            "n": len(rows),
            "avg": float(np.mean(g)),
            "median": float(np.median(g)),
            "hit": float(np.mean([x > 0 for x in g]) * 100),
            "since": float(np.mean(s)) if s else None,
            "above_issue": float(np.mean([x > 0 for x in c]) * 100) if c else None,
        }

    tables: list[dict[str, Any]] = []
    if listed:
        a = stats(listed)
        metrics += [
            tile("Recent listings tracked", str(a["n"]), f"{len(open_now)} open, {len(upcoming)} upcoming", "info"),
            tile("Listing-day gain", f"{a['avg']:+.1f}% avg", f"median {a['median']:+.1f}%", _sign(a["avg"])),
            tile("Listed above issue price", f"{a['hit']:.0f}%", "on day one", "up" if a["hit"] >= 55 else "down" if a["hit"] < 45 else "flat"),
        ]
        if a["above_issue"] is not None:
            metrics.append(tile("Still above issue price", f"{a['above_issue']:.0f}%", f"avg {a['since']:+.1f}% since listing" if a["since"] is not None else None, "up" if a["above_issue"] >= 55 else "down" if a["above_issue"] < 45 else "flat"))

        seg_rows = []
        for seg in ("mainboard", "sme"):
            rs = [r for r in listed if r.get("segment") == seg]
            if len(rs) >= 3:
                s = stats(rs)
                seg_rows.append([seg.upper() if seg == "sme" else "Mainboard", s["n"], _f(s["avg"], 1), _f(s["median"], 1), _f(s["hit"], 0), _f(s["since"], 1)])
        if len(seg_rows) == 2:
            tables.append(table("By segment", ["Segment", "Issues", "Avg gain %", "Median %", "Gain > 0 (%)", "Avg since listing %"], seg_rows))
            m, sme = seg_rows[0], seg_rows[1]
            if m[2] is not None and sme[2] is not None and abs(m[2] - sme[2]) >= 3:
                better = "SME" if sme[2] > m[2] else "mainboard"
                findings.append(finding("info", f"{better.title() if better == 'mainboard' else better} listings have popped more", f"Average listing-day gain is {sme[2]:+.1f}% for SME issues against {m[2]:+.1f}% for mainboard. SME listings are also far more volatile, so the average hides a wider spread."))

        # does heavy subscription lead to a bigger pop?
        sub = [(r["subscriptionTimes"], r["listingGainPct"]) for r in listed if r.get("subscriptionTimes") is not None and r["subscriptionTimes"] > 0]
        buckets = [("Under 5x", 0, 5), ("5x to 20x", 5, 20), ("20x to 50x", 20, 50), ("Over 50x", 50, 1e9)]
        b_rows = []
        for label, lo, hi in buckets:
            g = [y for x, y in sub if lo <= x < hi]
            if g:
                b_rows.append([label, len(g), _f(float(np.mean(g)), 1), _f(float(np.mean([y > 0 for y in g]) * 100), 0)])
        if len(sub) >= 10:
            xs = np.log([x for x, _ in sub])
            ys = np.array([y for _, y in sub])
            r = float(np.corrcoef(xs, ys)[0, 1]) if len(set(xs)) > 1 and len(set(ys)) > 1 else None
            if r is not None:
                strength = "strong" if abs(r) >= 0.5 else "moderate" if abs(r) >= 0.3 else "weak"
                findings.append(finding("info", "Subscription and the listing pop", f"Across {len(sub)} listed issues, listing gain has a {strength} {'positive' if r > 0 else 'negative'} link with how oversubscribed the issue was (correlation {r:+.2f} on a log scale of subscription)."))
            tables.append(table("Listing gain by subscription level", ["Subscribed", "Issues", "Avg gain %", "Gain > 0 (%)"], b_rows))
            heavy = [b for b in b_rows if b[0] == "Over 50x"]
            light = [b for b in b_rows if b[0] == "Under 5x"]
            if heavy and light and heavy[0][2] is not None and light[0][2] is not None:
                findings.append(finding("up" if heavy[0][2] > light[0][2] else "flat", "Demand has been a usable signal" if heavy[0][2] > light[0][2] + 5 else "Demand is only a loose signal", f"Issues subscribed over 50x listed {heavy[0][2]:+.1f}% on average ({heavy[0][1]} issues) against {light[0][2]:+.1f}% for those under 5x ({light[0][1]} issues)."))

        # does the listing pop last?
        faded = [r for r in listed if r["listingGainPct"] > 0 and r.get("sinceListingPct") is not None and r["sinceListingPct"] < 0]
        popped = [r for r in listed if r["listingGainPct"] > 0 and r.get("sinceListingPct") is not None]
        if len(popped) >= 8:
            share = len(faded) / len(popped) * 100
            findings.append(finding("down" if share >= 50 else "flat", "Listing pops often fade", f"{share:.0f}% of issues that listed above their issue price have since traded below their listing close ({len(faded)} of {len(popped)}). Buying the listing is a different bet from buying the issue."))
        wins = sorted(listed, key=lambda r: r["listingGainPct"], reverse=True)
        losers = [r for r in listed if r["listingGainPct"] < 0]
        findings.append(finding("info", "Range of outcomes", f"Best listing: {wins[0]['name']} ({wins[0]['listingGainPct']:+.1f}%). Worst: {wins[-1]['name']} ({wins[-1]['listingGainPct']:+.1f}%). {len(losers)} of {len(listed)} listed below issue price."))

        # open issues against that history
        if open_now:
            hist_ref = {b[0]: b for b in b_rows}
            rows = []
            for i in open_now:
                x = i.get("subscriptionTimes")
                if x is None:
                    continue
                label = "Under 5x" if x < 5 else "5x to 20x" if x < 20 else "20x to 50x" if x < 50 else "Over 50x"
                ref = hist_ref.get(label)
                rows.append([i.get("name"), i.get("segment"), _f(x, 2), f"{ref[2]:+.1f}% ({ref[1]} issues)" if ref else "n/a", i.get("issueEndDate")])
            if rows:
                tables.append(table("Open issues against history", ["Issue", "Segment", "Subscribed (x)", "Past issues at this level listed", "Closes"], rows))
                findings.append(finding("info", "Subscription is still building", "Final demand arrives in the last hours of bidding, so a low multiple on an early day says little. The comparison table shows what issues at each level went on to do."))

    if not metrics:
        metrics.append(tile("Issues tracked", str(len(issues)), None, "info"))
    headline = (
        f"Of {len(listed)} recent listings, {np.mean([r['listingGainPct'] > 0 for r in listed]) * 100:.0f}% closed above issue price on day one, "
        f"averaging {np.mean([r['listingGainPct'] for r in listed]):+.1f}%."
        if listed
        else f"{len(open_now)} issues open and {len(upcoming)} upcoming; no listing history available yet."
    )
    return {
        "headline": headline,
        "metrics": metrics,
        "findings": findings,
        "tables": tables,
        "method": "Built from NSE's issue records and reconstructed post-listing prices. Averages are simple, not weighted by issue size. A small sample in any bucket is a reason for caution, not a rule.",
    }


# ---------------------------------------------------------------- Bhavcopy
def _session(df: pd.DataFrame) -> dict[str, float]:
    d = df.dropna(subset=["CLOSE_PRICE", "PREV_CLOSE"])
    wd = d.dropna(subset=["DELIV_QTY"])
    qty = float(wd["TTL_TRD_QNTY"].sum())
    return {
        "adv": int((d["CHG_PCT"] > 0).sum()),
        "dec": int((d["CHG_PCT"] < 0).sum()),
        "turnover": float(d["TURNOVER_CR"].sum()),
        "deliv": float(wd["DELIV_QTY"].sum() / qty * 100) if qty else float("nan"),
    }


def bhav_insights(
    today: pd.DataFrame,
    prior: list[tuple[Any, pd.DataFrame]],
    min_turnover_cr: float,
    anomalies: list[dict[str, Any]],
    bands: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    df = today.dropna(subset=["CLOSE_PRICE", "PREV_CLOSE"])
    t = _session(df)
    hist = [_session(p[1]) for p in prior]
    findings: list[dict[str, str]] = []
    metrics: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []

    ratio = t["adv"] / t["dec"] if t["dec"] else None
    h_ratio = [h["adv"] / h["dec"] for h in hist if h["dec"]]
    if ratio is not None:
        base = float(np.mean(h_ratio)) if h_ratio else None
        metrics.append(tile("Advance / decline", f"{ratio:.2f}x", f"{base:.2f}x over prior {len(h_ratio)} sessions" if base else None, "up" if ratio > 1.15 else "down" if ratio < 0.87 else "flat"))
        if base:
            if ratio > base * 1.25:
                findings.append(finding("up", "Breadth improved", f"{t['adv']:,} stocks rose against {t['dec']:,} that fell ({ratio:.2f}x), better than the {base:.2f}x average of the previous {len(h_ratio)} sessions."))
            elif ratio < base * 0.8:
                findings.append(finding("down", "Breadth weakened", f"{t['adv']:,} stocks rose against {t['dec']:,} that fell ({ratio:.2f}x), worse than the {base:.2f}x average of the previous {len(h_ratio)} sessions."))
            else:
                findings.append(finding("flat", "Breadth in line with recent sessions", f"{ratio:.2f}x advances to declines against a {base:.2f}x recent average."))

    h_turn = [h["turnover"] for h in hist if h["turnover"]]
    if h_turn:
        avg_t = float(np.mean(h_turn))
        chg = (t["turnover"] / avg_t - 1) * 100
        metrics.append(tile("Turnover", f"₹{t['turnover']:,.0f} Cr", f"{chg:+.0f}% vs prior-session average", "info"))
        if abs(chg) >= 15:
            findings.append(finding("flat", "Turnover was " + ("heavy" if chg > 0 else "light"), f"Traded value of ₹{t['turnover']:,.0f} Cr is {abs(chg):.0f}% {'above' if chg > 0 else 'below'} the previous {len(h_turn)}-session average of ₹{avg_t:,.0f} Cr."))

    h_del = [h["deliv"] for h in hist if h["deliv"] == h["deliv"]]
    if t["deliv"] == t["deliv"]:
        if h_del:
            d_pp = t["deliv"] - float(np.mean(h_del))
            metrics.append(tile("Delivery", f"{t['deliv']:.1f}%", f"{d_pp:+.1f} pp vs prior average", "up" if d_pp > 1.5 else "down" if d_pp < -1.5 else "flat"))
            if abs(d_pp) >= 1.5:
                findings.append(finding("up" if d_pp > 0 else "flat", "Delivery " + ("rose" if d_pp > 0 else "fell"), f"{t['deliv']:.1f}% of traded quantity was taken home, {abs(d_pp):.1f} points {'above' if d_pp > 0 else 'below'} the recent average. Higher delivery means more positions held overnight rather than squared off intraday."))
        else:
            metrics.append(tile("Delivery", f"{t['deliv']:.1f}%", None, "info"))

    top = df.sort_values("TURNOVER_CR", ascending=False)
    total = float(df["TURNOVER_CR"].sum())
    if total > 0 and len(top) >= 10:
        share10 = float(top["TURNOVER_CR"].head(10).sum() / total * 100)
        metrics.append(tile("Top-10 share of turnover", f"{share10:.0f}%", f"led by {top.iloc[0]['SYMBOL']}", "info"))
        if share10 >= 25:
            findings.append(finding("flat", "Trading is concentrated", f"Ten stocks account for {share10:.0f}% of the day's traded value, so the headline turnover mostly reflects a handful of large names."))

    liq = df[(df["TURNOVER_CR"] >= min_turnover_cr) & df["DELIV_PER"].notna()]
    if len(liq) >= 40:
        up = liq[liq["CHG_PCT"] > 0.5]
        dn = liq[liq["CHG_PCT"] < -0.5]

        def q(frame: pd.DataFrame, lo: float | None, hi: float | None) -> int:
            f = frame
            if lo is not None:
                f = f[f["DELIV_PER"] >= lo]
            if hi is not None:
                f = f[f["DELIV_PER"] <= hi]
            return len(f)

        up_hi, up_lo, dn_hi, dn_lo = q(up, 50, None), q(up, None, 25), q(dn, 50, None), q(dn, None, 25)
        tables.append(
            table(
                "Price move against delivery (liquid stocks)",
                ["", "Delivery 50%+", "Delivery up to 25%", "All"],
                [["Rose over 0.5%", f"{up_hi} stocks", f"{up_lo} stocks", f"{len(up)} stocks"],
                 ["Fell over 0.5%", f"{dn_hi} stocks", f"{dn_lo} stocks", f"{len(dn)} stocks"]],
            )
        )
        if len(up) >= 10 and len(dn) >= 10:
            hi_up, hi_dn = up_hi / len(up) * 100, dn_hi / len(dn) * 100
            lo_up = up_lo / len(up) * 100
            gap = hi_up - hi_dn
            if gap >= 10:
                findings.append(finding("up", "Gainers carried more delivery than losers", f"{hi_up:.0f}% of rising liquid stocks had delivery of 50% or more against {hi_dn:.0f}% of falling ones. Buyers were more willing to hold than sellers were to hold on."))
            elif gap <= -10:
                findings.append(finding("down", "Losers carried more delivery than gainers", f"{hi_dn:.0f}% of falling liquid stocks had delivery of 50% or more against {hi_up:.0f}% of rising ones. Heavy delivery on declines fits holders selling out, not only intraday shorting."))
            else:
                findings.append(finding("flat", "Delivery did not separate gainers from losers", f"{hi_up:.0f}% of rising and {hi_dn:.0f}% of falling liquid stocks had 50%+ delivery, so the day's direction was not a story about who held."))
            if lo_up >= 25:
                findings.append(finding("flat", "A slice of the rally was intraday", f"{lo_up:.0f}% of rising liquid stocks traded on 25% delivery or less, the signature of short-term trading rather than investors taking positions home."))

        big = liq[liq["CHG_PCT"] >= 5]
        if len(big) >= 5:
            med = float(big["DELIV_PER"].median())
            findings.append(finding("flat" if med < t["deliv"] - 8 else "up" if med > t["deliv"] + 8 else "info", f"{len(big)} liquid stocks gained 5% or more", f"Their median delivery was {med:.0f}% against {t['deliv']:.0f}% for the whole market. " + ("Below-market delivery on big moves points to short-term trading driving them." if med < t["deliv"] - 8 else "Above-market delivery suggests real holders behind the moves." if med > t["deliv"] + 8 else "That is about normal, so there is no extra sign of speculation or conviction.")))

    if anomalies:
        ups = sum(1 for a in anomalies if (a.get("changePct") or 0) > 0)
        lean = "higher" if ups > len(anomalies) * 0.6 else "lower" if ups < len(anomalies) * 0.4 else "both ways"
        findings.append(finding("up" if lean == "higher" else "down" if lean == "lower" else "flat", "Volume surges lean " + lean, f"{ups} of the {len(anomalies)} stocks trading at over twice their five-session volume closed higher."))

    nu, nl = len(bands.get("upper", [])), len(bands.get("lower", []))
    if nu or nl:
        findings.append(finding("up" if nu > nl * 1.5 else "down" if nl > nu * 1.5 else "flat", "Price-band closes", f"{nu} stocks closed at an upper band against {nl} at a lower band."))

    if hist:
        rows = [["Today", t["adv"], t["dec"], _f(t["adv"] / t["dec"] if t["dec"] else None, 2), _f(t["turnover"], 0), _f(t["deliv"], 1)]]
        for (d, _), h in zip(prior, hist):
            rows.append([str(d), h["adv"], h["dec"], _f(h["adv"] / h["dec"] if h["dec"] else None, 2), _f(h["turnover"], 0), _f(h["deliv"], 1)])
        tables.append(table("Recent sessions", ["Session", "Advances", "Declines", "A/D", "Turnover ₹Cr", "Delivery %"], rows))

    tone = "up" if (ratio or 1) > 1.15 else "down" if (ratio or 1) < 0.87 else "flat"
    headline = (
        f"{'Broad strength' if tone == 'up' else 'Broad weakness' if tone == 'down' else 'A mixed session'}: "
        f"{t['adv']:,} up against {t['dec']:,} down, ₹{t['turnover']:,.0f} Cr traded, {t['deliv']:.1f}% delivered."
    )
    return {
        "headline": headline,
        "metrics": metrics,
        "findings": findings,
        "tables": tables,
        "method": f"Compares today's file with the previous {len(hist)} sessions' files. Price-versus-delivery uses stocks with at least ₹{min_turnover_cr:g} Cr of turnover. It describes behaviour on the day; delivery data cannot say who the buyers or sellers were.",
    }
