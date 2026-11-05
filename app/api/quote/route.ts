export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

/**
 * Ultra-low latency, zero-cache real-time quote proxy.
 * Queries the authentic exchange provider with cache-busting timestamp
 * so every single poll returns the exact live market tick.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");

  if (!symbol || !/^[A-Za-z0-9&_-]{1,20}$/.test(symbol)) {
    return NextResponse.json(
      { ok: false, error: "A valid ticker symbol is required" },
      { status: 400 },
    );
  }

  try {
    const url = `${BASE_URL}/api/v1/company/${encodeURIComponent(symbol.toUpperCase())}/quote?t=${Date.now()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      let detail = `Upstream error ${res.status}`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // use default
      }
      return NextResponse.json({ ok: false, error: detail }, { status: res.status });
    }

    const envelope = await res.json();
    return NextResponse.json(
      { ok: true, data: envelope.data, meta: envelope.meta },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Quote fetch failed" },
      { status: 503 },
    );
  }
}
