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
from .search import load_universe

router = APIRouter(prefix="/api/v1/analyzer", tags=["analyzer"])

MIN_SPAN_DAYS = 45
MAX_SPAN_DAYS = 800
UNLISTED_DIRECTORY_TTL = 6 * 3600


class RunRequest(BaseModel):
    kind: Literal["listed", "unlisted"]
    company: str = Field(min_length=2, max_length=120)
    ticker: str | None = Field(default=None, max_length=24, pattern=r"^[A-Za-z0-9&.\-^]+$")
    url: str | None = Field(default=None, max_length=300, pattern=r"^https://unlistedzone\.com/shares/[A-Za-z0-9\-_/]+$")
    start: date
    end: date


def _unlisted_directory() -> list[tuple[str, str]]:
    from ceia.fetcher import Fetcher
    from ceia.unlisted import _fetch_directory

    def fetch():
        svc.DATA_DIR.mkdir(parents=True, exist_ok=True)
        return _fetch_directory(Fetcher(cache_dir=str(svc.DATA_DIR / "cache")))

    data, _age = CACHE.get_or_fetch("analyzer:unlisted-directory", UNLISTED_DIRECTORY_TTL, fetch)
    return data


@router.get("/search")
def search(q: str = Query("", max_length=60), kind: Literal["listed", "unlisted"] = "listed", limit: int = Query(10, ge=1, le=25)):
    """Autocomplete for the analyzer: NSE equities, or UnlistedZone's directory."""
    query = q.strip()
    if not query:
        return {"kind": kind, "results": []}

    if kind == "listed":
        try:
            rows, _ = load_universe()
        except Exception as exc:
            raise HTTPException(503, f"Listed universe unavailable: {exc}") from exc
        hits = universe_provider.search(rows, query, limit)
        return {
            "kind": kind,
            "results": [
                {"name": h["name"], "ticker": f"{h['symbol']}.NS", "symbol": h["symbol"], "url": None}
                for h in hits
            ],
        }

    try:
        directory = _unlisted_directory()
    except Exception as exc:
        raise HTTPException(503, f"UnlistedZone directory unavailable: {exc}") from exc
    needle = query.lower()
    scored = []
    for name, url in directory:
        low = name.lower()
        if needle in low:
            scored.append((0 if low.startswith(needle) else 1, len(name), name, url))
    scored.sort()
    return {
        "kind": kind,
        "results": [{"name": n, "ticker": None, "symbol": None, "url": u} for _, _, n, u in scored[:limit]],
    }


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
