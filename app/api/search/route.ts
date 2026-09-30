import { NextResponse } from "next/server";
import { searchCompanies } from "@/lib/api/endpoints";

/**
 * Proxy for the search bar.
 *
 * The client component cannot call the data service directly — it runs in the
 * browser, where the service origin is not necessarily reachable and CORS would
 * have to be widened. Routing through the app keeps one origin.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const result = await searchCompanies(query, 10);
  if (!result) {
    return NextResponse.json(
      { results: [], error: "Search is unavailable — the data service is not reachable." },
      { status: 503 },
    );
  }

  return NextResponse.json({ results: result.data });
}
