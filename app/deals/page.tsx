import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DataUnavailable, FreshnessBadge, SourceLine } from "@/components/ui/data-provenance";
import { DealsView } from "@/components/market/deals-view";
import { getDeals } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Bulk & Block Deals · Arthdex",
  description: "Large trades disclosed by the exchange: bulk deals, block deals and short-selling disclosures.",
};

export default async function DealsPage() {
  const result = await getDeals();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={ArrowLeftRight}>Deals</Eyebrow>
            <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Bulk &amp; block deals
            </h1>
            <p className="mt-3 text-muted-foreground">
              Large trades the exchange makes public, with who traded, at what price and for how much.
            </p>
          </div>
          {result.ok ? <FreshnessBadge meta={result.meta} /> : null}
        </div>

        <div className="mt-8">
          {result.ok ? (
            <>
              <DealsView deals={result.data} />
              <SourceLine meta={result.meta} className="mt-4" />
            </>
          ) : (
            <DataUnavailable title="Deals unavailable" message={result.message} />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
