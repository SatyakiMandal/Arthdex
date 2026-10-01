import { PageStamp } from "@/components/layout/refresh-control";
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
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      {res.ok ? (
        <>
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
