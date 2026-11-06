import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SourceLine, DataUnavailable } from "@/components/ui/data-provenance";
import { CorporateGraphView } from "@/components/network/corporate-graph-view";
import { getCorporateHierarchy, getSupplyChainNetwork, getNetworkSummary } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Corporate Network & Supply Chain Web (SPLC / HOLD) · Arthdex Terminal",
  description: "Interconnected web of Indian conglomerates, multi-tier suppliers, independent contractors, customer channels, sole-source bottlenecks, and group subsidiary holdings.",
};

export const revalidate = 3600;

interface NetworkPageProps {
  searchParams: Promise<{
    symbol?: string;
    mode?: string;
  }>;
}

export default async function NetworkPage({ searchParams }: NetworkPageProps) {
  const { symbol = "M&M", mode = "splc" } = await searchParams;
  const cleanSymbol = symbol.trim().toUpperCase() || "M&M";

  const [hierarchyRes, supplyChainRes, summaryRes] = await Promise.all([
    getCorporateHierarchy(cleanSymbol),
    getSupplyChainNetwork(cleanSymbol),
    getNetworkSummary(cleanSymbol),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {hierarchyRes.ok && supplyChainRes.ok && summaryRes.ok ? (
          <>
            <CorporateGraphView
              initialSymbol={cleanSymbol}
              initialHierarchy={hierarchyRes.data}
              initialSupplyChain={supplyChainRes.data}
              initialSummary={summaryRes.data}
              initialMode={mode.toUpperCase() === "HOLD" ? "HOLD" : "SPLC"}
            />
            <div className="mt-3 px-2">
              <SourceLine meta={supplyChainRes.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Corporate Network Engine Unavailable"
              message={
                (!hierarchyRes.ok
                  ? hierarchyRes.message
                  : !supplyChainRes.ok
                  ? supplyChainRes.message
                  : summaryRes.ok
                  ? null
                  : summaryRes.message) || "Unable to retrieve corporate network relationships"
              }
            />
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
