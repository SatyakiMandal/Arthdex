import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getSectorKpiOverview } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Sector operating KPIs · Arthdex",
  description: "Operating indicators by sector. Not yet connected to the publishing bodies' releases.",
  robots: { index: false },
};

export default async function SectorsPage() {
  const res = await getSectorKpiOverview();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1920px] flex-1 space-y-4 p-2 sm:p-4">
        <h1 className="border-b border-border pb-2 font-mono text-base font-bold uppercase tracking-wider text-foreground">
          Sector operating KPIs
        </h1>
        {res.ok ? (
          <>
            <pre className="overflow-x-auto border border-border bg-surface p-3 text-2xs">{JSON.stringify(res.data, null, 2)}</pre>
            <SourceLine meta={res.meta} />
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable title="Sector KPIs are not connected" message={res.message} />
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
