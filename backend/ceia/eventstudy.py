"""Incident detection and ranking — PRD Section 8.

For each trading day, coverage is aggregated (volume, sentiment) and compared
against that day's abnormal return. A day is a candidate "incident" when
**both** are unusual: coverage that stands out against this company's own
baseline, *and* an abnormal return that stands out against the estimation
window's residual spread.

Requiring both is what keeps the output honest. Unusual coverage alone is just a
busy news day; an unusual return alone is a move with no visible explanation.
The tool claims only that the two coincided, which is why every label in the
output says "coincided with" and never "caused".

A note on what the ranking is *not*. The combined score orders candidates for a
reader's attention. It is not a p-value and not a test statistic. The t-values
reported alongside CAR come from a single company over a handful of events,
where the independence assumptions behind them do not hold — they are printed
because they are conventional, and immediately qualified for the same reason.
"""

from __future__ import annotations

import logging
import math
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import date

import numpy as np
import pandas as pd

from .dedupe import cluster_sizes
from .emotion import valence_of
from .models import NewsItem
from .returns import (
    DEFAULT_PERMUTATIONS,
    cumulative_abnormal_return,
    permutation_test_car,
    t_equivalent_threshold,
)

log = logging.getLogger(__name__)

# A day needs to clear both bars to be a candidate.
DEFAULT_COVERAGE_Z = 1.0
DEFAULT_RETURN_Z = 1.5
# Below this many observations, z-scores against the company's own baseline are
# too unstable to lean on, and the run says so instead of pretending otherwise.
MIN_DAYS_FOR_BASELINE = 10


@dataclass
class DailyCoverage:
    day: date
    item_count: int = 0
    unique_count: int = 0
    sources: list[str] = field(default_factory=list)
    mean_sentiment: float = 0.0
    weighted_sentiment: float = 0.0
    min_sentiment: float = 0.0
    max_sentiment: float = 0.0
    dominant_event: str = ""
    dominant_emotion: str = ""
    headlines: list[str] = field(default_factory=list)
    after_close_count: int = 0
    # Mean of unique items' staleness_score this day (see ceia/staleness.py),
    # None when no unique item that day had a computed score - never 0.0,
    # which would misleadingly read as "confirmed fresh" rather than
    # "not assessed."
    mean_staleness: float | None = None


@dataclass
class Incident:
    day: date
    abnormal_return: float
    abnormal_return_z: float
    raw_return: float
    benchmark_return: float
    coverage_z: float
    sentiment_z: float
    item_count: int
    mean_sentiment: float
    dominant_event: str
    dominant_emotion: str
    volume: float
    volume_z: float
    score: float
    direction_agrees: bool
    mean_staleness: float | None = None
    adi_score: float | None = None
    is_clustered: bool = False
    cluster_id: int | None = None
    bmp_stat: float | None = None
    trajectory_type: str = "Permanent Repricing"
    immediate_car: float | None = None
    drift_car: float | None = None
    decoupled_car: float | None = None
    is_overlapping: bool = False
    car: dict = field(default_factory=dict)
    # One dict per source article behind this flag: source, headline, url,
    # sentiment_label, relevance, and a real summary (the article's own
    # meta description/JSON-LD abstract where the source provides one,
    # else a plain-text excerpt of the body) - see attach_headlines().
    headlines: list[dict] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        record = asdict(self)
        record["day"] = self.day.isoformat()
        return record


def aggregate_by_day(items: list[NewsItem]) -> dict[date, DailyCoverage]:
    """Roll news up onto the trading day each item was attributed to.

    Duplicates are excluded from the sentiment average so one syndicated wire
    story carried by four outlets does not count four times — but the outlets
    that carried it are still recorded, since breadth of pickup is a real
    signal about how much attention a story got.
    """
    carriers = cluster_sizes(items)
    by_day: dict[date, DailyCoverage] = {}

    for item in items:
        if item.trading_day is None:
            continue  # Unattributed items are reported separately, never guessed.
        coverage = by_day.setdefault(item.trading_day, DailyCoverage(day=item.trading_day))
        coverage.item_count += 1
        if item.source not in coverage.sources:
            coverage.sources.append(item.source)
        if item.after_close:
            coverage.after_close_count += 1
        if item.duplicate_of is not None:
            continue
        coverage.unique_count += 1
        coverage.headlines.append(item.headline)

    for day, coverage in by_day.items():
        unique_items = [i for i in items
                        if i.trading_day == day and i.duplicate_of is None]
        if not unique_items:
            continue
        scores = [i.sentiment_score for i in unique_items]
        coverage.mean_sentiment = float(np.mean(scores))
        coverage.min_sentiment = float(np.min(scores))
        coverage.max_sentiment = float(np.max(scores))

        # Weight by relevance and by how many outlets carried the story: a
        # front-page story picked up everywhere should move the day's tone more
        # than a single passing item that scraped past the threshold.
        weights = [max(i.relevance_score, 0.01) * carriers.get(i.url, 1)
                   for i in unique_items]
        total = sum(weights) or 1.0
        coverage.weighted_sentiment = float(
            sum(s * w for s, w in zip(scores, weights)) / total)

        # Counter.most_common() rather than max(set(x), key=x.count): the
        # latter breaks a tied count via set iteration order, which for str
        # keys depends on Python's per-process hash randomisation (verified
        # directly - the same tied input returned different "dominant"
        # labels across nine different PYTHONHASHSEED values). That would
        # have meant a day with two items each carrying a different label
        # could report a different "dominant" event or emotion on every run
        # of identical data, undermining the reproducibility the rest of the
        # pipeline works hard for. Counter.most_common() is documented to
        # break ties by first-encountered order, which is deterministic
        # given the (already deterministic) order items were collected in.
        categories = [i.event_category for i in unique_items if i.event_category]
        if categories:
            coverage.dominant_event = Counter(categories).most_common(1)[0][0]

        # Same mode approach as dominant_event, but only over items where an
        # emotion actually cleared the confidence threshold - a day where
        # GoEmotions stayed silent on every headline should not be forced
        # into an arbitrary label.
        emotions = [i.emotion_label for i in unique_items if i.emotion_label]
        if emotions:
            coverage.dominant_emotion = Counter(emotions).most_common(1)[0][0]

        staleness_scores = [i.staleness_score for i in unique_items
                            if i.staleness_score is not None]
        if staleness_scores:
            coverage.mean_staleness = float(np.mean(staleness_scores))
    return by_day


def _z(value: float, mean: float, sd: float) -> float:
    if not sd or not math.isfinite(sd):
        return 0.0
    return (value - mean) / sd


