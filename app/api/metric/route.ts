import { NextResponse } from "next/server";
import { getQuote, getValuation } from "@/lib/api/endpoints";

const SYMBOL_RE = /^[A-Z0-9&_.\-^]{1,24}$/i;
const ALLOWED_PERIODS = new Set(["1M", "3M", "6M", "1Y", "3Y", "5Y"]);
const ALLOWED_METRICS = new Set(["cmp", "peRatio", "pbRatio"]);

/** Current value of one watchable metric, for the alert builder. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const metric = params.get("metric") ?? "cmp";
  const period = params.get("period");

  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });
  }
  if (period !== null && !ALLOWED_PERIODS.has(period.toUpperCase())) {
    return NextResponse.json({ error: "invalid period" }, { status: 400 });
  }
  if (!ALLOWED_METRICS.has(metric)) {
    return NextResponse.json({ error: "invalid metric" }, { status: 400 });
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
