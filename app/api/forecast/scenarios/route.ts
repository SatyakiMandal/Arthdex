export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

/**
 * Multi-Algorithm Scenario Forecasting & Execution Sizer Proxy.
 * Ultra-low latency, zero-cache proxy ensuring fresh real-time exchange ticks
 * power the multi-algo consensus and position sizing tickets.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const exchange = params.get("exchange") ?? "NSE";
  const capital = params.get("capital") ?? "500000";
  const riskPct = params.get("risk_pct") ?? "1.0";

  if (!symbol || !/^[A-Za-z0-9&_-]{1,20}$/.test(symbol)) {
    return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });
  }

  try {
    const url = `${BASE_URL}/api/v1/forecast/scenarios/${encodeURIComponent(
      symbol.toUpperCase(),
    )}?exchange=${encodeURIComponent(exchange)}&capital=${encodeURIComponent(
      capital,
    )}&risk_pct=${encodeURIComponent(riskPct)}&_t=${Date.now()}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      let detail = `Scenario forecast error ${res.status}`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // default fallback
      }
      return NextResponse.json({ error: detail }, { status: res.status });
    }

    const payload = await res.json();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Internal scenario forecast proxy error: ${err.message}` },
      { status: 500 },
    );
  }
}
