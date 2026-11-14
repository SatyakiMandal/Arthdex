import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Briefcase } from "lucide-react";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { postPortfolioAnalyze } from "@/lib/api/endpoints";
import type { ApiPortfolioAnalysis } from "@/lib/api/types";
import { PortfolioTerminal, SAMPLE_PORTFOLIOS } from "@/components/portfolio/portfolio-terminal";

export const metadata: Metadata = {
  title: "Portfolio & Tax Harvester · Arthdex",
  description:
    "Accurate multi-lot portfolio diagnostics: true Newton-Raphson XIRR, Section 112A tax-loss harvesting with Budget 2024 rules (₹1.25L LTCG exemption), and peer-swaps.",
};

export default async function PortfolioPage() {
  // The page opens on a sample portfolio (labelled as one) priced by the data service. If the
  // service does not answer there is nothing truthful to show, so the page says so.
  let initialData: ApiPortfolioAnalysis | null = null;
  let failure = "The data service did not respond, so the sample portfolio could not be priced. Try again shortly.";
  try {
    const res = await postPortfolioAnalyze(SAMPLE_PORTFOLIOS[0].holdings);
    if (res.ok && res.data) initialData = res.data;
    else if (!res.ok && res.status) failure = res.message;
  } catch {
    // reported below
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-accent" />
              <span>Portfolio &amp; Section 112A Tax Harvester</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              True Newton-Raphson XIRR, Budget 2024 Capital Gains Optimiser &amp; Peer Swaps
            </span>
          </div>
        </div>

        <div className="mt-2">
          {initialData ? (
            <PortfolioTerminal initialAnalysis={initialData} />
          ) : (
            <div className="py-12">
              <DataUnavailable title="Portfolio analysis unavailable" message={failure} />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
