import type { Metadata } from "next";
import { SourceLine, DataUnavailable } from "@/components/ui/data-provenance";
import { CorporateGraphView } from "@/components/network/corporate-graph-view";
import { getCorporateHierarchy, getSupplyChainNetwork, getNetworkSummary } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Supply Chain & Corporate Network (SPLC / HOLD) · Arthdex Terminal",
  description: "Interconnected multi-tier supply chain, customer off-take channels, sole-source dependencies, and conglomerate holding structures.",
};

export const revalidate = 3600;

interface CompanyNetworkPageProps {
  params: Promise<{ symbol: string }>;
  searchParams?: Promise<{ mode?: string }>;
}

export default async function CompanyNetworkPage({ params, searchParams }: CompanyNetworkPageProps) {
  const { symbol } = await params;
  const sp = searchParams ? await searchParams : {};
  const cleanSymbol = symbol.trim().toUpperCase();

  const [hierarchyRes, supplyChainRes, summaryRes] = await Promise.all([
    getCorporateHierarchy(cleanSymbol),
    getSupplyChainNetwork(cleanSymbol),
    getNetworkSummary(cleanSymbol),
  ]);

  return (
    <div className="w-full space-y-3 py-2">
      {hierarchyRes.ok && supplyChainRes.ok && summaryRes.ok ? (
        <>
          <CorporateGraphView
            initialSymbol={cleanSymbol}
            initialHierarchy={hierarchyRes.data}
            initialSupplyChain={supplyChainRes.data}
            initialSummary={summaryRes.data}
            initialMode={sp?.mode?.toUpperCase() === "HOLD" ? "HOLD" : "SPLC"}
          />
          <div className="mt-2 px-2">
            <SourceLine meta={supplyChainRes.meta} />
          </div>
        </>
      ) : (
        <div className="py-12">
          <DataUnavailable
            title="Corporate Network Unavailable"
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
    </div>
  );
}
