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
    <div className="mx-auto w-full max-w-[1920px] px-2 py-2 sm:px-3 lg:px-4 space-y-3">
      <SectionHead title="Order flow" note="Where volume traded by price, where it was absorbed, and the largest prints" className="mb-2.5 sm:mb-3" />
      <OrderflowWorkbench symbol={symbol.toUpperCase()} market="nse" />
    </div>
  );
}
