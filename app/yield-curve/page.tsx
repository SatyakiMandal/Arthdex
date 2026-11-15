import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { YieldCurveDesk } from "@/components/market/yield-curve-desk";
import { getYieldCurve } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Government bond yields · Arthdex",
  description: "The RBI's benchmark government bond yields and T-bill cut-offs, with the policy corridor, from rbi.org.in.",
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
              title="RBI rates unavailable"
              message={res.message || "The RBI website did not answer"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
