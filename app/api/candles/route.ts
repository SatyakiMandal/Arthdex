import { NextResponse } from "next/server";
import { getCandles } from "@/lib/api/endpoints";

const SYMBOL_RE = /^[A-Z0-9&_.\-^]{1,24}$/i;
const ALLOWED_PERIODS = new Set(["1D", "5D", "1M", "3M", "6M", "1Y", "3Y", "5Y", "MAX"]);

/** Proxy so the chart can refetch on period change without widening CORS. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const period = (params.get("period") ?? "1Y").toUpperCase();

  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });
  }
  if (!ALLOWED_PERIODS.has(period)) {
    return NextResponse.json({ error: "invalid period" }, { status: 400 });
  }

  const result = await getCandles(symbol, period);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status || 503 });
  }

  return NextResponse.json({ ...result.data, meta: result.meta });
}
