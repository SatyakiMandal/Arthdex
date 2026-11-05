import { NextResponse } from "next/server";
import { getBuildUp } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const res = await getBuildUp();
    if (!res) {
      return NextResponse.json(
        { error: "F&O build-up data unavailable" },
        { status: 502 },
      );
    }
    return NextResponse.json({ data: res.data, meta: res.meta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch F&O build-up" },
      { status: 500 },
    );
  }
}
