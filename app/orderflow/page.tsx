import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { OrderflowWorkbench } from "@/components/orderflow/orderflow-workbench";

export const metadata: Metadata = {
  title: "Order flow | Arthdex",
  description: "Volume profile, delta, CVD, footprint, absorption and options exposure for futures, ETFs and NSE stocks.",
};

export default function OrderflowPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <Eyebrow icon={Activity}>Order flow</Eyebrow>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight">Participation, liquidity and aggression</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Volume profile, delta, CVD, footprint, absorption and big volume, with gamma, delta and theta exposure, open interest and 0DTE from listed options. Read
          them against market structure and location, and size from the stop.
        </p>
        <div className="mt-6">
          <OrderflowWorkbench symbol="NQ" market="futures" selectable />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
