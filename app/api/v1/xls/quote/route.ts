import { NextRequest, NextResponse } from "next/server";

import { getFinancials, getQuote, getValuation } from "@/lib/api/endpoints";
import { isValidSymbol, rateLimit } from "@/lib/api/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXT = { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" };

/** A spreadsheet cell shows this text, so a failure is visible instead of looking like a price. */
function cellError(code: string, status: number, extra: Record<string, string> = {}) {
  return new NextResponse(code, { status, headers: { ...TEXT, "Cache-Control": "no-store", ...extra } });
}

function num(value: number | null | undefined, digits: number): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "";
}

/**
 * Live quote for Excel and Google Sheets formulas.
 *
 *   =IMPORTDATA("https://arthdex.com/api/v1/xls/quote?symbol=RELIANCE&field=PRICE")
 *   =WEBSERVICE("https://arthdex.com/api/v1/xls/quote?symbol=TCS&field=PE")
 *
 * Fields: PRICE, CHANGE_PCT, PE, PB, MCAP (MARKET_CAP_CR), ROCE, HIGH_52W, LOW_52W.
 * Without a field the response is a one-row CSV. Every figure comes from the data service,
 * the same source as the company page; a figure the service does not have is an empty cell.
 */
export async function GET(request: NextRequest) {
  const wait = rateLimit("xls", request, 120, 60_000);
  if (wait) return cellError("#RATE_LIMIT", 429, { "Retry-After": String(wait) });

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "").toUpperCase();
  // The symbol is echoed into a CSV cell and a file name: it must be ticker-shaped and must
  // not open with a character a spreadsheet reads as a formula.
  if (!isValidSymbol(symbol) || !/^[A-Z0-9]/.test(symbol)) return cellError("#INVALID_SYMBOL", 400);
  const field = (searchParams.get("field") || "").toUpperCase();

  const quote = await getQuote(symbol);
  if (!quote.ok) return cellError(quote.status === 404 ? "#UNKNOWN_SYMBOL" : "#UNAVAILABLE", quote.status === 404 ? 404 : 503);
  const q = quote.data;

  const needsFundamentals = !field || ["PE", "PB", "ROCE"].includes(field);
  const [valuation, financials] = needsFundamentals
    ? await Promise.all([getValuation(symbol), getFinancials(symbol)])
    : [null, null];

  const values: Record<string, string> = {
    PRICE: num(q.cmp, 2),
    CHANGE_PCT: num(q.change?.percent, 2),
    PE: num(valuation?.data.peRatio, 2),
    PB: num(valuation?.data.pbRatio, 2),
    MCAP_CR: num(q.marketCapCr, 0),
    ROCE: num(financials?.data.ratios?.rocePct, 2),
    "52W_HIGH": num(q.high52w, 2),
    "52W_LOW": num(q.low52w, 2),
  };
  const aliases: Record<string, string> = { MARKET_CAP_CR: "MCAP_CR", MCAP: "MCAP_CR", HIGH_52W: "52W_HIGH", LOW_52W: "52W_LOW" };

  if (field) {
    const key = aliases[field] ?? field;
    if (!(key in values)) return cellError("#INVALID_FIELD", 400);
    if (values[key] === "") return cellError("#N/A", 404);
    return new NextResponse(values[key], { headers: { ...TEXT, "Cache-Control": "public, max-age=15" } });
  }

  const columns = Object.keys(values);
  const csv = `SYMBOL,${columns.join(",")},AS_OF,SOURCE\n${symbol},${columns.map((c) => values[c]).join(",")},${JSON.stringify(q.asOf ?? "")},${JSON.stringify(quote.meta.source ?? "")}`;
  const fileStem = symbol.replace(/[^A-Z0-9_-]/g, "_");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${fileStem}_quote.csv"`,
      "Cache-Control": "public, max-age=15",
    },
  });
}
