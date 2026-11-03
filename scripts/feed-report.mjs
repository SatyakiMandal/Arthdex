/**
 * Feed-health briefing for Claude Code, run by the SessionStart hook in
 * .claude/settings.json. Whatever it prints is added to Claude's context, so open
 * data-feed incidents are raised with the owner at the start of every session.
 *
 * It reads the watchdog's log (backend/app_data/feed_health.json) and checks that
 * the data service answers. It never runs the probes itself: those take up to a
 * minute and the hook must stay quick. When the data service is up and the last
 * run is old, it asks the service to run one in the background for next time.
 * Prints nothing when everything is healthy.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";
const STALE_HOURS = 6;

let state = null;
try {
  state = JSON.parse(readFileSync(join(root, "backend", "app_data", "feed_health.json"), "utf8"));
} catch {
  // no run recorded yet
}

let serviceUp = false;
try {
  serviceUp = (await fetch(`${API}/api/v1/health`, { signal: AbortSignal.timeout(1500) })).ok;
} catch {}

const ageHours = state?.lastRun ? (Date.now() - Date.parse(state.lastRun)) / 3_600_000 : Infinity;
if (serviceUp && ageHours > STALE_HOURS) {
  // Fire and forget; the result lands in the log for the next session.
  fetch(`${API}/api/v1/health/feeds/run`, { method: "POST" }).catch(() => {});
  await new Promise((r) => setTimeout(r, 200));
}

const open = Object.values(state?.open ?? {}).filter((i) => i.feed !== "Data service" || !serviceUp);
if (!open.length) process.exit(0);

const lines = [
  "ARTHDEX FEED WATCHDOG: open data-feed incidents. Tell the owner about these at the start of your reply,",
  "then offer to investigate and fix them (provider code is in backend/app/providers and backend/app/services;",
  "re-check with `cd backend && .venv/Scripts/python -m app.watchdog`).",
  `Last watchdog run: ${state.lastRun ?? "never"}${Number.isFinite(ageHours) ? ` (${ageHours.toFixed(1)} h ago)` : ""}. Data service ${serviceUp ? "is running" : "is NOT running"}.`,
];
for (const i of open) {
  lines.push(
    `- ${i.feed}${i.critical === false ? " (non-critical)" : ""} [${i.kind}] since ${i.firstSeen}, seen ${i.occurrences}x: ${i.problem}`,
    `  route ${i.path ?? "n/a"}; repairs tried: ${(i.repairsTried ?? []).join(", ") || "none"}; advice: ${i.advice}`,
  );
}
console.log(lines.join("\n"));
