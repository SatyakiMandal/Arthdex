export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

/**
 * Ultra-low latency, zero-cache real-time orderflow proxy.
 * Queries the authentic backend orderflow endpoint with cache-busting timestamp
 * so client polls always receive the freshest auction state without Next.js caching.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const market = params.get("market") ?? "nse";
  const interval = params.get("interval") ?? "5m";

  if (!symbol || !/^[A-Za-z0-9&_-]{1,20}$/.test(symbol)) {
    return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });
  }
  if (
    !["nse", "futures", "us"].includes(market) ||
    !["1m", "5m", "15m", "1h", "1d"].includes(interval)
  ) {
    return NextResponse.json({ error: "invalid market or interval" }, { status: 400 });
  }

  try {
    const url = `${BASE_URL}/api/v1/orderflow/${encodeURIComponent(symbol.toUpperCase())}?market=${encodeURIComponent(market)}&interval=${encodeURIComponent(interval)}&_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      let detail = `Order flow error ${res.status}`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // default message
      }
      return NextResponse.json({ error: detail }, { status: res.status });
    }

    const envelope = await res.json();
    return NextResponse.json(
      { ...envelope.data, meta: envelope.meta },
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
      { error: err instanceof Error ? err.message : "Order flow fetch failed" },
      { status: 503 },
    );
  }
}
