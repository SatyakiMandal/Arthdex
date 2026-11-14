import { NextRequest, NextResponse } from "next/server";

import { getCandles } from "@/lib/api/endpoints";
import { isValidSymbol, rateLimit } from "@/lib/api/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXT = { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" };

/**
 * Daily OHLCV history as CSV for Excel and Google Sheets.
 *
 *   =IMPORTDATA("https://arthdex.com/api/v1/xls/hist?symbol=RELIANCE&days=30")
 *
 * `days` is calendar days back from today, 1 to 365. The bars are the data service's daily
 * candles, the same series as the company page chart.
 */
export async function GET(request: NextRequest) {
  const wait = rateLimit("xls", request, 120, 60_000);
  if (wait) return new NextResponse("#RATE_LIMIT", { status: 429, headers: { ...TEXT, "Retry-After": String(wait) } });

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "").toUpperCase();
  if (!isValidSymbol(symbol) || !/^[A-Z0-9]/.test(symbol)) {
    return new NextResponse("#INVALID_SYMBOL", { status: 400, headers: TEXT });
  }
  const requestedDays = Number.parseInt(searchParams.get("days") || "30", 10);
  const days = Number.isFinite(requestedDays) ? Math.min(365, Math.max(1, requestedDays)) : 30;

  const series = await getCandles(symbol, "1Y");
  if (!series.ok) {
    const unknown = series.status === 404;
    return new NextResponse(unknown ? "#UNKNOWN_SYMBOL" : "#UNAVAILABLE", { status: unknown ? 404 : 503, headers: TEXT });
  }

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const fixed = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "");
  const rows = series.data.candles
    .filter((c) => String(c.date).slice(0, 10) >= cutoff)
    .map((c) => `${String(c.date).slice(0, 10)},${fixed(c.open)},${fixed(c.high)},${fixed(c.low)},${fixed(c.close)},${Number.isFinite(c.volume) ? Math.round(c.volume) : ""}`);

  const fileStem = symbol.replace(/[^A-Z0-9_-]/g, "_");
  return new NextResponse(["DATE,OPEN,HIGH,LOW,CLOSE,VOLUME", ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${fileStem}_hist.csv"`,
      "Cache-Control": "public, max-age=900",
    },
  });
}
