import { PageStamp } from "@/components/layout/refresh-control";
import { SectionHead } from "@/components/ui/section-head";
import type { Metadata } from "next";
import { HistoryView } from "@/components/yahoo/history-view";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getYHistory, getYCompare } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Historical data | Arthdex` };
}

export default async function Page({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  const [hist, cmp] = await Promise.all([getYHistory(upper, "5Y"), getYCompare(upper, [], "5Y")]);
  return (
    <div className="mx-auto w-full max-w-[1920px] px-2 py-2 sm:px-3 lg:px-4 space-y-3">
      <SectionHead title="Price history" note="Past prices for any range, and how the stock has done against the Nifty 50" className="mb-2.5 sm:mb-3" />
      {hist.ok ? (
        <>
          <HistoryView history={hist.data} compare={cmp.ok ? cmp.data : null} />
          <div className="mt-4">
<PageStamp meta={hist.meta} />
            <SourceLine meta={hist.meta} />
          </div>
        </>
      ) : (
        <DataUnavailable title="Price history unavailable" message={hist.message} />
      )}
    </div>
  );
}
