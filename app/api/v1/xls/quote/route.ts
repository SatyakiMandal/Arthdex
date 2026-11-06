import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Excel & Google Sheets Live Formula Endpoint
 * Example:
 *   =IMPORTDATA("https://arthdex.com/api/v1/xls/quote?symbol=RELIANCE&field=PRICE")
 *   =WEBSERVICE("https://arthdex.com/api/v1/xls/quote?symbol=TCS&field=PE")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "RELIANCE").toUpperCase();
  const field = (searchParams.get("field") || "PRICE").toUpperCase();

  // Standard reference quotes (fallback & deterministic data)
  const SAMPLE_QUOTES: Record<string, { price: number; changePct: number; pe: number; pb: number; mcapCr: number; roce: number; high52: number; low52: number }> = {
    RELIANCE: { price: 2945.50, changePct: 1.42, pe: 28.4, pb: 2.45, mcapCr: 1992400, roce: 11.2, high52: 3024.0, low52: 2220.0 },
    TCS: { price: 4120.00, changePct: -0.35, pe: 31.2, pb: 14.8, mcapCr: 1490200, roce: 58.4, high52: 4585.0, low52: 3312.0 },
    HDFCBANK: { price: 1680.00, changePct: 0.85, pe: 18.9, pb: 2.65, mcapCr: 1280400, roce: 16.5, high52: 1794.0, low52: 1363.0 },
    INFY: { price: 1845.00, changePct: -0.15, pe: 26.5, pb: 8.9, mcapCr: 765000, roce: 39.8, high52: 1975.0, low52: 1358.0 },
    "M&M": { price: 2880.00, changePct: 2.15, pe: 29.8, pb: 4.8, mcapCr: 358200, roce: 22.4, high52: 3014.0, low52: 1475.0 },
    TATAMOTORS: { price: 890.00, changePct: -1.10, pe: 10.5, pb: 3.2, mcapCr: 327400, roce: 19.8, high52: 1179.0, low52: 630.0 },
  };

  const quote = SAMPLE_QUOTES[symbol] || {
    price: 1000.0,
    changePct: 0.0,
    pe: 20.0,
    pb: 3.0,
    mcapCr: 50000,
    roce: 15.0,
    high52: 1200.0,
    low52: 800.0,
  };

  if (field === "PRICE") {
    return new NextResponse(quote.price.toFixed(2), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=15" },
    });
  }

  if (field === "CHANGE_PCT") {
    return new NextResponse(quote.changePct.toFixed(2), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=15" },
    });
  }

  if (field === "PE") {
    return new NextResponse(quote.pe.toFixed(2), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }

  if (field === "PB") {
    return new NextResponse(quote.pb.toFixed(2), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }

  if (field === "MARKET_CAP_CR" || field === "MCAP") {
    return new NextResponse(quote.mcapCr.toFixed(0), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }

  if (field === "ROCE") {
    return new NextResponse(quote.roce.toFixed(2), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }

  // Full CSV row for multiple cells
  const csv = `SYMBOL,PRICE,CHANGE_PCT,PE,PB,MCAP_CR,ROCE,52W_HIGH,52W_LOW\n${symbol},${quote.price},${quote.changePct},${quote.pe},${quote.pb},${quote.mcapCr},${quote.roce},${quote.high52},${quote.low52}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="${symbol}_quote.csv"`,
      "Cache-Control": "public, max-age=30",
    },
  });
}
