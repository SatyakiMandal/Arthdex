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
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

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
        "origin": "run",
        "createdAt": _now(),
    }
    _write_meta(meta)
    threading.Thread(target=_worker, args=(run_id,), name=f"analyzer-{run_id}", daemon=True).start()
    return _public(meta)


def _command(meta: dict[str, Any], d: Path) -> list[str]:
    common = [
        "--company", meta["company"],
        "--start", meta["start"],
        "--end", meta["end"],
        "--out", str(d / "analysis.json"),
        "--html", str(d / "report.html"),
        "--xlsx", str(d / "model.xlsx"),
    ]
    if meta["kind"] == "unlisted":
        cmd = [sys.executable, "-u", "-m", "ceia.unlisted", *common]
        if meta.get("url"):
            cmd += ["--url", meta["url"]]
        return cmd
    return [
        sys.executable, "-u", "-m", "ceia.analyze", *common,
        "--ticker", meta["ticker"],
        "--benchmark", "^NSEI",
    ]


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
        produced = (d / "analysis.json").exists() and (d / "report.html").exists()
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

    verdict = None
    if v:
        verdict = {
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
    }


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
