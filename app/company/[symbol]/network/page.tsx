import type { Metadata } from "next";

import { OwnershipView } from "@/components/network/ownership-view";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getOwnership } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol).toUpperCase();
  return {
    title: `${sym} ownership · Arthdex`,
    description: `Promoters, promoter-group entities and large public shareholders of ${sym}, from its latest shareholding filing.`,
  };
}

export default async function CompanyNetworkPage({ params }: PageProps) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol).toUpperCase();
  const res = await getOwnership(sym);

  return (
    <div className="mx-auto w-full max-w-[1920px] space-y-3 px-2 py-3 sm:px-3 lg:px-4">
      {res.ok ? (
        <>
          <OwnershipView data={res.data} />
          <SourceLine meta={res.meta} />
        </>
      ) : (
        <div className="py-12">
          <DataUnavailable title="Ownership not available" message={res.message} />
        </div>
      )}
    </div>
  );
}
