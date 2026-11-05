import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SectionHead } from "@/components/ui/section-head";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { CompanyComparisonMatrix } from "@/components/compare/company-comparison-matrix";
import { getCompanyCompare } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Compare Companies · Arthdex",
  description:
    "Compare up to four Indian companies side by side across valuation multiples, capital efficiency, profitability, leverage, and forensic diagnostics.",
};

interface PageProps {
  searchParams: Promise<{ symbols?: string }>;
}

const DEFAULT_SYMBOLS = ["TCS", "INFY", "HCLTECH", "WIPRO"];

export default async function ComparePage({ searchParams }: PageProps) {
  const { symbols: rawSymbols } = await searchParams;
  const symbols = rawSymbols
    ? rawSymbols
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 4)
    : DEFAULT_SYMBOLS;

  const compareRes = await getCompanyCompare(symbols.length > 0 ? symbols : DEFAULT_SYMBOLS);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1920px] px-2.5 py-6 sm:px-4 lg:px-6">
        <Eyebrow>Research</Eyebrow>
        <h1 className="mt-4 text-balance text-4xl sm:text-5xl">Compare Companies</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Side-by-side ledger comparing up to four listed Indian companies across valuation multiples,
          return on equity, debt-to-equity leverage, and forensic health checks (Piotroski, Altman, Beneish).
        </p>

        <section aria-labelledby="matrix" className="mt-10">
          <SectionHead
            id="matrix"
            title="Head-to-Head Comparison Matrix"
            note="Up to 4 companies side by side across valuation, health and forensics"
          />
          <div className="mt-6">
            {compareRes.ok ? (
              <>
                <CompanyComparisonMatrix initialData={compareRes.data} />
                <div className="mt-6">
                  <SourceLine meta={compareRes.meta} />
                </div>
              </>
            ) : (
              <DataUnavailable
                title="Comparison Matrix Unavailable"
                message={compareRes.message}
              />
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
