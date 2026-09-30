"""News and corporate-filing endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..cache import CACHE
from ..config import SETTINGS
from ..schemas import envelope
from ..providers import universe as universe_provider
from ..services import news as news_service
from .search import load_universe

router = APIRouter(prefix="/api/v1/news", tags=["news"])


@router.get("")
def get_news(
    limit: int = Query(60, ge=1, le=200),
    symbol: str | None = Query(None),
    kind: str | None = Query(None, pattern="^(filing|press)$"),
):
    """
    Exchange filings and financial-press headlines in one feed.

    `kind` distinguishes a primary-source LODR filing from press commentary —
    they carry very different weight and are never merged into one category.
    """
    key = "news:feed"

    def fetch():
        # Supplying the real listed universe is what lets press headlines be
        # tagged with tickers; without it every item matches nothing.
        try:
            rows, _age = load_universe()
            known = universe_provider.searchable_symbols(rows)
        except Exception:
            known = set()
        return news_service.build_feed(limit=200, known_symbols=known)

    try:
        data, age = CACHE.get_or_fetch(key, SETTINGS.news_ttl, fetch)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"News unavailable: {exc}") from exc

    items = data["items"]
    if symbol:
        target = symbol.upper()
        items = [i for i in items if target in (i.get("symbols") or [])]
    if kind:
        items = [i for i in items if i["kind"] == kind]

    return envelope(
        {**data, "items": items[:limit]},
        age,
        source="NSE corporate announcements + Indian financial press RSS",
        delayed_minutes=0,
    )
