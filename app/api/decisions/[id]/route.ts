import { NextResponse } from "next/server";
import { backendHeaders } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "Cross-origin request forbidden" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid origin header" }, { status: 403 });
    }
  }
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const upstream = await fetch(`${BASE_URL}/api/v1/decisions/${id}`, { method: "DELETE", cache: "no-store", headers: backendHeaders() });
    const body = await upstream.json().catch(() => ({}));
    return NextResponse.json(upstream.ok ? body : { error: body.detail ?? "Could not delete" }, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Cannot reach the data service" }, { status: 503 });
  }
}
