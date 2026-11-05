import { PageStamp } from "@/components/layout/refresh-control";
import { SectionHead } from "@/components/ui/section-head";
import type { Metadata } from "next";
import { StatisticsView } from "@/components/yahoo/statistics-view";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getYStats } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Statistics | Arthdex` };
}

export default async function Page({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  const res = await getYStats(upper);
  return (
    <div className="mx-auto w-full max-w-[1920px] px-2 py-2 sm:px-3 lg:px-4 space-y-3">
      <SectionHead title="Statistics" note="Valuation, profitability, trading and dividend figures, trailing twelve months unless marked" className="mb-2.5 sm:mb-3" />
      {res.ok ? (
        <>
          <StatisticsView data={res.data} />
          <div className="mt-4">
<PageStamp meta={res.meta} />
            <SourceLine meta={res.meta} />
          </div>
        </>
      ) : (
        <DataUnavailable title="Statistics unavailable" message={res.message} />
      )}
    </div>
  );
}
