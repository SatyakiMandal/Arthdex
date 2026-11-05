import { NextResponse } from "next/server";
import { getSectorRotation } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const res = await getSectorRotation();
    if (!res.ok) {
      return NextResponse.json(
        { error: res.message || "Sector rotation data unavailable" },
        { status: res.status || 502 },
      );
    }
    return NextResponse.json({ data: res.data, meta: res.meta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sector rotation" },
      { status: 500 },
    );
  }
}
