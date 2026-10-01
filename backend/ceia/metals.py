"""Metals Commodities Surveillance & Cross-Asset Sensitivity Module.

Tracks key industrial and precious metals commodities:
1. Zinc (MZN=F / ZNC=F / LME Zinc) - Key industrial galvanizing metal
2. Copper (HG=F - COMEX High Grade Copper) - Global economic bellwether / 'Dr. Copper'
3. Gold (GC=F - COMEX Gold) - Safe haven & monetary store of value
4. Silver (SI=F - COMEX Silver) - Dual monetary & industrial technology metal (solar/electronics)
5. Aluminium (ALI=F - LME Aluminium) - Lightweight industrial / aerospace / packaging metal

Computes spot prices, window trajectories, 1-week momentum, annualized volatilities,
and cross-asset return correlations with the equity under surveillance.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .prices import FastYahooProvider, PriceError, PriceProvider, YahooChartProvider

log = logging.getLogger(__name__)

CACHE_DIR = Path("data/macro_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Curated metal definitions with market symbols and economic transmission channels
METALS_SPECIFICATIONS = [
    {
        "symbol": "HG=F",
        "alt_symbols": ["COPPER=F", "CP=F"],
        "name": "Copper",
        "category": "Industrial Metal",
        "unit": "$/lb",
        "description": "Global economic activity bellwether ('Dr. Copper')",
        "benchmark_start": 4.15,
        "benchmark_end": 4.52,
        "transmission_channel": "Global capex, electronics, power grid infrastructure, and electric vehicles",
    },
    {
        "symbol": "ALI=F",
        "alt_symbols": ["ALUMINUM=F", "MAL=F"],
        "name": "Aluminium",
        "category": "Industrial Metal",
        "unit": "$/ton",
        "description": "Key lightweight metal for automotive, aerospace, power, and packaging",
        "benchmark_start": 2350.0,
        "benchmark_end": 2680.0,
        "transmission_channel": "Automotive body panels, aerospace structures, packaging, and transmission lines",
    },
    {
        "symbol": "ZNC=F",
        "alt_symbols": ["ZINC=F", "ZN=F"],
        "name": "Zinc",
        "category": "Industrial Metal",
        "unit": "$/ton",
        "description": "Primary anti-corrosion galvanizing agent for steel structures and infrastructure",
        "benchmark_start": 2620.0,
        "benchmark_end": 2890.0,
        "transmission_channel": "Steel galvanizing, infrastructure construction, renewable energy hardware, and alloys",
    },
    {
        "symbol": "GC=F",
        "alt_symbols": ["GOLD=F"],
        "name": "Gold",
        "category": "Precious Metal",
        "unit": "$/troy oz",
        "description": "Primary global monetary reserve asset, inflation hedge, and geopolitical risk barometer",
        "benchmark_start": 2650.0,
        "benchmark_end": 3020.0,
        "transmission_channel": "Sovereign reserve accumulation, currency debasement hedging, and safe-haven flows",
    },
    {
        "symbol": "SI=F",
        "alt_symbols": ["SILVER=F"],
        "name": "Silver",
        "category": "Precious / Industrial Metal",
        "unit": "$/troy oz",
        "description": "Hybrid precious metal with critical demand in photovoltaic solar cells and advanced electronics",
        "benchmark_start": 29.50,
        "benchmark_end": 34.80,
        "transmission_channel": "Solar PV installations, electronics conductors, investment demand, and jewelry",
    },
]


@dataclass
class MetalCommodity:
    """Individual metal commodity tracking metrics and time-series properties."""

    name: str
    symbol: str
    category: str
    unit: str
    description: str
    start_price: float
    end_price: float
    current_price: float
    change_pct: float
    momentum_1w_pct: float
    annualized_volatility_pct: float
    correlation_with_asset: float
    transmission_channel: str
    high_price: float = 0.0
    low_price: float = 0.0
    as_of_date: str = ""
    source: str = "NYMEX / COMEX / LME / Yahoo Finance"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MetalsSummary:
    """Consolidated metals commodities surveillance suite."""

    metals: list[MetalCommodity] = field(default_factory=list)
    metals_table: list[dict[str, Any]] = field(default_factory=list)
    top_performer: str = ""
    top_performer_gain_pct: float = 0.0
    precious_vs_industrial_ratio: float | None = None
    summary_narrative: str = ""
    start_date: str = ""
    end_date: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "metals": [m.to_dict() for m in self.metals],
            "metals_table": self.metals_table,
            "top_performer": self.top_performer,
            "top_performer_gain_pct": round(self.top_performer_gain_pct, 2),
            "precious_vs_industrial_ratio": (round(self.precious_vs_industrial_ratio, 2) if self.precious_vs_industrial_ratio is not None else None),
            "summary_narrative": self.summary_narrative,
            "start_date": self.start_date,
            "end_date": self.end_date,
        }


def fetch_metal_price_series(
    symbol: str,
    start: date,
    end: date,
    alt_symbols: list[str] | None = None,
    provider: PriceProvider | None = None,
) -> pd.DataFrame:
    """Fetch historical daily closes for a metal commodity with disk caching and fallback."""
    clean_sym = symbol.replace("=", "_").replace("^", "").replace(".", "_")
    cache_file = CACHE_DIR / f"metal_{clean_sym}_{start}_{end}.csv"

    # Check cache
    if cache_file.exists():
        try:
            df = pd.read_csv(cache_file, index_col=0, parse_dates=True)
            if not df.empty and "close" in df.columns:
                return df
        except Exception:
            pass

    provider = provider or FastYahooProvider()
    symbols_to_try = [symbol] + (alt_symbols or [])

    for sym in symbols_to_try:
        try:
            frame = provider.history(sym, start, end)
            if frame is not None and not frame.empty and "close" in frame.columns:
                frame.to_csv(cache_file)
                return frame
        except PriceError:
            continue
        except Exception as exc:
            log.debug("Metal fetch error for %s: %s", sym, exc)
            continue

    return pd.DataFrame(columns=["close"])


def compute_metals_summary(
    start: date,
    end: date,
    asset_returns: pd.Series | None = None,
    provider: PriceProvider | None = None,
) -> MetalsSummary:
    """Compile comprehensive surveillance across Zinc, Copper, Gold, Silver, and Aluminium."""
    metals_list: list[MetalCommodity] = []
    unavailable: list[str] = []
    metals_table_rows: list[dict[str, Any]] = []

    for spec in METALS_SPECIFICATIONS:
        sym = spec["symbol"]
        name = spec["name"]
        unit = spec["unit"]
        cat = spec["category"]
        desc = spec["description"]
        channel = spec["transmission_channel"]
        bench_start = spec["benchmark_start"]
        bench_end = spec["benchmark_end"]

        df = fetch_metal_price_series(sym, start, end, alt_symbols=spec.get("alt_symbols"), provider=provider)

        if not df.empty and len(df) >= 2 and "close" in df.columns:
            c_series = df["close"].dropna().astype(float)
            p_start = float(c_series.iloc[0])
            p_end = float(c_series.iloc[-1])
            p_curr = p_end
            p_high = float(c_series.max())
            p_low = float(c_series.min())
            as_of = c_series.index[-1].strftime("%d-%b-%Y")

            pct_change = ((p_end - p_start) / p_start) * 100.0 if p_start > 0 else 0.0

            # 1-Week Momentum (last 5 trading sessions)
            if len(c_series) >= 5:
                mom_1w = ((p_end - float(c_series.iloc[-5])) / float(c_series.iloc[-5])) * 100.0
            else:
                mom_1w = pct_change

            # Returns series
            m_returns = c_series.pct_change().dropna()
            ann_vol = float(m_returns.std(ddof=1) * np.sqrt(252.0) * 100.0) if len(m_returns) > 1 else 20.0

            # Correlation with company asset returns
            corr_val = 0.0
            if asset_returns is not None and not asset_returns.empty:
                common_idx = m_returns.index.intersection(asset_returns.index)
                if len(common_idx) >= 10:
                    r1 = m_returns.reindex(common_idx)
                    r2 = asset_returns.reindex(common_idx)
                    val = float(r1.corr(r2))
                    corr_val = val if not np.isnan(val) else 0.0
        else:
            # No live series: report the metal as unavailable rather than invent one
            unavailable.append(name)
            continue

        metal_obj = MetalCommodity(
            name=name,
            symbol=sym,
            category=cat,
            unit=unit,
            description=desc,
            start_price=round(p_start, 2),
            end_price=round(p_end, 2),
            current_price=round(p_curr, 2),
            high_price=round(p_high, 2),
            low_price=round(p_low, 2),
            change_pct=round(pct_change, 2),
            momentum_1w_pct=round(mom_1w, 2),
            annualized_volatility_pct=round(ann_vol, 2),
            correlation_with_asset=round(corr_val, 3),
            transmission_channel=channel,
            as_of_date=as_of,
        )
        metals_list.append(metal_obj)

        metals_table_rows.append({
            "Commodity Metal": name,
            "Symbol": sym,
            "Category": cat,
            "Spot Price": f"{p_curr:,.2f} {unit}",
            "Window Return (%)": f"{pct_change:+.2f}%",
            "1-Week Momentum": f"{mom_1w:+.2f}%",
            "Annualized Volatility": f"{ann_vol:.1f}%",
            "Asset Correlation (r)": f"{corr_val:+.3f}",
            "Transmission Role": channel,
        })

    top_metal = max(metals_list, key=lambda m: m.change_pct) if metals_list else None
    bottom_metal = min(metals_list, key=lambda m: m.change_pct) if metals_list else None
    top_name = top_metal.name if top_metal else ""
    top_gain = top_metal.change_pct if top_metal else 0.0

    # Gold / copper ratio on the conventional basis: dollars per ounce of gold over dollars per pound of copper
    gold_obj = next((m for m in metals_list if m.name == "Gold"), None)
    copper_obj = next((m for m in metals_list if m.name == "Copper"), None)
    ratio = (gold_obj.current_price / copper_obj.current_price) if (gold_obj and copper_obj and copper_obj.current_price > 0) else None

    if metals_list:
        narrative = (
            f"Over the window, {top_name} was the best performer at {top_gain:+.2f}% and "
            f"{bottom_metal.name} the weakest at {bottom_metal.change_pct:+.2f}%."
        )
        if unavailable:
            narrative += f" No live price series was available for: {', '.join(unavailable)}."
    else:
        narrative = "No live metal price series was available for this window."

    return MetalsSummary(
        metals=metals_list,
        metals_table=metals_table_rows,
        top_performer=top_name,
        top_performer_gain_pct=top_gain,
        precious_vs_industrial_ratio=ratio,
        summary_narrative=narrative,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
    )
