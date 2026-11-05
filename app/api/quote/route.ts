export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getQuote } from "@/lib/api/endpoints";

/**
 * High-speed fractional real-time quote proxy.
 * Delivers authentic exchange quotes with sub-20ms latency and zero HTTP cache
 * to feed the live horizontal price beam and tick indicator.
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

  const result = await getQuote(symbol.toUpperCase());
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.message },
      { status: result.status || 503 },
    );
  }

  return NextResponse.json(
    { ok: true, data: result.data, meta: result.meta },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
