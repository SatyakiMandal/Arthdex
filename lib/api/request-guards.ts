import "server-only";

/** NSE/BSE ticker shape accepted everywhere a symbol reaches a URL, file name or CSV cell. */
export const SYMBOL_RE = /^[A-Za-z0-9&_-]{1,20}$/;

export function isValidSymbol(value: unknown): value is string {
  return typeof value === "string" && SYMBOL_RE.test(value);
}

/**
 * True when a state-changing request did not come from this site.
 *
 * Browsers attach Origin to every cross-origin POST/DELETE and Sec-Fetch-Site to
 * every request, so a page on another site cannot forge either. Requests with
 * neither header (curl, server-to-server) are not a CSRF vector and pass.
 */
export function isCrossSiteRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin) return false;
  if (!host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/** The caller's address as the hosting proxy reports it; "unknown" shares one bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim() || "unknown";
}

/**
 * Fixed-window limiter held in process memory. It bounds abuse of one server
 * instance; it is not a substitute for a gateway limit across instances.
 * Returns the seconds to wait when the caller is over the limit, otherwise 0.
 */
export function rateLimit(scope: string, request: Request, limit: number, windowMs: number): number {
  return rateLimitKey(`${scope}:${clientKey(request)}`, limit, windowMs);
}

/** The same limiter for callers that have no Request, such as Server Actions. */
export function rateLimitKey(key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  bucket.count += 1;
  return bucket.count > limit ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : 0;
}
