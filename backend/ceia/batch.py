"""Multi-Company Batch and Peer Group Event Study Analyzer (CEIA 2.0).

Enables cross-sectional analysis across peer groups and sector constituents:
- Runs standardized event studies across multiple firms concurrently.
- Computes pairwise Abnormal Return (AR) spillover/correlation matrices.
- Constructs comparative risk & valuation leaderboards (Beta, R², P/E, ROCE, Distance to Default, VaR).
- Identifies systemic vs idiosyncratic market shock coincidence.
- Generates unified standalone HTML comparison reports.
"""

from __future__ import annotations

import argparse
import json
import logging
from dataclasses import dataclass, field
from datetime import date
from html import escape
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .analyze import Analysis, analyse, load_news_from_file
from .models import RunConfig
from .prices import PriceError, PriceProvider
from .report import CSS, _cls, _stat

log = logging.getLogger(__name__)

PEER_GROUPS: dict[str, list[tuple[str, str]]] = {
    "tata": [
        ("Tata Consultancy Services", "TCS.NS"),
        ("Tata Steel", "TATASTEEL.NS"),
        ("Tata Motors CV", "TMCV.NS"),
        ("Tata Motors PV", "TMPV.NS"),
    ],
    "auto": [
        ("Tata Motors", "TMCV.NS"),
        ("Ashok Leyland", "ASHOKLEY.NS"),
        ("Mahindra & Mahindra", "M&M.NS"),
        ("Maruti Suzuki", "MARUTI.NS"),
    ],
    "it": [
        ("Tata Consultancy Services", "TCS.NS"),
        ("Infosys", "INFY.NS"),
        ("Wipro", "WIPRO.NS"),
        ("HCL Technologies", "HCLTECH.NS"),
    ],
    "metal": [
        ("Tata Steel", "TATASTEEL.NS"),
        ("JSW Steel", "JSWSTEEL.NS"),
        ("Hindalco", "HINDALCO.NS"),
        ("SAIL", "SAIL.NS"),
    ],
}


@dataclass
class BatchAnalysis:
    group_name: str
    start: date
    end: date
    benchmark: str
    analyses: dict[str, Analysis]  # ticker -> Analysis
    ar_correlation_matrix: pd.DataFrame = field(default_factory=pd.DataFrame)
    leaderboard: list[dict[str, Any]] = field(default_factory=list)
    common_incident_days: list[dict[str, Any]] = field(default_factory=list)
    sector_caar: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        corr_dict = {}
        if not self.ar_correlation_matrix.empty:
            corr_dict = json.loads(self.ar_correlation_matrix.to_json(orient="split"))
        return {
            "group_name": self.group_name,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "benchmark": self.benchmark,
            "companies": list(self.analyses.keys()),
            "leaderboard": self.leaderboard,
            "ar_correlation_matrix": corr_dict,
            "common_incident_days": self.common_incident_days,
            "sector_caar": self.sector_caar,
            "individual_analyses": {k: v.to_dict() for k, v in self.analyses.items()},
        }


