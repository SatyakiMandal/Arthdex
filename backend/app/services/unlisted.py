"""
Unlisted / pre-IPO shares.

No exchange publishes these prices, so the only public source is a dealer site,
UnlistedZone. This reuses the scraping already built and verified for the
analyzer (``ceia.unlisted``): its honest user agent, robots.txt checks, per-
origin rate limit and on-disk provenance log, all of which come from
``ceia.fetcher.Fetcher``.

What the source actually carries, and what this module therefore returns:

* an *indicative* price. The site itself says these are "levels compiled by our
  team", not a feed or a quote. The chart holds the last value flat between
  revisions (1,669 daily points but 163 distinct values on one test page), so
  the revisions are returned as the series and the flat days are dropped.
* a handful of ratios (P/B, book value, face value, lot size, 52-week range).
  P/E is frequently "N/A" for loss-making companies and is passed through as
  such rather than filled.

It does not carry governance flags, shareholding, order books or milestones, so
none of those are produced here.
"""

from __future__ import annotations

import re
import threading
from datetime import datetime
from html import unescape
from pathlib import Path
from typing import Any

from ..cache import CACHE
from ceia.fetcher import Fetcher
from ceia.unlisted import _SERIES_POINT_RE

ORIGIN = "https://unlistedzone.com"
DIRECTORY_URL = f"{ORIGIN}/shares"
CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "unlisted"

DIRECTORY_KEY = "unlisted:directory"
DIRECTORY_TTL = 6 * 3600

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,200}$")

_TAG_RE = re.compile(r"<[^>]+>|<!--.*?-->", re.S)
_CARD_SPLIT_RE = re.compile(r'<div class="scard">')
_NAME_RE = re.compile(r'class="nm">([^<]+)<')
_SECTOR_RE = re.compile(r'class="sec">([^<]*)<')
_PRICE_RE = re.compile(r'<span class="p num"><span class="rupee">[^<]*</span>([^<]+)</span>')
_HREF_RE = re.compile(r'class="det" href="/shares/([^"]+)"')
_LOGO_RE = re.compile(r'<img src="(https://unlistedzone\.com/logos/[^"]+)"')
_LAST_PAGE_RE = re.compile(r'"lastPage":(\d+)')

_NAME_NOISE_RE = re.compile(
    r"\s*\b(unlisted shares?(?:\s*\(equity\))?|share price|buy\s*(?:/|and)?\s*sell(?:\s*online)?)\b\s*$", re.I
)

_fetcher: Fetcher | None = None
_fetcher_lock = threading.Lock()


def _get_fetcher() -> Fetcher:
    global _fetcher
    with _fetcher_lock:
        if _fetcher is None:
            _fetcher = Fetcher(cache_dir=CACHE_DIR, min_interval=2.0)
        return _fetcher


def _clean_name(raw: str) -> str:
    name = unescape(raw).strip()
    previous = None
    while previous != name:
        previous = name
        name = _NAME_NOISE_RE.sub("", name).strip()
    return name


def _number(text: str | None) -> float | None:
    if not text:
        return None
    match = re.search(r"-?\d[\d,]*\.?\d*", text)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


def _positive(value: float | None) -> float | None:
    """The source shows 0 where it has no price, which is not a price."""
    return value if value is not None and value > 0 else None


