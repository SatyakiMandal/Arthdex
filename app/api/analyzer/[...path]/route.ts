import { NextResponse } from "next/server";
import { analyzerBaseUrl } from "@/lib/api/analyzer";

/**
 * Same-origin proxy to the analyzer endpoints of the data service.
 *
 * The browser polls run status and loads the report iframe from here, so the
 * service origin never needs to be reachable (or CORS-open) from the client.
 * Only the documented analyzer routes are forwarded.
 */
export const dynamic = "force-dynamic";

const SEG = "[A-Za-z0-9._-]+";
const ALLOWED = [
  new RegExp(`^search$`),
  new RegExp(`^runs$`),
  new RegExp(`^runs/${SEG}$`),
  new RegExp(`^runs/${SEG}/(cancel|summary|report)$`),
  new RegExp(`^runs/${SEG}/download/${SEG}$`),
];

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(request: Request, ctx: Ctx, method: "GET" | "POST") {
  const { path } = await ctx.params;
  const joined = path.join("/");
  if (!ALLOWED.some((re) => re.test(joined))) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  const search = new URL(request.url).search;
  try {
    const upstream = await fetch(`${analyzerBaseUrl}/api/v1/analyzer/${joined}${search}`, {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? await request.text() : undefined,
    });

    const headers = new Headers();
    const type = upstream.headers.get("content-type");
    if (type) headers.set("content-type", type);
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    // The report embeds scraped headlines; sandbox it even when opened directly.
    if (joined.endsWith("/report")) {
      headers.set("content-security-policy", "sandbox allow-scripts allow-popups");
    }
    headers.set("cache-control", "no-store");

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? `Cannot reach the data service: ${error.message}`
            : "Cannot reach the data service",
      },
      { status: 503 },
    );
  }
}

export const GET = (request: Request, ctx: Ctx) => forward(request, ctx, "GET");
export const POST = (request: Request, ctx: Ctx) => forward(request, ctx, "POST");
