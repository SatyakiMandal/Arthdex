import type { Metadata } from "next";
import { Building2 } from "lucide-react";
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

      <main id="main" className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={Building2}>Unlisted space</Eyebrow>
            <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Private-market coverage
            </h1>
            <p className="mt-3 text-muted-foreground">
              Indicative prices and key ratios for unlisted and pre-IPO companies, with the full revision history behind
              each price.
            </p>
          </div>
          {result.ok ? <FreshnessBadge meta={result.meta} /> : null}
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
