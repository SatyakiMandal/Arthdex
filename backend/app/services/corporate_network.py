"""
Arthdex Corporate Network, Conglomerate Hierarchy & Supply Chain Service.
Supports Bloomberg SPLC, HOLD, and REL functions.
"""

from __future__ import annotations

import logging
from typing import Any

from ..cache import CACHE
from ...corporate_network import (
    get_corporate_hierarchy,
    get_supply_chain_network,
    get_network_summary,
)

logger = logging.getLogger(__name__)


def get_hierarchy_cached(symbol: str) -> dict[str, Any]:
    sym = (symbol or "M&M").upper().strip()
    cache_key = f"network:hierarchy:{sym}"
    return CACHE.get_or_fetch(cache_key, 3600, lambda: get_corporate_hierarchy(sym))[0]


def get_supply_chain_cached(symbol: str) -> dict[str, Any]:
    sym = (symbol or "M&M").upper().strip()
    cache_key = f"network:supply_chain:{sym}"
    return CACHE.get_or_fetch(cache_key, 3600, lambda: get_supply_chain_network(sym))[0]


def get_summary_cached(symbol: str) -> dict[str, Any]:
    sym = (symbol or "M&M").upper().strip()
    cache_key = f"network:summary:{sym}"
    return CACHE.get_or_fetch(cache_key, 3600, lambda: get_network_summary(sym))[0]
