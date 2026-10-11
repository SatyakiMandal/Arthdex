import { NextResponse } from "next/server";
import { getOrderflow } from "@/lib/api/endpoints";

/** Proxy so the order-flow workbench can switch market and bar size without widening CORS. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const market = params.get("market") ?? "nse";
  const interval = params.get("interval") ?? "5m";
  if (!symbol || !/^[A-Za-z0-9&_-]{1,20}$/.test(symbol)) {
    return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });
  }
  if (!["nse", "futures", "us"].includes(market) || !["1m", "5m", "15m", "1h", "1d"].includes(interval)) {
    return NextResponse.json({ error: "invalid market or interval" }, { status: 400 });
  }
  const result = await getOrderflow(symbol.toUpperCase(), market, interval);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status || 503 });
  return NextResponse.json({ ...result.data, meta: result.meta });
}
