import { NextResponse } from "next/server";
import { getPulse } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const index = searchParams.get("index") || "nifty50";
    const res = await getPulse(index);

    if (!res.ok) {
      return NextResponse.json(
        { error: res.message },
        { status: res.status || 502 },
      );
    }

    return NextResponse.json({ data: res.data, meta: res.meta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch live market pulse" },
      { status: 500 },
    );
  }
}
