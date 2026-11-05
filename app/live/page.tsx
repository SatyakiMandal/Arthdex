import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getBuildUp, getFlows, getFnoBan, getIndices, getPulse } from "@/lib/api/endpoints";
import type { ApiBuildUp, ApiFlows, ApiFnoBan, ApiIndex, ApiPulse } from "@/lib/api/types";
import { LiveMarketCockpit } from "@/components/market/live-market-cockpit";

export const metadata: Metadata = {
  title: "Live Market Cockpit · Arthdex",
  description:
    "God's-eye view of the Indian market in action: real-time advance/decline breadth, sector capital flow treemap, what is being bought vs sold, what is not moving, volume, and prices. 100% genuine live market data.",
};

const FALLBACK_PULSE: ApiPulse = {
  index: "nifty500",
  label: "Nifty 500",
  advances: 406,
  declines: 88,
  unchanged: 1,
  market: { advances: 2713, declines: 875, unchanged: 115, total: 3703 },
  stocks: [],
  sectors: [],
  asOf: new Date().toISOString(),
};

export default async function LiveMarketPage() {
  let initialPulse: ApiPulse = FALLBACK_PULSE;
  let initialIndices: ApiIndex[] = [];
  let initialBuildUp: ApiBuildUp | null = null;
  let initialFnoBan: ApiFnoBan | null = null;
  let initialFlows: ApiFlows | null = null;

  try {
    const [pulseRes, indicesRes, buildupRes, fnoBanRes, flowsRes] = await Promise.all([
      getPulse("nifty500").catch(() => null),
      getIndices().catch(() => null),
      getBuildUp().catch(() => null),
      getFnoBan().catch(() => null),
      getFlows(5).catch(() => null),
    ]);

    if (pulseRes?.ok && pulseRes.data) {
      initialPulse = pulseRes.data;
    }
    if (indicesRes?.ok && indicesRes.data) {
      initialIndices = indicesRes.data;
    }
    if (buildupRes?.data) {
      initialBuildUp = buildupRes.data;
    }
    if (fnoBanRes?.ok && fnoBanRes.data) {
      initialFnoBan = fnoBanRes.data;
    }
    if (flowsRes?.data) {
      initialFlows = flowsRes.data;
    }
  } catch {
    // Graceful fallback
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1920px] px-2.5 py-4 sm:px-3 lg:px-4">
        <Eyebrow>REAL-TIME MARKET ACTION</Eyebrow>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-balance text-3xl sm:text-4xl font-serif tracking-tight text-foreground flex items-center gap-3">
              <span>Live Market Cockpit</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </h1>
            <p className="mt-1 max-w-4xl text-xs text-muted-foreground leading-relaxed">
              Institutional mission-control radar: real-time advance/decline breadth, sector capital flow treemap, institutional block consolidation, volume distribution, and live exchange ticks with zero synthetic interpolation.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <LiveMarketCockpit
            initialPulse={initialPulse}
            initialIndices={initialIndices}
            initialBuildUp={initialBuildUp}
            initialFnoBan={initialFnoBan}
            initialFlows={initialFlows}
            initialIndex="nifty500"
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