def build_daily_table(
    frame: pd.DataFrame,
    coverage: dict[date, DailyCoverage],
    start: date,
    end: date,
) -> pd.DataFrame:
    """One row per trading day in the analysis window, prices joined to news."""
    window = frame.loc[pd.Timestamp(start):pd.Timestamp(end)].copy()
    rows = []
    for timestamp, row in window.iterrows():
        day = timestamp.date()
        day_coverage = coverage.get(day)
        rows.append({
            "date": day,
            "close": row["close"],
            "volume": row.get("volume", float("nan")),
            "return": row["return"],
            "benchmark_return": row["benchmark_return"],
            "expected_return": row.get("expected_return", float("nan")),
            "abnormal_return": row["abnormal_return"],
            "abnormal_return_z": row.get("abnormal_return_z", float("nan")),
            "item_count": day_coverage.item_count if day_coverage else 0,
            "unique_count": day_coverage.unique_count if day_coverage else 0,
            "mean_sentiment": day_coverage.mean_sentiment if day_coverage else 0.0,
            "weighted_sentiment": day_coverage.weighted_sentiment if day_coverage else 0.0,
            "dominant_event": day_coverage.dominant_event if day_coverage else "",
            "dominant_emotion": day_coverage.dominant_emotion if day_coverage else "",
            "sources": ",".join(day_coverage.sources) if day_coverage else "",
            "mean_staleness": day_coverage.mean_staleness if day_coverage else None,
        })
    if not rows:
        # A window with no trading days at all (a bad date range, or a holiday
        # stretch). Return an empty frame with the right columns so callers can
        # treat it uniformly instead of special-casing a KeyError.
        empty = pd.DataFrame(columns=[
            "close", "volume", "return", "benchmark_return", "expected_return",
            "abnormal_return", "abnormal_return_z", "item_count", "unique_count",
            "mean_sentiment", "weighted_sentiment", "dominant_event",
            "dominant_emotion", "sources", "coverage_z", "sentiment_z", "volume_z",
            "mean_staleness",
        ])
        empty.index.name = "date"
        return empty

    table = pd.DataFrame(rows).set_index("date")

    # Baselines are the company's own coverage over the analysis window.
    counts = table["unique_count"].astype(float)
    table["coverage_z"] = [
        _z(v, counts.mean(), counts.std(ddof=1)) for v in counts
    ]
    sentiments = table.loc[table["unique_count"] > 0, "weighted_sentiment"]
    s_mean = float(sentiments.mean()) if len(sentiments) else 0.0
    s_sd = float(sentiments.std(ddof=1)) if len(sentiments) > 1 else 0.0
    table["sentiment_z"] = [
        _z(v, s_mean, s_sd) if c > 0 else 0.0
        for v, c in zip(table["weighted_sentiment"], table["unique_count"])
    ]
    # Window-relative, same style as coverage_z - not a claim about "normal"
    # volume from before the window, just "unusual for this company in this
    # run". NaN throughout (no volume from this provider, e.g. a bare CSV) is
    # not an error; every _z() call on it correctly comes back 0.0.
    volumes = table["volume"].astype(float)
    v_mean = float(volumes.mean()) if volumes.notna().any() else 0.0
    v_sd = float(volumes.std(ddof=1)) if volumes.notna().sum() > 1 else 0.0
    table["volume_z"] = [
        _z(v, v_mean, v_sd) if pd.notna(v) else 0.0 for v in volumes
    ]
    # Price-Volume Abnormal Disruption Index (PV-ADI): Euclidean combination of AR and Volume shocks
    table["adi_score"] = [
        round(float(np.sqrt(ar_z**2 + vol_z**2)), 3) if pd.notna(ar_z) else 0.0
        for ar_z, vol_z in zip(table["abnormal_return_z"], table["volume_z"])
    ]
    return table


def rank_incidents(
    table: pd.DataFrame,
    frame: pd.DataFrame,
    event_window: tuple[int, int] = (-1, 3),
    coverage_threshold: float = DEFAULT_COVERAGE_Z,
    return_threshold: float = DEFAULT_RETURN_Z,
    top_n: int | None = None,
    permutations: int = DEFAULT_PERMUTATIONS,
    deoverlap_gap_days: int = 4,
) -> list[Incident]:
    """Flag and rank candidate incident days."""
    incidents: list[Incident] = []
    if table.empty:
        return incidents

    # The coverage baseline is the company's own coverage across the analysis
    # window. In a window short enough to be built *around* a known event, that
    # baseline is incoherent - every day is an event day, so no day looks
    # unusual relative to its neighbours and nothing would ever flag. Below the
    # threshold, "has any coverage at all" replaces the z-test, and the run's
    # caveats say the coverage bar was relaxed.
    days_with_news = int((table["unique_count"] > 0).sum())
    thin_baseline = days_with_news < MIN_DAYS_FOR_BASELINE

    effective_return_threshold = t_equivalent_threshold(
        return_threshold, frame.attrs.get("ar_scale_df", 0))

    def _is_candidate(row) -> bool:
        if row["unique_count"] == 0:
            return False
        if thin_baseline:
            coverage_unusual = True
        else:
            coverage_unusual = (row["coverage_z"] >= coverage_threshold
                                or abs(row["sentiment_z"]) >= coverage_threshold)
        return_unusual = abs(row["abnormal_return_z"]) >= effective_return_threshold
        return coverage_unusual and return_unusual

    candidate_days = {day for day, row in table.iterrows() if _is_candidate(row)}

    # Cluster detection: group candidate days within deoverlap_gap_days
    sorted_candidate_days = sorted(candidate_days)
    clusters: dict[date, int] = {}
    current_cluster_id = 1
    for idx, d in enumerate(sorted_candidate_days):
        if idx > 0:
            gap = (d - sorted_candidate_days[idx - 1]).days
            if gap > deoverlap_gap_days:
                current_cluster_id += 1
        clusters[d] = current_cluster_id

    for day, row in table.iterrows():
        if day not in candidate_days:
            continue

        sentiment = row["weighted_sentiment"]
        abnormal = row["abnormal_return"]
        agrees = bool(sentiment * abnormal > 0) if sentiment and abnormal else False

        score = (abs(row["abnormal_return_z"])
                 * (1 + max(row["coverage_z"], 0))
                 * (1 + abs(sentiment)))
        if agrees:
            score *= 1.25  # Direction agreement makes a candidate more legible.

        car = cumulative_abnormal_return(frame, day, event_window)
        car.update(permutation_test_car(
            frame, day, event_window, exclude_days=candidate_days,
            n_permutations=permutations,
        ))

        cluster_num = clusters.get(day)
        is_clustered = sum(1 for c in clusters.values() if c == cluster_num) > 1

        # Trajectory decomposition: Immediate [-1, +1] vs Drift [+2, +5]
        imm_res = cumulative_abnormal_return(frame, day, (-1, 1))
        imm_car = imm_res.get("car")
        drift_res = cumulative_abnormal_return(frame, day, (2, 5))
        drift_car = drift_res.get("car")

        trajectory_type = "Permanent Repricing"
        if imm_car is not None and drift_car is not None:
            if abs(imm_car) >= 0.02 and (imm_car * drift_car < -0.01 * abs(imm_car)):
                trajectory_type = "Overreaction Reversal"
            elif abs(imm_car) >= 0.02 and (imm_car * drift_car > 0.005 * abs(imm_car)):
                trajectory_type = "Permanent Repricing (Momentum Drift)"
            elif abs(imm_car) < 0.015 and abs(drift_car) >= 0.025:
                trajectory_type = "Post-Announcement Drift (PEAD)"

        incidents.append(Incident(
            day=day,
            abnormal_return=float(abnormal),
            abnormal_return_z=float(row["abnormal_return_z"]),
            raw_return=float(row["return"]),
            benchmark_return=float(row["benchmark_return"]),
            coverage_z=float(row["coverage_z"]),
            sentiment_z=float(row["sentiment_z"]),
            item_count=int(row["unique_count"]),
            mean_sentiment=float(sentiment),
            dominant_event=str(row["dominant_event"]),
            dominant_emotion=str(row["dominant_emotion"]),
            volume=float(row["volume"]) if pd.notna(row["volume"]) else float("nan"),
            volume_z=float(row["volume_z"]),
            score=float(score),
            direction_agrees=agrees,
            mean_staleness=(float(row["mean_staleness"])
                           if pd.notna(row["mean_staleness"]) else None),
            adi_score=float(row["adi_score"]) if "adi_score" in row and pd.notna(row["adi_score"]) else None,
            is_clustered=is_clustered,
            cluster_id=cluster_num if is_clustered else None,
            trajectory_type=trajectory_type,
            immediate_car=round(float(imm_car), 4) if imm_car is not None else None,
            drift_car=round(float(drift_car), 4) if drift_car is not None else None,
            car=car,
            sources=str(row["sources"]).split(",") if row["sources"] else [],
        ))

    incidents = decouple_overlapping_event_windows(incidents, frame, event_window)
    incidents.sort(key=lambda i: -i.score)
    return incidents[:top_n] if top_n else incidents


