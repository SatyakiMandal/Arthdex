import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { MacroEconomicDesk } from "@/components/macro/macro-economic-desk";
import { getMacroDashboard } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "India Macro & Economics (ECO) · Arthdex Terminal",
  description: "India macroeconomic telemetry: CPI & WPI inflation, GDP growth, GST collections, E-Way bills, RBI forex reserves, and policy release calendar.",
};

export const revalidate = 3600;

export default async function MacroPage() {
  const res = await getMacroDashboard();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {res.ok ? (
          <>
            <MacroEconomicDesk initialData={res.data} />
            <div className="mt-3 px-2">
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Macroeconomic Telemetry Offline"
              message={res.message || "Central statistical databases temporarily unavailable"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
