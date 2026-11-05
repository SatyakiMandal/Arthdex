import type { Metadata } from "next";
import { AlertTriangle, Building2 } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DataUnavailable, FreshnessBadge, SourceLine } from "@/components/ui/data-provenance";
import { DirectoryView } from "@/components/unlisted/directory-view";
import { getUnlistedDirectory } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Unlisted Space · Arthdex",
  description: "Indicative prices, price history and key ratios for unlisted and pre-IPO Indian companies.",
};

export default async function UnlistedIndexPage() {
  const result = await getUnlistedDirectory();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main" className="w-full px-2 py-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" />
              <span>Unlisted &amp; Private Equity Desk</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Dealer Indicative OTC Marks, Reconstructed Valuations &amp; Revision History
            </span>
          </div>
          {result.ok ? <FreshnessBadge meta={result.meta} /> : null}
        </div>

        <div className="mt-2.5 rounded-none border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-amber-300 text-2xs uppercase tracking-wider">
                INDICATIVE OVER-THE-COUNTER (OTC) MARKS
              </span>
              <p className="text-3xs leading-relaxed text-amber-200/90">
                Unlisted and pre-IPO shares trade OTC, not on any regulated stock exchange. Prices are compiled indicative marks from dealer sites (UnlistedZone). They represent dealer desk levels, not an executable continuous quote. Non-trading flat days are filtered out rather than interpolated.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          {result.ok ? (
            <>
              <DirectoryView companies={result.data.companies} sectors={result.data.sectors} />
              <SourceLine meta={result.meta} className="mt-6" />
            </>
          ) : (
            <DataUnavailable title="Unlisted directory unavailable" message={result.message} />
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
