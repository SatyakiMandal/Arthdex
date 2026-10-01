import { PageStamp } from "@/components/layout/refresh-control";
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
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
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
