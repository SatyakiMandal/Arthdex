import type { Metadata } from "next";
import { SmeMarketsDesk } from "@/components/markets/sme-markets-desk";

export const metadata: Metadata = {
  title: "Dedicated SME Exchange Board (SME) · Arthdex",
  description:
    "NSE Emerge and BSE SME market intelligence: IPO pipeline, subscription multiples, minimum lot size filters, and Mainboard migration radar.",
};

export default function SmePage() {
  return (
    <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-4 space-y-4">
      {/* Title Header */}
      <div className="flex flex-wrap items-baseline justify-between border-b border-border pb-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-base font-bold uppercase tracking-wider text-foreground">
            DEDICATED SME EXCHANGE BOARD (SME)
          </h1>
          <span className="font-mono text-3xs text-muted-foreground">M20 · NSE EMERGE &amp; BSE SME PLATFORM</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
          <span className="text-accent font-bold">ALT+K: SME &lt;GO&gt;</span>
          <span>•</span>
          <span>IPO RADAR • LOT-SIZE ANALYTICS • MAINBOARD MIGRATION</span>
        </div>
      </div>

      <SmeMarketsDesk />
    </div>
  );
}
