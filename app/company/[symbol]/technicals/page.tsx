import type { Metadata } from "next";
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
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <TechnicalWorkbench symbol={symbol.toUpperCase()} />
    </div>
  );
}
