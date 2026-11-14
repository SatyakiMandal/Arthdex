"use server";

import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";

import { backendHeaders } from "@/lib/api/auth";
import { isValidSymbol, rateLimitKey } from "@/lib/api/request-guards";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

/** The cache scopes the refresh control may expire; see scopeFor() in refresh-control.tsx. */
const ALLOWED_PREFIXES = new Set(["market:", "screener:factor", "market:commodities", "news:", "ipo:", "bhav", "screener:"]);
const PATH_RE = /^\/(?!\/)[A-Za-z0-9/_\-%&.]{0,200}$/;

/**
 * Expire the backend's cache for a page, then drop Next's cached copy of the page's data.
 *
 * A Server Action is a public POST endpoint, so the arguments are treated as untrusted:
 * only known cache scopes, a ticker-shaped symbol and a site-relative path are accepted,
 * and each caller is limited to a few refreshes a minute.
 */
export async function refreshData(path: string, prefixes: string[], symbol: string | null): Promise<{ ok: boolean; expired: number }> {
  const safePath = typeof path === "string" && PATH_RE.test(path) ? path : null;
  const prefixList = Array.isArray(prefixes) ? prefixes : [];
  const safePrefixes = prefixList.filter((p) => typeof p === "string" && ALLOWED_PREFIXES.has(p));
  const safeSymbol = isValidSymbol(symbol) ? symbol.toUpperCase() : null;
  if (!safePath || safePrefixes.length !== prefixList.length || (symbol !== null && !safeSymbol)) {
    return { ok: false, expired: 0 };
  }

  const h = await headers();
  const caller = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim() || "unknown";
  if (rateLimitKey(`refresh:${caller}`, 12, 60_000)) return { ok: false, expired: 0 };

  let expired = 0;
  let ok = true;
  try {
    const res = await fetch(`${BASE_URL}/api/v1/cache/refresh`, {
      method: "POST",
      headers: backendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: safePrefixes, symbol: safeSymbol }),
      cache: "no-store",
    });
    ok = res.ok;
    if (res.ok) expired = ((await res.json()) as { expired: number }).expired;
  } catch {
    ok = false;
  }
  // Every data fetch is tagged "api". updateTag expires it immediately (Next 16's read-your-writes form,
  // valid only in a Server Action), so the refreshed page never serves the stale copy first.
  updateTag("api");
  revalidatePath(safePath, "layout");
  return { ok, expired };
}
