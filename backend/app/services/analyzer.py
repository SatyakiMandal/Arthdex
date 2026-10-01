"""
Event-impact analyzer: runs the vendored CEIA engine as a subprocess per job.

Why a subprocess and not a thread: a run loads FinBERT / GoEmotions through
torch, scrapes for minutes, and mutates global logging state. Isolating it keeps
the API process light, lets a hung run be killed, and means its stdout *is* the
progress feed — the same output the CLI prints.

Every run owns a directory under ``analyzer_data/runs/<id>/`` holding ``meta.json``,
``run.log``, ``analysis.json``, ``report.html`` and ``model.xlsx``. Nothing lives
only in memory, so a restart loses no finished report.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import sys
import threading
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from app.services.analyzer_detail import detail_listed

log = logging.getLogger("arthdex.analyzer")

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "analyzer_data"
RUNS_DIR = DATA_DIR / "runs"
SAMPLES_DIR = BACKEND_DIR / "analyzer_samples"

# Runs are CPU/RAM heavy (torch models); more than two at once thrashes.
MAX_CONCURRENT = int(os.getenv("ARTHDEX_ANALYZER_CONCURRENCY", "2"))
RUN_TIMEOUT_SECONDS = int(os.getenv("ARTHDEX_ANALYZER_TIMEOUT", str(90 * 60)))
LOG_TAIL_LINES = 400

_SLOTS = threading.BoundedSemaphore(MAX_CONCURRENT)
_LOCK = threading.Lock()
_PROCS: dict[str, subprocess.Popen] = {}

ID_RE = re.compile(r"^[A-Za-z0-9_-]{4,64}$")

# (needle in log line, human stage label) — checked newest line first.
STAGES: list[tuple[str, str]] = [
    ("Excel", "Exporting workbook"),
    ("wrote ", "Writing report"),
    ("GoEmotions", "Scoring emotion"),
    ("FinBERT", "Scoring sentiment"),
    ("volatility", "Fitting volatility models"),
    ("GARCH", "Fitting volatility models"),
    ("price", "Fetching prices"),
    ("yfinance", "Fetching prices"),
    ("sitemap", "Discovering news"),
    ("fetch", "Ingesting news"),
    ("ingest", "Ingesting news"),
    ("news", "Ingesting news"),
]


# ── metadata ────────────────────────────────────────────────────────────────


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_dir(run_id: str) -> Path:
    if not ID_RE.match(run_id):
        raise ValueError("bad run id")
    return RUNS_DIR / run_id


def _write_meta(meta: dict[str, Any]) -> None:
    path = run_dir(meta["id"]) / "meta.json"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    tmp.replace(path)


def read_meta(run_id: str) -> dict[str, Any] | None:
    try:
        path = run_dir(run_id) / "meta.json"
    except ValueError:
        return None
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _update(run_id: str, **fields: Any) -> dict[str, Any]:
    with _LOCK:
        meta = read_meta(run_id) or {"id": run_id}
        meta.update(fields)
        _write_meta(meta)
        return meta


def list_runs(limit: int = 50, origin: str | None = None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not RUNS_DIR.exists():
        return out
    for child in RUNS_DIR.iterdir():
        meta = read_meta(child.name) if child.is_dir() else None
        if meta and (origin is None or meta.get("origin") == origin):
            out.append(_public(meta))
    out.sort(key=lambda m: m.get("createdAt", ""), reverse=True)
    return out[:limit]


SNAPSHOT_TTL_SECONDS = 12 * 3600
SNAPSHOT_RETRY_SECONDS = 600


def _age_seconds(iso: str | None) -> float:
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(iso)).total_seconds() if iso else 1e12
    except ValueError:
        return 1e12


def snapshot_for(ticker: str) -> dict[str, Any] | None:
    """Newest snapshot run for a ticker, in any state."""
    runs = [m for m in list_runs(limit=10_000, origin="snapshot") if m.get("ticker") == ticker]
    return runs[0] if runs else None


def ensure_snapshot(symbol: str, company: str) -> dict[str, Any]:
    """Return the current snapshot for a listed company, starting one if needed.

    A completed snapshot is reused for SNAPSHOT_TTL_SECONDS (prices move daily, the
    models do not need re-fitting on every page view); a failure is not retried for
    a few minutes so a bad ticker cannot hammer the upstream price providers.
    """
    ticker = _ticker_for(symbol)
    current = snapshot_for(ticker)
    if current:
        st = current["status"]
        if st in ("QUEUED", "RUNNING"):
            return current
        age = _age_seconds(current.get("finishedAt") or current.get("createdAt"))
        if st == "COMPLETED" and age < SNAPSHOT_TTL_SECONDS:
            return current
        if st in ("FAILED", "CANCELLED") and age < SNAPSHOT_RETRY_SECONDS:
            return current
    end = date.today()
    fresh = submit(
        kind="listed", company=company, ticker=ticker,
        start=end - timedelta(days=365), end=end, snapshot=True,
    )
    # Superseded snapshots are pure cache; drop them so they do not accumulate
    if current and current["status"] in ("COMPLETED", "FAILED", "CANCELLED"):
        delete_run(current["id"], allow_snapshot=True)
    return fresh


def delete_run(run_id: str, allow_snapshot: bool = False) -> str:
    """Remove one run's own folder (meta, log, report, workbook, analysis.json).

    Returns "deleted", "missing", "active" or "sample". The per-company news
    cache lives under DATA_DIR/data/news_cache and is deliberately left alone:
    it is shared by every run for that company.
    """
    with _LOCK:
        meta = read_meta(run_id)
        if meta is None:
            return "missing"
        if meta.get("origin") == "sample" or (meta.get("origin") == "snapshot" and not allow_snapshot):
            return "sample"
        if meta.get("status") in ("QUEUED", "RUNNING"):
            return "active"
        shutil.rmtree(run_dir(run_id), ignore_errors=True)
    return "deleted"


def clear_unsuccessful() -> int:
    """Delete every user-started run that failed or was cancelled."""
    n = 0
    for m in list_runs(limit=10_000, origin="run"):
        if m["status"] in ("FAILED", "CANCELLED") and delete_run(m["id"]) == "deleted":
            n += 1
    return n


def _public(meta: dict[str, Any]) -> dict[str, Any]:
    d = run_dir(meta["id"])
    return {
        "id": meta["id"],
        "kind": meta.get("kind", "listed"),
        "company": meta.get("company", ""),
        "ticker": meta.get("ticker") or None,
        "start": meta.get("start"),
        "end": meta.get("end"),
        "status": meta.get("status", "FAILED"),
        "stage": meta.get("stage"),
        "error": meta.get("error"),
        "origin": meta.get("origin", "run"),
        "createdAt": meta.get("createdAt"),
        "startedAt": meta.get("startedAt"),
        "finishedAt": meta.get("finishedAt"),
        "hasReport": (d / "report.html").exists(),
        "hasWorkbook": (d / "model.xlsx").exists(),
    }


# ── lifecycle ───────────────────────────────────────────────────────────────


def recover_interrupted() -> None:
    """Mark runs that were live when the service last died as failed."""
    for m in list_runs(limit=500):
        if m["status"] in ("QUEUED", "RUNNING") and m["id"] not in _PROCS:
            _update(
                m["id"],
                status="FAILED",
                error="Interrupted: the service restarted while this run was in progress.",
                finishedAt=_now(),
            )


def _ticker_for(symbol: str) -> str:
    s = symbol.strip().upper()
    return s if s.endswith((".NS", ".BO")) or s.startswith("^") else f"{s}.NS"


def submit(
    *,
    kind: str,
    company: str,
    start: date,
    end: date,
    ticker: str | None = None,
    url: str | None = None,
    snapshot: bool = False,
) -> dict[str, Any]:
    run_id = uuid.uuid4().hex[:16]
    d = run_dir(run_id)
    d.mkdir(parents=True, exist_ok=True)
    meta = {
        "id": run_id,
        "kind": kind,
        "company": company.strip(),
        "ticker": _ticker_for(ticker) if (kind == "listed" and ticker) else None,
        "url": url,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "status": "QUEUED",
        "stage": "Queued",
        "origin": "snapshot" if snapshot else "run",
        # Snapshots skip news scraping entirely: every fundamental, technical,
        # statistical and risk section is still computed from prices and filings.
        "noNews": snapshot,
        "createdAt": _now(),
    }
    _write_meta(meta)
    threading.Thread(target=_worker, args=(run_id,), name=f"analyzer-{run_id}", daemon=True).start()
    return _public(meta)


def _unlisted_context(meta: dict[str, Any], d: Path) -> Path | None:
    """Sector, the source's own ratios and live NSE index multiples, written for the engine.

    The engine runs as a subprocess without access to the service's caches, so the valuation
    inputs it cannot fetch itself (NSE index P/E and P/B) are prepared here. Anything that
    cannot be found is simply left out, and the engine skips the models that need it.
    """
    from ..cache import CACHE
    from ..config import SETTINGS
    from ..providers import nse
    from . import unlisted as unlisted_service
    from ceia.unlisted_research import sector_index

    slug = None
    if meta.get("url"):
        slug = str(meta["url"]).rstrip("/").rsplit("/", 1)[-1]
    else:
        directory = unlisted_service.cached_directory() or []
        key = unlisted_service.normalise_name(meta["company"])
        slug = next((c["id"] for c in directory if unlisted_service.normalise_name(c["name"]) == key), None)
    if not slug or not unlisted_service.SLUG_RE.match(slug):
        return None

    try:
        page, _age = CACHE.get_or_fetch(f"unlisted:{slug}", 3 * 3600, lambda: unlisted_service.build_company(slug))
    except Exception as exc:
        log.warning("unlisted context: page unavailable (%s)", exc)
        return None

    context: dict[str, Any] = {"sector": page.get("sector"), "facts": page.get("facts") or {}}
    try:
        indices, _ = CACHE.get_or_fetch("market:indices", SETTINGS.index_ttl, nse.fetch_indices)
        by_id = {i["id"]: i for i in indices}

        def view(i: dict[str, Any] | None) -> dict[str, Any] | None:
            if not i:
                return None
            return {"name": i["name"], "pe": i.get("peRatio"), "pb": i.get("pbRatio"), "dividendYield": i.get("dividendYieldPct")}

        idx = sector_index(page.get("sector"))
        context["benchmarks"] = {
            "sector": view(by_id.get(idx["nse_id"])) if idx else None,
            "broad": view(by_id.get("nifty-500") or by_id.get("nifty-50")),
        }
    except Exception as exc:
        log.warning("unlisted context: index multiples unavailable (%s)", exc)

    path = d / "context.json"
    path.write_text(json.dumps(context), encoding="utf-8")
    return path


def _command(meta: dict[str, Any], d: Path) -> list[str]:
    common = [
        "--company", meta["company"],
        "--start", meta["start"],
        "--end", meta["end"],
        "--out", str(d / "analysis.json"),
    ]
    # Snapshots feed the on-page dossier only; the HTML report and Excel model are
    # the slow, unused part of the run, so they are not built.
    common += ["--html", ""] if meta.get("noNews") else [
        "--html", str(d / "report.html"),
        "--xlsx", str(d / "model.xlsx"),
    ]
    if meta["kind"] == "unlisted":
        cmd = [sys.executable, "-u", "-m", "ceia.unlisted", *common]
        if meta.get("url"):
            cmd += ["--url", meta["url"]]
        try:
            ctx = _unlisted_context(meta, d)
        except Exception:
            log.exception("could not prepare the unlisted context")
            ctx = None
        if ctx:
            cmd += ["--context", str(ctx)]
        return cmd
    cmd = [
        sys.executable, "-u", "-m", "ceia.analyze", *common,
        "--ticker", meta["ticker"],
        "--benchmark", "^NSEI",
    ]
    if meta.get("noNews"):
        empty = d / "news.json"
        empty.write_text(json.dumps({"items": [], "company": meta["company"]}), encoding="utf-8")
        cmd += ["--news", str(empty)]
    return cmd


def _worker(run_id: str) -> None:
    with _SLOTS:
        meta = read_meta(run_id)
        if not meta or meta.get("status") == "CANCELLED":
            return
        d = run_dir(run_id)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        env = {
            **os.environ,
            "PYTHONUNBUFFERED": "1",
            "PYTHONIOENCODING": "utf-8",
            "PYTHONPATH": str(BACKEND_DIR) + os.pathsep + os.environ.get("PYTHONPATH", ""),
            # Don't let tokenizers fork-warn or oversubscribe cores.
            "TOKENIZERS_PARALLELISM": "false",
        }
        _update(run_id, status="RUNNING", stage="Checking ticker", startedAt=_now())
        logfile = d / "run.log"
        if meta["kind"] == "listed":
            problem = _preflight_prices(meta)
            if problem:
                logfile.write_text(problem + "\n", encoding="utf-8")
                _update(run_id, status="FAILED", stage="Failed", error=problem, finishedAt=_now())
                return
        _update(run_id, stage="Starting")
        try:
            with logfile.open("w", encoding="utf-8", errors="replace") as fh:
                proc = subprocess.Popen(
                    _command(meta, d),
                    cwd=str(DATA_DIR),
                    env=env,
                    stdout=fh,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.DEVNULL,
                )
                _PROCS[run_id] = proc
                try:
                    code = proc.wait(timeout=RUN_TIMEOUT_SECONDS)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    code = -9
                    fh.write("\n[arthdex] killed: exceeded the run time limit\n")
        except Exception as exc:  # spawn failure
            _update(run_id, status="FAILED", error=f"Could not start the engine: {exc}", finishedAt=_now())
            return
        finally:
            _PROCS.pop(run_id, None)

        current = read_meta(run_id) or {}
        if current.get("status") == "CANCELLED":
            return
        produced = (d / "analysis.json").exists() and (meta.get("noNews") or (d / "report.html").exists())
        if code == 0 and produced:
            _update(run_id, status="COMPLETED", stage="Done", finishedAt=_now(), error=None)
        else:
            _update(
                run_id,
                status="FAILED",
                stage="Failed",
                finishedAt=_now(),
                error=_failure_reason(logfile, code),
            )


def _preflight_prices(meta: dict[str, Any]) -> str | None:
    """Fail in seconds, not after a multi-minute news crawl, when a ticker has no prices.

    The engine ingests news before it touches prices, so a mistyped ticker would
    otherwise only surface at the very end.
    """
    from datetime import timedelta

    from ceia.prices import PriceError, load_prices

    end = date.fromisoformat(meta["end"])
    try:
        load_prices(meta["ticker"], end - timedelta(days=21), end)
    except PriceError as exc:
        return f"No price history found for {meta['ticker']}. Check the ticker. ({str(exc)[:240]})"
    except Exception as exc:  # network trouble is not a verdict on the ticker
        log.warning("price preflight inconclusive for %s: %s", meta["ticker"], exc)
    return None


def _failure_reason(logfile: Path, code: int) -> str:
    """Prefer the engine's own explanation over an exit code."""
    try:
        lines = [l.strip() for l in logfile.read_text(encoding="utf-8", errors="replace").splitlines() if l.strip()]
    except OSError:
        return f"The engine exited with code {code}."
    for needle in ("Price data unavailable", "Ticker lookup failed", "UnlistedZone lookup failed", "Error", "Traceback"):
        for line in reversed(lines):
            if needle.lower() in line.lower():
                return line[:400]
    return (lines[-1][:400] if lines else f"The engine exited with code {code}.")


