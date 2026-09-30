import { NextResponse } from "next/server";
import { getQuote, getValuation } from "@/lib/api/endpoints";

/** Current value of one watchable metric, for the alert builder. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const metric = params.get("metric") ?? "cmp";

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  if (metric === "cmp") {
    const quote = await getQuote(symbol);
    return NextResponse.json({ value: quote.ok ? quote.data.cmp : null });
  }

  const valuation = await getValuation(symbol);
  if (!valuation) return NextResponse.json({ value: null });

  const value =
    metric === "peRatio"
      ? valuation.data.peRatio
      : metric === "pbRatio"
        ? valuation.data.pbRatio
        : null;

  return NextResponse.json({ value });
}
