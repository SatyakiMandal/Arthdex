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
    {"id": "bank", "symbol": "^NSEBANK", "label": "Nifty Bank", "ticker": "BANK", "color": "#3b82f6"},
    {"id": "it", "symbol": "^CNXIT", "label": "Nifty IT", "ticker": "IT", "color": "#a855f7"},
    {"id": "auto", "symbol": "^CNXAUTO", "label": "Nifty Auto", "ticker": "AUTO", "color": "#f59e0b"},
    {"id": "fmcg", "symbol": "^CNXFMCG", "label": "Nifty FMCG", "ticker": "FMCG", "color": "#10b981"},
    {"id": "metal", "symbol": "^CNXMETAL", "label": "Nifty Metal", "ticker": "METAL", "color": "#f97316"},
    {"id": "pharma", "symbol": "^CNXPHARMA", "label": "Nifty Pharma", "ticker": "PHARM", "color": "#22c55e"},
    {"id": "realty", "symbol": "^CNXREALTY", "label": "Nifty Realty", "ticker": "REALT", "color": "#ec4899"},
    {"id": "energy", "symbol": "^CNXENERGY", "label": "Nifty Energy", "ticker": "ENRGY", "color": "#eab308"},
    {"id": "infra", "symbol": "^CNXINFRA", "label": "Nifty Infra", "ticker": "INFRA", "color": "#6366f1"},
    {"id": "pse", "symbol": "^CNXPSE", "label": "Nifty PSE", "ticker": "PSE", "color": "#06b6d4"},
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

                # JdK RRG Mathematical Standardization:
                # 1. Smooth relative strength using 10-period EMA
                rs_smooth = rs.ewm(span=10, adjust=False).mean()

                # 2. RS-Ratio centered at 100 with rolling 20-period Z-score standardization
                rs_mean = rs_smooth.rolling(window=20, min_periods=5).mean()
                rs_std = rs_smooth.rolling(window=20, min_periods=5).std().replace(0, 1e-6)
                z_rs = (rs_smooth - rs_mean) / rs_std
                rs_ratio = 100.0 + (z_rs.ewm(span=5, adjust=False).mean() * 1.5)

                # 3. RS-Momentum: Rate of change of RS-Ratio, also smoothed and standardized
                mom_raw = rs_ratio - rs_ratio.shift(5)
                mom_mean = mom_raw.rolling(window=20, min_periods=5).mean()
                mom_std = mom_raw.rolling(window=20, min_periods=5).std().replace(0, 1e-6)
                z_mom = (mom_raw - mom_mean) / mom_std
                rs_mom = 100.0 + (z_mom.ewm(span=5, adjust=False).mean() * 1.5)

                # 12-week weekly trail (step = 5 trading sessions)
                last_idx = len(common_dates)
                step = 5
                num_points = 12
                raw_indices = []
                for k in range(num_points):
                    idx = last_idx - 1 - (num_points - 1 - k) * step
                    if idx >= 0:
                        raw_indices.append(idx)
                if not raw_indices:
                    raw_indices = [last_idx - 1]
                elif raw_indices[-1] != last_idx - 1:
                    raw_indices.append(last_idx - 1)

                indices = sorted(list(dict.fromkeys(raw_indices)))

                trail: list[dict[str, Any]] = []
                for idx in indices:
                    d_str = str(common_dates[idx])[:10]
                    r_val = round(float(rs_ratio.iloc[idx]), 2)
                    m_val = round(float(rs_mom.iloc[idx]), 2) if pd.notna(rs_mom.iloc[idx]) else 100.0
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
                    "ticker": sec["ticker"],
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
