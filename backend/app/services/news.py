"""
Curated news and filings feed.

Combines two genuinely different things and keeps them distinguishable:
exchange filings, which are primary-source disclosures made under SEBI's Listing
Obligations and Disclosure Requirements, and press RSS, which is commentary.
The `kind` field says which is which, because they carry very different weight.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

IST = timezone(timedelta(hours=5, minutes=30))

from ..providers import nse, rss

# NSE publishes a real category on every announcement. Classifying on that is
# far more reliable than keyword-matching a headline, so it is tried first.
CATEGORY_FLAGS: dict[str, list[str]] = {
    "bagging/receiving of orders/contracts": ["order-win"],
    "credit rating": ["rating-action"],
    "financial results": ["earnings"],
    "outcome of board meeting": ["board-outcome"],
    "change in management": ["management-change"],
    "trading window": ["insider-window"],
    "shareholders meeting": ["governance"],
    "acquisition": ["acquisition"],
    "fund raising": ["fund-raising"],
    "dividend": ["dividend"],
    "allotment of shares": ["fund-raising"],
    "resignation": ["management-change"],
    "analysts/institutional investor meet": ["investor-meet"],
    "investment": ["acquisition"],
    "disclosure under reg 30": ["material-event"],
}

# Applied to press headlines, which carry no category at all.
KEYWORD_FLAGS: list[tuple[str, str]] = [
    (r"\border(s)?\b|\bcontract\b|\bbags\b|letter of award|\bloa\b", "order-win"),
    (r"\bresult(s)?\b|\bq[1-4]\b|profit|earnings|revenue", "earnings"),
    (r"stake sale|offer for sale|\bofs\b|block deal|divest|pares stake", "stake-sale"),
    (r"\brating\b|crisil|icra|care ratings|upgrade[sd]?|downgrade[sd]?", "rating-action"),
    (r"\bipo\b|listing|grey market|subscri", "ipo"),
    (r"dividend|buyback|bonus issue|split", "capital-return"),
    (r"\brbi\b|inflation|repo rate|\bgdp\b|\bfed\b|tariff", "macro"),
]


def _classify_filing(description: str | None, detail: str | None) -> list[str]:
    """Every NSE announcement is itself a LODR disclosure, so that flag is always set."""
    flags = ["lodr-disclosure"]
    desc = (description or "").strip().lower()

    for category, mapped in CATEGORY_FLAGS.items():
        if category in desc:
            flags.extend(mapped)
            break
    else:
        # Fall back to the free-text body when the category is unrecognised
        flags.extend(_classify_text(f"{description or ''} {detail or ''}"))

    return list(dict.fromkeys(flags))


def _classify_text(text: str) -> list[str]:
    lowered = (text or "").lower()
    return [flag for pattern, flag in KEYWORD_FLAGS if re.search(pattern, lowered)]


def _to_iso(stamp: str | None) -> str | None:
    """
    Normalise NSE's "30-Sep-2026 01:18:34" to ISO.

    Filings and RSS arrive in different formats, so they cannot be ordered
    against each other until both are ISO — string-sorting the raw values would
    interleave them arbitrarily.
    """
    if not stamp:
        return None
    text = str(stamp).strip()
    for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M", "%d-%b-%Y"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=IST).isoformat()
        except ValueError:
            continue
    return text  # already ISO, or an unknown format we leave untouched


def _match_symbols(text: str, universe: set[str]) -> list[str]:
    """
    Tickers mentioned in a headline.

    Matches whole uppercase words of three characters or more against the real
    listed universe. Three is the floor because TCS, ITC and IOC are all real
    tickers; ordinary English words that happen to be symbols are filtered out
    by `universe.AMBIGUOUS_SYMBOLS` before they reach here.
    """
    tokens = set(re.findall(r"\b[A-Z][A-Z0-9&]{2,}\b", text or ""))
    return sorted(tokens & universe)


def build_feed(
    limit: int = 60,
    symbol: str | None = None,
    known_symbols: set[str] | None = None,
) -> dict[str, Any]:
    universe = known_symbols or set()
    items: list[dict[str, Any]] = []
    errors: list[str] = []

    try:
        for position, filing in enumerate(nse.fetch_announcements(limit=80)):
            sym = (filing.get("symbol") or "").upper()
            items.append(
                {
                    # seq_id when the exchange supplies one, position otherwise:
                    # timestamps alone are not unique per filing.
                    "id": f"nse-{sym}-{filing.get('seqId') or position}",
                    "headline": f"{filing.get('company') or sym}: {filing.get('subject')}",
                    "summary": (filing.get("detail") or "")[:400],
                    "source": "NSE corporate filing",
                    "url": filing.get("attachment"),
                    "publishedAt": _to_iso(filing.get("publishedAt")),
                    "symbols": [sym] if sym else [],
                    "flags": _classify_filing(filing.get("subject"), filing.get("detail")),
                    "kind": "filing",
                    "category": filing.get("subject"),
                }
            )
    except Exception as exc:
        errors.append(f"filings: {type(exc).__name__}")

    try:
        # Outlets syndicate the same story across feeds, so a headline seen once
        # is not shown again. Normalised on case and punctuation because the
        # same story often differs only in trailing punctuation between feeds.
        seen_headlines: set[str] = set()

        for article in rss.fetch_rss():
            fingerprint = re.sub(r"[^a-z0-9]+", " ", article["headline"].lower()).strip()
            if fingerprint in seen_headlines:
                continue
            seen_headlines.add(fingerprint)

            text = f"{article['headline']} {article['summary']}"
            items.append(
                {
                    **article,
                    "symbols": _match_symbols(article["headline"], universe),
                    "flags": _classify_text(text),
                    "category": None,
                }
            )
    except Exception as exc:
        errors.append(f"rss: {type(exc).__name__}")

    if symbol:
        target = symbol.upper()
        items = [i for i in items if target in (i.get("symbols") or [])]

    # Newest first, now that both sources carry ISO timestamps.
    items.sort(key=lambda i: str(i.get("publishedAt") or ""), reverse=True)

    return {
        "items": items[:limit],
        "counts": {
            "filings": sum(1 for i in items if i["kind"] == "filing"),
            "press": sum(1 for i in items if i["kind"] == "press"),
        },
        "errors": errors or None,
    }
