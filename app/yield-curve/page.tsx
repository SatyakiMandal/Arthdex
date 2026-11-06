import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { YieldCurveDesk } from "@/components/market/yield-curve-desk";
import { getYieldCurve } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "India Sovereign Yield Curve (GC IN) · Arthdex Terminal",
  description: "India Sovereign Par Yield Curve across 10 tenors (91D T-Bill to 40Y G-Sec), 2s10s and 5s10s slope spreads, RBI Monetary Policy Corridor, and Nelson-Siegel parametric fitting.",
};

export const revalidate = 3600;

export default async function YieldCurvePage() {
  const res = await getYieldCurve();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {res.ok ? (
          <>
            <YieldCurveDesk initialData={res.data} />
            <div className="mt-3 px-2">
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Sovereign Yield Curve Offline"
              message={res.message || "RBI NDS-OM sovereign bond feeds temporarily unavailable"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
