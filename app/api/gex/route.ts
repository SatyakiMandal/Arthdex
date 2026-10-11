import { NextResponse } from "next/server";
import { getGex } from "@/lib/api/endpoints";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol");
  if (!symbol || !/^[A-Za-z]{2,5}$/.test(symbol)) {
    return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });
  }
  const result = await getGex(symbol.toUpperCase());
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status || 503 });
  return NextResponse.json({ ...result.data, meta: result.meta });
}
