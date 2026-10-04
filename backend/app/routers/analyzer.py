"""Event-impact analyzer endpoints: search, launch a run, poll it, read results."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from ..cache import CACHE
from ..providers import universe as universe_provider
from ..services import analyzer as svc
from ..services import unlisted as unlisted_service
from .search import load_universe

router = APIRouter(prefix="/api/v1/analyzer", tags=["analyzer"])

MIN_SPAN_DAYS = 45
MAX_SPAN_DAYS = 800


class RunRequest(BaseModel):
    kind: Literal["listed", "unlisted"]
    company: str = Field(min_length=2, max_length=120)
    ticker: str | None = Field(default=None, max_length=24, pattern=r"^[A-Za-z0-9&.\-^]+$")
    url: str | None = Field(default=None, max_length=300, pattern=r"^https://unlistedzone\.com/shares/[A-Za-z0-9\-_/]+$")
    start: date
    end: date


@router.get("/search")
def search(q: str = Query("", max_length=60), kind: Literal["any", "listed", "unlisted"] = "any", limit: int = Query(10, ge=1, le=25)):
    """Autocomplete for the analyzer across NSE equities and the unlisted directory."""
    query = q.strip()
    if not query:
        return {"kind": kind, "results": [], "unlistedReady": True}

    results: list[dict] = []
    if kind in ("any", "listed"):
        try:
            rows, _ = load_universe()
        except Exception as exc:
            if kind == "listed":
                raise HTTPException(503, f"Listed universe unavailable: {exc}") from exc
            rows = []
        for h in universe_provider.search(rows, query, limit):
            results.append(
                {"kind": "listed", "name": h["name"], "ticker": f"{h['symbol']}.NS", "symbol": h["symbol"], "url": None, "sector": None}
            )

    ready = True
    if kind in ("any", "unlisted"):
        directory = unlisted_service.cached_directory()
        ready = directory is not None
        for c in unlisted_service.search_directory(directory or [], query, limit):
            results.append(
                {
                    "kind": "unlisted",
                    "name": c["name"],
                    "ticker": None,
                    "symbol": None,
                    "url": f"https://unlistedzone.com/shares/{c['id']}",
                    "sector": c["sector"],
                }
            )

    # Listed first (they rank by symbol and name), but never let them crowd out every unlisted match
    listed_hits = [r for r in results if r["kind"] == "listed"]
    unlisted_hits = [r for r in results if r["kind"] == "unlisted"]
    keep_unlisted = min(len(unlisted_hits), max(3, limit - len(listed_hits)))
    merged = listed_hits[: limit - keep_unlisted] + unlisted_hits[:keep_unlisted]
    return {"kind": kind, "results": merged, "unlistedReady": ready}


@router.post("/runs", status_code=202)
def create_run(body: RunRequest):
    today = date.today()
    if body.end > today:
        raise HTTPException(422, "End date cannot be in the future.")
    span = (body.end - body.start).days
    if span < MIN_SPAN_DAYS:
        raise HTTPException(422, f"Window too short: use at least {MIN_SPAN_DAYS} days so the market model has data to fit.")
    if span > MAX_SPAN_DAYS:
        raise HTTPException(422, f"Window too long: at most {MAX_SPAN_DAYS} days per run.")
    if body.kind == "listed" and not body.ticker:
        raise HTTPException(422, "A listed run needs a ticker; pick one from the search results.")

    live = [r for r in svc.list_runs(limit=200, origin="run") if r["status"] in ("QUEUED", "RUNNING")]
    if len(live) >= 8:
        raise HTTPException(429, "Too many analyses are already queued. Try again shortly.")

    return svc.submit(
        kind=body.kind,
        company=body.company,
        ticker=body.ticker,
        url=body.url,
        start=body.start,
        end=body.end,
    )


@router.get("/runs")
def list_runs(origin: Literal["run", "sample"] | None = None, limit: int = Query(50, ge=1, le=200)):
    return {"runs": svc.list_runs(limit=limit, origin=origin)}


@router.get("/runs/{run_id}")
def get_run(run_id: str):
    run = svc.status(run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    return run


@router.post("/snapshots/{symbol}")
def ensure_snapshot(symbol: str):
    """Start (or reuse) the no-news research snapshot for a listed company."""
    sym = symbol.strip().upper()
    try:
        rows, _ = load_universe()
    except Exception as exc:
        raise HTTPException(503, f"Listed universe unavailable: {exc}") from exc
    match = next((r for r in rows if r.get("symbol") == sym), None)
    if match is None:
        raise HTTPException(404, f"{sym} is not in the NSE equity universe.")
    return svc.ensure_snapshot(sym, match["name"])


@router.delete("/runs/{run_id}")
def delete_run(run_id: str):
    """Delete a finished, failed or cancelled run. Shared news caches are kept."""
    outcome = svc.delete_run(run_id)
    if outcome == "missing":
        raise HTTPException(404, "Run not found")
    if outcome == "sample":
        raise HTTPException(403, "Bundled sample reports cannot be deleted.")
    if outcome == "active":
        raise HTTPException(409, "This run is still in progress. Cancel it first.")
    return {"ok": True}


@router.post("/runs/clear-unsuccessful")
def clear_unsuccessful():
    return {"deleted": svc.clear_unsuccessful()}


@router.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str):
    if not svc.cancel(run_id):
        raise HTTPException(409, "Run is not active")
    return {"ok": True}


@router.get("/runs/{run_id}/summary")
def get_summary(run_id: str):
    meta = svc.read_meta(run_id)
    if meta is None:
        raise HTTPException(404, "Run not found")
    if meta.get("status") != "COMPLETED":
        raise HTTPException(409, f"Run is {meta.get('status', 'unknown').lower()}; no results yet.")
    try:
        summary = svc.summarise(run_id)
    except Exception as exc:
        raise HTTPException(500, f"Could not read this run's results: {exc}") from exc
    if summary is None:
        raise HTTPException(404, "Results missing")
    return summary


def _finished_index(kind: str) -> dict[str, dict]:
    """Newest finished run per company, keyed by ticker (listed) or normalised name (unlisted)."""
    out: dict[str, dict] = {}
    for r in svc.list_runs(limit=200):
        if r["status"] != "COMPLETED" or r["kind"] != kind:
            continue
        key = (r.get("ticker") or "").upper() if kind == "listed" else unlisted_service.normalise_name(r["company"])
        if key and key not in out:
            out[key] = r
    return out


@router.get("/runs/{run_id}/peers")
def get_peers(run_id: str):
    """Companies worth comparing a finished run with: its sector peers, flagged when already analysed.

    Listed runs use the peer list the engine scraped for the company. Unlisted runs use other
    unlisted companies in the same UnlistedZone sector. Anything with a finished run of its own
    carries that run's id, so the site can open the comparison at once.
    """
    meta = svc.read_meta(run_id)
    if meta is None:
        raise HTTPException(404, "Run not found")
    path = svc.artefact(run_id, "analysis.json")
    if path is None:
        raise HTTPException(409, "This run has no results yet")
    import json as _json

    a = _json.loads(path.read_text(encoding="utf-8"))
    kind = meta.get("kind", "listed")
    done = _finished_index(kind)
    suggestions: list[dict] = []

    if kind == "listed":
        own = (meta.get("ticker") or "").upper()
        for item in (a.get("financials") or {}).get("peers") or []:
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
            name, ticker = str(item[0]), str(item[1]).upper()
            if ticker == own:
                continue
            existing = done.get(ticker)
            suggestions.append(
                {
                    "kind": "listed", "name": name, "ticker": ticker, "url": None,
                    "reason": "Sector peer", "runId": existing["id"] if existing else None,
                }
            )
    else:
        research = a.get("research") or {}
        sector = research.get("sector")
        cached = unlisted_service.cached_directory()
        directory_ready = cached is not None
        directory = cached or []
        own_key = unlisted_service.normalise_name(meta["company"])
        if sector:
            for c in directory:
                if c.get("sector") != sector or unlisted_service.normalise_name(c["name"]) == own_key:
                    continue
                existing = done.get(unlisted_service.normalise_name(c["name"]))
                suggestions.append(
                    {
                        "kind": "unlisted", "name": c["name"], "ticker": None,
                        "url": f"https://unlistedzone.com/shares/{c['id']}",
                        "reason": f"Same sector: {sector}", "runId": existing["id"] if existing else None,
                    }
                )
        # Companies already analysed come first, then by name
        suggestions.sort(key=lambda s: (s["runId"] is None, s["name"]))
        suggestions = suggestions[:12]

    if kind == "unlisted":
        sector_label = (a.get("research") or {}).get("sector")
    else:
        sector_label = (a.get("relative_valuation_multiples") or {}).get("sector_name")
        if sector_label and str(sector_label).lower().startswith("median of"):
            sector_label = None  # a description of how the peers were taken, not a sector
    ready = True if kind == "listed" else directory_ready
    return {"kind": kind, "sector": sector_label, "ready": ready, "suggestions": suggestions}


@router.get("/runs/{run_id}/report", response_class=HTMLResponse)
def get_report(run_id: str):
    path = svc.artefact(run_id, "report.html")
    if path is None:
        raise HTTPException(404, "Report not found")
    return HTMLResponse(path.read_text(encoding="utf-8"))


@router.get("/runs/{run_id}/download/{name}")
def download(run_id: str, name: str):
    path = svc.artefact(run_id, name)
    if path is None:
        raise HTTPException(404, "File not found")
    meta = svc.read_meta(run_id) or {}
    stem = "".join(c if c.isalnum() else "_" for c in (meta.get("company") or run_id)).strip("_")
    return FileResponse(path, filename=f"{stem}_{path.name}")
