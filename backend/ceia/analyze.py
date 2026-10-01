"""Phase 2 entry point: run the event study over a company and date range.

Reuses Phase 1 ingestion (or a saved run via ``--news``), loads prices, computes
abnormal returns, and ranks candidate incident days.

    python -m ceia.analyze --company "Adani Enterprises" --ticker ADANIENT.NS \\
        --start 2023-01-24 --end 2023-02-10 --alias Adani

One ordering detail matters: prices are loaded **before** news is attributed to
trading days, so attribution can use the exchange's real calendar rather than a
weekday approximation. That is what stops a story published on the evening of
25 January 2023 being credited to the 26th, which was Republic Day and not a
trading day at all.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import dataclass, field, replace
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from . import align, dedupe, eventstudy, news_cache, returns
from . import distance_to_default as dd_mod
from . import financials as financials_mod
from . import forecasting as forecasting_mod
from . import global_markets as global_markets_mod
from . import macro as macro_mod
from . import nifty as nifty_mod
from . import staleness as staleness_mod
from . import var as var_mod
from . import portfolio as portfolio_mod
from . import xai as xai_mod
from . import sdid as sdid_mod
from . import spillover as spillover_mod
from . import microstructure as microstructure_mod
from . import regime as regime_mod
from dataclasses import asdict
from .fetcher import DEFAULT_USER_AGENT, Fetcher
from .ingest import DEFAULT_SOURCES, IngestResult, run as run_ingest
from .models import NewsItem, RunConfig
from .prices import PriceError, PriceProvider
from .sources import WAYBACK_SOURCES
from .ticker_lookup import TickerLookupError, resolve_ticker

# Every source this CLI can drive in one command, live-scraped sources plus
# the best-effort Wayback Machine fallback (see README Phase 8) - the
# default for --sources, so a plain `ceia.analyze` run checks everything
# without the caller needing to enumerate sources by hand.
ALL_RUNNABLE_SOURCES = DEFAULT_SOURCES + WAYBACK_SOURCES

log = logging.getLogger(__name__)


@dataclass
class Analysis:
    config: RunConfig
    daily: pd.DataFrame
    incidents: list[eventstudy.Incident]
    price_meta: dict
    news_meta: dict
    caveats: list[str] = field(default_factory=list)
    unattributed: list[NewsItem] = field(default_factory=list)
    correlation: dict = field(default_factory=dict)
    extremity_volume_correlation: dict = field(default_factory=dict)
    lagged_correlation: dict = field(default_factory=dict)
    emotion_summary: dict = field(default_factory=dict)
    secondary_daily: pd.DataFrame | None = None
    secondary_meta: dict = field(default_factory=dict)
    robustness: dict = field(default_factory=dict)
    diagnostics: dict = field(default_factory=dict)
    macro_events: list = field(default_factory=list)
    macro: dict = field(default_factory=dict)
    nifty_indices: dict = field(default_factory=dict)
    global_indices: dict = field(default_factory=dict)
    financials: dict = field(default_factory=dict)
    distance_to_default: dict = field(default_factory=dict)
    var: dict = field(default_factory=dict)
    forecasting: dict = field(default_factory=dict)
    portfolio: dict = field(default_factory=dict)
    xai: dict = field(default_factory=dict)
    sdid: dict = field(default_factory=dict)
    spillover: dict = field(default_factory=dict)
    microstructure: dict = field(default_factory=dict)
    regime: dict = field(default_factory=dict)
    volatility_models: dict = field(default_factory=dict)
    metals: dict = field(default_factory=dict)
    technical_analysis: dict = field(default_factory=dict)
    backtesting: dict = field(default_factory=dict)
    investment_verdict: dict = field(default_factory=dict)
    relative_valuation_multiples: dict = field(default_factory=dict)
    valuation_suite: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        table = self.daily.reset_index()
        table["date"] = table["date"].astype(str)
        secondary = dict(self.secondary_meta)
        if self.secondary_daily is not None and not self.secondary_daily.empty:
            secondary_table = self.secondary_daily.reset_index()
            secondary_table["date"] = secondary_table["date"].astype(str)
            secondary["daily"] = json.loads(secondary_table.to_json(orient="records"))
        nifty = {}
        for name, index in self.nifty_indices.items():
            entry = {"ticker": index.ticker, "provider": index.provider,
                     "window_return": index.window_return, "note": index.note,
                     "model": index.model_kind, "model_note": index.model_note,
                     "beta": index.beta, "r_squared": index.r_squared,
                     "event_study_note": index.event_study_note,
                     "incident_stats": index.incident_stats}
            if index.available:
                idx_table = index.daily.reset_index()
                idx_table["date"] = idx_table["date"].astype(str)
                entry["daily"] = json.loads(idx_table.to_json(orient="records"))
            nifty[name] = entry
        global_markets = {}
        for name, index in self.global_indices.items():
            entry = {
                "ticker": index.ticker, "provider": index.provider,
                "same_day_available": index.same_day_available,
                "window_return": index.window_return, "note": index.note,
                "aligned": {
                    day.isoformat(): {
                        "aligned_date": stats.aligned_date.isoformat(),
                        "return": stats.return_, "return_z": stats.return_z,
                    }
                    for day, stats in index.aligned.items()
                },
            }
            if index.available:
                idx_table = index.daily.reset_index()
                idx_table["date"] = idx_table["date"].astype(str)
                entry["daily"] = json.loads(idx_table.to_json(orient="records"))
            global_markets[name] = entry
        return {
            "company": self.config.company,
            "ticker": self.config.ticker,
            "benchmark": self.config.benchmark,
            "start": self.config.start.isoformat(),
            "end": self.config.end.isoformat(),
            "event_window": list(self.config.event_window),
            "prices": self.price_meta,
            "news": self.news_meta,
            "caveats": self.caveats,
            "sentiment_return_correlation": self.correlation,
            "sentiment_extremity_volume_correlation": self.extremity_volume_correlation,
            "lagged_sentiment_return_correlation": self.lagged_correlation,
            "emotion_return_summary": self.emotion_summary,
            "secondary_benchmark": secondary,
            "threshold_robustness": self.robustness,
            "flagging_diagnostics": self.diagnostics,
            "macro": self.macro,
            "metals": self.metals,
            "nifty_indices": nifty,
            "global_markets": global_markets,
            "financials": self.financials,
            "distance_to_default": self.distance_to_default,
            "var": self.var,
            "forecasting": self.forecasting,
            "portfolio": self.portfolio,
            "xai": self.xai,
            "sdid": self.sdid,
            "spillover": self.spillover,
            "microstructure": self.microstructure,
            "regime": self.regime,
            "volatility_models": self.volatility_models,
            "technical_analysis": self.technical_analysis,
            "backtesting": self.backtesting,
            "investment_verdict": self.investment_verdict,
            "relative_valuation_multiples": self.relative_valuation_multiples,
            "valuation_suite": self.valuation_suite,
            "unattributed_items": [
                {"url": i.url, "source": i.source, "headline": i.headline,
                 "reason": i.timestamp_confidence}
                for i in self.unattributed
            ],
            "daily": json.loads(table.to_json(orient="records")),
            "incidents": [i.to_dict() for i in self.incidents],
        }



def load_news_from_file(path: Path) -> tuple[list[NewsItem], dict]:
    """Rehydrate a Phase 1 run, so an analysis can be re-run without re-scraping."""
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    items = [NewsItem.from_dict(record) for record in payload.get("items", [])]
    meta = {k: v for k, v in payload.items() if k != "items"}
    if "stats" not in meta:
        meta["stats"] = {
            "unique_after_dedupe": len(items),
            "relevant": len(items),
            "total_fetched": len(items),
        }
    return items, meta



def ingest_with_cache(
    config: RunConfig, fetcher: Fetcher, cache_dir: Path,
    limit: int | None = None, max_workers: int = 8,
    skip_alias_widening: bool = False, skip_slug_prefilter: bool = False,
) -> tuple[list[NewsItem], dict]:
    """Cache-aware wrapper around :func:`ceia.ingest.run` (see
    ``ceia/news_cache.py``'s module docstring): crawls only the date
    sub-ranges not already cached for this company under the requested
    source list, then combines the freshly-crawled items with whatever was
    already cached for the rest of the window.

    ``news_meta``'s ``stats`` are recomputed from the final combined item
    list rather than summed across per-gap ``IngestResult``s, since a
    per-gap ``unique_after_dedupe``/``duplicates`` split would not reflect
    dedup run across the *combined* batch. The other, purely informational
    fields (``source_status``, ``per_source``, ``aliases_used``,
    ``disabled_sources``) are merged across whichever gaps were actually
    crawled - empty/absent for a fully cache-satisfied run, same as this
    project's other external-data sections degrade when there is nothing
    to report.
    """
    sources = tuple(sorted(config.sources or DEFAULT_SOURCES))
    cache = news_cache.load(config.company, cache_dir)
    gaps = news_cache.compute_gaps(config.start, config.end, cache.segments, sources)

    new_items: list[NewsItem] = []
    source_status: dict[str, str] = {}
    disabled_sources: dict[str, str] = {}
    per_source: dict[str, int] = {}
    aliases_used: list[str] = []
    for gap_start, gap_end in gaps:
        gap_config = replace(config, start=gap_start, end=gap_end)
        ingested = run_ingest(gap_config, fetcher=fetcher, limit=limit,
                              max_workers=max_workers,
                              skip_alias_widening=skip_alias_widening,
                              skip_slug_prefilter=skip_slug_prefilter)
        new_items.extend(ingested.items)
        source_status.update(ingested.source_status)
        disabled_sources.update(ingested.disabled_sources)
        for key, count in ingested.per_source.items():
            per_source[key] = per_source.get(key, 0) + count
        for alias in ingested.aliases_used:
            if alias not in aliases_used:
                aliases_used.append(alias)

    cached_items = news_cache.cached_items_in_window(cache, config.start, config.end, gaps)
    cached_days = {i.published_at.date() for i in cached_items if i.published_at}
    news_cache.save_after_gaps(cache, gaps, sources, new_items, cache_dir)

    items = cached_items + new_items
    dedupe.deduplicate(items)
    unique_items = dedupe.unique(items)
    log.info("news cache: %d gap range(s) crawled (%d new item(s)), %d cached "
             "item(s) reused from %d day(s) for %s [%s to %s]",
             len(gaps), len(new_items), len(cached_items), len(cached_days),
             config.company, config.start, config.end)

    news_meta = {
        "company": config.company, "ticker": config.ticker, "benchmark": config.benchmark,
        "start": config.start.isoformat(), "end": config.end.isoformat(),
        "aliases": aliases_used or config.all_aliases,
        "source_status": source_status,
        "disabled_sources": disabled_sources,
        "per_source": per_source,
        "stats": {
            "unique_after_dedupe": len(unique_items),
            "duplicates": len(items) - len(unique_items),
            "paywalled": sum(1 for i in items if i.paywalled),
            "missing_timestamp": sum(1 for i in items if i.timestamp_confidence == "missing"),
            "after_close": sum(1 for i in items if i.after_close),
        },
        "news_cache": {
            "gaps_crawled": [[g[0].isoformat(), g[1].isoformat()] for g in gaps],
            "cached_days_reused": len(cached_days),
        },
    }
    return items, news_meta


def analyse(
    config: RunConfig,
    items: list[NewsItem],
    news_meta: dict,
    lead_in_days: int = 200,
    coverage_threshold: float = eventstudy.DEFAULT_COVERAGE_Z,
    return_threshold: float = eventstudy.DEFAULT_RETURN_Z,
    providers=None,
    permutations: int = returns.DEFAULT_PERMUTATIONS,
    macro_provider: PriceProvider | None = None,
    macro_fetcher=None,
    skip_nifty_indices: bool = False,
    financials_fetcher=None,
    skip_financials: bool = False,
    skip_global_markets: bool = False,
    skip_risk_metrics: bool = False,
) -> Analysis:
    frame, model, price_meta = returns.build(
        config.ticker, config.benchmark, config.start, config.end,
        lead_in_days=lead_in_days, providers=providers,
    )

    # Staleness only needs published_at/headline/duplicate_of, all already
    # set by ingestion - no dependency on prices, so this can run before or
    # after the calendar is built. Placed here so it always runs exactly
    # once regardless of which of the three paths (news cache, --news reuse,
    # --skip-news-cache) produced ``items``.
    staleness_mod.score_items(items)

    # Real exchange calendar, now that prices are in hand.
    calendar = returns.trading_days(frame)
    align.attribute_all(items, calendar)
    price_meta["trading_days_in_window"] = len(
        [d for d in calendar if config.start <= d <= config.end])

    coverage = eventstudy.aggregate_by_day(items)
    table = eventstudy.build_daily_table(frame, coverage, config.start, config.end)
    incidents = eventstudy.rank_incidents(
        table, frame, event_window=config.event_window,
        coverage_threshold=coverage_threshold, return_threshold=return_threshold,
        permutations=permutations,
    )
    eventstudy.attach_headlines(incidents, items)
    correlation = eventstudy.sentiment_return_correlation(table)
    extremity_volume_correlation = eventstudy.sentiment_extremity_volume_correlation(table)
    lagged_correlation = eventstudy.lagged_sentiment_return_correlation(table)
    emotion_summary = eventstudy.emotion_valence_summary(table)
    robustness = eventstudy.robustness_check(
        table, frame, incidents, config.event_window,
        coverage_threshold, return_threshold,
    )
    diagnostics = eventstudy.flagging_diagnostics(
        table, coverage_threshold, return_threshold, frame=frame,
    )

    secondary_daily = None
    secondary_meta: dict = {}
    if config.benchmark2:
        secondary_meta["ticker"] = config.benchmark2
        try:
            frame2, model2, price_meta2 = returns.build(
                config.ticker, config.benchmark2, config.start, config.end,
                lead_in_days=lead_in_days, providers=providers,
            )
        except PriceError as exc:
            # A bad or unreachable peer ticker should not sink the whole run
            # - the primary benchmark comparison above is unaffected either
            # way, so this degrades to "not shown" rather than a hard failure.
            secondary_meta["note"] = f"secondary benchmark unavailable: {exc}"
            log.warning("secondary benchmark: %s", exc)
        else:
            secondary_daily = frame2.loc[
                pd.Timestamp(config.start):pd.Timestamp(config.end),
                ["close", "benchmark_close", "return", "benchmark_return",
                 "abnormal_return", "abnormal_return_z"],
            ].rename(columns={
                "benchmark_close": "secondary_close",
                "benchmark_return": "secondary_return",
                "abnormal_return": "secondary_abnormal_return",
                "abnormal_return_z": "secondary_abnormal_return_z",
            }).drop(columns=["close", "return"])
            # `table`'s index is plain date objects (build_daily_table sets
            # "date" as the index key, one date per row), while frame2's
            # index is a DatetimeIndex - joining or comparing the two without
            # normalising first would silently match nothing (different
            # dtypes never compare equal) rather than raise, exactly the
            # "looks fine, finds zero rows" trap this codebase has hit
            # before with the CDATA sitemap regex and the --limit truncation.
            secondary_daily.index = pd.Index(
                [ts.date() for ts in secondary_daily.index], name="date")
            secondary_meta.update({
                "provider": price_meta2.get("benchmark_provider"),
                "model": model2.kind,
                "alpha": model2.alpha,
                "beta": model2.beta,
                "r_squared": model2.r_squared,
                "model_note": model2.note,
                "note": (f"abnormal return of {config.ticker} recomputed against "
                        f"{config.benchmark2} as a second, independent benchmark "
                        "- a peer or sector index rather than the broad market."),
            })

    macro_events = macro_mod.macro_events_in_window(config.start, config.end)
    macro_summary = macro_mod.macro_summary(
        config.start, config.end, provider=macro_provider, fetcher=macro_fetcher)

    nifty_indices = ({} if skip_nifty_indices else
                     nifty_mod.load_nifty_indices(
                         config.start, config.end, config.benchmark,
                         candidate_days=[i.day for i in incidents],
                         event_window=config.event_window,
                         providers=providers, lead_in_days=lead_in_days,
                         permutations=permutations,
                     ))

    global_indices = ({} if skip_global_markets else
                      global_markets_mod.load_global_indices(
                          table.index.tolist(), config.start, config.end,
                          lead_in_days=lead_in_days, providers=providers,
                      ))

    financials = ({} if skip_financials else
                 financials_mod.financials_summary(
                     config.ticker, fetcher=financials_fetcher))

    distance_to_default = ({} if skip_risk_metrics else
                          dd_mod.dd_summary(
                              config.ticker, frame, financials, macro_summary))


    var_analysis = ({} if skip_risk_metrics else
                    var_mod.var_summary(frame, config.start, config.end))

    forecasting_analysis = ({} if skip_risk_metrics else
                            forecasting_mod.generate_forecasting_suite(
                                table, incidents, price_meta, financials, macro_summary, var_analysis))

    # 1. Market Microstructure & VPIN Suite
    microstructure_analysis = ({} if skip_risk_metrics else
                               asdict(microstructure_mod.compute_market_microstructure_suite(table)))

    # 2. Hamilton Markov-Switching Regimes
    regime_analysis = ({} if skip_risk_metrics else
                       asdict(regime_mod.compute_hamilton_markov_regimes(
                           table["return"] if "return" in table.columns else frame["return"])))

    # 3. Explainable AI (XAI) SHAP Factor Attribution
    if not skip_risk_metrics and forecasting_analysis:
        h21 = forecasting_analysis.get("horizons", {}).get("21", {})
        f_ret = float(h21.get("expected_return_pct", 0.0)) / 100.0
        cur_p = float(forecasting_analysis.get("current_price", 100.0))
        mean_tone = float(np.mean([inc.mean_sentiment for inc in incidents])) if incidents else 0.0
        max_lodr = float(max([getattr(inc, "lodr_score", 0.0) for inc in incidents] + [0.0])) if incidents else 0.0
        har_vol = float(forecasting_analysis.get("har_volatility", {}).get("forecast_21d_annualized", 0.20))
        merton_z = float(distance_to_default.get("distance_to_default_merton", 2.5)) if distance_to_default else 2.5
        kyle_l = float(microstructure_analysis.get("kyle_lambda_bps_per_10m", 2.0)) / 10000.0
        xai_analysis = asdict(xai_mod.compute_shapley_factor_attribution(
            forecast_return=f_ret,
            current_price=cur_p,
            sentiment_tone=mean_tone,
            lodr_materiality_score=max_lodr,
            har_volatility_annual=har_vol,
            macro_yield_change=0.01,
            merton_dd_z=merton_z,
            microstructure_kyle_lambda=kyle_l,
        ))
    else:
        xai_analysis = {}

    # 4. Multi-Asset Portfolio Allocation (HRP & Black-Litterman)
    port_rets_dict = {config.ticker: table["return"].dropna() if "return" in table.columns else frame["return"].dropna()}
    for n_name, n_idx in nifty_indices.items():
        if n_idx.available and not n_idx.daily.empty and "return" in n_idx.daily.columns:
            port_rets_dict[n_name] = n_idx.daily["return"].dropna()
    for g_name, g_idx in global_indices.items():
        if g_idx.available and not g_idx.daily.empty and "return" in g_idx.daily.columns:
            port_rets_dict[g_name] = g_idx.daily["return"].dropna()

    port_df = pd.DataFrame(port_rets_dict).dropna(thresh=2) if port_rets_dict else pd.DataFrame()
    # Covariance estimates need complete rows; ragged calendars across indices leave NaNs
    port_df = port_df.dropna() if len(port_df.dropna()) >= 30 else port_df.fillna(0.0)
    try:
        if not port_df.empty and len(port_df.columns) >= 1:
            views = {config.ticker: float(forecasting_analysis.get("horizons", {}).get("21", {}).get("expected_return_pct", 1.0)) / 100.0 * (252.0 / 21.0)} if forecasting_analysis else {}
            hrp_obj = portfolio_mod.compute_hierarchical_risk_parity(port_df)
            bl_obj = portfolio_mod.compute_black_litterman(port_df, views=views)
            kelly_obj = portfolio_mod.compute_fractional_kelly_sizing(
                expected_return=views.get(config.ticker, 0.05),
                annual_volatility=hrp_obj.portfolio_volatility_annualized or 0.20,
                leverage_penalty=float(forecasting_analysis.get("har_volatility", {}).get("asymmetry_ratio", 1.54)) if forecasting_analysis else 1.54,
            )
            portfolio_analysis = {
                "hrp": asdict(hrp_obj),
                "black_litterman": asdict(bl_obj),
                "fractional_kelly": kelly_obj,
                "weights": hrp_obj.weights,
                "diversification_ratio": hrp_obj.diversification_ratio,
            }
        else:
            portfolio_analysis = {}

    except Exception as exc:  # optional section: never sink the run
        log.warning("Portfolio allocation failed: %s", exc)
        portfolio_analysis = {}

    # 5. Diebold-Yilmaz Volatility Spillover
    try:
        if not port_df.empty and len(port_df.columns) >= 2:
            rolling_vols = port_df.rolling(10, min_periods=3).std().fillna(0.01) * np.sqrt(252.0)
            spill_obj = spillover_mod.compute_diebold_yilmaz_connectedness(rolling_vols, target_ticker=config.ticker)
            spillover_analysis = {
                "total_connectedness_index": spill_obj.total_connectedness_index,
                "directional_to": spill_obj.directional_to,
                "directional_from": spill_obj.directional_from,
                "net_spillover": spill_obj.net_spillover,
                "net_transmitters": spill_obj.net_transmitters,
                "net_receivers": spill_obj.net_receivers,
                "target_company_tci": spill_obj.target_company_tci,
                "target_company_role": spill_obj.target_company_role,
                "spillover_matrix": spill_obj.spillover_matrix.to_dict(),
            }
        else:
            spillover_analysis = {}
    except Exception as exc:  # optional section
        log.warning("spillover_analysis failed: %s", exc)
        spillover_analysis = {}

    # 6. Synthetic Difference-in-Differences (SDID)
    try:
        if not port_df.empty and len(port_df.columns) >= 2 and incidents:
            top_inc = incidents[0]
            event_dt = pd.Timestamp(top_inc.day)
            try:
                ev_loc = table.index.get_loc(event_dt) if event_dt in table.index else len(table) // 2
            except Exception:
                ev_loc = len(table) // 2

            ctrl_cols = [c for c in port_df.columns if c != config.ticker]
            sdid_obj = sdid_mod.compute_synthetic_difference_in_differences(
                treated_series=table["close"] if "close" in table.columns else frame["close"],
                control_panel_df=port_df[ctrl_cols],
                event_index=max(5, ev_loc),
                post_window_len=5,
            )
            sdid_analysis = asdict(sdid_obj)
        else:
            sdid_analysis = {}
    except Exception as exc:  # optional section
        log.warning("sdid_analysis failed: %s", exc)
        sdid_analysis = {}

    # 7. 4-Model Volatility Ensemble (GARCH, EGARCH, HAR-RV, FIGARCH) with 10-Min Intraday
    from .volatility_models import compute_volatility_model_ensemble
    try:
        vol_obj = compute_volatility_model_ensemble(config.ticker, table["return"].dropna())
        volatility_analysis = vol_obj.to_dict()
    except Exception as exc:
        log.warning("Volatility models ensemble computation failed: %s", exc)
        volatility_analysis = {}

    # 8. Metals Commodities Surveillance (Zinc, Copper, Gold, Silver, Aluminium)
    from .metals import compute_metals_summary
    try:
        metals_obj = compute_metals_summary(config.start, config.end, asset_returns=table["return"].dropna() if "return" in table.columns else frame["return"].dropna(), provider=macro_provider)
        metals_analysis = metals_obj.to_dict()
    except Exception as exc:
        log.warning("Metals commodities computation failed: %s", exc)
        metals_analysis = {}

    # 9. 1-Week Institutional Technical Analysis Suite
    from .technical_analysis import compute_technical_analysis
    try:
        # Indicators need the lead-in history (a 200-bar average cannot be built from a 157-day
        # window) and the session high/low, and they describe the market as of the window's end.
        ta_frame = frame.loc[:pd.Timestamp(config.end)]
        tech_obj = compute_technical_analysis(ta_frame if len(ta_frame) >= 60 else (table if not table.empty else frame))
        technical_analysis = tech_obj.to_dict()
    except Exception as exc:
        log.warning("Technical analysis computation failed: %s", exc)
        technical_analysis = {}

    # 10. Quantitative Backtesting & Econometric Validation Engine
    from .backtest import run_comprehensive_backtest_suite
    try:
        inc_dicts = [asdict(i) if hasattr(i, "__dataclass_fields__") else i for i in incidents]
        backtest_obj = run_comprehensive_backtest_suite(table if not table.empty else frame, candidate_incidents=inc_dicts)
        backtest_analysis = backtest_obj.to_dict()
    except Exception as exc:
        log.warning("Backtest suite computation failed: %s", exc)
        backtest_analysis = {}

    valuation_pack = None
    relative_multiples: dict = {}
    valuation_suite_json: dict = {}

    # 11. Actionable Investment Call, Prescribed Quantity & Holding Period Engine
    from .investment_verdict import compute_investment_verdict
    try:
        curr_p = float(table["close"].iloc[-1]) if ("close" in table.columns and not table.empty) else (float(frame["close"].iloc[-1]) if not frame.empty else 100.0)
        # One valuation shared by the verdict, the dossier and the multiples table
        try:
            from .valuation_model import run_valuation_suite

            valuation_pack = run_valuation_suite(financials, curr_p, float(price_meta.get("beta") or 1.0), config.ticker)
            if valuation_pack:
                relative_multiples = valuation_pack["multiples"].to_dict()
                vp = valuation_pack
                valuation_suite_json = {
                    "isBank": vp["is_bank"],
                    "methodology": getattr(vp["core"], "methodology", None),
                    "baseNopat": vp["base_nopat"],
                    "basis": vp["basis"],
                    "marketCap": vp["market_cap"],
                    "unit": financials.get("currency_unit"),
                    "wacc": vp["wacc"].to_dict(),
                    "core": vp["core"].to_dict(),
                    "scenario": asdict(vp["scenario"]),
                    "bayesian": asdict(vp["bayesian"]),
                    "dupont": vp["dupont"].to_dict(),
                }
                gap = getattr(vp["core"], "upside_downside_pct", None)
                if gap is not None and abs(gap) > 50.0:
                    valuation_suite_json["warning"] = (
                        f"The model value differs from the market price by {gap:+.0f}%. A gap that large usually means the "
                        "simple growth assumptions do not fit this business (for example a capital-heavy group, a REIT or a "
                        "lender), not that the market is that wrong. Treat it as a model-fit warning."
                    )
        except Exception as exc:
            log.warning("Valuation suite failed: %s", exc)
        verdict_obj = compute_investment_verdict(
            current_price=curr_p,
            daily_df=table if not table.empty else frame,
            incidents=incidents,
            financials=financials,
            technical_res=technical_analysis,
            macro_data=macro_summary,
            var_metrics=var_analysis,
            distance_to_default=distance_to_default,
            backtest_data=backtest_analysis,
            as_of=config.end,
            news_available=bool(items),
            dcf_res=valuation_pack["core"] if valuation_pack else None,
            valuation_multiples=valuation_pack["multiples"] if valuation_pack else None,
        )
        investment_verdict_analysis = verdict_obj.to_dict()
    except Exception as exc:
        log.warning("Investment verdict computation failed: %s", exc)
        investment_verdict_analysis = {}

    return Analysis(
        config=config,
        daily=table,
        incidents=incidents,
        price_meta=price_meta,
        news_meta=news_meta,
        caveats=eventstudy.caveats(table, incidents, model.kind,
                                   price_meta.get("ar_scale_source", "")),
        unattributed=align.unattributed(items),
        correlation=correlation,
        extremity_volume_correlation=extremity_volume_correlation,
        lagged_correlation=lagged_correlation,
        emotion_summary=emotion_summary,
        secondary_daily=secondary_daily,
        secondary_meta=secondary_meta,
        robustness=robustness,
        diagnostics=diagnostics,
        macro_events=macro_events,
        macro=macro_summary,
        nifty_indices=nifty_indices,
        global_indices=global_indices,
        financials=financials,
        distance_to_default=distance_to_default,
        var=var_analysis,
        forecasting=forecasting_analysis,
        portfolio=portfolio_analysis,
        xai=xai_analysis,
        sdid=sdid_analysis,
        spillover=spillover_analysis,
        microstructure=microstructure_analysis,
        regime=regime_analysis,
        volatility_models=volatility_analysis,
        metals=metals_analysis,
        technical_analysis=technical_analysis,
        backtesting=backtest_analysis,
        investment_verdict=investment_verdict_analysis,
        relative_valuation_multiples=relative_multiples,
        valuation_suite=valuation_suite_json,
    )



def _print(analysis: Analysis) -> None:
    config = analysis.config
    print(f"\n{'=' * 74}")
    print(f"EVENT STUDY - {config.company} ({config.ticker}) vs {config.benchmark}")
    print(f"{config.start} to {config.end}")
    print("=" * 74)

    meta = analysis.price_meta
    print(f"\nPrices: {meta['company_provider']} / {meta['benchmark_provider']}, "
          f"{meta['rows_in_analysis_window']} trading days in window")
    print(f"Model : {meta['model']}  alpha={meta['alpha']:.5f} beta={meta['beta']:.3f} "
          f"R2={meta['r_squared']:.3f}" if meta["model"] == "market-model"
          else f"Model : {meta['model']} ({meta['model_note']})")

    news = analysis.news_meta.get("stats", {})
    if news:
        print(f"News  : {news.get('unique_after_dedupe', '?')} unique items, "
              f"{news.get('duplicates', 0)} duplicates, "
              f"{news.get('after_close', 0)} published after the close")
    if analysis.unattributed:
        print(f"        {len(analysis.unattributed)} item(s) had no usable "
              f"timestamp and were NOT attributed to any trading day")

    d = analysis.diagnostics
    if d.get("trading_days"):
        print(f"Flagging: {d['trading_days']} trading day(s), {d['days_with_news']} "
              f"with news; {d['candidates']} candidate(s), {d['coverage_only']} "
              f"busy/toned but ordinary move, {d['return_only']} unusual move but "
              f"ordinary coverage, {d['no_coverage_big_move']} unusual move with NO "
              f"coverage collected, {d['routine']} routine")

    corr = analysis.correlation
    if corr.get("r") is not None:
        print(f"Sentiment/return correlation: r={corr['r']:+.3f} "
              f"(R2={corr['r_squared']:.3f}, n={corr['n']}) — {corr['note']}")
    elif corr:
        print(f"Sentiment/return correlation: not computed — {corr.get('note', '')}")

    extremity = analysis.extremity_volume_correlation
    if extremity.get("r") is not None:
        print(f"Sentiment extremity/volume correlation: r={extremity['r']:+.3f} "
              f"(n={extremity['n']}) — Tetlock (2007): unusually high or low "
              f"tone predicts high volume")

    lagged = analysis.lagged_correlation.get("horizons") or {}
    for h, result in sorted(lagged.items()):
        if result.get("r") is not None:
            print(f"Sentiment -> return {h} day(s) later: r={result['r']:+.3f} "
                  f"(n={result['n']})")

    groups = analysis.emotion_summary.get("groups") or {}
    if groups:
        print("Emotion valence vs abnormal return (GoEmotions, descriptive only):")
        for valence in ("positive", "negative", "ambiguous"):
            g = groups.get(valence)
            if not g:
                continue
            print(f"   {valence:<10} n={g['n_days']:<3} "
                  f"mean abnormal={g['mean_abnormal_return'] * 100:+.2f}%  "
                  f"mean sentiment={g['mean_weighted_sentiment']:+.2f}  "
                  f"({', '.join(g['labels_seen'])})")

    sec_meta = analysis.secondary_meta
    if sec_meta.get("model") is not None:
        print(f"Secondary benchmark ({sec_meta['ticker']}): {sec_meta['model']} "
              f"beta={sec_meta['beta']:.3f} R2={sec_meta['r_squared']:.3f} — "
              f"{sec_meta['note']}")
    elif sec_meta.get("note"):
        print(f"Secondary benchmark ({sec_meta.get('ticker', '?')}): "
              f"{sec_meta['note']}")

    if analysis.nifty_indices:
        print("Nifty sector indices (descriptive backdrop, not part of flagging):")
        candidate_days = [i.day for i in analysis.incidents]
        for name, index in analysis.nifty_indices.items():
            if not index.available:
                print(f"   {name:<12} unavailable — {index.note}")
                continue
            agreement = nifty_mod.same_direction_rate(
                index, analysis.daily, candidate_days)
            agree_str = (f", moved with {config.ticker} on {agreement['agree']}/"
                        f"{agreement['n']} candidate day(s)" if agreement["n"] else "")
            print(f"   {name:<12} {index.window_return * 100:+.2f}% over the window"
                  f"{agree_str}")

    if analysis.global_indices:
        print("Global markets (descriptive backdrop, timezone-aligned, "
              "not part of flagging):")
        candidate_days = [i.day for i in analysis.incidents]
        for name, index in analysis.global_indices.items():
            if not index.available:
                print(f"   {name:<18} unavailable — {index.note}")
                continue
            agreement = global_markets_mod.same_direction_rate(
                index, analysis.daily, candidate_days)
            agree_str = (f", moved with {config.ticker} on {agreement['agree']}/"
                        f"{agreement['n']} candidate day(s)" if agreement["n"] else "")
            print(f"   {name:<18} {index.window_return * 100:+.2f}% over the window"
                  f"{agree_str}")

    fin = analysis.financials
    if fin:
        if fin.get("note"):
            print(f"Financials: {fin['note']}")
        else:
            print(f"Financials (latest reported quarter, {fin.get('as_of', '?')}, "
                  f"{fin.get('currency_unit', '')}, {fin['statement_kind']} — "
                  f"{fin['screener_url']}):")
            rev = fin.get("revenue")
            if rev:
                qoq = f"{rev['qoq_change'] * 100:+.1f}% QoQ" if rev["qoq_change"] is not None else ""
                yoy = f"{rev['yoy_change'] * 100:+.1f}% YoY" if rev["yoy_change"] is not None else ""
                print(f"   {rev['label']}: {rev['latest']:,.0f}"
                      + (f" ({', '.join(p for p in (qoq, yoy) if p)})" if qoq or yoy else ""))
            exp = fin.get("expenses")
            if exp:
                print(f"   Expenses: {exp['latest']:,.0f}")
            if fin.get("nopat") is not None:
                print(f"   NOPAT: {fin['nopat']:,.0f} ({fin['nopat_note']})")
            else:
                print(f"   NOPAT: not computed — {fin['nopat_note']}")
            ob = fin.get("order_book")
            if ob:
                print(f"   Order Book: {ob['latest']:,.0f}")
            else:
                print(f"   Order Book: {fin['order_book_note']}")
            ratios = fin.get("ratios") or {}
            if ratios:
                ratio_items = []
                for k in ("Stock P/E", "P/E", "ROCE", "ROE", "Debt to equity", "debt_to_equity", "Price to book value", "Dividend Yield"):
                    if ratios.get(k) is not None:
                        ratio_items.append(f"{k}: {ratios[k]}")
                if ratio_items:
                    print(f"   Key Ratios: {', '.join(ratio_items)}")

    dd = analysis.distance_to_default
    if dd:
        if dd.get("available"):
            print(f"Distance to Default (Merton Model, T={dd['horizon_years']}yr):")
            print(f"   DD: {dd['distance_to_default']:.2f} standard deviations")
            print(f"   Implied Default Probability: {dd['default_probability_pct']:.4f}%")
            print(f"   Market Cap: {dd['market_cap']:,.0f} {dd['currency_unit']}, Total Debt: {dd['total_debt']:,.0f} {dd['currency_unit']}")
            print(f"   Asset Volatility: {dd['asset_volatility'] * 100:.1f}%, Equity Volatility: {dd['equity_volatility'] * 100:.1f}%")
        elif dd.get("note"):
            print(f"Distance to Default: unavailable — {dd['note']}")

    v = analysis.var
    if v:
        if v.get("available"):
            print(f"Value at Risk (VaR) & Expected Shortfall ({v['observations']} trading days, daily vol {v['daily_volatility']*100:.2f}%):")
            table = v.get("table") or []
            print(f"   {'Method':<14} {'1d 95%':>8} {'1d 99%':>8} {'10d 95%':>9} {'10d 99%':>9}")
            for m in ("Historical", "Parametric", "Monte Carlo"):
                sub_t = { (r["horizon_days"], r["confidence"]): r["var_pct"] for r in table if r["method"] == m }
                v1_95 = f"{sub_t.get((1, 0.95), 0)*100:.2f}%" if sub_t.get((1, 0.95)) is not None else "—"
                v1_99 = f"{sub_t.get((1, 0.99), 0)*100:.2f}%" if sub_t.get((1, 0.99)) is not None else "—"
                v10_95 = f"{sub_t.get((10, 0.95), 0)*100:.2f}%" if sub_t.get((10, 0.95)) is not None else "—"
                v10_99 = f"{sub_t.get((10, 0.99), 0)*100:.2f}%" if sub_t.get((10, 0.99)) is not None else "—"
                print(f"   {m:<14} {v1_95:>8} {v1_99:>8} {v10_95:>9} {v10_99:>9}")
        elif v.get("note"):
            print(f"Value at Risk: unavailable — {v['note']}")

    # Institutional Scorecard (CEIA 5.0)
    from .financials import compute_altman_z_score_em, compute_beneish_m_score, compute_piotroski_f_score
    altman = compute_altman_z_score_em(analysis.financials or {})
    beneish = compute_beneish_m_score(analysis.financials or {})
    piotroski = compute_piotroski_f_score(analysis.financials or {})
    gov_risk = (analysis.financials or {}).get("governance_risk") or {}

    print(f"Institutional Scorecard (CEIA 5.0):")
    print(f"   Altman Z\"-Score: {altman['altman_z_score']} ({altman['solvency_zone']})")
    print(f"   Piotroski F-Score: {piotroski['piotroski_f_score']}/9 ({piotroski['fundamental_tier']})")
    print(f"   Beneish M-Score: {beneish['beneish_m_score']} ({beneish['accounting_integrity_regime']})")
    if gov_risk:
        print(f"   Governance Risk (GRI): {gov_risk.get('gri_score', 15)}/100 ({gov_risk.get('gri_tier', 'Low Risk')})")

    # Predictive Analytics & Forecasting Suite (CEIA 8.0)
    fc = analysis.forecasting
    if fc and fc.get("available"):
        print(f"\nPredictive Analytics & Multi-Horizon Forecasting (CEIA 8.0):")
        print(f"   Directional Bias: {fc.get('overall_directional_bias')} ({fc.get('confidence_tier')})")
        har = fc.get("har_volatility") or {}
        if har:
            print(f"   HAR-RV Volatility: 5D={har.get('forecast_volatility_5d', 0)*100:.1f}%, "
                  f"21D={har.get('forecast_volatility_21d', 0)*100:.1f}%, "
                  f"63D={har.get('forecast_volatility_63d', 0)*100:.1f}% "
                  f"(Regime: {har.get('volatility_regime')}, Leverage Asym: {har.get('leverage_asymmetry_ratio')}x)")
        ev_drift = fc.get("event_drift") or {}
        if ev_drift.get("has_recent_event"):
            print(f"   Event PEAD Drift : {ev_drift.get('drift_momentum_state')} "
                  f"(21D Drift: {ev_drift.get('projected_drift_21d_pct', 0):+.2f}%, Half-Life: {ev_drift.get('absorption_half_life_days')}d)")
        horizons = fc.get("horizons") or {}
        if horizons:
            print(f"   {'Horizon':<24} {'Exp Price':>10} {'Exp Ret%':>10} {'P10 Bear':>10} {'P90 Bull':>10} {'90% Conf Band':>22} {'P(Up)':>8}")
            for h_key in ("5", "21", "63"):
                h_data = horizons.get(h_key) or horizons.get(int(h_key))
                if not h_data:
                    continue
                label = h_data.get("label", f"{h_key}D")
                exp_p = f"₹{h_data.get('expected_price', 0):,.2f}"
                exp_r = f"{h_data.get('expected_return_pct', 0):+.2f}%"
                p10_p = f"₹{h_data.get('p10_bear_price', 0):,.2f}"
                p90_p = f"₹{h_data.get('p90_bull_price', 0):,.2f}"
                c_band = f"₹{h_data.get('conformal_lower_90_price', 0):,.0f} - ₹{h_data.get('conformal_upper_90_price', 0):,.0f}"
                p_up = f"{h_data.get('direction_probability_up', 0)*100:.1f}%"
                print(f"   {label:<24} {exp_p:>10} {exp_r:>10} {p10_p:>10} {p90_p:>10} {c_band:>22} {p_up:>8}")


    if analysis.daily.empty:
        print("\nNo trading days in the analysis window.")
        return

    print(f"\n{'-' * 74}\nDAILY TABLE (abnormal return = company return - expected)\n{'-' * 74}")
    print(f"{'date':<12}{'ret%':>8}{'bench%':>8}{'abn%':>8}{'z':>7}"
          f"{'news':>6}{'sent':>7}{'volZ':>7}  event")
    for day, row in analysis.daily.iterrows():
        vol_z = row.get("volume_z")
        vol_display = f"{vol_z:>7.2f}" if pd.notna(vol_z) else f"{'—':>7}"
        print(f"{str(day):<12}{row['return'] * 100:>8.2f}{row['benchmark_return'] * 100:>8.2f}"
              f"{row['abnormal_return'] * 100:>8.2f}{row['abnormal_return_z']:>7.2f}"
              f"{int(row['unique_count']):>6}{row['weighted_sentiment']:>7.2f}"
              f"{vol_display}  {row['dominant_event']}")

    print(f"\n{'-' * 74}\nCANDIDATE INCIDENT DAYS (ranked)\n{'-' * 74}")
    if not analysis.incidents:
        print("None flagged: no day had both unusual coverage and an unusual "
              "abnormal return at the configured thresholds.")
    for rank, incident in enumerate(analysis.incidents, 1):
        car = incident.car
        agree = "consistent with" if incident.direction_agrees else "OPPOSITE to"
        print(f"\n{rank}. {incident.day}  score={incident.score:.2f}")
        print(f"   abnormal return {incident.abnormal_return * 100:+.2f}% "
              f"(z={incident.abnormal_return_z:+.2f}); raw {incident.raw_return * 100:+.2f}%, "
              f"benchmark {incident.benchmark_return * 100:+.2f}%")
        if incident.volume_z and pd.notna(incident.volume):
            print(f"   volume: {incident.volume:,.0f} (z={incident.volume_z:+.2f}) "
                  "— a corroborating signal, not part of the flagging test")
        if analysis.secondary_daily is not None:
            sec_row = analysis.secondary_daily.loc[
                analysis.secondary_daily.index == incident.day]
            if not sec_row.empty:
                sec_ar = sec_row["secondary_abnormal_return"].iloc[0]
                sec_z = sec_row["secondary_abnormal_return_z"].iloc[0]
                if pd.notna(sec_ar):
                    print(f"   vs {analysis.secondary_meta['ticker']}: "
                          f"abnormal return {sec_ar * 100:+.2f}% (z={sec_z:+.2f})")
        print(f"   coverage: {incident.item_count} item(s) (z={incident.coverage_z:+.2f}), "
              f"tone {incident.mean_sentiment:+.2f} - {agree} the price move")
        if car and car.get("days"):
            t = car.get("t_stat")
            print(f"   CAR[{config.event_window[0]},+{config.event_window[1]}] "
                  f"{car['car'] * 100:+.2f}% over {car['days']} trading days "
                  f"({car['start']} to {car['end']})"
                  + (f", t={t:.2f}" if t is not None else ""))
            if car.get("p_value") is not None:
                print(f"   permutation p-value: {car['p_value']:.4f} "
                      f"(n={car['n']} placebo windows) - the fraction of "
                      "random same-length windows in this company's own "
                      "history with as extreme a CAR")
            elif car.get("p_value_note"):
                print(f"   permutation p-value: not computed - {car['p_value_note']}")
            if car.get("note"):
                print(f"   note: {car['note']}")
        day_key = incident.day.isoformat()
        for name, index in analysis.nifty_indices.items():
            stats = index.incident_stats.get(day_key)
            if not stats:
                continue
            print(f"   {name}: abnormal return {stats['abnormal_return'] * 100:+.2f}% "
                  f"(z={stats['abnormal_return_z']:+.2f}), "
                  f"CAR[{config.event_window[0]},+{config.event_window[1]}] "
                  f"{stats['car'] * 100:+.2f}%"
                  + (f", p={stats['p_value']:.3f}"
                     if stats.get("p_value") is not None else ""))
        robust = analysis.robustness.get("days", {}).get(incident.day.isoformat())
        if robust:
            print(f"   robustness: flagged in {robust['flagged_in']}/{robust['of']} "
                  f"threshold combinations tried")
        for h in incident.headlines:
            print(f"     - [{h['source']}] {h['headline'][:100]} "
                  f"({h['sentiment_label']}, rel={h['relevance']:.2f})")
            if h.get("url"):
                print(f"       {h['url']}")
            if h.get("summary"):
                print(f"       \"{h['summary'][:160]}\"")

    print(f"\n{'=' * 74}\nHOW TO READ THIS\n{'=' * 74}")
    for note in analysis.caveats:
        print(f"  * {note}")


def main() -> None:
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="Phase 2: event study")
    parser.add_argument("--company", required=True)
    parser.add_argument("--ticker", default=None,
                        help="e.g. ADANIENT.NS. Auto-detected from --company if omitted.")
    parser.add_argument("--exchange", default="NSE",
                        help="Preferred exchange for ticker auto-detection (NSE or BSE).")
    parser.add_argument("--benchmark", default="^NSEI")
    parser.add_argument("--benchmark2", default=None,
                        help="Optional second index/peer ticker (e.g. a sector "
                             "index or a direct competitor) for a side-by-side "
                             "abnormal-return comparison. The primary --benchmark "
                             "still drives incident detection; this is a second, "
                             "purely descriptive lens.")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--alias", action="append", default=[])
    parser.add_argument("--sources", nargs="*", default=ALL_RUNNABLE_SOURCES,
                        help="News sources to scrape (live scraping only, "
                             "ignored with --news). Defaults to every "
                             "runnable source in one command: the 5 "
                             "always-on sources plus business_standard and "
                             "livemint's best-effort Wayback Machine "
                             "fallback (see README Phase 8), which can "
                             "sometimes find nothing for a given window - "
                             "check source_status in the JSON output or the "
                             "console log for what each source actually "
                             "found. Pass an explicit, narrower list to opt "
                             "out of any of them.")
    parser.add_argument("--news", default=None,
                        help="Reuse a Phase 1 JSON run instead of re-scraping.")
    parser.add_argument("--event-window", nargs=2, type=int, default=[-1, 3],
                        metavar=("BEFORE", "AFTER"))
    parser.add_argument("--lead-in-days", type=int, default=200)
    parser.add_argument("--coverage-z", type=float, default=eventstudy.DEFAULT_COVERAGE_Z)
    parser.add_argument("--return-z", type=float, default=eventstudy.DEFAULT_RETURN_Z)
    parser.add_argument("--permutations", type=int, default=returns.DEFAULT_PERMUTATIONS,
                        help="Placebo windows drawn per incident for the CAR "
                             "permutation-test p-value (0 disables it).")
    parser.add_argument("--min-relevance", type=float, default=0.35)
    parser.add_argument("--limit", type=int, default=None,
                        help="Cap articles fetched (live scraping only), evenly "
                             "spread across the whole date range rather than "
                             "just its earliest days.")
    parser.add_argument("--workers", type=int, default=8,
                        help="Concurrent article fetches, live scraping only "
                             "(default 8). Requests to any single origin are "
                             "still serialised at the configured interval "
                             "regardless of --workers.")
    parser.add_argument("--skip-alias-widening", action="store_true",
                        help="Live scraping only. Don't try the company's "
                             "leading word as an extra alias (see "
                             "ceia.ingest.widen_aliases()). On by default; "
                             "costs one extra ticker-search request per run.")
    parser.add_argument("--skip-slug-prefilter", action="store_true",
                        help="Live scraping only. Never use the URL-slug "
                             "guess to narrow candidates before fetching, "
                             "regardless of a source's volume this run - "
                             "every candidate from every source goes "
                             "straight to full-text relevance scoring "
                             "instead. Catches a story whose slug never "
                             "names the company at all, at the cost of far "
                             "more fetches on a high-volume source.")
    parser.add_argument("--skip-macro-prices", action="store_true",
                        help="Don't fetch Brent crude, the G-Sec yield, or "
                             "the fiscal deficit for the macro-economic "
                             "backdrop section. Repo rate events (no network "
                             "needed) still show either way. Useful if Yahoo "
                             "is rate-limiting this connection - see the "
                             "README's note on shared/proxied egress.")
    parser.add_argument("--skip-nifty-indices", action="store_true",
                        help="Don't fetch Nifty 50/Bank/Auto/Energy/IT/Metal "
                             "or run their per-index event studies. Six more "
                             "lead-in price fetches and market-model fits "
                             "otherwise - useful if Yahoo is rate-limiting "
                             "this connection.")
    parser.add_argument("--skip-global-markets", action="store_true",
                        help="Don't fetch the S&P 500/Nasdaq/Dow/FTSE 100/"
                             "Hang Seng/Nikkei 225 backdrop (see README "
                             "Phase 12). Six more lead-in price fetches "
                             "otherwise - useful if Yahoo is rate-limiting "
                             "this connection.")
    parser.add_argument("--skip-financials", action="store_true",
                        help="Don't fetch revenue/expense/NOPAT/order-book "
                             "fundamentals from screener.in (see README "
                             "Phase 9).")
    parser.add_argument("--skip-risk-metrics", action="store_true",
                        help="Don't compute Distance to Default or Value at Risk (VaR).")
    parser.add_argument("--news-cache-dir", default="data/news_cache",
                        help="Where each company's cached news items are "
                             "stored (see README Phase 10). Ignored with "
                             "--news or --skip-news-cache.")
    parser.add_argument("--skip-news-cache", action="store_true",
                        help="Live scraping only. Always re-crawl the full "
                             "requested date range and don't read from or "
                             "write to the per-company news cache. Use this "
                             "if you suspect a source has since republished "
                             "or corrected an already-cached article.")
    parser.add_argument("--price-csv", default=None,
                        help="Directory of <SYMBOL>.csv files; forces the CSV provider.")
    parser.add_argument("--api-key", default=None,
                        help="Alpha Vantage API key. Overrides ALPHAVANTAGE_API_KEY; "
                             "avoids needing to set an environment variable at all, "
                             "which on Windows PowerShell means $env:NAME = 'value', "
                             "not the cmd.exe-style 'set NAME=value'.")
    parser.add_argument("--cache-dir", default="cache")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
    parser.add_argument("--out", default="json/analysis.json")
    parser.add_argument("--html", default="out/report.html",
                        help="Standalone HTML report path; --html '' to skip.")
    parser.add_argument("--pdf", default=None,
                        help="Also render the report to this PDF path. Needs "
                             'Playwright: pip install -e ".[pdf]" && '
                             "playwright install chromium.")
    parser.add_argument("--xlsx", default=None,
                        help="Also export analysis to a multi-tab Excel workbook (.xlsx).")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    ticker = args.ticker
    if not ticker:
        try:
            match = resolve_ticker(args.company, exchange=args.exchange)
        except TickerLookupError as exc:
            print(f"\nTicker lookup failed: {exc}")
            raise SystemExit(2)
        ticker = match.symbol
        print(f"Resolved ticker: {args.company!r} -> {ticker} ({match.name})"
              + ("" if match.exact_exchange_match
                 else f" -- not listed on {args.exchange}, using nearest match"))

    try:
        config = RunConfig(
            company=args.company, ticker=ticker, benchmark=args.benchmark,
            benchmark2=args.benchmark2,
            start=date.fromisoformat(args.start), end=date.fromisoformat(args.end),
            aliases=args.alias, sources=args.sources,
            event_window=tuple(args.event_window),
            min_relevance=args.min_relevance,
        )
    except ValueError as exc:
        print(f"\n{exc}")
        raise SystemExit(2)

    if args.news:
        items, news_meta = load_news_from_file(Path(args.news))
        log.info("loaded %d items from %s", len(items), args.news)
    else:
        fetcher = Fetcher(cache_dir=args.cache_dir, user_agent=args.user_agent)
        if args.skip_news_cache:
            ingested: IngestResult = run_ingest(config, fetcher=fetcher, limit=args.limit,
                                                max_workers=args.workers,
                                                skip_alias_widening=args.skip_alias_widening,
                                                skip_slug_prefilter=args.skip_slug_prefilter)
            items, news_meta = ingested.items, ingested.to_dict()
            news_meta.pop("items", None)
        else:
            items, news_meta = ingest_with_cache(
                config, fetcher, Path(args.news_cache_dir), limit=args.limit,
                max_workers=args.workers, skip_alias_widening=args.skip_alias_widening,
                skip_slug_prefilter=args.skip_slug_prefilter)

    providers = None
    if args.price_csv:
        from .prices import CsvProvider
        providers = [CsvProvider(args.price_csv)]
    elif args.api_key:
        # Same provider order as the default chain, with the key injected
        # directly rather than requiring ALPHAVANTAGE_API_KEY to be set.
        from .prices import AlphaVantageProvider, CsvProvider, YahooChartProvider, YFinanceProvider
        providers = [YFinanceProvider(), YahooChartProvider(),
                    AlphaVantageProvider(api_key=args.api_key), CsvProvider()]

    macro_provider = macro_mod.SkippedPriceProvider() if args.skip_macro_prices else None
    macro_fetcher = macro_mod.SkippedFetcher() if args.skip_macro_prices else None
    try:
        analysis = analyse(
            config, items, news_meta, lead_in_days=args.lead_in_days,
            coverage_threshold=args.coverage_z, return_threshold=args.return_z,
            providers=providers, permutations=args.permutations,
            macro_provider=macro_provider, macro_fetcher=macro_fetcher,
            skip_nifty_indices=args.skip_nifty_indices,
            skip_financials=args.skip_financials,
            skip_global_markets=args.skip_global_markets,
            skip_risk_metrics=args.skip_risk_metrics,
        )
    except PriceError as exc:
        print(f"\nPrice data unavailable: {exc}")
        print("\nThe news pipeline is unaffected. Options: set "
              "ALPHAVANTAGE_API_KEY, or supply CSVs with --price-csv "
              "(columns: date,close).")
        raise SystemExit(2)

    _print(analysis)
    raw_out = Path(args.out)
    if raw_out.parent == Path(".") or str(raw_out.parent) == "":
        out_path = Path("json") / raw_out.name
    elif raw_out.parent == Path("out") and raw_out.suffix == ".json" and args.out == "out/analysis.json":
        out_path = Path("json") / raw_out.name
    else:
        out_path = raw_out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(analysis.to_dict(), indent=2, default=str),
                        encoding="utf-8")
    print(f"\nwrote {out_path}")

    if args.html:
        from .report import write_report
        raw_html = Path(args.html)
        html_path = Path("out") / raw_html.name if (raw_html.parent == Path(".") or str(raw_html.parent) == "") else raw_html
        print(f"wrote {write_report(analysis, html_path)}")

    if args.pdf:
        from .pdf import render_analysis_pdf
        raw_pdf = Path(args.pdf)
        if raw_pdf.parent == Path(".") or str(raw_pdf.parent) == "":
            pdf_path = Path("out/PDF") / raw_pdf.name
        elif raw_pdf.parent == Path("out") and raw_pdf.suffix == ".pdf" and args.pdf == "out/report.pdf":
            pdf_path = Path("out/PDF") / raw_pdf.name
        else:
            pdf_path = raw_pdf
        try:
            print(f"wrote {render_analysis_pdf(analysis, pdf_path)}")
        except Exception as exc:
            log.warning("PDF export encountered: %s", exc, exc_info=True)
            print(f"\nPDF export skipped: {exc}")

    if args.xlsx:
        from .export_excel import export_analysis_to_excel
        raw_xlsx = Path(args.xlsx)
        xlsx_path = Path("Excel") / raw_xlsx.name if (raw_xlsx.parent == Path(".") or str(raw_xlsx.parent) == "") else raw_xlsx
        try:
            print(f"wrote {export_analysis_to_excel(analysis, xlsx_path)}")
        except Exception as exc:
            log.warning("Excel export encountered: %s", exc, exc_info=True)
            print(f"\nExcel export skipped: {exc}")


if __name__ == "__main__":
    main()