def parse_directory_page(html: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for card in _CARD_SPLIT_RE.split(html)[1:]:
        href = _HREF_RE.search(card)
        name = _NAME_RE.search(card)
        if not href or not name:
            continue
        price = _PRICE_RE.search(card)
        sector = _SECTOR_RE.search(card)
        logo = _LOGO_RE.search(card)
        rows.append(
            {
                "id": href.group(1),
                "name": _clean_name(name.group(1)),
                "sector": unescape(sector.group(1)).strip() if sector else None,
                "price": _positive(_number(price.group(1))) if price else None,
                "logo": logo.group(1) if logo else None,
            }
        )
    return rows


def build_directory(max_pages: int = 30) -> dict[str, Any]:
    """Every tracked company, name, sector and indicative price, across all pages."""
    fetcher = _get_fetcher()
    seen: set[str] = set()
    companies: list[dict[str, Any]] = []
    last_page = max_pages
    page = 1
    while page <= last_page:
        url = DIRECTORY_URL if page == 1 else f"{DIRECTORY_URL}?page={page}"
        html = fetcher.get(url, force=True).text
        rows = parse_directory_page(html)
        if not rows:
            break
        if page == 1:
            match = _LAST_PAGE_RE.search(html)
            if match:
                last_page = min(int(match.group(1)), max_pages)
        for row in rows:
            if row["id"] not in seen:
                seen.add(row["id"])
                companies.append(row)
        page += 1

    if not companies:
        raise RuntimeError("the unlisted directory returned no companies")

    sectors = sorted({c["sector"] for c in companies if c["sector"]})
    return {"companies": companies, "sectors": sectors, "total": len(companies)}


def _facts(html: str) -> dict[str, str]:
    facts: dict[str, str] = {}
    for label, value in re.findall(r'<div class="l">([^<]+)</div><div class="v[^"]*">([^<]*)</div>', html):
        label = unescape(label).strip()
        if label not in facts:
            facts[label] = unescape(value).strip()
    return facts


def build_company(slug: str) -> dict[str, Any]:
    if not SLUG_RE.match(slug):
        raise ValueError("invalid company id")

    html = _get_fetcher().get(f"{DIRECTORY_URL}/{slug}", force=True).text

    name = re.search(r"<h1>([^<]+)</h1>", html)
    if not name:
        raise LookupError(f"no unlisted company page for '{slug}'")

    sector = re.search(r'class="chip" href="/sector/[^"]+">([^<]+)<', html)
    isin = re.search(r"ISIN[^<]*<!-- -->([A-Z0-9]{12})", html)
    cin = re.search(r'"name":"CIN","value":"([A-Z0-9]+)"', html)
    price = re.search(r'<span class="price num"><span class="rupee">[^<]*</span>([^<]+)</span>', html)
    asof = re.search(r"As of <!-- -->([^<]+)<", html)
    logo = _LOGO_RE.search(html)
    description = re.search(r'<meta name="description" content="([^"]*)"', html)

    change_raw = re.search(r'class="pchange">(.*?)</div>', html, re.S)
    change_pct = None
    change_window = None
    if change_raw:
        text = _TAG_RE.sub("", change_raw.group(1))
        value = _number(text.replace("▲", "").replace("▼", ""))
        if value is not None:
            change_pct = -abs(value) if "▼" in text else abs(value)
        window = re.search(r"\b(\d+[MYD]|Max)\b", text)
        change_window = window.group(1) if window else None

    # Collapse the as-displayed daily series (forward-filled) down to its real revisions.
    points: dict[str, float] = {}
    for day, value in _SERIES_POINT_RE.findall(html):
        points[day] = float(value)
    days = sorted(points)
    revisions: list[dict[str, Any]] = []
    previous: float | None = None
    for day in days:
        value = points[day]
        if previous is None or value != previous:
            revisions.append(
                {
                    "date": day,
                    "price": value,
                    "changePct": None if previous in (None, 0) else round((value - previous) / previous * 100, 2),
                }
            )
            previous = value

    series = [{"date": r["date"], "price": r["price"]} for r in revisions]
    if days and series and series[-1]["date"] != days[-1]:
        series.append({"date": days[-1], "price": points[days[-1]]})

    first = revisions[0]["price"] if revisions else None
    latest = points[days[-1]] if days else None

    return {
        "id": slug,
        "name": _clean_name(name.group(1)),
        "sector": unescape(sector.group(1)).strip() if sector else None,
        "isin": isin.group(1) if isin else None,
        "cin": cin.group(1) if cin else None,
        "logo": logo.group(1) if logo else None,
        "summary": unescape(description.group(1)).strip() if description else None,
        "price": _positive(_number(price.group(1))) if price else _positive(latest),
        "asOf": _iso_date(asof.group(1)) if asof else (days[-1] if days else None),
        "change": {"pct": change_pct, "window": change_window},
        "facts": _facts(html),
        "series": series,
        "revisions": list(reversed(revisions)),
        "sinceFirstPct": None if not first or latest is None else round((latest - first) / first * 100, 2),
        "firstDate": days[0] if days else None,
        "dailyPoints": len(days),
        "url": f"{DIRECTORY_URL}/{slug}",
    }


def _iso_date(text: str) -> str | None:
    for fmt in ("%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(text.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


# -- non-blocking access for search -------------------------------------------
#
# A cold directory is about a dozen rate-limited fetches (30 to 55 seconds), far too
# slow to hold a search keystroke on. Search therefore uses whatever is already
# cached and kicks a background build when nothing is, so unlisted names appear as
# soon as the build finishes instead of every query waiting on it.

_warm_lock = threading.Lock()
_warming = False


def ensure_warm() -> None:
    global _warming
    with _warm_lock:
        if _warming:
            return
        _warming = True

    def run() -> None:
        global _warming
        try:
            CACHE.get_or_fetch(DIRECTORY_KEY, DIRECTORY_TTL, build_directory)
        except Exception:
            pass
        finally:
            with _warm_lock:
                _warming = False

    threading.Thread(target=run, name="unlisted-warmup", daemon=True).start()


def cached_directory() -> list[dict[str, Any]] | None:
    """The directory if it has been built, else None (and a build is started)."""
    entry = CACHE.get_entry(DIRECTORY_KEY)
    if entry is None:
        ensure_warm()
        return None
    age = CACHE.age(DIRECTORY_KEY) or 0
    if age > DIRECTORY_TTL:
        ensure_warm()  # refresh in the background; the stale list is still good for search
    return entry.value["companies"]


def search_directory(companies: list[dict[str, Any]], query: str, limit: int = 8) -> list[dict[str, Any]]:
    needle = re.sub(r"[^\w\s]", " ", query.lower())
    needle = " ".join(needle.split())
    if len(needle) < 2:
        return []
    scored: list[tuple[int, int, dict[str, Any]]] = []
    for c in companies:
        name = " ".join(re.sub(r"[^\w\s]", " ", c["name"].lower()).split())
        if name.startswith(needle):
            rank = 0
        elif f" {needle}" in name:
            rank = 1
        elif needle in name:
            rank = 2
        else:
            continue
        scored.append((rank, len(name), c))
    scored.sort(key=lambda t: (t[0], t[1]))
    return [c for _, _, c in scored[:limit]]
