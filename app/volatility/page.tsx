import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { VolatilitySurfaceDesk } from "@/components/derivatives/volatility-surface-desk";
import { getVolatilitySurface } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Implied Volatility Surface & Skew (OVDV) · Arthdex Terminal",
  description: "2D strike vs expiry implied volatility surface, 25-Delta risk reversal skew, and term structure for Indian equity derivatives.",
};

export const revalidate = 300;

interface VolatilityPageProps {
  searchParams: Promise<{
    symbol?: string;
  }>;
}

export default async function VolatilityPage({ searchParams }: VolatilityPageProps) {
  const { symbol = "NIFTY" } = await searchParams;
  const sym = symbol.toUpperCase();

  const res = await getVolatilitySurface(sym);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {res.ok ? (
          <>
            <VolatilitySurfaceDesk initialData={res.data} />
            <div className="mt-3 px-2">
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Volatility Surface Offline"
              message={res.message || "NSE derivatives option surface is temporarily unavailable"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