def decouple_overlapping_event_windows(
    incidents: list[Incident],
    frame: pd.DataFrame,
    event_window: tuple[int, int] = (-1, 1),
) -> list[Incident]:
    """Decouple overlapping event windows across closely-spaced candidate incident days
    to avoid double-counting abnormal returns.
    """
    if not incidents or "abnormal_return" not in frame.columns:
        return incidents

    if len(incidents) == 1:
        inc = incidents[0]
        if inc.car and "car" in inc.car:
            inc.decoupled_car = inc.car["car"]
        return incidents

    sorted_incs = sorted(incidents, key=lambda i: i.day)
    dt_index = frame.index

    # Locate integer positions
    positions: list[int | None] = []
    for inc in sorted_incs:
        ts = pd.Timestamp(inc.day)
        if ts in dt_index:
            positions.append(int(dt_index.get_loc(ts)))
        else:
            positions.append(None)

    w_start, w_end = event_window
    N_days = len(frame)

    for i in range(len(sorted_incs)):
        curr_pos = positions[i]
        if curr_pos is None:
            continue

        # Default window bounds
        s_idx = max(0, curr_pos + w_start)
        e_idx = min(N_days - 1, curr_pos + w_end)

        has_left_overlap = False
        has_right_overlap = False

        # Check left neighbour
        if i > 0 and positions[i - 1] is not None:
            prev_pos = positions[i - 1]
            prev_e_idx = min(N_days - 1, prev_pos + w_end)
            if prev_e_idx >= s_idx:
                has_left_overlap = True
                mid = (prev_pos + curr_pos) // 2
                s_idx = max(s_idx, mid + 1)

        # Check right neighbour
        if i < len(sorted_incs) - 1 and positions[i + 1] is not None:
            next_pos = positions[i + 1]
            next_s_idx = max(0, next_pos + w_start)
            if next_s_idx <= e_idx:
                has_right_overlap = True
                mid = (curr_pos + next_pos) // 2
                e_idx = min(e_idx, mid)

        sorted_incs[i].is_overlapping = bool(has_left_overlap or has_right_overlap)
        if s_idx <= e_idx:
            sub_ars = frame["abnormal_return"].iloc[s_idx : e_idx + 1].dropna()
            sorted_incs[i].decoupled_car = round(float(sub_ars.sum()), 4)
        else:
            sorted_incs[i].decoupled_car = 0.0

    return sorted_incs


def detect_cusum_event_window(
    abnormal_returns: pd.Series,
    event_idx: int,
    max_lead: int = 5,
    max_lag: int = 10,
    k_allowance: float = 0.5,
    h_threshold: float = 2.0,
) -> dict[str, Any]:
    """Dynamically estimate empirical event shock duration [t_start, t_end] using CUSUM control charts.

    Detects both:
    1. Pre-event information leakage / run-up (backward CUSUM from t=0 to t=-max_lead).
    2. Post-event drift / absorption completion (forward CUSUM from t=0 to t=+max_lag).
    """
    N = len(abnormal_returns)
    if N == 0 or event_idx < 0 or event_idx >= N:
        return {"empirical_start": -1, "empirical_end": 1, "duration_days": 3, "leakage_detected": False, "drift_days": 1}

    sd = float(abnormal_returns.std(ddof=1)) or 0.015
    z_series = (abnormal_returns / sd).to_numpy()

    # 1. Backward CUSUM for Pre-Event Information Leakage
    empirical_start = 0
    leakage_detected = False
    s_pos, s_neg = 0.0, 0.0
    for offset in range(1, min(max_lead + 1, event_idx + 1)):
        idx = event_idx - offset
        z = z_series[idx]
        s_pos = max(0.0, s_pos + z - k_allowance)
        s_neg = max(0.0, s_neg - z - k_allowance)
        if s_pos >= h_threshold or s_neg >= h_threshold:
            empirical_start = -offset
            leakage_detected = True

    # 2. Forward CUSUM for Post-Event Drift Absorption
    empirical_end = 0
    s_pos, s_neg = 0.0, 0.0
    for offset in range(1, min(max_lag + 1, N - event_idx)):
        idx = event_idx + offset
        z = z_series[idx]
        s_pos = max(0.0, s_pos + z - k_allowance)
        s_neg = max(0.0, s_neg - z - k_allowance)
        if s_pos >= h_threshold or s_neg >= h_threshold:
            empirical_end = offset

    empirical_start = min(empirical_start, -1)
    empirical_end = max(empirical_end, 1)

    return {
        "empirical_start": int(empirical_start),
        "empirical_end": int(empirical_end),
        "duration_days": int(empirical_end - empirical_start + 1),
        "leakage_detected": leakage_detected,
        "drift_days": int(empirical_end),
    }


def compute_adaptive_clustering_gap(
    alpha: float = 0.08,
    beta: float = 0.88,
    default_gap: int = 4,
    min_gap: int = 2,
    max_gap: int = 10,
) -> int:
    """Compute volatility-adaptive event clustering calendar gap based on GARCH(1,1) shock persistence half-life.

    tau_{1/2} = ln(0.5) / ln(alpha + beta)
    """
    persistence = alpha + beta
    if persistence >= 0.999 or persistence <= 0.0:
        return default_gap

    half_life = np.log(0.5) / np.log(persistence)
    if not np.isfinite(half_life) or half_life <= 0:
        return default_gap

    # Scale half-life to calendar clustering gap
    gap = int(np.round(half_life / 2.0))
    return int(min(max(gap, min_gap), max_gap))


def compute_category_response_profile(
    incidents: list[Incident],
) -> dict[str, dict[str, Any]]:
    """Compute empirical abnormal return response profile aggregated by event category.

    Categories: earnings, regulatory, leadership, mna, capital, product, macro, litigation, other.
    """
    if not incidents:
        return {}

    by_cat: dict[str, list[Incident]] = {}
    for inc in incidents:
        cat = inc.dominant_event or "other"
        by_cat.setdefault(cat, []).append(inc)

    profile: dict[str, dict[str, Any]] = {}
    for cat, inc_list in by_cat.items():
        ars = [i.abnormal_return for i in inc_list]
        abs_ars = [abs(i.abnormal_return) for i in inc_list]
        cars = [(i.car or {}).get("car", i.abnormal_return) for i in inc_list]
        pos_count = sum(1 for a in ars if a > 0)
        trajs = [getattr(i, "trajectory_type", "Permanent Repricing") for i in inc_list]
        dominant_traj = Counter(trajs).most_common(1)[0][0] if trajs else "Permanent Repricing"

        profile[cat] = {
            "event_count": len(inc_list),
            "mean_abnormal_return_pct": round(float(np.mean(ars)) * 100, 2),
            "median_abnormal_return_pct": round(float(np.median(ars)) * 100, 2),
            "mean_car_pct": round(float(np.mean(cars)) * 100, 2),
            "mean_magnitude_pct": round(float(np.mean(abs_ars)) * 100, 2),
            "hit_rate_pct": round(pos_count / len(inc_list) * 100, 1),
            "dominant_trajectory": dominant_traj,
        }

    return profile


