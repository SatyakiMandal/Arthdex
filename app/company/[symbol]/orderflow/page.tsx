import type { Metadata } from "next";
import { SectionHead } from "@/components/ui/section-head";
import { OrderflowWorkbench } from "@/components/orderflow/orderflow-workbench";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Order flow | Arthdex` };
}

export default async function OrderflowPage({ params }: PageProps) {
  const { symbol } = await params;
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 lg:py-10 sm:px-6">
      <SectionHead title="Order flow" note="Where volume traded by price, where it was absorbed, and the largest prints" className="mb-8" />
      <OrderflowWorkbench symbol={symbol.toUpperCase()} market="nse" />
    </div>
  );
}
