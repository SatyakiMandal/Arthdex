import { NextResponse } from "next/server";

import { getQuote, getValuation } from "@/lib/api/endpoints";
import { isValidSymbol, rateLimit } from "@/lib/api/request-guards";

export const dynamic = "force-dynamic";

/** The copilot's header strip for a symbol: live quote and multiples, or 404 if the symbol is not covered. */
export async function GET(request: Request) {
  const wait = rateLimit("copilot-dossier", request, 60, 60_000);
  if (wait) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(wait) } });

  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) return NextResponse.json({ error: "valid symbol is required" }, { status: 400 });

  const [quote, valuation] = await Promise.all([getQuote(symbol), getValuation(symbol)]);
  if (!quote.ok) {
    return NextResponse.json({ error: quote.status === 404 ? "Symbol not covered" : "Quote unavailable" }, { status: quote.status === 404 ? 404 : 503 });
  }
  const q = quote.data as typeof quote.data & { name?: string; sector?: string };
  return NextResponse.json(
    {
      symbol,
      name: q.name ?? symbol,
      sector: q.sector ?? null,
      cmp: q.cmp,
      changePct: q.change?.percent ?? null,
      pe: valuation?.data.peRatio ?? null,
      evEbitda: valuation?.data.evToEbitda ?? null,
      roePct: valuation?.data.roePct ?? null,
      asOf: q.asOf,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
