import type { Metadata } from "next";
import { TearSheetView } from "@/components/reports/tear-sheet-view";
import { getInstitutionalTearSheet } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol).toUpperCase();
  return {
    title: `${sym} tear sheet · Arthdex`,
    description: `Two-page factsheet for ${sym}: price, annual financials and growth, peers, shareholding and analyst estimates.`,
  };
}

export default async function TearPage({ params }: PageProps) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol).toUpperCase();
  const res = await getInstitutionalTearSheet(sym);
  const initialData = res.ok && res.data ? res.data : null;
  const error = res.ok ? null : res.status === 404 ? `${sym} is not covered by the data sources.` : "The data service did not respond. Try again shortly.";

  return (
    <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-4 space-y-4">
      <TearSheetView symbol={sym} initialData={initialData} error={error} />
    </div>
  );
}
