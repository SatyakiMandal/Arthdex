import type { Metadata } from "next";
import { DcfWorkbench } from "@/components/valuation/dcf-workbench";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const sym = (symbol || "RELIANCE").toUpperCase();
  return {
    title: `${sym} Valuation Lab & Interactive DCF (VAL) · Arthdex`,
    description: `2-stage FCFF model, Reverse DCF implied growth, CAPM WACC calculator and sensitivity matrix for ${sym}.`,
  };
}

export default async function ValuationPage({ params }: PageProps) {
  const { symbol } = await params;
  const sym = (symbol || "RELIANCE").toUpperCase();

  return (
    <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-4 space-y-4">
      {/* Title Header */}
      <div className="flex flex-wrap items-baseline justify-between border-b border-border pb-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-base font-bold uppercase tracking-wider text-foreground">
            {sym} · VALUATION LAB &amp; INTERACTIVE DCF (VAL, DCF)
          </h1>
          <span className="font-mono text-3xs text-muted-foreground">M6 · INTRINSIC VALUE &amp; REVERSE DCF</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
          <span className="text-accent font-bold">ALT+K: {sym} VAL &lt;GO&gt;</span>
          <span>•</span>
          <span>CAPM WACC • 5Y FCFF • REVERSE SOLVER</span>
        </div>
      </div>

      <DcfWorkbench symbol={sym} />
    </div>
  );
}
