import { NextRequest, NextResponse } from "next/server";
import { getOptionChain } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "NIFTY";
    const expiry = searchParams.get("expiry") || undefined;

    const res = await getOptionChain(symbol, expiry);
    if (!res || !res.data) {
      return NextResponse.json(
        { error: `Option chain data unavailable for ${symbol}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ data: res.data, meta: res.meta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch option chain" },
      { status: 500 },
    );
  }
}