def compute_information_arrival_velocity(
    coverage_series: pd.Series,
    baseline_window: int = 3,
) -> pd.Series:
    """Compute Information Arrival Velocity (IAV) tracking the acceleration of news coverage.

    IAV_t = (Coverage_t - SMA_{t-1, baseline}) / max(1, SMA_{t-1, baseline})

    An IAV >= 2.0 indicates a breaking news cascade (200%+ surge over recent baseline).
    """
    clean_cov = coverage_series.fillna(0.0)
    sma = clean_cov.rolling(baseline_window, min_periods=1).mean().shift(1).fillna(clean_cov.iloc[0] if len(clean_cov) > 0 else 1.0)
    denom = sma.clip(lower=1.0)
    iav = (clean_cov - sma) / denom
    return pd.Series(np.round(iav.to_numpy(), 2), index=coverage_series.index)


def decompose_open_close_abnormal_returns(
    open_prices: pd.Series,
    close_prices: pd.Series,
    prior_close: pd.Series,
    benchmark_returns: pd.Series,
    beta: float = 1.0,
) -> pd.DataFrame:
    """Decompose total daily abnormal return into overnight pre-market gap vs intraday trading drift.

    R_{overnight} = (Open - PriorClose) / PriorClose
    R_{intraday} = (Close - Open) / Open
    AR_{overnight} = R_{overnight} - beta * (Benchmark * 0.4)
    AR_{intraday} = R_{intraday} - beta * (Benchmark * 0.6)
    """
    df = pd.DataFrame(index=close_prices.index)
    df["open"] = open_prices
    df["close"] = close_prices
    df["prior_close"] = prior_close

    df["overnight_return"] = (df["open"] - df["prior_close"]) / df["prior_close"]
    df["intraday_return"] = (df["close"] - df["open"]) / df["open"]
    df["total_return"] = (df["close"] - df["prior_close"]) / df["prior_close"]

    bench = benchmark_returns.reindex(df.index).fillna(0.0)
    df["expected_overnight"] = beta * bench * 0.4
    df["expected_intraday"] = beta * bench * 0.6

    df["ar_overnight"] = df["overnight_return"] - df["expected_overnight"]
    df["ar_intraday"] = df["intraday_return"] - df["expected_intraday"]
    df["ar_total"] = df["ar_overnight"] + df["ar_intraday"]

    def _dominant_channel(row):
        abs_on = abs(row["ar_overnight"]) if np.isfinite(row["ar_overnight"]) else 0.0
        abs_intra = abs(row["ar_intraday"]) if np.isfinite(row["ar_intraday"]) else 0.0
        if abs_on > 1.5 * abs_intra:
            return "Pre-Market Auction (Overnight Gap)"
        elif abs_intra > 1.5 * abs_on:
            return "Intraday Trading Drift"
        else:
            return "Balanced Discovery"

    df["dominant_channel"] = df.apply(_dominant_channel, axis=1)
    return df.round(5)


def compute_car_term_structure(
    abnormal_returns: pd.Series,
    event_idx: int,
    horizons: tuple[int, ...] = (1, 3, 5, 10),
) -> dict[str, Any]:
    """Compute multi-horizon Cumulative Abnormal Return term structure and calculate Day-1 information absorption ratio.

    Absorption Ratio = CAR[0, 1] / CAR[0, 10]
    """
    clean_ar = abnormal_returns.dropna()
    N = len(clean_ar)
    if N == 0 or event_idx < 0 or event_idx >= N:
        return {
            "car_term_cone_pct": {},
            "absorption_speed_ratio": 1.0,
            "absorption_regime": "Unassessed",
        }

    car_cone: dict[int, float] = {}
    for h in horizons:
        end_pos = min(N, event_idx + h + 1)
        sub = clean_ar.iloc[event_idx:end_pos]
        car_cone[h] = round(float(sub.sum()) * 100.0, 2)

    car_1d = car_cone.get(1, 0.0)
    car_10d = car_cone.get(10, car_1d)

    if abs(car_10d) > 0.01:
        ratio = min(max(car_1d / car_10d, -3.0), 3.0)
    else:
        ratio = 1.0

    if ratio >= 0.75:
        regime = "Immediate Absorption (>75% Day 1)"
    elif ratio >= 0.40:
        regime = "Gradual Drift Absorption"
    else:
        regime = "Delayed Under-Reaction / Prolonged Drift"

    return {
        "car_term_cone_pct": car_cone,
        "absorption_speed_ratio": round(ratio, 2),
        "absorption_regime": regime,
    }


def compute_multievent_car_attribution_waterfall(
    daily_df: pd.DataFrame,
    incidents: list[Incident],
) -> dict[str, Any]:
    """Partition cumulative full-period excess return into specific event category CAR contributions vs unexplained drift.

    Attribution:
    - total_excess_return_pct: Total cumulative abnormal return sum(AR_t)
    - category_attributions_pct: {category: sum(CAR_decoupled)}
    - total_event_explained_pct: sum(category_attributions)
    - unexplained_drift_pct: total_excess_return_pct - total_event_explained_pct
    - event_explained_share_pct: total_event_explained / total_excess_return
    """
    clean_daily = daily_df.copy()
    if clean_daily.empty:
        return {
            "total_excess_return_pct": 0.0,
            "category_attributions_pct": {},
            "total_event_explained_pct": 0.0,
            "unexplained_drift_pct": 0.0,
            "event_explained_share_pct": 0.0,
        }

    total_ar = float(clean_daily["abnormal_return"].sum()) * 100.0 if "abnormal_return" in clean_daily.columns else 0.0

    by_cat: dict[str, float] = {}
    for inc in incidents:
        cat = inc.dominant_event or "other"
        car_val = inc.decoupled_car
        if car_val is None:
            car_val = (inc.car or {}).get("car", inc.abnormal_return)
        by_cat[cat] = by_cat.get(cat, 0.0) + (float(car_val) * 100.0)

    cat_rounded = {k: round(v, 2) for k, v in by_cat.items()}
    total_explained = round(sum(cat_rounded.values()), 2)
    unexplained = round(total_ar - total_explained, 2)

    share = round((total_explained / total_ar) * 100.0, 1) if abs(total_ar) > 0.1 else 100.0

    return {
        "total_excess_return_pct": round(total_ar, 2),
        "category_attributions_pct": cat_rounded,
        "total_event_explained_pct": total_explained,
        "unexplained_drift_pct": unexplained,
        "event_explained_share_pct": share,
    }


def compute_variance_ratio(
    returns: pd.Series,
    k_periods: tuple[int, ...] = (2, 4, 8, 16),
) -> dict[str, Any]:
    """Compute Lo-MacKinlay multi-period variance ratio to differentiate mean-reversion from persistent drift.

    VR(k) = Var(R^(k)) / (k * Var(R^(1)))
    - VR(k) < 0.85: Mean-Reverting / Temporary Transitory Shock
    - 0.85 <= VR(k) <= 1.15: Efficient Random Walk / Structural Repricing
    - VR(k) > 1.15: Trending Momentum / Multi-Day Information Drift
    """
    clean_r = returns.dropna()
    N = len(clean_r)
    if N < 20:
        return {
            "variance_ratios": {},
            "discovery_regime": "Unassessed (<20 obs)",
        }

    var_1 = float(np.var(clean_r, ddof=1))
    if var_1 <= 1e-12:
        return {
            "variance_ratios": {},
            "discovery_regime": "Zero Variance",
        }

    vr_dict: dict[int, float] = {}
    for k in k_periods:
        if k >= N // 2:
            continue
        rolling_k = clean_r.rolling(k).sum().dropna()
        if len(rolling_k) > 5:
            var_k = float(np.var(rolling_k, ddof=1))
            vr_val = var_k / (k * var_1)
            vr_dict[k] = round(float(vr_val), 3)

    vr_4 = vr_dict.get(4, vr_dict.get(2, 1.0))
    if vr_4 < 0.85:
        regime = "Mean-Reverting / Temporary Shock Over-reaction"
    elif vr_4 > 1.15:
        regime = "Trending Momentum / Multi-Day Information Drift"
    else:
        regime = "Efficient Random Walk / Permanent Structural Repricing"

    return {
        "variance_ratios": vr_dict,
        "discovery_regime": regime,
    }


