"""Per-company cache of scraped news items (Phase 1 output only), so a run
whose date range overlaps an earlier run for the same company does not
re-crawl days already fetched.

Deliberately news-only - not prices, macro, Nifty, or financials (see
``ceia/analyze.py``'s ``--skip-news-cache`` help / README): those are either
cheap to refetch (a handful of API calls) or are "latest snapshot" values (a
G-Sec yield, a NOPAT) that would go stale if served from a cache keyed by an
unrelated date range. News scraping is the one part of this pipeline slow and
rate-limited enough - a single month can mean tens of thousands of candidate
URLs across all sources - to be worth this complexity for.

One JSON file per company under ``--news-cache-dir``, keyed by a slugified
version of ``--company`` - so consistent spelling matters, the same way
consistent ``--alias`` usage already does elsewhere in this project. Each
file stores:

  - ``segments``: date ranges already fully crawled, each tagged with the
    exact, sorted source list used for that crawl. A segment only satisfies
    a later request if the request's source set is a *subset* of the
    segment's - a run adding a new source is treated as needing to crawl
    that range again, not silently missing the new source's coverage of it.
  - ``items``: every :class:`~ceia.models.NewsItem` found across all
    segments, keyed by URL (a fetch is always of one specific article).

Gap-fill, not exact-subset matching: a requested ``[start, end]`` is split
by :func:`compute_gaps` into the sub-ranges NOT already covered by a
satisfying segment - only those sub-ranges need crawling. The caller is
responsible for recombining cached items in the request window with the
freshly-crawled gap items and re-running dedup on the combined batch: dedup
compares items sharing a publication day, and gap subtraction is exact at
day granularity, so a cached day and a freshly-crawled day never need
cross-checking against each other - but a source-set change makes a whole
day a gap even if it was already cached under a narrower source list, and
that day's stale narrow-source items must not linger once the fuller crawl
replaces them (see :func:`save_after_gaps`).
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field, replace
from datetime import date, timedelta
from pathlib import Path
from typing import TYPE_CHECKING

from . import dedupe
from .ingest import DEFAULT_SOURCES, IngestResult, run as run_ingest
from .models import NewsItem, RunConfig

if TYPE_CHECKING:
    from .fetcher import Fetcher

log = logging.getLogger(__name__)


@dataclass
class CacheSegment:
    start: date
    end: date
    sources: tuple[str, ...]  # sorted, so equality/subset checks are simple


@dataclass
class CompanyCache:
    company: str
    segments: list[CacheSegment] = field(default_factory=list)
    items: list[NewsItem] = field(default_factory=list)


def slugify(company: str) -> str:
    """A filesystem-safe cache key. Not an identity resolver - "IndusInd
    Bank" and "Indusind bank" collide (deliberately, since case/whitespace
    shouldn't fragment the cache) but "IndusInd Bank" and "IndusInd" do not
    (each --company spelling gets its own file), the same trade-off this
    project already accepts for --alias consistency."""
    slug = re.sub(r"[^a-z0-9]+", "_", company.strip().lower()).strip("_")
    return slug or "company"


def cache_path(company: str, cache_dir: Path) -> Path:
    return Path(cache_dir) / f"{slugify(company)}.json"


def load(company: str, cache_dir: Path) -> CompanyCache:
    """The company's cache, or an empty one if none exists yet or the file
    is unreadable/corrupt - a bad cache file degrades to "start fresh",
    never crashes the run."""
    path = cache_path(company, cache_dir)
    if not path.exists():
        return CompanyCache(company=company)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("news cache at %s unreadable (%s); starting fresh", path, exc)
        return CompanyCache(company=company)
    segments = [
        CacheSegment(date.fromisoformat(s["start"]), date.fromisoformat(s["end"]),
                     tuple(s["sources"]))
        for s in payload.get("segments", [])
    ]
    items = [NewsItem.from_dict(record) for record in payload.get("items", [])]
    return CompanyCache(company=company, segments=segments, items=items)


def _write(cache: CompanyCache, cache_dir: Path) -> Path:
    path = cache_path(cache.company, cache_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "company": cache.company,
        "segments": [
            {"start": s.start.isoformat(), "end": s.end.isoformat(),
             "sources": list(s.sources)}
            for s in cache.segments
        ],
        "items": [item.to_dict() for item in cache.items],
    }
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return path


def compute_gaps(start: date, end: date, segments: list[CacheSegment],
                 sources: tuple[str, ...]) -> list[tuple[date, date]]:
    """Sub-ranges of ``[start, end]`` not already covered by a segment whose
    source set is a superset of ``sources``. Satisfying segments are merged
    (adjacent or overlapping) before subtracting, so a request spanning
    several previously-cached runs still produces the minimal gap list."""
    wanted = set(sources)
    covering = sorted(
        (max(s.start, start), min(s.end, end))
        for s in segments
        if wanted <= set(s.sources) and s.end >= start and s.start <= end
    )
    merged: list[list[date]] = []
    for seg_start, seg_end in covering:
        if merged and seg_start <= merged[-1][1] + timedelta(days=1):
            merged[-1][1] = max(merged[-1][1], seg_end)
        else:
            merged.append([seg_start, seg_end])

    gaps: list[tuple[date, date]] = []
    cursor = start
    for seg_start, seg_end in merged:
        if cursor < seg_start:
            gaps.append((cursor, seg_start - timedelta(days=1)))
        cursor = max(cursor, seg_end + timedelta(days=1))
    if cursor <= end:
        gaps.append((cursor, end))
    return gaps


def _coalesce(segments: list[CacheSegment]) -> list[CacheSegment]:
    """Merge adjacent/overlapping segments that share the exact same source
    tuple, so the segment list does not grow without bound across many
    small, adjacent runs. Segments with different source tuples are left
    alone - each still correctly answers its own subset check in
    :func:`compute_gaps`, and collapsing across different source lists
    would misrepresent what was actually crawled for a given range."""
    by_sources: dict[tuple[str, ...], list[CacheSegment]] = {}
    for seg in segments:
        by_sources.setdefault(seg.sources, []).append(seg)
    out: list[CacheSegment] = []
    for sources, group in by_sources.items():
        group.sort(key=lambda s: s.start)
        merged: list[CacheSegment] = []
        for seg in group:
            if merged and seg.start <= merged[-1].end + timedelta(days=1):
                merged[-1] = CacheSegment(merged[-1].start, max(merged[-1].end, seg.end),
                                          sources)
            else:
                merged.append(seg)
        out.extend(merged)
    return out


def cached_items_in_window(cache: CompanyCache, start: date, end: date,
                           gaps: list[tuple[date, date]]) -> list[NewsItem]:
    """Cached items inside ``[start, end]``, excluding any date falling in
    ``gaps`` - those days are about to be (re-)crawled, possibly because an
    earlier segment covered them under a narrower source list, and their
    stale items must not be mixed in with the fresh, fuller crawl."""
    def in_a_gap(day: date) -> bool:
        return any(g_start <= day <= g_end for g_start, g_end in gaps)

    out = []
    for item in cache.items:
        if item.published_at is None:
            continue
        day = item.published_at.date()
        if start <= day <= end and not in_a_gap(day):
            out.append(item)
    return out


def save_after_gaps(cache: CompanyCache, gaps: list[tuple[date, date]],
                    sources: tuple[str, ...], new_items: list[NewsItem],
                    cache_dir: Path) -> CompanyCache:
    """Record each gap range as now covered for ``sources``, replace any
    existing cached items whose day fell in one of those gaps (they are
    superseded by ``new_items``, which may have been crawled under a wider
    source list than whatever produced the stale entries), merge in
    ``new_items`` keyed by URL, and persist."""
    def in_a_gap(day: date) -> bool:
        return any(g_start <= day <= g_end for g_start, g_end in gaps)

    kept = [
        item for item in cache.items
        if item.published_at is None or not in_a_gap(item.published_at.date())
    ]
    by_url = {item.url: item for item in kept}
    for item in new_items:
        by_url[item.url] = item
    cache.items = list(by_url.values())

    new_segments = [CacheSegment(g_start, g_end, sources) for g_start, g_end in gaps]
    cache.segments = _coalesce(cache.segments + new_segments)

    path = _write(cache, cache_dir)
    log.info("news cache: wrote %d item(s), %d segment(s) to %s",
             len(cache.items), len(cache.segments), path)
    return cache


def load_news_from_file(path: Path) -> tuple[list[NewsItem], dict]:
    """Rehydrate a Phase 1 run, so an analysis can be re-run without re-scraping."""
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    items = [NewsItem.from_dict(record) for record in payload.get("items", [])]
    meta = {k: v for k, v in payload.items() if k != "items"}
    return items, meta


def ingest_with_cache(
    config: RunConfig, fetcher: Fetcher, cache_dir: Path,
    limit: int | None = None, max_workers: int = 8,
    skip_sentiment: bool = False, skip_emotion: bool = False,
    skip_alias_widening: bool = False, skip_slug_prefilter: bool = False,
) -> tuple[list[NewsItem], dict]:
    """Cache-aware wrapper around :func:`ceia.ingest.run`: crawls only the date
    sub-ranges not already cached for this company under the requested
    source list, then combines the freshly-crawled items with whatever was
    already cached for the rest of the window.
    """
    sources = tuple(sorted(config.sources or DEFAULT_SOURCES))
    cache = load(config.company, cache_dir)
    gaps = compute_gaps(config.start, config.end, cache.segments, sources)

    new_items: list[NewsItem] = []
    source_status: dict[str, str] = {}
    disabled_sources: dict[str, str] = {}
    per_source: dict[str, int] = {}
    aliases_used: list[str] = []
    for gap_start, gap_end in gaps:
        gap_config = replace(config, start=gap_start, end=gap_end)
        ingested = run_ingest(
            gap_config, fetcher=fetcher, limit=limit,
            skip_sentiment=skip_sentiment, skip_emotion=skip_emotion,
            max_workers=max_workers,
            skip_alias_widening=skip_alias_widening,
            skip_slug_prefilter=skip_slug_prefilter,
        )
        new_items.extend(ingested.items)
        source_status.update(ingested.source_status)
        disabled_sources.update(ingested.disabled_sources)
        for key, count in ingested.per_source.items():
            per_source[key] = per_source.get(key, 0) + count
        for alias in ingested.aliases_used:
            if alias not in aliases_used:
                aliases_used.append(alias)

    cached_items = cached_items_in_window(cache, config.start, config.end, gaps)
    cached_days = {i.published_at.date() for i in cached_items if i.published_at}
    save_after_gaps(cache, gaps, sources, new_items, cache_dir)

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
