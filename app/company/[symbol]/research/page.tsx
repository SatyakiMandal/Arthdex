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
    <div className="mx-auto max-w-[1600px] px-4 py-8 lg:py-10 sm:px-6">
      <SectionHead title="Research dossier" note="A structured analysis of the company across several lenses, run on demand" className="mb-8" />
      <ResearchPanel symbol={symbol.toUpperCase()} />
    </div>
  );
}
