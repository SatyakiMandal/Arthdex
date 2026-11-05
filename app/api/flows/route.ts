import { NextResponse } from "next/server";
import { getFlows } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "5", 10);
    const res = await getFlows(days);
    if (!res) {
      return NextResponse.json(
        { error: "Institutional flows data unavailable" },
        { status: 502 },
      );
    }
    return NextResponse.json({ data: res.data, meta: res.meta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch institutional flows" },
      { status: 500 },
    );
  }
}