def compute_directional_volatility_spillover(
    stock_returns: pd.Series,
    sector_returns: pd.Series,
    window: int = 15,
) -> dict[str, Any]:
    """Compute directional volatility spillover between target company and sector index.

    Measures whether corporate event volatility transmits outward to sector peers or absorbs market-wide stress.
    """
    clean_s = stock_returns.dropna()
    clean_m = sector_returns.dropna()
    common_idx = clean_s.index.intersection(clean_m.index)

    if len(common_idx) < window + 5:
        return {
            "volatility_correlation": 0.0,
            "directional_transmission_to_sector": 0.0,
            "directional_absorption_from_sector": 0.0,
            "net_volatility_spillover": 0.0,
            "spillover_role": "Unassessed (<20 obs)",
        }

    s_series = clean_s.reindex(common_idx)
    m_series = clean_m.reindex(common_idx)

    vol_s = s_series.rolling(window, min_periods=5).std().dropna() * np.sqrt(252.0)
    vol_m = m_series.rolling(window, min_periods=5).std().dropna() * np.sqrt(252.0)

    vol_common = vol_s.index.intersection(vol_m.index)
    if len(vol_common) < 5:
        return {
            "volatility_correlation": 0.0,
            "directional_transmission_to_sector": 0.0,
            "directional_absorption_from_sector": 0.0,
            "net_volatility_spillover": 0.0,
            "spillover_role": "Unassessed",
        }

    d_vol_s = vol_s.reindex(vol_common).diff().dropna()
    d_vol_m = vol_m.reindex(vol_common).diff().dropna()

    valid_diff = d_vol_s.index.intersection(d_vol_m.index)
    if len(valid_diff) < 5:
        return {
            "volatility_correlation": 0.0,
            "directional_transmission_to_sector": 0.0,
            "directional_absorption_from_sector": 0.0,
            "net_volatility_spillover": 0.0,
            "spillover_role": "Unassessed",
        }

    var_s = float(np.var(d_vol_s.reindex(valid_diff), ddof=1))
    var_m = float(np.var(d_vol_m.reindex(valid_diff), ddof=1))
    cov_sm = float(np.cov(d_vol_s.reindex(valid_diff), d_vol_m.reindex(valid_diff))[0, 1])

    to_sector = cov_sm / var_s if var_s > 1e-8 else 0.0
    from_sector = cov_sm / var_m if var_m > 1e-8 else 0.0
    net_spillover = to_sector - from_sector
    corr_vol = cov_sm / (np.sqrt(var_s * var_m)) if (var_s > 1e-8 and var_m > 1e-8) else 0.0

    if net_spillover > 0.20:
        role = "Net Volatility Transmitter / Systemic Shock Origin"
    elif net_spillover < -0.20:
        role = "Net Volatility Receiver / Sector Shock Absorber"
    else:
        role = "Balanced Interconnectedness"

    return {
        "volatility_correlation": round(corr_vol, 3),
        "directional_transmission_to_sector": round(to_sector, 3),
        "directional_absorption_from_sector": round(from_sector, 3),
        "net_volatility_spillover": round(net_spillover, 3),
        "spillover_role": role,
    }


def compute_asymptotic_car_absorption_halflife(
    abnormal_returns: pd.Series,
    event_idx: int,
    post_window: int = 10,
) -> dict[str, Any]:
    """Fit an asymptotic response model CAR(t) = CAR_inf * (1 - exp(-kappa * t)) to compute empirical price absorption half-life.

    Half-life: t_{1/2}^{price} = ln(2) / kappa
    """
    clean_ar = abnormal_returns.dropna()
    N = len(clean_ar)
    if N == 0 or event_idx < 0 or event_idx >= N:
        return {
            "total_absorbed_car_pct": 0.0,
            "absorption_rate_kappa": 0.693,
            "price_absorption_halflife_days": 1.0,
            "pricing_efficiency_regime": "Unassessed",
        }

    end_idx = min(N, event_idx + post_window + 1)
    post_ar = clean_ar.iloc[event_idx:end_idx].values
    if len(post_ar) < 2:
        return {
            "total_absorbed_car_pct": round(float(post_ar.sum()) * 100.0, 2) if len(post_ar) > 0 else 0.0,
            "absorption_rate_kappa": 0.693,
            "price_absorption_halflife_days": 1.0,
            "pricing_efficiency_regime": "Instant Discovery (<=1d)",
        }

    cum_car = np.cumsum(post_ar)
    car_inf = cum_car[-1]
    t_days = np.arange(len(cum_car), dtype=float)

    if abs(car_inf) < 1e-4:
        return {
            "total_absorbed_car_pct": 0.0,
            "absorption_rate_kappa": 0.693,
            "price_absorption_halflife_days": 1.0,
            "pricing_efficiency_regime": "Negligible Price Impact",
        }

    frac_absorbed = np.clip(cum_car / car_inf, 0.0, 0.999)
    y_vals = np.log(1.0 - frac_absorbed + 1e-6)

    valid_t = t_days[1:]
    valid_y = y_vals[1:]
    if len(valid_t) > 0 and np.sum(valid_t**2) > 0:
        kappa = -float(np.sum(valid_t * valid_y) / np.sum(valid_t**2))
        kappa = max(0.05, min(kappa, 2.5))
    else:
        kappa = 0.693

    half_life = float(np.log(2) / kappa)
    half_life_clamped = min(max(half_life, 0.2), float(post_window))

    if half_life_clamped <= 1.2:
        regime = "High Pricing Efficiency (T_half <= 1.2d)"
    elif half_life_clamped <= 3.5:
        regime = "Moderate Post-Earnings Drift (1.2d - 3.5d)"
    else:
        regime = "Severe Information Inefficiency / Under-Reaction (>3.5d)"

    return {
        "total_absorbed_car_pct": round(float(car_inf) * 100.0, 2),
        "absorption_rate_kappa": round(kappa, 3),
        "price_absorption_halflife_days": round(half_life_clamped, 2),
        "pricing_efficiency_regime": regime,
    }


def compute_bmp_standardized_test(
    abnormal_returns: pd.Series,
    event_idx: int,
    estimation_residual_sd: float = 0.015,
) -> dict[str, Any]:
    """Compute Boehmer, Musumeci and Poulsen (1991) BMP standardized test robust to event-induced volatility clustering.

    Z_BMP = SAR_event / sqrt(Var(SAR))
    """
    clean_ar = abnormal_returns.dropna()
    N = len(clean_ar)
    if N == 0 or event_idx < 0 or event_idx >= N:
        return {
            "sar_score": 0.0,
            "bmp_z_stat": 0.0,
            "bmp_p_value": 1.0,
            "significance_regime": "Unassessed",
        }

    scale = max(1e-4, float(estimation_residual_sd))
    # Standardized abnormal returns
    sar_series = clean_ar / scale
    sar_event = float(sar_series.iloc[event_idx])

    std_sar = float(sar_series.std(ddof=1)) if len(sar_series) > 2 else 1.0
    std_sar = max(0.1, std_sar)

    bmp_z = sar_event / std_sar
    from scipy.stats import norm
    p_val = float(2 * (1.0 - norm.cdf(abs(bmp_z))))

    regime = (
        "Statistically Significant Event Shock (p < 0.01)" if p_val < 0.01
        else "Moderate Statistical Significance (p < 0.05)" if p_val < 0.05
        else "Statistically Insignificant (Consistent with Normal Dispersion)"
    )

    return {
        "sar_score": round(sar_event, 3),
        "bmp_z_stat": round(bmp_z, 3),
        "bmp_p_value": round(p_val, 4),
        "significance_regime": regime,
    }


