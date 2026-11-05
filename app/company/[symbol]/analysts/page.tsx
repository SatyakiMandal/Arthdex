import { PageStamp } from "@/components/layout/refresh-control";
import { SectionHead } from "@/components/ui/section-head";
import type { Metadata } from "next";
import { AnalystsView } from "@/components/yahoo/analysts-view";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getYAnalysts } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Analysts | Arthdex` };
}

export default async function Page({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  const res = await getYAnalysts(upper);
  return (
    <div className="mx-auto w-full max-w-[1920px] px-2 py-2 sm:px-3 lg:px-4 space-y-3">
      <SectionHead title="Analyst view" note="Price targets, rating trends and how reported earnings compared with estimates" className="mb-2.5 sm:mb-3" />
      {res.ok ? (
        <>
          <AnalystsView data={res.data} />
          <div className="mt-4">
<PageStamp meta={res.meta} />
            <SourceLine meta={res.meta} />
          </div>
        </>
      ) : (
        <DataUnavailable title="Analysts unavailable" message={res.message} />
      )}
    </div>
  );
}
