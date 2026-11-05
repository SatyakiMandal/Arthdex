import { PageStamp } from "@/components/layout/refresh-control";
import { SectionHead } from "@/components/ui/section-head";
import type { Metadata } from "next";
import { StatementsView } from "@/components/yahoo/statements-view";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getYStatements } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Statements | Arthdex` };
}

export default async function Page({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  const res = await getYStatements(upper);
  return (
    <div className="mx-auto w-full max-w-[1920px] px-2 py-2 sm:px-3 lg:px-4 space-y-3">
      <SectionHead title="Financial statements" note="Income statement, balance sheet and cash flow, annual or quarterly" className="mb-2.5 sm:mb-3" />
      {res.ok ? (
        <>
          {(res.data.latestQuarterAgeDays ?? 0) > 150 ? (
            <p role="note" className="mb-6 rounded-none border border-flat/40 bg-flat/10 px-4 py-3 text-sm">
              The newest quarterly statement here ended on {res.data.latestQuarter}, {res.data.latestQuarterAgeDays} days
              ago. Full line items come from a single source that is behind for this company; the Overview&apos;s
              quarterly results use a second, current source.
            </p>
          ) : null}
          <StatementsView data={res.data} />
          <div className="mt-4">
<PageStamp meta={res.meta} />
            <SourceLine meta={res.meta} />
          </div>
        </>
      ) : (
        <DataUnavailable title="Statements unavailable" message={res.message} />
      )}
    </div>
  );
}
