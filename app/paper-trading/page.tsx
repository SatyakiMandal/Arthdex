import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { PaperTradingDesk } from "@/components/portfolio/paper-trading-desk";
import { getPaperAccount } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Paper Trading Simulator & EMSX (PAPR) · Arthdex Terminal",
  description: "Virtual execution simulator with ₹10,00,000 capital, live Indian regulatory cost engine (STT, GST, Stamp Duty, Exchange Turnover), and order book ledger.",
};

export const revalidate = 0; // Live client execution desk

export default async function PaperTradingPage() {
  const res = await getPaperAccount();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {res.ok ? (
          <>
            <PaperTradingDesk initialData={res.data} />
            <div className="mt-3 px-2">
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Virtual Execution Engine Offline"
              message={res.message || "Paper trading matching engine is temporarily unavailable"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
