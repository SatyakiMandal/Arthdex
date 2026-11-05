import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowLeftRight, Info } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { OrderflowWorkbench } from "@/components/orderflow/orderflow-workbench";
import { DealsView } from "@/components/market/deals-view";
import { DataUnavailable, FreshnessBadge, SourceLine } from "@/components/ui/data-provenance";
import { getDeals } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Institutional Order Flow & Deals · Arthdex",
  description:
    "Unified institutional microstructure desk: volume profile, delta, CVD, footprint, dealer GEX, and official NSE bulk & block deals.",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function OrderflowPage({ searchParams }: PageProps) {
  const { tab = "orderflow" } = await searchParams;
  const isDeals = tab === "deals";

  // Fetch deals data if viewing deals tab or pre-fetching
  const dealsResult = isDeals ? await getDeals().catch(() => null) : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full px-2 py-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              {isDeals ? <ArrowLeftRight className="h-4 w-4 text-gold" /> : <Activity className="h-4 w-4 text-accent" />}
              <span>{isDeals ? "Institutional Bulk & Block Deals" : "Order Flow & Microstructure Workbench"}</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              {isDeals ? "Direct Exchange Window Large-Lot Disclosures" : "Volume Profile, CVD, Footprint & Net Dealer Gamma Exposure"}
            </span>
          </div>

          {/* Unified Desk View Switcher */}
          <div className="flex items-center border border-border bg-surface-muted p-0.5 rounded-none font-mono text-2xs">
            <Link
              href="/orderflow?tab=orderflow"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider transition-all duration-150 rounded-none",
                !isDeals
                  ? "bg-surface text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Activity className="h-3.5 w-3.5 text-accent" />
              <span>Order Flow &amp; Microstructure</span>
            </Link>
            <Link
              href="/orderflow?tab=deals"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider transition-all duration-150 rounded-none",
                isDeals
                  ? "bg-surface text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-gold" />
              <span>Bulk &amp; Block Deals</span>
            </Link>
          </div>
        </div>

        {isDeals ? (
          <div className="mt-3">
            {dealsResult && dealsResult.ok ? (
              <>
                <div className="mb-4 flex justify-end">
                  <FreshnessBadge meta={dealsResult.meta} />
                </div>
                <DealsView deals={dealsResult.data} />
                <SourceLine meta={dealsResult.meta} className="mt-4" />
              </>
            ) : (
              <DataUnavailable
                title="Deals unavailable"
                message={dealsResult && !dealsResult.ok ? dealsResult.message : "Could not load exchange bulk and block deals."}
              />
            )}
          </div>
        ) : (
          <>
            <div className="mt-2.5 rounded-none border border-primary/30 bg-primary/5 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground text-2xs uppercase tracking-wider">
                  MODELLED ORDER FLOW ANALYTICS · NOT LEVEL 3 EXCHANGE TAPE
                </span>
                <p className="text-3xs leading-relaxed text-muted-foreground">
                  Aggressor buy and sell volume, CVD (Cumulative Volume Delta), and footprint imbalances are algorithmically estimated from OHLCV bar ranges because public feeds do not provide tick-by-tick Level 3 matched order execution tapes. Volume profile and value area are exact functions of the bars. Resting-liquidity order-book heatmaps are withheld rather than simulated.
                </p>
              </div>
            </div>

            <div className="mt-3">
              <OrderflowWorkbench symbol="NQ" market="futures" selectable />
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
