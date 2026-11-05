import type { Metadata } from "next";
import { Activity, Info } from "lucide-react";
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
      <main id="main" className="mx-auto w-full max-w-[1920px] px-2.5 py-4 sm:px-4 lg:px-6">
        <Eyebrow icon={Activity}>Order flow</Eyebrow>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight">Participation, liquidity and aggression</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Volume profile, delta, CVD, footprint, absorption and big volume, with gamma, delta and theta exposure, open interest and 0DTE from listed options. Read
          them against market structure and location, and size from the stop.
        </p>
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground flex items-start gap-3">
          <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-foreground text-2xs uppercase tracking-wider">
              MODELLED ORDER FLOW ANALYTICS · NOT LEVEL 3 EXCHANGE TAPE
            </span>
            <p className="text-3xs leading-relaxed text-muted-foreground">
              Aggressor buy and sell volume, CVD (Cumulative Volume Delta), and footprint imbalances are algorithmically estimated from OHLCV bar ranges because public feeds do not provide tick-by-tick Level 3 matched order execution tapes. Volume profile and value area are exact functions of the bars. Resting-liquidity order-book heatmaps are withheld rather than simulated.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <OrderflowWorkbench symbol="NQ" market="futures" selectable />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