def compute_corrado_rank_test(
    abnormal_returns: pd.Series,
    event_idx: int,
) -> dict[str, Any]:
    """Compute Corrado (1989) non-parametric rank statistic resistant to non-normality and outliers.

    Z_Corrado = (Rank(AR_event) - (T+1)/2) / S(Rank)
    """
    clean_ar = abnormal_returns.dropna()
    T = len(clean_ar)
    if T < 10 or event_idx < 0 or event_idx >= T:
        return {
            "event_rank": 0,
            "total_observations": T,
            "corrado_z_stat": 0.0,
            "corrado_p_value": 1.0,
            "rank_test_regime": "Unassessed (<10 obs)",
        }

    from scipy.stats import rankdata, norm
    ranks = rankdata(clean_ar.values)
    event_rank = float(ranks[event_idx])
    mean_rank = (T + 1.0) / 2.0

    s_rank = float(np.sqrt(np.mean((ranks - mean_rank) ** 2)))
    s_rank = max(1e-4, s_rank)

    z_stat = (event_rank - mean_rank) / s_rank
    p_val = float(2 * (1.0 - norm.cdf(abs(z_stat))))

    regime = (
        "Non-Parametric Extreme Shock (Rank in Tail 5%, p < 0.05)" if p_val < 0.05
        else "Normal Non-Parametric Rank Distribution"
    )

    return {
        "event_rank": int(event_rank),
        "total_observations": T,
        "corrado_z_stat": round(z_stat, 3),
        "corrado_p_value": round(p_val, 4),
        "rank_test_regime": regime,
    }


def compute_jump_diffusion_decomposition(
    returns: pd.Series,
    window: int = 20,
) -> dict[str, Any]:
    """Disentangle continuous Gaussian diffusion from discrete Poisson price jumps (Barndorff-Nielsen & Shephard 2004).

    Realized Variance (RV) vs Bipower Variation (BV) -> Jump Variance (JV) = max(0, RV - BV)
    """
    clean_r = returns.dropna()
    if len(clean_r) < 10:
        return {
            "continuous_diffusion_vol_pct": 0.0,
            "jump_variation_vol_pct": 0.0,
            "jump_variance_share_pct": 0.0,
            "price_dynamics_regime": "Unassessed (<10 obs)",
        }

    r_vals = clean_r.values
    # Realized Variance
    rv = float(np.sum(r_vals**2))

    # Bipower Variation
    r_abs = np.abs(r_vals)
    bv = float((np.pi / 2.0) * np.sum(r_abs[1:] * r_abs[:-1]))

    jv = max(0.0, rv - bv)
    jump_share = (jv / rv * 100.0) if rv > 1e-8 else 0.0

    vol_diff_ann = float(np.sqrt(bv * 252.0 / len(r_vals))) * 100.0 if len(r_vals) > 0 else 0.0
    vol_jump_ann = float(np.sqrt(jv * 252.0 / len(r_vals))) * 100.0 if len(r_vals) > 0 else 0.0

    regime = (
        "High Discrete Jump Dynamics (Jump Share > 35%)" if jump_share > 35.0
        else "Moderate Jump Activity (15% - 35%)" if jump_share >= 15.0
        else "Smooth Continuous Brownian Diffusion"
    )

    return {
        "continuous_diffusion_vol_pct": round(vol_diff_ann, 2),
        "jump_variation_vol_pct": round(vol_jump_ann, 2),
        "jump_variance_share_pct": round(jump_share, 1),
        "price_dynamics_regime": regime,
    }


def flagging_diagnostics(
    table: pd.DataFrame,
    coverage_threshold: float = DEFAULT_COVERAGE_Z,
    return_threshold: float = DEFAULT_RETURN_Z,
    frame: pd.DataFrame | None = None,
) -> dict:
    """Why the few candidate days were kept and the rest were not.

    ``rank_incidents()`` only reports the days that cleared both bars. That
    tells a reader *what* survived, not *why* the rest didn't - a report
    that only shows the winners looks arbitrary. This buckets every trading
    day in the window against the same two-part test (unusual coverage AND
    unusual abnormal return) so the Summary can say, with real counts, how
    many days were routine, how many had unusual coverage that didn't move
    the price, and - a real gap worth naming rather than hiding - how many
    days had an unusually large move with no collected coverage to explain
    it at all.
    """
    if table.empty:
        return {
            "trading_days": 0, "days_with_news": 0, "thin_baseline": False,
            "candidates": 0, "coverage_only": 0, "return_only": 0,
            "no_coverage_big_move": 0, "routine": 0,
        }

    days_with_news = int((table["unique_count"] > 0).sum())
    thin_baseline = days_with_news < MIN_DAYS_FOR_BASELINE

    # Same t-distribution widening rank_incidents() applies - see its
    # comment. Falls back to the raw threshold when no frame is given.
    effective_return_threshold = t_equivalent_threshold(
        return_threshold, frame.attrs.get("ar_scale_df", 0) if frame is not None else 0)

    candidates = coverage_only = return_only = routine = 0
    no_coverage_quiet = no_coverage_big_move = 0

    for _, row in table.iterrows():
        has_news = row["unique_count"] > 0
        return_unusual = abs(row["abnormal_return_z"]) >= effective_return_threshold
        if not has_news:
            if return_unusual:
                no_coverage_big_move += 1
            else:
                no_coverage_quiet += 1
            continue
        if thin_baseline:
            coverage_unusual = True
        else:
            coverage_unusual = (row["coverage_z"] >= coverage_threshold
                                or abs(row["sentiment_z"]) >= coverage_threshold)
        if coverage_unusual and return_unusual:
            candidates += 1
        elif coverage_unusual:
            coverage_only += 1
        elif return_unusual:
            return_only += 1
        else:
            routine += 1

    return {
        "trading_days": len(table),
        "days_with_news": days_with_news,
        "thin_baseline": thin_baseline,
        "candidates": candidates,
        "coverage_only": coverage_only,
        "return_only": return_only,
        "no_coverage_big_move": no_coverage_big_move,
        "routine": routine + no_coverage_quiet,
    }


def _excerpt(text: str, max_len: int = 220) -> str:
    """A plain-text summary fallback when a source gave no meta description.

    Cut at the last whole word inside the limit rather than mid-word, so a
    reader isn't left staring at a truncated fragment like "...derivativ".
    """
    text = " ".join(text.split())  # collapse whitespace/newlines from body extraction
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return cut + "…"