def compute_cross_sectional_metrics(analyses: dict[str, Analysis]) -> tuple[pd.DataFrame, list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Compute pairwise abnormal return correlation matrix, risk leaderboard,
    common shock days, and sector-wide CAAR across all firms."""
    if not analyses:
        return pd.DataFrame(), [], [], []

    # 1. Abnormal returns series alignment and CAAR
    ar_series_dict = {}
    for ticker, a in analyses.items():
        if not a.daily.empty and "abnormal_return" in a.daily.columns:
            ar_series_dict[ticker] = a.daily["abnormal_return"]

    sector_caar = []
    if ar_series_dict:
        ar_df = pd.DataFrame(ar_series_dict).dropna()
        corr_matrix = ar_df.corr().round(3) if len(ar_df) > 5 else pd.DataFrame()

        # Cross-sectional average abnormal return (AAR) and Cumulative AAR (CAAR)
        mean_aar = ar_df.mean(axis=1)
        cum_caar = mean_aar.cumsum()
        for dt, val in cum_caar.items():
            sector_caar.append({
                "date": dt.date().isoformat() if hasattr(dt, "date") else str(dt),
                "aar": round(float(mean_aar.loc[dt]), 5),
                "caar": round(float(val), 5),
            })
    else:
        corr_matrix = pd.DataFrame()

    # 2. Peer group ratios collection for sector-relative metrics
    from .financials import compute_sector_relative_valuation
    all_ratios = [(a.financials or {}).get("ratios") or {} for a in analyses.values()]

    # 3. Risk & Valuation Leaderboard
    leaderboard = []
    for ticker, a in analyses.items():
        fin = a.financials or {}
        ratios = fin.get("ratios") or {}
        dd = a.distance_to_default or {}
        v = a.var or {}
        p_meta = a.price_meta or {}

        var_1d_95 = None
        if v.get("available") and v.get("var_1d_95"):
            var_1d_95 = v["var_1d_95"].get("historical") or v["var_1d_95"].get("parametric")

        # Sector relative valuation
        sec_rel = compute_sector_relative_valuation(ratios, all_ratios)

        leaderboard.append({
            "ticker": ticker,
            "company": a.config.company,
            "beta": round(p_meta.get("beta", 1.0), 2),
            "r_squared": round(p_meta.get("r_squared", 0.0), 3) if pd.notna(p_meta.get("r_squared")) else None,
            "candidates_count": len(a.incidents),
            "stock_pe": ratios.get("Stock P/E") or ratios.get("P/E"),
            "pe_relative_pct": sec_rel.get("pe_relative_pct"),
            "valuation_status": sec_rel.get("valuation_status", "Par"),
            "roce_pct": ratios.get("ROCE"),
            "roe_pct": ratios.get("ROE"),
            "debt_to_equity": ratios.get("Debt to equity") or (fin.get("balance_sheet") or {}).get("debt_to_equity"),
            "distance_to_default": dd.get("distance_to_default") if dd.get("available") else None,
            "default_prob_pct": dd.get("default_probability_pct") if dd.get("available") else None,
            "var_1d_95_pct": round(var_1d_95 * 100, 2) if var_1d_95 is not None else None,
        })

    # 4. Common shock days across multiple firms
    day_incident_counts: dict[date, list[tuple[str, float]]] = {}
    for ticker, a in analyses.items():
        for inc in a.incidents:
            day_incident_counts.setdefault(inc.day, []).append((ticker, inc.abnormal_return))

    common_days = []
    for d, tickers_hit in sorted(day_incident_counts.items()):
        if len(tickers_hit) >= 2:  # Shared shock on 2 or more peer companies
            common_days.append({
                "date": d.isoformat(),
                "firms_hit": len(tickers_hit),
                "details": [f"{t} ({ar*100:+.2f}%)" for t, ar in tickers_hit],
            })

    return corr_matrix, leaderboard, common_days, sector_caar


def run_batch(
    companies: list[tuple[str, str]],
    start: date,
    end: date,
    benchmark: str = "^NSEI",
    group_name: str = "Peer Group",
    providers: list[PriceProvider] | None = None,
    skip_risk_metrics: bool = False,
    skip_financials: bool = False,
) -> BatchAnalysis:
    """Execute CEIA analysis across all companies in the batch."""
    analyses: dict[str, Analysis] = {}

    for comp_name, ticker in companies:
        log.info("Batch running: %s (%s)", comp_name, ticker)
        config = RunConfig(
            company=comp_name, ticker=ticker, benchmark=benchmark,
            start=start, end=end, aliases=[comp_name.split()[0]],
        )
        try:
            # For batch analysis, news items can be passed or empty if running offline/cached
            a = analyse(
                config, items=[], news_meta={"stats": {}},
                providers=providers,
                skip_financials=skip_financials,
                skip_risk_metrics=skip_risk_metrics,
            )
            analyses[ticker] = a
        except Exception as exc:
            log.error("Failed batch run for %s (%s): %s", comp_name, ticker, exc)
    corr_matrix, leaderboard, common_days, sector_caar = compute_cross_sectional_metrics(analyses)

    return BatchAnalysis(
        group_name=group_name,
        start=start,
        end=end,
        benchmark=benchmark,
        analyses=analyses,
        ar_correlation_matrix=corr_matrix,
        leaderboard=leaderboard,
        common_incident_days=common_days,
        sector_caar=sector_caar,
    )


def build_batch_html(batch: BatchAnalysis) -> str:
    """Render unified multi-company comparative report."""
    lb_rows = []
    for row in batch.leaderboard:
        pe_val = row.get("stock_pe")
        pe_str = f"{pe_val:.1f}x" if pe_val is not None else "—"
        roce_val = row.get("roce_pct")
        roce_str = f"{roce_val:.1f}%" if roce_val is not None else "—"
        de_val = row.get("debt_to_equity")
        de_str = f"{de_val:.2f}" if de_val is not None else "—"
        dd_val = row.get("distance_to_default")
        dd_str = f"{dd_val:.2f} σ" if dd_val is not None else "—"
        var_val = row.get("var_1d_95_pct")
        var_str = f"{var_val:.2f}%" if var_val is not None else "—"
        val_status = row.get("valuation_status", "Par")
        pe_rel = row.get("pe_relative_pct")
        rel_str = f"{pe_rel:+.1f}%" if pe_rel is not None else "—"

        lb_rows.append(f"""
<tr>
  <td class="txt"><strong>{escape(row['company'])}</strong> ({escape(row['ticker'])})</td>
  <td>{row['beta']}</td>
  <td>{row.get('r_squared') or '—'}</td>
  <td>{row['candidates_count']}</td>
  <td>{pe_str}</td>
  <td><strong>{escape(val_status)}</strong> ({rel_str})</td>
  <td>{roce_str}</td>
  <td>{de_str}</td>
  <td><strong>{dd_str}</strong></td>
  <td>{var_str}</td>
</tr>""")

    # Correlation Matrix Table
    corr_html = "<p class='empty'>No overlapping price history to compute correlation matrix.</p>"
    if not batch.ar_correlation_matrix.empty:
        header_th = "".join(f"<th>{escape(c)}</th>" for c in batch.ar_correlation_matrix.columns)
        matrix_rows = []
        for idx, s in batch.ar_correlation_matrix.iterrows():
            cells = "".join(f"<td>{val:+.2f}</td>" for val in s)
            matrix_rows.append(f"<tr><td class='txt'><strong>{escape(idx)}</strong></td>{cells}</tr>")
        corr_html = f"""
<div class="scroll">
<table>
  <thead><tr><th class="txt">Ticker</th>{header_th}</tr></thead>
  <tbody>{"".join(matrix_rows)}</tbody>
</table>
</div>"""

    # Shared Shock Days Table
    shared_days_html = "<p class='empty'>No days with concurrent multi-firm shocks detected.</p>"
    if batch.common_incident_days:
        s_rows = []
        for item in batch.common_incident_days:
            firms_str = ", ".join(item["details"])
            s_rows.append(f"<tr><td class='txt'>{item['date']}</td><td>{item['firms_hit']}</td><td class='txt'>{escape(firms_str)}</td></tr>")
        shared_days_html = f"""
<div class="scroll">
<table>
  <thead><tr><th class="txt">Date</th><th>Firms Impacted</th><th class="txt">Abnormal Return Moves</th></tr></thead>
  <tbody>{"".join(s_rows)}</tbody>
</table>
</div>"""

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(batch.group_name)} — Comparative Event Impact & Risk Analysis</title>
<style>{CSS}</style></head><body><div class="wrap">

<h1>{escape(batch.group_name)} — Cross-Sectional Analysis</h1>
<div class="sub">{len(batch.analyses)} Companies &middot; {batch.start:%d %B %Y} to {batch.end:%d %B %Y} &middot; Benchmark: {escape(batch.benchmark)}</div>

<h2>Peer Group Comparative Risk & Fundamentals Leaderboard</h2>
<p>Side-by-side comparison of market beta, candidate event count, valuation multiples, Merton structural Distance to Default, and 1-Day 95% Value at Risk across all peer group members.</p>
<div style="display:flex;gap:10px;align-items:center;margin:10px 0;">
  <input type="text" id="leaderboard-search" onkeyup="filterTable('leaderboard-search', 'leaderboard-table')" placeholder="🔍 Filter peer companies..." style="padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);font-size:0.88rem;">
  <button onclick="exportTableCSV('leaderboard-table', 'peer_leaderboard.csv')" style="padding:6px 12px;cursor:pointer;border:1px solid var(--line);border-radius:6px;background:var(--plot);color:var(--fg);font-size:0.88rem;font-weight:600;">📥 Export CSV</button>
</div>
<div class="scroll">
<table id="leaderboard-table">
  <thead>
    <tr>
      <th class="txt" onclick="sortTable('leaderboard-table', 0)" style="cursor:pointer">Company ⇕</th>
      <th onclick="sortTable('leaderboard-table', 1)" style="cursor:pointer">Market Beta ⇕</th>
      <th onclick="sortTable('leaderboard-table', 2)" style="cursor:pointer">Model R² ⇕</th>
      <th onclick="sortTable('leaderboard-table', 3)" style="cursor:pointer">Flagged Days ⇕</th>
      <th onclick="sortTable('leaderboard-table', 4)" style="cursor:pointer">P/E ⇕</th>
      <th class="txt" onclick="sortTable('leaderboard-table', 5)" style="cursor:pointer">Sector Valuation ⇕</th>
      <th onclick="sortTable('leaderboard-table', 6)" style="cursor:pointer">ROCE ⇕</th>
      <th onclick="sortTable('leaderboard-table', 7)" style="cursor:pointer">Debt / Equity ⇕</th>
      <th onclick="sortTable('leaderboard-table', 8)" style="cursor:pointer">Distance to Default ⇕</th>
      <th onclick="sortTable('leaderboard-table', 9)" style="cursor:pointer">1D 95% VaR ⇕</th>
    </tr>
  </thead>
  <tbody>
    {"".join(lb_rows)}
  </tbody>
</table>
</div>

<h2>Abnormal Return Spillover & Correlation Matrix</h2>
<p>Pairwise Pearson correlation of idiosyncratic abnormal returns ($AR_t$) across the peer group, isolating cross-company spillovers from market-wide moves.</p>
{corr_html}

<h2>Concurrent Sector-Wide Shock Days</h2>
<p>Dates where two or more companies in the peer group experienced simultaneous candidate shocks, indicating systemic industry-wide repricing.</p>
{shared_days_html}

<h2>Sector-Wide Cumulative Average Abnormal Return (CAAR)</h2>
<p>Cross-sectional average abnormal return (AAR) and cumulative aggregate trajectory (CAAR) across the entire peer group.</p>
<div class="scroll">
<table>
  <thead><tr><th class="txt">Date</th><th>Daily AAR</th><th>Cumulative Sector CAAR</th></tr></thead>
  <tbody>
    {"".join(f"<tr><td class='txt'>{r['date']}</td><td class='{_cls(r['aar'])}'>{r['aar']*100:+.2f}%</td><td class='{_cls(r['caar'])}'><strong>{r['caar']*100:+.2f}%</strong></td></tr>" for r in batch.sector_caar[-15:]) if batch.sector_caar else "<tr><td colspan='3' class='empty'>No CAAR series computed.</td></tr>"}
  </tbody>
</table>
</div>

<div class="foot">
Generated by Company Event Impact Analyzer (CEIA 3.1). Cross-sectional descriptive research only — not investment advice.
</div>

</div></body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description="CEIA 2.0: Multi-Company Peer Group Batch Event Study")
    parser.add_argument("--peer-group", choices=list(PEER_GROUPS.keys()), default=None,
                        help="Predefined peer group: tata, auto, it, metal")
    parser.add_argument("--auto-peers", default=None,
                        help="Auto-discover live industry peers for this ticker from screener.in (e.g. 'TATASTEEL.NS')")
    parser.add_argument("--tickers", default=None,
                        help="Comma-separated ticker list, e.g. 'TMCV.NS,TMPV.NS,TATASTEEL.NS,TCS.NS'")
    parser.add_argument("--start", default="2026-01-01")
    parser.add_argument("--end", default="2026-06-30")
    parser.add_argument("--benchmark", default="^NSEI")
    parser.add_argument("--out", default="out/peer_group_analysis.json")
    parser.add_argument("--html", default="out/peer_group_report.html")
    parser.add_argument("--skip-financials", action="store_true")
    parser.add_argument("--skip-risk-metrics", action="store_true")
    args = parser.parse_args()

    companies = []
    group_name = "Peer Group Analysis"
    if args.auto_peers:
        from .financials import fetch_peer_tickers
        discovered = fetch_peer_tickers(args.auto_peers)
        if discovered:
            companies = [(args.auto_peers.split(".")[0], args.auto_peers)] + discovered
            group_name = f"{args.auto_peers} & Industry Peers"
            print(f"Auto-discovered {len(discovered)} live industry peers for {args.auto_peers}: {[t for _, t in discovered]}")
        else:
            print(f"No peers discovered from screener.in for {args.auto_peers}; falling back to single company.")
            companies = [(args.auto_peers.split(".")[0], args.auto_peers)]
            group_name = f"{args.auto_peers} Analysis"
    elif args.peer_group:
        companies = PEER_GROUPS[args.peer_group]
        group_name = f"{args.peer_group.upper()} Peer Group"
    elif args.tickers:
        for t in args.tickers.split(","):
            t = t.strip()
            if t:
                companies.append((t.split(".")[0], t))

    if not companies:
        print("Please specify --peer-group, --auto-peers, or --tickers.")
        raise SystemExit(2)

    batch = run_batch(
        companies,
        start=date.fromisoformat(args.start),
        end=date.fromisoformat(args.end),
        benchmark=args.benchmark,
        group_name=group_name,
        skip_financials=args.skip_financials,
        skip_risk_metrics=args.skip_risk_metrics,
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(batch.to_dict(), indent=2, default=str), encoding="utf-8")
    print(f"Wrote batch JSON: {out_path}")

    if args.html:
        html_path = Path(args.html)
        html_path.parent.mkdir(parents=True, exist_ok=True)
        html_path.write_text(build_batch_html(batch), encoding="utf-8")
        print(f"Wrote batch HTML: {html_path}")


if __name__ == "__main__":
    main()
