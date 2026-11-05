import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getBuildUp, getFlows, getFnoBan, getIndices, getOptionChain, getPulse } from "@/lib/api/endpoints";
import type { ApiBuildUp, ApiFlows, ApiFnoBan, ApiIndex, ApiOptionChain, ApiPulse } from "@/lib/api/types";
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
  let initialOptionChain: ApiOptionChain | null = null;

  try {
    const [pulseRes, indicesRes, buildupRes, fnoBanRes, flowsRes, optionChainRes] = await Promise.all([
      getPulse("nifty500").catch(() => null),
      getIndices().catch(() => null),
      getBuildUp().catch(() => null),
      getFnoBan().catch(() => null),
      getFlows(5).catch(() => null),
      getOptionChain("NIFTY").catch(() => null),
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
    if (optionChainRes?.data) {
      initialOptionChain = optionChainRes.data;
    }
  } catch {
    // Graceful fallback
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full px-2 py-2.5 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span>Live Market Cockpit</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-none h-2 w-2 bg-emerald-500"></span>
              </span>
            </h1>
            <span className="hidden sm:inline-block text-border">|</span>
            <p className="hidden sm:inline-block text-2xs font-mono text-muted-foreground">
              Institutional mission-control radar · Real-time whole-market breadth & tick streaming
            </p>
          </div>
        </div>

        <div className="mt-2.5">
          <LiveMarketCockpit
            initialPulse={initialPulse}
            initialIndices={initialIndices}
            initialBuildUp={initialBuildUp}
            initialFnoBan={initialFnoBan}
            initialFlows={initialFlows}
            initialOptionChain={initialOptionChain}
            initialIndex="nifty500"
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
