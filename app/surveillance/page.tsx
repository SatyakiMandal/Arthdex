import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { SurveillanceDesk } from "@/components/market/surveillance-desk";
import { getSurveillance } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "SEBI Surveillance & Price Bands (SURV) · Arthdex Terminal",
  description: "Live SEBI and NSE surveillance measures: Additional Surveillance Measure (ASM Long/Short-Term), Graded Surveillance Measure (GSM Stages I-IV), Trade-to-Trade (T2T Series BE), and circuit price bands.",
};

export const revalidate = 3600;

export default async function SurveillancePage() {
  const res = await getSurveillance();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {res.ok ? (
          <>
            <SurveillanceDesk initialData={res.data} />
            <div className="mt-3 px-2">
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Surveillance Data Stream Offline"
              message={res.message || "Exchange surveillance feeds temporarily unavailable"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
