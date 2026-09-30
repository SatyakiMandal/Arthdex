import { NextResponse } from "next/server";
import { getCandles } from "@/lib/api/endpoints";

/** Proxy so the chart can refetch on period change without widening CORS. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const period = params.get("period") ?? "1Y";

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const result = await getCandles(symbol, period);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status || 503 });
  }

  return NextResponse.json({ ...result.data, meta: result.meta });
}
