import type { Metadata } from "next";
import { NotSourced } from "@/components/ui/not-sourced";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} group and supply chain · Arthdex` };
}

export default async function CompanyNetworkPage({ params }: PageProps) {
  const { symbol } = await params;
  return (
    <div className="mx-auto max-w-[1920px] px-2 sm:px-3 lg:px-4">
      <NotSourced title="Group structure and supply chain" path={`/api/v1/network/summary?symbol=${encodeURIComponent(symbol.toUpperCase())}`} />
    </div>
  );
}
