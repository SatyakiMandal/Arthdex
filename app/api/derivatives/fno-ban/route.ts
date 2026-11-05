import { NextResponse } from "next/server";
import { getFnoBan } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await getFnoBan();
    if (!res.ok) {
      return NextResponse.json(
        { error: res.message },
        { status: res.status || 502 },
      );
    }
    return NextResponse.json({ data: res.data, meta: res.meta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch F&O ban list" },
      { status: 500 },
    );
  }
}
