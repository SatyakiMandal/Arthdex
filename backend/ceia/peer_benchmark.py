"""Cross-Sectional Multi-Company Peer Cohort Benchmark Module.

Benchmarks event shock resiliency, asymmetric downside beta, solvency metrics,
and microstructure liquidity across an entire industry sector peer group.
"""

from __future__ import annotations

import argparse
import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import date
from html import escape
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .distance_to_default import dd_summary
from .fetcher import Fetcher
from .financials import compute_altman_z_score_em, compute_piotroski_f_score, financials_summary
from .prices import PriceProvider, YahooChartProvider
from .returns import (
    compute_asymmetric_downside_beta,
    compute_copula_tail_dependence,
    compute_higher_moment_coskewness_cokurtosis,
    compute_kyle_lambda_and_vpin,
    compute_roll_effective_spread,
    fit_market_model,
)

log = logging.getLogger(__name__)


@dataclass
class PeerMetrics:
    ticker: str
    company_name: str
    annual_return_pct: float
    annual_volatility_pct: float
    market_beta: float
    downside_beta: float
    coskewness: float
    cokurtosis: float
    roll_spread_pct: float
    merton_dd: float
    altman_z_score: float
    piotroski_f_score: int
    resiliency_score: float
    composite_rank: int = 1


def compute_peer_cohort_benchmark(
    tickers: list[str],
    sector: str = "Industry Sector Cohort",
    start: date = date(2025, 1, 1),
    end: date = date(2026, 1, 1),
    benchmark: str = "^NSEI",
    fetcher: Fetcher | None = None,
    price_provider: PriceProvider | None = None,
) -> dict[str, Any]:
    """Compute cross-sectional comparative peer matrix across an industry cohort."""
    fetcher = fetcher or Fetcher()
    provider = price_provider or YahooChartProvider()

    # 1. Fetch benchmark price
    try:
        bench_df = provider.history(benchmark, start, end)
        bench_returns = bench_df["close"].pct_change().dropna() if not bench_df.empty else pd.Series(dtype=float)
    except Exception:
        bench_returns = pd.Series(dtype=float)

    peer_records: list[PeerMetrics] = []

    for t in tickers:
        clean_ticker = t.strip().upper()
        if not clean_ticker:
            continue
        try:
            p_df = provider.history(clean_ticker, start, end)
            if p_df.empty or len(p_df) < 15:
                continue

            r_series = p_df["close"].pct_change().dropna()
            prices = p_df["close"].dropna()
            volumes = p_df.get("volume", pd.Series([100000] * len(prices), index=prices.index))

            # Alignment
            common_idx = r_series.index.intersection(bench_returns.index)
            r_s = r_series.reindex(common_idx)
            r_m = bench_returns.reindex(common_idx)

            # Returns & Risk
            ann_ret = float(r_s.mean() * 252.0 * 100.0) if len(r_s) > 0 else 0.0
            ann_vol = float(r_s.std(ddof=1) * np.sqrt(252.0) * 100.0) if len(r_s) > 1 else 25.0

            # Market & Downside Beta
            cov_mat = np.cov(r_s.to_numpy(), r_m.to_numpy())
            var_m = cov_mat[1, 1] if len(cov_mat.shape) > 1 else 1.0
            m_beta = float(cov_mat[0, 1] / var_m) if var_m > 1e-8 else 1.0
            down_res = compute_asymmetric_downside_beta(r_s, r_m)
            d_beta = float(down_res.get("downside_beta", m_beta))

            # Coskewness & Cokurtosis
            higher_mom = compute_higher_moment_coskewness_cokurtosis(r_s, r_m)
            coskew = float(higher_mom.get("coskewness", 0.0))
            cokurt = float(higher_mom.get("cokurtosis", 3.0))

            # Microstructure Spread
            roll = compute_roll_effective_spread(prices)
            roll_spread = float(roll.get("roll_effective_spread_pct", 0.35))

            # Financials & Solvency
            fin = financials_summary(clean_ticker.replace(".NS", "").replace(".BO", ""), fetcher=fetcher)
            altman = compute_altman_z_score_em(fin)
            z_score = float(altman.get("altman_z_score", 3.0))

            piotroski = compute_piotroski_f_score(fin)
            f_score = int(piotroski.get("piotroski_f_score", 7))

            p_frame = pd.DataFrame({"close": prices, "return": r_series}, index=r_series.index)
            dd = dd_summary(clean_ticker, p_frame, fin)
            m_dd = float(dd.get("distance_to_default", 5.0)) if dd.get("available") else 4.5

            # Composite Resiliency Score = 0.35*(Altman Z/3) + 0.25*(Piotroski F/9) + 0.20*(Merton DD/6) - 0.20*(Downside Beta - 1.0)
            res_score = (
                0.35 * min(3.0, z_score / 2.0)
                + 0.25 * (f_score / 9.0) * 3.0
                + 0.20 * min(3.0, m_dd / 3.0)
                - 0.20 * max(-1.0, min(2.0, d_beta - 1.0))
            )

            peer_records.append(PeerMetrics(
                ticker=clean_ticker,
                company_name=clean_ticker.replace(".NS", "").replace(".BO", ""),
                annual_return_pct=round(ann_ret, 2),
                annual_volatility_pct=round(ann_vol, 2),
                market_beta=round(m_beta, 2),
                downside_beta=round(d_beta, 2),
                coskewness=round(coskew, 3),
                cokurtosis=round(cokurt, 3),
                roll_spread_pct=round(roll_spread, 3),
                merton_dd=round(m_dd, 2),
                altman_z_score=round(z_score, 2),
                piotroski_f_score=f_score,
                resiliency_score=round(res_score, 2),
            ))
        except Exception as exc:
            log.warning("Peer benchmark failed for %s: %s", clean_ticker, exc)
            continue

    # Rank by Resiliency Score descending
    peer_records.sort(key=lambda p: -p.resiliency_score)
    for rank, p in enumerate(peer_records, 1):
        p.composite_rank = rank

    return {
        "sector": sector,
        "benchmark": benchmark,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "peer_count": len(peer_records),
        "peers": [asdict(p) for p in peer_records],
    }


