import type { Metadata } from "next";
import { DcfWorkbench } from "@/components/valuation/dcf-workbench";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getCompanyDcf } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  return {
    title: `${sym} discounted cash flow · Arthdex`,
    description: `A two-stage cash-flow model for ${sym} on its own reported figures, with every assumption shown and editable.`,
  };
}

export default async function ValuationPage({ params }: PageProps) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  const res = await getCompanyDcf(sym);

  return (
    <div className="mx-auto w-full max-w-[1920px] space-y-4 px-2 py-4 sm:px-3 lg:px-4">
      <h1 className="text-xl font-semibold">Discounted cash flow{res.ok ? `: ${res.data.defaults.name}` : ""}</h1>
      {res.ok ? (
        <>
          <DcfWorkbench inputs={res.data.defaults} />
          <SourceLine meta={res.meta} />
        </>
      ) : (
        <DataUnavailable title="No cash-flow model for this company" message={res.message} />
      )}
    </div>
  );
}
