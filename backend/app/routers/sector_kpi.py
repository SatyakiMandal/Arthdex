"""
Sector Operating KPIs Router (SKPI - M19).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path

from ..schemas import envelope
from .. import not_connected
from ..services import sector_kpi

_routes = APIRouter(tags=["sectors"])


@_routes.get("/kpis")
def get_all_sectors_kpis():
    """Returns top-line operational KPIs and status summary across all tracked Indian sectors (SKPI)."""
    not_connected.refuse("sector-kpis")
    try:
        data = sector_kpi.get_all_sectors_summary()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sectors summary: {exc}") from exc
    return envelope(
        data,
        3600,
        source="SIAM, MoRTH VAHAN, RBI DBIE, CEA, DGCA, and TRAI Official Bulletins",
        delayed_minutes=0,
        note="Aggregate sector operating health, capacity metrics, and production volume summaries.",
    )


@_routes.get("/kpis/{sector_code}")
def get_single_sector_kpi(
    sector_code: str = Path(..., description="Sector code: auto, banking, power, aviation, telecom"),
):
    """
    Returns detailed operational KPI payload, segment breakdowns, OEM/operator metrics,
    and 12-period historical time series for the specified Indian industry sector.
    """
    not_connected.refuse("sector-kpis")
    try:
        data = sector_kpi.get_sector_kpi(sector_code)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch KPI data for sector '{sector_code}': {exc}") from exc

    authorities = ", ".join(data.get("primary_authorities", ["Official Regulators"]))
    return envelope(
        data,
        3600,
        source=authorities,
        delayed_minutes=0,
        note=f"{data.get('sector_name')} granular operational telemetry and regulatory filings.",
    )


# The site's client (lib/api/endpoints.ts) calls every desk under /api/v1; the unversioned
# path is kept for anything already pointed at it.
router = APIRouter()
router.include_router(_routes, prefix="/api/sectors")
router.include_router(_routes, prefix="/api/v1/sectors", include_in_schema=False)
