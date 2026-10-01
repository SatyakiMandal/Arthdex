import { NextResponse } from "next/server";
import { getMacdScreen } from "@/lib/api/endpoints";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const direction = p.get("direction") === "below" ? "below" : "above";
  const interval = p.get("interval") ?? "15m";
  const index = p.get("index") ?? "nifty50";
  const within = Math.min(50, Math.max(1, Number(p.get("within") ?? 3) || 3));
  const result = await getMacdScreen({ direction, interval, within, index });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status || 503 });
  return NextResponse.json({ ...result.data, meta: result.meta });
}
