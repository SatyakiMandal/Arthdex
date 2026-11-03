import { PageStamp } from "@/components/layout/refresh-control";
import { SectionHead } from "@/components/ui/section-head";
import type { Metadata } from "next";
import { BenchmarkSensitivityPanel } from "@/components/macro/benchmark-sensitivity";
import { NewsFeed } from "@/components/macro/news-feed";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getNews, getSensitivity } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Macro & News | Arthdex` };
}

export default async function CompanyMacroPage({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  const [sensitivity, news] = await Promise.all([
    getSensitivity(upper),
    getNews({ symbol: upper, limit: 30 }),
  ]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-8 lg:py-10 sm:px-6">
      <SectionHead title="Macro and news" note="How the stock moves with its benchmarks, and the filings and news that mention it" className="mb-8" />
      {sensitivity ? (
        <>
          <BenchmarkSensitivityPanel sensitivity={sensitivity.data} />
<PageStamp meta={sensitivity.meta} />
          <SourceLine meta={sensitivity.meta} className="px-1" />
        </>
      ) : (
        <DataUnavailable
          title="Sensitivity unavailable"
          message={`No regression could be run for ${upper}.`}
        />
      )}

      {news.ok ? (
        <NewsFeed
          items={news.data.items}
          title={`Filings & Coverage · ${upper}`}
          subtitle="Exchange disclosures and press mentioning this ticker"
        />
      ) : (
        <DataUnavailable title="News unavailable" message={news.message} />
      )}
    </div>
  );
}
