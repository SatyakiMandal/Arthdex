import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ArrowLeftRight } from "lucide-react";
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
      <main id="main" className="w-full px-2 py-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-accent" />
              <span>Head-to-Head Company Comparison Ledger</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Multi-Pillar Multiples, ROE, Leverage &amp; Composite Forensic Health Benchmarking
            </span>
          </div>
        </div>

        <section aria-labelledby="matrix" className="mt-3">
          <SectionHead
            id="matrix"
            title="Head-to-Head Comparison Matrix"
            note="Up to 4 companies side by side across valuation, health and forensics"
          />
          <div className="mt-2.5">
            {compareRes.ok ? (
              <>
                <CompanyComparisonMatrix initialData={compareRes.data} />
                <div className="mt-2.5">
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
