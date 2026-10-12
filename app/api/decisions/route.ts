import { NextResponse } from "next/server";
import { backendHeaders } from "@/lib/api/auth";
import { getDecisions } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

export async function GET() {
  const result = await getDecisions();
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status || 503 });
  return NextResponse.json({ ...result.data, meta: result.meta });
}

/** Logs a call. The browser sends only a symbol; the data service builds the snapshot itself. */
export async function POST(request: Request) {
  let symbol: unknown;
  try {
    symbol = ((await request.json()) as { symbol?: unknown }).symbol;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof symbol !== "string" || !/^[A-Za-z0-9&_-]{1,20}$/.test(symbol)) {
    return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${BASE_URL}/api/v1/decisions`, {
      method: "POST",
      cache: "no-store",
      headers: backendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ symbol: symbol.toUpperCase() }),
    });
    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return NextResponse.json({ error: body.detail ?? "Could not log the call" }, { status: upstream.status });
    return NextResponse.json(body.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Cannot reach the data service" }, { status: 503 });
  }
}
