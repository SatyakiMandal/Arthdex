"""
Financial press RSS.

Headline-level market commentary, complementing the structured exchange filings.
Feeds are consumed as published, which is what RSS is for — no scraping.
"""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from typing import Any

import feedparser

# Business Standard's markets feed returns zero entries and is excluded.
FEEDS: list[tuple[str, str]] = [
    ("Moneycontrol", "https://www.moneycontrol.com/rss/marketreports.xml"),
    ("Moneycontrol Business", "https://www.moneycontrol.com/rss/business.xml"),
    ("Economic Times", "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"),
    ("Livemint", "https://www.livemint.com/rss/markets"),
]

_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str | None) -> str:
    """
    Strip markup and resolve entities.

    Feed titles arrive with escaped entities already embedded once — Moneycontrol
    publishes "day#39;s" — so unescaping runs twice before tags are removed.
    """
    if not text:
        return ""
    out = html.unescape(html.unescape(text))
    out = _TAG_RE.sub("", out)
    return re.sub(r"\s+", " ", out).strip()


def _published_iso(entry: Any) -> str:
    parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if parsed:
        try:
            return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat()
        except Exception:
            pass
    return datetime.now(timezone.utc).isoformat()


def fetch_rss(limit_per_feed: int = 25) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for source, url in FEEDS:
        try:
            parsed = feedparser.parse(url)
        except Exception:
            # One dead feed must not take down the whole news surface
            continue

        for entry in parsed.entries[:limit_per_feed]:
            headline = _clean(getattr(entry, "title", None))
            if not headline:
                continue
            items.append(
                {
                    "id": getattr(entry, "id", None) or getattr(entry, "link", headline),
                    "headline": headline,
                    "summary": _clean(getattr(entry, "summary", None))[:400],
                    "source": source,
                    "url": getattr(entry, "link", None),
                    "publishedAt": _published_iso(entry),
                    "kind": "press",
                }
            )

    items.sort(key=lambda i: i["publishedAt"], reverse=True)
    return items
