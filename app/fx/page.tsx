import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { FxMonitorDesk } from "@/components/market/fx-monitor-desk";
import { getForexMonitor } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Foreign Exchange Cross-Rates & INR Monitor (FXM) · Arthdex Terminal",
  description: "Live INR spot cross-rates (USD, EUR, GBP, JPY, AED, CNY), official FBIL reference rates, forward premia term structure, and RBI 40-currency REER/NEER indices.",
};

export const revalidate = 120;

export default async function FxPage() {
  const res = await getForexMonitor();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {res.ok ? (
          <>
            <FxMonitorDesk initialData={res.data} />
            <div className="mt-3 px-2">
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Forex Telemetry Offline"
              message={res.message || "Interbank foreign exchange feeds temporarily unavailable"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
