import { PageStamp } from "@/components/layout/refresh-control";
import { SectionHead } from "@/components/ui/section-head";
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
    <div className="mx-auto w-full max-w-[1920px] px-2 py-2 sm:px-3 lg:px-4 space-y-3">
      <SectionHead title="Shareholding" note="Who owns the company, how that has changed and how much promoters have pledged" className="mb-2.5 sm:mb-3" />
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
