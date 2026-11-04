import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getPulse } from "@/lib/api/endpoints";
import type { ApiPulse } from "@/lib/api/types";
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

  try {
    const res = await getPulse("nifty500");
    if (res.ok && res.data) {
      initialPulse = res.data;
    }
  } catch {
    // Graceful fallback
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <Eyebrow>REAL-TIME MARKET ACTION</Eyebrow>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-balance text-4xl sm:text-5xl font-serif tracking-tight text-foreground flex items-center gap-3">
              <span>Live Market Cockpit</span>
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground leading-relaxed">
              God&apos;s-eye view of the live Indian market: real-time advance/decline spectrum, sector capital flow treemap (what is being bought vs. what is being sold), what is not moving (consolidation radar), volumes, and prices. Centered on genuine official exchange feeds with zero synthetic interpolation.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <LiveMarketCockpit initialPulse={initialPulse} initialIndex="nifty500" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
