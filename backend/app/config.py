"""Runtime configuration for the Arthdex data service."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    # Cache lifetimes, in seconds. Free upstream endpoints are rate-limited and
    # unofficial, so every read goes through the cache rather than hitting them
    # directly on each request.
    quote_ttl: int = 60
    index_ttl: int = 60
    movers_ttl: int = 120
    candles_ttl: int = 900
    fundamentals_ttl: int = 86_400
    ipo_ttl: int = 1_800
    news_ttl: int = 300
    quant_ttl: int = 3_600

    # Upstream data is delayed; the UI states this rather than implying real time.
    quote_delay_minutes: int = 15

    nse_base: str = "https://www.nseindia.com"
    request_timeout: int = 20

    allowed_origins: tuple[str, ...] = field(
        default_factory=lambda: (
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        )
    )


def get_settings() -> Settings:
    return Settings(
        quote_ttl=int(os.getenv("ARTHDEX_QUOTE_TTL", "60")),
        candles_ttl=int(os.getenv("ARTHDEX_CANDLES_TTL", "900")),
    )


SETTINGS = get_settings()
