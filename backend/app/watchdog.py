"""
Feed watchdog: detects broken data feeds, tries to repair them, and records
whatever it could not fix.

Every feature on the site is only as good as the upstream behind it (NSE, Yahoo
Finance, press RSS, UnlistedZone), and those upstreams fail quietly: a cookie
expires, a page changes shape, an IP gets rate-limited, or the data service is
simply not running. This module probes one representative route per feed,
classifies what went wrong, walks a repair ladder, and keeps an incident log.

Repair ladder, in order, stopping at the first that works:
  1. retry after a short back-off            (transient timeouts, 5xx)
  2. expire the feed's cache entries         (a bad or empty value was cached)
  3. re-prime the NSE session                (NSE answers 401/403/HTML on stale cookies)
  4. give up and open an incident            (needs a code change or the upstream is down)

Incidents close themselves when the feed passes again. The log lives in
``app_data/feed_health.json``; ``scripts/feed-report.mjs`` reads it at the start of
every Claude Code session so open incidents are reported to the owner.

Run it by hand:  python -m app.watchdog            (from backend/)
                 python -m app.watchdog --json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

LOG = logging.getLogger("uvicorn.error")

STATE_PATH = Path(__file__).resolve().parent.parent / "app_data" / "feed_health.json"
HISTORY_LIMIT = 200  # resolved incidents kept for the record

Caller = Callable[[str, str], tuple[int, Any]]


# -- checks --------------------------------------------------------------------


def _list(min_len: int = 1) -> Callable[[Any], str | None]:
    def check(data: Any) -> str | None:
        if not isinstance(data, list):
            return f"expected a list, got {type(data).__name__}"
        return None if len(data) >= min_len else f"{len(data)} rows (expected at least {min_len})"

    return check


def _keys(**required: int) -> Callable[[Any], str | None]:
    """Each named key must be present; list-valued keys need at least the given number of rows."""

    def check(data: Any) -> str | None:
        if not isinstance(data, dict):
            return f"expected an object, got {type(data).__name__}"
        for key, min_len in required.items():
            if key not in data:
                return f"field '{key}' missing (upstream format may have changed)"
            value = data[key]
            if min_len and isinstance(value, list) and len(value) < min_len:
                return f"'{key}' has {len(value)} rows (expected at least {min_len})"
            if min_len and value in (None, "", {}):
                return f"'{key}' is empty"
        if data.get("errors"):
            return f"partial upstream failure: {str(data['errors'])[:160]}"
        return None

    return check


@dataclass(frozen=True)
class Check:
    feed: str  # human label, matches the /status page where one exists
    path: str
    validate: Callable[[Any], str | None]
    cache_prefixes: tuple[str, ...] = ()
    nse: bool = False  # NSE-backed: a session re-prime is worth trying
    critical: bool = True  # False: may be legitimately empty (holidays, quiet weeks)


CHECKS: tuple[Check, ...] = (
    Check("Indices and ticker", "/api/v1/market/indices", _list(5), ("indices",), nse=True),
    Check("Movers", "/api/v1/market/movers?direction=gainers&limit=10", _list(3), ("movers",), nse=True),
    Check("Market pulse", "/api/v1/market/pulse", _keys(stocks=40, sectors=5), ("market:traded", "constituents"), nse=True),
    Check("Global indices", "/api/v1/market/global", _list(3), ("global",)),
    Check("Commodities", "/api/v1/market/commodities", _keys(rows=3), ("commodities",)),
    Check("Company quotes", "/api/v1/company/RELIANCE/quote", _keys(cmp=1, asOf=1), ("quote",)),
    Check("Price candles", "/api/v1/company/RELIANCE/candles?period=1M", _keys(candles=5), ("candles",)),
    Check("Fundamentals", "/api/v1/company/RELIANCE/financials", _keys(quarterly=1, annual=1), ("financials", "fundamentals")),
    Check("Quant models", "/api/v1/company/RELIANCE/quant", _keys(volatility=1, forecasts=1), ("quant",)),
    Check("Shareholding", "/api/v1/company/RELIANCE/shareholding", _keys(pattern=1), ("shareholding",)),
    Check("News and filings", "/api/v1/news?limit=20", _keys(items=3), ("news",), nse=True),
    Check("IPO pipeline", "/api/v1/ipo", _keys(issues=1), ("ipo",), nse=True),
    Check("Listed universe", "/api/v1/search?q=tata", _list(1), ("universe",), nse=True),
    Check("Unlisted directory", "/api/v1/unlisted", _keys(companies=20), ("unlisted",)),
    Check("Deals", "/api/v1/deals", _keys(bulk=0, block=0), ("deals",), nse=True, critical=False),
    Check("Calendar", "/api/v1/calendar", _keys(meetings=0, actions=0), ("calendar",), nse=True, critical=False),
    Check("Bhavcopy", "/api/v1/bhavcopy", _keys(kpis=1, accumulation=1), ("bhavcopy",), nse=True),
    Check("Screener factors", "/api/v1/screener/factors", _keys(alpha=1), ("screener",)),
)


# -- callers -------------------------------------------------------------------


def asgi_caller() -> Caller:
    """Call the FastAPI app in-process, so checks work with or without a running server."""
    from .main import app

    def call(method: str, path: str) -> tuple[int, Any]:
        raw_path, _, query = path.partition("?")
        scope = {
            "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method,
            "scheme": "http", "path": raw_path, "raw_path": raw_path.encode(), "query_string": query.encode(),
            "headers": [(b"host", b"watchdog"), (b"accept", b"application/json")], "client": ("127.0.0.1", 0),
            "server": ("watchdog", 80), "root_path": "",
        }
        status = 0
        body = bytearray()

        async def receive() -> dict[str, Any]:
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message: dict[str, Any]) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            elif message["type"] == "http.response.body":
                body.extend(message.get("body", b""))

        asyncio.run(app(scope, receive, send))
        try:
            return status, json.loads(body or b"null")
        except ValueError:
            return status, {"detail": body[:200].decode(errors="replace")}

    return call


def http_caller(base: str, timeout: float = 120) -> Caller:
    def call(method: str, path: str) -> tuple[int, Any]:
        req = urllib.request.Request(base.rstrip("/") + path, method=method, data=b"" if method == "POST" else None)
        req.add_header("Accept", "application/json")
        token = os.environ.get("ARTHDEX_API_TOKEN")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read() or b"null")
        except urllib.error.HTTPError as err:
            try:
                return err.code, json.loads(err.read() or b"null")
            except ValueError:
                return err.code, None
        except (urllib.error.URLError, TimeoutError, ConnectionError) as err:
            return 0, {"detail": str(getattr(err, "reason", err))}

    return call


# -- diagnosis -----------------------------------------------------------------


@dataclass
class Result:
    feed: str
    path: str
    ok: bool
    critical: bool
    status: int = 0
    seconds: float = 0.0
    problem: str | None = None
    kind: str | None = None  # unreachable | blocked | timeout | upstream_error | empty | schema | degraded
    repaired_by: str | None = None
    attempts: list[str] = field(default_factory=list)


def _classify(status: int, body: Any, check: Check) -> tuple[str | None, str | None]:
    detail = body.get("detail") if isinstance(body, dict) else None
    if status == 0:
        return "unreachable", f"no response: {detail or 'connection failed'}"
    if status in (401, 403, 429):
        return "blocked", f"upstream refused the request (HTTP {status}): {detail or ''}".strip()
    if status in (408, 504):
        return "timeout", f"upstream timed out (HTTP {status})"
    if status >= 400:
        text = str(detail or "")
        if any(w in text.lower() for w in ("403", "forbidden", "captcha", "access denied", "rate")):
            return "blocked", f"HTTP {status}: {text[:200]}"
        return "upstream_error", f"HTTP {status}: {text[:200]}"
    data = body.get("data") if isinstance(body, dict) and "data" in body else body
    problem = check.validate(data)
    if problem is None:
        return None, None
    if problem.startswith(("field ", "expected a")):
        return "schema", problem
    if problem.startswith("partial"):
        return "degraded", problem
    return "empty", problem


def _probe(call: Caller, check: Check) -> tuple[int, Any, float]:
    started = time.monotonic()
    try:
        status, body = call("GET", check.path)
    except Exception as err:  # an exception inside the route is itself a finding
        status, body = 500, {"detail": f"{type(err).__name__}: {err}"}
    return status, body, time.monotonic() - started


def _expire(prefixes: tuple[str, ...]) -> int:
    from .cache import CACHE

    expired = 0
    for key in list(CACHE.stats()):
        if any(key.startswith(p) for p in prefixes):
            CACHE.expire(key)
            expired += 1
    return expired


def _reprime_nse() -> None:
    from .providers import nse

    nse._get_session(force_new=True)


def run_check(call: Caller, check: Check, in_process: bool) -> Result:
    status, body, secs = _probe(call, check)
    kind, problem = _classify(status, body, check)
    result = Result(check.feed, check.path, ok=kind is None, critical=check.critical, status=status, seconds=round(secs, 1))
    if result.ok:
        return result

    # Nothing in this process can fix a server that is not running.
    if kind == "unreachable" and not in_process:
        result.kind, result.problem = kind, problem
        return result

    ladder: list[tuple[str, Callable[[], None]]] = [("retry after back-off", lambda: time.sleep(3))]
    if in_process and check.cache_prefixes:
        ladder.append(("expired cached entries", lambda: (_expire(check.cache_prefixes), None)[1]))
    if in_process and check.nse:
        ladder.append(("re-primed NSE session", lambda: (_reprime_nse(), _expire(check.cache_prefixes))[0]))

    for label, action in ladder:
        try:
            action()
        except Exception as err:
            result.attempts.append(f"{label} failed: {err}")
            continue
        result.attempts.append(label)
        status, body, secs = _probe(call, check)
        kind2, problem2 = _classify(status, body, check)
        if kind2 is None:
            result.ok, result.status, result.seconds, result.repaired_by = True, status, round(secs, 1), label
            return result
        kind, problem = kind2, problem2

    result.status, result.kind, result.problem = status, kind, problem
    return result


# -- incidents -----------------------------------------------------------------

_ADVICE = {
    "unreachable": "The data service is not running. Start it with `npm run dev` (starts both) or see backend/README.md.",
    "blocked": "The upstream is refusing this machine (cookies, rate limit or IP block). Usually clears within the hour; if it persists the provider needs new headers or a different endpoint.",
    "timeout": "The upstream is slow or down. Usually transient.",
    "upstream_error": "The route raised an error. Read the detail; this often needs a code fix.",
    "empty": "The upstream answered but returned no rows. Check whether it is a market holiday; otherwise the page or API may have changed.",
    "schema": "The upstream's response format changed. Needs a code fix in the provider.",
    "degraded": "One of several sources behind this feed failed; the rest are still served.",
    "mismatch": "The same figure disagrees between two sources or tabs. Run `python -m app.reconcile` in backend/ for the detail; the fix is in a provider or a label, not a retry.",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_state() -> dict[str, Any]:
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"lastRun": None, "results": [], "open": {}, "resolved": []}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(STATE_PATH)


def record(results: list[Result], mode: str) -> dict[str, Any]:
    state = load_state()
    now = _now()
    open_: dict[str, Any] = state.get("open", {})
    resolved: list[Any] = state.get("resolved", [])

    # Any run that reached the routes proves the service itself is up again.
    if "server down" not in mode and "Data service" in open_:
        inc = open_.pop("Data service")
        inc.update(resolvedAt=now, resolvedBy="service answering")
        resolved.append(inc)

    for r in results:
        if r.ok:
            if r.feed in open_:
                inc = open_.pop(r.feed)
                inc.update(resolvedAt=now, resolvedBy=r.repaired_by or "passed on re-check")
                resolved.append(inc)
            continue
        inc = open_.get(r.feed) or {"feed": r.feed, "firstSeen": now, "occurrences": 0}
        inc.update(
            path=r.path, kind=r.kind, problem=r.problem, status=r.status, critical=r.critical,
            advice=_ADVICE.get(r.kind or "", ""), lastSeen=now, occurrences=inc["occurrences"] + 1,
            repairsTried=r.attempts,
        )
        open_[r.feed] = inc

    state.update(
        lastRun=now, mode=mode, open=open_, resolved=resolved[-HISTORY_LIMIT:],
        results=[r.__dict__ for r in results],
        summary={
            "checked": len(results),
            "passing": sum(r.ok for r in results),
            "repaired": sum(bool(r.repaired_by) for r in results),
            "failing": sum(not r.ok for r in results),
        },
    )
    _save_state(state)
    return state


_RUN_LOCK = threading.Lock()


def run_all(call: Caller | None = None, in_process: bool = True, mode: str = "in-process") -> dict[str, Any]:
    """Probe every feed, repair what can be repaired, record the rest."""
    with _RUN_LOCK:
        call = call or asgi_caller()
        results = [run_check(call, c, in_process) for c in CHECKS]
        state = record(results, mode)
    failing = [r for r in results if not r.ok]
    for r in results:
        if r.repaired_by:
            LOG.info("Watchdog: %s repaired (%s)", r.feed, r.repaired_by)
    for r in failing:
        LOG.warning("Watchdog: %s failing [%s] %s", r.feed, r.kind, r.problem)
    return state


# -- figure reconciliation ------------------------------------------------------

# Large caps that between them cover a rupee filer, a dollar filer, a bank and a
# conglomerate: enough to catch a provider regression without loading the upstreams.
RECONCILE_SYMBOLS = ("TCS", "INFY", "HDFCBANK", "RELIANCE")
RECONCILE_EVERY_HOURS = 24


def reconcile_figures(base: str | None = None) -> dict[str, Any]:
    """
    Cross-check figures that reach the site by more than one route (see app.reconcile)
    and keep one incident per failing check, so a wrong number reaches the owner the
    same way a dead feed does.
    """
    from . import reconcile

    base = base or os.environ.get("ARTHDEX_SELF_URL") or f"http://127.0.0.1:{os.environ.get('PORT', '8000')}"
    results = reconcile.reconcile_market(base) + [r for sym in RECONCILE_SYMBOLS for r in reconcile.reconcile(sym, base)]
    failing: dict[str, list[str]] = {}
    for r in results:
        # A dead endpoint is the feed checks' business, not a figure mismatch
        if r.status == "fail" and not r.check.startswith("endpoint."):
            failing.setdefault(f"Figures: {r.check}", []).append(f"{r.symbol}: {r.detail}")

    with _RUN_LOCK:
        state = load_state()
        now = _now()
        open_: dict[str, Any] = state.setdefault("open", {})
        resolved: list[Any] = state.setdefault("resolved", [])
        for name in [k for k in open_ if k.startswith("Figures: ") and k not in failing]:
            inc = open_.pop(name)
            inc.update(resolvedAt=now, resolvedBy="figures agree again")
            resolved.append(inc)
        for name, details in failing.items():
            inc = open_.get(name) or {"feed": name, "firstSeen": now, "occurrences": 0}
            inc.update(
                path="python -m app.reconcile", kind="mismatch", problem="; ".join(details[:3]), status=None,
                critical=False, advice=_ADVICE["mismatch"], lastSeen=now, occurrences=inc["occurrences"] + 1, repairsTried=[],
            )
            open_[name] = inc
        state.update(
            open=open_, resolved=resolved[-HISTORY_LIMIT:], lastReconcile=now,
            reconcileSummary={"checked": len(results), "failing": sum(len(v) for v in failing.values())},
        )
        _save_state(state)
    for name, details in failing.items():
        LOG.warning("Watchdog: %s disagree: %s", name, details[0])
    return state


def _reconcile_due(state: dict[str, Any]) -> bool:
    last = state.get("lastReconcile")
    if not last:
        return True
    return (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() > RECONCILE_EVERY_HOURS * 3600


# -- background loop -------------------------------------------------------------


def start_background(interval_minutes: float | None = None) -> None:
    """Run the watchdog inside the data service on a timer. ARTHDEX_WATCHDOG_MINUTES=0 turns it off."""
    minutes = interval_minutes if interval_minutes is not None else float(os.environ.get("ARTHDEX_WATCHDOG_MINUTES", "30"))
    if minutes <= 0:
        return

    def loop() -> None:
        time.sleep(90)  # let start-up warm-ups (unlisted directory, universe) finish first
        while True:
            try:
                state = run_all(mode="background")
                if _reconcile_due(state):
                    reconcile_figures()
            except Exception:
                LOG.exception("Watchdog run failed")
            time.sleep(minutes * 60)

    threading.Thread(target=loop, name="feed-watchdog", daemon=True).start()


# -- command line ----------------------------------------------------------------


def _print_report(state: dict[str, Any]) -> None:
    s = state.get("summary", {})
    print(f"Feed watchdog ({state.get('mode')}), {state.get('lastRun')}")
    print(f"  {s.get('passing', 0)}/{s.get('checked', 0)} feeds passing, {s.get('repaired', 0)} repaired, {s.get('failing', 0)} failing")
    for r in state.get("results", []):
        mark = "ok " if r["ok"] else "FAIL"
        extra = f" (repaired: {r['repaired_by']})" if r.get("repaired_by") else (f" [{r['kind']}] {r['problem']}" if not r["ok"] else "")
        print(f"  {mark} {r['feed']:<22} {r['seconds']:>5}s{extra}")
    for inc in state.get("open", {}).values():
        print(f"\n  OPEN since {inc['firstSeen']}: {inc['feed']} [{inc['kind']}]\n    {inc['problem']}\n    {inc['advice']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe, repair and log the Arthdex data feeds.")
    parser.add_argument("--server", default=os.environ.get("ARTHDEX_API_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--json", action="store_true", help="print the state file as JSON")
    args = parser.parse_args()

    # Prefer the running server, so repairs (cache, NSE session) land in the process the site uses.
    status, _ = http_caller(args.server, timeout=5)("GET", "/api/v1/health")
    if status == 200:
        status, body = http_caller(args.server, timeout=600)("POST", "/api/v1/health/feeds/run")
        state = body if status == 200 and isinstance(body, dict) else load_state()
    else:
        state = run_all(mode="cli, server down")
        state["open"]["Data service"] = {
            "feed": "Data service", "kind": "unreachable", "problem": f"nothing answering at {args.server}",
            "advice": _ADVICE["unreachable"], "firstSeen": _now(), "lastSeen": _now(), "critical": True,
            "occurrences": 1, "repairsTried": [],
        }
        _save_state(state)

    if args.json:
        print(json.dumps(state, indent=2))
    else:
        _print_report(state)
    raise SystemExit(1 if any(i.get("critical") for i in state.get("open", {}).values()) else 0)


if __name__ == "__main__":
    main()
