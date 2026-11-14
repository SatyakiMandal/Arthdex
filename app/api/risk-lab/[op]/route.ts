import { NextResponse } from "next/server";

import { getFactorExposures, postBacktest, postStressTest } from "@/lib/api/endpoints";
import { isCrossSiteRequest, isValidSymbol, rateLimit } from "@/lib/api/request-guards";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ op: string }> };
const MAX_HOLDINGS = 15;

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function guard(request: Request, scope: string, limit: number) {
  if (isCrossSiteRequest(request)) return bad("Cross-origin request forbidden", 403);
  const wait = rateLimit(scope, request, limit, 60_000);
  return wait ? NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(wait) } }) : null;
}

/** Benchmark regressions for one symbol. */
export async function GET(request: Request, ctx: Ctx) {
  const { op } = await ctx.params;
  if (op !== "factor-exposures") return bad("Not found", 404);
  const blocked = guard(request, "risk-lab-read", 30);
  if (blocked) return blocked;
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) return bad("valid symbol is required");
  const res = await getFactorExposures(symbol);
  return res.ok ? NextResponse.json(res.data) : bad(res.message, res.status || 503);
}

/** Stress test and backtest. Each run fetches long price histories, so they are rate-limited. */
export async function POST(request: Request, ctx: Ctx) {
  const { op } = await ctx.params;
  if (op !== "stress-test" && op !== "backtest") return bad("Not found", 404);
  const blocked = guard(request, "risk-lab-run", 12);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return bad("invalid body");
  }

  if (op === "stress-test") {
    const raw = Array.isArray(body.portfolio) ? body.portfolio : [];
    if (raw.length === 0 || raw.length > MAX_HOLDINGS) return bad(`Enter between 1 and ${MAX_HOLDINGS} holdings`);
    const portfolio: { symbol: string; value_inr: number }[] = [];
    for (const item of raw as Record<string, unknown>[]) {
      const symbol = typeof item?.symbol === "string" ? item.symbol.trim().toUpperCase() : "";
      if (!isValidSymbol(symbol) || !finite(item?.value_inr) || item.value_inr <= 0 || item.value_inr > 1e13) {
        return bad("Each holding needs a ticker and a positive rupee value");
      }
      portfolio.push({ symbol, value_inr: item.value_inr });
    }
    const scenarioId = typeof body.scenario_id === "string" && /^[a-z0-9_]{1,40}$/.test(body.scenario_id) ? body.scenario_id : undefined;
    const move = finite(body.index_move_pct) && Math.abs(body.index_move_pct) <= 90 ? body.index_move_pct : undefined;
    if (!scenarioId && move === undefined) return bad("Choose a scenario or an index move");
    const res = await postStressTest(scenarioId ? { portfolio, scenario_id: scenarioId } : { portfolio, index_move_pct: move });
    return res.ok ? NextResponse.json(res.data) : bad(res.message, res.status || 503);
  }

  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const int = (v: unknown, lo: number, hi: number) => (finite(v) && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  const fast = int(body.fast_period, 2, 250);
  const slow = int(body.slow_period, 3, 500);
  const years = int(body.years, 2, 20);
  const capital = finite(body.initial_capital) && body.initial_capital > 0 && body.initial_capital <= 1e12 ? body.initial_capital : null;
  if (!isValidSymbol(symbol) || fast === null || slow === null || years === null || capital === null || fast >= slow) {
    return bad("Check the ticker, the two periods (fast below slow), the years and the capital");
  }
  const res = await postBacktest({ symbol, fast_period: fast, slow_period: slow, years, initial_capital: capital });
  return res.ok ? NextResponse.json(res.data) : bad(res.message, res.status || 503);
}