def build_peer_benchmark_html(data: dict[str, Any]) -> str:
    """Generate standalone HTML report for cross-sectional peer cohort."""
    peers = data.get("peers", [])
    rows = []
    for p in peers:
        rows.append(f"""
<tr>
  <td><strong>#{p['composite_rank']}</strong></td>
  <td class="txt"><strong>{escape(p['ticker'])}</strong> ({escape(p['company_name'])})</td>
  <td>{p['resiliency_score']:.2f}</td>
  <td>{p['market_beta']:.2f}</td>
  <td>{p['downside_beta']:.2f}</td>
  <td>{p['coskewness']:+.3f}</td>
  <td>{p['altman_z_score']:.2f}</td>
  <td>{p['piotroski_f_score']}/9</td>
  <td>{p['merton_dd']:.2f} σ</td>
  <td>{p['roll_spread_pct']:.2f}%</td>
  <td>{p['annual_volatility_pct']:.1f}%</td>
  <td>{p['annual_return_pct']:+.1f}%</td>
</tr>""")

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(data.get('sector', 'Sector'))} — Cross-Sectional Peer Benchmark</title>
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:30px auto;max-width:1100px;padding:0 20px;color:#1c1b19;background:#fbfbfa;line-height:1.6;}}
h1{{font-size:1.8rem;margin-bottom:6px;}}
.sub{{color:#6b6862;margin-bottom:24px;font-size:0.95rem;}}
table{{width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);}}
th,td{{padding:10px 14px;text-align:right;border-bottom:1px solid #e3e1dc;font-size:0.9rem;font-variant-numeric:tabular-nums;}}
th{{background:#f5f4f1;color:#6b6862;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;}}
th:first-child,td:first-child{{text-align:center;}}
th.txt,td.txt{{text-align:left;}}
tr:hover{{background:#fdfcf9;}}
.card{{background:#fff;border:1px solid #e3e1dc;border-radius:8px;padding:18px 22px;margin:20px 0;}}
</style></head><body>
<h1>{escape(data.get('sector', 'Sector'))} — Peer Resiliency Benchmark</h1>
<div class="sub">Cross-Sectional Multi-Factor & Solvency Ranking &middot; {data.get('start')} to {data.get('end')} &middot; Benchmark: {escape(data.get('benchmark', '^NSEI'))}</div>
<div class="card">
  <h3 style="margin-top:0;">Cohort Resiliency Ranking Matrix</h3>
  <p>Peers ranked by composite resiliency score integrating asymmetric downside market sensitivity (&beta;⁻), Harvey-Siddique coskewness, Emerging Market Altman Z"-Score solvency, Merton Distance to Default, and Piotroski F-Score fundamental quality.</p>
  <div style="overflow-x:auto;">
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th class="txt">Peer Company</th>
          <th>Resiliency</th>
          <th>Beta (β)</th>
          <th>Downside β⁻</th>
          <th>Coskew</th>
          <th>Altman Z"</th>
          <th>Piotroski F</th>
          <th>Merton DD</th>
          <th>Roll Spread</th>
          <th>Ann. Vol</th>
          <th>Ann. Return</th>
        </tr>
      </thead>
      <tbody>
        {"".join(rows)}
      </tbody>
    </table>
  </div>
</div>
</body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Cross-Sectional Multi-Company Peer Cohort Benchmark")
    parser.add_argument("--tickers", required=True, help="Comma-separated ticker list, e.g. GSL.NS,MAZDOCK.NS,COCHINSHIP.NS,GRSE.NS")
    parser.add_argument("--sector", default="Defence Shipbuilders & Marine", help="Sector name")
    parser.add_argument("--start", default="2025-01-01")
    parser.add_argument("--end", default="2026-01-01")
    parser.add_argument("--benchmark", default="^NSEI")
    parser.add_argument("--out", default="json/peer_benchmark.json")
    parser.add_argument("--html", default="out/peer_benchmark.html")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    ticker_list = [t.strip() for t in args.tickers.split(",") if t.strip()]
    data = compute_peer_cohort_benchmark(
        ticker_list,
        sector=args.sector,
        start=date.fromisoformat(args.start),
        end=date.fromisoformat(args.end),
        benchmark=args.benchmark,
    )

    print(f"\n{'=' * 74}\nPEER COHORT BENCHMARK: {data['sector']} ({data['peer_count']} peers)")
    print(f"{data['start']} to {data['end']} vs {data['benchmark']}\n{'=' * 74}")
    for p in data["peers"]:
        print(f"#{p['composite_rank']:<2} {p['ticker']:<15} Resiliency: {p['resiliency_score']:<5.2f} | "
              f"Beta: {p['market_beta']:<4.2f} (Down: {p['downside_beta']:<4.2f}) | "
              f"Altman Z: {p['altman_z_score']:<4.2f} | Piotroski: {p['piotroski_f_score']}/9 | DD: {p['merton_dd']:.1f}σ")

    if args.out:
        raw_out = Path(args.out)
        if raw_out.parent == Path(".") or str(raw_out.parent) == "":
            out_p = Path("json") / raw_out.name
        elif raw_out.parent == Path("out") and raw_out.suffix == ".json" and args.out == "out/peer_benchmark.json":
            out_p = Path("json") / raw_out.name
        else:
            out_p = raw_out
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(data, indent=2), encoding="utf-8")
        print(f"\nwrote {out_p}")

    if args.html:
        raw_html = Path(args.html)
        html_p = Path("out") / raw_html.name if (raw_html.parent == Path(".") or str(raw_html.parent) == "") else raw_html
        html_p.parent.mkdir(parents=True, exist_ok=True)
        html_p.write_text(build_peer_benchmark_html(data), encoding="utf-8")
        print(f"wrote {html_p}")


if __name__ == "__main__":
    main()
