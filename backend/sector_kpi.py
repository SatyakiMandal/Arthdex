"""
Root re-export for Sector Operating KPIs Dashboard (M19).
"""
from __future__ import annotations

try:
    from app.services.sector_kpi import (
        SECTOR_MAP,
        TAG_ACTUAL_FILING,
        TAG_MODELLED,
        get_all_sectors_summary,
        get_auto_kpis,
        get_aviation_kpis,
        get_banking_kpis,
        get_power_kpis,
        get_sector_kpi,
        get_telecom_kpis,
    )
except ImportError:
    from backend.app.services.sector_kpi import (
        SECTOR_MAP,
        TAG_ACTUAL_FILING,
        TAG_MODELLED,
        get_all_sectors_summary,
        get_auto_kpis,
        get_aviation_kpis,
        get_banking_kpis,
        get_power_kpis,
        get_sector_kpi,
        get_telecom_kpis,
    )

__all__ = [
    "SECTOR_MAP",
    "TAG_ACTUAL_FILING",
    "TAG_MODELLED",
    "get_all_sectors_summary",
    "get_auto_kpis",
    "get_aviation_kpis",
    "get_banking_kpis",
    "get_power_kpis",
    "get_sector_kpi",
    "get_telecom_kpis",
]
