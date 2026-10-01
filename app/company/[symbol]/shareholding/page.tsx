import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import { ShareholdingView } from "@/components/shareholding/shareholding-view";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getShareholding } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Shareholders | Arthdex` };
}

export default async function ShareholdingPage({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  const res = await getShareholding(upper);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      {res.ok ? (
        <>
          <ShareholdingView data={res.data} />
          <div className="mt-4">
<PageStamp meta={res.meta} />
            <SourceLine meta={res.meta} />
          </div>
        </>
      ) : (
        <DataUnavailable title="Shareholding unavailable" message={res.message} />
      )}
    </div>
  );
}
