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

      <main id="main" className="mx-auto w-full max-w-[1920px] px-2.5 py-6 sm:px-4 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={Building2}>Unlisted space</Eyebrow>
            <h1 className="mt-4 text-balance text-4xl sm:text-5xl">
              Private-market coverage
            </h1>
            <p className="mt-3 text-muted-foreground">
              Indicative prices and key ratios for unlisted and pre-IPO companies, with the full revision history behind
              each price.
            </p>
          </div>
          {result.ok ? <FreshnessBadge meta={result.meta} /> : null}
        </div>

        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
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

        <div className="mt-8">
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
