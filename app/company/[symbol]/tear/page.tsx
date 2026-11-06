import type { Metadata } from "next";
import { TearSheetView } from "@/components/reports/tear-sheet-view";
import { getInstitutionalTearSheet } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const sym = (symbol || "RELIANCE").toUpperCase();
  return {
    title: `${sym} Institutional Tear-Sheet & Factsheet (TEAR) · Arthdex`,
    description: `Audited 2-page institutional research factsheet, 10Y CAGR ledger, shareholding pattern and consensus multiples for ${sym}.`,
  };
}

export default async function TearPage({ params }: PageProps) {
  const { symbol } = await params;
  const sym = (symbol || "RELIANCE").toUpperCase();
  const res = await getInstitutionalTearSheet(sym);
  const initialData = res.ok && res.data ? res.data : null;

  return (
    <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-4 space-y-4">
      <TearSheetView symbol={sym} initialData={initialData} />
    </div>
  );
}
