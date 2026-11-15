"""
Sector operating KPIs: refused until a real feed exists.

The desk would show SIAM and VAHAN vehicle volumes, RBI banking aggregates, CEA power
demand, DGCA air traffic and TRAI subscriber data. None of these is available to
Arthdex as a feed, so the endpoints say so instead of serving a fixed table.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..not_sourced import refuse

router = APIRouter(prefix="/api/sectors", tags=["sectors"])

_NEEDS = "monthly industry data (SIAM and VAHAN vehicle volumes, RBI sectoral credit, CEA power demand, DGCA traffic, TRAI subscribers)"
_WHERE = "those bodies publish PDFs and dashboards, not machine-readable feeds"


@router.get("/kpis")
def get_all_sectors_kpis():
    refuse("Sector KPIs", _NEEDS, _WHERE)


@router.get("/kpis/{sector_code}")
def get_single_sector_kpi(sector_code: str):
    refuse("Sector KPIs", _NEEDS, _WHERE)
