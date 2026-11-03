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
    <div className="mx-auto max-w-[1600px] px-4 py-8 lg:py-10 sm:px-6">
      <SectionHead title="Technicals" note="Indicator readings, support and resistance, and the latest signals on the price series" className="mb-8" />
      <TechnicalWorkbench symbol={symbol.toUpperCase()} />
    </div>
  );
}
