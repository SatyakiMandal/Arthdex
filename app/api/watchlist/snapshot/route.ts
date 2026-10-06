import { NextResponse } from "next/server";

import { backendHeaders } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

/** Same-origin proxy so the browser never talks to the data service directly. */
export async function POST(request: Request) {
  try {
    const upstream = await fetch(`${BASE_URL}/api/v1/watchlist/snapshot`, {
      method: "POST",
      cache: "no-store",
      headers: backendHeaders({ "Content-Type": "application/json" }),
      body: await request.text(),
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ detail: "Cannot reach the data service" }, { status: 503 });
  }
}
