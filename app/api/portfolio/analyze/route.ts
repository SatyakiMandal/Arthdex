import { NextResponse } from "next/server";
import { postPortfolioAnalyze } from "@/lib/api/endpoints";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const holdings = body?.holdings ?? [];
    if (!Array.isArray(holdings) || holdings.length === 0) {
      return NextResponse.json(
        { error: "Holdings array must be provided with at least one scrip." },
        { status: 400 },
      );
    }

    const result = await postPortfolioAnalyze(holdings);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status || 502 },
      );
    }

    return NextResponse.json({ data: result.data, meta: result.meta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze portfolio" },
      { status: 500 },
    );
  }
}