def attach_headlines(incidents: list[Incident], items: list[NewsItem],
                     limit: int = 5) -> list[Incident]:
    """Hang the source articles behind each flag onto the incident (Section 8).

    Each entry carries the real article URL and a real summary - the
    source's own meta description/JSON-LD abstract (``NewsItem.snippet``)
    where available, else a plain-text excerpt of the extracted body - so a
    reader can follow the link and see what the story actually said, not
    just its headline.
    """
    for incident in incidents:
        relevant = [i for i in items
                    if i.trading_day == incident.day and i.duplicate_of is None]
        relevant.sort(key=lambda i: (-abs(i.sentiment_score), -i.relevance_score))
        incident.headlines = [
            {
                "source": i.source,
                "headline": i.headline,
                "url": i.url,
                "sentiment_label": i.sentiment_label,
                "relevance": round(i.relevance_score, 2),
                "summary": (i.snippet.strip() if i.snippet.strip()
                           else _excerpt(i.body) if i.body else ""),
            }
            for i in relevant[:limit]
        ]
    return incidents


def sentiment_return_correlation(table: pd.DataFrame) -> dict:
    """Pearson correlation between daily sentiment and abnormal return.

    Answers the tool's own founding question directly - does sentiment track
    price - as a single number, rather than only the per-day incident flags.
    Descriptive, not inferential: over the handful of trading days a typical
    run covers, this has a wide confidence interval and is not a claim of
    statistical significance, exactly the same caveat this tool already makes
    about everything else it reports. Only news-carrying days are included; a
    silent day forces sentiment to 0 by construction, which would dilute the
    correlation with manufactured non-signal rather than real absence of it.
    """
    covered = table[table["unique_count"] > 0] if len(table) else table
    # The first row of any price series has no prior close for pct_change()
    # to work with, so its return (and everything derived from it) is NaN by
    # construction - not a data problem, just how day one of a series works.
    # A single NaN silently poisons corrcoef's result to NaN with no error,
    # so it must be dropped explicitly rather than trusted to "just work".
    covered = covered.dropna(subset=["weighted_sentiment", "abnormal_return"])
    n = len(covered)
    if n < 3:
        return {
            "n": n, "r": None, "r_squared": None,
            "note": (f"only {n} news-carrying day(s) with a usable abnormal "
                     "return - too few to compute a meaningful correlation "
                     "(need at least 3)."),
        }
    sentiment = covered["weighted_sentiment"].to_numpy(dtype=float)
    abnormal = covered["abnormal_return"].to_numpy(dtype=float)
    if np.std(sentiment) == 0 or np.std(abnormal) == 0:
        return {
            "n": n, "r": None, "r_squared": None,
            "note": ("sentiment or abnormal return has zero variance across "
                     "covered days - correlation is undefined."),
        }
    r = float(np.corrcoef(sentiment, abnormal)[0, 1])
    return {
        "n": n, "r": round(r, 4), "r_squared": round(r * r, 4),
        "note": (f"Pearson r over {n} news-carrying day(s) in this run; "
                 "descriptive only, not a significance test, and not "
                 "comparable across runs with different day counts."),
    }


def sentiment_extremity_volume_correlation(table: pd.DataFrame) -> dict:
    """Pearson correlation between sentiment *extremity* (|tone|, either
    direction) and trading volume's own z-score.

    Tetlock (2007)'s second finding, distinct from the signed correlation
    above: unusually high *or* low media pessimism predicts high trading
    volume - a noise/liquidity-trader signature (divergent beliefs driving
    more trades), not a claim about which direction sentiment points.
    Testing |sentiment| rather than signed sentiment is the point; folding
    this into sentiment_return_correlation would test the wrong thing.
    Same descriptive-only caveats as that stat.
    """
    if "volume_z" not in table.columns:
        return {"n": 0, "r": None, "r_squared": None,
                "note": "no volume data available for this run."}
    covered = table[table["unique_count"] > 0] if len(table) else table
    covered = covered.dropna(subset=["weighted_sentiment", "volume_z"])
    n = len(covered)
    if n < 3:
        return {
            "n": n, "r": None, "r_squared": None,
            "note": (f"only {n} news-carrying day(s) with usable volume data "
                     "- too few to compute a meaningful correlation (need at "
                     "least 3)."),
        }
    extremity = covered["weighted_sentiment"].abs().to_numpy(dtype=float)
    volume_z = covered["volume_z"].to_numpy(dtype=float)
    if np.std(extremity) == 0 or np.std(volume_z) == 0:
        return {
            "n": n, "r": None, "r_squared": None,
            "note": ("sentiment extremity or volume has zero variance across "
                     "covered days - correlation is undefined."),
        }
    r = float(np.corrcoef(extremity, volume_z)[0, 1])
    return {
        "n": n, "r": round(r, 4), "r_squared": round(r * r, 4),
        "note": (f"Pearson r over {n} news-carrying day(s) between "
                 "|sentiment| and volume's own z-score; descriptive only, "
                 "not a significance test."),
    }


def lagged_sentiment_return_correlation(
    table: pd.DataFrame, horizons: tuple[int, ...] = (1, 5),
) -> dict:
    """Correlation between day t's sentiment and day t+h's abnormal return,
    for each horizon h in ``horizons`` - a predictive counterpart to
    :func:`sentiment_return_correlation`'s same-day (contemporaneous) test.

    Tetlock (2007)'s first finding: high media pessimism predicts a
    short-horizon negative move followed by reversion at a longer horizon.
    Reported here as two lagged correlations (typically 1 and 5 trading
    days out) rather than a single reversal metric, so a reader sees the
    actual pattern - the paper's finding would show up as a positive r at
    the short horizon (low sentiment -> low next-day return) turning
    negative or shrinking at the longer one, not as one number claiming to
    prove reversion happened. Descriptive only, like every correlation in
    this module - not a trading signal and not a significance test, and
    especially not one over the handful of non-overlapping windows a
    typical run's length allows for the longer horizon.
    """
    results: dict[int, dict] = {}
    if table.empty:
        for h in horizons:
            results[h] = {"n": 0, "r": None, "r_squared": None,
                          "note": "no daily table to correlate."}
        return {"horizons": results}

    sentiment_days = table[table["unique_count"] > 0]
    for h in horizons:
        # Pair each news-carrying day's sentiment with the abnormal return
        # h trading days later, by position in the table's own trading-day
        # index - not by calendar date, so weekends/holidays don't silently
        # shift which day "h days out" actually means.
        positions = {day: pos for pos, day in enumerate(table.index)}
        pairs = []
        for day, row in sentiment_days.iterrows():
            target_pos = positions[day] + h
            if target_pos >= len(table):
                continue
            future_return = table.iloc[target_pos]["abnormal_return"]
            if pd.notna(row["weighted_sentiment"]) and pd.notna(future_return):
                pairs.append((float(row["weighted_sentiment"]), float(future_return)))
        n = len(pairs)
        if n < 3:
            results[h] = {
                "n": n, "r": None, "r_squared": None,
                "note": (f"only {n} news-carrying day(s) with a return {h} "
                         "trading day(s) later inside this window - too few "
                         "to compute a meaningful correlation (need at "
                         "least 3)."),
            }
            continue
        sentiment = np.array([p[0] for p in pairs])
        future = np.array([p[1] for p in pairs])
        if np.std(sentiment) == 0 or np.std(future) == 0:
            results[h] = {
                "n": n, "r": None, "r_squared": None,
                "note": ("sentiment or the later return has zero variance "
                         "across covered days - correlation is undefined."),
            }
            continue
        r = float(np.corrcoef(sentiment, future)[0, 1])
        results[h] = {
            "n": n, "r": round(r, 4), "r_squared": round(r * r, 4),
            "note": (f"Pearson r over {n} pair(s) of (day t sentiment, day "
                     f"t+{h} abnormal return); descriptive only, not a "
                     "significance test."),
        }
    return {"horizons": results}


