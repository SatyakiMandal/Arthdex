import { NextResponse } from "next/server";
import { getTechnicals } from "@/lib/api/endpoints";

/** Proxy so the workbench can switch bar size without widening CORS. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const interval = params.get("interval") ?? "15m";
  if (!symbol || !/^[A-Za-z0-9&_-]{1,20}$/.test(symbol)) {
    return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });
  }
  const result = await getTechnicals(symbol.toUpperCase(), interval);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status || 503 });
  return NextResponse.json({ ...result.data, meta: result.meta });
}
