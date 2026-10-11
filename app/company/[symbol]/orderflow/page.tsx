import type { Metadata } from "next";
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
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <OrderflowWorkbench symbol={symbol.toUpperCase()} market="nse" />
    </div>
  );
}
