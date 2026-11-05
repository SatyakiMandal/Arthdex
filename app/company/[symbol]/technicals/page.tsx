import type { Metadata } from "next";
import { SectionHead } from "@/components/ui/section-head";
import { TechnicalWorkbench } from "@/components/technicals/technical-workbench";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Technicals | Arthdex` };
}

export default async function TechnicalsPage({ params }: PageProps) {
  const { symbol } = await params;
  return (
    <div className="mx-auto w-full max-w-[1920px] px-2 py-2 sm:px-3 lg:px-4 space-y-3">
      <SectionHead title="Technicals" note="Indicator readings, support and resistance, and the latest signals on the price series" className="mb-2.5 sm:mb-3" />
      <TechnicalWorkbench symbol={symbol.toUpperCase()} />
    </div>
  );
}
