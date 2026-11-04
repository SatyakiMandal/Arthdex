"""Relative Rotation Graph (RRG) for NSE Sectoral Indices.

Calculates JdK RS-Ratio and RS-Momentum for the 10 key sectoral indices
against the benchmark Nifty 50.

Quadrants:
- Leading (Top-Right): Outperforming and gaining relative momentum (RS-Ratio >= 100, RS-Momentum >= 100)
- Weakening (Bottom-Right): Outperforming but losing relative momentum (RS-Ratio >= 100, RS-Momentum < 100)
- Lagging (Bottom-Left): Underperforming and losing relative momentum (RS-Ratio < 100, RS-Momentum < 100)
- Improving (Top-Left): Underperforming but gaining relative momentum (RS-Ratio < 100, RS-Momentum >= 100)
"""

from __future__ import annotations

from typing import Any
import pandas as pd

from ..cache import CACHE
from ..providers import yahoo

SECTORS = [
    {"id": "bank", "symbol": "^NSEBANK", "label": "Nifty Bank", "color": "#3b82f6"},
    {"id": "it", "symbol": "^CNXIT", "label": "Nifty IT", "color": "#06b6d4"},
    {"id": "auto", "symbol": "^CNXAUTO", "label": "Nifty Auto", "color": "#f59e0b"},
    {"id": "fmcg", "symbol": "^CNXFMCG", "label": "Nifty FMCG", "color": "#10b981"},
    {"id": "metal", "symbol": "^CNXMETAL", "label": "Nifty Metal", "color": "#f97316"},
    {"id": "pharma", "symbol": "^CNXPHARMA", "label": "Nifty Pharma", "color": "#8b5cf6"},
    {"id": "realty", "symbol": "^CNXREALTY", "label": "Nifty Realty", "color": "#ec4899"},
    {"id": "energy", "symbol": "^CNXENERGY", "label": "Nifty Energy", "color": "#eab308"},
    {"id": "infra", "symbol": "^CNXINFRA", "label": "Nifty Infra", "color": "#6366f1"},
    {"id": "pse", "symbol": "^CNXPSE", "label": "Nifty PSE", "color": "#14b8a6"},
]

BENCHMARK_SYMBOL = "^NSEI"


def compute_rrg() -> dict[str, Any]:
    """Compute RS-Ratio, RS-Momentum and trails for all major NSE sectors against Nifty 50."""

    def _build():
        bench_df = yahoo.fetch_history(BENCHMARK_SYMBOL, "6M")
        if bench_df.empty:
            raise ValueError("Could not fetch Nifty 50 benchmark history")

        bench_closes = bench_df["Close"].dropna()

        sectors_data: list[dict[str, Any]] = []

        for sec in SECTORS:
            try:
                sec_df = yahoo.fetch_history(sec["symbol"], "6M")
                if sec_df.empty:
                    continue

                sec_closes = sec_df["Close"].dropna()
                common_dates = bench_closes.index.intersection(sec_closes.index)
                if len(common_dates) < 25:
                    continue

                b_sub = bench_closes.loc[common_dates]
                s_sub = sec_closes.loc[common_dates]

                # Relative Strength: Sector / Benchmark * 100
                rs = (s_sub / b_sub) * 100.0

                # 10-period EMA of RS
                rs_ema = rs.ewm(span=10, adjust=False).mean()

                # RS-Ratio centered at 100: normalized distance from EMA
                rs_ratio = 100.0 + ((rs - rs_ema) / rs_ema) * 100.0 * 2.5

                # RS-Momentum centered at 100: rate of change of RS-Ratio
                rs_mom = 100.0 + (rs_ratio.diff(3) / rs_ratio.shift(3)) * 100.0 * 3.0

                # Recent points for trail (last 4 sessions)
                trail: list[dict[str, Any]] = []
                last_idx = len(common_dates)
                lookback = min(5, last_idx)
                for i in range(last_idx - lookback, last_idx):
                    d_str = str(common_dates[i])[:10]
                    r_val = round(float(rs_ratio.iloc[i]), 2)
                    m_val = round(float(rs_mom.iloc[i]), 2) if pd.notna(rs_mom.iloc[i]) else 100.0
                    trail.append({"date": d_str, "rsRatio": r_val, "rsMomentum": m_val})

                cur_ratio = trail[-1]["rsRatio"]
                cur_mom = trail[-1]["rsMomentum"]

                # Assign quadrant
                if cur_ratio >= 100.0 and cur_mom >= 100.0:
                    quadrant = "Leading"
                elif cur_ratio >= 100.0 and cur_mom < 100.0:
                    quadrant = "Weakening"
                elif cur_ratio < 100.0 and cur_mom < 100.0:
                    quadrant = "Lagging"
                else:
                    quadrant = "Improving"

                # Returns
                last_close = float(s_sub.iloc[-1])
                prev_close = float(s_sub.iloc[-2]) if len(s_sub) > 1 else last_close
                week_ago_close = float(s_sub.iloc[-6]) if len(s_sub) > 5 else prev_close
                month_ago_close = float(s_sub.iloc[-22]) if len(s_sub) > 21 else week_ago_close

                chg_1d = round(((last_close / prev_close) - 1.0) * 100.0, 2)
                chg_1w = round(((last_close / week_ago_close) - 1.0) * 100.0, 2)
                chg_1m = round(((last_close / month_ago_close) - 1.0) * 100.0, 2)

                sectors_data.append({
                    "id": sec["id"],
                    "symbol": sec["symbol"],
                    "label": sec["label"],
                    "color": sec["color"],
                    "quadrant": quadrant,
                    "rsRatio": cur_ratio,
                    "rsMomentum": cur_mom,
                    "trail": trail,
                    "lastClose": round(last_close, 2),
                    "change1d": chg_1d,
                    "change1w": chg_1w,
                    "change1m": chg_1m,
                })
            except Exception:
                continue

        sectors_data.sort(key=lambda s: s["rsRatio"], reverse=True)

        return {
            "benchmark": "NIFTY 50",
            "asOf": str(bench_closes.index[-1])[:10],
            "quadrantCounts": {
                "Leading": sum(1 for s in sectors_data if s["quadrant"] == "Leading"),
                "Weakening": sum(1 for s in sectors_data if s["quadrant"] == "Weakening"),
                "Lagging": sum(1 for s in sectors_data if s["quadrant"] == "Lagging"),
                "Improving": sum(1 for s in sectors_data if s["quadrant"] == "Improving"),
            },
            "sectors": sectors_data,
        }

    data, _ = CACHE.get_or_fetch("market:sector_rotation_rrg", 900, _build)
    return data
