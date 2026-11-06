"""
Re-export corporate network functions for root-level scripts and tests.
"""
from __future__ import annotations

try:
    from .app.services.corporate_network import (
        CONGLOMERATE_HIERARCHIES,
        SUPPLY_CHAIN_NETWORKS,
        get_corporate_hierarchy,
        get_supply_chain_network,
        get_network_summary,
    )
except ImportError:
    try:
        from app.services.corporate_network import (
            CONGLOMERATE_HIERARCHIES,
            SUPPLY_CHAIN_NETWORKS,
            get_corporate_hierarchy,
            get_supply_chain_network,
            get_network_summary,
        )
    except ImportError:
        from backend.app.services.corporate_network import (
            CONGLOMERATE_HIERARCHIES,
            SUPPLY_CHAIN_NETWORKS,
            get_corporate_hierarchy,
            get_supply_chain_network,
            get_network_summary,
        )

__all__ = [
    "CONGLOMERATE_HIERARCHIES",
    "SUPPLY_CHAIN_NETWORKS",
    "get_corporate_hierarchy",
    "get_supply_chain_network",
    "get_network_summary",
]
