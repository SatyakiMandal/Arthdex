import "server-only";

/**
 * Typed client for the Arthdex data service.
 *
 * Every backend response is wrapped in an envelope carrying provenance: which
 * upstream supplied the figure, how delayed that upstream is, and how long ago
 * the service fetched it. That metadata is threaded through to the UI rather
 * than discarded, because presenting delayed data as live is the single easiest
 * way for a finance tool to mislead.
 */

export interface ResponseMeta {
  source: string;
  delayedMinutes: number;
  cacheAgeSeconds: number;
  fetchedAt: string;
  illustrative: boolean;
  note: string | null;
}

export interface Envelope<T> {
  data: T;
  meta: ResponseMeta;
}

/** A failed fetch is surfaced, never silently replaced with placeholder data. */
export interface ApiError {
  ok: false;
  status: number;
  message: string;
}

export type ApiResult<T> = ({ ok: true } & Envelope<T>) | ApiError;

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

/** Matches the backend's own cache lifetimes so the two layers don't fight. */
export const REVALIDATE = {
  quote: 60,
  indices: 60,
  movers: 120,
  candles: 900,
  fundamentals: 3600,
  quant: 3600,
  ipo: 1800,
  news: 300,
  universe: 86_400,
} as const;

export async function apiGet<T>(
  path: string,
  revalidate: number = REVALIDATE.quote,
): Promise<ApiResult<T>> {
  const url = `${BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      next: { revalidate },
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body?.detail) detail = body.detail;
      } catch {
        // Non-JSON error body; the status text stands
      }
      return { ok: false, status: response.status, message: detail };
    }

    const body = (await response.json()) as Envelope<T>;
    return { ok: true, data: body.data, meta: body.meta };
  } catch (error) {
    // Almost always the data service not running — say so plainly
    return {
      ok: false,
      status: 0,
      message:
        error instanceof Error
          ? `Cannot reach the data service at ${BASE_URL}: ${error.message}`
          : "Cannot reach the data service",
    };
  }
}

/** Convenience for optional sections: null instead of an error object. */
export async function apiGetOrNull<T>(
  path: string,
  revalidate?: number,
): Promise<{ data: T; meta: ResponseMeta } | null> {
  const result = await apiGet<T>(path, revalidate);
  return result.ok ? { data: result.data, meta: result.meta } : null;
}
