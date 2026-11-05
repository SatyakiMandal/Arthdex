import type { Metadata } from "next";
import { SectionHead } from "@/components/ui/section-head";
import { ResearchPanel } from "@/components/company/research-panel";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Research Dossier | Arthdex` };
}

export default async function ResearchPage({ params }: PageProps) {
  const { symbol } = await params;
  return (
    <div className="mx-auto w-full max-w-[1920px] px-2 py-2 sm:px-3 lg:px-4 space-y-3">
      <SectionHead title="Research dossier" note="A structured analysis of the company across several lenses, run on demand" className="mb-2.5 sm:mb-3" />
      <ResearchPanel symbol={symbol.toUpperCase()} />
    </div>
  );
}