def emotion_valence_summary(table: pd.DataFrame) -> dict:
    """Mean abnormal return per GoEmotions sentiment group (PRD-adjacent extra).

    ``dominant_emotion`` is already one label per day (the most common
    surfaced emotion among that day's items — see ``aggregate_by_day``). This
    buckets those labels into the paper's own positive/negative/ambiguous
    groups (Demszky et al., 2020, Section 5.1; see ``ceia/emotion.py``) and
    reports the mean abnormal return for days in each bucket, alongside
    FinBERT's own weighted sentiment for the same days as a cross-check.

    Purely descriptive, like the correlation stat above: it groups days that
    already exist in the table, it does not change which days are incidents
    or how they are scored. Days with no surfaced emotion (blank
    ``dominant_emotion`` — the common case on formal financial-press
    headlines, see ``pick_emotions``) or no news at all are excluded, not
    folded into a fourth bucket, since a blank label means "GoEmotions had
    nothing confident to say," not "neutral valence."
    """
    if table.empty or "dominant_emotion" not in table.columns:
        return {"groups": {}, "note": "no daily table to summarise."}

    covered = table[table["dominant_emotion"].astype(str).str.len() > 0].copy()
    covered = covered.dropna(subset=["abnormal_return"])
    if covered.empty:
        return {
            "groups": {},
            "note": ("no day had a confident-enough dominant emotion to "
                     "group by valence."),
        }

    covered["valence"] = covered["dominant_emotion"].map(valence_of)
    covered = covered[covered["valence"] != ""]
    if covered.empty:
        return {
            "groups": {},
            "note": "no day's dominant emotion mapped to a known valence group.",
        }

    groups = {}
    for valence in ("positive", "negative", "ambiguous"):
        subset = covered[covered["valence"] == valence]
        if subset.empty:
            continue
        groups[valence] = {
            "n_days": int(len(subset)),
            "mean_abnormal_return": round(float(subset["abnormal_return"].mean()), 5),
            "mean_weighted_sentiment": round(float(subset["weighted_sentiment"].mean()), 4),
            "labels_seen": sorted(subset["dominant_emotion"].unique().tolist()),
        }

    return {
        "groups": groups,
        "note": (f"{len(covered)} day(s) had a confident dominant emotion "
                 "(GoEmotions, headline-only, secondary to FinBERT); grouped "
                 "by the paper's own positive/negative/ambiguous clustering. "
                 "Descriptive only — small day counts per group, and this "
                 "never affects incident flagging or ranking."),
    }


# Multiplicative grid applied to the configured coverage/return z-thresholds.
# 1.0x is always the configured value itself, so the base incident set is
# always one point in the grid; 0.7x/1.3x deliberately stay close to the
# base rather than sweeping wildly, since the question this answers is "does
# this flag survive a *plausible* choice of threshold", not "does it survive
# an arbitrary one".
DEFAULT_SENSITIVITY_MULTIPLIERS = (0.7, 1.0, 1.3)


def robustness_check(
    table: pd.DataFrame,
    frame: pd.DataFrame,
    base_incidents: list[Incident],
    event_window: tuple[int, int],
    coverage_threshold: float,
    return_threshold: float,
    multipliers: tuple[float, ...] = DEFAULT_SENSITIVITY_MULTIPLIERS,
) -> dict:
    """How much of the incident list survives a plausible change in thresholds?

    The ranking score already orders candidates for attention, but it says
    nothing about how sensitive the underlying *flagging* test is to the two
    thresholds that drive it. A day that flags at every combination in the
    grid is a robust candidate; a day that only flags at the loosest setting
    is a borderline one - useful context a reader can't get from the base run
    alone. ``event_window`` is fixed across the grid rather than varied: it
    only changes the CAR figure attached to an already-flagged day, not
    whether that day flags in the first place, so sweeping it would just
    relabel the same incident set under a different heading.

    Each grid cell re-runs the full flagging test (cheap: ``permutations=0``
    skips the placebo resampling, which is not needed here - this answers a
    different question than the CAR p-value does).
    """
    if not base_incidents:
        return {"n_combos": 0, "days": {}, "note": "no incidents to check."}

    grid_days: list[set[date]] = []
    for cov_mult in multipliers:
        for ret_mult in multipliers:
            variant = rank_incidents(
                table, frame, event_window=event_window,
                coverage_threshold=coverage_threshold * cov_mult,
                return_threshold=return_threshold * ret_mult,
                permutations=0,
            )
            grid_days.append({i.day for i in variant})

    n_combos = len(grid_days)
    days: dict[str, dict] = {}
    for incident in base_incidents:
        hits = sum(1 for day_set in grid_days if incident.day in day_set)
        days[incident.day.isoformat()] = {
            "flagged_in": hits,
            "of": n_combos,
            "fraction": round(hits / n_combos, 3),
        }

    mult_label = "/".join(f"{m:g}x" for m in multipliers)
    return {
        "n_combos": n_combos,
        "multipliers": list(multipliers),
        "days": days,
        "note": (f"each candidate day's flagging test re-run across "
                f"{n_combos} combinations of coverage/return z-thresholds "
                f"({mult_label} of the {coverage_threshold:g}/"
                f"{return_threshold:g} configured values). A day flagged in "
                "all combinations is robust to the exact threshold chosen; "
                "one flagged in only the loosest combination is threshold-"
                "sensitive - treat it with more caution."),
    }


def caveats(table: pd.DataFrame, incidents: list[Incident],
            model_kind: str, scale_source: str) -> list[str]:
    """The limitations this specific run has to state (PRD Section 9)."""
    notes = [
        "This is a structured case study, not a statistically validated causal "
        "finding. One company over one date range yields too few distinct "
        "incidents for the sentiment/abnormal-return relationship to carry "
        "statistical significance; a proper event study spans dozens of "
        "companies and events.",
        "Flagged days are days on which unusual coverage COINCIDED WITH an "
        "unusual benchmark-adjusted return. Coincidence in time is not evidence "
        "that an article caused a price move.",
    ]
    days_with_news = int((table["unique_count"] > 0).sum()) if len(table) else 0
    if days_with_news < MIN_DAYS_FOR_BASELINE:
        notes.append(
            f"Only {days_with_news} trading day(s) in this window carried "
            "coverage — too few to say which days were unusually busy, so the "
            "coverage test was RELAXED to 'any coverage at all' and days were "
            "flagged on the abnormal return alone. Treat the ranking as "
            "'notable price moves that had coverage', not as evidence that the "
            "coverage was itself unusual. Widen the date range to restore the "
            "stricter test."
        )
    if model_kind == "market-adjusted":
        notes.append(
            "Abnormal returns use the market-adjusted model (beta fixed at 1.0) "
            "because there was not enough clean lead-in data to fit a market "
            "model. A high-beta stock will show a systematically inflated "
            "abnormal return under this assumption."
        )
    if scale_source and "analysis-window" in scale_source:
        notes.append(
            "Abnormal returns are standardised against the analysis window's own "
            "spread rather than a clean estimation window, which understates how "
            "unusual the largest moves are."
        )
    if len(incidents) <= 2:
        notes.append(
            f"{len(incidents)} candidate incident(s) were flagged. Rankings over "
            "so few candidates are indicative only."
        )
    disagreeing = [i for i in incidents if not i.direction_agrees]
    if disagreeing:
        notes.append(
            f"{len(disagreeing)} flagged day(s) show a price move in the opposite "
            "direction to the coverage's tone. That is not necessarily an error: "
            "news can be already priced in, or the day's move driven by something "
            "the coverage did not capture."
        )
    return notes
