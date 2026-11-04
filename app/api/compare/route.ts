import { NextResponse } from "next/server";
import { getCompanyCompare } from "@/lib/api/endpoints";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawSymbols = url.searchParams.get("symbols") ?? "";
  const symbols = rawSymbols
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 4);

  if (symbols.length === 0) {
    return NextResponse.json({
      data: { symbols: [], count: 0, companies: [] },
    });
  }

  const result = await getCompanyCompare(symbols);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status || 502 },
    );
  }

  return NextResponse.json({ data: result.data });
}