def cancel(run_id: str) -> bool:
    meta = read_meta(run_id)
    if not meta or meta.get("status") not in ("QUEUED", "RUNNING"):
        return False
    _update(run_id, status="CANCELLED", stage="Cancelled", finishedAt=_now())
    proc = _PROCS.get(run_id)
    if proc and proc.poll() is None:
        proc.kill()
    return True


def status(run_id: str) -> dict[str, Any] | None:
    meta = read_meta(run_id)
    if not meta:
        return None
    pub = _public(meta)
    lines = log_tail(run_id)
    if meta.get("status") == "RUNNING":
        pub["stage"] = _stage_from_log(lines) or meta.get("stage")
    pub["log"] = lines
    if meta.get("status") == "RUNNING":
        pub["progress"] = progress_from_log(lines)
    return pub


def log_tail(run_id: str, n: int = LOG_TAIL_LINES) -> list[str]:
    try:
        path = run_dir(run_id) / "run.log"
        if not path.exists():
            return []
        with path.open("rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            fh.seek(max(0, size - 64_000))
            text = fh.read().decode("utf-8", errors="replace")
        return [l.rstrip() for l in text.splitlines() if l.strip()][-n:]
    except (OSError, ValueError):
        return []


# Pipeline steps shown to the user; the furthest one reached in the log is the current step.
# (label, needles in a log line that mean this step has started)
STEPS: list[tuple[str, tuple[str, ...]]] = [
    ("Finding news", ("ceia.discovery", "discovered ", "alias widening")),
    ("Reading articles", ("pre-filtered", "candidates,", "relevance kept", "unique after dedupe", "parsed ")),
    ("Scoring tone", ("ceia.sentiment", "ceia.emotion", "news cache:")),
    ("Market data", ("ceia.prices", "ceia.returns")),
    ("Running models", ("EVENT STUDY", "Distance to Default", "Institutional Scorecard", "HAR-RV", "Value at Risk", "ceia.garch", "ceia.valuation")),
    ("Writing the report", ("export_excel", "report.html", "analysis.json")),
]
_FRAC = re.compile(r"(\d+)\s*/\s*(\d+)")


def progress_from_log(lines: list[str]) -> dict[str, Any]:
    """Furthest pipeline step reached, with the fraction done inside it where the log says."""
    step = -1
    for line in lines:
        for i, (_, needles) in enumerate(STEPS):
            if i > step and any(n in line for n in needles):
                step = i
    if step < 0:
        return {"steps": [s[0] for s in STEPS], "step": 0, "fraction": 0.0, "detail": None}
    frac, detail = 0.0, None
    for line in reversed(lines):
        if step in (0, 1, 2) and ("days done" in line or "fetched" in line or "scored" in line):
            m = _FRAC.search(line)
            if m and int(m.group(2)):
                a, b = int(m.group(1)), int(m.group(2))
                frac = min(1.0, a / b)
                unit = "days of archives" if "days done" in line else "articles" if "fetched" in line else "texts"
                detail = f"{a} of {b} {unit}"
                break
    return {"steps": [s[0] for s in STEPS], "step": step, "fraction": round(frac, 3), "detail": detail}


def _stage_from_log(lines: list[str]) -> str | None:
    for line in reversed(lines[-25:]):
        low = line.lower()
        for needle, label in STAGES:
            if needle.lower() in low:
                return label
    return None


# ── artefacts ───────────────────────────────────────────────────────────────


def artefact(run_id: str, name: str) -> Path | None:
    if name not in ("report.html", "analysis.json", "model.xlsx"):
        return None
    try:
        path = run_dir(run_id) / name
    except ValueError:
        return None
    return path if path.exists() else None


# ── summary extraction ──────────────────────────────────────────────────────


def _g(obj: Any, *path: str, default: Any = None) -> Any:
    for key in path:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        else:
            return default
    return obj if obj is not None else default


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def summarise(run_id: str) -> dict[str, Any] | None:
    meta = read_meta(run_id)
    path = artefact(run_id, "analysis.json")
    if not meta or not path:
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    body = _summarise_unlisted(raw) if meta.get("kind") == "unlisted" else _summarise_listed(raw)
    return {"kind": meta.get("kind", "listed"), **body}


def _verdict_view(v: dict[str, Any] | None) -> dict[str, Any] | None:
    """The investment call in the shape the site renders, shared by listed and unlisted runs."""
    if not v:
        return None
    return {
        "call": v.get("actionable_call"),
        "conviction": _num(v.get("conviction_score")),
        "summary": v.get("one_line_summary"),
        "thesis": v.get("detailed_thesis"),
        "price": _num(v.get("current_price")),
        "entryLow": _num(v.get("entry_zone_low")),
        "entryHigh": _num(v.get("entry_zone_high")),
        "target1": _num(v.get("target_1_price")),
        "target1Pct": _num(v.get("target_1_upside_pct")),
        "target2": _num(v.get("target_2_price")),
        "target2Pct": _num(v.get("target_2_upside_pct")),
        "stop": _num(v.get("stop_loss_price")),
        "stopPct": _num(v.get("stop_loss_downside_pct")),
        "riskReward": v.get("risk_reward_ratio"),
        "asOf": v.get("as_of_date"),
        "pillars": [
            {
                "name": p.get("pillar_name"),
                "weight": _num(p.get("weight_pct")),
                "score": _num(p.get("score")),
                "stance": p.get("stance"),
                "highlight": p.get("metric_highlight"),
            }
            for p in (v.get("pillars") or [])
            if isinstance(p, dict)
        ],
    }


def _summarise_listed(a: dict[str, Any]) -> dict[str, Any]:
    v = a.get("investment_verdict") or {}
    fc = a.get("forecasting") or {}
    ta = a.get("technical_analysis") or {}
    fin = a.get("financials") or {}
    val = a.get("relative_valuation_multiples") or {}
    var = a.get("var") or {}
    dd = a.get("distance_to_default") or {}
    vol = a.get("volatility_models") or {}
    regime = a.get("regime") or {}
    bt = a.get("backtesting") or {}
    pr = a.get("prices") or {}
    news = a.get("news") or {}

    verdict = _verdict_view(v)

    incidents = []
    for i in (a.get("incidents") or [])[:8]:
        incidents.append(
            {
                "day": i.get("day"),
                "abnormalReturn": _num(i.get("abnormal_return")),
                "z": _num(i.get("abnormal_return_z")),
                "coverageZ": _num(i.get("coverage_z")),
                "items": i.get("item_count"),
                "sentiment": _num(i.get("mean_sentiment")),
                "event": i.get("dominant_event"),
                "emotion": i.get("dominant_emotion"),
            }
        )

    horizons = []
    for h, block in sorted((fc.get("conformal_coverage") or {}).items(), key=lambda kv: int(kv[0])):
        if isinstance(block, dict):
            horizons.append(
                {
                    "days": int(h),
                    "p10": _num(block.get("p10_return_pct")),
                    "p50": _num(block.get("p50_return_pct")),
                    "p90": _num(block.get("p90_return_pct")),
                }
            )

    def _var(key: str) -> dict[str, float | None]:
        b = var.get(key) or {}
        return {k: _num(b.get(k)) for k in ("historical", "parametric", "cornish_fisher", "monte_carlo")}

    return {
        "company": a.get("company"),
        "ticker": a.get("ticker"),
        "benchmark": a.get("benchmark"),
        "start": a.get("start"),
        "end": a.get("end"),
        "verdict": verdict,
        "market": {
            "alpha": _num(pr.get("alpha")),
            "beta": _num(pr.get("beta")),
            "rSquared": _num(pr.get("r_squared")),
            "model": pr.get("model"),
            "tradingDays": pr.get("trading_days_in_window"),
        },
        "news": {
            "items": _g(news, "stats", "unique_after_dedupe"),
            "duplicates": _g(news, "stats", "duplicates"),
            "paywalled": _g(news, "stats", "paywalled"),
            "sentimentReturnR": _num(_g(a, "sentiment_return_correlation", "r")),
            "sentimentReturnN": _g(a, "sentiment_return_correlation", "n"),
        },
        "incidents": incidents,
        "incidentCount": len(a.get("incidents") or []),
        "forecast": {
            "bias": fc.get("overall_directional_bias"),
            "confidence": fc.get("confidence_tier"),
            "annualisedVol": _num(fc.get("annualized_volatility")),
            "horizons": horizons,
            "inferences": [s for s in (fc.get("key_inferences") or []) if isinstance(s, str)][:5],
        },
        "risk": {
            "var1d95": _var("var_1d_95"),
            "var1d99": _var("var_1d_99"),
            "annualisedVol": _num(var.get("annualized_volatility")),
            "consensusVol": _num(vol.get("consensus_annualized_vol")),
            "recommendedVolModel": vol.get("recommended_model"),
            "distanceToDefault": _num(dd.get("distance_to_default")),
            "defaultProbabilityPct": _num(dd.get("default_probability_pct")),
            "regime": regime.get("current_regime"),
            "regimeProbability": _num(regime.get("current_regime_probability")),
            "regimeGuidance": regime.get("risk_regime_guidance"),
        },
        "technical": {
            "rating": ta.get("composite_rating"),
            "score": _num(ta.get("composite_score")),
            "rsi": _num(_g(ta, "rsi", "rsi_14")),
            "adx": _num(_g(ta, "adx", "adx_14")),
            "macd": _g(ta, "macd", "crossover_signal"),
            "trend": _g(ta, "moving_averages", "golden_cross_status"),
            "verdict": ta.get("summary_verdict"),
        },
        "fundamental": {
            "unit": fin.get("currency_unit"),
            "asOf": fin.get("as_of"),
            "revenue": _num(_g(fin, "revenue", "latest")),
            "revenueYoY": _num(_g(fin, "revenue", "yoy_change")),
            "netProfit": _num(_g(fin, "net_profit", "latest")),
            "netProfitYoY": _num(_g(fin, "net_profit", "yoy_change")),
            "pe": _num(val.get("pe_ratio")),
            "pb": _num(val.get("pb_ratio")),
            "evEbitda": _num(val.get("ev_to_ebitda")),
            "valuationRating": val.get("overall_valuation_rating"),
            "valuationStance": val.get("relative_valuation_stance"),
        },
        "backtest": {
            "events": _g(bt, "event_backtest", "total_events_tested"),
            "winRatePct": _num(_g(bt, "event_backtest", "win_rate_pct")),
            "profitFactor": _num(_g(bt, "event_backtest", "profit_factor")),
            "conformalCoveragePct": _num(_g(bt, "conformal_backtest", "observed_coverage_pct")),
        },
        "caveats": [c for c in (a.get("caveats") or []) if isinstance(c, str)][:6],
        "detail": detail_listed(a),
    }


def _summarise_unlisted(a: dict[str, Any]) -> dict[str, Any]:
    series = a.get("series") or []
    prices = [p for p in series if isinstance(p, dict) and _num(p.get("close")) is not None]
    first = prices[0] if prices else None
    last = prices[-1] if prices else None
    moves = [m for m in (a.get("moves") or []) if isinstance(m, dict)]
    ranked = sorted(moves, key=lambda m: abs(_num(m.get("change")) or 0), reverse=True)[:8]
    news = a.get("news") or {}
    change = None
    if first and last and first["close"]:
        change = (last["close"] / first["close"] - 1) * 100
    return {
        "company": a.get("company"),
        "ticker": None,
        "start": a.get("start"),
        "end": a.get("end"),
        "url": a.get("url"),
        "price": {
            "first": _num(first["close"]) if first else None,
            "firstDate": first.get("date") if first else None,
            "last": _num(last["close"]) if last else None,
            "lastDate": last.get("date") if last else None,
            "changePct": change,
            "high": max((p["close"] for p in prices), default=None),
            "low": min((p["close"] for p in prices), default=None),
            "observations": len(prices),
        },
        "moves": [
            {
                "from": m.get("start_date"),
                "to": m.get("end_date"),
                "startPrice": _num(m.get("start_price")),
                "endPrice": _num(m.get("end_price")),
                "changePct": (_num(m.get("change")) or 0) * 100,
                "headlines": [
                    {"source": h.get("source"), "headline": h.get("headline"), "url": h.get("url")}
                    for h in (m.get("headlines") or [])[:3]
                    if isinstance(h, dict)
                ],
            }
            for m in ranked
        ],
        "moveCount": len(moves),
        "news": {
            "items": _g(news, "stats", "unique_after_dedupe"),
            "perSource": news.get("per_source") or {},
        },
        "verdict": _verdict_view(a.get("investment_verdict")),
        "research": _unlisted_research_view(a),
        "researchNote": (a.get("research") or {}).get("note") if a.get("research") and not (a.get("research") or {}).get("available") else None,
        "macro": _slim(a.get("macro")),
    }


def _slim(obj: Any) -> Any:
    from .analyzer_detail import slim

    return slim(obj) if obj is not None else None


def _unlisted_research_view(a: dict[str, Any]) -> dict[str, Any] | None:
    """Valuation, risk, technicals and the call's execution detail, for the unlisted dossier."""
    r = a.get("research")
    if not r or not r.get("available"):
        return None
    v = a.get("investment_verdict") or {}
    keys = ("sector", "sector_index", "facts", "price_profile", "risk", "market_model", "technical", "forecast", "valuation", "news_signal", "data_quality")
    out = {k: _slim(r.get(k)) for k in keys}
    out["sizing"] = {
        "tiers": _slim(v.get("sizing_tiers") or []),
        "prescribed_pct": _num(v.get("prescribed_allocation_pct")),
        "raw_kelly_pct": _num(v.get("raw_kelly_pct")),
        "half_kelly_pct": _num(v.get("half_kelly_pct")),
        "cap_pct": _num(v.get("maximum_allocation_cap_pct")),
    }
    out["holding"] = {
        "core": v.get("core_holding_period"),
        "tactical": v.get("tactical_holding_period"),
        "profit_booking": v.get("profit_booking_rules") or [],
        "invalidation": v.get("invalidation_rules") or [],
    }
    out["pillar_rationales"] = [p.get("evidence_rationale") for p in (v.get("pillars") or []) if isinstance(p, dict)]
    return out


# ── sample library ──────────────────────────────────────────────────────────


def seed_samples() -> None:
    """Expose bundled, previously generated reports as completed runs.

    Idempotent: a sample is copied once, then left alone. The bundled files are
    the CEIA tool's own output, unaltered.
    """
    if not SAMPLES_DIR.exists():
        return
    index = SAMPLES_DIR / "index.json"
    if not index.exists():
        return
    try:
        entries = json.loads(index.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    for e in entries:
        rid = e["id"]
        d = RUNS_DIR / rid
        if (d / "meta.json").exists():
            continue
        d.mkdir(parents=True, exist_ok=True)
        for name in ("analysis.json", "report.html"):
            src = SAMPLES_DIR / rid / name
            if src.exists():
                shutil.copyfile(src, d / name)
        _write_meta(
            {
                "id": rid,
                "kind": e["kind"],
                "company": e["company"],
                "ticker": e.get("ticker"),
                "start": e.get("start"),
                "end": e.get("end"),
                "status": "COMPLETED",
                "stage": "Done",
                "origin": "sample",
                "createdAt": e.get("generatedAt") or _now(),
                "finishedAt": e.get("generatedAt") or _now(),
            }
        )
